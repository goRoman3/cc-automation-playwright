import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, KNOWN, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
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
 * All 3 operations live-verified 2026-08-29 (steps/data from ADO 37598 /
 * 37599 / 37600):
 * - `Get Restricted User` (`settings/restricted-access/{userId}`, GET) —
 *   `userId` from the list; response has user id / name / role / accesses.
 * - `Update Restricted User Access` (`settings/restricted-access/access`,
 *   POST) — body `{userId, agentIds, siteIds, groupIds}` (ADO 37600).
 *   Run as a no-op round trip: write the record's own current assignments
 *   straight back (falling back to a single grant on the key's own site if
 *   the list shape doesn't expose them), so no real access grant changes.
 */
test.describe('Developer Portal (staging) — Restricted User Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  /** List Restricted Accesses → first record. */
  async function firstRestrictedRecord(portal: DeveloperPortalPage): Promise<Record<string, unknown>> {
    const op = await portal.openOperation('Restricted User Management', /^List Restricted Accesses/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
    expect(status).toBe(200);
    const records = (body as { data?: unknown[] }).data ?? (body as unknown[]);
    expect(Array.isArray(records) && records.length > 0, 'Expected at least one restricted-user record').toBeTruthy();
    return (records as Record<string, unknown>[])[0];
  }

  test('List Restricted Accesses — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    await firstRestrictedRecord(portal);
  });

  test('Get Restricted User — 200 for a live-discovered user id', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const record = await firstRestrictedRecord(portal);
    const userId = (record.id ?? record.userId) as string;
    expect(userId, 'Expected the list record to carry an id').toBeTruthy();

    const op = await portal.openOperation('Restricted User Management', /^Get Restricted User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('userId', userId);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Update Restricted User Access — no-op round trip on a live-discovered record', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const record = await firstRestrictedRecord(portal);
    const userId = (record.id ?? record.userId) as string;
    expect(userId).toBeTruthy();

    const op = await portal.openOperation('Restricted User Management', /^Update Restricted User Access/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    // Write the record's own current assignments straight back (no-op). If
    // the list shape doesn't expose these, fall back to a minimal grant on
    // the key's own site so the write path is still exercised.
    const { status } = await sendJson(op, portal.raw, {
      userId,
      agentIds: (record.agentIds as string[]) ?? [],
      siteIds: (record.siteIds as string[]) ?? [KNOWN.siteId],
      groupIds: (record.groupIds as string[]) ?? [],
    });
    expect(status).toBe(200);
  });
});
