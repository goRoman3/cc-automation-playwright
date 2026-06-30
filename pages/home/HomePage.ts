import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the authenticated portal shell (post-login).
 *
 * Verified selectors (staging 2026-06-16):
 *   - Header:        [class*=main-layout_headerContainer]
 *   - User-info menu:[aria-label="user info"] — hover reveals Reset Password / Logout
 *   - Logout action: [aria-label="Logout"]
 *   - Left nav links:a[aria-label="<Item>"] (Home, Call Listing, Reporting, …)
 *
 * The Reset Password / Logout actions live inside the "user info" fly-out and are
 * revealed on hover, so logout() hovers the trigger before clicking.
 */
export class HomePage extends BasePage {
  readonly header: Locator;
  readonly userInfoMenu: Locator;
  readonly logoutButton: Locator;
  readonly resetPasswordButton: Locator;
  readonly homeNavLink: Locator;
  readonly callListingNavLink: Locator;
  /** "Add Demo Call" — only present in the profile fly-out for users that can
   *  seed the demo call (e.g. the TEST_CC user). */
  readonly addDemoCallButton: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.locator('[class*=main-layout_headerContainer]');
    this.userInfoMenu = page.locator('[aria-label="user info"]');
    this.logoutButton = page.locator('[aria-label="Logout"]');
    this.resetPasswordButton = page.locator('[aria-label="Reset Password"]');
    this.homeNavLink = page.locator('a[aria-label="Home"]');
    this.callListingNavLink = page.locator('a[aria-label="Call Listing"]');
    this.addDemoCallButton = page.getByRole('button', { name: 'Add Demo Call' });
  }

  /** Opens the profile fly-out and clicks "Add Demo Call" to seed the demo call.
   *  Available only for users that expose the action. */
  async addDemoCall(): Promise<void> {
    await this.userInfoMenu.hover();
    await this.addDemoCallButton.click();
  }

  /** True when the authenticated shell is rendered. */
  async isLoaded(): Promise<boolean> {
    return this.header.isVisible();
  }

  /** Opens the user-info fly-out and clicks Logout. */
  async logout(): Promise<void> {
    await this.userInfoMenu.hover();
    await this.logoutButton.click();
  }
}
