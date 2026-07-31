import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for Analytics Settings > Data Management. Verified 2026-07-16.
 *
 * Two inner tabs: "Pipeline Health" (default) and "Reprocess Data". Reached
 * via AnalyticsSettingsPage.openDataManagement() — this page does not have
 * its own URL.
 *
 * WARNING: queueReprocessing() starts a REAL reprocessing job against the
 * environment and consumes the daily quota (30/day on staging). It must not
 * run in an unattended suite — opt in explicitly.
 *
 * No spec exists for this page yet — ported as scaffolding only.
 */
export interface DataManagementQuotas {
  dailyJobQuota: string;
  maxDateRangeDays: number;
  maxFilesPerJob: number;
  queueStatus: string;
}

export interface DataManagementEstimates {
  estimatedRecords: string | null;
  estDuration: string | null;
  queueLength: string | null;
}

export class DataManagementPage extends BasePage {
  readonly autoQaOnly: Locator;
  readonly groupsInput: Locator;
  readonly extensionsInput: Locator;
  readonly speakersInput: Locator;
  readonly resetButton: Locator;
  readonly queueButton: Locator;
  readonly calendarToggles: Locator;
  readonly rows: Locator;

  static readonly PIPELINE_METRICS = [
    'Files Processed Today',
    'Avg Processing Time',
    'Error Rate',
    'Throughput',
    'Total Files',
  ] as const;

  static readonly JOB_COLUMNS = [
    'Job ID',
    'Date Range',
    'Type',
    'Status',
    'Progress',
    'Duration',
    'Started',
    'Completed',
  ] as const;

  /** Observed limits on staging, surfaced as tiles on the Reprocess Data tab. */
  static readonly QUOTAS: DataManagementQuotas = {
    dailyJobQuota: '0/30',
    maxDateRangeDays: 180,
    maxFilesPerJob: 100000,
    queueStatus: '0/1',
  };

  static readonly SENTIMENT_SCORE_RANGE = { min: -1, max: 1 } as const;

  constructor(page: Page) {
    super(page);
    this.autoQaOnly = page.locator('input[type=checkbox].k-checkbox').first();
    this.groupsInput = page.locator('input[placeholder="Add Group"]');
    this.extensionsInput = page.locator('input[placeholder="Add Extension"]');
    this.speakersInput = page.locator('input[placeholder="Add Speaker"]');
    this.resetButton = page.locator('button:has-text("Reset")');
    this.queueButton = page.locator('button:has-text("Queue Reprocessing")');
    this.calendarToggles = page.locator('[aria-label="Toggle calendar"]');
    this.rows = page.locator('tbody tr');
  }

  private async clickText(text: string): Promise<boolean> {
    return await this.page.evaluate((target) => {
      const el = Array.from(document.querySelectorAll('button, div, span, [role=tab]'))
        .filter((x) => {
          const r = x.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .find((x) => ((x as HTMLElement).innerText || '').trim() === target) as HTMLElement | undefined;
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, text);
  }

  async openPipelineHealth(): Promise<void> {
    await this.clickText('Pipeline Health');
    await this.page.waitForTimeout(4000);
  }

  async openReprocessData(): Promise<void> {
    await this.clickText('Reprocess Data');
    await this.page.waitForTimeout(4000);
  }

  async activeTab(): Promise<string> {
    return await this.page.evaluate(() => {
      const active = document.querySelector('[class*="tab-headers_active"]');
      return active ? (active as HTMLElement).innerText.trim() : '';
    });
  }

  async bodyText(): Promise<string> {
    return await this.page.evaluate(() => document.body.innerText);
  }

  /** "Last checked: ..." plus the five metric tiles, as raw page text. */
  async pipelineMetrics(): Promise<string[]> {
    const text = await this.bodyText();
    return DataManagementPage.PIPELINE_METRICS.filter((metric) => text.includes(metric));
  }

  /** Date inputs default to today's date in MM/DD/YYYY. */
  async dateFields(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('input.k-input-inner'))
        .map((i) => (i as HTMLInputElement).value)
        .filter((v) => /^\d{2}\/\d{2}\/\d{4}$/.test(v)),
    );
  }

  /** Range filters (Duration, Word Count, Sentiment Score) are paired number inputs. */
  async rangeInputs(): Promise<{ value: string; y: number }[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('input[class*="reprocess-data-tab_sliderInput"]')).map(
        (i) => ({
          value: (i as HTMLInputElement).value,
          y: Math.round(i.getBoundingClientRect().y),
        }),
      ),
    );
  }

  async setAutoQaOnly(checked = true): Promise<void> {
    if ((await this.autoQaOnly.isChecked()) !== checked) await this.autoQaOnly.click();
    await this.page.waitForTimeout(1500);
  }

  async estimates(): Promise<DataManagementEstimates> {
    const text = await this.bodyText();
    const grab = (label: string): string | null => {
      const i = text.indexOf(label);
      if (i === -1) return null;
      return text.slice(i + label.length, i + label.length + 20).split('\n').filter(Boolean)[0] ?? null;
    };
    return {
      estimatedRecords: grab('Estimated Records'),
      estDuration: grab('Est. Duration'),
      queueLength: grab('Queue Length'),
    };
  }

  async reset(): Promise<void> {
    await this.clickText('Reset');
    await this.page.waitForTimeout(2000);
  }

  /** DESTRUCTIVE — starts a real job and burns daily quota. Opt in explicitly. */
  async queueReprocessing(options?: { iUnderstandThisStartsARealJob: boolean }): Promise<void> {
    if (!options?.iUnderstandThisStartsARealJob) {
      throw new Error(
        'queueReprocessing starts a real reprocessing job; pass { iUnderstandThisStartsARealJob: true }',
      );
    }
    await this.clickText('Queue Reprocessing');
    await this.page.waitForTimeout(5000);
  }

  async jobs(): Promise<string[][]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('tbody tr')).map((r) =>
        Array.from(r.querySelectorAll('td')).map((td) => (td as HTMLElement).innerText.trim()),
      ),
    );
  }
}
