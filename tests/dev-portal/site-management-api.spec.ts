import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Site Management group (staging) — 4/4 operations covered, all happy-path.
 * Add → Update → Delete is a full round trip. CC Test 1 has hundreds of
 * sites, so the "last site can't be deleted" rule doesn't apply here.
 *
 * Quirk: `Add Site`'s success response is a **single-element array** of
 * `SiteDto` (PascalCase `Id`), not a bare object like every other group's
 * Add response.
 *
 * `List Sites` is intentionally account-wide (not scoped to the calling
 * key's own site) — see `tenant-isolation-staging.spec.ts`.
 */
test.describe('Developer Portal (staging) — Site Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Sites — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Site Management', /^List Sites/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  test('Add Site → Update Site → Delete Site — full create/update/cleanup round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const siteName = `AQA coverage site ${Date.now()}`;

    const addOp = await portal.openOperation('Site Management', /^Add Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, { name: siteName });
    expect(addStatus).toBe(200);
    const createdSite = (Array.isArray(added) ? added[0] : added) as { Id?: string; id?: string };
    const siteId = createdSite.Id ?? createdSite.id;
    expect(siteId).toBeTruthy();

    const updateOp = await portal.openOperation('Site Management', /^Update Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { id: siteId, name: `${siteName} updated` });
    expect(updateStatus).toBe(200);

    const deleteOp = await portal.openOperation('Site Management', /^Delete Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(siteId!);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });
});
