/**
 * Order/state-dependency diagnostic for the chat-notes.spec.ts blocker:
 * the message-level test PASSES in isolation but FAILS (2/2) as test #3 in
 * the full file, right after "adding a chat note..." (test #1) and "Cancel
 * discards..." (test #2).
 *
 * Playwright gives every `test()` a fresh BrowserContext + Page by default
 * (confirmed: playwright.config.ts sets no storageState/globalSetup, and
 * fixtures.ts only wraps the built-in `page` fixture — no lifecycle
 * override). So DOM/page-level state cannot literally survive between
 * tests; each variant below therefore uses a genuinely FRESH login +
 * context for every step, exactly like real Playwright test execution,
 * to isolate whether the carryover is BACKEND/session/data state instead.
 *
 * Four variants, each ending in the same non-destructive probe (type a
 * unique text into the message-0 note editor, wait, Cancel, verify nothing
 * persisted — never Save):
 *   A. probe only (no prior flow)
 *   B. test #1 logic (chat-level note: create, verify, delete) -> probe
 *   C. test #2 logic (chat-level note: type a draft, Cancel, verify absent)
 *      -> probe
 *   D. test #1 logic -> test #2 logic -> probe
 *
 * Run: npx tsx scripts/diagnostics/chat-notes-order-diagnostic.ts
 */
import { chromium, type BrowserContext, type Page } from '@playwright/test';
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

async function freshContext(browser: import('@playwright/test').Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  return { context, page };
}

async function loginAndReachChat(page: Page): Promise<{ chat: ChatListingPage; notes: ChatNotesPopup }> {
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
  return { chat, notes };
}

async function logout(page: Page) {
  try {
    await page.locator('[aria-label="user info"]').hover({ timeout: 5_000 });
    await page.locator('[aria-label="Logout"]').click({ timeout: 5_000 });
    await page.waitForURL('/', { timeout: 10_000 });
  } catch {
    /* best-effort */
  }
}

/** Mirrors test #1's real steps: create a chat-level note, verify, delete. */
async function runTest1Logic(page: Page): Promise<{ ok: boolean; error?: string }> {
  try {
    const { chat, notes } = await loginAndReachChat(page);
    const rows = await chat.rowCount();
    if (rows <= 0) return { ok: false, error: 'no rows for This Year' };

    const noteText = `AQA order-diag chat note ${Date.now()}`;
    await notes.openForRow(0);
    await notes.type(noteText);
    await notes.saveButton.click();
    await new Promise((r) => setTimeout(r, 1500));

    await notes.openForRow(0);
    const list = await notes.notes();
    const idx = list.findIndex((n) => n.text.includes(noteText));
    if (idx >= 0) {
      await notes.delete(idx);
    }
    await notes.close();
    await logout(page);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.split('\n')[0] };
  }
}

/** Mirrors test #2's real steps: type a chat-level draft, Cancel (never save), verify absent. */
async function runTest2Logic(page: Page): Promise<{ ok: boolean; error?: string }> {
  try {
    const { chat, notes } = await loginAndReachChat(page);
    const rows = await chat.rowCount();
    if (rows <= 0) return { ok: false, error: 'no rows for This Year' };

    const draftText = `AQA order-diag draft ${Date.now()}`;
    await notes.openForRow(0);
    await notes.type(draftText);
    await notes.cancel();
    if (!(await notes.isOpen())) {
      await notes.openForRow(0);
    }
    await notes.close();
    await logout(page);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.split('\n')[0] };
  }
}

/** The non-destructive message-level probe — never Saves. */
async function runProbe(page: Page): Promise<{
  popupVisible: boolean;
  textareaVisible: boolean;
  valueRetained: boolean;
  saveVisible: boolean;
  persistedAfterCancel: boolean;
  error?: string;
}> {
  try {
    const { chat, notes } = await loginAndReachChat(page);
    await chat.openChat(0);
    const probeText = `AQA order-diag probe ${Date.now()}`;

    await notes.openForMessage(0);
    await notes.type(probeText);
    await page.waitForTimeout(3000);

    const snap = await page.evaluate(() => {
      const popup = document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]');
      const textarea = popup ? popup.querySelector('textarea') : null;
      const saveBtn = popup
        ? Array.from(popup.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Save')
        : null;
      const popupVisible = !!popup && popup.getBoundingClientRect().width > 0;
      const textareaVisible = !!textarea && (textarea as HTMLElement).getBoundingClientRect().width > 0;
      return {
        popupVisible,
        textareaVisible,
        value: textarea ? (textarea as HTMLTextAreaElement).value : null,
        saveVisible: !!saveBtn && saveBtn.getBoundingClientRect().width > 0,
      };
    });

    const stillOpen = await notes.isOpen().catch(() => false);
    if (stillOpen) await notes.cancel().catch(() => {});
    if (!(await notes.isOpen().catch(() => false))) {
      await notes.openForMessage(0).catch(() => {});
    }
    const finalNotes = await notes.notes().catch(() => []);
    const persistedAfterCancel = finalNotes.some((n) => n.text.includes(probeText));
    await notes.close().catch(() => {});
    await logout(page);

    return {
      popupVisible: snap.popupVisible,
      textareaVisible: snap.textareaVisible,
      valueRetained: snap.value === probeText,
      saveVisible: snap.saveVisible,
      persistedAfterCancel,
    };
  } catch (e) {
    return {
      popupVisible: false,
      textareaVisible: false,
      valueRetained: false,
      saveVisible: false,
      persistedAfterCancel: false,
      error: (e as Error).message.split('\n')[0],
    };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results: Record<string, unknown> = {};

  // A: probe only
  {
    console.log('\n=== Variant A: probe only ===');
    const { context, page } = await freshContext(browser);
    const r = await runProbe(page);
    console.log(JSON.stringify(r));
    results.A = r;
    await context.close();
  }

  // B: test1 logic -> probe (fresh context for the probe, matching real per-test isolation)
  {
    console.log('\n=== Variant B: test#1 logic -> probe ===');
    const s1 = await freshContext(browser);
    const t1 = await runTest1Logic(s1.page);
    console.log('test#1 logic:', JSON.stringify(t1));
    await s1.context.close();

    const s2 = await freshContext(browser);
    const r = await runProbe(s2.page);
    console.log('probe:', JSON.stringify(r));
    results.B = { test1: t1, probe: r };
    await s2.context.close();
  }

  // C: test2 logic -> probe
  {
    console.log('\n=== Variant C: test#2 logic -> probe ===');
    const s1 = await freshContext(browser);
    const t2 = await runTest2Logic(s1.page);
    console.log('test#2 logic:', JSON.stringify(t2));
    await s1.context.close();

    const s2 = await freshContext(browser);
    const r = await runProbe(s2.page);
    console.log('probe:', JSON.stringify(r));
    results.C = { test2: t2, probe: r };
    await s2.context.close();
  }

  // D: test1 -> test2 -> probe
  {
    console.log('\n=== Variant D: test#1 -> test#2 -> probe ===');
    const s1 = await freshContext(browser);
    const t1 = await runTest1Logic(s1.page);
    console.log('test#1 logic:', JSON.stringify(t1));
    await s1.context.close();

    const s2 = await freshContext(browser);
    const t2 = await runTest2Logic(s2.page);
    console.log('test#2 logic:', JSON.stringify(t2));
    await s2.context.close();

    const s3 = await freshContext(browser);
    const r = await runProbe(s3.page);
    console.log('probe:', JSON.stringify(r));
    results.D = { test1: t1, test2: t2, probe: r };
    await s3.context.close();
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'chat-notes-order-diagnostic.json'),
    JSON.stringify({ when: new Date().toISOString(), results }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/chat-notes-order-diagnostic.json');

  await browser.close();
})();
