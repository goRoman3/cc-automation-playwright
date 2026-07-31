import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for Analytics Settings > Sentiment Adjustments. Verified
 * 2026-07-16 — staging had zero phrases ("No Results Found!"), so all three
 * stat tiles read "0 / 0% of total".
 *
 * Reached via AnalyticsSettingsPage.openSentimentAdjustments() — this page
 * does not have its own URL.
 *
 * No spec exists for this page yet — ported as scaffolding only.
 */
export class SentimentAdjustmentsPage extends BasePage {
  readonly filterPhrases: Locator;
  readonly newPhraseInput: Locator;
  readonly resetButton: Locator;
  readonly submitButton: Locator;
  readonly infoIcon: Locator;
  readonly editColumnsButton: Locator;
  readonly statItems: Locator;
  readonly rows: Locator;

  static readonly CLASSIFICATIONS = ['Positive', 'Neutral', 'Negative'] as const;
  static readonly DEFAULT_CLASSIFICATION = 'Neutral';
  static readonly COLUMNS = ['Phrase', 'Classification'] as const;

  constructor(page: Page) {
    super(page);
    this.filterPhrases = page.locator('input[placeholder="Filter Phrases"]');
    this.newPhraseInput = page.locator('input[placeholder="Enter new phrase"]');
    this.resetButton = page.locator(
      '[class*="sentiment-adjustments_newPhraseContainer"] button:has-text("Reset")',
    );
    this.submitButton = page.locator(
      '[class*="sentiment-adjustments_newPhraseContainer"] button:has-text("Submit")',
    );
    this.infoIcon = page.locator('[class*="stt-call-search-panel_infoIcon"]');
    this.editColumnsButton = page.locator('[class*="sentiment-adjustments_editColumns"]');
    this.statItems = page.locator('[class*="sentiment-adjustments_sentimentStatItem"]');
    this.rows = page.locator('tbody tr');
  }

  /** Three tiles: count + "% of total", one per classification. */
  async stats(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="sentiment-adjustments_sentimentStatItem"]')).map(
        (el) => (el as HTMLElement).innerText.replace(/\n+/g, ' ').trim(),
      ),
    );
  }

  async openClassificationDropdown(): Promise<void> {
    const select = this.page.locator('[aria-label="select"]');
    await select.nth((await select.count()) - 1).click();
    await this.page.waitForTimeout(1200);
  }

  async classificationOptions(): Promise<string[]> {
    await this.openClassificationDropdown();
    const options = await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('li, .k-list-item, [role=option]'))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el) => (el as HTMLElement).innerText.trim())
        .filter(Boolean),
    );
    await this.page.keyboard.press('Escape');
    return options;
  }

  async selectClassification(label: string): Promise<void> {
    await this.openClassificationDropdown();
    await this.page
      .locator(`li:has-text("${label}"), .k-list-item:has-text("${label}")`)
      .first()
      .click();
    await this.page.waitForTimeout(600);
  }

  async currentClassification(): Promise<string> {
    return await this.page.evaluate(() => {
      const el = document.querySelector('[class*="sentiment-adjustments_selectorContainer"]');
      return el ? (el as HTMLElement).innerText.trim() : '';
    });
  }

  async addPhrase(phrase: string, classification?: string): Promise<void> {
    await this.newPhraseInput.fill(phrase);
    if (classification) await this.selectClassification(classification);
    await this.page.evaluate(() => {
      const container = document.querySelector('[class*="sentiment-adjustments_newPhraseContainer"]');
      const button = container
        ? Array.from(container.querySelectorAll('button')).find(
            (x) => (x as HTMLElement).innerText.trim() === 'Submit',
          )
        : undefined;
      (button as HTMLElement | undefined)?.click();
    });
    await this.page.waitForTimeout(4000);
  }

  async reset(): Promise<void> {
    await this.page.evaluate(() => {
      const container = document.querySelector('[class*="sentiment-adjustments_newPhraseContainer"]');
      const button = container
        ? Array.from(container.querySelectorAll('button')).find(
            (x) => (x as HTMLElement).innerText.trim() === 'Reset',
          )
        : undefined;
      (button as HTMLElement | undefined)?.click();
    });
    await this.page.waitForTimeout(1200);
  }

  async phrases(): Promise<string[][]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('tbody tr')).map((r) =>
        Array.from(r.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.trim()),
      ),
    );
  }

  async isEmpty(): Promise<boolean> {
    return (await this.page.evaluate(() => document.body.innerText)).includes('No Results Found!');
  }

  async sortBy(column: string): Promise<void> {
    await this.page.locator(`[aria-label*="${column}"][class*="sortActivator"]`).first().click();
    await this.page.waitForTimeout(2500);
  }
}
