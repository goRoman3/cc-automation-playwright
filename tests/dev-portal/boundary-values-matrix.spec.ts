import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs } from './_helpers';
import { runBoundaryMatrix, renderBoundaryMatrix } from './_negative-fields';
import { BOUNDARY_SPECS, BOUNDARY_DEFERRED } from './boundary-fields-catalog';
import { EXCLUDED_FROM_NEG_MATRIX } from './negative-fields-catalog';

/**
 * Negative validation — "degenerate boundary value" — as a systematic matrix,
 * same shape as the missing-required-fields matrix (item 1 of the follow-up).
 *
 * Per spec (`boundary-fields-catalog.ts`):
 *   0. CONTROL — full valid body → must succeed (else a rejection proves
 *      nothing).
 *   1. Each boundary field — valid body with that ONE field swapped for a
 *      degenerate value (empty string / whitespace / null / bad GUID /
 *      all-zero GUID / out-of-range / negative / wrong-type / bad-format /
 *      malformed JSON) → observe.
 *   2. CLEANUP — control (+ any probe that unexpectedly created an object)
 *      deleted in a per-spec `finally`.
 *
 * Verdicts (`_negative-fields.ts`, shared with the neg matrix):
 *   HARD  — `CONTROL-FAIL`; `LEAK` (a confirmed-`'400'` boundary was silently
 *     accepted — only Add Tag `name`=bad-format is `'400'` here);
 *     `REGRESSION`; `FIXED-FLIP-ME`.
 *   SOFT  — `HYPOTHESIS-FAIL` (a `hypothesis-400` / `hypothesis-reject` field's
 *     rejection was never actually observed — first data point).
 *   LOG   — `RECORDED` (`needs-schema-confirmation` / `special` — behaviour
 *     genuinely unknown, no assertion), `ERROR`, `leftovers`.
 *
 * ⚠️ NOT RUN LIVE — the account is out of company CC Test 1. `npx tsc
 * --noEmit` green is the only verification. On the first live run READ THE
 * MATRIX (console + `artifacts/.../boundary-values-matrix-latest.md`).
 * `tests/dev-portal/UNVERIFIED.md` lists which assertions are hypothetical.
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../artifacts/dev-portal-evidence-2026-08-29/boundary-values-matrix-latest.md',
);

test.describe('Development portal (staging) — boundary-values matrix', () => {
  test.describe.configure({ timeout: 25 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('control + per-field boundary probe over every in-scope body op', async ({ page, homePage }) => {
    const res = await runBoundaryMatrix({ page, homePage, specs: BOUNDARY_SPECS });

    const report = renderBoundaryMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Boundary-values matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    const of = (v: string): string[] =>
      res.rows.filter(r => r.verdict === v).map(r => `${r.id} ${r.probe}: ${r.observed}${r.note ? ` {${r.note}}` : ''}`);

    // ── HARD ────────────────────────────────────────────────────────────
    expect(of('CONTROL-FAIL'), 'a confirmed-valid body did NOT succeed — the boundary rows are meaningless this run').toEqual([]);
    expect(of('LEAK'), 'a confirmed-`400` boundary value was silently accepted (Add Tag name=bad-format — CONTRACT-update-tag-name-validation)').toEqual([]);
    expect(of('REGRESSION'), 'a confirmed-`400` boundary field now returns a different error').toEqual([]);
    expect(
      of('FIXED-FLIP-ME'),
      'a `known-bug-500` / `not-enforced` boundary field now behaves correctly — update its `expect` in boundary-fields-catalog.ts (intended "goes RED when fixed").',
    ).toEqual([]);

    // ── SOFT — hypotheses (rejection never actually observed before) ────
    for (const r of res.rows.filter(x => x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(false, `HYPOTHESIS not held — ${r.id} ${r.probe}: ${r.observed}. First data point; update the expectation in boundary-fields-catalog.ts once a real run confirms a direction.`).toBe(true);
    }

    // ── LOG only ─────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(
      `\nRECORDED (behaviour unknown — not asserted): ${of('RECORDED').length}\n` + of('RECORDED').map(s => `  ${s}`).join('\n') +
      `\n\nERROR: ${of('ERROR').length}\n` + of('ERROR').map(s => `  ${s}`).join('\n') +
      `\n\nLEFTOVERS (uncleaned objects): ${res.leftovers.length}\n` + res.leftovers.map(s => `  ${s}`).join('\n') + '\n',
    );

    const controlOk = res.rows.filter(r => r.probe === '(control)' && r.verdict === 'OK').length;
    expect(controlOk, 'no control case succeeded — the matrix did not actually exercise anything').toBeGreaterThan(0);
  });

  // ── deferred probe classes — explicit named skips ────────────────────
  for (const d of BOUNDARY_DEFERRED) {
    test.skip(`DEFERRED — ${d.probe}: ${d.reason}`, () => {});
  }

  // ── same op exclusions as the neg matrix ────────────────────────────
  for (const e of EXCLUDED_FROM_NEG_MATRIX) {
    test.skip(`EXCLUDED — ${e.group} / ${e.operation}: ${e.reason}`, () => {});
  }
});
