import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the password reset form.
 *
 * Opened via the link extracted from the password reset email.
 * URL pattern: https://<host>/reset-password?token=<token>
 *
 * Selectors are based on the app's naming convention (Kendo UI + React CSS modules)
 * and must be verified against a real reset link. Use Playwright codegen to confirm.
 */
export class ResetPasswordPage extends BasePage {
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.newPasswordInput = page.getByPlaceholder(/new password/i);
    this.confirmPasswordInput = page.getByPlaceholder(/confirm password/i);
    this.submitButton = page.getByRole('button', { name: /submit|save|reset|set password/i });
    this.successMessage = page
      .locator('[class*=success],[class*=confirm],[role=alert],[class*=message]')
      .filter({ hasText: /password.*reset|successfully|updated/i });
  }

  async goto(resetLink: string): Promise<void> {
    await this.page.goto(resetLink, { waitUntil: 'domcontentloaded' });
  }

  async fillNewPassword(password: string): Promise<void> {
    await this.newPasswordInput.fill(password);
  }

  async fillConfirmPassword(password: string): Promise<void> {
    await this.confirmPasswordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async resetPassword(password: string): Promise<void> {
    await this.fillNewPassword(password);
    await this.fillConfirmPassword(password);
    await this.submit();
  }
}
