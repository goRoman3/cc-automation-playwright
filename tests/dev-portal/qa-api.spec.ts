import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, firstOwnSiteCallId,
  requireQaForm, noSeedDataReason,
} from './_helpers';

/**
 * QA group (staging) — 7/10 operations covered (5 happy-path + 2 KNOWN BUG
 * regressions), 3 genuinely blocked:
 *
 * - `Suppress QA` — SKIPPED: needs a real completed-QA id. `Save completed
 *   QAs` returns 201 but never persists (KNOWN BUG below), so no such id
 *   can ever be obtained through this API.
 * - `Generate QA PDF` — SKIPPED: takes `multipart/form-data` (data/callId/
 *   timeZone); the Try-it console only offers Raw/Binary body modes, so the
 *   request shape can't be built through the console at all.
 * - `Generate QA Excel` — SKIPPED: same multipart-only body as Generate QA
 *   PDF; not drivable through the console.
 *
 * KNOWN BUGs:
 * - `Save completed QAs` returns 201 but the call's `hasAnsweredForms` flag
 *   stays false and it never appears via `List Completed Qas`.
 * - `Email QA` 400s the key's own in-site call with the tenant-scoping
 *   message, though every other Calls/QA op accepts the same call.
 */
test.describe('Developer Portal (staging) — QA API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  const NO_QA_FORM_REASON = noSeedDataReason(
    'List Available QAs returned no non-archived form for this call (QA forms are configured outside this API, not creatable by the test itself).',
  );

  /** `requireQaForm()`'s id, or `undefined` if none exists. Kept as a thin wrapper — every call site here only needs the id. */
  async function firstAvailableFormId(portal: DeveloperPortalPage, callId: string): Promise<number | undefined> {
    return (await requireQaForm(portal, callId))?.id;
  }

  test('List Available QAs → Preview QA — 200, using a live-discovered form id', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    // Live per-run — NOT a hardcoded tenant's callId.
    const callId = await firstOwnSiteCallId(portal);
    const formId = await firstAvailableFormId(portal, callId);
    test.skip(formId === undefined, NO_QA_FORM_REASON);

    const getOp = await portal.openOperation('QA', /^Preview QA/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('id', String(formId));
    const { status } = await getOp.send();
    expect(status).toBe(200);
  });

  test('List All QAs — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('QA', /^List All QAs/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('List Completed Qas — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('QA', /^List Completed Qas/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Preview AQA Phrases — 200, callId + formId both required despite formId being documented optional', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const formId = await firstAvailableFormId(portal, callId);
    test.skip(formId === undefined, NO_QA_FORM_REASON);

    const op = await portal.openOperation('QA', /^Preview AQA Phrases/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    await op.addParameter('formId', String(formId));
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('KNOWN BUG — Save completed QAs returns 201 but never actually persists the evaluation', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const formId = await firstAvailableFormId(portal, callId);
    test.skip(formId === undefined, NO_QA_FORM_REASON);

    const saveOp = await portal.openOperation('QA', /^Save completed QAs/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await saveOp.openConsole();
    await saveOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(saveOp, portal.raw, { id: formId, callId, questions: [], sections: [] });
    expect(status).toBe(201);

    const getCallOp = await portal.openOperation('Calls', /^Preview Call Info/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getCallOp.openConsole();
    await getCallOp.selectSubscriptionKey(API_KEY_OPTION);
    await getCallOp.addParameter('callId', callId);
    const { body: callInfo } = await getCallOp.send();
    expect((callInfo as { model: { hasAnsweredForms: boolean } }).model.hasAnsweredForms).toBe(false);
  });

  test('KNOWN BUG — Email QA rejects the key\'s own-site call with the site-scoping 400', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const formId = await firstAvailableFormId(portal, callId);
    test.skip(formId === undefined, NO_QA_FORM_REASON);

    const op = await portal.openOperation('QA', /^Email QA/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, {
      formId, mails: ['romana@callcabinet.com'], text: 'AQA coverage test - safe to ignore',
      subject: 'AQA coverage test', shareModel: { callId, configs: '{}' },
    });
    expect(status).toBe(400);
    expect(body).toBe('Configured site does not contain selected call.');
  });

  test.skip('Suppress QA — no real completed-QA id obtainable (Save completed QAs never persists)', () => {});
  test.skip('Generate QA PDF — multipart/form-data body cannot be built in the Try-it console', () => {});
  test.skip('Generate QA Excel — multipart/form-data body cannot be built in the Try-it console', () => {});
});
