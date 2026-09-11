/**
 * One-off diagnostic for the `page.goto('/')` timeout that blocked the whole
 * feature/chat-listing suite on 2026-09-07 (both the new chat-view/chat-notes
 * specs AND the pre-existing search-chats.spec.ts hung identically on the
 * very first navigation, before any login attempt — see
 * local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/).
 *
 * Goal: tell apart two very different root causes that look the same from
 * inside a test:
 *   (a) staging is genuinely unreachable / the app shell never renders, or
 *   (b) the app shell renders and is interactive well before the browser
 *       `load` event fires, because some long-lived third-party resource
 *       (analytics/telemetry/websocket) never finishes loading.
 *
 * Not a Playwright test — a standalone script (this repo's existing
 * scripts/*.ts pattern, see check-email-agent.ts), because it needs to
 * navigate the SAME url three times with three different `waitUntil`
 * strategies and inspect in-flight network requests, which the test runner's
 * single-navigation-per-test model doesn't fit.
 *
 * Run: npx tsx scripts/diagnostics/navigation-diagnostic.ts
 */
import { chromium, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('BASE_URL is not set. Copy .env.example to .env and fill in the values.');

const OUT_DIR = path.resolve(
  __dirname,
  '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07',
);
fs.mkdirSync(OUT_DIR, { recursive: true });

// Hostnames/path fragments worth calling out by name if they're still
// in-flight when `load` should have fired — the usual suspects for a
// browser-level `load` that never resolves even though the SPA is usable.
const THIRD_PARTY_HINTS: Record<string, RegExp> = {
  'Google Analytics / GTM': /google-analytics\.com|googletagmanager\.com|analytics\.google/i,
  Hotjar: /hotjar\.(io|com)/i,
  'Application Insights': /applicationinsights\.azure\.com|appinsights|monitor\.azure\.com/i,
  'Microsoft Clarity': /clarity\.ms/i,
  Delighted: /delighted\.com/i,
  Twilio: /twilio\.com/i,
  'WebSocket / SignalR': /\/(signalr|hub)\/|wss?:\/\//i,
  Sentry: /sentry\.io|ingest\.sentry/i,
  Segment: /segment\.(io|com)/i,
  Intercom: /intercom\.io/i,
  Zendesk: /zendesk\.com|zdassets\.com/i,
  FullStory: /fullstory\.com/i,
};

interface RequestRecord {
  url: string;
  method: string;
  startedAtMs: number;
  finishedAtMs: number | null;
  failedAtMs: number | null;
  failureText: string | null;
  status: number | null;
  thirdParty: string | null;
}

function classify(url: string): string | null {
  for (const [name, re] of Object.entries(THIRD_PARTY_HINTS)) {
    if (re.test(url)) return name;
  }
  return null;
}

interface RunResult {
  waitUntil: 'load' | 'domcontentloaded' | 'commit';
  gotoTimedOut: boolean;
  gotoElapsedMs: number;
  gotoError: string | null;
  domContentLoadedAtMs: number | null;
  loadFiredAtMs: number | null; // observed independently of what we waited for
  finalUrl: string;
  title: string | null;
  documentReadyState: string | null;
  hasLoginShell: boolean;
  hasAppShell: boolean;
  bodyTextSample: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  stillInFlightAfterGraceWindow: RequestRecord[];
  requestLog: RequestRecord[];
}

const GRACE_WINDOW_MS = 20_000; // how long we keep watching network after the goto settles
const GOTO_TIMEOUT_MS = 30_000;

async function probeAppShell(page: Page) {
  return page
    .evaluate(() => ({
      readyState: document.readyState,
      hasLoginShell: !!document.querySelector('#email, input[type="email"], [aria-label="company-selector"]'),
      hasAppShell: !!document.querySelector('#root, #app, [id*="root" i]')?.children?.length,
      bodyTextSample: (document.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    }))
    .catch(() => ({ readyState: null, hasLoginShell: false, hasAppShell: false, bodyTextSample: null }));
}

async function runOne(waitUntil: RunResult['waitUntil']): Promise<RunResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const t0 = Date.now();
  const requests = new Map<string, RequestRecord>();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let domContentLoadedAtMs: number | null = null;
  let loadFiredAtMs: number | null = null;

  page.on('domcontentloaded', () => {
    if (domContentLoadedAtMs === null) domContentLoadedAtMs = Date.now() - t0;
  });
  page.on('load', () => {
    if (loadFiredAtMs === null) loadFiredAtMs = Date.now() - t0;
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('request', (req) => {
    requests.set(req.url() + '#' + req.method() + '#' + Date.now(), {
      url: req.url(),
      method: req.method(),
      startedAtMs: Date.now() - t0,
      finishedAtMs: null,
      failedAtMs: null,
      failureText: null,
      status: null,
      thirdParty: classify(req.url()),
    });
  });
  const keyFor = (url: string, method: string) => {
    // best-effort match back to the most recent open record for this url+method
    for (const [key, rec] of [...requests.entries()].reverse()) {
      if (rec.url === url && rec.method === method && rec.finishedAtMs === null && rec.failedAtMs === null) {
        return key;
      }
    }
    return null;
  };
  page.on('requestfinished', (req) => {
    const key = keyFor(req.url(), req.method());
    if (key) {
      const rec = requests.get(key)!;
      rec.finishedAtMs = Date.now() - t0;
      req
        .response()
        .then((r) => {
          rec.status = r?.status() ?? null;
        })
        .catch(() => {});
    }
  });
  page.on('requestfailed', (req) => {
    const key = keyFor(req.url(), req.method());
    if (key) {
      const rec = requests.get(key)!;
      rec.failedAtMs = Date.now() - t0;
      rec.failureText = req.failure()?.errorText ?? null;
    }
  });

  let gotoTimedOut = false;
  let gotoError: string | null = null;
  const gotoStart = Date.now();
  try {
    await page.goto(BASE_URL!, { waitUntil, timeout: GOTO_TIMEOUT_MS });
  } catch (err) {
    gotoTimedOut = true;
    gotoError = err instanceof Error ? err.message : String(err);
  }
  const gotoElapsedMs = Date.now() - gotoStart;

  const shellState = await probeAppShell(page);

  // Keep watching network traffic for a grace window after the goto settled,
  // so we can see (a) whether `load` ever fires and (b) what's still
  // in-flight — without that, a goto that "succeeded" on domcontentloaded
  // tells us nothing about whether load is actually reachable at all.
  await page.waitForTimeout(GRACE_WINDOW_MS);

  const requestLog = [...requests.values()].sort((a, b) => a.startedAtMs - b.startedAtMs);
  const stillInFlight = requestLog.filter((r) => r.finishedAtMs === null && r.failedAtMs === null);

  await context.close();
  await browser.close();

  return {
    waitUntil,
    gotoTimedOut,
    gotoElapsedMs,
    gotoError,
    domContentLoadedAtMs,
    loadFiredAtMs,
    finalUrl: page.url(),
    title: null, // page is closed; title captured via evaluate below is more reliable anyway
    documentReadyState: shellState.readyState,
    hasLoginShell: shellState.hasLoginShell,
    hasAppShell: !!shellState.hasAppShell,
    bodyTextSample: shellState.bodyTextSample,
    consoleErrors,
    pageErrors,
    stillInFlightAfterGraceWindow: stillInFlight,
    requestLog,
  };
}

(async () => {
  console.log(`Navigation diagnostic against ${BASE_URL}`);
  console.log(`waitUntil variants: load, domcontentloaded, commit\n`);

  const results: RunResult[] = [];
  for (const waitUntil of ['commit', 'domcontentloaded', 'load'] as const) {
    console.log(`--- waitUntil: ${waitUntil} ---`);
    const result = await runOne(waitUntil);
    results.push(result);

    console.log(`  goto ${result.gotoTimedOut ? 'TIMED OUT' : 'resolved'} after ${result.gotoElapsedMs}ms`);
    if (result.gotoError) console.log(`  error: ${result.gotoError}`);
    console.log(`  domcontentloaded at: ${result.domContentLoadedAtMs ?? 'never observed'}ms`);
    console.log(`  load fired at:       ${result.loadFiredAtMs ?? 'NEVER (within grace window)'}ms`);
    console.log(`  document.readyState: ${result.documentReadyState}`);
    console.log(`  login shell present: ${result.hasLoginShell}`);
    console.log(`  app shell present:   ${result.hasAppShell}`);
    console.log(`  body sample:         ${result.bodyTextSample}`);
    if (result.stillInFlightAfterGraceWindow.length) {
      console.log(`  still in-flight after ${GRACE_WINDOW_MS}ms grace window:`);
      for (const r of result.stillInFlightAfterGraceWindow) {
        console.log(`    [${r.thirdParty ?? 'unclassified'}] ${r.method} ${r.url} (started +${r.startedAtMs}ms)`);
      }
    } else {
      console.log('  no requests still in-flight after the grace window');
    }
    console.log('');
  }

  const outFile = path.join(OUT_DIR, 'navigation-diagnostic.json');
  fs.writeFileSync(outFile, JSON.stringify({ when: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
  console.log(`\nraw evidence -> ${path.relative(process.cwd(), outFile)}`);
})();
