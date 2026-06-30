import { test, expect } from '../../fixtures/fixtures';
import type { Page } from '@playwright/test';
import { HomePage } from '../../pages/home/HomePage';
import { CallListingPage } from '../../pages/call-listing/CallListingPage';

/**
 * Azure "Call Listing" priority-1 cases that act on a real call — exercised
 * against the seeded demo call ("Add Demo Call" from the TEST_CC user's profile).
 *
 * The demo call lands in the "This Year" date range. These run as the TEST_CC
 * user (which can seed the demo call) and serially against the shared account.
 *
 * Covered here:
 *   - per-call action toolbar appears on selection (Share/Email/Download/Export/Delete)
 *
 * Pending (tracked as fixme / next batch):
 *   7575 download · 7557 export — both raise a toast/async-download flow rather
 *     than a direct browser download; the notification flow needs exploration.
 *   7521 playback · 7553 oscillogram · 7555 share · 7556 email
 *   7571/34922 legal hold · 7560 delete (+ restore via Add Demo Call)
 */
const CC_EMAIL = process.env.TEST_CC_EMAIL;
const CC_PASSWORD = process.env.TEST_CC_PASSWORD;

async function openDemoCallSelected(page: Page, homePage: HomePage, cl: CallListingPage) {
  await homePage.callListingNavLink.click();
  await page.waitForURL(/CallListing/, { timeout: 20_000 });
  await cl.waitForLoaded();
  await cl.dismissOnboardingTip();
  await cl.selectDateRange('This Year');

  // Seed the demo call if the company has none yet.
  if ((await cl.dataRows.count()) === 0) {
    await homePage.addDemoCall();
    await page.waitForTimeout(3_000);
    await cl.selectDateRange('This Year');
  }
  await expect(cl.dataRows.first()).toBeVisible();
  await cl.selectFirstRow();
}

test.describe('Call Listing — demo call actions', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(
    !CC_EMAIL || !CC_PASSWORD,
    'Set TEST_CC_EMAIL / TEST_CC_PASSWORD in .env to run demo-call tests',
  );

  test.beforeEach(async ({ page, loginPage, homePage, callListingPage }) => {
    await loginPage.goto();
    await loginPage.login(CC_EMAIL!, CC_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await openDemoCallSelected(page, homePage, callListingPage);
  });

  test.afterEach(async ({ page, homePage }) => {
    try {
      if (!(await homePage.userInfoMenu.isVisible().catch(() => false))) return;
      await homePage.userInfoMenu.hover({ timeout: 5_000 });
      await homePage.logoutButton.click({ timeout: 5_000 });
      await page.waitForURL('/', { timeout: 10_000 });
    } catch {
      /* already logged out */
    }
  });

  test('selecting the demo call reveals the per-call action toolbar', async ({ callListingPage }) => {
    await expect(callListingPage.playButton).toBeVisible();
    await expect(callListingPage.shareButton).toBeVisible();
    await expect(callListingPage.emailButton).toBeVisible();
    await expect(callListingPage.downloadButton).toBeVisible();
    await expect(callListingPage.exportToExcelButton).toBeVisible();
    await expect(callListingPage.deleteButton).toBeVisible();
  });

  // 7575 — download a single selected call. The download button does NOT fire a
  // direct browser download; it raises a toast/notification (async prepare-then-
  // link flow). Needs targeted exploration of that flow before asserting.
  test.fixme('7575 downloads the selected demo call', async ({ page, callListingPage }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
    await callListingPage.downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().length).toBeGreaterThan(0);
  });

  // 7557 — export the selected call's information to an Excel document. Same
  // toast/async-download flow as 7575 — pending exploration.
  test.fixme('7557 exports the selected demo call to Excel', async ({ page, callListingPage }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 40_000 });
    await callListingPage.exportToExcelButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
  });
});
