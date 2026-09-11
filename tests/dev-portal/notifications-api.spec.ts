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
 * - List Alert Trigger Operators — the console never substitutes its
 *   optional `{id}` query param, so the backend always gets (and rejects)
 *   the literal `{id}` string → 400.
 * - Preview Alert Log — always 500s regardless of body.
 * - Preview Alert Notification (old) — always 500s, even for a real,
 *   freshly-created alert id (server-side NullReferenceException).
 *
 * Naming trap (same class fixed 2026-08-27 for Agent/Extension/Custom
 * Role/Agent Group, missed here at the time): per the 2026-09-04 APIM
 * catalogue recon, this group's create op is titled **"Create Notification
 * Rule"**, not "Add Notification Rule"; the "single-record fetch" ops below
 * are **"Preview X"** / **"List X"**, never "Get X" (confirmed catalogue-wide,
 * not just in this group).
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
    'List Notifications Trigger Types', 'List Alert Trigger Topics',
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

  test('Upsert Alert Configuration (create) → Preview Alert Configuration → Upsert (update) → Delete Alert Configuration — full round trip', async ({ homePage }) => {
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
    let deleteSucceeded = false;

    try {
    const getOp = await portal.openOperation('Notifications', /^Preview Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.fillParameters(String(alertId));
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { id: number; name: string }).id).toBe(alertId);
    expect((fetched as { id: number; name: string }).name).toBe(alertName);

    const updatedAlertName = `${alertName} updated`;
    const updateOp = await portal.openOperation('Notifications', /^Upsert Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus, body: updated } = await sendJson(updateOp, portal.raw, alertBody(updatedAlertName, alertId));
    expect(updateStatus).toBe(200);
    expect((updated as { configResult: string }).configResult).toContain('updated');

    // Verify by a SEPARATE request (re-Get, not the Upsert response) that the
    // name change actually persisted.
    const getAfterUpdateOp = await portal.openOperation('Notifications', /^Preview Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getAfterUpdateOp.openConsole();
    await getAfterUpdateOp.selectSubscriptionKey(API_KEY_OPTION);
    await getAfterUpdateOp.fillParameters(String(alertId));
    const { status: getAfterUpdateStatus, body: fetchedAfterUpdate } = await getAfterUpdateOp.send();
    expect(getAfterUpdateStatus).toBe(200);
    expect((fetchedAfterUpdate as { name: string }).name).toBe(updatedAlertName);

    const deleteOp = await portal.openOperation('Notifications', /^Delete Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(String(alertId));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record.
    const getAfterDeleteOp = await portal.openOperation('Notifications', /^Preview Alert Configuration/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getAfterDeleteOp.openConsole();
    await getAfterDeleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await getAfterDeleteOp.fillParameters(String(alertId));
    const { status: getAfterDeleteStatus } = await getAfterDeleteOp.send();
    expect(getAfterDeleteStatus, 'Expected the deleted alert configuration to no longer be gettable').not.toBe(200);
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('Notifications', /^Delete Alert Configuration/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await cleanupOp.fillParameters(String(alertId));
        await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
      }
    }
  });

  test('Create Notification Rule → Update Notification Rule → Delete Notification Rule — full round trip', async ({ homePage }) => {
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

    const addOp = await portal.openOperation('Notifications', /^Create Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: addStatus, body: createdId } = await sendJson(addOp, portal.raw, { ...baseRule, name: ruleName });
    expect(addStatus).toBe(200);
    expect(typeof createdId).toBe('string');
    let deleteSucceeded = false;

    try {
    /** Reads a rule back by id via `List Notification Rules` (no `Get` op exists). */
    async function findRuleById(id: string): Promise<{ id: string; name: string } | undefined> {
      const op = await portal.openOperation('Notifications', /^List Notification Rules/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status, body } = await sendJson(op, portal.raw, LIST_BODY);
      expect(status).toBe(200);
      return (body as Array<{ id: string; name: string }>).find(r => String(r.id) === String(id));
    }

    // Verify by a SEPARATE request that Add actually persisted the record.
    const foundAfterAdd = await findRuleById(createdId as string);
    expect(foundAfterAdd, 'Expected the newly added rule to appear in List Notification Rules').toBeTruthy();
    expect(foundAfterAdd!.name).toBe(ruleName);

    const updatedRuleName = `${ruleName} updated`;
    const updateOp = await portal.openOperation('Notifications', /^Update Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, { ...baseRule, id: createdId, name: updatedRuleName });
    expect(updateStatus).toBe(200);

    // Verify by a SEPARATE request that the name change actually persisted.
    const foundAfterUpdate = await findRuleById(createdId as string);
    expect(foundAfterUpdate, 'Expected the updated rule to still appear in List Notification Rules').toBeTruthy();
    expect(foundAfterUpdate!.name).toBe(updatedRuleName);

    const deleteOp = await portal.openOperation('Notifications', /^Delete Notification Rule/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(createdId as string);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
    deleteSucceeded = true;

    // Verify by a SEPARATE request that Delete actually removed the record.
    const foundAfterDelete = await findRuleById(createdId as string);
    expect(foundAfterDelete, 'Expected the deleted rule to no longer appear in List Notification Rules').toBeUndefined();
    } finally {
      // Cleanup for an assertion failure anywhere above Delete — best-effort,
      // never masks the original failure (try/finally re-throws it as-is).
      if (!deleteSucceeded) {
        const cleanupOp = await portal.openOperation('Notifications', /^Delete Notification Rule/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await cleanupOp.openConsole();
        await cleanupOp.selectSubscriptionKey(API_KEY_OPTION);
        await cleanupOp.fillParameters(createdId as string);
        await cleanupOp.send().catch(() => { /* best-effort cleanup */ });
      }
    }
  });

  test('KNOWN BUG — List Alert Trigger Operators: console never substitutes the optional {id} query param, backend rejects the literal placeholder', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Notifications', /^List Alert Trigger Operators/);
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

  test('KNOWN BUG — Preview Alert Notification (old) always 500s, even for a real, freshly-created alert id', async ({ homePage }) => {
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

    const oldOp = await portal.openOperation('Notifications', /^Preview\s+Alert Notification/);
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
