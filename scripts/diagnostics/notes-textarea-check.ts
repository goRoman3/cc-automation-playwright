/**
 * Narrower follow-up to notes-save-check.ts: the save click produced no
 * toast, no popup close, and no persisted note. Before concluding Save
 * itself is broken, confirm the textarea our type() actually typed into is
 * the live "Add New Note" input and really holds our text (not some other
 * hidden/disabled textarea matched by `${ROOT_SELECTOR} textarea`.first()).
 *
 * Run: npx tsx scripts/diagnostics/notes-textarea-check.ts
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const notes = new ChatNotesPopup(page);
  const noteText = `AQA textarea-check ${Date.now()}`;

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await notes.openForRow(0);

  const textareaCount = await page.locator('[class*="notesPopup"], [class*="dynamic-popup_popup"] textarea').count();
  console.log(`textarea matches inside the popup: ${textareaCount}`);

  const allTextareas = await page.evaluate(() => {
    const popup = document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]');
    if (!popup) return [];
    return Array.from(popup.querySelectorAll('textarea')).map((ta) => ({
      value: (ta as HTMLTextAreaElement).value,
      placeholder: ta.getAttribute('placeholder'),
      disabled: (ta as HTMLTextAreaElement).disabled,
      visible: ta.getBoundingClientRect().width > 0 && ta.getBoundingClientRect().height > 0,
    }));
  });
  console.log('textareas found via evaluate:', JSON.stringify(allTextareas, null, 2));

  await notes.type(noteText);
  const valueAfterType = await notes.textarea.inputValue().catch((e) => `ERROR: ${e.message}`);
  console.log(`\ntextarea.inputValue() right after type(): "${valueAfterType}"`);

  const saveButtonState = await notes.saveButton.evaluate((el) => ({
    disabled: (el as HTMLButtonElement).disabled,
    className: el.className,
    text: (el as HTMLElement).innerText,
  }));
  console.log('save button state:', JSON.stringify(saveButtonState));

  await page.screenshot({ path: path.join(OUT_DIR, 'notes-textarea-check.png') }).catch(() => {});

  fs.writeFileSync(
    path.join(OUT_DIR, 'notes-textarea-check.json'),
    JSON.stringify({ when: new Date().toISOString(), textareaCount, allTextareas, valueAfterType, saveButtonState }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/notes-textarea-check.json');

  // Best-effort: don't leave the popup open with unsaved text.
  await notes.cancel().catch(() => {});

  await context.close();
  await browser.close();
})();
