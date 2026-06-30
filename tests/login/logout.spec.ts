import { test, expect } from '../../fixtures/fixtures';

/**
 * Azure Login case 6844 — clicking the browser Back button after a successful
 * logout must NOT take the user back into an authenticated session.
 *
 * Auth-gated and serial: shares the single test account, so it must not run in
 * parallel with the other authenticated suites against the same credentials.
 * Prefer `--workers=1` when running the authenticated specs together.
 */
const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

test.describe('6844 Browser Back after logout', () => {
  // login() may force past the slow active-session modal — allow headroom.
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  // Safety net: if the test fails before its own logout step, end the session
  // here so the shared account doesn't stay logged in for the next test/run.
  test.afterEach(async ({ page, homePage }) => {
    try {
      if (!page.url().includes('/Home')) return;
      if (!(await homePage.header.isVisible().catch(() => false))) return;
      await homePage.userInfoMenu.hover({ timeout: 5_000 });
      await homePage.logoutButton.click({ timeout: 5_000 });
      await page.waitForURL('/', { timeout: 10_000 });
    } catch {
      /* already logged out — nothing to do */
    }
  });

  test('Back button after logout stays on the login page', async ({ page, loginPage, homePage }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await expect(homePage.header).toBeVisible();

    // Log out via the user-info fly-out.
    await homePage.logout();
    await expect(loginPage.emailInput).toBeVisible({ timeout: 15_000 });

    // Back button must not restore the authenticated session. Use 'commit' —
    // after logout the cached /Home no longer fully loads (no session), so the
    // default 'load' wait would hang; we only need the navigation to land.
    await page.goBack({ waitUntil: 'commit' });
    await expect(loginPage.emailInput).toBeVisible({ timeout: 15_000 });
    await expect(homePage.header).toBeHidden();
  });
});
