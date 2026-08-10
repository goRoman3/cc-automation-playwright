import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * AgentActionCard — the staged "Notification Rule" card the AI Agent renders
 * under an answer, inside the "RECOMMENDED SYSTEM ACTIONS" block.
 * Verified 2026-08-10 (Feature 31979, User Story 36816).
 *
 * Card shape:
 *   Notification Rule / <name>                 action-card_cardHeaderLeft__*
 *   Summary: Triggers: 2 (critical, warning) • Filters: 1 • Channels: UI
 *   Show reasoning                              action-card_reasoningToggle__*
 *   NOTIFICATION CONFIGURATION                  action-card_notificationDetails__*
 *     TYPE / NUMBER OF CALLS / TRIGGERS / COOLDOWN / RECIPIENTS / FILTERS
 *   [Create Notification Rule] [Dismiss]        action-card_actions__*
 *
 * Quirks:
 *  1. "Show reasoning" is a <span>, not a <button> — `button:has-text()` never
 *     matches it.
 *  2. RECIPIENTS and FILTERS are omitted entirely when empty; a missing section
 *     means "nothing staged", not "rendered blank".
 *  3. The email is shown in full on the card but masked as [REDACTED_EMAIL] in
 *     the answer text above it. Assert the address on the card only.
 *  4. After the agent modifies a staged proposal the same card is reused and a
 *     version marker ("v2") appears on it — a second card is not added.
 *  5. The card wrapper (`action-card_card__*`) and the accordion header above it
 *     swallow pointer events, so a real Playwright click on anything inside the
 *     card never becomes actionable. Every control here is DOM-dispatched.
 */
const ROOT = '[class*="action-card_cardBodyInner"]';

export interface TriggerConfig {
  level: string;
  condition: string;
  scope: { label: string; value: string } | null;
  threshold: string | null;
  raw: string[];
}

export interface FilterConfig {
  label: string | null;
  value: string;
}

export interface NotificationConfig {
  type: string | null;
  numberOfCalls: string | null;
  cooldown: string | null;
  recipients: string[];
  filters: FilterConfig[];
  triggers: TriggerConfig[];
  sections: Record<string, string[]>;
}

export interface SummaryParts {
  triggers: number | null;
  levels: string[];
  filters: number | null;
  channels: string[];
}

export class AgentActionCard extends BasePage {
  readonly index: number;
  readonly root: Locator;
  readonly createButton: Locator;
  readonly dismissButton: Locator;
  readonly reasoningToggle: Locator;

  static rootSelector(): string {
    return ROOT;
  }

  constructor(page: Page, index = 0) {
    super(page);
    this.index = index;
    this.root = page.locator(ROOT).nth(index);
    this.createButton = this.root.locator('button:has-text("Create Notification Rule")');
    this.dismissButton = this.root.locator('button:has-text("Dismiss")');
    this.reasoningToggle = this.root.locator('[class*="reasoningToggle"]');
  }

  /**
   * Click something inside this card. The wrapper intercepts pointer events, so
   * this dispatches on the node itself instead of going through the mouse.
   */
  private async _click(text: string | null): Promise<void> {
    const hit = await this.page.evaluate(
      ([sel, i, t]) => {
        const card = document.querySelectorAll(sel)[Number(i)];
        if (!card) return false;
        const rx = new RegExp(`^${t}$`, 'i');
        const el = Array.from(card.querySelectorAll('button, [class*="reasoningToggle"]')).find((x) =>
          rx.test(((x as HTMLElement).innerText || '').trim()),
        );
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      },
      [ROOT, String(this.index), String(text)] as [string, string, string],
    );
    if (!hit) throw new Error(`AgentActionCard: no control matching "${text}" on the card`);
  }

  /** How many staged cards the conversation currently shows. */
  static async count(page: Page): Promise<number> {
    return await page.locator(ROOT).count();
  }

  async isVisible(): Promise<boolean> {
    return (await this.root.count()) > 0;
  }

  async text(): Promise<string | null> {
    return (await this.root.count()) ? await this.root.innerText() : null;
  }

  /** "Notification Rule" / "QA Scorecard" / "Topic" — the card's action type. */
  async kind(): Promise<string | null> {
    return await this.page.evaluate((i) => {
      const h = document.querySelectorAll('[class*="action-card_cardHeaderLeft"]')[i];
      return h ? ((h as HTMLElement).innerText || '').trim().split('\n')[0].trim() : null;
    }, this.index);
  }

  /** The staged rule name, shown under the card kind. */
  async name(): Promise<string | null> {
    return await this.page.evaluate((i) => {
      const h = document.querySelectorAll('[class*="action-card_cardHeaderLeft"]')[i];
      const lines = h
        ? ((h as HTMLElement).innerText || '')
            .trim()
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      return lines[1] || null;
    }, this.index);
  }

  /** "Triggers: 2 (critical, warning) • Filters: 1 • Channels: UI" */
  async summary(): Promise<string | null> {
    const t = await this.text();
    const m = t && t.match(/^Summary:\s*(.+)$/m);
    return m ? m[1].trim() : null;
  }

  /** { triggers: 2, levels: ['critical','warning'], filters: 1, channels: ['UI'] } */
  async summaryParts(): Promise<SummaryParts | null> {
    const s = await this.summary();
    if (!s) return null;
    const trig = s.match(/Triggers:\s*(\d+)\s*(?:\(([^)]*)\))?/);
    const filt = s.match(/Filters:\s*(\d+)/);
    const chan = s.match(/Channels:\s*([^•]+)/);
    return {
      triggers: trig ? Number(trig[1]) : null,
      levels: trig && trig[2] ? trig[2].split(',').map((x) => x.trim()) : [],
      filters: filt ? Number(filt[1]) : null,
      channels: chan
        ? chan[1]
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
    };
  }

  /** "v2" once the proposal has been modified, null on the first version. */
  async version(): Promise<string | null> {
    const t = await this.text();
    const m = t && t.match(/^v(\d+)$/m);
    return m ? 'v' + m[1] : null;
  }

  // ── reasoning ──────────────────────────────────────────────
  async reasoningToggleLabel(): Promise<string | null> {
    return (await this.reasoningToggle.count()) ? (await this.reasoningToggle.innerText()).trim() : null;
  }

  async toggleReasoning(): Promise<void> {
    await this._click(await this.reasoningToggleLabel());
    await this.page.waitForTimeout(1200);
  }

  /** The reasoning paragraph, or null while it is collapsed. */
  async reasoning(): Promise<string | null> {
    const t = await this.text();
    if (!t || !/Hide reasoning/.test(t)) return null;
    const m = t.match(/Hide reasoning\n([\s\S]*?)\nNOTIFICATION CONFIGURATION/);
    return m ? m[1].trim() : null;
  }

  // ── notification configuration ─────────────────────────────
  /**
   * Parse the NOTIFICATION CONFIGURATION block into
   *   { type, numberOfCalls, cooldown, recipients: [], filters: [],
   *     triggers: [{ level, condition, scope, threshold, raw }] }
   * Sections absent from the card come back as null / [].
   */
  async config(): Promise<NotificationConfig | null> {
    const t = await this.text();
    if (!t) return null;
    const body = t.split('NOTIFICATION CONFIGURATION')[1];
    if (!body) return null;

    const lines = body
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s && !/^(Create Notification Rule|Dismiss|v\d+)$/.test(s));

    // uppercase labels delimit the sections
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    for (const l of lines) {
      if (/^[A-Z][A-Z ]*:$/.test(l)) {
        current = l.slice(0, -1).trim();
        sections[current] = [];
      } else if (current) {
        sections[current].push(l);
      }
    }

    const triggers: TriggerConfig[] = [];
    for (const l of sections.TRIGGERS || []) {
      const head = l.match(/^(info|warning|critical)\s*:\s*(.+)$/i);
      if (head) {
        triggers.push({
          level: head[1].toLowerCase(),
          condition: head[2].trim(),
          scope: null,
          threshold: null,
          raw: [l],
        });
        continue;
      }
      const last = triggers[triggers.length - 1];
      if (!last) continue;
      last.raw.push(l);
      const th = l.match(/^Trigger Threshold:\s*(.+)$/i);
      if (th) {
        last.threshold = th[1].trim();
        continue;
      }
      const sc = l.match(/^([A-Za-z ]+):\s*(.+)$/);
      if (sc) last.scope = { label: sc[1].trim(), value: sc[2].trim() };
    }

    const one = (k: string): string | null => (sections[k] && sections[k][0]) || null;
    return {
      type: one('TYPE'),
      numberOfCalls: one('NUMBER OF CALLS'),
      cooldown: one('COOLDOWN'),
      recipients: sections.RECIPIENTS || [],
      filters: (sections.FILTERS || []).map((l) => {
        const m = l.match(/^([A-Za-z ]+):\s*(.+)$/);
        return m ? { label: m[1].trim(), value: m[2].trim() } : { label: null, value: l };
      }),
      triggers,
      sections,
    };
  }

  // ── actions ────────────────────────────────────────────────
  /** Opens the prefilled Notifications wizard on /Alerting?tab=management. */
  async createNotificationRule(): Promise<void> {
    await this._click('Create Notification Rule');
    await this.page.waitForFunction(() => /Create New Notification/.test(document.body.innerText), null, {
      timeout: 45000,
    });
    await this.page.waitForTimeout(2000);
  }

  async dismiss(): Promise<void> {
    await this._click('Dismiss');
    await this.page.waitForTimeout(3000);
  }
}
