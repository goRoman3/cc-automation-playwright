import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the per-column filter popover used by the QA Scorecards
 * grid header. Verified against staging DOM on 2026-07-31.
 *
 * Two shapes share one container (`[class*="filter_filter"]`):
 *   text   — "Show items with value that:" + operator dropdown + text input
 *   choice — a radio group (Form Type: Manual/Auto, Archived: Yes/No)
 * Both end with Clear / Filter buttons.
 *
 * Quirks this object exists to hide:
 *  1. The header filter icon has height 0 until the header is hovered, so
 *     Playwright's actionability check never passes — the opener DOM-dispatches
 *     (see QAScorecardsPage.openFilter()).
 *  2. Pressing Escape to close the operator dropdown closes the whole popover.
 *     Always pick an operator by clicking its list item.
 *  3. "Filter" is disabled until a value/radio is supplied; "Clear" never is.
 */
export class ColumnFilterPopup extends BasePage {
  readonly root: Locator;
  readonly title: Locator;
  readonly operatorDropdown: Locator;
  readonly valueInput: Locator;
  readonly radioContainers: Locator;
  readonly clearButton: Locator;
  readonly filterButton: Locator;

  static readonly OPERATORS = [
    'Starts with',
    'Contains',
    'Does not contain',
    'Ends with',
    'Is exactly',
    'Is exactly not',
  ] as const;

  constructor(page: Page) {
    super(page);
    this.root = page.locator('[class*="filter_filter"]');
    this.title = this.root.locator('[class*="filter_title"]');
    this.operatorDropdown = this.root.locator('span[role="combobox"], .k-dropdownlist').last();
    this.valueInput = this.root.locator('input[class*="input_input"]').last();
    this.radioContainers = this.root.locator('[class*="filter_radioButtonContainer"]');
    this.clearButton = this.root.locator('button[aria-label="Clear"]').last();
    this.filterButton = this.root.locator('button[aria-label="Filter"]').last();
  }

  async isOpen(): Promise<boolean> {
    return (await this.root.count()) > 0;
  }

  async titleText(): Promise<string> {
    return (await this.title.first().innerText()).trim();
  }

  async promptText(): Promise<string> {
    return await this.page.evaluate(() => {
      const root = document.querySelector('[class*="filter_filter"]') as HTMLElement | null;
      return root ? root.innerText.replace(/\n+/g, ' | ') : '';
    });
  }

  /** Labels of the radio group, in DOM order. Empty for the text filter. */
  async radioLabels(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="filter_radioButtonContainer"]')).map((el) =>
        (el as HTMLElement).innerText.trim(),
      ),
    );
  }

  /** Currently selected operator shown in the dropdown. */
  async selectedOperator(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const root = document.querySelector('[class*="filter_filter"]');
      const inner = root?.querySelector(
        'span[role="combobox"] .k-input-inner, .k-dropdownlist .k-input-inner',
      ) as HTMLElement | null;
      return inner ? inner.innerText.trim() : null;
    });
  }

  /** Opens the operator list and returns its items without selecting anything. */
  async operatorOptions(): Promise<string[]> {
    await this.operatorDropdown.click();
    await this.page.waitForTimeout(1500);
    const items = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('.k-list-item')).map((el) =>
        (el as HTMLElement).innerText.trim(),
      ),
    );
    // Close the list by re-picking the current value — Escape would kill the popover.
    const current = await this.selectedOperator();
    await this.page
      .locator('.k-list-item')
      .filter({ hasText: new RegExp(`^${current}$`) })
      .first()
      .click()
      .catch(() => {});
    await this.page.waitForTimeout(600);
    return items;
  }

  async selectOperator(name: string): Promise<void> {
    await this.operatorDropdown.click();
    await this.page.waitForTimeout(1500);
    await this.page
      .locator('.k-list-item')
      .filter({ hasText: new RegExp(`^${name}$`) })
      .first()
      .click();
    await this.page.waitForTimeout(800);
  }

  async setValue(text: string): Promise<void> {
    await this.valueInput.fill(text);
    await this.page.waitForTimeout(500);
  }

  async currentValue(): Promise<string> {
    return await this.valueInput.inputValue();
  }

  async selectRadio(label: string): Promise<void> {
    await this.radioContainers
      .filter({ hasText: new RegExp(`^${label}$`) })
      .locator('input[type=radio]')
      .first()
      .click();
    await this.page.waitForTimeout(600);
  }

  async isRadioSelected(label: string): Promise<boolean | null> {
    return await this.page.evaluate((targetLabel) => {
      const container = Array.from(
        document.querySelectorAll('[class*="filter_radioButtonContainer"]'),
      ).find((el) => (el as HTMLElement).innerText.trim() === targetLabel);
      const radio = container?.querySelector('input[type=radio]') as HTMLInputElement | null;
      return radio ? radio.checked : null;
    }, label);
  }

  async isFilterEnabled(): Promise<boolean> {
    return !(await this.page.evaluate(() => {
      const button = document.querySelector(
        '[class*="filter_filter"] button[aria-label="Filter"]',
      ) as HTMLButtonElement | null;
      return button ? button.disabled : true;
    }));
  }

  async isClearEnabled(): Promise<boolean> {
    return !(await this.page.evaluate(() => {
      const button = document.querySelector(
        '[class*="filter_filter"] button[aria-label="Clear"]',
      ) as HTMLButtonElement | null;
      return button ? button.disabled : true;
    }));
  }

  async apply(): Promise<void> {
    await this.filterButton.click();
    await this.page.waitForTimeout(3500);
  }

  async clear(): Promise<void> {
    await this.clearButton.click();
    await this.page.waitForTimeout(3500);
  }
}
