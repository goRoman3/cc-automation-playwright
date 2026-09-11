import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, firstOwnSiteCallId,
} from './_helpers';

/**
 * Manual Redaction group (staging) — 2/2 operations covered, happy-path.
 *
 * `Submit Call Redaction Request`'s real required fields (`callId`,
 * `entityTypeId`, `startMilliseconds`, `endMilliseconds`, `requestText`)
 * were confirmed via the operation's own OpenAPI export — ADO's documented
 * `startTime`/`endTime`/`text` names do NOT match the live `ManualRedactionDto`.
 * The backend rejects a second request for a call+window pair already
 * submitted and there's no delete op, so each run uses a fresh window.
 *
 * Negative coverage (`entityTypeId` not enforced; hangs when
 * `startMilliseconds`/`endMilliseconds` omitted) is in
 * `negative-required-fields-staging.spec.ts`.
 */
test.describe('Developer Portal (staging) — Manual Redaction API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Call Redaction Requests — 200 for the key\'s own-site call', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.callId` constant.
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Manual Redaction', /^List Call Redaction Requests/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Submit Call Redaction Request — on the key\'s own-site call', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.callId` constant.
    const callId = await firstOwnSiteCallId(portal);
    const startMilliseconds = Date.now() % 100_000;
    const requestText = 'AQA coverage redaction test';
    const op = await portal.openOperation('Manual Redaction', /^Submit Call Redaction Request/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status, body } = await sendJson(op, portal.raw, {
      callId, entityTypeId: 1, startMilliseconds, endMilliseconds: startMilliseconds + 5000,
      requestText,
    });
    expect(status).toBe(200);
    expect(body).toBe('Successfully created redaction request');

    // Verify by a SEPARATE request (List Call Redaction Requests, not the
    // Submit response) that the request actually persisted.
    const listOp = await portal.openOperation('Manual Redaction', /^List Call Redaction Requests/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listOp.openConsole();
    await listOp.selectSubscriptionKey(API_KEY_OPTION);
    await listOp.addParameter('callId', callId);
    const { status: listStatus, body: requests } = await listOp.send();
    expect(listStatus).toBe(200);
    expect(Array.isArray(requests) && requests.length > 0, 'Expected at least one redaction request for this call').toBeTruthy();
    expect(JSON.stringify(requests)).toContain(requestText);
  });
});
