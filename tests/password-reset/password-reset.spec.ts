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
 * ⚠️ BLOCKED (2026-06-16): the forgot-password reCAPTCHA v3 returns "Captcha
 * validation failed" and no email is sent — even in --headed mode. This whole
 * suite (incl. the rotation + 6870 additions below) cannot run until staging
 * whitelists the test IP/account. Once unblocked, a single `npm run test:reset`
 * validates the flow and exposes the reset-page DOM needed for cases 23258/23262.
 *
 * Required .env variables:
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *   TEST_EMAIL (or TEST_USERS_JSON with alias "resetUser")
 *   TEST_PASSWORD, TEST_NEW_PASSWORD
 */

import { test, expect } from '../../fixtures/fixtures';
import { waitForPasswordResetLink } from '../../helpers/gmailAgent';
import { getTestUser, type TestUser } from '../../helpers/testUsers';
import { generateValidPassword, persistEnvVar } from '../../helpers/passwordRotation';

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

// ── Password rotation ────────────────────────────────────────────────────────
// Generate a FRESH valid password each run so it never collides with the
// previous-ten history (the app rejects reused passwords). After a confirmed
// reset we persist it back to .env as TEST_PASSWORD, and capture the working
// password beforehand to prove the OLD one stops working (case 6870).
const newPassword = generateValidPassword();
const oldPassword = testUser.password;

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
  test('submits forgot-password form and receives reset email', async ({ page, loginPage, forgotPasswordPage }) => {
    await loginPage.goto();

    await loginPage.forgotPasswordButton.click();
    await expect(forgotPasswordPage.container).toBeVisible({ timeout: 5_000 });
    await expect(forgotPasswordPage.promptText).toContainText(/enter your registered email/i);

    await forgotPasswordPage.fillEmail(testUser.email);
    await forgotPasswordPage.submit();

    // Wait for the form to respond (reCAPTCHA v3 scoring happens server-side)
    await page.waitForTimeout(3_000);

    // Log the actual prompt text to diagnose what the app shows after submit
    const actualText = await forgotPasswordPage.promptText.textContent();
    console.log('[DEBUG] promptText after submit:', actualText);

    // reCAPTCHA: if the app returns "Captcha validation failed", re-run with --headed.
    await expect(forgotPasswordPage.promptText).not.toContainText(/captcha validation failed/i, {
      timeout: 5_000,
    });

    await expect(forgotPasswordPage.promptText).toContainText(
      /email.*sent|check your email|instructions.*sent|reset.*link|password.*reset/i,
      { timeout: 15_000 },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Steps 4-11: Open reset link → set new password → verify success
  // ──────────────────────────────────────────────────────────────────────────
  test('opens reset link, sets new password, and verifies success', async ({ resetPasswordPage }) => {
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
    await resetPasswordPage.resetPassword(newPassword);

    await expect(resetPasswordPage.successMessage).toBeVisible({ timeout: 15_000 });

    // Rotation: persist the new password so this and future runs use it. Only
    // after the reset is confirmed successful, to avoid desyncing .env from the
    // real account state.
    await persistEnvVar('TEST_PASSWORD', newPassword);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Steps 12-13: Log in with new password → verify authenticated area
  // ──────────────────────────────────────────────────────────────────────────
  test('logs in with the new password after reset', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(testUser.email, newPassword);

    await expect(page).toHaveURL('/Home', { timeout: 20_000 });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6870 — the OLD password must no longer work after the reset.
  // ──────────────────────────────────────────────────────────────────────────
  test('old password no longer works after reset', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.emailInput.fill(testUser.email);
    await loginPage.passwordInput.fill(oldPassword); // pre-rotation password
    await loginPage.loginButton.click();

    await expect(loginPage.invalidCredentialsError).toBeVisible({ timeout: 15_000 });
    await expect(loginPage.invalidCredentialsError).toContainText(
      /Invalid credentials|You've been locked out/,
    );
  });
});
