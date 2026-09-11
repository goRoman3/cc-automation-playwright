import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Tag Management group (staging) — 4/4 operations covered, all happy-path.
 * Add → Update → Delete is a full round trip.
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

  test('Add Tag → Update Tag → Delete Tag — full create/update/cleanup round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const tagName = `AQA coverage tag ${Date.now()}`;

    const addOp = await portal.openOperation('Tag Management', /^Add Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, { name: tagName });
    expect(addStatus).toBe(200);
    const createdTag = added as { id: string };
    expect(createdTag.id).toBeTruthy();

    const updateOp = await portal.openOperation('Tag Management', /^Update Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { id: createdTag.id, name: `${tagName} updated` });
    expect(updateStatus).toBe(200);

    const deleteOp = await portal.openOperation('Tag Management', /^Delete Tag/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(createdTag.id);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });
});
