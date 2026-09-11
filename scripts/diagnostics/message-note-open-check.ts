/**
 * Point diagnostic for the one remaining chat-listing blocker: opening a
 * message-level note popup via ChatNotesPopup.openForMessage(0) times out —
 * `[class*="notesPopup"], [class*="dynamic-popup_popup"]` never appears,
 * even though the failure screenshot shows a correctly-hovered note icon
 * with a badge ("4") on the topmost message.
 *
 * Does NOT call openForMessage() or any ChatNotesPopup method — inspects the
 * raw DOM by hand so a duplicate/clone/measurement node (the same shape of
 * bug already found today for `groupDateSelector`) can be told apart from a
 * genuine product failure, before touching the page object again.
 *
 * NOTE: every page.evaluate() callback below inlines its DOM-path logic
 * instead of calling a shared named helper — tsx/esbuild injects an
 * `__name(...)` wrapper around named functions that Playwright then
 * serializes and re-runs inside the browser, where that helper does not
 * exist ("ReferenceError: __name is not defined"). Anonymous inline logic
 * sidesteps it.
 *
 * Run: npx tsx scripts/diagnostics/message-note-open-check.ts
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { LoginPage } from '../../pages/login/LoginPage';
import { ChatListingPage } from '../../pages/chat-listing/ChatListingPage';
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

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkLog: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('request', (req) => {
    if (/note/i.test(req.url())) networkLog.push(`REQ  ${req.method()} ${req.url()}`);
  });
  page.on('response', (res) => {
    if (/note/i.test(res.url())) networkLog.push(`RES  ${res.status()} ${res.url()}`);
  });

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
  console.log('chat view opened for row 0');

  // ── 1. raw counts ──────────────────────────────────────────────
  const counts = await page.evaluate(() => ({
    messageCount: document.querySelectorAll('[aria-label^="Message:"]').length,
    addNoteCount: document.querySelectorAll('[aria-label^="Add note to message"]').length,
    anyNoteAttrCount: document.querySelectorAll('[aria-label*="note" i]').length,
  }));
  console.log('\n=== raw counts ===');
  console.log(JSON.stringify(counts, null, 2));

  // ── 2. candidate dump — every [aria-label*="note" i] ────────────
  const dumpCandidates = () =>
    page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('[aria-label*="note" i]'));
      return nodes.map((el, index) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el as HTMLElement);
        const nearestMessage = el.closest('[aria-label^="Message:"]');
        const badge =
          el.querySelector('[class*="badge" i], [class*="count" i]') ||
          (el.parentElement ? el.parentElement.querySelector('[class*="badge" i], [class*="count" i]') : null);
        let domPath = '';
        {
          const parts: string[] = [];
          let node: Element | null = el;
          let depth = 0;
          while (node && depth < 8) {
            const cn = typeof node.className === 'string' ? node.className : '';
            const cls = cn ? '.' + cn.split(' ').slice(0, 2).join('.') : '';
            parts.unshift(node.tagName.toLowerCase() + cls);
            node = node.parentElement;
            depth++;
          }
          domPath = parts.join(' > ');
        }
        return {
          index,
          tagName: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          textContent: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          isVisible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
          box: r.width > 0 || r.height > 0 ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null,
          disabled: (el as HTMLButtonElement).disabled ?? false,
          pointerEvents: style.pointerEvents,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          nearestMessageAriaLabel: nearestMessage ? nearestMessage.getAttribute('aria-label') : null,
          hasBadge: !!badge,
          badgeText: badge ? (badge.textContent || '').trim() : null,
          domPath,
        };
      });
    });

  console.log(`\n=== candidates BEFORE hover ===`);
  const before = await dumpCandidates();
  console.log(JSON.stringify(before, null, 2));

  // ── 3. locate the topmost VISIBLE message container (not just nth(0)) ──
  const messageContainers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-label^="Message:"]')).map((el, index) => {
      const r = el.getBoundingClientRect();
      return { index, ariaLabel: el.getAttribute('aria-label'), visible: r.width > 0 && r.height > 0, y: Math.round(r.y) };
    }),
  );
  console.log('\n=== message containers ===');
  console.log(JSON.stringify(messageContainers, null, 2));

  const firstVisibleMessage = messageContainers.find((m) => m.visible);
  if (!firstVisibleMessage) {
    console.log('\nNo visible message container found — aborting.');
    await context.close();
    await browser.close();
    return;
  }
  console.log(`\nUsing message container index ${firstVisibleMessage.index} (aria-label="${firstVisibleMessage.ariaLabel}") as the real target.`);

  const messageLocator = page.locator('[aria-label^="Message:"]').nth(firstVisibleMessage.index);
  await page.screenshot({ path: path.join(OUT_DIR, 'msg-note-1-before-hover.png') }).catch(() => {});

  await messageLocator.hover();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'msg-note-2-after-hover.png') }).catch(() => {});

  console.log(`\n=== candidates AFTER hover ===`);
  const after = await dumpCandidates();
  console.log(JSON.stringify(after, null, 2));

  // ── 4. within THIS message container, find the actionable note control ──
  const withinMessage = await messageLocator.evaluate((msgEl) => {
    const nodes = Array.from(msgEl.querySelectorAll('[aria-label*="note" i]'));
    return nodes.map((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el as HTMLElement);
      let domPath = '';
      {
        const parts: string[] = [];
        let node: Element | null = el;
        let depth = 0;
        while (node && depth < 8) {
          const cn = typeof node.className === 'string' ? node.className : '';
          const cls = cn ? '.' + cn.split(' ').slice(0, 2).join('.') : '';
          parts.unshift(node.tagName.toLowerCase() + cls);
          node = node.parentElement;
          depth++;
        }
        domPath = parts.join(' > ');
      }
      return {
        tagName: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        isVisible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        pointerEvents: style.pointerEvents,
        disabled: (el as HTMLButtonElement).disabled ?? false,
        domPath,
      };
    });
  });
  console.log(`\n=== note controls found WITHIN the target message container ===`);
  console.log(JSON.stringify(withinMessage, null, 2));

  const actionable = withinMessage.find((c) => c.isVisible && c.box.width > 0 && c.box.height > 0 && c.pointerEvents !== 'none' && !c.disabled);
  if (!actionable) {
    console.log('\nNo actionable (visible, sized, clickable) note control found inside the target message — likely PRODUCT FAILURE or the control lives outside the message container entirely.');
    fs.writeFileSync(
      path.join(OUT_DIR, 'message-note-open-check.json'),
      JSON.stringify({ when: new Date().toISOString(), counts, before, after, messageContainers, withinMessage, actionable: null, consoleErrors, pageErrors, networkLog }, null, 2),
    );
    await context.close();
    await browser.close();
    return;
  }
  console.log(`\nActionable control: ${JSON.stringify(actionable)}`);

  // ── 5. trial click, then real click, then diagnose ──────────────
  const controlLocator = messageLocator.locator(`[aria-label="${actionable.ariaLabel}"]`).first();

  const trial = await controlLocator.click({ trial: true }).then(() => 'ok').catch((e) => `FAILED: ${e.message.split('\n')[0]}`);
  console.log(`\ntrial click result: ${trial}`);

  const popupCountBefore = await page.locator('[class*="notesPopup"], [class*="dynamic-popup_popup"]').count();
  await controlLocator.click().catch((e) => console.log('real click threw:', e.message.split('\n')[0]));
  await page.waitForTimeout(1500);
  const popupCountAfterLocatorClick = await page.locator('[class*="notesPopup"], [class*="dynamic-popup_popup"]').count();
  console.log(`popup count before locator click: ${popupCountBefore}, after: ${popupCountAfterLocatorClick}`);
  await page.screenshot({ path: path.join(OUT_DIR, 'msg-note-3-after-locator-click.png') }).catch(() => {});

  let mouseClickOpenedPopup = false;
  if (popupCountAfterLocatorClick === 0) {
    console.log('\nLocator click did not open a popup — trying page.mouse.click() at the control center (DIAGNOSTIC ONLY).');
    const box = await controlLocator.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1500);
      const popupCountAfterMouseClick = await page.locator('[class*="notesPopup"], [class*="dynamic-popup_popup"]').count();
      mouseClickOpenedPopup = popupCountAfterMouseClick > 0;
      console.log(`popup count after mouse.click(): ${popupCountAfterMouseClick}`);
      await page.screenshot({ path: path.join(OUT_DIR, 'msg-note-4-after-mouse-click.png') }).catch(() => {});
    } else {
      console.log('no bounding box available for mouse.click() fallback');
    }
  }

  console.log(`\nconsole errors: ${JSON.stringify(consoleErrors)}`);
  console.log(`page errors: ${JSON.stringify(pageErrors)}`);
  console.log(`note-related network activity: ${JSON.stringify(networkLog)}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'message-note-open-check.json'),
    JSON.stringify(
      {
        when: new Date().toISOString(),
        counts,
        before,
        after,
        messageContainers,
        withinMessage,
        actionable,
        trial,
        popupCountBefore,
        popupCountAfterLocatorClick,
        mouseClickOpenedPopup,
        consoleErrors,
        pageErrors,
        networkLog,
      },
      null,
      2,
    ),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/message-note-open-check.json');

  await context.close();
  await browser.close();
})();
