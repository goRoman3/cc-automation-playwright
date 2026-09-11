/**
 * Targeted follow-up: chat-notes.spec.ts's "adding a chat note" test raced
 * chatNotesPopup.toast(15_000) against saveButton.click() and got `null`
 * both times, with the failure screenshot still showing the popup open on
 * the SAME 3 pre-existing notes (no 4th note visible). Unclear whether the
 * save genuinely didn't happen, or happened but the popup didn't close and
 * the list simply never refreshed (documented: it only refreshes on
 * reopen). Reproduces the exact save step with full instrumentation instead
 * of guessing which.
 *
 * Run: npx tsx scripts/diagnostics/notes-save-check.ts
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
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

const OUT_DIR = path.resolve(
  __dirname,
  '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07',
);
fs.mkdirSync(OUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const notes = new ChatNotesPopup(page);
  const noteText = `AQA diag note ${Date.now()}`;

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  console.log(`rowCount: ${await chat.rowCount()}`);

  await notes.openForRow(0);
  const before = await notes.notes();
  console.log(`notes before save: ${before.length}`);
  console.log(before.map((n) => `  - "${n.text}" (${n.posted})`).join('\n'));

  await notes.type(noteText);
  console.log(`\ntyped note text, clicking Save and watching for 20s...`);

  // Watch the DOM for up to 20s after the click, independent of any specific
  // toast selector — log every element with class containing "toast" or
  // "notification", and whether the popup is still present, once per second.
  const clickPromise = notes.saveButton.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 20_000) {
    const snap = await page
      .evaluate(() => {
        const popupOpen = !!document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]');
        const toastLike = Array.from(document.querySelectorAll('[class*="toast" i], [class*="notification" i], [role="alert"]'))
          .map((el) => ({
            className: (el as HTMLElement).className,
            text: (el as HTMLElement).innerText.trim().slice(0, 100),
            visible: el.getBoundingClientRect().width > 0,
          }));
        return { popupOpen, toastLike };
      })
      .catch(() => null);
    console.log(`+${Date.now() - t0}ms  popupOpen=${snap?.popupOpen}  toastLike=${JSON.stringify(snap?.toastLike)}`);
    await page.waitForTimeout(1000);
  }
  await clickPromise.catch((e) => console.log('save click error:', e.message));

  console.log(`\nreopening to check whether the note actually persisted...`);
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await notes.openForRow(0);
  const after = await notes.notes();
  console.log(`notes after reopen: ${after.length}`);
  console.log(after.map((n) => `  - "${n.text}" (${n.posted})`).join('\n'));
  const persisted = after.some((n) => n.text.includes(noteText));
  console.log(`\nour note persisted: ${persisted}`);

  if (persisted) {
    const idx = after.findIndex((n) => n.text.includes(noteText));
    await notes.delete(idx);
    console.log(`cleaned up note at index ${idx}`);
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'notes-save-check.png') }).catch(() => {});

  fs.writeFileSync(
    path.join(OUT_DIR, 'notes-save-check.json'),
    JSON.stringify({ when: new Date().toISOString(), noteText, before, after, persisted }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/notes-save-check.json');

  await context.close();
  await browser.close();
})();
