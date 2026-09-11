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
  // login() may force past the slow active-session modal, and post-logout
  // render latency can itself spike under the shared account's accumulated
  // activity across a full cross-browser run — allow headroom for both.
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
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
    // Arrange: must land on an authenticated /Home before the logout/back-button
    // steps mean anything. login() can loop through several stale-session modals
    // if the shared account has leftover sessions from earlier tests in the same
    // cross-browser run — kept as its own step (with its own timeout) so a slow
    // or failed login is reported as "Log in", not misattributed to the logout
    // assertions further down.
    await test.step('Log in', async () => {
      await loginPage.goto();
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
      await page.waitForURL('/Home', { timeout: 20_000 });
      await expect(homePage.header).toBeVisible();
    }, { timeout: 90_000 });

    await test.step('Log out via the user-info fly-out', async () => {
      await homePage.logout();
      // Post-logout render latency can spike under the shared account's
      // accumulated activity across a full cross-browser run — same class of
      // occasional slow response documented in login.spec.ts's rate-limit note.
      await expect(loginPage.emailInput).toBeVisible({ timeout: 25_000 });
    }, { timeout: 30_000 });

    await test.step('Back button must not restore the authenticated session', async () => {
      // Case 6844: "User stays on the Login page when clicking Back after
      // successful logout" — we were already on the login page after the
      // previous step, so Back is expected to change nothing. Use 'commit' —
      // after logout the cached /Home no longer fully loads (no session), so
      // the default 'load' wait would hang; we only need the navigation to
      // land, since nothing past that point should actually happen.
      await page.goBack({ waitUntil: 'commit' });
      await expect(loginPage.emailInput).toBeVisible({ timeout: 25_000 });
      await expect(homePage.header).toBeHidden();
    }, { timeout: 30_000 });
  });
});
