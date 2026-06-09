/**
 * Password reset end-to-end test.
 *
 * Flow:
 *   1. Open login page → click "Forgot your password?"
 *   2. Enter test user email → SUBMIT (reCAPTCHA must pass — run --headed or
 *      ask staging to whitelist the test IP / test account)
 *   3. Poll Gmail API for the reset email → extract the reset link
 *   4. Open the reset link → fill new password → submit
 *   5. Verify success → log in with the new password → verify /Home
 *
 * Tags: @email @integration @external
 * Not included in default smoke suite (requires Gmail credentials + headed run).
 *
 * Required .env variables:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *   TEST_EMAIL (or TEST_USERS_JSON with alias "resetUser")
 *   TEST_PASSWORD, TEST_NEW_PASSWORD
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { ForgotPasswordPage } from '../../pages/ForgotPasswordPage';
import { ResetPasswordPage } from '../../pages/ResetPasswordPage';
import { waitForPasswordResetLink } from '../../helpers/gmailAgent';
import { getTestUser, type TestUser } from '../../helpers/testUsers';

// ── Test user ──────────────────────────────────────────────────────────────
// C2 fix: never throw at module load — tests skip gracefully via beforeEach
// when credentials are absent instead of crashing the entire worker.
let testUser: TestUser;
try {
  testUser = getTestUser('resetUser');
} catch {
  try {
    testUser = getTestUser('default');
  } catch {
    testUser = { alias: 'unconfigured', email: '', password: '', newPassword: null };
  }
}

const APP_NAME = 'Smarsh';

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Password reset @email @integration', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    // C2 fix: skip if credentials were not configured rather than crashing
    if (!testUser.email || !testUser.password) {
      test.skip(
        true,
        'No test credentials configured. Set TEST_EMAIL + TEST_PASSWORD or TEST_USERS_JSON.',
      );
    }

    const required = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'] as const;
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
      test.skip(true, `Missing Gmail env vars: ${missing.join(', ')}. See README.`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1-3: Trigger reset email and obtain link
  // ──────────────────────────────────────────────────────────────────────────
  test('submits forgot-password form and receives reset email', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const forgotPasswordPage = new ForgotPasswordPage(page);

    await loginPage.goto();

    await loginPage.forgotPasswordButton.click();
    await expect(forgotPasswordPage.container).toBeVisible({ timeout: 5_000 });
    await expect(forgotPasswordPage.promptText).toContainText(/enter your registered email/i);

    await forgotPasswordPage.fillEmail(testUser.email);
    await forgotPasswordPage.submit();

    // reCAPTCHA: if the app returns "Captcha validation failed", re-run with --headed.
    await expect(forgotPasswordPage.promptText).not.toContainText(/captcha validation failed/i, {
      timeout: 8_000,
    });

    await expect(forgotPasswordPage.promptText).toContainText(
      /email.*sent|check your email|instructions.*sent|reset.*link/i,
      { timeout: 10_000 },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Steps 4-11: Open reset link → set new password → verify success
  // ──────────────────────────────────────────────────────────────────────────
  test('opens reset link, sets new password, and verifies success', async ({ page }) => {
    const { newPassword } = testUser;
    const resetPasswordPage = new ResetPasswordPage(page);

    if (!newPassword) {
      test.skip(true, 'TEST_NEW_PASSWORD (or newPassword in TEST_USERS_JSON) is not set.');
    }

    // Poll Gmail for the reset email (up to 90 seconds).
    // sentAfterMs defaults to Date.now() inside waitForPasswordResetLink so stale
    // emails from prior runs in the newer_than:10m window are ignored (C7 fix).
    const resetLink = await waitForPasswordResetLink({
      email: testUser.email,
      appName: APP_NAME,
      timeoutMs: 90_000,
    });

    expect(resetLink).toBeTruthy();
    expect(resetLink).toMatch(/https?:\/\//);

    await resetPasswordPage.goto(resetLink);

    await expect(resetPasswordPage.newPasswordInput).toBeVisible({ timeout: 10_000 });
    await resetPasswordPage.resetPassword(newPassword!);

    await expect(resetPasswordPage.successMessage).toBeVisible({ timeout: 15_000 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Steps 12-13: Log in with new password → verify authenticated area
  // ──────────────────────────────────────────────────────────────────────────
  test('logs in with the new password after reset', async ({ page }) => {
    const { newPassword } = testUser;
    const loginPage = new LoginPage(page);

    if (!newPassword) {
      test.skip(true, 'TEST_NEW_PASSWORD (or newPassword in TEST_USERS_JSON) is not set.');
    }

    await loginPage.goto();
    await loginPage.login(testUser.email, newPassword!);

    await expect(page).toHaveURL('/Home', { timeout: 20_000 });
  });
});
