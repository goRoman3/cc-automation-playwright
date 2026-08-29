import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
} from './_helpers';

/**
 * Retention Management group (staging) — 2/2 operations covered, happy-path.
 *
 * `Update Retention Policy` takes **query params** (`siteId`,
 * `expirationDays`), not a body — and the console never renders either
 * field automatically for this POST, so both go in via "Add parameter".
 *
 * Cross-tenant write rejection for this group (a key scoped to site B
 * cannot update site A's policy) is covered in
 * `tenant-isolation-negative-writes-staging.spec.ts`. Filtering
 * `List Retention Policies` by `SiteID` is a known 500 bug (see the full
 * report §4.4) — not re-exercised here.
 */
test.describe('Developer Portal (staging) — Retention Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Retention Policies — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Retention Management', /^List Retention Policies/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, {});
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('Update Retention Policy — writes the key\'s own site, verified via List Retention Policies', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.siteId` constant (goes stale
    // whenever a tenant-isolation run leaves the key on another site).
    const siteId = await currentSiteId(portal);

    const op = await portal.openOperation('Retention Management', /^Update Retention Policy/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('siteId', siteId);
    await op.addParameter('expirationDays', '365');
    const { status } = await op.send();
    expect(status).toBe(200);

    const verifyOp = await portal.openOperation('Retention Management', /^List Retention Policies/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await verifyOp.openConsole();
    await verifyOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: verifyStatus, body: policies } = await sendJson(verifyOp, portal.raw, {});
    expect(verifyStatus).toBe(200);
    const ownSitePolicy = (policies as Array<{ siteID: string; expirationDays: number | null }>)
      .find(p => p.siteID === siteId);
    expect(ownSitePolicy?.expirationDays).toBe(365);
  });
});
