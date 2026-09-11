import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the Chat Listing grid (/ChatListing).
 *
 * Selectors verified by DOM inspection on staging 2026-07-16 (see
 * specs/chat-listing-map.md for the full element inventory + behaviour notes).
 *
 * Two quirks this page object exists to hide:
 *  1. There are TWO "Apply" buttons (search panel + filter bar). Never use
 *     getByText('Apply') — always go through applySearch()/applyFilter().
 *  2. The search accordion overlays the toolbar and swallows real pointer
 *     events, so several controls must be clicked via DOM dispatch.
 *
 * Data quirk: the default date range is "Last 7 Days", which yields
 * "No Results Found!" on staging — the newest chat is 06/09/2026. Most specs
 * need setDateRange('This Year') before asserting on the grid.
 */
export class ChatListingPage extends BasePage {
  // search panel (top-left accordion)
  readonly searchInput: Locator;
  readonly searchInfoIcon: Locator;

  // filter bar
  readonly addFilterButton: Locator;
  readonly editFilterButton: Locator;
  readonly resetFiltersButton: Locator;
  readonly appliedFilterChip: Locator;

  // toolbar (top-right)
  readonly emailChatButton: Locator;
  readonly exportToExcelButton: Locator;
  readonly editColumnsButton: Locator;

  // grid
  readonly rows: Locator;
  readonly selectAll: Locator;
  readonly pager: Locator;
  readonly viewChatButtons: Locator;
  readonly chatNoteButtons: Locator;
  readonly downloadButtons: Locator;

  /** "Action Required: API Platform Update" announcement — blocks clicks until dismissed. */
  readonly announcementCloseButton: Locator;

  /** Grid columns in DOM order. Checkbox + Details have no header text. */
  static readonly COLUMNS = [
    'Checkbox', 'Details', 'Start Date', 'End Date', 'Chat Name', 'ChatRecord Id',
    'Chat Type', 'Site Name', 'Participants', 'Agent', 'Extension',
    'Direction', 'Attachment', 'Notes', 'Download', 'Is Archived',
  ] as const;

  /** Offered by Edit columns but not shown by default. */
  static readonly AVAILABLE_COLUMNS = ['Platform Type'] as const;

  /** Headers whose sort activator carries table-header_disabled. */
  static readonly UNSORTABLE = ['ChatRecord Id', 'Site Name', 'Participants'] as const;

  static readonly DATE_RANGES = [
    'Today', 'Yesterday', 'This Week', 'Last Week', 'Last 7 Days',
    'This Month', 'Last Month', 'This Year', 'Last Year', 'Custom Date Range',
  ] as const;

  static readonly FILTER_FIELDS = [
    'Start Date (Edit Default)', 'End Date', 'Chat Name',
    'ChatRecord Id', 'Chat Type', 'Participants', 'Extensions',
  ] as const;

  constructor(page: Page) {
    super(page);

    this.searchInput = page.locator('input[placeholder="Search Chats"]');
    this.searchInfoIcon = page.locator('[class*="stt-call-search-panel_infoIcon"]');

    this.addFilterButton = page.locator('button:has-text("Add Filter")');
    this.editFilterButton = page.locator('[aria-label="Edit filter"]');
    this.resetFiltersButton = page.locator('button:has-text("Reset Filters")');
    this.appliedFilterChip = page.locator('[class*="applied-filter"]');

    this.emailChatButton = page.locator('[aria-label="Email chat button"]');
    this.exportToExcelButton = page.locator('[aria-label="Export to Excel"]');
    this.editColumnsButton = page.locator('button[aria-label="Edit Columns"]');

    this.rows = page.locator('tbody tr');
    this.selectAll = page.locator('[aria-label="Select All"]');
    this.pager = page.locator('.k-pager, [class*="pager"]');
    this.viewChatButtons = page.locator('button[aria-label="View chat"]');
    this.chatNoteButtons = page.locator('[aria-label="Open chat note"]');
    this.downloadButtons = page.locator('[aria-label="Download"]');

    this.announcementCloseButton = page.locator('[aria-label="Close modal"]');
  }

  async goto(path = '/ChatListing'): Promise<void> {
    await super.goto(path);
    await this.page.waitForTimeout(5000);
  }

  /** Dismisses the announcement modal if it is covering the page. */
  async dismissAnnouncement(): Promise<void> {
    if ((await this.announcementCloseButton.count()) > 0) {
      await this.announcementCloseButton.first().click().catch(() => {});
      await this.page.waitForTimeout(800);
    }
  }

  /** Click a button by exact label, bypassing the accordion's pointer capture. */
  private async domClick(text: string, scope?: string): Promise<boolean> {
    return await this.page.evaluate(
      ([t, s]) => {
        const root = s ? document.querySelector(s) : document;
        const b =
          root &&
          Array.from(root.querySelectorAll('button')).find(
            (x) => ((x as HTMLElement).innerText || '').trim() === t,
          );
        if (b) {
          (b as HTMLElement).click();
          return true;
        }
        return false;
      },
      [text, scope] as const,
    );
  }

  /** Disambiguate the two Apply buttons by vertical position. */
  private async clickApplyNear(y: number): Promise<boolean> {
    return await this.page.evaluate((ty) => {
      const b = Array.from(document.querySelectorAll('button'))
        .filter((x) => (x as HTMLElement).innerText.trim() === 'Apply')
        .map((x) => ({ el: x as HTMLElement, y: x.getBoundingClientRect().y }))
        .filter((o) => o.y > 0)
        .sort((p, q) => Math.abs(p.y - ty) - Math.abs(q.y - ty))[0];
      if (b) {
        b.el.click();
        return true;
      }
      return false;
    }, y);
  }

  // ── date range ─────────────────────────────────────────────

  /**
   * Default range is "Last 7 Days", which yields No Results Found on staging —
   * the newest chat is 06/09/2026. Most specs need setDateRange('This Year').
   */
  async setDateRange(label: string): Promise<void> {
    await this.editFilterButton.first().click();
    await this.page.waitForTimeout(1200);
    const sel = this.page.locator('[aria-label="select"]');
    await sel.nth((await sel.count()) - 1).click();
    await this.page.waitForTimeout(1000);
    await this.page
      .locator(`li:has-text("${label}"), .k-list-item:has-text("${label}")`)
      .first()
      .click();
    await this.page.waitForTimeout(600);
    await this.page.locator('button[aria-label="OK"]').first().click();
    await this.page.waitForTimeout(1000);
    await this.applyFilter();
  }

  async applyFilter(): Promise<void> {
    await this.clickApplyNear(136);
    await this.page.waitForTimeout(7000);
  }

  async resetFilters(): Promise<void> {
    await this.domClick('Reset Filters');
    await this.page.waitForTimeout(6000);
  }

  // ── search ─────────────────────────────────────────────────

  /**
   * Search Chats matches CHAT MESSAGE CONTENT only — not Agent, Chat Name or
   * any other grid metadata (verified 2026-07-16: "Hi" -> 2 hits, "Charl" -> 0).
   * Use the filter bar for metadata.
   */
  async addSearchTerm(term: string): Promise<void> {
    await this.searchInput.first().fill(term);
    await this.page.waitForTimeout(500);
    await this.domClick('Add', '[class*="search-panel"]');
    await this.page.waitForTimeout(1200);
  }

  async applySearch(): Promise<void> {
    await this.domClick('Apply', '[class*="search-panel"]');
    await this.page.waitForTimeout(8000);
  }

  async clearSearch(): Promise<void> {
    await this.domClick('Clear Search', '[class*="search-panel"]');
    await this.page.waitForTimeout(6000);
  }

  /** The search panel's visible text — added terms render as removable chips. */
  async searchTerms(): Promise<string> {
    return await this.page.evaluate(() => {
      const p = document.querySelector('[class*="search-panel"]') as HTMLElement | null;
      return p ? p.innerText.replace(/\n+/g, ' | ') : '';
    });
  }

  // ── grid ───────────────────────────────────────────────────

  async rowCount(): Promise<number> {
    return await this.rows.count();
  }

  /** Cell texts of row `i`, or null when the row does not exist. */
  async rowData(i = 0): Promise<string[] | null> {
    return await this.page.evaluate((idx) => {
      const r = document.querySelectorAll('tbody tr')[idx];
      return r
        ? Array.from(r.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.trim())
        : null;
    }, i);
  }

  async isEmpty(): Promise<boolean> {
    return (await this.page.evaluate(() => document.body.innerText)).includes('No Results Found!');
  }

  async sortBy(column: string): Promise<void> {
    await this.page.locator(`[aria-label*="${column}"][class*="sortActivator"]`).first().click();
    await this.page.waitForTimeout(4000);
  }

  async openColumnFilter(column: string): Promise<void> {
    await this.page.locator(`[aria-label="Filter ${column}"]`).first().click();
    await this.page.waitForTimeout(1500);
  }

  /** Opens the chat-view side modal for row `i` (see ChatViewModal). */
  async openChat(i = 0): Promise<void> {
    await this.page.evaluate((idx) => {
      (document.querySelectorAll('button[aria-label="View chat"]')[idx] as HTMLElement).click();
    }, i);
    await this.page.waitForTimeout(7000);
  }

  async pagerText(): Promise<string> {
    return await this.page.evaluate(() => {
      const p = document.querySelector('.k-pager, [class*="pager"]') as HTMLElement | null;
      return p ? p.innerText.replace(/\n+/g, ' | ') : '';
    });
  }
}
