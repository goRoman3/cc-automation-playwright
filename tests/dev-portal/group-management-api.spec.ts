import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, KNOWN, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson,
} from './_helpers';

/**
 * Group Management group (staging) — 5/5 operations covered.
 *
 * Live-verified (2026-08-28): List Agent Groups, Update Agent Group (a
 * full-record replace — omitting `isActive` silently deactivates the
 * group, so it's always passed as `true`).
 *
 * **2026-08-29 correction**: the catalogue's actual create-operation title
 * is "Create Agent Group" (`settings/agent-groups`), not "Add Agent Group"
 * — same naming trap as Role Management's "Create Custom Role" and Agent
 * Management's "Create Agent" (both fixed the same session). The old
 * `/^Add Agent Group/` regex never matched a real catalogue link, so this
 * test had never actually run to completion before. Fixed and
 * live-verified 2026-08-29: full Create → List (id readback) → Get →
 * Delete round trip passes end-to-end.
 */
test.describe('Developer Portal (staging) — Group Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Agent Groups — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Group Management', /^List Agent Groups/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test('Update Agent Group — no-op update on an existing disposable test group', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const groupId = KNOWN.disposableAgentGroupId;

    const listOp = await portal.openOperation('Group Management', /^List Agent Groups/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listOp.openConsole();
    await listOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: listStatus, body: groups } = await sendJson(listOp, portal.raw, LIST_BODY_100);
    expect(listStatus).toBe(200);
    const current = (groups as Array<{ id: number; customerId: string; name: string; agentJson: string }>)
      .find(g => g.id === groupId);
    expect(current, `Expected disposable test group ${groupId} to still exist`).toBeTruthy();

    const updateOp = await portal.openOperation('Group Management', /^Update Agent Group/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await updateOp.openConsole();
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus, body: updated } = await sendJson(updateOp, portal.raw, {
      id: current!.id, customerId: current!.customerId, name: current!.name,
      isActive: true, agentJson: current!.agentJson,
    });
    expect(updateStatus).toBe(200);
    expect((updated as { isActive: boolean }).isActive).toBe(true);
  });

  test('Create Agent Group → Get Agent Group → Delete Agent Group — full lifecycle', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const name = `AQA coverage group ${Date.now()}`;

    // Seed a real agent id — an empty agentJson is a silent no-op (KNOWN BUG).
    const listAgentsOp = await portal.openOperation('Agent Management', /^List Agents/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listAgentsOp.openConsole();
    await listAgentsOp.selectSubscriptionKey(API_KEY_OPTION);
    const { body: agents } = await sendJson(listAgentsOp, portal.raw, LIST_BODY_100);
    const agentId = (agents as Array<{ id: string }>)[0]?.id;
    expect(agentId, 'Expected at least one agent to seed the group with').toBeTruthy();

    const addOp = await portal.openOperation('Group Management', /^Create Agent Group/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    // ADO 37478: { customerId, name, isActive, agentJson } — agentJson is a JSON *string*.
    const { status: addStatus } = await sendJson(addOp, portal.raw, {
      customerId: KNOWN.customerId, name, isActive: true, agentJson: JSON.stringify([agentId]),
    });
    expect(addStatus).toBe(200);

    // The create response's `id` is always 0 (KNOWN BUG) — read the real id back.
    const listOp = await portal.openOperation('Group Management', /^List Agent Groups/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listOp.openConsole();
    await listOp.selectSubscriptionKey(API_KEY_OPTION);
    const { body: groups } = await sendJson(listOp, portal.raw, LIST_BODY_100);
    const created = (groups as Array<{ id: number; name: string }>).find(g => g.name === name);
    expect(created, 'Expected the newly created group to appear in List Agent Groups').toBeTruthy();
    const groupId = created!.id;

    const getOp = await portal.openOperation('Group Management', /^Get Agent Group \(/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('groupId', String(groupId));
    const { status: getStatus, body: fetched } = await getOp.send();
    expect(getStatus).toBe(200);
    expect((fetched as { id: number }).id).toBe(groupId);

    const deleteOp = await portal.openOperation('Group Management', /^Delete Agent Group/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await deleteOp.openConsole();
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.addParameter('agentGroupId', String(groupId));
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });
});
