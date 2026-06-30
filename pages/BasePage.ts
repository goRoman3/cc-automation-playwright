import { type Page } from '@playwright/test';

/**
 * Shared base for all Page Objects.
 *
 * Holds the Playwright `page` handle and the small set of navigation/wait
 * helpers that would otherwise be duplicated across pages. Page Objects extend
 * this and add their own locators and actions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigates to a path relative to `baseURL` (defaults to the app root). */
  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  /** Current page URL. */
  url(): string {
    return this.page.url();
  }
}
