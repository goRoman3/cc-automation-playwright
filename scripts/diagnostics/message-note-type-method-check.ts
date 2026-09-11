/**
 * Isolates whether ChatNotesPopup.type() itself (the real production
 * method, using the deprecated Locator.type() API) behaves differently
 * from the raw fill()/pressSequentially() calls used successfully in
 * message-note-typing-check.ts (3/3 stable there). No try/catch — any real
 * error should surface directly instead of being swallowed.
 *
 * Never Saves.
 *
 * Run: npx tsx scripts/diagnostics/message-note-type-method-check.ts
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
  const rows = await chat.rowCount();
  console.log(`rowCount before This Year filter: ${rows}`);
  await chat.setDateRange('This Year');
  const rowsAfter = await chat.rowCount();
  console.log(`rowCount after This Year filter: ${rowsAfter}`);

  await chat.openChat(0);
  console.log('chat opened');

  const probeText = `AQA type-method-check ${Date.now()}`;
  await notes.openForMessage(0);
  console.log('popup opened via openForMessage(0)');
  console.log('popup visible right after open:', await notes.isOpen());

  console.log('calling notes.type() (the real production method)...');
  await notes.type(probeText);
  console.log('notes.type() returned without throwing');
  console.log('popup visible immediately after type():', await notes.isOpen());
  const valueRightAfter = await notes.textarea.inputValue().catch((e) => `ERROR: ${e.message.split('\n')[0]}`);
  console.log('textarea value immediately after type():', JSON.stringify(valueRightAfter));

  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(1500);
    const open = await notes.isOpen().catch(() => false);
    const value = open ? await notes.textarea.inputValue().catch((e) => `ERROR: ${e.message.split('\n')[0]}`) : null;
    console.log(`+${(i + 1) * 1500}ms  popupOpen=${open}  value=${JSON.stringify(value)}`);
  }

  if (await notes.isOpen().catch(() => false)) {
    await notes.cancel().catch((e) => console.log('cancel() threw:', e.message.split('\n')[0]));
  } else {
    console.log('popup already closed — nothing to cancel');
  }

  console.log('\ndone — did NOT click Save at any point.');

  await context.close();
  await browser.close();
})();
