import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { AlreadyLoggedInModal } from './AlreadyLoggedInModal';

export class LoginPage extends BasePage {
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

  // "Already logged in on another computer" modal (its own page object)
  readonly modal: AlreadyLoggedInModal;

  constructor(page: Page) {
    super(page);
    this.modal = new AlreadyLoggedInModal(page);

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
  }

  async submitEmpty() {
    await this.loginButton.click();
  }

  /**
   * Fills credentials and clicks Login, forcing the session through to /Home.
   *
   * The shared test account allows a single active session, so a login while
   * another session is still alive surfaces the "already logged in on another
   * computer" modal. Closing a browser context elsewhere does NOT end its
   * server-side session, so the modal can appear even on the first login of a
   * run. We handle it by clicking "Log out other session" (force login) and,
   * because that occasionally bounces back to the login form instead of
   * completing, retry the submit until we actually land on /Home.
   */
  async login(email: string, password: string) {
    await this.submitCredentials(email, password);
    await this.completeLogin(email, password);
  }

  /**
   * Completes a login after credentials have already been submitted — by the
   * Login button, the Enter key, or because a test left the active-session modal
   * on screen. Handles the modal (force-logout of the other session) and, since
   * a force-logout sometimes bounces back to the login form instead of finishing,
   * re-submits the credentials until we land on /Home. Re-submitting always uses
   * the Login button — the submit mechanism only matters for the first attempt.
   */
  async completeLogin(email: string, password: string) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.page.url().includes('/Home')) return;
      await this.clearActiveSessionModal();
      if (this.page.url().includes('/Home')) return;
      // No modal / bounced back to the form — submit again to complete login.
      await this.submitCredentials(email, password);
    }

    // Never reached /Home — let the caller's assertion report the real state.
    await this.page.waitForURL('/Home', { timeout: 20_000 });
  }

  /** Fills credentials and clicks Login. Waits out any leftover modal overlay
   *  first so it can't intercept the click. */
  private async submitCredentials(email: string, password: string) {
    await this.modal.waitForOverlayGone();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Drives the "already logged in on another computer" modal to completion.
   * Clicks "Log out other session" (never Login — that would be intercepted by
   * the modal overlay) and waits for the modal to clear; behind it the server
   * logs the other session out then logs this one in, which is slow. The account
   * can hold several stale sessions, so the modal may reappear — handle each in
   * turn until we land on /Home, bounce back to the form, or it stops appearing.
   */
  private async clearActiveSessionModal() {
    for (let i = 0; i < 5; i++) {
      const outcome = await Promise.race([
        this.modal.root
          .waitFor({ state: 'visible', timeout: 15_000 })
          .then(() => 'modal' as const)
          .catch(() => 'none' as const),
        this.page
          .waitForURL('/Home', { timeout: 15_000 })
          .then(() => 'home' as const)
          .catch(() => 'none' as const),
      ]);

      if (outcome === 'home' || this.page.url().includes('/Home')) return;
      if (outcome !== 'modal') return; // back on the form — caller re-submits

      await this.modal.logOutOtherSession();
      // Let this modal instance resolve: either it clears (login completes or
      // bounces) or it is replaced by the next stale session's modal.
      await this.modal.waitUntilHidden();
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
