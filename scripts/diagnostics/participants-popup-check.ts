/**
 * Targeted follow-up: chat-view.spec.ts's "+N" participants popup test timed
 * out waiting for `[class*="header-sales_popupContainer"]` to become visible
 * after clicking the "+N" button — the click itself did not throw (so
 * moreParticipantsButton resolved to exactly one element), but the expected
 * popup selector never matched anything visible. Reproduces the exact same
 * steps and dumps the real DOM around the click instead of guessing at the
 * selector.
 *
 * Run: npx tsx scripts/diagnostics/participants-popup-check.ts
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

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  const rowCount = await chat.rowCount();
  console.log(`rowCount after This Year: ${rowCount}`);

  let openedRow = -1;
  for (let i = 0; i < Math.min(rowCount, 11); i++) {
    await chat.openChat(i);
    const hasMoreButton = await page.locator('[class*="header-sales_amountOfPersons"]').isVisible().catch(() => false);
    console.log(`row ${i}: header-sales_amountOfPersons visible=${hasMoreButton}`);
    if (hasMoreButton) {
      openedRow = i;
      break;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  if (openedRow === -1) {
    console.log('No row with a visible "+N" button found — nothing to diagnose further.');
    await context.close();
    await browser.close();
    return;
  }

  const moreButtonCount = await page.locator('[class*="header-sales_amountOfPersons"]').count();
  console.log(`\nrow ${openedRow}: header-sales_amountOfPersons match count = ${moreButtonCount}`);
  const moreButtonText = await page.locator('[class*="header-sales_amountOfPersons"]').first().textContent();
  console.log(`button text: "${moreButtonText}"`);

  await page.screenshot({ path: path.join(OUT_DIR, 'participants-before-click.png') }).catch(() => {});

  await page.locator('[class*="header-sales_amountOfPersons"]').first().click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(OUT_DIR, 'participants-after-click.png') }).catch(() => {});

  // Dump every element whose class contains "popup" or "Participants" — cast
  // a wide net instead of assuming the exact class fragment from the map is
  // still accurate.
  const candidates = await page.evaluate(() => {
    const results: Array<{ selector: string; className: string; visible: boolean; textSample: string }> = [];
    document.querySelectorAll('*').forEach((el) => {
      const cls = typeof el.className === 'string' ? el.className : '';
      if (/popup/i.test(cls) || /participant/i.test(cls) || /participant/i.test(el.textContent || '')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0 || /popup/i.test(cls)) {
          results.push({
            selector: el.tagName + (cls ? '.' + cls.split(' ').join('.') : ''),
            className: cls,
            visible: r.width > 0 && r.height > 0,
            textSample: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          });
        }
      }
    });
    return results.slice(0, 40);
  });

  console.log('\nCandidate popup/participant elements after the click:');
  for (const c of candidates) {
    console.log(`  visible=${c.visible}  class="${c.className}"  text="${c.textSample}"`);
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'participants-popup-check.json'),
    JSON.stringify({ when: new Date().toISOString(), openedRow, moreButtonCount, moreButtonText, candidates }, null, 2),
  );
  console.log('\nraw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/participants-popup-check.json');
  console.log('screenshots -> participants-before-click.png / participants-after-click.png');

  await context.close();
  await browser.close();
})();
