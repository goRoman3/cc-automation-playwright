import { test, expect } from '../../fixtures/fixtures';

/**
 * Azure Login cases on the "Forgot your password?" overlay:
 *   - 6848  Required elements on the Reset Password screen
 *   - 23257 Email-field validation when resetting the password
 *
 * The overlay renders in-place (no navigation). Element checks need no submit and
 * run headless; the validation check submits an invalid email, which is rejected
 * client-side before reCAPTCHA.
 */
test.describe('Forgot password overlay', () => {
  test.beforeEach(async ({ loginPage, forgotPasswordPage }) => {
    await loginPage.goto();
    await loginPage.forgotPasswordButton.click();
    await expect(forgotPasswordPage.container).toBeVisible();
  });

  test('6848 required elements are present on the Reset Password screen', async ({ page, loginPage, forgotPasswordPage }) => {
    // Core overlay controls
    await expect(forgotPasswordPage.emailInput).toBeVisible();
    await expect(forgotPasswordPage.submitButton).toBeVisible();
    await expect(forgotPasswordPage.closeButton).toBeVisible();

    // Branding + footer links + copyright
    await expect(loginPage.logo).toBeVisible();
    await expect(loginPage.termsLink).toBeVisible();
    await expect(loginPage.privacyLink).toBeVisible();
    await expect(loginPage.supportLink).toBeVisible();
    await expect(page.getByText(/©|copyright/i).first()).toBeVisible();
  });

  test('6848 Close button returns to the login page', async ({ loginPage, forgotPasswordPage }) => {
    await forgotPasswordPage.close();
    await expect(forgotPasswordPage.container).not.toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('23257 invalid email shows a validation error', async ({ forgotPasswordPage }) => {
    // NEEDS INVESTIGATION (staging, 2026-06-16): submitting an invalid email in
    // headless renders the reCAPTCHA iframe and an empty `alert` region instead of
    // the expected "Please enter a valid e-mail address" text — the documented
    // reCAPTCHA constraint. Re-run headed (npm run test:reset style) and confirm the
    // real validation-message selector before enabling. See Azure case 23257.
    test.fixme(true, 'Validation message not surfaced in headless; needs headed run + selector check');

    // String with no "@"/domain — fails the email pattern.
    await forgotPasswordPage.fillEmail('userdomain.com');
    await forgotPasswordPage.submit();
    await expect(forgotPasswordPage.emailValidationError).toBeVisible();
  });
});
