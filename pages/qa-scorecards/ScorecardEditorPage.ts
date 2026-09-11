import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { dismissAnnouncementModal } from '../shared/dismissAnnouncementModal';

/**
 * Page object for the QA Scorecard flow-chart editor (`/QAScorecards`,
 * question-node graph view) — reached either via "Create New Evaluation
 * Form" or via the AI Agent's "Create QA Scorecard" action
 * (`AiAgentPage.createStagedScorecard()`), which lands here with the
 * AI-generated structure already loaded but unsaved.
 *
 * Verified live on staging (2026-08-18), company SmarshCR Sales.
 *
 * Saving is a two-step flow:
 *   1. "Save and Exit" opens a dialog with Form Name / Archive / Passing
 *      Percentage / Description. Form Name and Description arrive
 *      pre-filled from the AI-generated content; Passing Percentage is
 *      empty and is NOT required (confirmed by a successful save with it
 *      left blank).
 *   2. "Save" in that dialog commits the form and returns to the QA
 *      Scorecards listing.
 */
/** One observed attempt at `api/qc/quality/SaveNewForm` — see
 *  {@link ScorecardEditorPage.saveAttempts}. */
export interface SaveAttempt {
  outcome: 'response' | 'requestfailed';
  /** HTTP status, or the Playwright failure text (e.g. "net::ERR_...") for a
   *  request that failed before any response arrived. */
  status: number | string;
  statusText?: string;
  timestamp: string;
  /** The request body actually sent (JSON.stringify'd form payload) — sync,
   *  safe to read immediately, no risk of blocking on a hung response. */
  requestBody?: string | null;
  /** A few headers likely to matter for diagnosing an error response —
   *  content-type/length plus any request-correlation header the backend
   *  sent back (Azure/CloudFront-style `x-...-ref`, `x-request-id`, etc.). */
  responseHeaders?: Record<string, string>;
  /** Best-effort response body text — read with a short race timeout so a
   *  body that never finishes streaming can't block this listener forever;
   *  `'(body read timed out)'` / `'(body read failed: ...)'` on failure. */
  responseBodyPreview?: string;
  /** Resource timing breakdown (ms, relative to request start) from
   *  Playwright's `request.timing()` — where the time actually went
   *  (DNS/connect/TLS/waiting-for-server/download), not just a bare status. */
  timing?: Record<string, number>;
}

export class ScorecardEditorPage extends BasePage {
  readonly saveAndExitButton: Locator;
  readonly formNameInput: Locator;
  readonly passingPercentageInput: Locator;
  readonly descriptionInput: Locator;
  readonly saveDialogSaveButton: Locator;
  readonly saveDialogCancelButton: Locator;
  readonly previewButton: Locator;
  /** Each question's flow-chart node. Its accessible name is the full
   *  question text; a disabled textbox inside holds just the section name. */
  readonly questionNodes: Locator;
  /** React Flow's "fit view" control — zooms/pans so every node is within
   *  the viewport. Nodes outside it have been observed not fully rendered
   *  right after navigating in, so `getSectionsAndQuestions()` clicks this
   *  first rather than trusting whatever the canvas happened to load at. */
  readonly fitViewButton: Locator;
  /**
   * Every observed attempt at `api/qc/quality/SaveNewForm` since this page
   * object was constructed — populated live via `page.on('response')` /
   * `page.on('requestfailed')`, capturing **every** status, not just the
   * `.ok()` ones `saveAndExit()`'s own success check waits for. That
   * distinction matters: `saveAndExit()`'s `waitForResponse` predicate only
   * resolves on a 2xx — if the server actually answers with an error status
   * (4xx/5xx), that predicate never matches and the call still times out at
   * 30s looking exactly like a hang, silently swallowing whatever real
   * status/error the server sent. This array is what tells the two apart
   * after a save-timeout failure — see {@link formatSaveDiagnostics}.
   */
  readonly saveAttempts: SaveAttempt[] = [];

  constructor(page: Page) {
    super(page);
    this.saveAndExitButton = page.getByRole('button', { name: 'Save and Exit' });
    this.formNameInput = page.getByRole('textbox', { name: 'Enter Name' });
    this.passingPercentageInput = page.getByRole('textbox', { name: 'Passing Percentage' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Enter Description' });
    this.saveDialogSaveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveDialogCancelButton = page.getByRole('button', { name: 'Cancel' });
    this.previewButton = page.getByRole('button', { name: 'Preview' });
    this.questionNodes = page.getByRole('button', { name: /^Question / });
    this.fitViewButton = page.getByRole('button', { name: 'fit view' });

    // Response body is read here, but raced against a short timeout — a
    // response that never finishes streaming (the exact hang this exists to
    // diagnose) must not be able to block this listener, or the listener
    // itself becomes another way to hang. Everything else (headers, timing,
    // request body) is synchronous/already-available and safe to read
    // immediately.
    const isSaveRequest = (url: string) => url.includes('/api/qc/quality/SaveNewForm');
    const RELEVANT_HEADERS = ['content-type', 'content-length', 'x-azure-ref', 'x-request-id', 'x-correlation-id'];

    page.on('response', async resp => {
      if (!isSaveRequest(resp.url())) return;

      const entry: SaveAttempt = {
        outcome: 'response',
        status: resp.status(),
        statusText: resp.statusText(),
        timestamp: new Date().toISOString(),
        requestBody: resp.request().postData(),
      };

      try {
        const allHeaders = await resp.allHeaders();
        entry.responseHeaders = Object.fromEntries(
          RELEVANT_HEADERS.filter(h => h in allHeaders).map(h => [h, allHeaders[h]]),
        );
      } catch {
        /* headers unavailable — leave undefined */
      }

      try {
        entry.timing = { ...resp.request().timing() };
      } catch {
        /* timing unavailable — leave undefined */
      }

      entry.responseBodyPreview = await Promise.race([
        resp.text().then(t => (t.length > 2000 ? `${t.slice(0, 2000)}… (truncated)` : t)),
        new Promise<string>(resolve => setTimeout(() => resolve('(body read timed out after 3s)'), 3_000)),
      ]).catch(e => `(body read failed: ${e instanceof Error ? e.message : String(e)})`);

      this.saveAttempts.push(entry);
    });
    page.on('requestfailed', req => {
      if (isSaveRequest(req.url())) {
        this.saveAttempts.push({
          outcome: 'requestfailed',
          status: req.failure()?.errorText ?? '(no error text)',
          timestamp: new Date().toISOString(),
          requestBody: req.postData(),
          timing: (() => {
            try {
              return { ...req.timing() };
            } catch {
              return undefined;
            }
          })(),
        });
      }
    });
  }

  /** Human-readable dump of every `SaveNewForm` attempt observed so far —
   *  call from a test's catch block on a save-step failure. Empty means the
   *  click never even produced a request — a client-side issue (button not
   *  actually wired up, click missed, etc.), not the endpoint. A non-empty
   *  list with no 2xx means the server did answer, just with an error the
   *  plain `saveAndExit()` timeout alone would have hidden — status, body,
   *  and timing below show exactly what. */
  formatSaveDiagnostics(): string {
    const clickLog = this.saveClickLog.length
      ? `Save-button click timeline:\n${this.saveClickLog.map(l => `  ${l}`).join('\n')}\n`
      : '';

    if (this.saveAttempts.length === 0) {
      return `${clickLog}No requests to api/qc/quality/SaveNewForm were observed at all (across every click attempt above).`;
    }
    const lines = this.saveAttempts.map((a, i) => {
      const head = `  ${i + 1}. [${a.timestamp}] ${a.outcome === 'response' ? `HTTP ${a.status} ${a.statusText ?? ''}`.trim() : `requestfailed: ${a.status}`}`;
      const details: string[] = [];
      if (a.requestBody) details.push(`     request body: ${a.requestBody.length > 500 ? `${a.requestBody.slice(0, 500)}… (truncated)` : a.requestBody}`);
      if (a.responseHeaders && Object.keys(a.responseHeaders).length) details.push(`     response headers: ${JSON.stringify(a.responseHeaders)}`);
      if (a.responseBodyPreview) details.push(`     response body: ${a.responseBodyPreview}`);
      if (a.timing) details.push(`     timing (ms): ${JSON.stringify(a.timing)}`);
      return [head, ...details].join('\n');
    });
    const reached2xx = this.saveAttempts.some(a => a.outcome === 'response' && typeof a.status === 'number' && a.status >= 200 && a.status < 300);
    return `${clickLog}SaveNewForm attempts (${this.saveAttempts.length}):\n${lines.join('\n')}\nReached a 2xx: ${reached2xx}.`;
  }

  /**
   * Reads every question node's text and section name directly from the
   * editor — each node has 3 stacked textboxes: question text, an empty
   * spacer, then the section name. Preview (the step-by-step Yes/No quiz
   * view) shows the same data one question at a time, but paging through it
   * to verify content needs one "Move Right" click per question; reading the
   * editor nodes gets the same information from a single snapshot.
   *
   * Clicks "fit view" and waits for the first node before reading: right
   * after navigating in from the AI Agent, the canvas can still be laying
   * out (confirmed live — an immediate read found zero nodes even though
   * the same canvas was fully visible moments later).
   */
  async getSectionsAndQuestions(): Promise<{ section: string; question: string }[]> {
    // The announcement modal (see dismissAnnouncementModal doc) has been
    // observed reappearing here too, its overlay blocking the canvas.
    await dismissAnnouncementModal(this.page);
    await this.fitViewButton.click().catch(() => {});
    await this.questionNodes.first().waitFor({ state: 'visible', timeout: 15_000 });

    const count = await this.questionNodes.count();
    const rows: { section: string; question: string }[] = [];

    for (let i = 0; i < count; i++) {
      const textboxes = this.questionNodes.nth(i).getByRole('textbox');
      rows.push({
        question: await textboxes.nth(0).inputValue(),
        section: await textboxes.nth(2).inputValue(),
      });
    }

    return rows;
  }

  /**
   * Asserts the generated scorecard actually covers every requested focus
   * area — a scorecard that saves but has the wrong content is still a
   * failure for this suite's purpose. Matches on substring OR shared
   * significant word (>3 letters) rather than requiring an exact phrase:
   * confirmed live that the agent paraphrases requested areas into its own
   * section names (asked for "resolution time", got a section named
   * "Resolution Efficiency" — same concept, different wording), so an exact
   * substring match is stricter than what "covers this focus area"
   * actually means here. Hyphens are normalized to spaces before comparing
   * for the same reason — asked for "next-steps confirmation", got a
   * section literally named "Next Steps": same concept, but the hyphen vs.
   * space difference alone made every substring/word check miss it.
   */
  async assertCoversFocusAreas(focusAreas: readonly string[]): Promise<void> {
    const normalize = (s: string) => s.toLowerCase().replace(/-/g, ' ').trim();

    const rows = await this.getSectionsAndQuestions();
    const sections = [...new Set(rows.map(r => normalize(r.section)))];

    for (const area of focusAreas) {
      const needle = normalize(area);
      const areaWords = needle.split(/\s+/).filter(w => w.length > 3);
      const covered = sections.some(
        s => s.includes(needle) || needle.includes(s) || areaWords.some(w => s.includes(w)),
      );
      if (!covered) {
        throw new Error(
          `Generated scorecard has no section covering "${area}". ` +
            `Sections present: ${sections.join(', ') || '(none)'}`,
        );
      }
    }
  }

  /** Appends a sortable, collision-free suffix, e.g. "Customer Service Core
   *  QA (2026-08-18T20-40-05-123Z)" — repeated runs against the same
   *  long-lived company must not collide on name. */
  static uniqueName(baseName: string): string {
    return `${baseName} (${new Date().toISOString().replace(/[:.]/g, '-')})`;
  }

  /**
   * Opens the Save dialog, rewrites Form Name to a unique value (based on
   * whatever name arrived pre-filled, e.g. from the AI Agent), and confirms.
   * Returns the exact name saved, for the caller to verify/clean up by.
   *
   * Waits on the `SaveNewForm` network response, not UI timing (dialog
   * closing / URL change) — those were both observed to be unreliable
   * signals of the actual save outcome. Concretely: a run that timed out
   * waiting for the Save button to become hidden (20s) turned out to have
   * saved successfully anyway — the form showed up in the listing under an
   * account this suite doesn't otherwise use, confirmed by its timestamped
   * unique name matching that exact run. The backend had returned 201
   * `Created` for `SaveNewForm`; only the UI's own transition back to the
   * listing was slow that time. So the network response is the real
   * pass/fail signal here, and the follow-up `waitForURL` is best-effort —
   * informational, not something a slow UI redraw should be able to fail.
   */
  /**
   * Per the user's request (2026-08-26): a single click's 30s-timeout was
   * conflating two different failures — "the click never even reached the
   * network" (seen every time so far: zero SaveNewForm requests observed)
   * vs. "the network call itself hangs". Clicking again after a shorter
   * per-attempt wait tells them apart: if a *later* click succeeds, the
   * first click's failure was transient/client-side, not a backend hang —
   * see {@link saveClickLog} for the click-by-click timeline this produces.
   */
  private static readonly SAVE_CLICK_MAX_ATTEMPTS = 3;
  private static readonly SAVE_CLICK_PER_ATTEMPT_TIMEOUT_MS = 10_000;

  /** One line per Save-button click attempt in {@link saveAndExit} — see
   *  {@link formatSaveDiagnostics}. Separate from `saveAttempts` (which
   *  only fires on actual network activity): this logs every click even
   *  when it produces zero network activity, which is the finding so far. */
  readonly saveClickLog: string[] = [];

  async saveAndExit(): Promise<string> {
    await dismissAnnouncementModal(this.page);
    await this.saveAndExitButton.click();
    await this.formNameInput.waitFor({ state: 'visible' });

    const prefilledName = await this.formNameInput.inputValue();
    const uniqueName = ScorecardEditorPage.uniqueName(prefilledName);
    await this.formNameInput.fill(uniqueName);

    // A closed dialog is success ONLY if a 2xx SaveNewForm response was
    // actually observed — confirmed live (2026-09-01, prompt #406) that the
    // dialog can also close after a 4xx (there: "Phrases are required when
    // AI Assisted is disabled"), which previously got misread as success
    // here and only surfaced two steps later as a confusing assertFormExists
    // timeout. Checking saveAttempts (populated by the constructor's
    // page.on('response') listener, so it already has every status, not
    // just 2xx) tells a genuinely-closed-after-success dialog apart from a
    // closed-after-error one.
    const reached2xx = () =>
      this.saveAttempts.some(a => a.outcome === 'response' && typeof a.status === 'number' && a.status >= 200 && a.status < 300);

    let succeeded = false;
    for (
      let attempt = 1;
      attempt <= ScorecardEditorPage.SAVE_CLICK_MAX_ATTEMPTS && !succeeded;
      attempt++
    ) {
      // Re-check right before every click — the modal has been observed
      // popping up mid-flow, later than its usual on-load timing,
      // specifically because automation moves through steps faster than a
      // human would, so a dismiss earlier in the method isn't enough on its
      // own; every click in this file re-checks immediately before it fires.
      await dismissAnnouncementModal(this.page);

      // A prior attempt's response may have arrived just after that
      // attempt's own short timeout lapsed (not a true failure, just a
      // slow answer) — if the dialog's already gone, check what actually
      // happened rather than assuming success; don't click a button that
      // isn't there anymore either way.
      if (!(await this.saveDialogSaveButton.isVisible().catch(() => false))) {
        if (reached2xx()) {
          this.saveClickLog.push(`[${new Date().toISOString()}] attempt ${attempt}: Save button no longer visible and a 2xx SaveNewForm response was observed — treating as success`);
          succeeded = true;
        } else {
          this.saveClickLog.push(`[${new Date().toISOString()}] attempt ${attempt}: Save button no longer visible but NO 2xx SaveNewForm response was ever observed — dialog closed on a failed save, not treating as success (see saveAttempts / formatSaveDiagnostics for the actual response)`);
        }
        break;
      }

      // Per the user's hypothesis (2026-08-26): a debounce/in-flight lock
      // that fires correctly on the first click but gets stuck disabled
      // forever (rather than re-enabling once whatever it's waiting on
      // fails) would look exactly like this — FormExists firing once, then
      // dead silence on every retry. Capturing the button's own disabled/
      // aria-busy state right before each click tells the two apart: stuck
      // disabled means the debounce is real and it's simply never released;
      // still fully enabled but still ignored means something else (a
      // detached listener, a broken async handler that swallows the click).
      const buttonState = await this.saveDialogSaveButton.evaluate(el => ({
        disabled: (el as HTMLButtonElement).disabled,
        ariaDisabled: el.getAttribute('aria-disabled'),
        ariaBusy: el.getAttribute('aria-busy'),
        className: el.className,
      })).catch(() => null);
      this.saveClickLog.push(`[${new Date().toISOString()}] attempt ${attempt}: button state before click: ${JSON.stringify(buttonState)}`);

      const saved = this.page
        .waitForResponse(
          resp => resp.url().includes('/api/qc/quality/SaveNewForm') && resp.ok(),
          { timeout: ScorecardEditorPage.SAVE_CLICK_PER_ATTEMPT_TIMEOUT_MS },
        )
        .then(() => true)
        .catch(() => false);

      // Bounded, and failure caught rather than left to propagate: if the
      // button state above shows disabled/busy, Playwright's own click()
      // waits for it to become actionable before clicking at all — with no
      // timeout that wait inherits the test's full default budget and would
      // abort this whole retry loop on attempt 1 instead of logging a clean
      // "click itself never landed" and trying again.
      this.saveClickLog.push(`[${new Date().toISOString()}] attempt ${attempt}: clicking Save`);
      const clickError = await this.saveDialogSaveButton
        .click({ timeout: ScorecardEditorPage.SAVE_CLICK_PER_ATTEMPT_TIMEOUT_MS })
        .then(() => null)
        .catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
      if (clickError) {
        this.saveClickLog.push(`[${new Date().toISOString()}] attempt ${attempt}: click itself failed/never landed: ${clickError}`);
      }
      succeeded = await saved;
      this.saveClickLog.push(
        `[${new Date().toISOString()}] attempt ${attempt}: ${succeeded ? 'got a 2xx SaveNewForm response' : `no 2xx within ${ScorecardEditorPage.SAVE_CLICK_PER_ATTEMPT_TIMEOUT_MS / 1000}s`}`,
      );

      // Per the user's request (2026-08-26): directly check, right after a
      // failed attempt, whether some *other* overlay silently swallowed the
      // click — the announcement modal specifically (its own dismiss calls
      // are best-effort and can miss a re-render), or any extra
      // `[role="dialog"]` stacked on top of this one (the Save dialog
      // itself is always one, so more than 1 open is the actual signal).
      if (!succeeded) {
        const announcementModalOpen = await this.page
          .getByRole('button', { name: 'Close modal' })
          .isVisible()
          .catch(() => false);
        const openDialogCount = await this.page.locator('[role="dialog"]:visible').count().catch(() => -1);
        this.saveClickLog.push(
          `[${new Date().toISOString()}] attempt ${attempt}: announcement modal open: ${announcementModalOpen}; visible [role="dialog"] elements: ${openDialogCount} (1 = just the Save dialog itself, as expected)`,
        );
      }
    }

    if (!succeeded) {
      // A definite non-2xx response (any 4xx/5xx already observed) means
      // the server has already answered — there's nothing left in flight to
      // wait out, so skip straight to throwing with that answer's detail
      // rather than burning another 60s. The diagnostic wait is only useful
      // for the true "nothing happened yet" case this was originally built
      // for (2026-08-26): two "silent stall" repros so far (FormExists
      // succeeds once, then dead silence, retries don't even re-fire
      // FormExists) looked permanently stuck, not just slow — but that was
      // only confirmed for the ~30s the loop above already spent. One more,
      // longer wait (not counted as a pass — the budget above already
      // reflects what's acceptable) tells "actually never-arriving" apart
      // from "arrives eventually, just absurdly late" before throwing.
      const definiteFailureAttempt = [...this.saveAttempts].reverse().find(
        a => a.outcome === 'response' && typeof a.status === 'number' && a.status >= 400,
      );
      let lateArrival = false;
      if (!definiteFailureAttempt) {
        lateArrival = await this.page
          .waitForResponse(resp => resp.url().includes('/api/qc/quality/SaveNewForm') && resp.ok(), { timeout: 60_000 })
          .then(() => true)
          .catch(() => false);
        this.saveClickLog.push(
          `[${new Date().toISOString()}] post-retry diagnostic wait (60s, not clicking again): ${lateArrival ? 'SaveNewForm DID eventually arrive — this is extreme slowness, not a permanent stall' : 'still nothing — looks like a genuine permanent stall, not just slow'}`,
        );
      } else {
        this.saveClickLog.push(
          `[${new Date().toISOString()}] skipping the 60s late-arrival wait — SaveNewForm already answered with HTTP ${definiteFailureAttempt.status}, nothing left in flight`,
        );
      }

      const totalBudget = (ScorecardEditorPage.SAVE_CLICK_MAX_ATTEMPTS * ScorecardEditorPage.SAVE_CLICK_PER_ATTEMPT_TIMEOUT_MS) / 1000;
      const errorDetail = definiteFailureAttempt
        ? ` SaveNewForm answered HTTP ${definiteFailureAttempt.status}${definiteFailureAttempt.responseBodyPreview ? `: ${definiteFailureAttempt.responseBodyPreview}` : ''} — this is a save rejection, not a hang.`
        : this.saveAttempts.length === 0
          ? ' No SaveNewForm request was ever observed — the click may not be reaching the network at all.'
          : '';
      throw new Error(
        `SaveNewForm never returned a 2xx after ${ScorecardEditorPage.SAVE_CLICK_MAX_ATTEMPTS} Save-button click attempts (${totalBudget}s total budget).${errorDetail} See saveClickLog / formatSaveDiagnostics for the per-attempt timeline.`,
      );
    }

    await this.page.waitForURL(/\/QAScorecards$/, { timeout: 30_000 }).catch(() => {});

    return uniqueName;
  }
}
