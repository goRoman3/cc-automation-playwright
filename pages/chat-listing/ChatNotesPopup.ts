import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

const ROOT_SELECTOR = '[class*="notesPopup"], [class*="dynamic-popup_popup"]';

export interface ChatNote {
  author: string;
  posted: string;
  text: string;
  /** True while the note is still inside its 15-minute edit window. */
  editable: boolean;
  minutesLeft: number | null;
}

/**
 * ChatNotesPopup — the Notes popup of the Chat Listing page (see
 * specs/chat-listing-map.md §9). The same component serves two independent
 * scopes:
 *   openForRow(i)     — "Open chat note" icon of a grid row      -> chat note
 *   openForMessage(i)  — Notes icon of a message inside the opened
 *                        chat; only appears on hover                -> message note
 *
 * Facts that shape this API (verified 2026-08-05, super admin, `SmarshCR Sales`):
 *  - save() / add() close the popup — every assertion has to reopen it to see
 *    the refreshed list;
 *  - Edit/Delete exist only for 15 minutes after a note was added;
 *  - delete is immediate, with no confirmation dialog;
 *  - the note counter badge on a message icon does NOT refresh after a write —
 *    only reopening the chat does.
 */
export class ChatNotesPopup extends BasePage {
  readonly root: Locator;
  readonly closeButton: Locator;
  readonly textarea: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator(ROOT_SELECTOR).first();
    this.closeButton = page.locator('[class*="dynamic-popup_closeBtn"]');
    // Chained off `root`, NOT string-concatenated as `${ROOT_SELECTOR} textarea`
    // (the bug this replaced, ported verbatim from the original recon script):
    // ROOT_SELECTOR is a comma-separated selector list, and CSS parses a comma
    // with lower precedence than the descendant combinator, so that string
    // meant "any element matching `[class*="notesPopup"]`, OR a textarea/button
    // inside `[class*="dynamic-popup_popup"]`" — not "a textarea inside either".
    // `.first()` of that resolved to the popup's own wrapper div, not the
    // actual textarea, so type()/saveButton.click() silently acted on the
    // wrong element and no note was ever really saved (caught live 2026-09-07
    // — see local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/
    // notes-textarea-check.json).
    this.textarea = this.root.locator('textarea').first();
    this.saveButton = this.root.locator('button:has-text("Save")').first();
    this.cancelButton = this.root.locator('button:has-text("Cancel")').first();
  }

  // ── opening ────────────────────────────────────────────────

  /** Opens the chat-level note popup for grid row `i`. */
  async openForRow(i = 0): Promise<void> {
    await this.page.locator('button[aria-label="Open chat note"]').nth(i).click();
    await this.page.waitForTimeout(3000);
  }

  /**
   * Hovers message `i` of the already-opened chat, then clicks its Notes icon.
   *
   * `.first()` on the note-icon locator and waiting for the popup itself to
   * render — rather than a blind `waitForTimeout` — were both added after a
   * live failure 2026-09-07: the note icon and its hover-reveal both worked
   * (confirmed via scripts/diagnostics/message-note-open-check.ts — a
   * correctly scoped locator click did open the popup, with a real
   * `GET .../notes?chatId=...` request behind it), but a fixed 3s wait
   * afterwards was not always enough for the popup to actually mount before
   * the next call read `root`, which then had nothing to wait on except the
   * whole test's outer timeout — turning a fast, diagnosable "the popup
   * never opened" into a multi-minute stall. Waiting on the popup directly
   * fails fast with a clear message if it genuinely doesn't appear.
   *
   * The popup shell can become visible before the notes list itself has
   * loaded — confirmed 2026-09-07 via scripts/diagnostics/message-note-
   * reopen-check.ts: root.waitFor() alone returned while the popup still
   * showed an empty "Add New Note" state with zero listed notes, moments
   * before the list's own GET request resolved. Racing that specific
   * request alongside the click (best-effort — this only tightens timing,
   * so a URL-shape mismatch degrades to the old behaviour rather than
   * hanging) closes that gap without a blind extra delay.
   */
  async openForMessage(i = 0): Promise<void> {
    const message = this.page.locator('[aria-label^="Message:"]').nth(i);
    await message.hover();
    const button = message.locator('[aria-label^="Add note to message"]').first();
    await button.waitFor({ state: 'visible' });

    const notesLoaded = this.page
      .waitForResponse((res) => /\/notes(\?|$)/.test(res.url()) && res.request().method() === 'GET', { timeout: 15_000 })
      .catch(() => null);

    await button.click();
    await this.root.waitFor({ state: 'visible', timeout: 15_000 });
    await notesLoaded;
  }

  async isOpen(): Promise<boolean> {
    return (await this.page.locator(ROOT_SELECTOR).count()) > 0;
  }

  async close(): Promise<void> {
    if ((await this.closeButton.count()) > 0) {
      await this.closeButton.first().click();
    }
    await this.page.waitForTimeout(1200);
  }

  // ── reading ────────────────────────────────────────────────

  async text(): Promise<string> {
    return (await this.root.textContent()) ?? '';
  }

  /** One entry per saved note, newest first. */
  async notes(): Promise<ChatNote[]> {
    return await this.page.evaluate((sel) => {
      const popup = document.querySelector(sel);
      if (!popup) return [];
      return Array.from(popup.querySelectorAll('[class*="postedInfoContainer"]')).map((block) => {
        const el = block as HTMLElement;
        const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
        const update =
          el.querySelector('[class*="updateContainer"]') ||
          el.parentElement?.querySelector('[class*="updateContainer"]');
        const updateText = update ? (update as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : '';
        const match = updateText.match(/(\d+)\s+minutes?\s+left/);
        return {
          author: lines[0] || '',
          posted: lines[1] || '',
          text: lines.slice(2).filter((l) => !/^Edit\|?Delete/.test(l) && !/minutes? left/.test(l)).join('\n'),
          editable: !!(update && /Edit/.test(updateText)),
          minutesLeft: match ? Number(match[1]) : null,
        };
      });
    }, ROOT_SELECTOR);
  }

  async isEditable(i = 0): Promise<boolean> {
    return (await this.notes())[i]?.editable === true;
  }

  // ── writing ────────────────────────────────────────────────

  /** Label above the textarea: "Add New Note", or "Edit Note" while editing. */
  async inputLabel(): Promise<'Add New Note' | 'Edit Note'> {
    return /Edit Note/.test(await this.text()) ? 'Edit Note' : 'Add New Note';
  }

  /**
   * `pressSequentially()`, not the deprecated `Locator.type()` it replaced:
   * confirmed live 2026-09-08 (scripts/diagnostics/message-note-type-
   * method-check.ts) that `.type()` closed this popup outright — visible
   * right before the call, gone immediately after it returned, with no
   * thrown error and nothing persisted. The identical click + Ctrl+A +
   * character-by-character sequence via `pressSequentially()` left the
   * popup open and the typed value intact for 12+ seconds across repeated
   * trials (scripts/diagnostics/message-note-typing-check.ts, 3/3). Same
   * keystrokes, different Playwright API — `.type()` was the only variable.
   */
  async type(text: string): Promise<void> {
    await this.textarea.click();
    await this.page.keyboard.press('Control+a');
    await this.textarea.pressSequentially(text, { delay: 12 });
  }

  /** Types and saves a new note. The popup closes as a result — reopen to see it. */
  async add(text: string): Promise<void> {
    await this.type(text);
    await this.saveButton.click();
    await this.page.waitForTimeout(4000);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
    await this.page.waitForTimeout(4000);
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.page.waitForTimeout(1500);
  }

  /** Swaps the label to "Edit Note" and prefills the textarea for note `i`. */
  async edit(i = 0): Promise<void> {
    await this.page.locator('[class*="updateContainer_edit"]').nth(i).click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * No confirmation dialog — the note is gone immediately and the popup
   * stays open.
   *
   * `i` is a position in the CURRENTLY RENDERED (newest-first) list, not an
   * identity. This is destructive and irreversible for whatever note happens
   * to sit at that position right now — callers must call notes() first and
   * resolve `i` from the note's own text (or another test's earlier write
   * could occupy position 0 first). Never call delete(0) on the assumption
   * that "the note I just added must be newest" without having just
   * confirmed that via notes() — see chat-notes.spec.ts for the pattern.
   */
  async delete(i = 0): Promise<void> {
    await this.page.locator('[class*="updateContainer_delete"]').nth(i).click();
    await this.page.waitForTimeout(2500);
  }

  /**
   * "Note added successfully" / "Note edited successfully" — chat-note
   * writes only; no toast has been observed for message-level notes or for
   * delete of either scope.
   */
  async toast(timeoutMs = 5000): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const toastText = await this.page.evaluate(() => {
        // querySelectorAll, not querySelector: an always-present, normally
        // empty `role="alert"` live-region placeholder can sit earlier in
        // DOM order than the real toast and would otherwise keep matching
        // first forever, masking the actual toast text (caught live
        // 2026-09-07 while investigating why toast() never returned
        // anything despite the note genuinely saving each time).
        const candidates = Array.from(
          document.querySelectorAll('[class*="toast"],[class*="notification"],[role="alert"]'),
        ) as HTMLElement[];
        const withText = candidates.find((el) => el.getBoundingClientRect().width > 0 && el.innerText.trim());
        return withText ? withText.innerText.trim() : null;
      });
      if (toastText) return toastText;
      // Polled at 200ms, not 400ms: this toast has been observed to render
      // and self-dismiss inside roughly the same 1s window Save takes to
      // close the popup — a coarser interval can straddle right past it.
      await this.page.waitForTimeout(200);
    }
    return null;
  }
}
