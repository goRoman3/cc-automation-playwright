/**
 * One-off cleanup: earlier diagnostic/test runs today (before the
 * empty-notes-list-on-reopen race was found and fixed in
 * ChatNotesPopup.openForMessage) created message-level notes on message 0
 * of chat row 0 (SmarshCR Sales, This Year) whose own cleanup couldn't find
 * them afterwards, for the same reason — the notes() read that powers
 * cleanup came back empty too, so `ourIndex < 0` silently skipped the
 * delete. Confirmed leaked, by exact text, via
 * message-note-reopen-check.json: "AQA reopen-check 1788804464830",
 * "AQA message note 1788804360116", "AQA message note 1788801317988".
 *
 * Deletes ONLY notes whose text starts with "AQA " — never touches the
 * pre-existing, non-AQA fixture notes on this message ("test 1", "test 3",
 * "asdasdsad", etc.).
 *
 * Run: npx tsx scripts/diagnostics/message-note-leak-cleanup.ts
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { LoginPage } from '../../pages/login/LoginPage';
import { ChatListingPage } from '../../pages/chat-listing/ChatListingPage';
import { ChatNotesPopup } from '../../pages/chat-listing/ChatNotesPopup';
import { CompanySelector } from '../../pages/shared/CompanySelector';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const BASE_URL = process.env.BASE_URL;
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
if (!BASE_URL || !EMAIL || !PASSWORD) throw new Error('BASE_URL / TEST_EMAIL / TEST_PASSWORD must be set.');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const notes = new ChatNotesPopup(page);

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await chat.openChat(0);
  await notes.openForMessage(0);

  let before = await notes.notes();
  console.log('notes before cleanup:', JSON.stringify(before.map((n) => n.text)));

  // Re-read and re-resolve the index after every delete — never assume
  // positions stay stable across a mutation.
  let guard = 0;
  while (guard++ < 10) {
    const current = await notes.notes();
    const target = current.findIndex((n) => n.text.startsWith('AQA '));
    if (target < 0) break;
    console.log(`deleting "${current[target].text}" at index ${target}`);
    await notes.delete(target);
  }

  const after = await notes.notes();
  console.log('notes after cleanup:', JSON.stringify(after.map((n) => n.text)));
  const stillLeaked = after.some((n) => n.text.startsWith('AQA '));
  console.log(stillLeaked ? 'WARNING: AQA-prefixed notes still remain' : 'all AQA-prefixed notes removed');

  await context.close();
  await browser.close();
})();
