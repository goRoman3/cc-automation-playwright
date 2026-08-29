import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs } from './_helpers';
import { runContractMatrix, renderContractMatrix } from './_contract-checks';
import { CONTRACT_SPECS, CONTRACT_EXCLUDED } from './contract-checks-catalog';

/**
 * Response-contract matrix (item 2) — structure / type assertions against the
 * response bodies of a set of ops invoked with their confirmed-valid request.
 *
 * Pins the two CONFIRMED contract bugs of this class (`expect: 'known-bug'` —
 * `OK` while present, `FIXED-FLIP-ME` when fixed):
 *   · Get/List Agent response `customerId` = all-zero GUID (CONTRACT-AGENT-CUSTOMERID)
 *   · Create Agent Group response `id` = 0 (P1-CREATE-AGENT-GROUP-ID-ZERO)
 * with `Create Agent` as the contrast (its `customerId` IS real).
 *
 * Verdicts (`_contract-checks.ts`):
 *   HARD — `CONTROL-FAIL` (couldn't get a 2xx to inspect); `CONTRACT-VIOLATION`
 *     (a documented-correct assertion failed — a NEW contract break);
 *     `FIXED-FLIP-ME` (a `known-bug` assertion now passes → the bug is fixed,
 *     flip `expect` to `'ok'`).
 *   SOFT — `HYPOTHESIS-FAIL` (a structure/type guess didn't hold — first data point).
 *   LOG  — `RECORDED` (`needs-schema-confirmation`), `ERROR`, `leftovers`.
 *
 * ⚠️ NOT RUN LIVE — the account is out of company CC Test 1. `npx tsc --noEmit`
 * green is the only verification. `tests/dev-portal/UNVERIFIED.md` lists which
 * assertions are hypothetical.
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../artifacts/dev-portal-evidence-2026-08-29/contract-checks-matrix-latest.md',
);

test.describe('Development portal (staging) — response-contract matrix', () => {
  test.describe.configure({ timeout: 20 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('invoke + response-shape assertions over every in-scope op', async ({ page, homePage }) => {
    const res = await runContractMatrix({ page, homePage, specs: CONTRACT_SPECS });

    const report = renderContractMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Response-contract matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    const of = (v: string): string[] =>
      res.rows.filter(r => r.verdict === v).map(r => `${r.id} ${r.assertion}: ${r.observed}${r.note ? ` {${r.note}}` : ''}`);

    // ── HARD ────────────────────────────────────────────────────────────
    expect(of('CONTROL-FAIL'), 'an op could not be invoked with its valid request — its contract rows are meaningless').toEqual([]);
    expect(of('CONTRACT-VIOLATION'), 'a documented-correct response assertion FAILED — a new contract break; investigate, do not loosen').toEqual([]);
    expect(
      of('FIXED-FLIP-ME'),
      'a `known-bug` contract assertion now PASSES — the bug is fixed (CONTRACT-AGENT-CUSTOMERID / P1-CREATE-AGENT-GROUP-ID-ZERO). Change that assertion\'s `expect` to `\'ok\'` in contract-checks-catalog.ts.',
    ).toEqual([]);

    // ── SOFT — structure/type guesses ──────────────────────────────────
    for (const r of res.rows.filter(x => x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(false, `HYPOTHESIS not held — ${r.id} ${r.assertion}: ${r.observed}. First verification; update the assertion in contract-checks-catalog.ts.`).toBe(true);
    }

    // ── LOG only ─────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(
      `\nRECORDED (schema unknown — not asserted): ${of('RECORDED').length}\n` + of('RECORDED').map(s => `  ${s}`).join('\n') +
      `\n\nERROR: ${of('ERROR').length}\n` + of('ERROR').map(s => `  ${s}`).join('\n') +
      `\n\nLEFTOVERS (uncleaned objects): ${res.leftovers.length}\n` + res.leftovers.map(s => `  ${s}`).join('\n') + '\n',
    );

    // sanity — at least the two must-catch known-bug rows evaluated to OK (bug present)
    const knownBugOk = res.rows.filter(r => r.expect === 'known-bug' && r.verdict === 'OK').length;
    expect(knownBugOk, 'no `known-bug` contract row evaluated — the two confirmed bugs were not exercised this run').toBeGreaterThan(0);
  });

  // ── explicit named skips for ops deliberately left out of the matrix ──
  for (const e of CONTRACT_EXCLUDED) {
    test.skip(`EXCLUDED — ${e.group} / ${e.operation}: ${e.reason}`, () => {});
  }
});
