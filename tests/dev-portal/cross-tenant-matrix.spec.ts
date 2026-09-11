import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs,
  requireSecondSite, noSeedDataReason,
} from './_helpers';
import { runCrossTenantMatrix, renderMatrix } from './_cross-tenant';
import { CATALOG } from './cross-tenant-catalog';
import { mergedCatalog, planGaps } from './cross-tenant-plans';

/**
 * Systematic cross-tenant (per-site) isolation over ALL 127 catalogue
 * operations — replaces the point specs. Two canonical patterns, one
 * declarative table:
 *
 *   A. READ isolation  — key on site A → read + snapshot → switch to site B
 *      → same read → diff. `cross-tenant-catalog.ts` marks each read
 *      `must-differ` / `known-global` / `triage` / `hypothesis`.
 *   B. WRITE isolation — pin an object under site A → switch to site B →
 *      attempt to mutate THAT object from site B → expect
 *      `400 "Configured site does not contain…"` → switch back → confirm
 *      the object is intact → clean up.
 *
 * The engine (`_cross-tenant.ts`) switches the key ONCE (A→B→back), iterates
 * the whole table inside that window, and catches per-operation failures
 * into `ERROR` rows so one bad op never aborts the sweep. Classification and
 * executable plans live in `cross-tenant-catalog.ts` + `cross-tenant-plans.ts`.
 *
 * Operations the patterns don't apply to (`blocked` / `destructive` / `n/a`)
 * are emitted as explicit named skips below — visible, never silent.
 *
 * ⚠️ NOT RUN LIVE — the account is out of company CC Test 1. `npx tsc
 * --noEmit` is green; that is the only verification. On the first live run
 * READ THE MATRIX (console + `artifacts/.../cross-tenant-matrix-latest.md`),
 * not just pass/fail — several verdicts are HYPOTHESIS / SUSPECTED and are
 * meant to surface observations for product triage, not assert an outcome.
 * See `tests/dev-portal/UNVERIFIED.md`.
 */
const REPORT_PATH = path.resolve(
  __dirname, '../../local-only/artifacts/dev-portal-evidence-2026-08-29/cross-tenant-matrix-latest.md',
);

test.describe('Development portal (staging) — cross-tenant isolation matrix (127 operations)', () => {
  // 84 driven ops, one console open + send per phase, one A→B→back switch.
  test.describe.configure({ timeout: 55 * 60_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('READ + WRITE isolation over every applicable operation, one site switch', async ({ page, homePage }) => {
    // Early guard — a single-site (or zero-site) Roman_QA_TEST can't
    // complete the A→B switch this whole matrix depends on. Without this,
    // the same failure still happens (inside `runCrossTenantMatrix`'s own
    // switch step, surfacing as `res.switchThrew` and failing the hard
    // `expect(res.switchThrew).toBeNull()` below) but only after already
    // running the full read/write sweep pointlessly under site A.
    //
    // Closes its own portal tab before `runCrossTenantMatrix` opens its
    // own — the portal's SSO session tolerates only one open tab at a time
    // (see `closeExtraTabs`'s doc in `_helpers.ts`), and `openFrom` always
    // opens a fresh popup, never reuses one.
    const portalForSiteCheck = await DeveloperPortalPage.openFrom(homePage);
    const secondSite = await requireSecondSite(portalForSiteCheck);
    await closeExtraTabs(page);
    test.skip(!secondSite, noSeedDataReason('List Sites found fewer than 2 sites — the matrix has nothing to switch to.'));

    const gaps = planGaps();
    expect(gaps.reads, 'every read-class op must have a ReadPlan').toEqual([]);
    expect(gaps.writes, 'every write-class op must have a WritePlan').toEqual([]);

    const res = await runCrossTenantMatrix({ page, homePage, entries: mergedCatalog() });

    const report = renderMatrix(res);
    // eslint-disable-next-line no-console
    console.log(report);
    try {
      fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
      fs.writeFileSync(REPORT_PATH, `# Cross-tenant matrix — last run ${new Date().toISOString()}\n\n\`\`\`\n${report}\n\`\`\`\n`);
    } catch { /* non-fatal */ }

    // ── HARD — harness integrity ──────────────────────────────────────
    expect(res.switchThrew, `site switch failed — the matrix could not run: ${res.switchThrew}`).toBeNull();
    expect(
      res.restoredToSiteA,
      `RESTORE INTEGRITY: the "Primary: API_test" key must end this test back on site A (${res.siteA.name}/${res.siteA.id}). Restore it manually before any other dev-portal spec.`,
    ).toBe(true);

    // ── HARD — a real isolation LEAK fails the suite ──────────────────
    const leaks = res.rows.filter(r => r.verdict === 'LEAK');
    expect(
      leaks.map(r => `${r.id}: ${r.observed}${r.note ? ` {${r.note}}` : ''}`),
      'Cross-site isolation LEAK(s): a per-site key read/mutated another site\'s data. This is a real tenant-isolation bug — do not loosen; file it.',
    ).toEqual([]);

    // ── SOFT — hypotheses (never observed before; expected to fail on the first run for the documented Restricted User bug) ──
    for (const r of res.rows.filter(x => x.verdict === 'HYPOTHESIS-FAIL')) {
      expect.soft(
        false,
        `HYPOTHESIS not held — ${r.id}: ${r.observed}${r.note ? ` {${r.note}}` : ''}. ` +
        'This is a first-ever data point, not necessarily a regression — read the matrix and update the plan\'s expectation.',
      ).toBe(true);
    }

    // ── LOG ONLY — triage + per-op errors ────────────────────────────
    const suspected = res.rows.filter(r => r.verdict === 'SUSPECTED');
    const errors = res.rows.filter(r => r.verdict === 'ERROR');
    // eslint-disable-next-line no-console
    console.log(
      `\nSUSPECTED (product triage — not asserted): ${suspected.length}\n` +
      suspected.map(r => `  ${r.id} — ${r.observed}`).join('\n') +
      `\n\nERROR (op could not be driven this run — check plan/data): ${errors.length}\n` +
      errors.map(r => `  ${r.id} — ${r.observed}`).join('\n') + '\n',
    );

    // A completely empty run (every op errored) is itself a failure.
    const drivenOk = res.rows.filter(r => r.pattern !== 'skip' && r.verdict !== 'ERROR').length;
    expect(drivenOk, 'every driven operation errored — the matrix did not actually exercise anything').toBeGreaterThan(0);
  });

  // ── explicit named skips for every op the patterns don't apply to ──────
  for (const e of CATALOG.filter(x => x.cls === 'blocked' || x.cls === 'destructive' || x.cls === 'n/a')) {
    test.skip(`NOT DRIVEN — ${e.group} / ${e.operation} [${e.cls}]: ${e.reason ?? ''}`, () => {});
  }
});
