/**
 * Non-destructive typing diagnostic for the one remaining INCONCLUSIVE
 * blocker: the sole permitted destructive chat-notes.spec.ts run typed a
 * message-level note's text, then timed out (240s) waiting for the Save
 * button — the failure screenshot showed no popup at all, meaning it
 * disappeared sometime between type() and the click. Nothing was persisted
 * (confirmed by a fresh read-only check), so the popup vanished before any
 * write reached the server.
 *
 * This script types a unique, never-saved probe string into the same
 * textarea and WATCHES what happens for 10-15s — it never clicks Save,
 * never persists anything. Instrumented per the user's explicit request:
 *   - console + pageerror listeners
 *   - network requests/responses (notes-related only)
 *   - a MutationObserver watching the popup root's parent for the popup
 *     node itself being added/removed (mount/unmount), and separately
 *     watching the popup subtree for structural changes
 *   - focus/blur + input events on the textarea
 *   - periodic snapshots: popup visible?, textarea attached/visible?,
 *     textarea.value, Save visible/enabled, document.activeElement,
 *     mouse position vs. document.elementFromPoint at that position
 *
 * Repeats up to 3 times. Cancels (never Saves) after each cycle and
 * confirms via notes() that the probe text was never persisted.
 *
 * Run: npx tsx scripts/diagnostics/message-note-typing-check.ts
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

/** Installs a MutationObserver on document.body watching for the popup
 * container's attach/detach and any structural change once it exists, plus
 * focus/blur/input listeners on whatever textarea is inside it. Results are
 * pushed onto window.__probe (polled from Node afterwards) rather than
 * console.log'd from inside the page, to keep exact timestamps in one
 * consistent clock (performance.now()). */
async function installProbe(page: Page) {
  // No named function/const bound to a function value anywhere in this
  // callback: tsx/esbuild wraps those in an `__name(...)` call that doesn't
  // exist once Playwright serializes the callback into the browser
  // ("ReferenceError: __name is not defined") — burned twice already today.
  // Every listener below pushes to window.__probe inline instead of calling
  // a shared helper.
  await page.evaluate(() => {
    (window as any).__probe = [];

    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement && /notesPopup|dynamic-popup_popup/.test(node.className || '')) {
            (window as any).__probe.push({ t: performance.now(), label: 'popup-node-added', className: node.className });
          }
        }
        for (const node of Array.from(m.removedNodes)) {
          if (node instanceof HTMLElement && /notesPopup|dynamic-popup_popup/.test(node.className || '')) {
            (window as any).__probe.push({ t: performance.now(), label: 'popup-node-removed', className: node.className });
          }
        }
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    (window as any).__probeObserver = bodyObserver;

    document.addEventListener(
      'focus',
      (e) => {
        const t = e.target as HTMLElement;
        if (t && t.tagName === 'TEXTAREA') (window as any).__probe.push({ t: performance.now(), label: 'textarea-focus' });
      },
      true,
    );
    document.addEventListener(
      'blur',
      (e) => {
        const t = e.target as HTMLElement;
        if (t && t.tagName === 'TEXTAREA') (window as any).__probe.push({ t: performance.now(), label: 'textarea-blur' });
      },
      true,
    );
    document.addEventListener(
      'input',
      (e) => {
        const t = e.target as HTMLTextAreaElement;
        if (t && t.tagName === 'TEXTAREA')
          (window as any).__probe.push({ t: performance.now(), label: 'textarea-input', valueLength: t.value.length });
      },
      true,
    );
    document.addEventListener('click', (e) => {
      (window as any).__probe.push({ t: performance.now(), label: 'document-click', x: e.clientX, y: e.clientY });
    }, true);
  });
}

async function drainProbe(page: Page): Promise<Array<{ t: number; label: string; [k: string]: unknown }>> {
  return page.evaluate(() => {
    const events = (window as any).__probe || [];
    (window as any).__probe = [];
    return events;
  });
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const popup = document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]');
    const textarea = document.querySelector('[class*="notesPopup"] textarea, [class*="dynamic-popup_popup"] textarea') as HTMLTextAreaElement | null;
    const saveBtn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Save');
    const popupVisible = !!popup && (() => {
      const r = popup.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })();
    const textareaAttached = !!textarea && document.contains(textarea);
    const textareaVisible = textareaAttached && (() => {
      const r = (textarea as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })();
    return {
      popupVisible,
      textareaAttached,
      textareaVisible,
      textareaValue: textarea ? textarea.value : null,
      saveVisible: !!saveBtn && saveBtn.getBoundingClientRect().width > 0,
      saveDisabled: saveBtn ? (saveBtn as HTMLButtonElement).disabled : null,
      activeElementTag: document.activeElement ? document.activeElement.tagName : null,
      activeElementClass: document.activeElement ? (document.activeElement as HTMLElement).className : null,
    };
  });
}

async function elementAtMouse(page: Page, x: number, y: number) {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el
        ? { tag: el.tagName, className: typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '' }
        : null;
    },
    { x, y },
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkLog: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${new Date().toISOString()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => pageErrors.push(`[${new Date().toISOString()}] ${err.message}`));
  page.on('request', (req) => {
    if (/note/i.test(req.url())) networkLog.push(`[${new Date().toISOString()}] REQ ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (/note/i.test(res.url())) networkLog.push(`[${new Date().toISOString()}] RES ${res.status()} ${res.url()}`);
  });

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

  const results: Array<{
    cycle: number;
    variant: string;
    probeText: string;
    snapshots: Array<{ atMs: number; label: string } & Record<string, unknown>>;
    events: unknown[];
    persistedAfterCancel: boolean;
  }> = [];

  const variants: Array<'fill' | 'pressSequentially'> = ['fill', 'pressSequentially', 'pressSequentially'];

  for (let cycle = 1; cycle <= 3; cycle++) {
    const variant = variants[cycle - 1];
    console.log(`\n=== cycle ${cycle} (variant: ${variant}) ===`);
    const probeText = `AQA typing probe ${Date.now()}`;

    await notes.openForMessage(0);
    await installProbe(page);

    const t0 = Date.now();
    const snapshots: Array<{ atMs: number; label: string } & Record<string, unknown>> = [];

    const before = await snapshot(page);
    snapshots.push({ atMs: 0, label: 'before-type', ...before });
    console.log(`  before typing: popupVisible=${before.popupVisible} textareaVisible=${before.textareaVisible}`);

    if (variant === 'fill') {
      await notes.textarea.fill(probeText);
    } else {
      await notes.textarea.click();
      await page.keyboard.press('Control+a');
      await notes.textarea.pressSequentially(probeText, { delay: 12 });
    }

    const afterType = await snapshot(page);
    snapshots.push({ atMs: Date.now() - t0, label: 'immediately-after-type', ...afterType });
    console.log(`  immediately after type: popupVisible=${afterType.popupVisible} textareaAttached=${afterType.textareaAttached} value="${afterType.textareaValue}"`);

    // Watch for 12 seconds, snapshotting every 1.5s.
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(1500);
      const snap = await snapshot(page);
      const mouse = await elementAtMouse(page, 640, 360); // rough viewport center; not meaningful coords, just a sanity probe
      snapshots.push({ atMs: Date.now() - t0, label: `watch-${i}`, ...snap, elementAtCenter: mouse });
      console.log(
        `  +${Date.now() - t0}ms  popupVisible=${snap.popupVisible} textareaAttached=${snap.textareaAttached} textareaVisible=${snap.textareaVisible} value="${snap.textareaValue}" saveVisible=${snap.saveVisible} activeEl=${snap.activeElementTag}`,
      );
      if (!snap.popupVisible) {
        console.log('  *** popup disappeared during observation window ***');
        break;
      }
    }

    const events = await drainProbe(page);
    console.log(`  probe events: ${JSON.stringify(events)}`);

    // Never Save — close via Cancel if the popup is still there, else just move on.
    const stillOpen = await notes.isOpen().catch(() => false);
    if (stillOpen) {
      await notes.cancel().catch(() => {});
    }

    // Confirm the probe text was never persisted.
    let persistedAfterCancel = false;
    try {
      if (!(await notes.isOpen().catch(() => false))) {
        await notes.openForMessage(0);
      }
      const current = await notes.notes();
      persistedAfterCancel = current.some((n) => n.text.includes(probeText));
      await notes.close();
    } catch (e) {
      console.log('  could not verify non-persistence cleanly:', (e as Error).message.split('\n')[0]);
    }
    console.log(`  persisted after cancel: ${persistedAfterCancel}`);

    results.push({ cycle, variant, probeText, snapshots, events, persistedAfterCancel });
  }

  console.log(`\nconsole errors: ${JSON.stringify(consoleErrors)}`);
  console.log(`page errors: ${JSON.stringify(pageErrors)}`);
  console.log(`network activity: ${JSON.stringify(networkLog)}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'message-note-typing-check.json'),
    JSON.stringify({ when: new Date().toISOString(), results, consoleErrors, pageErrors, networkLog }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/message-note-typing-check.json');

  await context.close();
  await browser.close();
})();
