import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the Analytics Settings shell (/AnalyticsSettings).
 * Verified by DOM inspection on 2026-07-16.
 *
 * A sidebar with two sections: "Sentiment Adjustments" (default) and
 * "Data Management" (see SentimentAdjustmentsPage / DataManagementPage for
 * each section's own controls). Both render into the same URL — the section
 * is NOT reflected in the address bar, so navigation must go through the
 * sidebar rather than a direct goto().
 *
 * No spec exists for this page yet — ported as scaffolding only.
 */
export class AnalyticsSettingsPage extends BasePage {
  readonly searchSettings: Locator;
  readonly sentimentItem: Locator;
  readonly dataManagementItem: Locator;
  readonly closeSidebar: Locator;

  constructor(page: Page) {
    super(page);
    this.searchSettings = page.locator('input[placeholder="Search Settings"]');
    this.sentimentItem = page.locator('button:has-text("Sentiment Adjustments")');
    this.dataManagementItem = page.locator('button:has-text("Data Management")');
    this.closeSidebar = page.locator('[aria-label="Close sidebar"]');
  }

  /**
   * The app redirects right after login and can abort the first navigation
   * with net::ERR_ABORTED — retry rather than fail the whole spec.
   */
  async goto(path = '/AnalyticsSettings'): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await super.goto(path);
        break;
      } catch {
        await this.page.waitForTimeout(3000);
      }
    }
    await this.page.waitForTimeout(7000);
  }

  /** Sidebar items are plain buttons; click by exact text via DOM dispatch. */
  private async clickText(text: string): Promise<boolean> {
    return await this.page.evaluate((target) => {
      const el = Array.from(document.querySelectorAll('button, div, span, [role=tab]'))
        .filter((x) => {
          const r = x.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .find((x) => ((x as HTMLElement).innerText || '').trim() === target) as HTMLElement | undefined;
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, text);
  }

  async openSentimentAdjustments(): Promise<void> {
    await this.clickText('Sentiment Adjustments');
    await this.page.waitForTimeout(5000);
  }

  async openDataManagement(): Promise<void> {
    await this.clickText('Data Management');
    await this.page.waitForTimeout(5000);
  }

  async sidebarItems(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const sidebar = document.querySelector('[class*="analytics-settings-sidebar"]');
      if (!sidebar) return [];
      return Array.from(sidebar.querySelectorAll('button'))
        .map((b) => ((b as HTMLElement).innerText || '').trim())
        .filter(Boolean);
    });
  }

  async activeSidebarItem(): Promise<string> {
    return await this.page.evaluate(() => {
      const active = document.querySelector('[class*="analytics-settings-sidebar_menuItem_active"]');
      return active ? (active as HTMLElement).innerText.trim() : '';
    });
  }
}
