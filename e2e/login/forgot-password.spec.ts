import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login/LoginPage';
import { ForgotPasswordPage } from '../../pages/login/ForgotPasswordPage';

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
  let loginPage: LoginPage;
  let forgot: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    forgot = new ForgotPasswordPage(page);
    await loginPage.goto();
    await loginPage.forgotPasswordButton.click();
    await expect(forgot.container).toBeVisible();
  });

  test('6848 required elements are present on the Reset Password screen', async ({ page }) => {
    // Core overlay controls
    await expect(forgot.emailInput).toBeVisible();
    await expect(forgot.submitButton).toBeVisible();
    await expect(forgot.closeButton).toBeVisible();

    // Branding + footer links + copyright
    await expect(loginPage.logo).toBeVisible();
    await expect(loginPage.termsLink).toBeVisible();
    await expect(loginPage.privacyLink).toBeVisible();
    await expect(loginPage.supportLink).toBeVisible();
    await expect(page.getByText(/©|copyright/i).first()).toBeVisible();
  });

  test('6848 Close button returns to the login page', async () => {
    await forgot.close();
    await expect(forgot.container).not.toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('23257 invalid email shows a validation error', async () => {
    // NEEDS INVESTIGATION (staging, 2026-06-16): submitting an invalid email in
    // headless renders the reCAPTCHA iframe and an empty `alert` region instead of
    // the expected "Please enter a valid e-mail address" text — the documented
    // reCAPTCHA constraint. Re-run headed (npm run test:reset style) and confirm the
    // real validation-message selector before enabling. See Azure case 23257.
    test.fixme(true, 'Validation message not surfaced in headless; needs headed run + selector check');

    // String with no "@"/domain — fails the email pattern.
    await forgot.fillEmail('userdomain.com');
    await forgot.submit();
    await expect(forgot.emailValidationError).toBeVisible();
  });
});
