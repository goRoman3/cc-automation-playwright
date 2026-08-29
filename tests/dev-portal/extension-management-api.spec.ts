import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
} from './_helpers';

/**
 * Extension Management group (staging) — 6/6 operations covered.
 *
 * Live-verified (2026-08-28): List Extensions, Create Extension (returns a
 * bare GUID *string*), Delete Extension (query params `extensionId`,
 * `isArchive`), Reassign Extension (returns a bare boolean).
 *
 * Steps/example data from ADO 37417 / 37438, NOT yet run live on staging:
 * - `Get Extension` (`settings/extensions/{extensionId}`, GET) — response
 *   has `id, name, site, ...` (lowercase).
 * - `Update Extension` (`settings/extensions/update`, POST) — body is a
 *   **PascalCase** DTO (`Id, Name, SiteId, PlatformType, RecordingEnabled,
 *   …`), per ADO 37438's example. If it fails, the real shape is in that
 *   operation's own OpenAPI export.
 *
 * NOTE: the full report's write-path session (2026-08-29) found
 * `Create Extension` for the key's own current site intermittently 500s
 * ("An error occurred while saving the entity changes"). If the lifecycle
 * test below fails at Create, that's the bug — re-run before assuming a
 * regression in this spec.
 */
test.describe('Developer Portal (staging) — Extension Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Extensions — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('Create Extension → Get Extension → Update Extension → Delete Extension — full lifecycle', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.siteId` constant (Create would
    // 400 "Configured site does not contain selected extension" on a stale site).
    const siteId = await currentSiteId(portal);
    const name = `AQA coverage extension ${Date.now()}`;

    const createOp = await portal.openOperation('Extension Management', /^Create Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await createOp.openConsole();
    await createOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: createStatus, body: createdId } = await sendJson(createOp, portal.raw, { name, siteId });
    expect(createStatus).toBe(200);
    expect(typeof createdId).toBe('string'); // bare GUID string
    const extensionId = createdId as string;

    // NOT live-verified — see file header.
    const getOp = await portal.openOperation('Extension Management', /^Get Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('extensionId', extensionId);
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { name?: string; Name?: string }).name ?? (fetched as { Name?: string }).Name).toBe(name);

    // PascalCase DTO per ADO 37438 — NOT live-verified.
    const updateOp = await portal.openOperation('Extension Management', /^Update Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, {
      Id: extensionId, Name: `${name} updated`, SiteId: siteId,
      PlatformType: 9, TranscriptionAnalytics: 0, IsRedactionAutomated: false,
      VideoApplicationSharing: false, StereoRecordingAndStorage: false,
      RecordingEnabled: true, RecordingLicenseAssigned: true, IsArchived: false,
      DataArchived: '', HasMultichannelGroup: false,
      MultichannelExtensionsAdded: [], MultichannelExtensionsRemoved: [],
    });
    expect(updateStatus).toBe(200);

    const deleteOp = await portal.openOperation('Extension Management', /^Delete Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(extensionId, 'false'); // extensionId, isArchive
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });

  test('Reassign Extension — moves calls between two disposable test extensions', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.siteId` constant.
    const siteId = await currentSiteId(portal);

    const createA = await portal.openOperation('Extension Management', /^Create Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await createA.openConsole();
    await createA.selectSubscriptionKey(API_KEY_OPTION);
    const { body: idA } = await sendJson(createA, portal.raw, { name: `AQA reassign-from ${Date.now()}`, siteId });

    const createB = await portal.openOperation('Extension Management', /^Create Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await createB.openConsole();
    await createB.selectSubscriptionKey(API_KEY_OPTION);
    const { body: idB } = await sendJson(createB, portal.raw, { name: `AQA reassign-to ${Date.now()}`, siteId });

    const reassignOp = await portal.openOperation('Extension Management', /^Reassign Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await reassignOp.openConsole();
    await reassignOp.selectSubscriptionKey(API_KEY_OPTION);
    await reassignOp.fillParameters(idA as string, idB as string); // selectedId, newId
    const { status: reassignStatus, body: reassignBody } = await reassignOp.send();
    expect(reassignStatus).toBe(200);
    expect(reassignBody).toBe(true); // bare boolean

    for (const id of [idA, idB]) {
      const deleteOp = await portal.openOperation('Extension Management', /^Delete Extension/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await deleteOp.openConsole();
      await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
      await deleteOp.fillParameters(id as string, 'false');
      await deleteOp.send();
    }
  });
});
