import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { ApiOperationPage } from '../../pages/dev-portal/ApiOperationPage';
import { ApiManagementSettingsPage } from '../../pages/dev-portal/ApiManagementSettingsPage';
import {
  STAGING_APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, currentKeySite,
  requireExtensionSample, requireSecondSite, noSeedDataReason,
} from './_helpers';

const KEY_NAME = API_KEY_OPTION.split(': ')[1]; // "API_test" — for the Phase 2 site restore

/**
 * Cross-tenant (per-site) **write-path** isolation: confirms a key scoped to
 * site B cannot update or delete a record created under site A — the
 * negative counterpart to `tenant-isolation-staging.spec.ts`'s read-only
 * checks. Same two-phase design, same manual site-switch step between
 * phases (see that file's header for the full switch procedure and the
 * `ApiManagementSettingsPage`/`test:tenant-switch` automation, which can
 * drive the switch interactively even though running it headless via
 * `npm run test:tenant-switch` is blocked by the harness's permission
 * classifier).
 *
 * Gated by `TENANT_WRITE_PHASE` ('1' or '2') via `npm run
 * test:tenant-write-phase1` / `test:tenant-write-phase2` — deliberately a
 * separate env var and baseline file from `tenant-isolation-staging.spec.ts`
 * so the two suites' phases can't be accidentally cross-run.
 *
 * Scope: Extension Management (Update only — Create Extension for the
 * key's own site currently 500s, a separate known bug, so Phase 1 records
 * an existing extension instead of creating a disposable one; Delete isn't
 * exercised here since it'd be destructive against real data if the
 * isolation check ever failed) and Retention Management (no create needed —
 * a retention policy is addressed directly by `siteId`, so Phase 2 just
 * attempts `Update Retention Policy` for site A's own siteId while the key
 * is scoped to site B).
 */
const WRITE_PHASE = process.env.TENANT_WRITE_PHASE;
const BASELINE_PATH = path.resolve(__dirname, '../../.tenant-isolation-negative-writes-baseline.json');

async function sendJson(
  op: ApiOperationPage,
  page: import('@playwright/test').Page,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const bodyField = page.getByLabel('Request body', { exact: true });
  if (!(await bodyField.isVisible().catch(() => false))) {
    await op.addBody();
    await op.addHeader('Content-Type', 'application/json');
  }
  await op.setRequestBody(body);
  return op.send();
}

/** Current site's siteId, discovered via List Retention Policies (always exactly 1 row, scoped to the calling key's own site). */
async function discoverCurrentSiteId(portal: DeveloperPortalPage): Promise<string> {
  const op = await portal.openOperation('Retention Management', /^List Retention Policies/);
  await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
  await op.openConsole();
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, {});
  expect(status, 'List Retention Policies should return 200 while discovering the current site').toBe(200);
  const rows = body as Array<{ siteID: string }>;
  expect(rows.length, 'Expected exactly one retention policy row for the current site').toBeGreaterThan(0);
  return rows[0].siteID;
}

interface Baseline {
  capturedAt: string;
  siteAId: string;
  /** The key's site NAME at Phase 1 time — Phase 2 restores the key to it (item 8 of §7 in 00-summary.md). */
  siteAName: string | null;
  extensionId: string;
  extensionName: string;
}

test.describe('Development portal (staging) — cross-tenant (per-site) write-path isolation', () => {
  test.describe.configure({ timeout: 5 * 60_000 });

  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Set user / adminpass in .env to run these staging Development portal checks',
  );

  test.beforeEach(async ({ page, loginPage }) => {
    await page.goto(STAGING_APP_URL);
    await loginPage.login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.waitForURL('**/Home', { timeout: 20_000 });
  });

  test.afterEach(async ({ page }) => {
    for (const p of page.context().pages()) {
      if (p !== page) await p.close().catch(() => {});
    }
  });

  test('Phase 1 — record an existing extension under the current site (site A)', async ({ homePage }) => {
    test.skip(WRITE_PHASE !== '1', 'Run via `npm run test:tenant-write-phase1` (sets TENANT_WRITE_PHASE=1)');

    // KNOWN BUG (found 2026-08-28): Create Extension for the key's OWN
    // current site 500s ("An error occurred while saving the entity
    // changes"), reproduced 2/2 times — unrelated to tenant isolation
    // (confirmed separately, same session: Create Extension for a
    // *different* site correctly 400s with "Configured site does not
    // contain selected extension.", so cross-tenant create IS enforced —
    // it's same-tenant create that's broken here). Per the project's
    // established "if you can't create, interact with existing data"
    // convention, this test uses an already-existing extension from the
    // current site (via List Extensions) instead of creating a disposable
    // one — every site touched by this whole investigation has real
    // extensions already (14 on UA team recording alone).
    const portal = await DeveloperPortalPage.openFrom(homePage);

    // Early guard — a single-site (or zero-site) Roman_QA_TEST has nowhere
    // for the operator to manually switch this key to before Phase 2, so
    // fail fast here rather than after writing a baseline that Phase 2 can
    // never actually use.
    const secondSite = await requireSecondSite(portal);
    test.skip(!secondSite, noSeedDataReason('List Sites found fewer than 2 sites — Phase 2\'s manual switch has nowhere to go.'));

    const siteAId = await discoverCurrentSiteId(portal);
    const { name: siteAName } = await currentKeySite(portal);
    console.log('Discovered current siteAId:', siteAId, 'name:', siteAName);

    // requireExtensionSample() throws on a non-200 (a real bug, not a seed
    // gap) and only returns `undefined` for a genuinely empty list.
    const sample = await requireExtensionSample(portal);
    test.skip(!sample, noSeedDataReason('List Extensions returned zero extensions on the current site.'));
    const { id: extensionId, name: extensionName } = sample!;

    const baseline: Baseline = { capturedAt: new Date().toISOString(), siteAId, siteAName, extensionId, extensionName };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
    console.log(`Baseline written to ${BASELINE_PATH}:`, JSON.stringify(baseline, null, 2));
    console.log(
      '\n>>> Now manually switch the "Primary: API_test" key\'s site (Settings > API Management > edit > ' +
      'change site > Save, or drive `ApiManagementSettingsPage` interactively), reopen the Development ' +
      'portal, then run `npm run test:tenant-write-phase2`. <<<',
    );
  });

  test('Phase 2 — confirm update of site A\'s extension and retention policy are rejected from site B', async ({ page, homePage }) => {
    test.skip(WRITE_PHASE !== '2', 'Run via `npm run test:tenant-write-phase2` (sets TENANT_WRITE_PHASE=2), after Phase 1 and the manual site switch');
    expect(fs.existsSync(BASELINE_PATH), `No baseline found at ${BASELINE_PATH} — run \`npm run test:tenant-write-phase1\` first`).toBe(true);
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline;

    const portal = await DeveloperPortalPage.openFrom(homePage);
    const siteBId = await discoverCurrentSiteId(portal);
    expect(siteBId, 'Phase 2 must run under a different site than Phase 1 (baseline) — switch the key\'s site first').not.toBe(baseline.siteAId);

    try {
    // Attempt to update site A's extension while scoped to site B — a
    // genuine no-op payload (identical name/siteId to what it already has),
    // so even if the isolation check unexpectedly failed to reject this,
    // nothing about the real record would actually change. Deliberately
    // NOT testing Delete Extension here: this uses an existing real
    // extension (see Phase 1's comment on why), and an accidental real
    // deletion if the isolation check somehow failed would be destructive
    // in a way an update can't be — that check needs its own disposable
    // fixture once the Create Extension 500 bug above is fixed.
    const updateOp = await portal.openOperation('Extension Management', /^Update Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus, body: updateBody } = await sendJson(updateOp, portal.raw, {
      id: baseline.extensionId, name: baseline.extensionName, siteId: baseline.siteAId,
    });
    console.log('Update Extension (cross-site, no-op payload) result:', updateStatus, JSON.stringify(updateBody));
    expect(updateStatus, 'Updating another site\'s extension should be rejected, not 200').not.toBe(200);

    // Attempt to update site A's retention policy while scoped to site B.
    const retOp = await portal.openOperation('Retention Management', /^Update Retention Policy/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await retOp.openConsole();
    await retOp.selectSubscriptionKey(API_KEY_OPTION);
    await retOp.addParameter('siteId', baseline.siteAId);
    await retOp.addParameter('expirationDays', '365');
    const { status: retStatus, body: retBody } = await retOp.send();
    console.log('Update Retention Policy (cross-site) result:', retStatus, JSON.stringify(retBody));
    expect(retStatus, 'Updating another site\'s retention policy should be rejected, not 200').not.toBe(200);
    } finally {
      // §7 item 8 — restore the key to the Phase 1 site so a later `*-api`
      // run doesn't act on the switched site. Best-effort, loud on failure.
      if (baseline.siteAName) {
        try {
          const settings = new ApiManagementSettingsPage(page);
          await settings.goto();
          const current = (await settings.currentSite(KEY_NAME)).trim();
          if (current && current !== baseline.siteAName) {
            await settings.switchKeyToSite(KEY_NAME, baseline.siteAName);
            console.log(`Phase 2 cleanup: restored "${KEY_NAME}" key site "${current}" -> "${baseline.siteAName}".`);
          }
        } catch (err) {
          console.error(
            `\n⚠️  Phase 2 cleanup FAILED to restore the "${KEY_NAME}" key to "${baseline.siteAName}". ` +
            'Restore manually: Settings > API Management > edit the key > Save.\n', err,
          );
        }
      }
    }
  });
});
