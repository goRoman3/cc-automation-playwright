import { test, expect } from '@playwright/test';
import { LoginPage } from './LoginPage';
import { HomePage } from '../home/HomePage';

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
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  test('Back button after logout stays on the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page);

    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await expect(homePage.header).toBeVisible();

    // Log out via the user-info fly-out.
    await homePage.logout();
    await expect(loginPage.emailInput).toBeVisible({ timeout: 15_000 });

    // Back button must not restore the authenticated session.
    await page.goBack();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(homePage.header).toBeHidden();
  });
});
