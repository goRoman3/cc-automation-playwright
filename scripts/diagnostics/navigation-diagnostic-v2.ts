/**
 * Follow-up to navigation-diagnostic.ts. The first pass showed `load` firing
 * reliably (9-15s) with an empty body immediately afterwards, AND a second
 * top-level `GET /` that gets `net::ERR_ABORTED` a couple of seconds after
 * the first one finishes — a pattern consistent with a client-side
 * reload/redirect back to `/`, not a hung resource. The first pass's shell
 * probe ran once, immediately after `goto()` resolved — too early to tell
 * whether the app eventually renders or is stuck in a reload loop.
 *
 * This pass navigates once (`domcontentloaded`, the cheapest honest signal)
 * and then POLLS the DOM every 1s for up to 45s, logging:
 *   - document.readyState and body text length over time
 *   - the exact moment (if any) the login shell appears
 *   - every top-level navigation the page makes after the initial goto
 *     (via `page.on('framenavigated')` on the main frame), so a redirect
 *     loop shows up explicitly instead of as an unexplained duplicate GET.
 *
 * Run: npx tsx scripts/diagnostics/navigation-diagnostic-v2.ts
 */
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('BASE_URL is not set.');

const OUT_DIR = path.resolve(
  __dirname,
  '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07',
);
fs.mkdirSync(OUT_DIR, { recursive: true });

const POLL_MS = 1000;
const POLL_FOR_MS = 45_000;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const t0 = Date.now();

  const navigations: { atMs: number; url: string }[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigations.push({ atMs: Date.now() - t0, url: frame.url() });
    }
  });

  console.log(`Navigating to ${BASE_URL} with waitUntil: 'domcontentloaded'...`);
  await page.goto(BASE_URL!, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.log(`domcontentloaded resolved at +${Date.now() - t0}ms\n`);

  const snapshots: Array<{
    atMs: number;
    url: string;
    readyState: string;
    bodyTextLength: number;
    hasLoginShell: boolean;
    hasAnyReactRoot: boolean;
  }> = [];

  let firstNonEmptyBodyAtMs: number | null = null;
  let firstLoginShellAtMs: number | null = null;

  const deadline = Date.now() + POLL_FOR_MS;
  while (Date.now() < deadline) {
    const snap = await page
      .evaluate(() => ({
        url: location.href,
        readyState: document.readyState,
        bodyTextLength: (document.body?.innerText || '').trim().length,
        hasLoginShell: !!document.querySelector('#email, input[type="email"], [aria-label="company-selector"]'),
        hasAnyReactRoot: Array.from(document.querySelectorAll('div')).some((d) => d.children.length > 0),
      }))
      .catch(() => null);

    if (snap) {
      const atMs = Date.now() - t0;
      snapshots.push({ atMs, ...snap });
      if (firstNonEmptyBodyAtMs === null && snap.bodyTextLength > 0) firstNonEmptyBodyAtMs = atMs;
      if (firstLoginShellAtMs === null && snap.hasLoginShell) firstLoginShellAtMs = atMs;
      console.log(
        `+${String(atMs).padStart(6)}ms  readyState=${snap.readyState.padEnd(10)} bodyLen=${String(snap.bodyTextLength).padEnd(6)} loginShell=${snap.hasLoginShell} reactRoot=${snap.hasAnyReactRoot} url=${snap.url}`,
      );
    } else {
      console.log(`+${String(Date.now() - t0).padStart(6)}ms  evaluate() failed — page likely mid-navigation`);
    }
    await page.waitForTimeout(POLL_MS);
  }

  console.log(`\nfirst non-empty body:  ${firstNonEmptyBodyAtMs ?? 'never'}ms`);
  console.log(`first login shell:     ${firstLoginShellAtMs ?? 'never'}ms`);
  console.log(`\nmain-frame navigations observed:`);
  for (const nav of navigations) console.log(`  +${nav.atMs}ms -> ${nav.url}`);

  const outFile = path.join(OUT_DIR, 'navigation-diagnostic-v2.json');
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      { when: new Date().toISOString(), baseUrl: BASE_URL, firstNonEmptyBodyAtMs, firstLoginShellAtMs, navigations, snapshots },
      null,
      2,
    ),
  );
  console.log(`\nraw evidence -> ${path.relative(process.cwd(), outFile)}`);

  await context.close();
  await browser.close();
})();
