import { type Page } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the company dropdown in the top navigation bar.
 *
 * Only super-admin accounts see more than their own company — a restricted
 * account has nothing to select. Switching companies navigates away from
 * whatever page is open, so callers must switch first and open the target
 * page afterwards.
 */
export class CompanySelector extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private async open(): Promise<void> {
    await this.page.evaluate(() => {
      const button =
        (document.querySelector('[aria-label="company-selector"]') as HTMLElement | null) ??
        // Fallback: the only "select" button sitting in the top bar.
        (Array.from(document.querySelectorAll('button[aria-label="select"]')).find(
          (el) => el.getBoundingClientRect().y < 40,
        ) as HTMLElement | undefined) ??
        null;
      button?.click();
    });
    await this.page.waitForTimeout(2000);
  }

  /** Options offered by the dropdown. Opens and closes it via Escape. */
  async options(): Promise<string[]> {
    await this.open();
    const list = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('.k-list-item, li[role="option"]')).map((el) =>
        (el as HTMLElement).innerText.trim(),
      ),
    );
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(600);
    return list;
  }

  /** The company name currently shown in the selector. */
  async current(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const control = document.querySelector('[aria-label="company-selector"]');
      const host = control ? control.closest('.k-picker, .k-dropdownlist') : null;
      const inner = (host ?? document).querySelector('.k-input-inner');
      return inner ? (inner as HTMLElement).innerText.trim() : null;
    });
  }

  /** Switches company and waits out the reload it triggers. */
  async select(name: string): Promise<void> {
    await this.open();
    await this.page.evaluate((targetName) => {
      const item = Array.from(document.querySelectorAll('.k-list-item, li[role="option"]')).find(
        (el) => (el as HTMLElement).innerText.trim() === targetName,
      );
      (item as HTMLElement | undefined)?.click();
    }, name);
    await this.page.waitForTimeout(9000);
  }
}
