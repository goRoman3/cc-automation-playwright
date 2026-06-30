import { type Page, type Locator } from '@playwright/test';

/**
 * "You are already logged in on another computer" modal.
 *
 * Surfaces on login when the account already has an active session — the app
 * permits a single active session per account. Accepting it
 * ("Log out other session") drops the other session; behind the scenes the
 * server logs the other session out and then logs this one in, which is slow.
 * Dismissing it ("Cancel") keeps the other session and leaves this one on the
 * login form.
 *
 * Verified selectors (staging 2026-06-29):
 *   - Popup:    [class*=modal_basicPopup]
 *   - Overlay:  [class*=modal_fullScreen] / [class*=modal_background]
 *   - Buttons:  role=button "Log out other session" / "Cancel"
 */
export class AlreadyLoggedInModal {
  /** The popup itself — assert visibility/text against this. */
  readonly root: Locator;
  /** Full-screen wrapper + dimming layer behind the popup. It lingers for a beat
   *  after the popup closes and, while present, intercepts clicks on the login
   *  form, so callers wait for it to detach before re-submitting. */
  readonly overlay: Locator;
  readonly logOutOtherSessionButton: Locator;
  readonly cancelSessionButton: Locator;

  constructor(page: Page) {
    this.root = page.locator('[class*=modal_basicPopup]');
    this.overlay = page.locator('[class*=modal_fullScreen], [class*=modal_background]');
    this.logOutOtherSessionButton = page.getByRole('button', { name: 'Log out other session' });
    this.cancelSessionButton = page.getByRole('button', { name: 'Cancel' });
  }

  isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }

  /** Resolves true once the popup is visible, false if it does not appear in time. */
  async waitUntilVisible(timeout = 15_000): Promise<boolean> {
    return this.root
      .waitFor({ state: 'visible', timeout })
      .then(() => true)
      .catch(() => false);
  }

  /** Waits for the popup to disappear (best-effort; never throws). */
  async waitUntilHidden(timeout = 35_000): Promise<void> {
    await this.root.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /** Waits for the dimming overlay to detach so the form is clickable again. */
  async waitForOverlayGone(timeout = 10_000): Promise<void> {
    await this.overlay.waitFor({ state: 'hidden', timeout }).catch(() => {});
  }

  /** Accept: drop the other active session and force this login through. */
  async logOutOtherSession(): Promise<void> {
    await this.logOutOtherSessionButton.click();
  }

  /** Dismiss: keep the other session; this one stays on the login form. */
  async cancel(): Promise<void> {
    await this.cancelSessionButton.click();
  }
}
