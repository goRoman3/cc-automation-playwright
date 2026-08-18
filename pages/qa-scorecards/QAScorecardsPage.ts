import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { dismissAnnouncementModal } from '../shared/dismissAnnouncementModal';

/**
 * Page object for the QA Scorecards listing (`/QAScorecards`).
 *
 * On SmarshCR Sales (~90 forms) the whole list renders unpaginated — every
 * row is a real `listitem` in the DOM at once, no virtualization or pager
 * observed. So `assertFormExists`/`deleteForm` just look the row up by name
 * directly; no need to drive the (fiddly, Kendo-based) column filter for
 * that. `filterByName()` is kept as a lower-level utility for callers that
 * specifically want to narrow the visible list, but the happy path doesn't
 * need it — confirmed live, the filter's own hover/popover interactions had
 * been a repeated source of flakiness (icon needs a header hover first to
 * become actionable, popover close-on-Escape, etc. — see
 * `specs/qa-scorecards-map.md`, staging 2026-07-31) with no upside once a
 * direct name lookup was confirmed sufficient.
 *
 * New forms are appended at the end of the list — if a just-saved form
 * isn't visible, reload rather than assume it is missing.
 */
export class QAScorecardsPage extends BasePage {
  readonly createNewFormButton: Locator;
  readonly nameColumnHeader: Locator;
  readonly nameFilterButton: Locator;
  readonly filterPopover: Locator;
  readonly filterValueInput: Locator;
  readonly filterApplyButton: Locator;
  readonly filterClearButton: Locator;

  constructor(page: Page) {
    super(page);
    this.createNewFormButton = page.getByRole('button', { name: 'Create New Evaluation Form' });
    this.nameColumnHeader = page.getByText('Available Evaluation Forms', { exact: true });
    this.nameFilterButton = page.locator('button[aria-label="Filter Available Evaluation Forms"]');
    this.filterPopover = page.locator('[class*="filter_filter"]');
    this.filterValueInput = this.filterPopover.locator('input[class*="input_input"]');
    this.filterApplyButton = page.locator('#filterButton');
    this.filterClearButton = this.filterPopover.getByRole('button', { name: 'Clear' });
  }

  async goto(): Promise<void> {
    await super.goto('/QAScorecards');
    await dismissAnnouncementModal(this.page);
  }

  /** Row for a given (exact) form name. */
  rowByName(name: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: name });
  }

  /** Opens the name column's filter and searches (default "Starts with"). */
  async filterByName(name: string): Promise<void> {
    await this.nameColumnHeader.hover();
    await this.nameFilterButton.click();
    await this.filterValueInput.waitFor({ state: 'visible' });
    await this.filterValueInput.fill(name);
    await this.filterApplyButton.click();
  }

  /** Waits for a row with this name to appear in the (unfiltered) list. */
  async assertFormExists(name: string, timeout = 15_000): Promise<void> {
    await this.rowByName(name).first().waitFor({ state: 'visible', timeout });
  }

  /**
   * Deletes the (exact-match) form by name, confirming the "Delete Item —
   * Are you sure you want to delete this item?" modal that the row's
   * Delete action opens (a custom modal, not a native confirm() — its
   * confirm button is plain text "Confirm", no aria-label; NOT matched
   * loosely on "Delete" too, since every row's own Delete icon also has
   * aria-label "Delete" and that collided with dozens of them). This suite
   * creates real forms in a shared, long-lived company (SmarshCR Sales) on
   * every run, so cleaning up after each test keeps the listing from
   * accumulating one entry per run.
   *
   * Re-dismisses the announcement modal before each of the two clicks
   * here, not just once — it has been observed popping up mid-flow between
   * them, later than its usual on-load timing, because automation moves
   * through steps faster than a human would.
   */
  async deleteForm(name: string): Promise<void> {
    await dismissAnnouncementModal(this.page);
    const row = this.rowByName(name).first();
    await row.getByRole('button', { name: 'Delete' }).click();

    await dismissAnnouncementModal(this.page);
    await this.page.getByRole('button', { name: 'Confirm', exact: true }).click({ timeout: 10_000 });

    await row.waitFor({ state: 'hidden', timeout: 10_000 });
  }
}
