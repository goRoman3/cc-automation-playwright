/**
 * Follow-up to message-note-open-check.ts: opening the message-level note
 * popup now works (fixed in ChatNotesPopup.openForMessage), but the
 * chat-notes.spec.ts test still fails on REOPENING the same message after
 * saving a note — the failure screenshot showed what looks like an in-place
 * MESSAGE EDIT box (Cancel/Save inline on the message bubble itself), not
 * the notes side-popup, suggesting the second click landed on a different
 * control than the first one did.
 *
 * Walks the exact sequence with a screenshot + DOM dump after every step.
 *
 * Run: npx tsx scripts/diagnostics/message-note-reopen-check.ts
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

const OUT_DIR = path.resolve(__dirname, '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07');
fs.mkdirSync(OUT_DIR, { recursive: true });

const dumpNoteControls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[aria-label*="note" i], [aria-label*="Message:"]'));
    return nodes.slice(0, 4).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      };
    });
  });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const notes = new ChatNotesPopup(page);
  const noteText = `AQA reopen-check ${Date.now()}`;

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await chat.openChat(0);

  console.log('=== step 1: openForMessage(0) — first time ===');
  await notes.openForMessage(0);
  console.log('popup open:', await notes.isOpen());
  await page.screenshot({ path: path.join(OUT_DIR, 'reopen-1-first-open.png') }).catch(() => {});

  console.log('\n=== step 2: type + save ===');
  await notes.add(noteText);
  console.log('popup open after save:', await notes.isOpen());
  await page.screenshot({ path: path.join(OUT_DIR, 'reopen-2-after-save.png') }).catch(() => {});

  console.log('\n=== step 3: candidates right before reopening ===');
  console.log(JSON.stringify(await dumpNoteControls(page), null, 2));

  console.log('\n=== step 4: openForMessage(0) — second time (reopen) ===');
  await notes.openForMessage(0).catch((e) => console.log('openForMessage threw:', e.message.split('\n')[0]));
  console.log('popup open after reopen attempt:', await notes.isOpen());
  await page.screenshot({ path: path.join(OUT_DIR, 'reopen-3-after-reopen-attempt.png') }).catch(() => {});

  const finalText = await notes.text().catch((e) => `ERROR: ${e.message.split('\n')[0]}`);
  console.log('\npopup/edit-box text at this point:', JSON.stringify(finalText));

  const notesNow = await notes.notes().catch((e) => [`ERROR: ${e.message}`]);
  console.log('notes() result:', JSON.stringify(notesNow, null, 2));

  // Best-effort cleanup: if our note made it in anywhere findable, remove it.
  const idx = Array.isArray(notesNow) ? notesNow.findIndex((n: any) => typeof n === 'object' && n.text && n.text.includes(noteText)) : -1;
  if (idx >= 0) {
    await notes.delete(idx);
    console.log(`cleaned up note at index ${idx}`);
  } else {
    console.log('COULD NOT locate our note via notes() for cleanup — recording identifier for manual follow-up:', noteText);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'message-note-reopen-check.json'),
    JSON.stringify({ when: new Date().toISOString(), noteText, finalText, notesNow }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/message-note-reopen-check.json');

  await context.close();
  await browser.close();
})();
