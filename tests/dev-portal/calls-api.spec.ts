import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
  firstOwnSiteCall, firstOwnSiteCallId, assignedTagId,
} from './_helpers';

/**
 * Calls group (staging) — 18/20 operations covered (16 happy-path + 2 KNOWN
 * BUG regressions). Each test resolves a real own-site call LIVE per run
 * (`firstOwnSiteCall` — `List Calls` → first row on whatever site the key is
 * currently scoped to), NOT the old site-bound `KNOWN.callId` constant which
 * went stale whenever a tenant-isolation run left the key on another site.
 * Mutations are no-op-safe or restored.
 *
 * Deliberately NOT covered (no disposable fixture — would move/destroy real
 * shared-QA-account call data):
 * - `Batch Expire Calls` — permanently deletes real recordings.
 * - `Reassign Calls` — reassigns *every* call for an extension + time range
 *   to a different agent in one shot; not scopable to one throwaway call.
 *
 * KNOWN BUGs (dev-portal-happy-path-coverage-2026-08-28.md):
 * - `Get Call PCI Data` always 500s for a real, valid call.
 * - `Email Call` always 500s with a schema-correct, required-fields-only body.
 */
test.describe('Developer Portal (staging) — Calls API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('Add Call Note → Get Call Notes → Update Call Note → Edit Call Note Details → Delete Call Note', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);

    const addOp = await portal.openOperation('Calls', /^Add Call Note/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    await addOp.addParameter('callId', callId);
    const { status: addStatus, body: added } = await sendJson(addOp, portal.raw, {
      callId, note: `AQA coverage note ${Date.now()}`,
    });
    expect(addStatus).toBe(200);
    const noteId = (added as { id: string }).id;
    expect(noteId).toBeTruthy();

    const getOp = await portal.openOperation('Calls', /^Get Call Notes/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('callId', callId);
    const { status: getStatus, body: notes } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((notes as Array<{ NoteID: string }>).some(n => n.NoteID === noteId)).toBe(true);

    const updateOp = await portal.openOperation('Calls', /^Update Call Note/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    await updateOp.addParameter('callId', callId);
    await updateOp.addParameter('noteId', noteId);
    const { status: updateStatus, body: updateBody } = await sendJson(updateOp, portal.raw, {
      noteId, note: `AQA coverage note ${Date.now()} updated`,
    });
    expect(updateStatus).toBe(200);
    expect(updateBody).toBe('success');

    const detailsOp = await portal.openOperation('Calls', /^Edit Call Note Details/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await detailsOp.openConsole();
    await detailsOp.selectSubscriptionKey(API_KEY_OPTION);
    await detailsOp.addParameter('callId', callId);
    await detailsOp.addParameter('noteId', noteId);
    // Bare JSON string body, not an object (per the op's OpenAPI export).
    const { status: detailsStatus, body: detailsBody } = await sendJson(
      detailsOp, portal.raw, `AQA coverage note details ${Date.now()}`,
    );
    expect(detailsStatus).toBe(200);
    expect((detailsBody as { Id: string }).Id).toBe(noteId);

    const deleteOp = await portal.openOperation('Calls', /^Delete Call Note/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.addParameter('callId', callId);
    await deleteOp.addParameter('noteId', noteId);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });

  test('Update Call Tags — re-applies the call\'s own already-assigned tag (no-op-safe)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const call = await firstOwnSiteCall(portal, { withTags: true });
    const tagId = call.hasTags ? await assignedTagId(portal, call.id) : null;
    test.skip(!tagId, 'No own-site call with an assigned tag to re-apply (no-op-safe) — nothing to exercise this run.');
    const op = await portal.openOperation('Calls', /^Update Call Tags/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', call.id);
    const { status, body } = await sendJson(op, portal.raw, { callId: call.id, tagsIds: [tagId!] });
    expect(status).toBe(200);
    expect((body as Array<{ Id: string; IsAssigned: boolean }>).find(t => t.Id.toLowerCase() === tagId!.toLowerCase())?.IsAssigned).toBe(true);
  });

  test('Update Multiple Call Tags — batch variant, same no-op-safe tag', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const call = await firstOwnSiteCall(portal, { withTags: true });
    const tagId = call.hasTags ? await assignedTagId(portal, call.id) : null;
    test.skip(!tagId, 'No own-site call with an assigned tag to re-apply (no-op-safe) — nothing to exercise this run.');
    const op = await portal.openOperation('Calls', /^Update Multiple Call Tags/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, {
      callIds: [call.id], tagsIdsToAdd: [tagId!], tagsIdsToRemove: [],
    });
    expect(status).toBe(200);
    expect((body as Array<{ CallId: string }>)[0].CallId).toBe(call.id);
  });

  test('Update Legal Hold — toggles per call, restored to its original state', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Update Legal Hold/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status: onStatus, body: onBody } = await op.send();
    expect(onStatus).toBe(200);
    expect(onBody).toBe(true);
    const { status: offStatus, body: offBody } = await op.send();
    expect(offStatus).toBe(200);
    expect(offBody).toBe(false);
  });

  test('Batch Apply Legal Hold — form-urlencoded comma-separated call ids, then restored via Update Legal Hold', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const batchOp = await portal.openOperation('Calls', /^Batch Apply Legal Hold/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await batchOp.openConsole();
    await batchOp.selectSubscriptionKey(API_KEY_OPTION);
    await batchOp.addBody();
    await batchOp.addHeader('Content-Type', 'application/x-www-form-urlencoded');
    await batchOp.setRawRequestBody(callId);
    const { status, body } = await batchOp.send();
    expect(status).toBe(200);
    expect(body).toBe('Success');

    const restoreOp = await portal.openOperation('Calls', /^Update Legal Hold/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await restoreOp.openConsole();
    await restoreOp.selectSubscriptionKey(API_KEY_OPTION);
    await restoreOp.addParameter('callId', callId);
    const { body: restoredBody } = await restoreOp.send();
    expect(restoredBody).toBe(false);
  });

  test('Get Call Info — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Get Call Info/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status, body } = await op.send();
    expect(status).toBe(200);
    expect((body as { model: { id: string } }).model.id).toBe(callId);
  });

  test('List Calls — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Calls', /^List Calls/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  for (const opName of ['Get Linked Calls', 'Get Call Transcription']) {
    test(`${opName} — 200`, async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const callId = await firstOwnSiteCallId(portal);
      const op = await portal.openOperation('Calls', new RegExp(`^${opName}`));
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.addParameter('callId', callId);
      const { status } = await op.send();
      expect(status).toBe(200);
    });
  }

  test('Download Single Audio File — 200, returns a SAS download link', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Download Single Audio File/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    await op.addParameter('timeZoneName', 'UTC');
    const { status, body } = await op.send();
    expect(status).toBe(200);
    expect((body as { DownloadLink: string }).DownloadLink).toContain('blob.core.windows.net');
  });

  test('Download Audio Chunk — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Download Audio Chunk/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    await op.addParameter('timeZone', '0');
    await op.addParameter('timeZoneName', 'UTC');
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Download All Media — 200', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Download All Media/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    await op.addParameter('timeZoneName', 'UTC');
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('KNOWN BUG — Get Call PCI Data always 500s for a real, valid call', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Get Call PCI Data/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('callId', callId);
    const { status } = await op.send();
    expect(status).toBe(500);
  });

  test('KNOWN BUG — Email Call always 500s with a fully schema-correct, required-fields-only body', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const callId = await firstOwnSiteCallId(portal);
    const op = await portal.openOperation('Calls', /^Email Call/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, {
      mails: ['romana@callcabinet.com'], callId, subject: 'AQA coverage test email',
      text: 'AQA coverage test - safe to ignore', callIds: [callId],
    });
    expect(status).toBe(500);
  });

  test.skip('Batch Expire Calls — no disposable fixture (permanently deletes real recordings)', () => {});
  test.skip('Reassign Calls — not scopable to one throwaway call (moves an extension\'s whole call history)', () => {});
});
