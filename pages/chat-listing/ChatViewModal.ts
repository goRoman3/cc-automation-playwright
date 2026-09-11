import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * ChatViewModal — side panel opened by the "View Chat" button in a Chat Listing
 * grid row (ChatListingPage.openChat()). Does NOT change the URL; it mounts as
 * side-modal_shadowContainer over the listing.
 *
 * Observed content for chat cd048739-2cb7-4b77-8b17-7795b53423b0 (2026-07-16):
 *   Conversation between Charl Roesch and 27614895384
 *   27614895384, Charl Roesch
 *   Last Month
 *   CR | Charl Roesch | 02:39 PM | Hi
 *
 * Header, date dropdown, in-chat search and per-message copy verified
 * 2026-08-05 on `SmarshCR Sales` (see specs/chat-listing-map.md §8a) — that
 * company has real multi-message chats; `Charl_Test` does not.
 */
export class ChatViewModal extends BasePage {
  readonly root: Locator;

  /** Sticky label above the messages; text is the date group currently at the top. */
  readonly dateDropdown: Locator;
  /** Filters the message list live, without pressing Enter. */
  readonly searchThisChatInput: Locator;
  /** The header's "+N" button — opens the Participants Information popup. */
  readonly moreParticipantsButton: Locator;
  readonly participantsPopup: Locator;
  /** The panel's own "X" — `aria-label="Close"`, top-right corner. */
  readonly closeButton: Locator;

  static readonly DATE_DROPDOWN_OPTIONS = [
    'Today', 'Yesterday', 'Last Week', 'Last Month',
    'The very beginning', 'Choose custom date',
  ] as const;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[class*="side-modal_shadowContainer"]');
    // Scoped to `root`, not `page` — the grid stays mounted behind the modal,
    // and none of these controls exist anywhere outside it.
    // .first(): caught live 2026-09-07 — two elements share
    // id/aria-label="groupDateSelector" in the DOM (plausibly a sticky-header
    // measurement clone; not yet confirmed as a product defect). Narrow fix
    // here rather than widening `root` itself, since no other control has
    // shown the same ambiguity yet.
    this.dateDropdown = this.root.locator('[aria-label="groupDateSelector"]').first();
    this.searchThisChatInput = this.root.locator('input[placeholder="Search This Chat"]');
    this.moreParticipantsButton = this.root.locator('[class*="header-sales_amountOfPersons"]');
    // Page-scoped, not root-scoped: confirmed live 2026-09-07 that this popup
    // renders through a Kendo `k-animation-container` portal appended outside
    // the side-modal's DOM subtree (`k-animation-container > k-popup >
    // dynamic-popup_popup … header-sales_popupContainer`), the same portaling
    // behaviour flagged as an open question on pickDateOption() below. Scoping
    // this to `root` (as first written) made openParticipantsPopup() time out
    // waiting for an element that could never appear inside it.
    this.participantsPopup = page.locator('[class*="header-sales_popupContainer"]');
    this.closeButton = this.root.locator('[class*="side-modal_closeDrawerIcon"]');
  }

  async isOpen(): Promise<boolean> {
    return (await this.root.count()) > 0 && (await this.root.first().isVisible());
  }

  async text(): Promise<string> {
    return await this.page.evaluate(() => {
      const m = document.querySelector('[class*="side-modal_shadowContainer"]') as HTMLElement | null;
      return m ? m.innerText : '';
    });
  }

  /** Header line, e.g. "Conversation between Charl Roesch and 27614895384". */
  async title(): Promise<string> {
    return (await this.text()).split('\n').filter(Boolean)[0] || '';
  }

  /** Message bubbles: sender initials, name, timestamp, body. */
  async messages(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const m = document.querySelector('[class*="side-modal_shadowContainer"]') as HTMLElement | null;
      if (!m) return [];
      return m.innerText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    });
  }

  /**
   * Closes the panel via its own "X" (aria-label="Close"), confirming the
   * modal actually closed and falling back to Escape if needed.
   *
   * Escape alone used to be enough (chat-view.spec.ts's participants-popup
   * test closed this way every time), but calling it right after closing a
   * ChatNotesPopup that had been sitting on top of this panel stopped
   * working reliably — confirmed live 2026-09-07 via a full sequence
   * (close ChatNotesPopup -> Escape here, twice -> still open, per
   * scripts/diagnostics/chat-view-close-check.ts's DOM dump, which is what
   * turned up the explicit close button). The semantic button sidesteps
   * whatever focus/keyboard-routing state that sequence left behind, rather
   * than trying to explain it.
   *
   * `closeButton` sits at roughly the same screen position as the header's
   * own hover-triggered profile flyout (HomePage.userInfoMenu). Playwright's
   * click leaves the virtual cursor there; once this panel unmounts, that
   * same point resolves to the header button underneath, and the browser
   * treats the (unmoved) cursor as now hovering it — opening the profile
   * flyout as a pure side effect, 100% reproducible across 3 read-only
   * cycles (no notes created/edited/deleted) via scripts/diagnostics/
   * chat-notes-readonly-cycle.ts. Moving the mouse to a neutral point right
   * after the click is a plain, non-force way to undo that hover — not a
   * workaround for anything actually broken in the close button itself.
   */
  async close(): Promise<void> {
    if (await this.closeButton.isVisible().catch(() => false)) {
      await this.closeButton.click();
      await this.page.mouse.move(400, 400);
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForTimeout(1000);
    if (await this.isOpen()) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(1500);
    }
  }

  // ── header ─────────────────────────────────────────────────

  /**
   * Line 1 of the header — character-for-character the grid's Chat Name
   * cell. Delegates to title() (whole-modal innerText, line-broken by
   * layout) rather than reading `[class*="header-sales_title"]` directly:
   * that partial-class selector's `.first()` match turned out to be a
   * wrapper that also contains the participants line, so a raw
   * `.textContent()` on it concatenated both lines with no separator
   * (caught live 2026-09-07 — see chat-view.spec.ts's header-title test).
   */
  async headerTitle(): Promise<string> {
    return this.title();
  }

  /** Line 2 of the header — only the participants that fit; the rest are behind "+N". */
  async headerParticipantsLine(): Promise<string> {
    return (await this.text()).split('\n').filter(Boolean)[1] || '';
  }

  /**
   * Opens the Participants Information popup (the header's "+N" button) and
   * returns its full list — equal to the grid's Participants cell.
   * Close with closeParticipantsPopup() (Escape, or a second click of "+N").
   */
  async openParticipantsPopup(): Promise<string> {
    await this.moreParticipantsButton.click();
    await this.participantsPopup.waitFor({ state: 'visible' });
    return (await this.participantsPopup.textContent()) ?? '';
  }

  async closeParticipantsPopup(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.participantsPopup.waitFor({ state: 'hidden' }).catch(() => {});
  }

  // ── date dropdown ──────────────────────────────────────────

  /** Current label, e.g. "Monday, March 9" — follows scroll position; it does not filter. */
  async dateDropdownLabel(): Promise<string> {
    return (await this.dateDropdown.textContent())?.trim() ?? '';
  }

  async openDateDropdown(): Promise<void> {
    await this.dateDropdown.click();
    await this.page.waitForTimeout(600);
  }

  /**
   * Picks one of DATE_DROPDOWN_OPTIONS from the already-opened dropdown.
   *
   * Deliberately queried page-wide, not scoped to `root`: confirmed live
   * 2026-09-07 that this app's Kendo popups (the Participants Information
   * popup, at least) portal to a `k-animation-container` appended outside the
   * side-modal's DOM subtree rather than rendering inline — see
   * `participantsPopup` above, which timed out for exactly this reason until
   * it was un-scoped from `root`. Left page-wide here on the same grounds
   * (matches ChatListingPage.setDateRange's identical choice for the filter
   * bar's own Kendo date picker) rather than assumed fixed without directly
   * confirming this specific popup too.
   */
  async pickDateOption(label: string): Promise<void> {
    await this.page
      .locator(`.k-list-item:has-text("${label}"), li:has-text("${label}")`)
      .first()
      .click();
    await this.page.waitForTimeout(600);
  }

  // ── search this chat ───────────────────────────────────────

  /**
   * Filters the message list live — no Enter needed. A no-match query leaves
   * zero messages and the date dropdown disappears; there is no "No results"
   * text to assert on, only the empty message list.
   */
  async searchThisChat(term: string): Promise<void> {
    await this.searchThisChatInput.fill(term);
    await this.page.waitForTimeout(600);
  }

  async clearSearchThisChat(): Promise<void> {
    await this.searchThisChatInput.fill('');
    await this.page.waitForTimeout(600);
  }

  /** Number of message bubbles currently rendered. */
  async messageCount(): Promise<number> {
    return await this.root.locator('[aria-label^="Message:"]').count();
  }

  // ── copy message ───────────────────────────────────────────

  /**
   * Copies message `i`'s text to the clipboard (Copy message only appears on
   * hover). Puts the message TEXT ONLY — author, timestamp and reaction emoji
   * are not copied, and no toast is shown.
   *
   * Chromium-only: the context must be created with
   * permissions: ['clipboard-read', 'clipboard-write'].
   */
  async copyMessage(i = 0): Promise<void> {
    const message = this.root.locator('[aria-label^="Message:"]').nth(i);
    await message.hover();
    const button = message.locator('[aria-label^="Copy message"]');
    await button.waitFor({ state: 'visible' });
    await button.click();
  }

  async readClipboardText(): Promise<string> {
    return await this.page.evaluate(() => navigator.clipboard.readText());
  }
}
