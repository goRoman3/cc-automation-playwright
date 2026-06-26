import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  // Inputs
  readonly emailInput: Locator;
  readonly passwordInput: Locator;

  // Buttons
  readonly loginButton: Locator;
  readonly forgotPasswordButton: Locator;

  // Validation messages
  readonly emailRequiredError: Locator;
  readonly passwordRequiredError: Locator;
  readonly invalidCredentialsError: Locator;

  // Page elements
  readonly logo: Locator;
  readonly brandHeading: Locator;
  readonly ssoSection: Locator;
  readonly ssoButtons: Locator;
  readonly languageSelector: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;
  readonly supportLink: Locator;

  // "Already logged in" modal
  readonly alreadyLoggedInModal: Locator;
  readonly logOutOtherSessionButton: Locator;
  readonly cancelSessionButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');

    this.loginButton = page.getByRole('button', { name: 'Login' });
    this.forgotPasswordButton = page.getByRole('button', { name: 'Forgot your password?' });

    // Kendo UI required-field errors (stable class)
    this.emailRequiredError = page.locator('.k-form-error').first();
    this.passwordRequiredError = page.locator('.k-form-error').last();

    // Server-side error shown after failed submit
    this.invalidCredentialsError = page.locator('[class*=errorText]');

    this.logo = page.locator('[class*=logo]').first();
    this.brandHeading = page.getByRole('heading', { name: /CallCabinet is now Smarsh/i });
    this.ssoSection = page.getByText('or sign in with');
    this.ssoButtons = page.locator('[class*=social-sign-in_container]');
    this.languageSelector = page.locator('.k-input-button[aria-label="select"]');

    this.termsLink = page.getByRole('link', { name: 'Terms & Conditions' });
    this.privacyLink = page.getByRole('link', { name: 'Privacy Policy' });
    this.supportLink = page.getByRole('link', { name: 'Support' });

    // Already-logged-in modal (appears when the account has an active session elsewhere)
    this.alreadyLoggedInModal = page.locator('[class*=modal_basicPopup]');
    this.logOutOtherSessionButton = page.getByRole('button', { name: 'Log out other session' });
    this.cancelSessionButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async submitEmpty() {
    await this.loginButton.click();
  }

  /**
   * Fills credentials and clicks Login.
   * If the "already logged in on another computer" modal appears, clicks
   * "Log out other session" automatically so the login can complete.
   */
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    // After submit, one of two things happens: the app navigates straight into
    // the authenticated area, or the "already logged in on another computer"
    // modal blocks until the other session is dropped. Race both instead of
    // waiting a fixed window — a late modal used to slip past the old 4s timeout
    // and stall the login (waitForURL('/Home') would then time out).
    const outcome = await Promise.race([
      this.alreadyLoggedInModal
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => 'modal' as const)
        .catch(() => 'none' as const),
      this.page
        .waitForURL('/Home', { timeout: 20_000 })
        .then(() => 'home' as const)
        .catch(() => 'none' as const),
    ]);

    if (outcome === 'modal') {
      await this.logOutOtherSessionButton.click();
    }
  }

  /**
   * Clears all browser storage and cookies, then navigates back to the login
   * page. Use this in tests that need a clean unauthenticated state without
   * spinning up a second browser context.
   */
  async logout() {
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await this.page.context().clearCookies();
    await this.goto();
  }
}
