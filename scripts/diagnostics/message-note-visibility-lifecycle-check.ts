/**
 * Deep investigation of the unexpected message-note popup close (5/10 cold
 * sessions in the prior diagnostic, uncorrelated with the `dispose`
 * exception). This pass does not assume a JS exception is required — it
 * hunts directly for evidence of WHO/WHAT closes the popup: a real user-like
 * event captured on document (capture phase) immediately before the
 * visible->hidden transition, or a silent style/class/attribute change with
 * nothing preceding it (the stronger product-failure signal).
 *
 * Every cycle: fresh BrowserContext, fresh login, never Saves, never moves
 * the mouse after focusing the textarea, types via pressSequentially() at a
 * normal pace, and captures a screenshot + full DOM/event snapshot the
 * INSTANT a visible->hidden transition is detected (polled every ~100ms
 * from Node, backed by a MutationObserver + interval inside the page).
 *
 * Run: npx tsx scripts/diagnostics/message-note-visibility-lifecycle-check.ts
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

const CYCLES = 7;
const MESSAGE_INDEX = 0;

async function installInstrumentation(page: Page) {
  // Every callback below is passed inline as an argument (to
  // addEventListener/setInterval/new MutationObserver), never bound to a
  // named const first — tsx/esbuild wraps named function values with
  // `__name(...)`, which throws once Playwright serializes this callback
  // into the browser.
  await page.evaluate(() => {
    (window as any).__t0 = performance.now();
    (window as any).__events = [];
    (window as any).__hideDetected = null;
    (window as any).__navEvents = [];

    const types = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'focus', 'blur', 'focusin', 'focusout'];
    for (const type of types) {
      document.addEventListener(
        type,
        (e) => {
          const t = e.target as HTMLElement | null;
          const rec: Record<string, unknown> = {
            atMs: Math.round(performance.now() - (window as any).__t0),
            type,
            targetTag: t ? t.tagName : null,
            targetAriaLabel: t ? t.getAttribute('aria-label') : null,
            targetClass: t && typeof t.className === 'string' ? t.className : null,
          };
          if (e instanceof KeyboardEvent) rec.key = e.key;
          if (e instanceof MouseEvent) {
            rec.x = e.clientX;
            rec.y = e.clientY;
          }
          if (e instanceof FocusEvent) {
            const rt = e.relatedTarget as HTMLElement | null;
            rec.relatedTargetTag = rt ? rt.tagName : null;
            rec.relatedTargetClass = rt && typeof rt.className === 'string' ? rt.className : null;
          }
          (window as any).__events.push(rec);
        },
        true,
      );
    }

    const popup = document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]');
    if (popup) {
      (window as any).__popupInitialClass = popup.className;
      let lastOk = true;
      let lastClass = popup.className;
      let lastStyle = popup.getAttribute('style') || '';
      let lastHidden = popup.getAttribute('hidden');
      let lastAriaHidden = popup.getAttribute('aria-hidden');

      // The same check logic is deliberately duplicated below (interval +
      // MutationObserver) instead of factored into a shared `check`
      // function: a named const holding a function value is exactly what
      // triggers esbuild's `__name(...)` wrapping once tsx compiles this
      // file, and that helper does not exist once Playwright serializes the
      // callback into the browser. Every callback here is created inline,
      // directly as the argument to setInterval/addEventListener/
      // MutationObserver, never assigned to a name first.
      (window as any).__visibilityInterval = setInterval(() => {
        const attached = document.contains(popup);
        const r = attached ? (popup as HTMLElement).getBoundingClientRect() : { width: 0, height: 0 };
        const cs = attached ? getComputedStyle(popup as HTMLElement) : null;
        const ok = attached && r.width > 0 && r.height > 0 && (!cs || (cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'));

        if (!ok && lastOk && !(window as any).__hideDetected) {
          (window as any).__hideDetected = {
            atMs: Math.round(performance.now() - (window as any).__t0),
            attached,
            width: r.width,
            height: r.height,
            display: cs ? cs.display : null,
            visibility: cs ? cs.visibility : null,
            opacity: cs ? cs.opacity : null,
            oldClass: lastClass,
            newClass: attached ? popup.className : '(detached)',
            oldStyle: lastStyle,
            newStyle: attached ? popup.getAttribute('style') || '' : '(detached)',
            oldHidden: lastHidden,
            newHidden: attached ? popup.getAttribute('hidden') : '(detached)',
            oldAriaHidden: lastAriaHidden,
            newAriaHidden: attached ? popup.getAttribute('aria-hidden') : '(detached)',
            activeElementTag: document.activeElement ? document.activeElement.tagName : null,
            activeElementClass:
              document.activeElement && typeof (document.activeElement as HTMLElement).className === 'string'
                ? (document.activeElement as HTMLElement).className
                : null,
            source: 'interval',
          };
        }
        lastOk = ok;
        if (attached) {
          lastClass = popup.className;
          lastStyle = popup.getAttribute('style') || '';
          lastHidden = popup.getAttribute('hidden');
          lastAriaHidden = popup.getAttribute('aria-hidden');
        }
      }, 100);

      const mo = new MutationObserver(() => {
        const attached = document.contains(popup);
        const r = attached ? (popup as HTMLElement).getBoundingClientRect() : { width: 0, height: 0 };
        const cs = attached ? getComputedStyle(popup as HTMLElement) : null;
        const ok = attached && r.width > 0 && r.height > 0 && (!cs || (cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'));

        if (!ok && lastOk && !(window as any).__hideDetected) {
          (window as any).__hideDetected = {
            atMs: Math.round(performance.now() - (window as any).__t0),
            attached,
            width: r.width,
            height: r.height,
            display: cs ? cs.display : null,
            visibility: cs ? cs.visibility : null,
            opacity: cs ? cs.opacity : null,
            oldClass: lastClass,
            newClass: attached ? popup.className : '(detached)',
            oldStyle: lastStyle,
            newStyle: attached ? popup.getAttribute('style') || '' : '(detached)',
            oldHidden: lastHidden,
            newHidden: attached ? popup.getAttribute('hidden') : '(detached)',
            oldAriaHidden: lastAriaHidden,
            newAriaHidden: attached ? popup.getAttribute('aria-hidden') : '(detached)',
            activeElementTag: document.activeElement ? document.activeElement.tagName : null,
            activeElementClass:
              document.activeElement && typeof (document.activeElement as HTMLElement).className === 'string'
                ? (document.activeElement as HTMLElement).className
                : null,
            source: 'mutation-observer',
          };
        }
        lastOk = ok;
        if (attached) {
          lastClass = popup.className;
          lastStyle = popup.getAttribute('style') || '';
          lastHidden = popup.getAttribute('hidden');
          lastAriaHidden = popup.getAttribute('aria-hidden');
        }
      });
      mo.observe(popup, {
        attributes: true,
        attributeOldValue: true,
        childList: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
      });
      mo.observe(document.body, { childList: true });
      (window as any).__visibilityObserver = mo;
    }
  });
}

interface CrashSnapshot {
  hideDetected: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
  eventsNear: Array<Record<string, unknown>>;
  elementAtMouse: { tag: string; className: string } | null;
  overlays: {
    profileMenuVisible: boolean;
    translateIframeVisible: boolean;
    kendoContainerCount: number;
    otherPopupCount: number;
  };
  activeElementTag: string | null;
  url: string;
}

async function captureCrashSnapshot(page: Page, mouseX: number, mouseY: number): Promise<CrashSnapshot> {
  return page.evaluate(
    ({ mx, my }) => {
      const hideDetected = (window as any).__hideDetected || null;
      const events: Array<Record<string, unknown>> = (window as any).__events || [];
      const nearMs = hideDetected ? (hideDetected as any).atMs : null;
      const eventsNear = nearMs === null ? [] : events.filter((e: any) => Math.abs(e.atMs - nearMs) <= 2000);

      const el = document.elementFromPoint(mx, my);
      const elementAtMouse = el ? { tag: el.tagName, className: typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '' } : null;

      const profileMenu = document.querySelector('[class*="usersInfoPopup"]');
      const profileMenuVisible = !!profileMenu && profileMenu.getBoundingClientRect().width > 0;
      const translateIframe = document.querySelector('iframe.skiptranslate, .skiptranslate iframe');
      const translateIframeVisible = !!translateIframe && translateIframe.getBoundingClientRect().width > 0;
      const kendoContainerCount = document.querySelectorAll('.k-animation-container, .k-popup').length;
      const otherPopupCount = document.querySelectorAll('[class*="notesPopup"], [class*="dynamic-popup_popup"]').length;

      return {
        hideDetected,
        events: events.slice(-40),
        eventsNear,
        elementAtMouse,
        overlays: { profileMenuVisible, translateIframeVisible, kendoContainerCount, otherPopupCount },
        activeElementTag: document.activeElement ? document.activeElement.tagName : null,
        url: location.href,
      };
    },
    { mx: mouseX, my: mouseY },
  );
}

interface CycleResult {
  cycle: number;
  existingNotesBefore: number | null;
  crashed: boolean;
  snapshot: CrashSnapshot | null;
  navEvents: string[];
  networkNear: string[];
  persistedAfterCancel: boolean | null;
  scriptError: string | null;
}

async function runCycle(browser: import('@playwright/test').Browser, cycle: number): Promise<CycleResult> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const t0 = Date.now();
  const networkAll: string[] = [];
  const navEvents: string[] = [];

  page.on('request', (req) => {
    const type = req.resourceType();
    if (type === 'xhr' || type === 'fetch' || type === 'document' || type === 'websocket') {
      networkAll.push(`+${Date.now() - t0}ms REQ ${type} ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    const type = res.request().resourceType();
    if (type === 'xhr' || type === 'fetch' || type === 'document' || type === 'websocket') {
      networkAll.push(`+${Date.now() - t0}ms RES ${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    networkAll.push(`+${Date.now() - t0}ms FAILED ${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`);
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navEvents.push(`+${Date.now() - t0}ms framenavigated -> ${frame.url()}`);
  });
  page.on('load', () => navEvents.push(`+${Date.now() - t0}ms load`));
  page.on('domcontentloaded', () => navEvents.push(`+${Date.now() - t0}ms domcontentloaded`));

  let scriptError: string | null = null;
  let existingNotesBefore: number | null = null;
  let crashed = false;
  let snapshot: CrashSnapshot | null = null;
  let persistedAfterCancel: boolean | null = null;
  let networkNear: string[] = [];

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
    const rows = await chat.rowCount();
    if (rows <= 0) {
      await context.close().catch(() => {});
      return { cycle, existingNotesBefore: null, crashed: false, snapshot: null, navEvents, networkNear: [], persistedAfterCancel: null, scriptError: 'no rows for This Year' };
    }
    await chat.openChat(0);

    await notes.openForMessage(MESSAGE_INDEX);
    const existing = await notes.notes();
    existingNotesBefore = existing.length;

    await installInstrumentation(page);

    // Move the mouse into the textarea once (also focuses it) and never again.
    const box = await notes.textarea.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await notes.textarea.click();
    }
    await page.keyboard.press('Control+a');

    const probeText = `AQA vis-lifecycle probe ${cycle}`;
    const networkMarkStart = Date.now() - t0;
    await notes.textarea.pressSequentially(probeText, { delay: 12 });

    const mouseX = box ? box.x + box.width / 2 : 640;
    const mouseY = box ? box.y + box.height / 2 : 360;

    // Poll fast (150ms) for up to 10s for the hide-detection flag.
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const hidden = await page.evaluate(() => !!(window as any).__hideDetected).catch(() => false);
      if (hidden) {
        crashed = true;
        break;
      }
      await page.waitForTimeout(150);
    }

    if (crashed) {
      snapshot = await captureCrashSnapshot(page, mouseX, mouseY).catch(() => null);
      await page.screenshot({ path: path.join(OUT_DIR, `cold-cycle-${cycle}-popup-close.png`) }).catch(() => {});
      if (snapshot) {
        fs.writeFileSync(path.join(OUT_DIR, `cold-cycle-${cycle}-popup-close.json`), JSON.stringify(snapshot, null, 2));
      }
      const networkMarkEnd = Date.now() - t0;
      networkNear = networkAll.filter((line) => {
        const m = line.match(/^\+(\d+)ms/);
        if (!m) return false;
        const ms = Number(m[1]);
        return ms >= networkMarkStart - 5000 && ms <= networkMarkEnd + 5000;
      });
    }

    const stillOpen = await notes.isOpen().catch(() => false);
    if (stillOpen) {
      await notes.cancel().catch(() => {});
    }
    if (!(await notes.isOpen().catch(() => false))) {
      await notes.openForMessage(MESSAGE_INDEX).catch(() => {});
    }
    const finalNotes = await notes.notes().catch(() => []);
    persistedAfterCancel = finalNotes.some((n) => n.text.includes(probeText));
    await notes.close().catch(() => {});
  } catch (e) {
    scriptError = (e as Error).message.split('\n')[0];
  }

  await context.close().catch(() => {});
  return { cycle, existingNotesBefore, crashed, snapshot, navEvents, networkNear, persistedAfterCancel, scriptError };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results: CycleResult[] = [];

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n--- cycle ${cycle} ---`);
    const r = await runCycle(browser, cycle);
    results.push(r);
    console.log(
      `  existingNotesBefore=${r.existingNotesBefore} crashed=${r.crashed} persistedAfterCancel=${r.persistedAfterCancel} scriptError=${r.scriptError}`,
    );
    if (r.crashed && r.snapshot) {
      console.log('  hideDetected:', JSON.stringify(r.snapshot.hideDetected));
      console.log('  eventsNear (±2s of hide):', JSON.stringify(r.snapshot.eventsNear));
      console.log('  overlays:', JSON.stringify(r.snapshot.overlays));
      console.log('  networkNear:', JSON.stringify(r.networkNear));
      console.log('  navEvents:', JSON.stringify(r.navEvents));
    }
  }

  const crashes = results.filter((r) => r.crashed);
  console.log(`\n=== SUMMARY: ${crashes.length}/${results.length} crashed ===`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'message-note-visibility-lifecycle-check.json'),
    JSON.stringify({ when: new Date().toISOString(), results }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/message-note-visibility-lifecycle-check.json');

  await browser.close();
})();
