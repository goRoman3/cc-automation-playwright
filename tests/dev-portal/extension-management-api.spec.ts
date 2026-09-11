import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
  requireExtensionSample, noSeedDataReason,
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
 *
 * Also covers the permanent regression for ADO #38119 (`equals` filter
 * operator 500s) — the original investigation's field-specificity check
 * (Name + SiteName, both `equals`) lives in `evidence-batch4.spec.ts`
 * (now `test.skip`ped, kept for the historical record); one field is
 * sufficient to regression-check the already-confirmed operator-wide bug.
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

  test('KNOWN BUG (ADO #38119) — List Extensions: "equals" filter operator 500s, use "eq" instead', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    // Deliberately NOT converted to self-seed a throwaway extension (unlike
    // "List Agent Extensions"/"Preview Agent" in agent-management-api.spec.ts):
    // this file's own header above already flags Create Extension as
    // intermittently 500ing on the key's own site. This test regression-
    // checks a DIFFERENT, unrelated bug (the equals-filter 500) — seeding it
    // via a Create that can itself flake would make failures ambiguous
    // (equals-bug fixed vs. Create-flake this run?). Borrowing an existing
    // extension keeps this test's only failure mode the one it's about.
    // requireExtensionSample() throws on a non-200 (a real bug, not a seed
    // gap) and only returns `undefined` for a genuinely empty list.
    const sample = await requireExtensionSample(portal);
    test.skip(!sample, noSeedDataReason('List Extensions returned zero extensions to build a real filter value from.'));
    const realName = sample!.name;

    // Sanity control: the exact same value with the *valid* operator works
    // and returns a real (non-empty) match — an empty `[]` for a filter with
    // no matching rows is normal, expected behaviour, not a bug in itself
    // (unrelated to the finding below); using a value known to match here
    // avoids conflating the two.
    const eqOp = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await eqOp.openConsole();
    await eqOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: eqStatus, body: eqBody } = await sendJson(eqOp, portal.raw, {
      skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field: 'Name', operator: 'eq', value: realName }] },
    });
    expect(eqStatus).toBe(200);
    expect((eqBody as unknown[]).length).toBeGreaterThan(0);

    // KNOWN BUG — the console's own canned example for this operation uses
    // `operator: "equals"`, but the backend 500s (empty body) for that
    // operator on ANY field — already confirmed operator-wide, not
    // field-specific (evidence-batch4.spec.ts's original 6-probe
    // Name/SiteName × eq/contains/equals investigation, filed as ADO #38119).
    // One probe is enough to regression-check it going forward — no need to
    // re-probe a second field each run to re-derive a conclusion that's
    // already established.
    const equalsOp = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await equalsOp.openConsole();
    await equalsOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: equalsStatus } = await sendJson(equalsOp, portal.raw, {
      skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field: 'Name', operator: 'equals', value: realName }] },
    });
    expect(equalsStatus).toBe(500);
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
    let deleteSucceeded = false;

    try {
    // Verify by a SEPARATE request that Create actually persisted the record —
    // filter { Name eq <name> } is confirmed 200 (evidence-batch4.spec.ts
    // P1-LIST-EXTENSIONS-EQUALS-FILTER; `equals` 500s, `eq`/`contains` work).
    const listAfterCreateOp = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listAfterCreateOp.openConsole();
    await listAfterCreateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: listAfterCreateStatus, body: extensionsAfterCreate } = await sendJson(listAfterCreateOp, portal.raw, {
      skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field: 'Name', operator: 'eq', value: name }] },
    });
    expect(listAfterCreateStatus).toBe(200);
    expect(
      (extensionsAfterCreate as Array<{ id: string; name: string }>).some(e => e.id === extensionId && e.name === name),
      'Expected the newly created extension to appear in List Extensions filtered by its own name',
    ).toBe(true);

    // NOT live-verified — see file header.
    const getOp = await portal.openOperation('Extension Management', /^Preview Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('extensionId', extensionId);
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { name?: string; Name?: string }).name ?? (fetched as { Name?: string }).Name).toBe(name);

    // PascalCase DTO per ADO 37438 — NOT live-verified.
    const updatedName = `${name} updated`;
    const updateOp = await portal.openOperation('Extension Management', /^Update Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, {
      Id: extensionId, Name: updatedName, SiteId: siteId,
      PlatformType: 9, TranscriptionAnalytics: 0, IsRedactionAutomated: false,
      VideoApplicationSharing: false, StereoRecordingAndStorage: false,
      RecordingEnabled: true, RecordingLicenseAssigned: true, IsArchived: false,
      DataArchived: '', HasMultichannelGroup: false,
      MultichannelExtensionsAdded: [], MultichannelExtensionsRemoved: [],
    });
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request (re-Get, not the Update response) that the
    // name change actually persisted.
    const getAfterUpdateOp = await portal.openOperation('Extension Management', /^Preview Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getAfterUpdateOp.openConsole();
    await getAfterUpdateOp.selectSubscriptionKey(API_KEY_OPTION);
    await getAfterUpdateOp.addParameter('extensionId', extensionId);
    const { status: getAfterUpdateStatus, body: fetchedAfterUpdate } = await getAfterUpdateOp.send();
    expect(getAfterUpdateStatus).toBe(200);
    expect(
      (fetchedAfterUpdate as { name?: string; Name?: string }).name ?? (fetchedAfterUpdate as { Name?: string }).Name,
    ).toBe(updatedName);

    const deleteOp = await portal.openOperation('Extension Management', /^Delete Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(extensionId, 'false'); // extensionId, isArchive
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record —
    // the same Name-eq filter that found it after Create should now be empty.
    const listAfterDeleteOp = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listAfterDeleteOp.openConsole();
    await listAfterDeleteOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: listAfterDeleteStatus, body: extensionsAfterDelete } = await sendJson(listAfterDeleteOp, portal.raw, {
      skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field: 'Name', operator: 'eq', value: updatedName }] },
    });
    expect(listAfterDeleteStatus).toBe(200);
    expect(
      (extensionsAfterDelete as Array<{ id: string }>).some(e => e.id === extensionId),
      'Expected the deleted extension to no longer appear in List Extensions',
    ).toBe(false);
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('Extension Management', /^Delete Extension/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await cleanupOp.fillParameters(extensionId, 'false');
        await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
      }
    }
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

    let cleanupDone = false;
    try {
    const reassignOp = await portal.openOperation('Extension Management', /^Reassign Extension/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await reassignOp.openConsole();
    await reassignOp.selectSubscriptionKey(API_KEY_OPTION);
    await reassignOp.fillParameters(idA as string, idB as string); // selectedId, newId
    const { status: reassignStatus, body: reassignBody } = await reassignOp.send();
    expect(reassignStatus).toBe(200);
    expect(reassignBody).toBe(true); // bare boolean

    // Verify by a SEPARATE request that both extensions are still intact
    // after Reassign. NOTE: this can't confirm the reassignment's actual
    // effect (moved calls/history) — both extensions are freshly created
    // with no calls attached, so there is nothing observable to diff. It
    // only confirms Reassign didn't corrupt or remove either record.
    for (const id of [idA, idB]) {
      const getOp = await portal.openOperation('Extension Management', /^Preview Extension/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await getOp.openConsole();
      await getOp.selectSubscriptionKey(API_KEY_OPTION);
      await getOp.addParameter('extensionId', id as string);
      const { status: getStatus } = await getOp.send();
      expect(getStatus, `Expected extension ${id} to still exist after Reassign Extension`).toBe(200);
    }

    for (const id of [idA, idB]) {
      const deleteOp = await portal.openOperation('Extension Management', /^Delete Extension/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await deleteOp.openConsole();
      await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
      await deleteOp.fillParameters(id as string, 'false');
      await deleteOp.send();
    }
    cleanupDone = true;
    } finally {
      // Cleanup for an assertion failure anywhere above (Reassign or either
      // "still exists" check) — best-effort, never masks the original
      // failure (try/finally re-throws it as-is).
      if (!cleanupDone) {
        for (const id of [idA, idB]) {
          const cleanupOp = await portal.openOperation('Extension Management', /^Delete Extension/);
          await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
          await cleanupOp.openConsole();
          await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
          await cleanupOp.fillParameters(id as string, 'false');
          await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
        }
      }
    }
  });
});
