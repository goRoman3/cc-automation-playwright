import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Settings > API Management (`/Settings/ApiManagement`) — the main app's own
 * page (not the developer portal popup) where a subscription key's site
 * assignment is edited. Used by the tenant-isolation suite to automate the
 * manual site-switch step between Phase 1 and Phase 2, confirmed live
 * 2026-08-28 via interactive MCP-driven exploration before being encoded
 * here.
 *
 * **Every interactive element here needs the raw-dispatch fallback below**,
 * not just a plain `.click()`: the Kendo-based site combobox and its
 * options, the row action icons (`div[role=button]`, not real `<button>`
 * elements), and the "Action Required" announcement modal's close icon all
 * failed to respond to a normal Playwright click in live testing (either
 * hanging on `<div class="modal_background">` intercepting pointer events,
 * or the click firing but the framework's own pointer/mouse-event-sequence
 * listener never seeing it). A full `pointerdown/mousedown/pointerup/
 * mouseup/click` `MouseEvent` sequence dispatched directly on the element
 * worked reliably where `.click()` didn't — same class of workaround as
 * `ApiOperationPage`'s `clickButtonRobustly()`, just needing the fuller
 * event sequence here rather than a bare `click()` dispatch.
 *
 * The site dropdown is also virtualized/async — right after opening it,
 * `document.querySelectorAll('[role="option"]')` can transiently report 0
 * results for a moment before the ~300 options actually render, so option
 * lookups are retried rather than trusted on the first read.
 */
export class ApiManagementSettingsPage {
  readonly table: Locator;
  readonly siteCombobox: Locator;
  readonly siteListbox: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.table = page.getByRole('grid', { name: 'Table' });
    this.siteCombobox = this.page.locator('#site');
    this.siteListbox = this.page.locator('#site-listbox-id');
    this.saveButton = page.getByRole('button', { name: 'Save' });
  }

  /** Dispatches a full pointer/mouse event sequence — see class doc for why a plain `.click()` isn't reliable here. */
  private async dispatchClick(locator: Locator): Promise<void> {
    await locator.evaluate((el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      const opts: MouseEventInit = { bubbles: true, cancelable: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 };
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        el.dispatchEvent(new MouseEvent(type, opts));
      }
    });
  }

  /** Dismisses the "Action Required: API Platform Update" announcement modal if present — reappears across navigations, not just first login. */
  private async dismissAnnouncementModal(): Promise<void> {
    const closeModal = this.page.locator('.critical-update-popup_closeContainer__8GCSQ, [aria-label="Close modal"]').first();
    if (await closeModal.isVisible().catch(() => false)) {
      await this.dispatchClick(closeModal);
      await expect(closeModal).toBeHidden({ timeout: 5_000 }).catch(() => {});
    }
  }

  async goto(): Promise<void> {
    await this.page.goto(`${process.env.BASE_URL}/Settings/ApiManagement`);
    await expect(this.table).toBeVisible({ timeout: 15_000 });
    await this.dismissAnnouncementModal();
  }

  /** The site currently assigned to `keyName`, as shown in the table (before opening the edit dialog). */
  async currentSite(keyName: string): Promise<string> {
    const row = this.table.getByRole('row', { name: new RegExp(`^${keyName}\\b`) });
    return (await row.locator('td, [role="gridcell"]').nth(1).textContent())?.trim() ?? '';
  }

  /** Opens the edit dialog for `keyName`'s row (the 2nd action-cell icon: Copy, Edit, Regenerate, Delete — all `div[role=button]`, not real buttons). */
  async openEditDialog(keyName: string): Promise<void> {
    await this.dismissAnnouncementModal();
    const row = this.table.getByRole('row', { name: new RegExp(`^${keyName}\\b`) });
    await this.dispatchClick(row.locator('[role="button"]').nth(1));
    await expect(this.page.getByText('Edit API Key')).toBeVisible({ timeout: 10_000 });
    await this.dismissAnnouncementModal(); // can reappear stacked on top of the just-opened dialog
  }

  /** Picks a site from the (large, virtualized, ~300-option) dropdown that is NOT `excludeSite`, returning the name picked. */
  async selectRandomDifferentSite(excludeSite: string): Promise<string> {
    await this.dispatchClick(this.siteCombobox);
    const candidateOptions = this.siteListbox.locator('[role="option"]');
    // Retry: the listbox can transiently report 0 rendered options right
    // after opening.
    let names: string[] = [];
    for (let attempt = 0; attempt < 5 && names.length === 0; attempt++) {
      await this.page.waitForTimeout(300);
      names = (await candidateOptions.allTextContents()).map(n => n.trim()).filter(n => n && n !== 'Select a site' && n !== excludeSite);
    }
    expect(names.length, 'Expected the site dropdown to render at least one selectable option').toBeGreaterThan(0);
    const picked = names[Math.floor(Math.random() * names.length)];
    await this.dispatchClick(this.siteListbox.getByRole('option', { name: picked, exact: true }));
    await expect(this.siteCombobox).toHaveText(picked, { timeout: 5_000 });
    return picked;
  }

  /** Clicks Save and waits for the (noticeably slow) save to complete and the dialog to close. */
  async save(): Promise<void> {
    await this.dispatchClick(this.saveButton);
    await expect(this.page.getByText('Edit API Key')).toBeHidden({ timeout: 60_000 });
  }

  /**
   * Full switch: opens `keyName`'s edit dialog, picks a random site
   * different from `currentSite`, saves, and returns the site picked.
   * Caller still needs to reopen the Development portal afterward for the
   * new site to take effect on subsequent "Try this operation" calls.
   */
  async switchKeyToRandomDifferentSite(keyName: string): Promise<{ from: string; to: string }> {
    const from = await this.currentSite(keyName);
    await this.openEditDialog(keyName);
    const to = await this.selectRandomDifferentSite(from);
    await this.save();
    return { from, to };
  }

  /** Picks the exact site `siteName` from the dropdown (for restoring after a switch). */
  async selectSite(siteName: string): Promise<void> {
    await this.dispatchClick(this.siteCombobox);
    const option = this.siteListbox.getByRole('option', { name: siteName, exact: true });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await option.isVisible().catch(() => false)) break;
      await this.page.waitForTimeout(300);
    }
    await this.dispatchClick(option);
    await expect(this.siteCombobox).toHaveText(siteName, { timeout: 5_000 });
  }

  /** Full switch of `keyName` to a specific `siteName` (e.g. restoring the original after a test). */
  async switchKeyToSite(keyName: string, siteName: string): Promise<{ from: string; to: string }> {
    const from = await this.currentSite(keyName);
    await this.openEditDialog(keyName);
    await this.selectSite(siteName);
    await this.save();
    return { from, to: siteName };
  }
}
