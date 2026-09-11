import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Tag Management group (staging) — 4/4 operations covered, all happy-path.
 * Create → Update → Delete is a full round trip.
 *
 * Naming trap (same class fixed 2026-08-27 for Agent/Extension/Custom
 * Role/Agent Group, missed here at the time): per the 2026-09-04 APIM
 * catalogue recon, this group's create op is titled **"Create Tag"**, not
 * "Add Tag".
 *
 * Quirk: `name` is server-validated to alphanumeric + spaces only (a
 * parenthesised name 400s with "Alphanumeric characters and spaces allowed
 * only"), so the fixture names below deliberately contain neither.
 */
test.describe('Developer Portal (staging) — Tag Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Tags — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Tag Management', /^List Tags/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  /** Reads a tag record back by id via `List Tags` (no `Get Tag` operation exists). */
  async function findTagById(portal: DeveloperPortalPage, tagId: string): Promise<{ id: string; name: string } | undefined> {
    const op = await portal.openOperation('Tag Management', /^List Tags/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, { skip: 0, take: 200, sort: [], filter: { logic: 'and', filters: [] } });
    expect(status).toBe(200);
    return (body as Array<{ id: string; name: string }>).find(t => t.id === tagId);
  }

  test('Create Tag → Update Tag → Delete Tag — full create/update/cleanup round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const tagName = `AQA coverage tag ${Date.now()}`;

    const addOp = await portal.openOperation('Tag Management', /^Create Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, { name: tagName });
    expect(addStatus).toBe(200);
    const createdTag = added as { id: string };
    expect(createdTag.id).toBeTruthy();
    let deleteSucceeded = false;

    try {
    // Verify by a SEPARATE request that Add actually persisted the record.
    const foundAfterAdd = await findTagById(portal, createdTag.id);
    expect(foundAfterAdd, 'Expected the newly added tag to appear in List Tags').toBeTruthy();
    expect(foundAfterAdd!.name).toBe(tagName);

    const updatedName = `${tagName} updated`;
    const updateOp = await portal.openOperation('Tag Management', /^Update Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { id: createdTag.id, name: updatedName });
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request that the name change actually persisted.
    const foundAfterUpdate = await findTagById(portal, createdTag.id);
    expect(foundAfterUpdate, 'Expected the updated tag to still appear in List Tags').toBeTruthy();
    expect(foundAfterUpdate!.name).toBe(updatedName);

    const deleteOp = await portal.openOperation('Tag Management', /^Delete Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(createdTag.id);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record.
    const foundAfterDelete = await findTagById(portal, createdTag.id);
    expect(foundAfterDelete, 'Expected the deleted tag to no longer appear in List Tags').toBeUndefined();
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('Tag Management', /^Delete Tag/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await cleanupOp.fillParameters(createdTag.id);
        await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
      }
    }
  });
});
