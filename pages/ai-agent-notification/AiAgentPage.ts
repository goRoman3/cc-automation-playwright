import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * AiAgentPage — https://atmossystemsstaging.callcabinet.com/AiAgent
 * Analytics -> AI Agent. Selectors verified 2026-08-10 on SmarshCR Sales.
 *
 * Quirks:
 *  1. There is no Send button. The prompt box is a plain `input.k-input-inner`
 *     at the bottom of the chat column and the message is sent with Enter.
 *  2. "Recommended System Actions" is not a checkbox — it is a two-button
 *     switcher (`[aria-label="Toggle switch"]`) whose active side is marked by
 *     an `…_activeLeft__…` / `…_activeRight__…` class.
 *  3. An answer takes 60-80 s and streams reasoning deltas with long pauses in
 *     between, so waitForAnswer() needs a wide stability window — anything
 *     under ~20 s returns in the middle of the generation.
 *  4. Conversations are titled by the agent ("Notification Rule Setup: …"),
 *     not "Conversation from <date>". Address them by position under the
 *     "Today" heading or by their generated title, never by a date pattern.
 */
const URL = 'https://atmossystemsstaging.callcabinet.com/AiAgent';

export type RecommendedState = 'On' | 'Off' | null;

export interface WaitForAnswerOptions {
  maxMs?: number;
  stableMs?: number;
}

export class AiAgentPage extends BasePage {
  readonly toggle: Locator;
  readonly newConversationButton: Locator;
  readonly callFiltersButton: Locator;
  /** The chat input is the last k-input on the page; the first one is the
   *  conversation search box in the left rail. */
  readonly prompt: Locator;

  static get URL(): string {
    return URL;
  }

  constructor(page: Page) {
    super(page);

    this.toggle = page.locator('[aria-label="Toggle switch"]');
    this.newConversationButton = page.locator('button:has-text("Start New Conversation")');
    this.callFiltersButton = page.locator('button:has-text("Call Filters")');
    this.prompt = page.locator('input.k-input-inner').last();
  }

  async goto(): Promise<void> {
    await this.page.goto(URL, { waitUntil: 'domcontentloaded' });
    await this.waitForReady();
  }

  /**
   * The chat shell is fetched after the page shell renders, and on staging that
   * can take well over the fixed sleep it is tempting to write here. Wait for
   * the switcher and the prompt box to actually exist.
   */
  async waitForReady(timeout = 60000): Promise<void> {
    await this.page.waitForFunction(
      () =>
        !!document.querySelector('[aria-label="Toggle switch"]') &&
        document.querySelectorAll('input.k-input-inner').length > 0,
      null,
      { timeout },
    );
    await this.page.waitForTimeout(1500);
  }

  // ── recommended system actions ─────────────────────────────
  /** 'On' | 'Off' — which side of the switcher is active. */
  async recommendedState(): Promise<RecommendedState> {
    return await this.page.evaluate(() => {
      const g = document.querySelector('[aria-label="Toggle switch"]');
      if (!g) return null;
      const on = Array.from(g.querySelectorAll('button')).find((b) => b.innerText.trim() === 'On');
      return on && /active/i.test(on.className) ? 'On' : 'Off';
    });
  }

  async setRecommended(on = true): Promise<void> {
    await this.toggle.waitFor({ state: 'attached', timeout: 60000 });
    if ((await this.recommendedState()) === (on ? 'On' : 'Off')) return;
    await this.page.evaluate((want) => {
      const g = document.querySelector('[aria-label="Toggle switch"]');
      if (!g) return;
      const b = Array.from(g.querySelectorAll('button')).find(
        (x) => x.innerText.trim() === (want ? 'On' : 'Off'),
      );
      if (b) (b as HTMLElement).click();
    }, on);
    await this.page.waitForTimeout(1200);
  }

  // ── conversations ──────────────────────────────────────────
  async startNewConversation(): Promise<void> {
    await this.newConversationButton.click();
    await this.page.waitForTimeout(3000);
  }

  /** Titles in the left rail, in display order, headings excluded. */
  async conversations(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const HEADINGS =
        /^(Today|Yesterday|Previous 30 Days|January|February|March|April|May|June|July|August|September|October|November|December)$/;
      return Array.from(document.querySelectorAll('*'))
        .filter((e) => e.children.length === 0 && ((e as HTMLElement).innerText || '').trim())
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.x < 320 && r.y > 140 && r.y < 900;
        })
        .map((e) => (e as HTMLElement).innerText.trim())
        .filter((t) => !HEADINGS.test(t));
    });
  }

  /** Open a conversation by its exact generated title. */
  async openConversation(title: string): Promise<boolean> {
    const hit = await this.page.evaluate((t) => {
      const e = Array.from(document.querySelectorAll('*'))
        .filter((x) => x.children.length === 0 && ((x as HTMLElement).innerText || '').trim() === t)
        .find((x) => x.getBoundingClientRect().x < 320);
      if (!e) return false;
      (e as HTMLElement).click();
      return true;
    }, title);
    await this.page.waitForTimeout(8000);
    return hit;
  }

  /** Open the newest conversation, i.e. the first entry under "Today". */
  async openLatestConversation(): Promise<string | null> {
    const title = await this.page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('*'))
        .filter((e) => e.children.length === 0 && ((e as HTMLElement).innerText || '').trim())
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.x < 320 && r.y > 140 && r.y < 900;
        });
      const i = items.findIndex((e) => (e as HTMLElement).innerText.trim() === 'Today');
      const target = i >= 0 ? items[i + 1] : null;
      if (!target) return null;
      (target as HTMLElement).click();
      return (target as HTMLElement).innerText.trim();
    });
    await this.page.waitForTimeout(8000);
    return title;
  }

  // ── asking ─────────────────────────────────────────────────
  /** Type the prompt and send it with Enter. Does not wait for the answer. */
  async ask(text: string): Promise<void> {
    await this.prompt.click();
    await this.prompt.fill('');
    await this.prompt.pressSequentially(text, { delay: 5 });
    await this.page.waitForTimeout(400);
    await this.prompt.press('Enter');
  }

  /**
   * Wait out the streamed answer: the page text has to stop changing for
   * `stableMs`. Returns false on timeout rather than throwing, so a spec can
   * report "the agent never finished" instead of a locator error.
   */
  async waitForAnswer({ maxMs = 300000, stableMs = 25000 }: WaitForAnswerOptions = {}): Promise<boolean> {
    const t0 = Date.now();
    let last = '';
    let lastChange = Date.now();
    while (Date.now() - t0 < maxMs) {
      await this.page.waitForTimeout(2500);
      const t = await this.page.evaluate(() => document.body.innerText);
      if (t !== last) {
        last = t;
        lastChange = Date.now();
      } else if (Date.now() - lastChange > stableMs) {
        return true;
      }
    }
    return false;
  }

  async askAndWait(text: string, opts?: WaitForAnswerOptions): Promise<boolean> {
    await this.ask(text);
    return await this.waitForAnswer(opts);
  }

  /** Text of the conversation column, without the nav and the footer. */
  async answerText(): Promise<string> {
    return await this.page.evaluate(() => {
      const t = document.body.innerText;
      const i = t.indexOf('Call Filters');
      const j = t.indexOf('Your conversation history is not used');
      return t.substring(i >= 0 ? i + 12 : 0, j > 0 ? j : undefined).trim();
    });
  }

  /** True when the answer carries a staged-action block. */
  async hasRecommendedActions(): Promise<boolean> {
    return (await this.page.evaluate(() => document.body.innerText)).includes('RECOMMENDED SYSTEM ACTIONS');
  }
}
