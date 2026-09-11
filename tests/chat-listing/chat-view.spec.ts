import { test, expect } from '../../fixtures/fixtures';
import { ChatListingPage } from '../../pages/chat-listing/ChatListingPage';
import { ChatViewModal } from '../../pages/chat-listing/ChatViewModal';

/**
 * Chat Listing — inside the opened chat (ChatViewModal).
 *
 * Ported from exploration findings verified on staging 2026-08-05, company
 * `SmarshCR Sales`, super admin `romana@callcabinet.com` — see
 * specs/chat-listing-map.md §8a. `Charl_Test` (the search-chats.spec.ts
 * company) has no message-level data worth poking at, so this suite switches
 * company via CompanySelector instead.
 *
 * Auth-gated and serial: shares the single staging account, so it must run
 * with --workers=1 alongside the other authenticated suites.
 */
const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;
const COMPANY = 'SmarshCR Sales';

const CHAT_NAME_INDEX = ChatListingPage.COLUMNS.indexOf('Chat Name');
const PARTICIPANTS_INDEX = ChatListingPage.COLUMNS.indexOf('Participants');

test.describe('Chat Listing — chat view (ADO chat-listing-map §8a)', () => {
  // 240s, not the usual 120s: measured live 2026-09-07 (see
  // local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/chat-listing-data-check.json)
  // — login + companySelector.switchTo('SmarshCR Sales') + goto + setDateRange
  // alone took ~69s under today's degraded-but-working staging performance,
  // before a single feature step. Bumped so a real hang still gets caught,
  // just with enough headroom for known-current slowness, not a redesign of
  // the retry/navigation strategy (which the diagnostic showed is sound).
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  test.beforeEach(async ({ page, loginPage, chatListingPage, companySelector }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await companySelector.switchTo(COMPANY);

    await chatListingPage.goto();
    await chatListingPage.dismissAnnouncement();
    // Default range is Last 7 Days and returns nothing — see specs/chat-listing-map.md
    await chatListingPage.setDateRange('This Year');
    const rows = await chatListingPage.rowCount();
    expect(rows, 'This Year must return chats to open').toBeGreaterThan(0);
  });

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

  test('header title is character-for-character the grid Chat Name cell', async ({
    chatListingPage,
    chatViewModal,
  }) => {
    const gridRow = await chatListingPage.rowData(0);
    expect(gridRow, 'row 0 must exist').not.toBeNull();

    await chatListingPage.openChat(0);
    expect(await chatViewModal.isOpen()).toBe(true);

    const title = await chatViewModal.headerTitle();
    expect(title.length).toBeGreaterThan(0);
    expect(gridRow![CHAT_NAME_INDEX]).toBe(title);
  });

  test('date dropdown offers the documented options and only scrolls — it does not filter', async ({
    page,
    chatListingPage,
    chatViewModal,
  }) => {
    await chatListingPage.openChat(0);
    const before = await chatViewModal.messageCount();
    expect(before).toBeGreaterThan(0);

    await chatViewModal.openDateDropdown();
    for (const option of ChatViewModal.DATE_DROPDOWN_OPTIONS) {
      await expect(
        page.locator(`.k-list-item:has-text("${option}"), li:has-text("${option}")`).first(),
      ).toBeVisible();
    }
    await chatViewModal.pickDateOption('The very beginning');

    // Scrolling to a date group changes the label, never the message count.
    expect(await chatViewModal.messageCount()).toBe(before);
  });

  test('Search This Chat filters live and clearing restores the full message list', async ({
    chatListingPage,
    chatViewModal,
  }) => {
    await chatListingPage.openChat(0);
    const baseline = await chatViewModal.messageCount();
    expect(baseline).toBeGreaterThan(0);

    await chatViewModal.searchThisChat('zzzznotfound-aqa');
    expect(await chatViewModal.messageCount()).toBe(0);
    // No "No results" text is rendered for a chat-local search miss — just an
    // empty body — see specs/chat-listing-map.md §8a.
    await expect(chatViewModal.root).not.toContainText(/no results/i);

    await chatViewModal.clearSearchThisChat();
    expect(await chatViewModal.messageCount()).toBe(baseline);
  });

  test('Copy message puts only the message body on the clipboard, not the whole bubble', async ({
    page,
    chatListingPage,
    chatViewModal,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Clipboard permissions are only grantable on Chromium',
    );
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    await chatListingPage.openChat(0);
    const bubble = chatViewModal.root.locator('[aria-label^="Message:"]').first();
    const fullText = ((await bubble.textContent()) ?? '').trim();
    expect(fullText.length).toBeGreaterThan(0);

    await chatViewModal.copyMessage(0);
    const copied = (await chatViewModal.readClipboardText()).trim();

    expect(copied.length).toBeGreaterThan(0);
    expect(fullText).toContain(copied);
    // The full bubble also renders the author and timestamp, so the copied
    // text must be a strict subset of it — verified 2026-08-05.
    expect(copied).not.toBe(fullText);
  });

  test('"+N" participants popup lists the same participants as the grid cell', async ({
    chatListingPage,
    chatViewModal,
  }) => {
    const rowCount = await chatListingPage.rowCount();

    let gridParticipants: string | null = null;
    let found = false;
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      await chatListingPage.openChat(i);
      if (await chatViewModal.moreParticipantsButton.isVisible().catch(() => false)) {
        gridParticipants = (await chatListingPage.rowData(i))![PARTICIPANTS_INDEX];
        found = true;
        break;
      }
      await chatViewModal.close();
    }
    test.skip(!found, 'No chat in the current This Year range overflows into a "+N" participants button');

    const popupText = await chatViewModal.openParticipantsPopup();
    for (const name of gridParticipants!.split(',').map((s) => s.trim()).filter(Boolean)) {
      expect(popupText).toContain(name);
    }

    await chatViewModal.closeParticipantsPopup();
    await expect(chatViewModal.participantsPopup).toBeHidden();
  });
});
