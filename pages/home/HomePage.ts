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
  /** Top-nav button that opens the Azure API Management developer portal
   *  (see {@link openDeveloperPortal}). Confirmed present for the TEST_CC
   *  user/company (2026-08-25); not verified for every account. */
  readonly developmentButton: Locator;
  /** "Action Required: API Platform Update" announcement modal — observed
   *  (2026-08-25) popping up on a fresh Home load and blocking clicks on
   *  the top nav (its full-screen overlay intercepts pointer events) until
   *  dismissed. See {@link dismissAnnouncementModal}. */
  readonly announcementModalCloseButton: Locator;

  constructor(page: Page) {
    super(page);
    this.header = page.locator('[class*=main-layout_headerContainer]');
    this.userInfoMenu = page.locator('[aria-label="user info"]');
    this.logoutButton = page.locator('[aria-label="Logout"]');
    this.resetPasswordButton = page.locator('[aria-label="Reset Password"]');
    this.homeNavLink = page.locator('a[aria-label="Home"]');
    this.callListingNavLink = page.locator('a[aria-label="Call Listing"]');
    this.addDemoCallButton = page.getByRole('button', { name: 'Add Demo Call' });
    this.developmentButton = page.getByRole('button', { name: 'Development' });
    this.announcementModalCloseButton = page.getByRole('button', { name: 'Close modal' });
  }

  /** Dismisses the "Action Required: API Platform Update" announcement
   *  modal if it's currently showing — a no-op otherwise. Call before any
   *  top-nav interaction that a stray modal overlay could block. */
  async dismissAnnouncementModal(): Promise<void> {
    if (await this.announcementModalCloseButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await this.announcementModalCloseButton.click();
    }
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

  /**
   * Clicks "Development" and returns the new browser **tab** (not a new
   * context) that the Azure API Management developer portal opens in via an
   * SSO redirect. Caller is expected to wrap the result in
   * `DeveloperPortalPage` (pages/dev-portal), which handles the portal's own
   * load quirks.
   */
  async openDeveloperPortal(): Promise<Page> {
    await this.dismissAnnouncementModal();
    const popupPromise = this.page.context().waitForEvent('page', { timeout: 25_000 });
    await this.developmentButton.click();
    const portal = await popupPromise;
    await portal.waitForLoadState('domcontentloaded');
    return portal;
  }
}
