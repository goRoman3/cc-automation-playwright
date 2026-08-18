import { type Page, type Locator, expect } from '@playwright/test';
import { dismissAnnouncementModal } from './dismissAnnouncementModal';

/**
 * The company switcher in the top-left of the authenticated header shell.
 * Present on every authenticated page, so it is not tied to a single Page
 * Object — construct it against whichever `page` is current.
 *
 * Switching company navigates away from the current page, so callers should
 * switch first and then navigate to the page they actually want.
 */
export class CompanySelector {
  readonly combobox: Locator;
  readonly selectButton: Locator;

  constructor(private readonly page: Page) {
    this.combobox = page.getByRole('combobox', { name: 'company-selector' });
    this.selectButton = this.combobox.getByRole('button', { name: 'select' });
  }

  /** Currently selected company name. */
  async current(): Promise<string> {
    return (await this.combobox.textContent()) ?? '';
  }

  /**
   * Switches to the given company. No-ops if it is already selected.
   *
   * Selecting the option triggers a full app reinitialization (confirmed
   * live: the whole page dims with loading spinners) — the header keeps
   * showing the *previous* company's label, stale, throughout that reload,
   * so a one-shot check right after the click reads the old value even
   * though the switch is genuinely in progress. Polling with `expect(...).
   * toContainText()` (rather than a fixed settle pause) waits out however
   * long that reload actually takes instead of guessing at a duration.
   */
  async switchTo(companyName: string): Promise<void> {
    if ((await this.current()).includes(companyName)) return;

    // The announcement modal (see dismissAnnouncementModal doc) has been
    // observed reappearing here and blocking these clicks — re-checked
    // before each one, not just once, since it can pop up between them too.
    await dismissAnnouncementModal(this.page);
    await this.selectButton.click();
    await dismissAnnouncementModal(this.page);
    await this.page.getByRole('option', { name: companyName, exact: true }).click();
    await expect(this.combobox).toContainText(companyName, { timeout: 40_000 });
  }
}
