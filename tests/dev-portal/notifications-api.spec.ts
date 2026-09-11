import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
} from './_helpers';

/**
 * Notifications group (staging) — 16/16 operations covered: 13 happy-path,
 * 3 KNOWN BUG regressions.
 *
 * This one catalogue group holds two separate domain objects: Alert
 * Configuration (`settings/alerts*`) and Notification Rule
 * (`settings/notifications*`) — each gets its own full lifecycle round trip.
 *
 * KNOWN BUGs (documented in dev-portal-happy-path-coverage-2026-08-28.md):
 * - Get Alert Trigger Operators — the console never substitutes its
 *   optional `{id}` query param, so the backend always gets (and rejects)
 *   the literal `{id}` string → 400.
 * - Preview Alert Log — always 500s regardless of body.
 * - Get Alert Notification (old) — always 500s, even for a real,
 *   freshly-created alert id (server-side NullReferenceException).
 */
test.describe('Developer Portal (staging) — Notifications API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  const alertTrigger = { notificationLevel: 'warning', shouldNotify: true, triggerOperatorId: 13, triggerValue: ['test'], triggerThreshold: 50, anomalyDetection: false };
  const alertBody = (name: string, id: number | null) => ({
    id, name, notificationTypeId: 7, windowType: 'interaction', windowValue: 1,
    triggers: [alertTrigger], filters: [], notificationCooldown: 0.5, emailAddresses: [], webhooks: [], tags: [],
  });

  for (const opName of [
    'List Alert Types', 'List Notifications Action Types', 'List Notifications Participant Types',
    'List Notifications Trigger Types', 'Get Alert Trigger Topics',
  ]) {
    test(`${opName} — 200 (no-body GET)`, async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Notifications', new RegExp(`^${opName}`));
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await op.send();
      expect(status).toBe(200);
    });
  }

  for (const opName of ['List Notification Rules', 'List Alert Events']) {
    test(`${opName} — 200`, async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Notifications', new RegExp(`^${opName}`));
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await sendJson(op, portal.raw, LIST_BODY);
      expect(status).toBe(200);
    });
  }

  test('Upsert Alert Configuration (create) → Get Alert Configuration → Upsert (update) → Delete Alert Configuration — full round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const alertName = `AQA coverage alert ${Date.now()}`;

    const createOp = await portal.openOperation('Notifications', /^Upsert Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await createOp.openConsole();
    await createOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: createStatus, body: created } = await sendJson(createOp, portal.raw, alertBody(alertName, null));
    expect(createStatus).toBe(200);
    const createMatch = /Notification Config '(\d+)'/.exec((created as { configResult: string }).configResult);
    expect(createMatch, 'Expected configResult to name the new alert id').toBeTruthy();
    const alertId = Number(createMatch![1]);

    const getOp = await portal.openOperation('Notifications', /^Get Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.fillParameters(String(alertId));
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { id: number; name: string }).id).toBe(alertId);
    expect((fetched as { id: number; name: string }).name).toBe(alertName);

    const updateOp = await portal.openOperation('Notifications', /^Upsert Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus, body: updated } = await sendJson(updateOp, portal.raw, alertBody(`${alertName} updated`, alertId));
    expect(updateStatus).toBe(200);
    expect((updated as { configResult: string }).configResult).toContain('updated');

    const deleteOp = await portal.openOperation('Notifications', /^Delete Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(String(alertId));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });

  test('Add Notification Rule → Update Notification Rule → Delete Notification Rule — full round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT the site-bound `KNOWN.siteId` constant; a rule bound
    // to a stale site could 400 on create or bind to the wrong site.
    const siteId = await currentSiteId(portal);
    const ruleName = `AQA coverage notification rule ${Date.now()}`;
    const baseRule = {
      triggerType: 0, actionType: 1, webhook: '', emailsToSend: 'aqa-coverage-test@example.com',
      triggeredByParticipant: 0, keyWord: 'testing', siteId: null, applicationName: null,
      applicationScorePath: '', applicationScoreOperator: null, applicationScoreValue: 0,
      tagIds: [] as string[], siteIds: [siteId], groupIds: [] as string[],
    };

    const addOp = await portal.openOperation('Notifications', /^Add Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: createdId } = await sendJson(addOp, portal.raw, { ...baseRule, name: ruleName });
    expect(addStatus).toBe(200);
    expect(typeof createdId).toBe('string');

    const updateOp = await portal.openOperation('Notifications', /^Update Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { ...baseRule, id: createdId, name: `${ruleName} updated` });
    expect(updateStatus).toBe(200);

    const deleteOp = await portal.openOperation('Notifications', /^Delete Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(createdId as string);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });

  test('KNOWN BUG — Get Alert Trigger Operators: console never substitutes the optional {id} query param, backend rejects the literal placeholder', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Notifications', /^Get Alert Trigger Operators/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await op.send();
    expect(status).toBe(400);
    expect(body).toMatchObject({ errors: { id: ["The value '{id}' is not valid."] } });
  });

  test('KNOWN BUG — Preview Alert Log always 500s regardless of body', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Notifications', /^Preview Alert Log/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, {
      notificationTypeId: 7, windowType: 'interaction', windowValue: 1, triggers: [], filters: [],
    });
    expect(status).toBe(500);
  });

  test('KNOWN BUG — Get Alert Notification (old) always 500s, even for a real, freshly-created alert id', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    const createOp = await portal.openOperation('Notifications', /^Upsert Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await createOp.openConsole();
    await createOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: createStatus, body: created } = await sendJson(
      createOp, portal.raw, alertBody(`AQA old-endpoint bug check ${Date.now()}`, null),
    );
    expect(createStatus).toBe(200);
    const alertId = Number(/Notification Config '(\d+)'/.exec((created as { configResult: string }).configResult)![1]);

    const oldOp = await portal.openOperation('Notifications', /^Get Alert Notification/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await oldOp.openConsole();
    await oldOp.selectSubscriptionKey(API_KEY_OPTION);
    await oldOp.fillParameters(String(alertId));
    const { status: oldStatus, body: oldBody } = await oldOp.send();
    expect(oldStatus).toBe(500);
    expect((oldBody as { Description: string }).Description).toBe('Object reference not set to an instance of an object.');

    const deleteOp = await portal.openOperation('Notifications', /^Delete Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(String(alertId));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });
});
