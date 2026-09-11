import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Heartbeats group (staging) — 4 operations.
 *
 * - List Server Heartbeats — happy-path.
 * - List Client Heartbeats — happy-path, but ONLY with an explicit empty
 *   `filter` object: the operation's own pre-filled example body 500s
 *   unmodified (placeholder `customerId` collides with the server-injected
 *   one), a `siteName` sort 500s ("Invalid column name"), and omitting
 *   `filter` entirely 500s (NullReferenceException). `{skip,take,filter:{
 *   logic:'and',filters:[]}}` is the one shape that returns 200 — see the
 *   full report §3.5.
 * - Delete Client/Server Heartbeat — SKIPPED: both operate on real client/
 *   server monitoring records this suite has no way to create disposably,
 *   unlike every other group's CRUD targets. Deleting a real one would lose
 *   genuine monitoring history.
 *
 * `List Server Heartbeats` is customer-scoped but not site-scoped — a
 * pre-existing, documented gap (see `tenant-isolation-staging.spec.ts`).
 */
test.describe('Developer Portal (staging) — Heartbeats API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Server Heartbeats — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Heartbeats', /^List Server Heartbeats/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  test('List Client Heartbeats — 200 with an explicit empty filter object', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Heartbeats', /^List Client Heartbeats/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    // No `sort`, no client-supplied `customerId` — see the file header.
    const { status } = await sendJson(op, portal.raw, { skip: 0, take: 50, filter: { logic: 'and', filters: [] } });
    expect(status).toBe(200);
  });

  test.skip('Delete Client Heartbeat — no disposable fixture (operates on real monitoring records)', () => {});
  test.skip('Delete Server Heartbeat — no disposable fixture (operates on real monitoring records)', () => {});
});
