/**
 * Product-focused investigation: does the message-note editor intermittently
 * crash on COLD initialization (fresh BrowserContext, fresh login, first-ever
 * interaction with the editor in that session), correlating with an
 * application-thrown `Cannot read properties of undefined (reading
 * 'dispose')` exception?
 *
 * Every cycle is a fully independent session: new BrowserContext, new Page,
 * fresh login, fresh company switch, fresh navigation. Nothing is reused or
 * "warmed up" from a prior cycle. Never clicks Save. Never persists data.
 *
 * Run: npx tsx scripts/diagnostics/message-note-cold-session-check.ts
 */
import { chromium, type Page } from '@playwright/test';
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

const CYCLES_MESSAGE_A = 8;
const MESSAGE_A_INDEX = 0; // known to have existing notes (>0)

interface PageErrorRecord {
  atMs: number;
  name: string;
  message: string;
  stack: string | null;
}
interface ConsoleErrorRecord {
  atMs: number;
  type: string;
  text: string;
  location: string | null;
}
interface CycleResult {
  cycle: number;
  messageLabel: string;
  messageIndex: number;
  existingNoteCountBefore: number | null;
  popupClosedUnexpectedly: boolean;
  disposePageError: boolean;
  otherPageErrors: PageErrorRecord[];
  consoleErrors: ConsoleErrorRecord[];
  saveVisibleAtEnd: boolean | null;
  translateIframePresentAtCrash: boolean | null;
  networkLog: string[];
  lifecycleEvents: Array<{ atMs: number; label: string; [k: string]: unknown }>;
  persistedAfterCancel: boolean | null;
  scriptError: string | null;
}

async function installLifecycleObserver(page: Page) {
  // No named function/const bound to a function value in this callback:
  // tsx/esbuild wraps those with `__name(...)`, which does not exist once
  // Playwright serializes the callback into the browser.
  await page.evaluate(() => {
    (window as any).__lifecycle = [];
    (window as any).__lifecycle.push({ t: performance.now(), label: 'observer-installed' });

    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (/notesPopup|dynamic-popup_popup/.test(node.className || '')) {
              (window as any).__lifecycle.push({ t: performance.now(), label: 'popup-attached', className: node.className });
            }
          }
        }
        for (const node of Array.from(m.removedNodes)) {
          if (node instanceof HTMLElement) {
            if (/notesPopup|dynamic-popup_popup/.test(node.className || '')) {
              (window as any).__lifecycle.push({ t: performance.now(), label: 'popup-removed', className: node.className });
            }
          }
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    (window as any).__lifecycleObserver = bodyObserver;

    document.addEventListener(
      'focus',
      (e) => {
        const t = e.target as HTMLElement;
        if (t && t.tagName === 'TEXTAREA') (window as any).__lifecycle.push({ t: performance.now(), label: 'textarea-focused' });
      },
      true,
    );
    document.addEventListener(
      'input',
      (e) => {
        const t = e.target as HTMLTextAreaElement;
        if (t && t.tagName === 'TEXTAREA')
          (window as any).__lifecycle.push({ t: performance.now(), label: 'textarea-input', valueLength: t.value.length });
      },
      true,
    );
  });
}

async function drainLifecycle(page: Page): Promise<Array<{ atMs: number; label: string; [k: string]: unknown }>> {
  const raw = await page.evaluate(() => (window as any).__lifecycle || []);
  const t0 = raw.length ? raw[0].t : 0;
  return raw.map((e: any) => ({ atMs: Math.round(e.t - t0), label: e.label, ...(e.className ? { className: e.className } : {}), ...(e.valueLength !== undefined ? { valueLength: e.valueLength } : {}) }));
}

async function checkTranslateIframe(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.querySelector('iframe.skiptranslate, .skiptranslate iframe');
    return !!el && el.getBoundingClientRect().width > 0;
  }).catch(() => false);
}

async function runColdCycle(browser: import('@playwright/test').Browser, cycle: number, messageIndex: number, messageLabel: string): Promise<CycleResult> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  const pageErrors: PageErrorRecord[] = [];
  const consoleErrors: ConsoleErrorRecord[] = [];
  const networkLog: string[] = [];
  const t0 = Date.now();

  page.on('pageerror', (err) => {
    pageErrors.push({ atMs: Date.now() - t0, name: err.name, message: err.message, stack: err.stack ?? null });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const loc = msg.location();
      consoleErrors.push({
        atMs: Date.now() - t0,
        type: msg.type(),
        text: msg.text(),
        location: loc ? `${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : null,
      });
    }
  });
  page.on('request', (req) => {
    if (/note/i.test(req.url())) networkLog.push(`+${Date.now() - t0}ms REQ ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (/note/i.test(res.url())) networkLog.push(`+${Date.now() - t0}ms RES ${res.status()} ${res.url()}`);
  });
  page.on('requestfailed', (req) => {
    if (/note/i.test(req.url())) networkLog.push(`+${Date.now() - t0}ms FAILED ${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`);
  });

  let scriptError: string | null = null;
  let existingNoteCountBefore: number | null = null;
  let popupClosedUnexpectedly = false;
  let saveVisibleAtEnd: boolean | null = null;
  let translateIframePresentAtCrash: boolean | null = null;
  let persistedAfterCancel: boolean | null = null;

  try {
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

    await notes.openForMessage(messageIndex);
    const existing = await notes.notes();
    existingNoteCountBefore = existing.length;

    await installLifecycleObserver(page);

    const probeText = `AQA cold probe ${cycle}`;
    await notes.type(probeText);

    for (let i = 0; i < 7; i++) {
      await page.waitForTimeout(1500);
      const open = await notes.isOpen().catch(() => false);
      if (!open) {
        popupClosedUnexpectedly = true;
        translateIframePresentAtCrash = await checkTranslateIframe(page);
        break;
      }
    }

    if (!popupClosedUnexpectedly) {
      saveVisibleAtEnd = await notes.saveButton.isVisible().catch(() => false);
    }

    const stillOpen = await notes.isOpen().catch(() => false);
    if (stillOpen) {
      await notes.cancel().catch(() => {});
    }
    if (!(await notes.isOpen().catch(() => false))) {
      await notes.openForMessage(messageIndex).catch(() => {});
    }
    const finalNotes = await notes.notes().catch(() => []);
    persistedAfterCancel = finalNotes.some((n) => n.text.includes(probeText));
    await notes.close().catch(() => {});
  } catch (e) {
    scriptError = (e as Error).message.split('\n')[0];
  }

  const lifecycleEvents = await drainLifecycle(page).catch(() => []);
  const disposePageError = pageErrors.some((p) => /dispose/i.test(p.message));

  await context.close().catch(() => {});

  return {
    cycle,
    messageLabel,
    messageIndex,
    existingNoteCountBefore,
    popupClosedUnexpectedly,
    disposePageError,
    otherPageErrors: pageErrors.filter((p) => !/dispose/i.test(p.message)),
    consoleErrors,
    saveVisibleAtEnd,
    translateIframePresentAtCrash,
    networkLog,
    lifecycleEvents,
    persistedAfterCancel,
    scriptError,
  };
}

/** Scans the open chat for a message whose note-icon badge is empty (0 existing notes). Read-only. */
async function findZeroNoteMessage(browser: import('@playwright/test').Browser): Promise<number | null> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  let found: number | null = null;
  try {
    const login = new LoginPage(page);
    const chat = new ChatListingPage(page);
    await login.goto();
    await login.login(EMAIL!, PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await new CompanySelector(page).switchTo('SmarshCR Sales');
    await chat.goto();
    await chat.dismissAnnouncement();
    await chat.setDateRange('This Year');
    await chat.openChat(0);

    const messages = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label^="Message:"]')).length);
    for (let i = 0; i < messages; i++) {
      const msg = page.locator('[aria-label^="Message:"]').nth(i);
      await msg.hover();
      const icon = msg.locator('[aria-label^="Add note to message"]').first();
      const count = await icon.count();
      if (count === 0) continue;
      const text = (await icon.textContent().catch(() => ''))?.trim() ?? '';
      if (text === '') {
        found = i;
        break;
      }
    }
  } catch {
    /* best-effort scan */
  }
  await context.close().catch(() => {});
  return found;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results: CycleResult[] = [];

  console.log(`=== Message A (index ${MESSAGE_A_INDEX}, known existing notes > 0) — ${CYCLES_MESSAGE_A} cold cycles ===`);
  for (let cycle = 1; cycle <= CYCLES_MESSAGE_A; cycle++) {
    console.log(`\n--- cold cycle ${cycle} ---`);
    const r = await runColdCycle(browser, cycle, MESSAGE_A_INDEX, 'A');
    results.push(r);
    console.log(
      `  existingNotesBefore=${r.existingNoteCountBefore} popupClosedUnexpectedly=${r.popupClosedUnexpectedly} disposeError=${r.disposePageError} otherPageErrors=${r.otherPageErrors.length} saveVisibleAtEnd=${r.saveVisibleAtEnd} persistedAfterCancel=${r.persistedAfterCancel} scriptError=${r.scriptError}`,
    );
    if (r.otherPageErrors.length) console.log('  other pageerrors:', JSON.stringify(r.otherPageErrors));
    if (r.popupClosedUnexpectedly) console.log('  lifecycle:', JSON.stringify(r.lifecycleEvents));
  }

  console.log(`\n=== Scanning for a zero-note message (Message B) in the same chat ===`);
  const zeroIdx = await findZeroNoteMessage(browser);
  if (zeroIdx === null) {
    console.log('No message with an empty note badge found — Message B: TEST DATA MISSING.');
  } else {
    console.log(`Found zero-note message at index ${zeroIdx}. Running 2 cold cycles.`);
    for (let cycle = 1; cycle <= 2; cycle++) {
      console.log(`\n--- Message B cold cycle ${cycle} ---`);
      const r = await runColdCycle(browser, cycle, zeroIdx, 'B');
      results.push(r);
      console.log(
        `  existingNotesBefore=${r.existingNoteCountBefore} popupClosedUnexpectedly=${r.popupClosedUnexpectedly} disposeError=${r.disposePageError} otherPageErrors=${r.otherPageErrors.length} saveVisibleAtEnd=${r.saveVisibleAtEnd} persistedAfterCancel=${r.persistedAfterCancel} scriptError=${r.scriptError}`,
      );
    }
  }

  const crashes = results.filter((r) => r.popupClosedUnexpectedly);
  const disposeErrors = results.filter((r) => r.disposePageError);
  const both = results.filter((r) => r.popupClosedUnexpectedly && r.disposePageError);
  const disposeWithoutCrash = results.filter((r) => r.disposePageError && !r.popupClosedUnexpectedly);
  const crashWithoutDispose = results.filter((r) => r.popupClosedUnexpectedly && !r.disposePageError);

  console.log(`\n=== SUMMARY ===`);
  console.log(`total cycles: ${results.length}`);
  console.log(`popup closed unexpectedly: ${crashes.length}`);
  console.log(`dispose pageerror seen: ${disposeErrors.length}`);
  console.log(`both together: ${both.length}`);
  console.log(`dispose WITHOUT crash: ${disposeWithoutCrash.length}`);
  console.log(`crash WITHOUT dispose: ${crashWithoutDispose.length}`);
  console.log(`Message B zero-note index: ${zeroIdx === null ? 'TEST DATA MISSING' : zeroIdx}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'message-note-cold-session-check.json'),
    JSON.stringify({ when: new Date().toISOString(), zeroNoteMessageIndex: zeroIdx, results }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/message-note-cold-session-check.json');

  await browser.close();
})();
