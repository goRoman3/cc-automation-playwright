import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the Call Listing grid (the authenticated call recordings list).
 *
 * Reached from the left nav "Call Listing" link; URL is /CallListing/<companyId>.
 *
 * Verified selectors (staging 2026-06-30):
 *   - Grid:           role=grid "Table"
 *   - Action toolbar: role=button "Play" / "Export to Excel" / "Enable legal hold"
 *                     / "Delete" / "Add Filter" / "Edit Columns" / "Saved Filters"
 *   - Column header:  role=columnheader (name = column title)
 *   - Sort control:   role=button "Sort ascending <col>" (cycles asc → desc → none;
 *                     the columnheader exposes aria-sort while sorted)
 *   - Filter control: role=button "Filter <col>"
 *   - Select all:     role=checkbox "Select All"
 *
 * Share / Email / Download toolbar actions only appear once one or more calls are
 * selected, so select a row before reaching for them.
 */
export class CallListingPage extends BasePage {
  readonly grid: Locator;
  readonly dataRows: Locator;
  readonly selectAllCheckbox: Locator;
  /** Kendo loading overlay; intercepts pointer events while the grid fetches. */
  readonly loadingMask: Locator;

  // Action toolbar
  readonly playButton: Locator;
  readonly exportToExcelButton: Locator;
  readonly enableLegalHoldButton: Locator;
  readonly deleteButton: Locator;
  readonly addFilterButton: Locator;
  readonly editColumnsButton: Locator;
  readonly savedFiltersButton: Locator;
  /** "Got It" button on the onboarding tip overlay (when shown). */
  readonly gotItButton: Locator;

  /** Text columns shown by default — each exposes a sort and a filter control. */
  static readonly DEFAULT_TEXT_COLUMNS = [
    'Start time',
    'End time',
    'Call type',
    'Duration',
    'Extension',
    'Agent',
    'Groups',
    'Number',
    'Agent Windows User Name',
    'Site',
  ] as const;

  /** Icon-only columns shown by default — no sort/filter control. */
  static readonly DEFAULT_ICON_COLUMNS = [
    'Flag',
    'Tag',
    'Legal hold',
    'QA Status',
    'Screen capture',
    'Notes',
    'Direction',
    'Call Transcription',
    'Is Archived',
    'Is Redacted',
  ] as const;

  constructor(page: Page) {
    super(page);
    this.grid = page.getByRole('grid');
    this.dataRows = this.grid.locator('tbody tr');
    this.selectAllCheckbox = page.getByRole('checkbox', { name: 'Select All' });
    this.loadingMask = page.locator('.k-loading-mask');

    this.playButton = page.getByRole('button', { name: 'Play', exact: true });
    this.exportToExcelButton = page.getByRole('button', { name: 'Export to Excel' });
    this.enableLegalHoldButton = page.getByRole('button', { name: 'Enable legal hold' });
    this.deleteButton = page.getByRole('button', { name: 'Delete', exact: true });
    this.addFilterButton = page.getByRole('button', { name: 'Add Filter' });
    this.editColumnsButton = page.getByRole('button', { name: 'Edit Columns' });
    this.savedFiltersButton = page.getByRole('button', { name: 'Saved Filters' });
    this.gotItButton = page.getByRole('button', { name: 'Got It' });
  }

  /** Dismisses the onboarding tip overlay if it is shown — it otherwise floats
   *  over the grid and intercepts hover/click. Best-effort; no-op when absent. */
  async dismissOnboardingTip(): Promise<void> {
    if (await this.gotItButton.isVisible().catch(() => false)) {
      await this.gotItButton.click().catch(() => {});
      await this.gotItButton.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /** The column header cell for a given column title. Matched by the header's
   *  exact text node so e.g. "Agent" does not also match "Agent Windows User
   *  Name" (a substring match on the aggregated header name would). */
  columnHeader(name: string): Locator {
    return this.grid
      .locator('th[role="columnheader"]')
      .filter({ has: this.page.getByText(name, { exact: true }) });
  }

  /** The sort toggle button inside a column header (label cycles asc/desc/clear). */
  sortButton(column: string): Locator {
    return this.columnHeader(column).getByRole('button', {
      name: /Sort (ascending|descending)|Clear sorting/,
    });
  }

  /** The filter button inside a column header. Exact name so "Filter Agent"
   *  does not match "Filter Agent Windows User Name". */
  filterButton(column: string): Locator {
    return this.grid.getByRole('button', { name: `Filter ${column}`, exact: true });
  }

  /** Waits for the grid to render and its loading overlay to clear, so headers
   *  and rows are interactable (the overlay otherwise intercepts hover/click). */
  async waitForLoaded(): Promise<void> {
    await this.grid.waitFor({ state: 'visible', timeout: 20_000 });
    await this.loadingMask.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  }
}
