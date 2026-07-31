import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { ColumnFilterPopup } from './ColumnFilterPopup';

/**
 * Page object for the QA Scorecards grid (/QAScorecards) — the listing of
 * evaluation forms. Selectors verified 2026-07-31. Covers the listing only,
 * not the scorecard editor.
 *
 * Full element inventory + verified behaviour: specs/qa-scorecards-map.md.
 *
 * Quirks:
 *  1. The sort activator is a `div[role=button]`, not a button. React ignores a
 *     DOM-dispatched .click() on it — sorting MUST go through a real Playwright
 *     click, which is what sortBy() does.
 *  2. The text columns' filter icons are height 0 until the header is hovered,
 *     so the reverse is true for them: a real click never becomes actionable and
 *     openFilter() DOM-dispatches after hovering.
 *  3. An active text-column filter is signalled only by its icon staying visible
 *     (height > 0) without hover. Archived is a filter-only column by design: it
 *     has no sort activator and no header text, its always-visible icon is the
 *     control that opens the filter, so it has no such signal. Assert on the
 *     filtered result there, not on the header.
 *  4. Neither sorting nor filtering survives a reload or leaving the page.
 */
export class QAScorecardsPage extends BasePage {
  readonly filterPopup: ColumnFilterPopup;

  readonly createFormButton: Locator;
  readonly uploadConfigButton: Locator;

  readonly grid: Locator;
  readonly headers: Locator;
  readonly rows: Locator;
  readonly pager: Locator;
  readonly refreshButton: Locator;

  readonly archiveButtons: Locator;
  readonly editButtons: Locator;
  readonly deleteButtons: Locator;

  /** Grid columns in DOM order. The last four are icon-only. */
  static readonly COLUMNS = [
    'Available Evaluation Forms',
    'Form Type',
    'Archived',
    'Download',
    'Edit',
    'Delete',
  ] as const;

  static readonly SORTABLE = ['Available Evaluation Forms', 'Form Type'] as const;
  static readonly FILTERABLE = ['Available Evaluation Forms', 'Form Type', 'Archived'] as const;
  static readonly FORM_TYPES = ['Manual', 'Auto'] as const;
  static readonly ARCHIVED_VALUES = ['Yes', 'No'] as const;
  static readonly ROWS_PER_PAGE = ['25', '50', '100', '250', '500', '1000', '2000'] as const;

  constructor(page: Page) {
    super(page);
    this.filterPopup = new ColumnFilterPopup(page);

    this.createFormButton = page.locator('button:has-text("Create New Evaluation Form")');
    this.uploadConfigButton = page.locator('button:has-text("Upload config")');

    this.grid = page.locator('.k-grid');
    this.headers = page.locator('.k-grid-header th');
    this.rows = page.locator('.k-grid tbody tr');
    this.pager = page.locator('[class*="pager"], .k-pager');
    this.refreshButton = page.locator('button[aria-label="Refresh"]');

    this.archiveButtons = page.locator('button[aria-label="Archive"]');
    this.editButtons = page.locator('button[aria-label="Edit"]');
    this.deleteButtons = page.locator('button[aria-label="Delete"]');
  }

  async goto(path = '/QAScorecards'): Promise<void> {
    await super.goto(path);
    await this.waitForGrid();
  }

  /**
   * The grid is fetched after the shell renders, so a fixed sleep is a coin
   * flip on a slow staging response. Wait for either a populated pager or the
   * empty-state message before touching anything.
   */
  async waitForGrid(timeout = 45000): Promise<void> {
    await this.page
      .waitForFunction(
        () => {
          const pager = document.querySelector('[class*="pager"], .k-pager') as HTMLElement | null;
          if (pager && /of\s+\d+\s+items/.test(pager.innerText)) return true;
          return document.body.innerText.includes('No Results Found');
        },
        undefined,
        { timeout },
      )
      .catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  // ── grid contents ──────────────────────────────────────────
  async rowCount(): Promise<number> {
    return await this.rows.count();
  }

  /** Values of the "Available Evaluation Forms" column on the current page. */
  async formNames(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('.k-grid tbody tr'))
        .map((row) => (row.querySelector('td') as HTMLElement | null)?.innerText ?? '')
        .map((text) => text.trim())
        .filter(Boolean),
    );
  }

  /** Values of the "Form Type" column on the current page. */
  async formTypes(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('.k-grid tbody tr'))
        .map((row) => (row.querySelectorAll('td')[1] as HTMLElement | undefined)?.innerText ?? '')
        .map((text) => text.trim())
        .filter(Boolean),
    );
  }

  async isEmpty(): Promise<boolean> {
    return (await this.page.evaluate(() => document.body.innerText)).includes('No Results Found');
  }

  /** Pager text, e.g. "1 | 2 | ... | Rows per page | 25 | 1 - 25 of 156 items". */
  async pagerText(): Promise<string> {
    return await this.page.evaluate(() => {
      const pager = document.querySelector('[class*="pager"], .k-pager') as HTMLElement | null;
      return pager ? pager.innerText.replace(/\n+/g, ' | ') : '';
    });
  }

  /** Total item count the pager reports, or 0 when the grid is empty. */
  async totalItems(): Promise<number> {
    const match = (await this.pagerText()).match(/of\s+(\d+)\s+items/);
    return match ? Number(match[1]) : 0;
  }

  async currentPageRange(): Promise<{ from: number; to: number } | null> {
    const match = (await this.pagerText()).match(/(\d+)\s*-\s*(\d+)\s+of/);
    return match ? { from: Number(match[1]), to: Number(match[2]) } : null;
  }

  async goToPage(n: number): Promise<void> {
    await this.page.locator(`button[aria-label="Page ${n}"]`).first().click();
    await this.page.waitForTimeout(3500);
  }

  async setRowsPerPage(n: string | number): Promise<void> {
    await this.page
      .locator('[class*="pager"] span[role="combobox"], .k-pager span[role="combobox"]')
      .first()
      .click();
    await this.page.waitForTimeout(1500);
    await this.page
      .locator('.k-list-item')
      .filter({ hasText: new RegExp(`^${n}$`) })
      .first()
      .click();
    await this.page.waitForTimeout(3500);
  }

  // ── sorting ────────────────────────────────────────────────
  /**
   * One click advances the cycle: unsorted -> ascending -> descending -> unsorted.
   * Only one column is sorted at a time; sorting another column drops the first.
   */
  async sortBy(column: string): Promise<void> {
    await this.page.locator('[class*="sortActivator"]', { hasText: column }).first().click();
    await this.page.waitForTimeout(3500);
  }

  /**
   * The activator's aria-label names the NEXT action, so it doubles as the
   * current state: "Sort ascending X" = unsorted, "Sort descending X" = ascending,
   * "Clear sorting X" = descending.
   */
  async sortState(column: string): Promise<string | null> {
    const aria = await this.page.evaluate((col) => {
      const activator = Array.from(
        document.querySelectorAll('.k-grid-header th [class*="sortActivator"]'),
      ).find((el) => (el as HTMLElement).innerText.trim().startsWith(col));
      return activator ? activator.getAttribute('aria-label') : null;
    }, column);
    if (!aria) return null;
    if (aria.startsWith('Sort ascending')) return 'none';
    if (aria.startsWith('Sort descending')) return 'asc';
    if (aria.startsWith('Clear sorting')) return 'desc';
    return aria;
  }

  async isSortable(column: string): Promise<boolean> {
    return await this.page.evaluate((col) => {
      const th = Array.from(document.querySelectorAll('.k-grid-header th')).find((el) =>
        (el as HTMLElement).innerText.trim().startsWith(col),
      );
      return !!th?.querySelector('[class*="sortActivator"]');
    }, column);
  }

  // ── filtering ──────────────────────────────────────────────
  /**
   * Hover the header to give the icon a box, then DOM-click it: the icon has
   * height 0 until hover, so a plain Playwright click never becomes actionable.
   * The Archived column's opener is aria-label="Archived", not "Filter …".
   */
  async openFilter(column: string): Promise<ColumnFilterPopup> {
    const aria = column === 'Archived' ? 'Archived' : `Filter ${column}`;
    await this.headers.first().hover().catch(() => {});
    await this.page.waitForTimeout(400);
    await this.page.evaluate((ariaLabel) => {
      const button = document.querySelector(
        `button[aria-label="${ariaLabel}"]`,
      ) as HTMLElement | null;
      button?.click();
    }, aria);
    await this.page.waitForTimeout(1800);
    return this.filterPopup;
  }

  async closeFilter(): Promise<void> {
    await this.page.evaluate(() => document.body.click());
    await this.page.waitForTimeout(1000);
  }

  /** True when the column's filter icon is visible without hovering it. */
  async isFilterIconVisible(column: string): Promise<boolean> {
    const aria = column === 'Archived' ? 'Archived' : `Filter ${column}`;
    return await this.page.evaluate((ariaLabel) => {
      const button = document.querySelector(`button[aria-label="${ariaLabel}"]`);
      if (!button) return false;
      const rect = button.getBoundingClientRect();
      return rect.height > 0 && rect.width > 0;
    }, aria);
  }

  async filterByName(value: string, operator?: string): Promise<void> {
    const popup = await this.openFilter('Available Evaluation Forms');
    if (operator) await popup.selectOperator(operator);
    await popup.setValue(value);
    await popup.apply();
  }

  async filterByFormType(value: string): Promise<void> {
    const popup = await this.openFilter('Form Type');
    await popup.selectRadio(value);
    await popup.apply();
  }

  async filterByArchived(value: string): Promise<void> {
    const popup = await this.openFilter('Archived');
    await popup.selectRadio(value);
    await popup.apply();
  }

  async clearFilter(column: string): Promise<void> {
    const popup = await this.openFilter(column);
    await popup.clear();
  }
}
