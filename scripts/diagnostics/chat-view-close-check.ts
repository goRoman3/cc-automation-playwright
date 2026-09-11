/**
 * Finds the real selector for the chat view side-modal's explicit close (X)
 * button — Escape stopped reliably closing it in one specific sequence
 * (close a ChatNotesPopup that was opened via openForMessage, then try to
 * close the ChatViewModal): confirmed live 2026-09-07, the side-modal stayed
 * open through two Escape presses in a row while chat-view.spec.ts's own
 * standalone `chatViewModal.close()` call (no prior notes interaction)
 * keeps passing every time.
 *
 * Run: npx tsx scripts/diagnostics/chat-view-close-check.ts
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { LoginPage } from '../../pages/login/LoginPage';
import { ChatListingPage } from '../../pages/chat-listing/ChatListingPage';
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

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await chat.openChat(0);

  const candidates = await page.evaluate(() => {
    const root = document.querySelector('[class*="side-modal_shadowContainer"]');
    if (!root) return [];
    // Anything in the top ~60px of the modal that looks clickable.
    const all = Array.from(root.querySelectorAll('*'));
    return all
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < 60 && r.width > 0 && r.width < 60 && r.height > 0 && r.height < 60;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className : '',
          ariaLabel: el.getAttribute('aria-label'),
          role: el.getAttribute('role'),
          box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          childCount: el.children.length,
        };
      });
  });
  console.log('small elements in the top-right area of the side modal:');
  console.log(JSON.stringify(candidates, null, 2));

  await context.close();
  await browser.close();
})();
