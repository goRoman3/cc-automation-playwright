import { type Page, type Locator, type FrameLocator, expect } from '@playwright/test';
import { HomePage } from '../home/HomePage';
import { ApiOperationPage } from './ApiOperationPage';

/**
 * The Azure API Management developer portal (`https://developer-portal.
 * callcabinet.com/`), reached from the authenticated app shell via the
 * "Development" top-nav button — never by direct navigation, since getting
 * there requires the SSO redirect the button triggers.
 *
 * The click opens a **new browser tab** (not a new context), so this page
 * object wraps that popup's own `Page` and is constructed via `openFrom()`
 * rather than through the shared fixtures (which only wire up the default
 * `page`, per the fixtures.ts convention for auxiliary tabs/contexts).
 *
 * The API catalogue is a custom widget rendered inside an iframe
 * (`cw-apis-table`) that sometimes hasn't finished mounting by first paint
 * and never recovers on its own — `waitForCatalogueLoaded()` reloads once as
 * a fallback if the rows don't show up in a generous window.
 */
export class DeveloperPortalPage {
  readonly apisHeading: Locator;
  readonly catalogueFrame: FrameLocator;
  /** Catalogue rows, including the "Name / Description" header row. */
  readonly catalogueRows: Locator;

  constructor(private readonly page: Page) {
    this.apisHeading = page.getByRole('heading', { name: 'APIs' });
    this.catalogueFrame = page.frameLocator('iframe[src*="cw-apis-table"]');
    this.catalogueRows = this.catalogueFrame.getByRole('row');
  }

  /**
   * Opens the portal via {@link HomePage.openDeveloperPortal} and waits for
   * its API catalogue to render.
   */
  static async openFrom(homePage: HomePage): Promise<DeveloperPortalPage> {
    const portal = await homePage.openDeveloperPortal();
    const developerPortal = new DeveloperPortalPage(portal);
    await developerPortal.waitForCatalogueLoaded();
    return developerPortal;
  }

  /** Underlying popup `Page`, for callers that need it directly (e.g. `expect(page).toHaveURL(...)`). */
  get raw(): Page {
    return this.page;
  }

  async waitForCatalogueLoaded(): Promise<void> {
    try {
      await expect(this.catalogueRows).not.toHaveCount(0, { timeout: 15_000 });
    } catch {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await expect(this.catalogueRows).not.toHaveCount(0, { timeout: 20_000 });
    }
  }

  /**
   * Navigates back to the catalogue listing from an operation detail page
   * (`/api-details#api=...`) — a no-op if already there. Lets one test chain
   * several operations in the same portal tab (e.g. Add → Get → Delete a
   * resource this test itself created), since `openOperation()` needs the
   * catalogue's iframe to be on screen to find the next operation.
   */
  async backToCatalogue(): Promise<void> {
    if (this.page.url().includes('api-details')) {
      await this.page.goBack({ waitUntil: 'domcontentloaded' });
    }
    await this.waitForCatalogueLoaded();
  }

  /** Tag-group names shown in the catalogue (e.g. "Calls", "Agent Management"), header row excluded. */
  async groupNames(): Promise<string[]> {
    const rows = await this.catalogueRows.allTextContents();
    return rows.slice(1).map(r => r.trim()).filter(Boolean);
  }

  /**
   * Expands a catalogue group (clicking its row toggles the group's
   * operations into the same table) and opens one of its operations by
   * accessible name — e.g. `openOperation('Agent Management', /^Get
   * Supervisors/)`. The operation name includes its route in parentheses
   * (e.g. "Get Supervisors (settings/agents/supervisors)"), so a prefix
   * regex is usually the simplest match.
   */
  async openOperation(groupName: string, operationName: string | RegExp): Promise<ApiOperationPage> {
    await this.backToCatalogue();

    const operationLink = this.catalogueFrame.getByRole('link', { name: operationName });

    // The group row toggles expand/collapse, so only click it when the
    // operation isn't already showing (e.g. a prior lookup left it open).
    if (!(await operationLink.isVisible().catch(() => false))) {
      // Exact match, not substring — "User Management" is itself a
      // substring of "Restricted User Management", and `hasText` with a
      // plain string does substring matching, so a loose match would grab
      // the wrong (earlier, alphabetically) group row.
      const groupRow = this.catalogueRows.filter({ hasText: new RegExp(`^${groupName}$`) }).first();
      await groupRow.click();
    }

    await expect(operationLink).toBeVisible({ timeout: 10_000 });
    await operationLink.click();

    await expect(this.apisHeading).toBeVisible({ timeout: 15_000 });
    return new ApiOperationPage(this.page);
  }
}
