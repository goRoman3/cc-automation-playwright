import type { Page } from '@playwright/test';

/**
 * Navigates to `path`, retrying once on a failed first attempt.
 *
 * The staging server intermittently drops the initial navigation request —
 * observed both as a mid-response connection reset ("Failure when
 * receiving data from the peer") and as a full hang with no response at
 * all. Either shape burns the test's default 30s budget before a plain
 * catch-and-retry would even run, so the first attempt is capped short,
 * leaving the remaining budget for one genuine retry. A real outage fails
 * again immediately and surfaces as normal.
 */
export async function resilientGoto(page: Page, path: string): Promise<void> {
  try {
    await page.goto(path, { timeout: 15_000 });
  } catch {
    await page.goto(path);
  }
}
