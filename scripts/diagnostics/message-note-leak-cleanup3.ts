/**
 * Final cleanup pass: removes the 3 AQA-prefixed notes left behind by the
 * two full chat-notes.spec.ts "message-level" test attempts that failed on
 * downstream, unrelated environment hiccups (chat-view close race, stray
 * user-menu overlay) after already creating and verifying their note.
 * Skips "AQA message note 1788801317988" deliberately — its 15-minute
 * edit/delete window has already expired (see
 * local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/ for the
 * earlier confirmation) and it can no longer be removed through the UI.
 *
 * Run: npx tsx scripts/diagnostics/message-note-leak-cleanup3.ts
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

const PERMANENTLY_STUCK = 'AQA message note 1788801317988';

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

  let guard = 0;
  while (guard++ < 10) {
    const current = await notes.notes();
    const target = current.findIndex((n) => n.text.startsWith('AQA ') && n.text !== PERMANENTLY_STUCK);
    if (target < 0) break;
    console.log(`deleting "${current[target].text}" at index ${target}`);
    await notes.delete(target);
    await page.waitForTimeout(1000);
  }

  const final = await notes.notes();
  console.log('\nfinal notes on message 0:', JSON.stringify(final.map((n) => n.text), null, 2));
  const stillLeaked = final.filter((n) => n.text.startsWith('AQA ') && n.text !== PERMANENTLY_STUCK);
  console.log(
    stillLeaked.length === 0
      ? '\nCLEAN — only the permanently-stuck note (past its edit window) and pre-existing fixture notes remain.'
      : `\nSTILL LEAKED (unexpected): ${JSON.stringify(stillLeaked.map((n) => n.text))}`,
  );

  await context.close();
  await browser.close();
})();
