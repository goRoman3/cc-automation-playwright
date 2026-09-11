import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs } from './_helpers';
import { runAuthMatrix, renderAuthMatrix } from './_auth-checks';
import { AUTH_OPS, AUTH_DEFERRED } from './auth-checks-catalog';

/**
 * Authorization matrix (item 3) — read-only ops invoked with a degraded
 * subscription key: `valid` (control), `unscoped-own-key` (`Primary: 1` —
 * CONFIRMED blanket-500), `garbage-key-header` (junk `Ocp-Apim-Subscription-Key`
 * — APIM should 401; NEVER observed here).
 *
 * Verdicts (`_auth-checks.ts`):
 *   HARD — `CONTROL-FAIL` (valid key didn't 2xx); **`AUTH-BYPASS`** (a garbage
 *     key returned 2xx — a real security hole); `FIXED-FLIP-ME` (the unscoped
 *     key no longer blanket-500s → re-classify).
 *   SOFT — `HYPOTHESIS-FAIL` (garbage key → neither 401/403 nor an obvious
 *     "console kept the real key" 500; or the unscoped key → some other code).
 *   LOG  — `SKIP` (the 3 deferred modes: no-key / foreign-tenant / expired).
 *
 * ⚠️ NOT RUN LIVE — the account is out of company CC Test 1. `npx tsc --noEmit`
 * green is the only verification. `tests/dev-portal/UNVERIFIED.md` explains the
 * hypothetical assertions and the deferred modes.
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../artifacts/dev-portal-evidence-2026-08-29/auth-checks-matrix-latest.md',
);

test.describe('Development portal (staging) — authorization matrix', () => {
  test.describe.configure({ timeout: 20 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('degraded-key behaviour over a set of read-only ops', async ({ page, homePage }) => {
    const res = await runAuthMatrix({ page, homePage, ops: AUTH_OPS, deferred: AUTH_DEFERRED });

    const report = renderAuthMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Authorization matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    const of = (v: string): string[] =>
      res.rows.filter(r => r.verdict === v).map(r => `${r.id} ${r.mode}: ${r.observed}${r.note ? ` {${r.note}}` : ''}`);

    // ── HARD ────────────────────────────────────────────────────────────
    expect(of('CONTROL-FAIL'), 'the valid site-scoped key did NOT return 2xx — the whole matrix is meaningless this run').toEqual([]);
    expect(of('AUTH-BYPASS'), '⚠️ a request with a GARBAGE subscription key returned 2xx — an authorization bypass. File immediately.').toEqual([]);
    expect(
      of('FIXED-FLIP-ME'),
      'the unscoped `Primary: 1` key no longer blanket-500s — the documented behaviour changed. Re-classify the `unscoped-own-key` rows in _auth-checks.ts.',
    ).toEqual([]);

    // ── SOFT — the garbage-key / unscoped-key hypotheses (never observed) ──
    for (const r of res.rows.filter(x => x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(false, `HYPOTHESIS not held — ${r.id} ${r.mode}: ${r.observed}. First data point for this auth class; record it, don't loosen.`).toBe(true);
    }

    // ── LOG ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(`\nDEFERRED modes (no fixture): ${of('SKIP').length}\n` + of('SKIP').map(s => `  ${s}`).join('\n') + '\n');

    const controlOk = res.rows.filter(r => r.mode === 'valid' && r.verdict === 'OK').length;
    expect(controlOk, 'no valid-key control succeeded — nothing was actually exercised').toBeGreaterThan(0);
  });

  // ── explicit named skips for the deferred auth modes ─────────────────
  for (const d of AUTH_DEFERRED) {
    test.skip(`DEFERRED — ${d.mode}: ${d.reason}`, () => {});
  }
});
