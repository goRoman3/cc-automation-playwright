import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * NotificationsPage — https://atmossystemsstaging.callcabinet.com/Alerting
 * The "Management" tab grid of notification rules. Verified 2026-08-10.
 *
 * Only what the AI Agent specs need: find a rule by name, read its row, and
 * delete it again so a spec that saves a rule leaves staging as it found it.
 *
 * Quirks:
 *  1. Column order is a per-user "Edit columns" setting — read cells by header
 *     name, never by a fixed index.
 *  2. The row's delete control is an icon without an aria-label; it is the last
 *     interactive element of the row.
 *  3. Deleting opens a "Delete Notification" modal with its own Confirm.
 *  4. "New Notification" opens its flow menu on hover, not on click.
 */
const URL = 'https://atmossystemsstaging.callcabinet.com/Alerting?tab=management';

/** A grid row as { <header>: <cell> }. */
export type NotificationRecord = Record<string, string>;

export class NotificationsPage extends BasePage {
  readonly newNotificationButton: Locator;
  readonly rows: Locator;
  readonly pager: Locator;

  static get URL(): string {
    return URL;
  }

  constructor(page: Page) {
    super(page);
    this.newNotificationButton = page.locator('button:has-text("New Notification")');
    this.rows = page.locator('tbody tr');
    this.pager = page.locator('[class*="pager"], .k-pager');
  }

  async goto(): Promise<void> {
    await this.page.goto(URL, { waitUntil: 'domcontentloaded' });
    await this.waitForGrid();
  }

  async waitForGrid(timeout = 45000): Promise<void> {
    await this.page
      .waitForFunction(
        () => {
          if (document.querySelectorAll('tbody tr').length > 0) return true;
          return /No Results Found/i.test(document.body.innerText);
        },
        null,
        { timeout },
      )
      .catch(() => {});
    await this.page.waitForTimeout(1200);
  }

  async headers(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('thead th')).map((th) => (th as HTMLElement).innerText.trim()),
    );
  }

  /** Rows as { <header>: <cell> } objects, current page only. */
  async records(): Promise<NotificationRecord[]> {
    return await this.page.evaluate(() => {
      const heads = Array.from(document.querySelectorAll('thead th')).map((th) =>
        (th as HTMLElement).innerText.trim(),
      );
      return Array.from(document.querySelectorAll('tbody tr')).map((tr) => {
        const o: Record<string, string> = {};
        Array.from(tr.querySelectorAll('td')).forEach((td, i) => {
          o[heads[i] || `col${i}`] = (td as HTMLElement).innerText.trim();
        });
        return o;
      });
    });
  }

  async findRule(name: string): Promise<NotificationRecord | null> {
    const rows = await this.records();
    return rows.find((r) => Object.values(r).some((v) => v === name)) || null;
  }

  async hasRule(name: string): Promise<boolean> {
    return (await this.findRule(name)) !== null;
  }

  /** Newly saved rules land at the top — the grid is created-descending. */
  async firstRule(): Promise<NotificationRecord | null> {
    return (await this.records())[0] || null;
  }

  /**
   * Delete a rule by name and confirm the modal. Returns false when no row
   * matches, so cleanup in an afterEach never fails a passing spec.
   */
  async deleteRule(name: string): Promise<boolean> {
    const clicked = await this.page.evaluate((n) => {
      const row = Array.from(document.querySelectorAll('tbody tr')).find((r) =>
        (r as HTMLElement).innerText.includes(n),
      );
      if (!row) return false;
      const controls = Array.from(row.querySelectorAll('button, svg, [role="button"]'));
      const del = controls[controls.length - 1];
      if (!del) return false;
      del.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    }, name);
    if (!clicked) return false;

    await this.page.waitForTimeout(2000);
    await this.page.evaluate(() => {
      const md = Array.from(document.querySelectorAll('[class*="modal" i],[role="dialog"]')).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 100 && r.height > 60;
      });
      if (!md.length) return;
      const b = Array.from(md[md.length - 1].querySelectorAll('button')).find((x) =>
        /^confirm$/i.test(((x as HTMLElement).innerText || '').trim()),
      );
      if (b) (b as HTMLElement).click();
    });
    await this.page.waitForTimeout(5000);
    return true;
  }
}
