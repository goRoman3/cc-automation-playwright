/**
 * Verifies message-note-leak-cleanup.ts actually left message 0 clean —
 * a fresh read, independent of that script's own (possibly stale) loop
 * state.
 *
 * Run: npx tsx scripts/diagnostics/message-note-leak-verify.ts
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

  const current = await notes.notes();
  console.log('current notes on message 0:', JSON.stringify(current.map((n) => n.text), null, 2));
  const leaked = current.filter((n) => n.text.startsWith('AQA '));
  console.log(leaked.length === 0 ? '\nCLEAN — no AQA-prefixed notes remain.' : `\nSTILL LEAKED: ${JSON.stringify(leaked.map((n) => n.text))}`);

  await context.close();
  await browser.close();
})();
