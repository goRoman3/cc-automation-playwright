import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login/LoginPage';

test.describe('Smoke — application reachability', () => {
  test('login page loads and has correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Smarsh Login');
  });

  test('login page exposes the login form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('navigating directly to /Home without session shows login form', async ({ page }) => {
    // This is an SPA: /Home is served but the app renders the login gate
    // rather than a server-side redirect. We assert the login inputs are
    // present, which is the meaningful auth-guard check here.
    await page.goto('/Home');
    const loginPage = new LoginPage(page);
    await expect(loginPage.emailInput).toBeVisible({ timeout: 10_000 });
    await expect(loginPage.loginButton).toBeVisible();
  });
});
