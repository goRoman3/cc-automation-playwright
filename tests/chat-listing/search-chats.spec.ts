import { test, expect } from '../../fixtures/fixtures';

/**
 * Chat Listing — Search Chats.
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-07-16);
 * full element inventory + behaviour notes live in specs/chat-listing-map.md.
 *
 * Auth-gated and serial: shares the single staging account, so it must run with
 * --workers=1 alongside the other authenticated suites.
 *
 * Data prerequisites (staging, company Charl_Test, as of 2026-07-16):
 *   - the This Year range returns at least one chat;
 *   - "Hi" exists inside a chat message body; "Charl" only in the Agent column.
 * The row baseline is captured at runtime (the This Year count already drifted
 * 12 -> 6 within a day on staging, so it must not be hard-coded).
 */
const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

// Text that exists inside a chat message body, not in any grid column.
const MESSAGE_TEXT = 'Hi';

test.describe('Chat Listing — Search Chats', () => {
  // login() may force past the slow active-session modal, and the page object
  // waits out the app's slow grid refreshes — allow generous headroom.
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  // Unfiltered This Year row count, captured per test — the reference point for
  // "search narrows results" / "clear restores the full set" assertions.
  let baselineRows: number;

  test.beforeEach(async ({ page, loginPage, chatListingPage }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });

    await chatListingPage.goto();
    await chatListingPage.dismissAnnouncement();
    // Default range is Last 7 Days and returns nothing — see specs/chat-listing-map.md
    await chatListingPage.setDateRange('This Year');
    baselineRows = await chatListingPage.rowCount();
    expect(baselineRows, 'This Year must return chats to search within').toBeGreaterThan(0);
  });

  // End the session so the shared account doesn't stay logged in for the next test.
  test.afterEach(async ({ page, homePage }) => {
    try {
      if (!(await homePage.userInfoMenu.isVisible().catch(() => false))) return;
      await homePage.userInfoMenu.hover({ timeout: 5_000 });
      await homePage.logoutButton.click({ timeout: 5_000 });
      await page.waitForURL('/', { timeout: 10_000 });
    } catch {
      /* already logged out — nothing to do */
    }
  });

  test('adds a search term as a removable chip', async ({ chatListingPage }) => {
    await chatListingPage.addSearchTerm(MESSAGE_TEXT);
    expect(await chatListingPage.searchTerms()).toContain(MESSAGE_TEXT);
  });

  test('finds chats by text inside the chat body', async ({ chatListingPage }) => {
    await chatListingPage.addSearchTerm(MESSAGE_TEXT);
    await chatListingPage.applySearch();
    const n = await chatListingPage.rowCount();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(baselineRows);
  });

  test('does not match grid metadata — agent name yields no results', async ({ chatListingPage }) => {
    // Search Chats is full-text over message content only; Agent lives in the
    // grid, so this is expected to return nothing. Metadata -> Add Filter.
    await chatListingPage.addSearchTerm('Charl');
    await chatListingPage.applySearch();
    expect(await chatListingPage.rowCount()).toBe(0);
    expect(await chatListingPage.isEmpty()).toBe(true);
  });

  test('unmatched term shows No Results Found', async ({ chatListingPage }) => {
    await chatListingPage.addSearchTerm('zzzznotfound');
    await chatListingPage.applySearch();
    expect(await chatListingPage.isEmpty()).toBe(true);
  });

  test('Clear Search drops the chips and restores the full result set', async ({ chatListingPage }) => {
    await chatListingPage.addSearchTerm(MESSAGE_TEXT);
    await chatListingPage.applySearch();
    await chatListingPage.clearSearch();
    const terms = await chatListingPage.searchTerms();
    expect(terms).not.toContain(MESSAGE_TEXT);
    expect(await chatListingPage.rowCount()).toBe(baselineRows);
  });

  test('Add with an empty input adds nothing', async ({ chatListingPage }) => {
    const before = await chatListingPage.searchTerms();
    await chatListingPage.addSearchTerm('');
    expect(await chatListingPage.searchTerms()).toBe(before);
  });
});
