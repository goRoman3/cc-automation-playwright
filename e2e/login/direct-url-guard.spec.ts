import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login/LoginPage';
import { PROTECTED_ROUTES } from '../fixtures/protected-routes';

/**
 * Azure Login case 6875 — Verify the impossibility of reaching the system with
 * direct URLs as an unauthorized user.
 *
 * Each protected route, when opened without a session, must show the login form.
 * We assert the login form is present rather than checking the URL: the SPA guard
 * renders the login screen in place and preserves the requested path (verified on
 * staging 2026-06-16 — e.g. /Home keeps its URL while showing the login form), so
 * the login form is the reliable access-denied signal.
 */
test.describe('6875 Unauthorized direct-URL access is blocked', () => {
  test.beforeEach(async ({ context }) => {
    // Guarantee an unauthenticated state for every route check.
    await context.clearCookies();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`redirects to login when opening ${route}`, async ({ page }) => {
      const loginPage = new LoginPage(page);

      await page.goto(route);

      // Login form is shown → protected content was not rendered (access denied).
      await expect(loginPage.emailInput).toBeVisible({ timeout: 15_000 });
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });
  }
});
