import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * User Management group (staging) — 5/5 operations covered.
 *
 * Add → Get → Update → Delete is a full round trip. Required-fields-only
 * body: `userRoleIdCombined, qcRId, email, firstName, lastName`. Get/Delete
 * User's `{userId}` path param and Delete User's extra `userRId` query
 * param never render in the console — added via "Add parameter".
 *
 * ⚠️ `Add User` sends a REAL invitation email to the address used — the
 * `+timestamp@callcabinet.com` address below is deliberately a throwaway.
 *
 * KNOWN BUG — `Delete User`'s Send never fires a network request (confirmed
 * deterministic across 5+ runs incl. `--trace on`), so the AQA-created test
 * user is left un-deleted each run (acceptable — every account here is
 * disposable). The test asserts the timeout so it goes red if Smarsh fixes it.
 */
test.describe('Developer Portal (staging) — User Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Users — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('User Management', /^List Users/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  test('Add User → Get User → Update User → Delete User — full round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const email = `aqa-coverage-test+${Date.now()}@callcabinet.com`;

    const addOp = await portal.openOperation('User Management', /^Add User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: created } = await sendJson(addOp, portal.raw, {
      userRoleIdCombined: '3', qcRId: 0, email, firstName: 'AQA', lastName: 'coverage test',
    });
    expect(addStatus).toBe(200);
    const addedUser = created as { id: string; userRId: string };
    expect(addedUser.id).toBeTruthy();

    const getOp = await portal.openOperation('User Management', /^Get User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('userId', addedUser.id);
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { email: string }).email).toBe(email);
    const userRId = (fetched as { userRId: string }).userRId;

    const updateOp = await portal.openOperation('User Management', /^Update User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus, body: updated } = await sendJson(updateOp, portal.raw, {
      id: addedUser.id, email, firstName: 'AQA', lastName: 'coverage test updated',
      userRoleIdCombined: '3', qcRId: 0, phoneNumber: '', isActive: true, ssoOnly: false,
      twoFactorEnabled: false, notes: null, dateFormat: null, twoFactorType: null,
      domainUsername: null, userRLvl: 3,
    });
    expect(updateStatus).toBe(200);
    expect((updated as { lastName: string }).lastName).toBe('coverage test updated');

    const deleteOp = await portal.openOperation('User Management', /^Delete User/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.addParameter('userId', addedUser.id);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.addParameter('userRId', userRId);
    await portal.raw.waitForTimeout(500);
    // KNOWN BUG: Send never fires the underlying request — asserted via the timeout.
    await expect(deleteOp.send()).rejects.toThrow(/Timeout/);
  });
});
