import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * EditColumnsPanel — opened by the "Edit Columns" toolbar button on Chat Listing.
 * Renders as edit-columns_shadowContainer and, while open, covers the toolbar
 * and blocks Add Filter — always close() before touching the filter bar.
 *
 * Layout (verified 2026-07-16):
 *   "Choose which columns to show"
 *   Available columns : Platform Type
 *   Visible columns   : Checkbox, Details, Start Date, End Date, Chat Name,
 *                       ChatRecord Id, Chat Type, Site Name, Participants,
 *                       Agent, Extension, Direction, Attachment, Notes,
 *                       Download, Is Archived
 *   Buttons           : Close | Default | Save
 */
export class EditColumnsPanel extends BasePage {
  readonly root: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[class*="edit-columns_shadowContainer"]');
  }

  async open(): Promise<void> {
    await this.page.locator('button[aria-label="Edit Columns"]').first().click();
    await this.page.waitForTimeout(2500);
  }

  async isOpen(): Promise<boolean> {
    return (await this.root.count()) > 0;
  }

  async text(): Promise<string> {
    return await this.page.evaluate(() => {
      const p = document.querySelector('[class*="edit-columns_shadowContainer"]') as HTMLElement | null;
      return p ? p.innerText : '';
    });
  }

  /** Column names under a given section heading. */
  async section(name: string): Promise<string[]> {
    const t = await this.text();
    const lines = t
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const start = lines.indexOf(name);
    if (start === -1) return [];
    const stops = ['Available columns', 'Visible columns', 'Close', 'Default', 'Save'];
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (stops.includes(lines[i])) break;
      out.push(lines[i]);
    }
    return out;
  }

  async availableColumns(): Promise<string[]> {
    return await this.section('Available columns');
  }

  async visibleColumns(): Promise<string[]> {
    return await this.section('Visible columns');
  }

  /** The panel overlays the toolbar and swallows real pointer events — click via DOM dispatch. */
  private async domClick(label: string): Promise<boolean> {
    return await this.page.evaluate((t) => {
      const p = document.querySelector('[class*="edit-columns_shadowContainer"]');
      const b =
        p &&
        Array.from(p.querySelectorAll('button')).find(
          (x) =>
            ((x as HTMLElement).innerText || '').trim() === t || x.getAttribute('aria-label') === t,
        );
      if (b) {
        (b as HTMLElement).click();
        return true;
      }
      return false;
    }, label);
  }

  async save(): Promise<void> {
    await this.domClick('Save');
    await this.page.waitForTimeout(3000);
  }

  async resetToDefault(): Promise<void> {
    await this.domClick('Default');
    await this.page.waitForTimeout(2000);
  }

  async close(): Promise<void> {
    await this.domClick('Close');
    await this.page.waitForTimeout(1500);
  }
}
