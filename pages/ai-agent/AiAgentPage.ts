import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { dismissAnnouncementModal } from '../shared/dismissAnnouncementModal';

/**
 * Page object for the Analytics "AI Agent" chat (`/AiAgent`, left nav under
 * Analytics — NOT the header chat widget, which is a separate, action-less
 * "Analytics Agent" that only answers from the user guide).
 *
 * Verified live on staging (2026-08-18), company **SmarshCR Sales** — this is
 * the only company observed where a scorecard-generation prompt produces a
 * "RECOMMENDED SYSTEM ACTIONS" card with a working action button; on
 * Roman_QA_TEST the same prompt gets a text-only "I can't create the
 * scorecard for you from here" reply with no action card at all (see ADO
 * bug 36210 / shared step 22282, which requires "full access to the
 * Analytics configurations" on SmarshCR Sales).
 *
 * Response flow for a scorecard-generation prompt:
 *   1. Agent replies with a "QA Scorecard Staged" summary (staged, not saved).
 *   2. A "RECOMMENDED SYSTEM ACTIONS" card renders **collapsed**, naming the
 *      staged form; expanding it (`actionCardExpandIcon`) reveals a
 *      "Create QA Scorecard" button.
 *   3. Clicking it navigates to `/QAScorecards` with the AI-generated
 *      structure loaded in the flow-chart editor (see `ScorecardEditorPage`),
 *      still unsaved — the user must still click "Save and Exit" there.
 *
 * ADO bug 36210 reports this button-click -> editor-navigation hop as
 * intermittently failing to save. `createStagedScorecard()` expands the
 * card first (required — see its doc) but otherwise does not retry beyond
 * that: a stuck/timed-out click past that point is the failure this suite
 * exists to catch, not something to paper over.
 */
/** One observed attempt at the AI Agent's streaming endpoint
 *  (`api/reports/ai-agent/query/stream`) — see {@link AiAgentPage.streamAttempts}. */
export interface StreamAttempt {
  outcome: 'response' | 'requestfailed';
  /** HTTP status, or the Playwright failure text (e.g. "net::ERR_...") for a
   *  request that failed before any response arrived. */
  status: number | string;
  timestamp: string;
}

export class AiAgentPage extends BasePage {
  readonly promptInput: Locator;
  readonly startNewConversationButton: Locator;
  readonly createScorecardButton: Locator;
  readonly dismissActionButton: Locator;
  /**
   * Every observed attempt at `api/reports/ai-agent/query/stream` since this
   * page object was constructed — populated live via `page.on('response')` /
   * `page.on('requestfailed')`, not read back after the fact, so a
   * mid-stream drop (a `requestfailed` after a 200 `response` for the same
   * attempt) is visible too, not just the final outcome.
   *
   * Investigated live (2026-08-26): a single prompt submission routinely
   * causes 2 quick 401s on this endpoint before a 200 lands — each 401 used
   * the same (apparently stale) bearer token, the eventual 200 a different
   * (refreshed) one. That churn looks like normal token-refresh-on-401
   * behavior, not itself a bug — but see {@link formatStreamDiagnostics}:
   * the open question this exists to help answer is whether a run that
   * never reaches "Create QA Scorecard" is this retry loop failing to ever
   * land a 200 (or a 200 stream that opens and then drops mid-flight),
   * matching the ADO-36210-style "agent doesn't respond" reports — this
   * array is the evidence to check that against per failed run, since
   * SmarshCR Sales' ~100 recent conversations (shared account) makes the
   * app's own history/network tab useless for isolating a single test's
   * attempt after the fact.
   */
  readonly streamAttempts: StreamAttempt[] = [];
  /** The "QA Scorecard" label inside the RECOMMENDED SYSTEM ACTIONS card —
   *  its parent element also contains the staged form's name as a sibling
   *  text node. `.last()` because the sidebar's conversation history can
   *  repeat the same words in older entries; the action card for the
   *  latest response is the most recently rendered match. Deliberately
   *  structural rather than parsed from the chat's prose summary — that
   *  wording has been observed to vary run to run ("staged a new QA
   *  scorecard named X" vs "staged a QA scorecard called X", etc., all
   *  presumably from the same underlying LLM response, just phrased
   *  differently each time), which made regex matching it a moving target.
   */
  readonly stagedScorecardNameLabel: Locator;
  /**
   * The action card's expand/collapse chevron. Clicking it is required
   * before "Create QA Scorecard" is reliably clickable — confirmed live.
   *
   * Scoped to `[class*="accordion_iconContainer"]` rather than the chevron
   * shape alone (`svg[viewBox="0 0 8 5"]`): that viewBox also matches the
   * unrelated "Show thinking" toggle's chevron elsewhere in the same
   * response (`reasoning-block_chevron`, `fill="currentColor"` vs this
   * icon's `fill="var(--arrow-color)"`) — inspected both live via
   * `document.querySelectorAll`, `.last()` happened to still pick the right
   * one by DOM order, but that's incidental, not something to rely on.
   * `.last()` here for the same reason as `stagedScorecardNameLabel` — the
   * newest card, in case older ones are still in the conversation view.
   */
  readonly actionCardExpandIcon: Locator;

  constructor(page: Page) {
    super(page);
    this.promptInput = page.getByRole('textbox', { name: 'Ask AI Agent' });
    this.startNewConversationButton = page.getByRole('button', { name: 'Start New Conversation' });
    this.createScorecardButton = page.getByRole('button', { name: 'Create QA Scorecard' });
    this.dismissActionButton = page.getByRole('button', { name: 'Dismiss' });
    this.stagedScorecardNameLabel = page.getByText('QA Scorecard', { exact: true }).last();
    this.actionCardExpandIcon = page.locator('[class*="accordion_iconContainer"]').last();

    // Deliberately never reads response/request bodies here — the stream
    // response is exactly the thing a hung/dropped attempt would never
    // finish delivering, and awaiting its body would block on the same
    // hang this is meant to diagnose. Status + timing only.
    const isStreamRequest = (url: string) => url.includes('/ai-agent/query/stream');
    page.on('response', resp => {
      if (isStreamRequest(resp.url())) {
        this.streamAttempts.push({ outcome: 'response', status: resp.status(), timestamp: new Date().toISOString() });
      }
    });
    page.on('requestfailed', req => {
      if (isStreamRequest(req.url())) {
        this.streamAttempts.push({
          outcome: 'requestfailed',
          status: req.failure()?.errorText ?? '(no error text)',
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  /** Human-readable dump of every `stream` attempt observed so far this
   *  page object's lifetime — call from a test's catch block on a
   *  generation-step failure to see whether the endpoint was ever reached,
   *  how many 401-refresh retries happened, whether a 200 ever landed, and
   *  whether a stream that did open (200) then dropped mid-flight
   *  (a `requestfailed` logged after it). Empty means the request was never
   *  even sent — a client-side issue before the network call, not the
   *  endpoint itself. */
  formatStreamDiagnostics(): string {
    if (this.streamAttempts.length === 0) {
      return 'No requests to ai-agent/query/stream were observed at all.';
    }
    const lines = this.streamAttempts.map(
      (a, i) => `  ${i + 1}. [${a.timestamp}] ${a.outcome === 'response' ? `HTTP ${a.status}` : `requestfailed: ${a.status}`}`,
    );
    const reached200 = this.streamAttempts.some(a => a.outcome === 'response' && a.status === 200);
    const droppedAfter200 = this.streamAttempts.some(
      (a, i) => a.outcome === 'response' && a.status === 200 && this.streamAttempts.slice(i + 1).some(b => b.outcome === 'requestfailed'),
    );
    return (
      `ai-agent/query/stream attempts (${this.streamAttempts.length}):\n${lines.join('\n')}\n` +
      `Reached a 200: ${reached200}. Dropped after a 200 (requestfailed logged after it): ${droppedAfter200}.`
    );
  }

  async goto(): Promise<void> {
    await super.goto('/AiAgent');
    await dismissAnnouncementModal(this.page);
    // The page keeps re-laying-out for a moment right after navigation
    // (icons/fonts loading in) — see createStagedScorecard()'s doc for the
    // same effect observed on a button click; settle briefly before the
    // next action rather than fighting Playwright's stability wait on it.
    await this.page.waitForTimeout(1_000);
  }

  async startNewConversation(): Promise<void> {
    await dismissAnnouncementModal(this.page);
    await this.startNewConversationButton.scrollIntoViewIfNeeded();
    await this.startNewConversationButton.click({ timeout: 40_000 });
  }

  async sendPrompt(prompt: string): Promise<void> {
    await dismissAnnouncementModal(this.page);
    await this.promptInput.fill(prompt);
    await this.promptInput.press('Enter');
  }

  /** Waits for the agent's "RECOMMENDED SYSTEM ACTIONS" card to render its
   *  "Create QA Scorecard" button. Generation routinely takes 10-20s. */
  async waitForRecommendedAction(timeout = 120_000): Promise<void> {
    await this.createScorecardButton.waitFor({ state: 'visible', timeout });
  }

  /** Reads the staged form's name from the action card (see
   *  `stagedScorecardNameLabel` doc for why not the chat's prose summary).
   *  Bounded rather than the default timeout: by the time this is called,
   *  waitForRecommendedAction() already confirmed the card rendered, so a
   *  mismatch here should fail fast rather than eat the rest of the test's
   *  timeout budget. */
  async getStagedScorecardName(): Promise<string> {
    const fullText = (await this.stagedScorecardNameLabel
      .locator('xpath=..')
      .textContent({ timeout: 20_000 })) ?? '';
    const name = fullText.replace(/^QA Scorecard/i, '').trim();
    if (!name) {
      throw new Error(`Could not extract the staged scorecard name from: "${fullText}"`);
    }
    return name;
  }

  /**
   * Expands the action card, then clicks "Create QA Scorecard" and waits
   * for the resulting navigation to the QA Scorecards editor.
   *
   * The card renders collapsed with the button hidden underneath its own
   * header — clicking straight for "Create QA Scorecard" without expanding
   * first hits `<div class="action-card_card__...">…intercepts pointer
   * events` and hangs. Confirmed live, twice: expand via
   * `actionCardExpandIcon` first, then the button click lands immediately.
   */
  async createStagedScorecard(timeout = 45_000): Promise<void> {
    // Re-dismissed before each click, not just once — see class doc: the
    // announcement modal has been observed popping up mid-flow, between
    // these two clicks specifically, later than its usual on-load timing.
    await dismissAnnouncementModal(this.page);
    await this.actionCardExpandIcon.click({ timeout });
    await dismissAnnouncementModal(this.page);
    await this.createScorecardButton.click({ timeout });
    await this.page.waitForURL(/\/QAScorecards/, { timeout });
  }
}
