import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login/LoginPage';
import { ForgotPasswordPage } from '../../pages/login/ForgotPasswordPage';

/**
 * Azure Login case 6826 — Verify that all links on the Login page have proper
 * redirects.
 *
 * For external links we assert the href target (documented in case 6826) instead
 * of navigating away — clicking through would leave the app and, for SSO links,
 * hit external identity providers that are out of AQA scope. The internal
 * "Forgot your password?" control is verified by the overlay it opens.
 */
test.describe('6826 Login page links redirect correctly', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('Terms & Conditions link points to the terms page', async () => {
    await expect(loginPage.termsLink).toHaveAttribute('href', /terms-and-conditions/);
  });

  test('Privacy Policy link points to the privacy page', async () => {
    await expect(loginPage.privacyLink).toHaveAttribute('href', /privacy-policy/);
  });

  test('Support link points to the support portal', async () => {
    // Azure case 6826 documents support.callcabinet.com, but the rebranded app
    // now links to the Smarsh support portal (central.smarsh.com). Asserting the
    // live target; flag to QA to refresh the manual case.
    await expect(loginPage.supportLink).toHaveAttribute('href', /smarsh\.com/);
  });

  test('"visit our Website" link points to callcabinet.com', async ({ page }) => {
    const websiteLink = page.getByRole('link', { name: /visit our Website/i });
    await expect(websiteLink).toHaveAttribute('href', /callcabinet\.com/);
  });

  test('"Forgot your password?" opens the reset overlay', async ({ page }) => {
    const forgot = new ForgotPasswordPage(page);
    await loginPage.forgotPasswordButton.click();
    await expect(forgot.container).toBeVisible();
    await expect(forgot.emailInput).toBeVisible();
  });
});
