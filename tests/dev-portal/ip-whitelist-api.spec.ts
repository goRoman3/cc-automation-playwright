import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * IP Whitelist group (staging) — 3/3 operations covered, all happy-path.
 * Add → Delete is a full round trip with a throwaway TEST-NET-3 address
 * (203.0.113.0/24, RFC 5737) so nothing real is whitelisted.
 *
 * Negative coverage (Add IP Whitelist 500s instead of 400 when `ipAddress`
 * is omitted — a confirmed bug) lives in
 * `negative-required-fields-staging.spec.ts`.
 */
test.describe('Developer Portal (staging) — IP Whitelist API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List IP Whitelist — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('IP Whitelist', /^List IP Whitelist/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  /** Reads an IP whitelist entry back by id via `List IP Whitelist` (no `Get` op exists). */
  async function findWhitelistEntryById(portal: DeveloperPortalPage, id: number): Promise<{ id: number; ipAddress: string } | undefined> {
    const op = await portal.openOperation('IP Whitelist', /^List IP Whitelist/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
    return (body as Array<{ id: number; ipAddress: string }>).find(e => e.id === id);
  }

  test('Add IP Whitelist → Delete IP Whitelist — full create/cleanup round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const testIp = `203.0.113.${(Date.now() % 200) + 10}`;

    const addOp = await portal.openOperation('IP Whitelist', /^Add IP Whitelist/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, { ipAddress: testIp });
    expect(addStatus).toBe(200);
    const createdEntry = added as { id: number; ipAddress: string };
    expect(createdEntry.ipAddress).toBe(testIp);
    let deleteSucceeded = false;

    try {
    // Verify by a SEPARATE request that Add actually persisted the record.
    const foundAfterAdd = await findWhitelistEntryById(portal, createdEntry.id);
    expect(foundAfterAdd, 'Expected the newly added entry to appear in List IP Whitelist').toBeTruthy();
    expect(foundAfterAdd!.ipAddress).toBe(testIp);

    const deleteOp = await portal.openOperation('IP Whitelist', /^Delete IP Whitelist/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: deleteStatus } = await sendJson(deleteOp, portal.raw, { id: createdEntry.id, ipAddress: testIp });
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record.
    const foundAfterDelete = await findWhitelistEntryById(portal, createdEntry.id);
    expect(foundAfterDelete, 'Expected the deleted entry to no longer appear in List IP Whitelist').toBeUndefined();
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('IP Whitelist', /^Delete IP Whitelist/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await sendJson(cleanupOp, portal.raw, { id: createdEntry.id, ipAddress: testIp }).catch(() => { /* best-effort cleanup */ });
      }
    }
  });
});
