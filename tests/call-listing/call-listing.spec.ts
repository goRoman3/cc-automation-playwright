import { test, expect } from '../../fixtures/fixtures';
import { CallListingPage } from '../../pages/call-listing/CallListingPage';

/**
 * Azure "Call Listing" suite — priority-1 cases.
 *
 * Auth-gated and serial: shares the single staging account, so it must run with
 * --workers=1 alongside the other authenticated suites (npm run test:login style).
 *
 * Covered here (deterministic, no call data required):
 *   - 7541  filter control exists on data columns, not on icon columns
 *   - 7542  sort control exists on data columns and toggles asc/desc
 *
 * NOT yet covered (need prerequisites — tracked as fixme):
 *   - 7541/7542 full scope: the manual cases first move ALL available columns to
 *     visible via "Edit Columns" → Save, then verify every column. That needs the
 *     Edit-Columns dialog automation.
 *   - 7542 row-order verification needs seeded calls in the date range (the test
 *     account currently has ~2 calls), so only control behaviour is asserted here.
 */
const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

test.describe('Call Listing — priority 1', () => {
  // login() may force past the slow active-session modal — allow headroom.
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  test.beforeEach(async ({ page, loginPage, homePage, callListingPage }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });

    await homePage.callListingNavLink.click();
    await page.waitForURL(/CallListing/, { timeout: 20_000 });
    await callListingPage.waitForLoaded();
    await callListingPage.dismissOnboardingTip();
  });

  // End the session so the shared account doesn't stay logged in for the next test.
  test.afterEach(async ({ page, homePage }) => {
    try {
      if (!page.url().includes('/CallListing') && !page.url().includes('/Home')) return;
      if (!(await homePage.userInfoMenu.isVisible().catch(() => false))) return;
      await homePage.userInfoMenu.hover({ timeout: 5_000 });
      await homePage.logoutButton.click({ timeout: 5_000 });
      await page.waitForURL('/', { timeout: 10_000 });
    } catch {
      /* already logged out — nothing to do */
    }
  });

  test('page loads with the grid and the action toolbar', async ({ callListingPage }) => {
    await expect(callListingPage.grid).toBeVisible();
    await expect(callListingPage.playButton).toBeVisible();
    await expect(callListingPage.exportToExcelButton).toBeVisible();
    await expect(callListingPage.deleteButton).toBeVisible();
    await expect(callListingPage.addFilterButton).toBeVisible();
    await expect(callListingPage.editColumnsButton).toBeVisible();
    await expect(callListingPage.selectAllCheckbox).toBeVisible();
  });

  // 7541 — every data column reveals a filter control on hover; icon columns
  // have none. (The filter icon is hidden until the column header is hovered.)
  test('7541 data columns expose a filter control, icon columns do not', async ({ callListingPage }) => {
    for (const col of CallListingPage.DEFAULT_TEXT_COLUMNS) {
      await callListingPage.columnHeader(col).hover();
      await expect(callListingPage.filterButton(col), `Filter control for "${col}"`).toBeVisible();
    }
    // Icon columns carry no filter control at all (icon-only header buttons have
    // no text label, so there is nothing to hover-reveal).
    for (const col of CallListingPage.DEFAULT_ICON_COLUMNS) {
      await expect(callListingPage.filterButton(col), `No filter control for icon column "${col}"`).toHaveCount(0);
    }
  });

  // 7542 — every data column exposes a sort control that toggles asc/desc; icon
  // columns are not sortable.
  test('7542 data columns expose a sort control; icon columns do not', async ({ callListingPage }) => {
    for (const col of CallListingPage.DEFAULT_TEXT_COLUMNS) {
      await expect(callListingPage.sortButton(col), `Sort control for "${col}"`).toBeVisible();
    }
    for (const col of CallListingPage.DEFAULT_ICON_COLUMNS) {
      await expect(callListingPage.sortButton(col), `No sort control for icon column "${col}"`).toHaveCount(0);
    }
  });

  test('7542 clicking a column sort toggles ascending then descending', async ({ callListingPage }) => {
    // "Agent" is not the default-sorted column, so the first click sorts ascending.
    const header = callListingPage.columnHeader('Agent');
    await callListingPage.sortButton('Agent').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');

    // Each sort re-fetches and re-shows the loading overlay — wait it out before
    // the next click so the overlay can't intercept it.
    await callListingPage.loadingMask.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await callListingPage.sortButton('Agent').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  });

  // ── Remaining priority-1 Call Listing cases ────────────────────────────────
  // Tracked but not yet implemented. Grouped by what they need:
  //
  //  Need seeded calls in the date range (account has ~2 calls):
  //    7521 single-call playback · 7553 PCI zone on oscillogram
  //    7575 single download · 7550 bulk download · 7557 export to Excel
  //    33254 unique ZIPs for concurrent bulk downloads
  //  Send real emails from staging (need a safe target + assertion strategy):
  //    7555 share calls · 7556 email calls
  //  Mutate/destroy shared-account data (need explicit go-ahead + cleanup):
  //    7560 delete calls · 7571 enable legal hold · 34922 disable legal hold
  //  Advanced Filters date-range behaviour:
  //    7525 each date-range option filters · 33298 datepicker stays open on custom range
});
