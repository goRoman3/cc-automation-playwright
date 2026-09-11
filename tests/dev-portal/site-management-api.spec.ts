import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Site Management group (staging) — 4/4 operations covered, all happy-path.
 * Create → Update → Delete is a full round trip. CC Test 1 has hundreds of
 * sites, so the "last site can't be deleted" rule doesn't apply here.
 *
 * Naming trap (same class as the 2026-08-27 Agent/Extension/Custom Role/
 * Agent Group fix — recheck the live catalogue name before assuming a
 * regex still matches): as of the 2026-09-04 APIM catalogue recon, this
 * group's create op is titled **"Create Site"**, not "Add Site" — renamed
 * sometime after the 2026-08-27 fix, which didn't touch this group.
 *
 * Quirk: `Create Site`'s success response is a **single-element array** of
 * `SiteDto` (PascalCase `Id`), not a bare object like every other group's
 * create response.
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

  /**
   * Reads a site record back by id via `List Sites` (no `Get Site` operation
   * exists in this group) — CC Test 1 has hundreds of sites and ordering is
   * unspecified, so `take` is large and the match is client-side by id, not
   * position. Returns `undefined` if the id isn't found (i.e. deleted).
   */
  async function findSiteById(portal: DeveloperPortalPage, siteId: string): Promise<{ Id?: string; id?: string; Name?: string; name?: string } | undefined> {
    const op = await portal.openOperation('Site Management', /^List Sites/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, { skip: 0, take: 1000, sort: [], filter: { logic: 'and', filters: [] } });
    expect(status).toBe(200);
    return (body as Array<{ Id?: string; id?: string; Name?: string; name?: string }>).find(s => (s.Id ?? s.id) === siteId);
  }

  test('Create Site → Update Site → Delete Site — full create/update/cleanup round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const siteName = `AQA coverage site ${Date.now()}`;

    const addOp = await portal.openOperation('Site Management', /^Create Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, { name: siteName });
    expect(addStatus).toBe(200);
    const createdSite = (Array.isArray(added) ? added[0] : added) as { Id?: string; id?: string };
    const siteId = createdSite.Id ?? createdSite.id;
    expect(siteId).toBeTruthy();
    let deleteSucceeded = false;

    try {
    // Verify by a SEPARATE request that Add actually persisted the record.
    const foundAfterAdd = await findSiteById(portal, siteId!);
    expect(foundAfterAdd, 'Expected the newly added site to appear in List Sites').toBeTruthy();
    expect(foundAfterAdd!.Name ?? foundAfterAdd!.name).toBe(siteName);

    const updatedName = `${siteName} updated`;
    const updateOp = await portal.openOperation('Site Management', /^Update Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { id: siteId, name: updatedName });
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request that the name change actually persisted.
    const foundAfterUpdate = await findSiteById(portal, siteId!);
    expect(foundAfterUpdate, 'Expected the updated site to still appear in List Sites').toBeTruthy();
    expect(foundAfterUpdate!.Name ?? foundAfterUpdate!.name).toBe(updatedName);

    const deleteOp = await portal.openOperation('Site Management', /^Delete Site/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(siteId!);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record.
    const foundAfterDelete = await findSiteById(portal, siteId!);
    expect(foundAfterDelete, 'Expected the deleted site to no longer appear in List Sites').toBeUndefined();
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('Site Management', /^Delete Site/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await cleanupOp.fillParameters(siteId!);
        await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
      }
    }
  });
});
