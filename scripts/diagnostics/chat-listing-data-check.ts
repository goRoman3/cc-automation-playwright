/**
 * Distinguishes TEST DATA MISSING from TEST HARNESS FAILURE for the
 * "This Year returns 0 chats" result the chat-view/chat-notes beforeEach hit
 * on 2026-09-07 for both Charl_Test (search-chats.spec.ts, no company
 * switch) and SmarshCR Sales (chat-view.spec.ts, via CompanySelector).
 *
 * Runs the exact same steps as those specs' beforeEach, using the real page
 * objects (not a reimplementation), plus extra instrumentation the specs
 * don't have room for: a screenshot and the applied-filter chip text right
 * before reading rowCount(), so we can see whether "This Year" actually got
 * applied or the UI silently stayed on "Last 7 Days" (which would point at
 * our own setDateRange()/CompanySelector sequencing, not real data).
 *
 * Run: npx tsx scripts/diagnostics/chat-listing-data-check.ts
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
if (!BASE_URL) throw new Error('BASE_URL is not set.');
if (!EMAIL || !PASSWORD) throw new Error('TEST_EMAIL / TEST_PASSWORD are not set.');

const OUT_DIR = path.resolve(
  __dirname,
  '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07',
);
fs.mkdirSync(OUT_DIR, { recursive: true });

async function checkCompany(company: string | null) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const label = company ?? 'default company';
  console.log(`\n=== ${label} ===`);

  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const t0 = Date.now();

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  console.log(`login done at +${Date.now() - t0}ms`);

  if (company) {
    const selector = new CompanySelector(page);
    await selector.switchTo(company);
    console.log(`company switch done at +${Date.now() - t0}ms, combobox now reads: "${await selector.current()}"`);
  }

  await chat.goto();
  await chat.dismissAnnouncement();
  console.log(`chat listing loaded at +${Date.now() - t0}ms`);

  const beforeRows = await chat.rowCount();
  const beforeEmpty = await chat.isEmpty();
  const beforeChip = await page.locator('[class*="applied-filter"]').allTextContents();
  console.log(`before setDateRange: rows=${beforeRows} empty=${beforeEmpty} appliedFilterChips=${JSON.stringify(beforeChip)}`);

  await chat.setDateRange('This Year');
  console.log(`setDateRange('This Year') done at +${Date.now() - t0}ms`);

  const afterRows = await chat.rowCount();
  const afterEmpty = await chat.isEmpty();
  const afterChip = await page.locator('[class*="applied-filter"]').allTextContents();
  const pagerText = await chat.pagerText();
  console.log(`after setDateRange: rows=${afterRows} empty=${afterEmpty} appliedFilterChips=${JSON.stringify(afterChip)} pager="${pagerText}"`);

  const shotName = `data-check-${(company ?? 'default').replace(/\s+/g, '-')}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, shotName), fullPage: false }).catch(() => {});
  console.log(`screenshot -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/${shotName}`);

  await context.close();
  await browser.close();

  return { company: label, beforeRows, beforeEmpty, beforeChip, afterRows, afterEmpty, afterChip, pagerText };
}

(async () => {
  const results = [];
  results.push(await checkCompany(null)); // default company (Charl_Test), same as search-chats.spec.ts
  results.push(await checkCompany('SmarshCR Sales')); // same as chat-view.spec.ts / chat-notes.spec.ts

  const outFile = path.join(OUT_DIR, 'chat-listing-data-check.json');
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), results }, null, 2));
  console.log(`\nraw evidence -> ${path.relative(process.cwd(), outFile)}`);
})();
