import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, currentSiteId,
  requireDisposableReportTemplate, noSeedDataReason,
} from './_helpers';

/**
 * Reports group (staging) — 10/10 operations covered: 9 happy-path + 1
 * KNOWN BUG regression.
 *
 * - `Preview Storage Usage` bakes an unfilled `{siteId}` into the GET URL and
 *   never renders a field — `addParameter('siteId', ...)` overrides the
 *   baked placeholder here (unlike "List Alert Trigger Operators").
 * - `Preview User Activity Summary` — `period` (enum 0/1/2) is required despite
 *   the description implying it is optional.
 * - `Delete Report Template` has no create counterpart; it targets one of
 *   the hundreds of obviously-disposable accumulated test templates
 *   (`Test_Post`, `stephan`, `temp1`, …), highest id first so repeat runs
 *   don't collide. Skips if none is left.
 * - KNOWN BUG — `Preview Report By Template` always 500s with a fully
 *   schema-correct body (server-side NullReferenceException).
 *
 * Naming trap (same class fixed 2026-08-27 for Agent/Extension/Custom
 * Role/Agent Group, missed here at the time): per the 2026-09-04 APIM
 * catalogue recon, every single-record fetch in this group is
 * **"Preview X"**, every collection fetch **"List X"** — never "Get X".
 */
test.describe('Developer Portal (staging) — Reports API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  for (const opName of [
    'List Report Templates', 'Preview Call Volume Statistics', 'Preview Calls Counter',
    'List Sites Storage Usage', 'Preview Six Month Call Volume',
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

  for (const opName of ['Preview Site Usage Statistics', 'Preview Storage Usage']) {
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

  test('Preview User Activity Summary — 200 (period is a required enum)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Reports', /^Preview User Activity Summary/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('period', '0');
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Delete Report Template — removes an existing disposable test template (no Add/Create op exists)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const disposable = await requireDisposableReportTemplate(portal);
    test.skip(!disposable, noSeedDataReason('No disposable-looking report template found, and this API group has no Create operation to seed one.'));

    const deleteOp = await portal.openOperation('Reports', /^Delete Report Template/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.addParameter('id', String(disposable!.id));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);

    // Verify by a SEPARATE request that Delete actually removed the template.
    const listAfterDeleteOp = await portal.openOperation('Reports', /^List Report Templates/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listAfterDeleteOp.openConsole();
    await listAfterDeleteOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: listAfterDeleteStatus, body: templatesAfterDelete } = await listAfterDeleteOp.send();
    expect(listAfterDeleteStatus).toBe(200);
    expect(
      (templatesAfterDelete as Array<{ id: number }>).some(t => t.id === disposable!.id),
      'Expected the deleted template to no longer appear in List Report Templates',
    ).toBe(false);
  });

  test('KNOWN BUG — Preview Report By Template always 500s with a fully schema-correct body', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Reports', /^Preview Report By Template/);
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
