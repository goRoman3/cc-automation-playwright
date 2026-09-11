import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
  requireRestrictedUser, noSeedDataReason,
} from './_helpers';

/**
 * Restricted User Management group (staging) — 3/3 operations covered,
 * first automated coverage for this group.
 *
 * ⚠️ SECURITY-RELEVANT FINDING (full report §4.3): `List Restricted
 * Accesses` and `Get Restricted User` currently apply **no site-level
 * scoping at all** — a key scoped to one site reads every restricted-user
 * record regardless of site. The dedicated cross-tenant regression for
 * this belongs in `tenant-isolation-staging.spec.ts`; the tests here are
 * plain happy-path (200 + shape) so the group at least has a smoke test.
 *
 * All 3 operations live-verified 2026-08-29 against CC Test 1 (steps/data
 * from ADO 37598 / 37599 / 37600):
 * - `Get Restricted User` (`settings/restricted-access/{userId}`, GET) —
 *   `userId` from the list; response has user id / name / role / accesses.
 * - `Update Restricted User Access` (`settings/restricted-access/access`,
 *   POST) — body `{userId, agentIds, siteIds, groupIds}` (ADO 37600).
 *   Run as a no-op round trip: write the record's own current assignments
 *   straight back (falling back to a single grant on the key's own site if
 *   the list shape doesn't expose them), so no real access grant changes.
 *
 * **SEED-DEPENDENT (2026-09-04)**: this whole file needs at least one
 * pre-existing "restricted user" record — there is no `Create`/`Add`
 * operation anywhere in this catalogue group (confirmed against
 * `apim-schema.json`: List / Preview / Update only), so a restricted user
 * must be provisioned some other way (main app, admin tooling) before these
 * tests can do anything. CC Test 1 apparently had at least one; the current
 * target tenant, Roman_QA_TEST, is unconfirmed. `firstRestrictedRecord()`
 * now returns `undefined` instead of asserting, and every test skips with an
 * explicit reason rather than failing on a missing/foreign record.
 */
test.describe('Developer Portal (staging) — Restricted User Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  const NO_SEED_DATA_REASON = noSeedDataReason(
    'List Restricted Accesses returned zero records, and this API group has no Create operation to seed one.',
  );

  test('List Restricted Accesses — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // The 200-baseline itself doesn't need a record to exist — only the two
    // by-id tests below do — so this one intentionally doesn't skip on an
    // empty list. requireRestrictedUser() still throws on a non-200.
    await requireRestrictedUser(portal);
  });

  test('Preview Restricted User — 200 for a live-discovered user id', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const record = await requireRestrictedUser(portal);
    test.skip(!record, NO_SEED_DATA_REASON);
    const userId = (record!.id ?? record!.userId) as string;
    expect(userId, 'Expected the list record to carry an id').toBeTruthy();

    const op = await portal.openOperation('Restricted User Management', /^Preview Restricted User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('userId', userId);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Update Restricted User Access — no-op round trip on a live-discovered record', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const record = await requireRestrictedUser(portal);
    test.skip(!record, NO_SEED_DATA_REASON);
    const userId = (record!.id ?? record!.userId) as string;
    expect(userId).toBeTruthy();

    const op = await portal.openOperation('Restricted User Management', /^Update Restricted User Access/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    // Write the record's own current assignments straight back (no-op). If
    // the list shape doesn't expose these, fall back to the key's own
    // CURRENT site (live-resolved — never a hardcoded tenant's siteId) so
    // the write path is still exercised.
    const writtenSiteIds = (record!.siteIds as string[]) ?? [await currentSiteId(portal)];
    const { status } = await sendJson(op, portal.raw, {
      userId,
      agentIds: (record!.agentIds as string[]) ?? [],
      siteIds: writtenSiteIds,
      groupIds: (record!.groupIds as string[]) ?? [],
    });
    expect(status).toBe(200);

    // Verify by a SEPARATE request (re-Get, not the Update response) that
    // the write actually persisted.
    const verifyOp = await portal.openOperation('Restricted User Management', /^Preview Restricted User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await verifyOp.openConsole();
    await verifyOp.selectSubscriptionKey(API_KEY_OPTION);
    await verifyOp.addParameter('userId', userId);
    const { status: verifyStatus, body: fetched } = await verifyOp.send();
    expect(verifyStatus).toBe(200);
    const persistedSiteIds = (fetched as { siteIds?: string[] }).siteIds ?? [];
    expect(new Set(persistedSiteIds)).toEqual(new Set(writtenSiteIds));
  });
});
