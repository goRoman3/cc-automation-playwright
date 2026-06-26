import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login/LoginPage';

// Both resolved from env only — no hardcoded fallbacks that could end up in git.
// Tests in 3.5 and 3.6 skip when either var is absent.
const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

// Use a non-existent account for all wrong-credential tests so the real
// account is never at risk of being locked out from too many bad attempts.
const FAKE_EMAIL = 'no-such-user@nonexistent-callcabinet-test.invalid';
const WRONG_PASSWORD = 'definitely_wrong_password_xyz_123';

test.describe('Login page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  // ──────────────────────────────────────────────
  // 3.1 Required page elements
  // ──────────────────────────────────────────────
  test.describe('3.1 Required page elements', () => {
    test('page has correct title', async ({ page }) => {
      await expect(page).toHaveTitle('Smarsh Login');
    });

    test('email input is visible', async () => {
      await expect(loginPage.emailInput).toBeVisible();
    });

    test('password input is visible', async () => {
      await expect(loginPage.passwordInput).toBeVisible();
    });

    test('Login button is visible', async () => {
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('Forgot your password button is visible', async () => {
      await expect(loginPage.forgotPasswordButton).toBeVisible();
    });

    test('"or sign in with" section is visible', async () => {
      await expect(loginPage.ssoSection).toBeVisible();
    });

    test('SSO provider buttons are visible (3 buttons)', async () => {
      await expect(loginPage.ssoButtons).toHaveCount(3);
    });

    test('Terms & Conditions link is visible', async () => {
      await expect(loginPage.termsLink).toBeVisible();
    });

    test('Privacy Policy link is visible', async () => {
      await expect(loginPage.privacyLink).toBeVisible();
    });

    test('Support link is visible', async () => {
      await expect(loginPage.supportLink).toBeVisible();
    });

    test('brand heading "CallCabinet is now Smarsh" is visible', async () => {
      await expect(loginPage.brandHeading).toBeVisible();
    });
  });

  // ──────────────────────────────────────────────
  // 3.2 Input placeholders
  // ──────────────────────────────────────────────
  test.describe('3.2 Input placeholders', () => {
    test('email input shows placeholder "Email Address"', async ({ page }) => {
      await expect(page.getByPlaceholder('Email Address')).toBeVisible();
    });

    test('password input shows placeholder "Password"', async ({ page }) => {
      await expect(page.getByPlaceholder('Password')).toBeVisible();
    });

    test('placeholders disappear when user types', async () => {
      await loginPage.emailInput.fill('test@example.com');
      await expect(loginPage.emailInput).toHaveValue('test@example.com');

      await loginPage.passwordInput.fill('secret');
      await expect(loginPage.passwordInput).toHaveValue('secret');
    });
  });

  // ──────────────────────────────────────────────
  // 3.3 Password field validation
  // ──────────────────────────────────────────────
  test.describe('3.3 Password field validation', () => {
    test('password field is type="password" (masked)', async () => {
      await loginPage.passwordInput.waitFor({ state: 'visible' });
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('shows "Password is required." when submitting with empty password', async () => {
      await loginPage.emailInput.fill('valid@example.com');
      await loginPage.submitEmpty();
      await expect(loginPage.passwordRequiredError).toBeVisible();
      await expect(loginPage.passwordRequiredError).toHaveText('Password is required.');
    });

    test('shows error for wrong password', async () => {
      await loginPage.emailInput.fill(FAKE_EMAIL);
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      // "Invalid credentials" normally; "You've been locked out for security reasons" after rate-limit.
      // Both correctly indicate the login was rejected.
      await expect(loginPage.invalidCredentialsError).toBeVisible();
      await expect(loginPage.invalidCredentialsError).toContainText(
        /Invalid credentials|You've been locked out/
      );
    });

    test('does not navigate away from login page on wrong password', async ({ page }) => {
      await loginPage.emailInput.fill(FAKE_EMAIL);
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      await expect(loginPage.invalidCredentialsError).toBeVisible();
      await expect(page).toHaveURL('/');
    });

    // 6835 — a REAL valid email with a wrong password is rejected. Runs only when
    // credentials are configured; a single failed attempt per run is well below the
    // ~10-attempt lockout threshold (see case 6845).
    test('shows "Invalid credentials" for a valid email with a wrong password', async () => {
      test.skip(
        !VALID_EMAIL || !VALID_PASSWORD,
        'Set TEST_EMAIL and TEST_PASSWORD in .env to run this test',
      );
      await loginPage.emailInput.fill(VALID_EMAIL!);
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      await expect(loginPage.invalidCredentialsError).toBeVisible();
      await expect(loginPage.invalidCredentialsError).toContainText(
        /Invalid credentials|You've been locked out/
      );
    });
  });

  // ──────────────────────────────────────────────
  // 3.4 Email field validation
  // ──────────────────────────────────────────────
  test.describe('3.4 Email field validation', () => {
    test('shows "Email is required." when submitting with empty email', async () => {
      await loginPage.passwordInput.fill('somepassword');
      await loginPage.submitEmpty();
      await expect(loginPage.emailRequiredError).toBeVisible();
      await expect(loginPage.emailRequiredError).toHaveText('Email is required.');
    });

    test('shows both required errors when form is completely empty', async () => {
      await loginPage.submitEmpty();
      await expect(loginPage.emailRequiredError).toHaveText('Email is required.');
      await expect(loginPage.passwordRequiredError).toHaveText('Password is required.');
    });

    test('shows error for invalid email format', async () => {
      await loginPage.emailInput.fill('notanemail');
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      // Server returns "Invalid credentials" for unrecognised email formats.
      // May also return "You've been locked out" under IP rate-limiting — both confirm rejection.
      await expect(loginPage.invalidCredentialsError).toBeVisible();
      await expect(loginPage.invalidCredentialsError).toContainText(
        /Invalid credentials|You've been locked out/
      );
    });

    test('shows error for email without domain', async () => {
      await loginPage.emailInput.fill('user@');
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      await expect(loginPage.invalidCredentialsError).toBeVisible();
    });

    test('does not navigate away from login page on invalid email', async ({ page }) => {
      await loginPage.emailInput.fill('bademail');
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      await expect(page).toHaveURL('/');
    });

    // 6837 — non-existent (invalid) email with an arbitrary password is rejected.
    // Uses FAKE_EMAIL so the real account never accrues failed attempts.
    test('shows "Invalid credentials" for a non-existent email', async () => {
      await loginPage.emailInput.fill(FAKE_EMAIL);
      await loginPage.passwordInput.fill(WRONG_PASSWORD);
      await loginPage.loginButton.click();
      await expect(loginPage.invalidCredentialsError).toBeVisible();
      await expect(loginPage.invalidCredentialsError).toContainText(
        /Invalid credentials|You've been locked out/
      );
    });
  });

  // ──────────────────────────────────────────────
  // 3.5 Successful login
  // ──────────────────────────────────────────────
  test.describe('3.5 Successful login', () => {
    test.describe.configure({ mode: 'serial' });
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
      'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
    );

    test('redirects to /Home with valid credentials', async ({ page }) => {
      // login() handles the "already logged in on another computer" modal automatically
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
      await expect(page).toHaveURL('/Home', { timeout: 20_000 });
    });

    // 6831 — pressing Enter submits the form just like clicking Login.
    test('Enter key submits the login form', async ({ page }) => {
      await loginPage.emailInput.fill(VALID_EMAIL!);
      await loginPage.passwordInput.fill(VALID_PASSWORD!);
      await loginPage.passwordInput.press('Enter');

      // Same active-session modal handling as LoginPage.login().
      const modalVisible = await loginPage.alreadyLoggedInModal
        .waitFor({ state: 'visible', timeout: 4_000 })
        .then(() => true)
        .catch(() => false);
      if (modalVisible) {
        await loginPage.logOutOtherSessionButton.click();
      }

      await expect(page).toHaveURL('/Home', { timeout: 20_000 });
    });

    // 6843 — clicking the browser Back button after login keeps the user signed in.
    test('browser Back after login keeps the session', async ({ page }) => {
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
      await page.waitForURL('/Home', { timeout: 20_000 });

      await page.goBack();

      // Must not be bounced to the login form — the session stays active.
      await expect(loginPage.emailInput).toBeHidden();
      await expect(page).not.toHaveURL('/');
    });

    test('login page is not accessible after successful login', async ({ page }) => {
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
      await page.waitForURL('/Home', { timeout: 20_000 });
      await page.goto('/');
      // Authenticated users should be redirected away from the login page
      await expect(page).not.toHaveURL('/', { timeout: 10_000 });
    });

    // ─── modal edge case ───────────────────────
    // Uses two browser contexts: Session A stays logged in while Session B
    // triggers the "already logged in" modal from a fresh context.
    test('"Already logged in" modal appears when account has an active session', async ({ browser }) => {
      // Session A: establish an active session via the beforeEach page
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);

      // Session B: fresh context — logging in with same credentials triggers the modal
      const ctxB = await browser.newContext();
      try {
        const pageB = await ctxB.newPage();
        const loginB = new LoginPage(pageB);
        await loginB.goto();
        await loginB.emailInput.fill(VALID_EMAIL!);
        await loginB.passwordInput.fill(VALID_PASSWORD!);
        await loginB.loginButton.click();

        await expect(loginB.alreadyLoggedInModal).toBeVisible({ timeout: 8_000 });
        await expect(loginB.alreadyLoggedInModal).toContainText(/already logged in/i);
        await expect(loginB.alreadyLoggedInModal).toContainText('You are already logged in on another computer');
        await expect(loginB.logOutOtherSessionButton).toBeVisible();
        await expect(loginB.cancelSessionButton).toBeVisible();
      } finally {
        await ctxB.close();
      }
    });

    test('"Log out other session" in modal completes login successfully', async ({ browser }) => {
      // Session A: establish an active session via the beforeEach page
      await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);

      // Session B: trigger modal then accept to force login
      const ctxB = await browser.newContext();
      try {
        const pageB = await ctxB.newPage();
        const loginB = new LoginPage(pageB);
        await loginB.goto();
        await loginB.emailInput.fill(VALID_EMAIL!);
        await loginB.passwordInput.fill(VALID_PASSWORD!);
        await loginB.loginButton.click();

        await loginB.alreadyLoggedInModal.waitFor({ state: 'visible', timeout: 8_000 });
        await loginB.logOutOtherSessionButton.click();
        await expect(pageB).toHaveURL('/Home', { timeout: 20_000 });
      } finally {
        await ctxB.close();
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3.6 Already-logged-in modal — Cancel then Accept flow
  //
  // Uses two independent browser contexts to simulate the real-world scenario:
  //   • Context A  — already logged in, stays open on /Home
  //   • Context B  — "new browser" that triggers the modal
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('3.6 Already-logged-in modal — Cancel and Accept flow', () => {
    test.describe.configure({ mode: 'serial' });
    test.skip(
      !process.env.TEST_EMAIL || !process.env.TEST_PASSWORD,
      'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
    );

    test(
      'Cancel closes the modal without logging in; re-submitting and accepting forces login',
      async ({ browser }) => {
        // ── Session A: establish an active session and stay on /Home ──────────
        const ctxA = await browser.newContext();
        const pageA = await ctxA.newPage();
        const loginA = new LoginPage(pageA);
        await loginA.goto();
        await loginA.login(VALID_EMAIL!, VALID_PASSWORD!);
        await expect(pageA).toHaveURL('/Home', { timeout: 20_000 });

        const ctxB = await browser.newContext();
        try {
          // ── Session B: open login in a fresh browser context ──────────────
          const pageB = await ctxB.newPage();
          const loginB = new LoginPage(pageB);
          await loginB.goto();

          // Submit credentials — Session A is active, modal must appear
          await loginB.emailInput.fill(VALID_EMAIL!);
          await loginB.passwordInput.fill(VALID_PASSWORD!);
          await loginB.loginButton.click();
          await expect(loginB.alreadyLoggedInModal).toBeVisible({ timeout: 8_000 });
          await expect(loginB.alreadyLoggedInModal).toContainText(/already logged in/i);

          // ── Step 1: Cancel ────────────────────────────────────────────────
          // Modal closes; Session B remains on the login page, not authenticated
          await loginB.cancelSessionButton.click();
          await expect(loginB.alreadyLoggedInModal).not.toBeVisible();
          await expect(pageB).toHaveURL('/');
          await expect(loginB.emailInput).toBeVisible();
          await expect(loginB.loginButton).toBeVisible();

          // ── Step 2: Re-submit credentials — modal must reappear ───────────
          // Session A is still alive, so the server triggers the modal again
          await loginB.emailInput.fill(VALID_EMAIL!);
          await loginB.passwordInput.fill(VALID_PASSWORD!);
          await loginB.loginButton.click();
          await expect(loginB.alreadyLoggedInModal).toBeVisible({ timeout: 8_000 });

          // ── Step 3: Accept — force-login Session B, redirect to /Home ─────
          await loginB.logOutOtherSessionButton.click();
          await expect(pageB).toHaveURL('/Home', { timeout: 20_000 });
        } finally {
          await ctxB.close();
          await ctxA.close();
        }
      }
    );
  });
});
