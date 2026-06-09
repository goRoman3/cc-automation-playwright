import { type Page, type Locator } from '@playwright/test';

/**
 * Page object for the "Forgot your password?" modal overlay.
 *
 * Triggered by clicking the "Forgot your password?" button on the login page.
 * The form renders as a full-screen overlay (does NOT navigate to a new URL).
 *
 * Verified selectors (staging 2026-06-09):
 *   - Container:    [class*=forgot-password_container]
 *   - Email input:  #email scoped to the container (login form also has #email — C3 fix)
 *   - SUBMIT:       button[role] "SUBMIT"
 *   - CLOSE:        button[role] "CLOSE"
 *   - Status text:  [class*=forgot-password_enterPrompt]
 *
 * reCAPTCHA: in headless mode this returns "Captcha validation failed, try again later".
 * Run password-reset tests with --headed, or request staging to whitelist the test IP.
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly container: Locator;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly closeButton: Locator;
  readonly promptText: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('[class*=forgot-password_container]');
    // Scoped to container to avoid Playwright strict-mode violation when the login
    // form's #email is also in the DOM behind the overlay (C3 fix).
    this.emailInput = this.container.locator('#email');
    this.submitButton = page.getByRole('button', { name: 'SUBMIT' });
    this.closeButton = page.getByRole('button', { name: 'CLOSE' });
    this.promptText = page.locator('[class*=forgot-password_enterPrompt]');
  }

  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }
}
