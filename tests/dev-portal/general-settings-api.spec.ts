import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * General Settings group (staging) — 5/5 operations covered, all happy-path.
 *
 * The two "Update *" operations are full-object PUTs with no reduced
 * required set, so each is exercised as a **no-op round trip**: read the
 * current object, write it straight back. That proves the write path works
 * without mutating CC Test 1's real company/SSO configuration.
 */
test.describe('Developer Portal (staging) — General Settings API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('Preview Company Info — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('General Settings', /^Preview Company Info/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Preview SSO Configuration — 200 (no-body POST despite the operation name)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('General Settings', /^Preview SSO Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('List Storage Locations — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('General Settings', /^List Storage Locations/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await op.send();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('Update Company Settings — no-op round trip (read current settings, write them back) — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    const getOp = await portal.openOperation('General Settings', /^Preview Company Info/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: getStatus, body: currentSettings } = await getOp.send();
    expect(getStatus).toBe(200);

    const updateOp = await portal.openOperation('General Settings', /^Update Company Settings/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, currentSettings);
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request (re-Get, not the Update response) that the
    // write-back round trip actually persisted — same values in, same values out.
    const getAfterUpdateOp = await portal.openOperation('General Settings', /^Preview Company Info/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getAfterUpdateOp.openConsole();
    await getAfterUpdateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: getAfterUpdateStatus, body: settingsAfterUpdate } = await getAfterUpdateOp.send();
    expect(getAfterUpdateStatus).toBe(200);
    expect(settingsAfterUpdate).toEqual(currentSettings);
  });

  test('Update SSO Settings — no-op round trip (read current config, write it back) — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    const getOp = await portal.openOperation('General Settings', /^Preview SSO Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: getStatus, body: currentConfig } = await getOp.send();
    expect(getStatus).toBe(200);

    const updateOp = await portal.openOperation('General Settings', /^Update SSO Settings/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, currentConfig);
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request (re-Get, not the Update response) that the
    // write-back round trip actually persisted — same values in, same values out.
    const getAfterUpdateOp = await portal.openOperation('General Settings', /^Preview SSO Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getAfterUpdateOp.openConsole();
    await getAfterUpdateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: getAfterUpdateStatus, body: configAfterUpdate } = await getAfterUpdateOp.send();
    expect(getAfterUpdateStatus).toBe(200);
    expect(configAfterUpdate).toEqual(currentConfig);
  });
});
