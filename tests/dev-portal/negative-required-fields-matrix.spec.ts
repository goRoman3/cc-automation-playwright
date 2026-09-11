import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs } from './_helpers';
import { runNegativeFieldMatrix, renderNegMatrix } from './_negative-fields';
import { NEG_FIELD_SPECS, EXCLUDED_FROM_NEG_MATRIX } from './negative-fields-catalog';

/**
 * Negative validation — "missing required field" — as a systematic matrix,
 * same shape as the cross-tenant matrix.
 *
 * Per in-scope create-from-body op (`negative-fields-catalog.ts`):
 *   0. CONTROL — full valid body → must succeed (else a 400 proves nothing).
 *   1. Each required field — body minus that field → API should reject it.
 *   2. CLEANUP — control (+ any partial body that unexpectedly created an
 *      object) deleted in a per-spec `finally`.
 *
 * Verdicts (`_negative-fields.ts`):
 *   HARD fail — `CONTROL-FAIL`, `LEAK` (a confirmed-400 field silently
 *     accepted a missing value), `REGRESSION` (confirmed-400 field now errors
 *     differently), `FIXED-FLIP-ME` (a `known-bug-500` / `not-enforced` field
 *     now behaves correctly → update the expectation — this is the row that
 *     goes RED when Smarsh fixes the bug).
 *   SOFT — `HYPOTHESIS-FAIL` (a `hypothesis-400` field's rejection was never
 *     actually observed; first data point).
 *   LOG only — `RECORDED` (`needs-schema-confirmation` / `special` — required-
 *     ness unknown, no assertion written), `ERROR`, `leftovers`.
 *
 * ⚠️ NOT RUN LIVE — the account is out of company CC Test 1. `npx tsc
 * --noEmit` green is the only verification. On the first live run READ THE
 * MATRIX (console + `artifacts/.../negative-required-fields-matrix-latest.md`).
 * `tests/dev-portal/UNVERIFIED.md` lists which assertions are hypothetical.
 *
 * The older `negative-required-fields-staging.spec.ts` stays — it covers the
 * two ops excluded here (Add User, Manual Redaction).
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../local-only/artifacts/dev-portal-evidence-2026-08-29/negative-required-fields-matrix-latest.md',
);

test.describe('Development portal (staging) — negative-required-fields matrix', () => {
  test.describe.configure({ timeout: 25 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('control + per-field omission over every in-scope create-from-body op', async ({ page, homePage }) => {
    const res = await runNegativeFieldMatrix({ page, homePage, specs: NEG_FIELD_SPECS });

    const report = renderNegMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Negative-required-fields matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    const of = (v: string): string[] =>
      res.rows.filter(r => r.verdict === v).map(r => `${r.id} ${r.probe}: ${r.observed}${r.note ? ` {${r.note}}` : ''}`);

    // ── HARD ────────────────────────────────────────────────────────────
    expect(of('CONTROL-FAIL'), 'a confirmed-valid body did NOT succeed — the field-omission rows are meaningless this run').toEqual([]);
    expect(of('LEAK'), 'a confirmed required field was silently accepted when omitted — the exact bug this matrix guards against').toEqual([]);
    expect(of('REGRESSION'), 'a confirmed-400 field now returns a different error').toEqual([]);
    expect(
      of('FIXED-FLIP-ME'),
      'a `known-bug-500` / `not-enforced` field now behaves correctly — the bug is fixed; update the field\'s `expect` in negative-fields-catalog.ts (this is the intended "goes RED when fixed").',
    ).toEqual([]);

    // ── SOFT — hypotheses (rejection never actually observed before) ────
    for (const r of res.rows.filter(x => x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(false, `HYPOTHESIS not held — ${r.id} ${r.probe}: ${r.observed}. First data point; update the expectation once a real run confirms a direction.`).toBe(true);
    }

    // ── LOG only ─────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(
      `\nRECORDED (required-ness unknown — not asserted): ${of('RECORDED').length}\n` + of('RECORDED').map(s => `  ${s}`).join('\n') +
      `\n\nERROR: ${of('ERROR').length}\n` + of('ERROR').map(s => `  ${s}`).join('\n') +
      `\n\nLEFTOVERS (uncleaned objects): ${res.leftovers.length}\n` + res.leftovers.map(s => `  ${s}`).join('\n') + '\n',
    );

    const controlOk = res.rows.filter(r => r.probe === '(control)' && r.verdict === 'OK').length;
    expect(controlOk, 'no control case succeeded — the matrix did not actually exercise anything').toBeGreaterThan(0);
  });

  // ── explicit named skips for ops deliberately left out ───────────────
  for (const e of EXCLUDED_FROM_NEG_MATRIX) {
    test.skip(`EXCLUDED — ${e.group} / ${e.operation}: ${e.reason}`, () => {});
  }
});
