import { type Page } from '@playwright/test';

/**
 * Dismisses the one-time "Action Required: API Platform Update" modal.
 * `LoginPage.completeLogin()` already handles it once right after login, but
 * it has been observed reappearing on later navigations within the same
 * session (e.g. opening `/AiAgent` or switching company) — its full-screen
 * overlay then intercepts pointer events on everything behind it, which
 * otherwise surfaces as a click hanging until the test's outer timeout
 * rather than a clear error. Best-effort and safe to call unconditionally
 * before any action that might be blocked by it.
 */
export async function dismissAnnouncementModal(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Close modal' })
    .click({ timeout: 3_000 })
    .catch(() => {});
}
