/**
 * Final pass: exactly one AQA-prefixed note ("AQA message note
 * 1788801317988") remained on message 0 after message-note-leak-cleanup.ts
 * (that script's last delete click timed out on a stale index). Deletes it
 * by exact text match, one at a time, re-reading between attempts.
 *
 * Run: npx tsx scripts/diagnostics/message-note-leak-cleanup2.ts
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

const TARGET_TEXT = 'AQA message note 1788801317988';

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

  const current = await notes.notes();
  console.log('current notes:', JSON.stringify(current.map((n) => n.text)));
  const idx = current.findIndex((n) => n.text === TARGET_TEXT);
  if (idx < 0) {
    console.log(`"${TARGET_TEXT}" not present — nothing to do.`);
  } else {
    console.log(`deleting "${TARGET_TEXT}" at index ${idx}`);
    await notes.delete(idx);
    await page.waitForTimeout(1500);
    const after = await notes.notes();
    console.log('notes after delete:', JSON.stringify(after.map((n) => n.text)));
    console.log(after.some((n) => n.text === TARGET_TEXT) ? 'STILL PRESENT' : 'removed successfully');
  }

  await context.close();
  await browser.close();
})();
