import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs } from './_helpers';
import { runIdempotencyMatrix, renderIdempotencyMatrix } from './_idempotency-checks';
import { IDEMPOTENCY_SPECS } from './idempotency-checks-catalog';

/**
 * Idempotency & retries matrix (item 4) — for each create op: double-create
 * (same body twice), delete-already-deleted, update-nonexistent-id.
 *
 * Every expectation is a `hypothesis` — nothing about idempotency is CONFIRMED
 * for these ops. The matrix RECORDS what happens; verdicts only *soft*-flag
 * the shapes that are likely bugs:
 *   - `STALE-5XX`     — a 5xx on delete-deleted / update-nonexistent (NRE on a
 *     missing entity — same class as BUG-negative-missing-field-500);
 *   - `PHANTOM-WRITE` — a 2xx updating a nonexistent id (silent no-op / phantom);
 *   - `DUP-SILENT`    — a 2xx double-create yielding a second distinct object
 *     where an upsert/dedup was expected.
 * All three are aggregated and asserted **soft** — first data points, not
 * regressions. Only `CONTROL-FAIL` is hard (a create that wouldn't run).
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../local-only/artifacts/dev-portal-evidence-2026-08-29/idempotency-checks-matrix-latest.md',
);

test.describe('Development portal (staging) — idempotency & retries matrix', () => {
  test.describe.configure({ timeout: 30 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('double-create / delete-deleted / update-nonexistent over every clean create op', async ({ page, homePage }) => {
    const res = await runIdempotencyMatrix({ page, homePage, specs: IDEMPOTENCY_SPECS });

    const report = renderIdempotencyMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Idempotency & retries matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    const of = (v: string): string[] =>
      res.rows.filter(r => r.verdict === v).map(r => `${r.id} [${r.scenario}]: ${r.observed}${r.note ? ` {${r.note}}` : ''}`);

    // ── HARD — a create that wouldn't run invalidates its scenarios ──────
    expect(of('CONTROL-FAIL'), 'a create control did not succeed — its idempotency scenarios are meaningless this run').toEqual([]);

    // ── SOFT — every likely-bug shape, aggregated (all first data points) ──
    for (const r of res.rows.filter(x => x.verdict === 'STALE-5XX' || x.verdict === 'PHANTOM-WRITE' || x.verdict === 'DUP-SILENT' || x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(
        false,
        `${r.verdict} — ${r.id} [${r.scenario}]: ${r.observed} ${r.note ? `{${r.note}}` : ''}. First idempotency data point for this op — RECORD it, decide with the API owner whether it's a bug; do not add a hard assertion yet.`,
      ).toBe(true);
    }

    // ── LOG ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.log(
      `\nRECORDED (behaviour observed, no verdict): ${of('RECORDED').length}\n` + of('RECORDED').map(s => `  ${s}`).join('\n') +
      `\n\nERROR: ${of('ERROR').length}\n` + of('ERROR').map(s => `  ${s}`).join('\n') +
      `\n\nLEFTOVERS: ${res.leftovers.length}\n` + res.leftovers.map(s => `  ${s}`).join('\n') + '\n',
    );

    const controlOk = res.rows.filter(r => r.scenario === '(control create)' && r.verdict === 'OK').length;
    expect(controlOk, 'no create control succeeded — nothing was exercised').toBeGreaterThan(0);
  });
});
