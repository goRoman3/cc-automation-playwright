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
 */
export class ChatViewModal extends BasePage {
  readonly root: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[class*="side-modal_shadowContainer"]');
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

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1000);
  }
}
