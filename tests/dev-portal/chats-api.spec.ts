import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Chats group (staging) — 1/10 operations testable; the whole group is
 * blocked by an upstream bug.
 *
 * `List Chats` is the only entry point (in the API *and* in the main app)
 * that could supply a `chatId` for the other 9 operations, and it 500s
 * unconditionally: the backend auto-injects a `SiteId` filter into every
 * `POST calls/chats/list` request, then its own validation schema rejects
 * that field name (allowed: ChatId/ChatName/StartTime/EndTime/DateTime/
 * RecordingId/CallType/ChatType/Participants/Number/Agent/Extension/
 * IsInternalChat). Confirmed not console-only — the main app's Chat Listing
 * page's own `POST /api/calls/chats/list` fails identically.
 *
 * With no obtainable `chatId`, Add/Get/Update/Delete Chat Note, Download
 * Chat, Get Chat Details, Get Chat Message Notes, Get Chat Messages and
 * Send Chat Email cannot be exercised at all — SKIPPED with this reason
 * until the `List Chats` 500 is fixed.
 */
test.describe('Developer Portal (staging) — Chats API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('KNOWN BUG — List Chats always 500s (backend auto-injects an invalid SiteId filter)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Chats', /^List Chats/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(500);
    expect((body as { Description: string }).Description).toContain("Input should be 'ChatId'");
  });

  const blocked = 'blocked — no chatId obtainable while List Chats 500s (see file header)';
  test.skip(`Add Chat Note — ${blocked}`, () => {});
  test.skip(`Get Chat Notes — ${blocked}`, () => {});
  test.skip(`Update Chat Note — ${blocked}`, () => {});
  test.skip(`Delete Chat Note — ${blocked}`, () => {});
  test.skip(`Download Chat — ${blocked}`, () => {});
  test.skip(`Get Chat Details — ${blocked}`, () => {});
  test.skip(`Get Chat Message Notes — ${blocked}`, () => {});
  test.skip(`Get Chat Messages — ${blocked}`, () => {});
  test.skip(`Send Chat Email — ${blocked}`, () => {});
});
