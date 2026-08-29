import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
} from './_helpers';

/**
 * Reports group (staging) — 10/10 operations covered: 9 happy-path + 1
 * KNOWN BUG regression.
 *
 * - `Get Storage Usage` bakes an unfilled `{siteId}` into the GET URL and
 *   never renders a field — `addParameter('siteId', ...)` overrides the
 *   baked placeholder here (unlike "Get Alert Trigger Operators").
 * - `Get User Activity Summary` — `period` (enum 0/1/2) is required despite
 *   the description implying it is optional.
 * - `Delete Report Template` has no create counterpart; it targets one of
 *   the hundreds of obviously-disposable accumulated test templates
 *   (`Test_Post`, `stephan`, `temp1`, …), highest id first so repeat runs
 *   don't collide. Skips if none is left.
 * - KNOWN BUG — `Get Report By Template` always 500s with a fully
 *   schema-correct body (server-side NullReferenceException).
 */
test.describe('Developer Portal (staging) — Reports API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  for (const opName of [
    'List Report Templates', 'Get Call Volume Statistics', 'Get Calls Counter',
    'Get Sites Storage Usage', 'Get Six Month Call Volume',
  ]) {
    test(`${opName} — 200`, async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Reports', new RegExp(`^${opName}`));
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await op.send();
      expect(status).toBe(200);
    });
  }

  for (const opName of ['Get Site Usage Statistics', 'Get Storage Usage']) {
    test(`${opName} — 200 (siteId query param)`, async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      // Live per-run — NOT the site-bound `KNOWN.siteId` constant.
      const siteId = await currentSiteId(portal);
      const op = await portal.openOperation('Reports', new RegExp(`^${opName}`));
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.addParameter('siteId', siteId);
      const { status } = await op.send();
      expect(status).toBe(200);
    });
  }

  test('Get User Activity Summary — 200 (period is a required enum)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Reports', /^Get User Activity Summary/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('period', '0');
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Delete Report Template — removes an existing disposable test template (no Add/Create op exists)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const listOp = await portal.openOperation('Reports', /^List Report Templates/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listOp.openConsole();
    await listOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: listStatus, body: templates } = await listOp.send();
    expect(listStatus).toBe(200);
    const disposable = (templates as Array<{ id: number; name: string }>)
      .filter(t => /^(Test_Post|stephan|temp\d*|ttemp\d*|savetemptest\d*)$/i.test(t.name))
      .sort((a, b) => b.id - a.id)[0];
    test.skip(!disposable, 'No disposable-looking test template left to delete this run');

    const deleteOp = await portal.openOperation('Reports', /^Delete Report Template/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.addParameter('id', String(disposable!.id));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });

  test('KNOWN BUG — Get Report By Template always 500s with a fully schema-correct body', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Reports', /^Get Report By Template/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, {
      id: 145, templateId: 145, criteriaId: 1, timeZone: -12,
      startString: '2026-08-28T12:00:00Z', endString: '2026-08-29T11:59:59Z',
      criteriaParams: [{ original: 'Internal', translated: 'Internal Calls' }],
      agentParams: [], extensionParams: [],
    });
    expect(status).toBe(500);
  });
});
