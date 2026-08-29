import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, KNOWN, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, openConsole,
} from './_helpers';

/**
 * Agent Management group (staging) — 11/11 operations covered.
 *
 * Live-verified (2026-08-28): List Agents, and the Agent Extension mapping
 * sub-CRUD (Create Agent Extension Mapping → Update Agent Extension →
 * Delete Agent Extension).
 *
 * **2026-08-29 correction**: the catalogue's actual create-operation title
 * is "Create Agent" (`settings/agents`), not "Add Agent" as this file
 * originally assumed — same naming trap already documented for Role
 * Management ("Create Custom Role", not "Add") and Group Management
 * ("Create Agent Group", not "Add", fixed the same session). The old
 * `/^Add Agent \(/` regex never matched, so `openOperation()` would have
 * hung on `expect(operationLink).toBeVisible()` until timeout — this test
 * was never actually run to a real pass/fail before. Fixed here; live-
 * verified the `Create Agent` step itself with the exact `agentDto` payload
 * below — 200, full agent object back with a real `id`.
 *
 * **Stale-site trap found and fixed 2026-08-29**: the shared
 * `Primary: API_test` key's site assignment drifts whenever the
 * tenant-isolation suite switches it (confirmed live: currently
 * `49bb6c26-820c-469b-8067-010137afd265`, not `KNOWN.siteId`'s
 * `8cc22cd2-...`, UA team recording — left over from a prior
 * tenant-isolation-negative-writes session and never restored). A
 * hardcoded `KNOWN.siteId` made `Create Agent` return 200 for a site the
 * key can no longer see, so the created agent never showed up in
 * `List Agents`, and `Update Agent` 400'd: `"Configured site does not
 * contain selected agent or extension."`. **Fixed by never hardcoding
 * `siteId` here** — every test that needs one now reads it live off an
 * existing agent via `firstAgent()`, so this file is correct regardless of
 * which site the key currently happens to be on. This same stale-`KNOWN.
 * siteId` risk is not fixed project-wide — worth checking every other file
 * in this folder that still references it directly.
 *
 * **`Get Agent Extensions`/`Get Agent`/`Update Agent`/`Delete Agent`/`Batch
 * Delete Agents` not independently re-run end-to-end after the `siteId`
 * fix above** — run them first when picking this up.
 *
 * **`Update Agent` — probable BACKEND BUG.** The dedicated
 * `Update Agent — KNOWN BUG regression` test builds the evidence package:
 * Create Agent → Get Agent → compare `siteId` across the create request,
 * the create response and the get response → Update changing only `notes`,
 * with the same `siteId`. Create + Get both confirm the agent is on the
 * key's current site, yet Update returns `400 "Configured site does not
 * contain selected agent or extension."` — which rules out a test-data
 * problem. Asserted as the 400; flip to a 200 happy-path if Smarsh fixes
 * it. Run output carries the `update-agent-400-evidence` attachment.
 *
 * **`Delete Agent` is covered by its own `Create Agent → Delete Agent`
 * test** (asserts `204`) so its coverage no longer depends on `Update Agent`
 * passing (the two shared one lifecycle test before).
 *
 * Steps/example data below come from ADO suite 37288 (test cases 37293,
 * 37298, 37320, 37324, 37326, 37343, 37344):
 * - `Get Supervisors` (37344) — no-param GET, response is `{Id, Name}[]`.
 * - `Get Agent Extensions` (37343) — POST `settings/agents/extensions`
 *   with query params `agentId` + `siteId` AND body `{ pattern: "..." }`.
 * - `Get Agent` (37326) — GET `{agentId}`; response has firstName/lastName/
 *   email/site (no `id` field asserted).
 * - `Create Agent` (37293, live-verified 2026-08-29) / `Update Agent`
 *   (37298) — full DTO incl. `customerId`; `Delete Agent` (37320) → `204`.
 * - `Batch Delete Agents` (37324) — body is a bare id-string array → `200`.
 */
test.describe('Developer Portal (staging) — Agent Management API', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('List Agents — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Agent Management', /^List Agents/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  /**
   * Full Agent DTO per ADO 37293/37298 — minimal reliable set isn't
   * isolated, so send it all. `siteId` is passed in per-call rather than
   * hardcoded to `KNOWN.siteId`: that constant goes stale whenever the
   * shared `Primary: API_test` key's site assignment is switched by the
   * tenant-isolation suite (confirmed happening 2026-08-29 — see the file
   * header) and a mismatched `siteId` makes `Create Agent` succeed but the
   * agent invisible to `List Agents`/`Update Agent` on this key. Always
   * source `siteId` live via `firstAgent()` below instead.
   */
  const agentDto = (firstName: string, lastName: string, siteId: string, extra: Record<string, unknown> = {}) => ({
    firstName, lastName, email: null, siteId, site: '',
    enableScreenshots: false, enableCompliance: false, emailOnQcComplete: false,
    screenshotInterval: null, windowsUsername: '', supervisor: null, specialEmail: null,
    mEmail: null, assignedSupervisor: null, assignedExtension: false,
    groups: [] as string[], groupsDisplayName: '', extensions: [] as string[],
    extensionsDisplayName: null, extensionsJson: null, groupsJson: null, notes: '',
    customerId: KNOWN.customerId, ...extra,
  });

  /**
   * List Agents → first agent's `{id, siteId}`. `siteId` here is always the
   * key's *currently active* site (whatever it happens to be switched to),
   * not the possibly-stale `KNOWN.siteId` — see `agentDto()` above for why
   * that matters.
   */
  async function firstAgent(portal: DeveloperPortalPage): Promise<{ id: string; siteId: string }> {
    const listOp = await portal.openOperation('Agent Management', /^List Agents/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listOp.openConsole();
    await listOp.selectSubscriptionKey(API_KEY_OPTION);
    const { body: agents } = await sendJson(listOp, portal.raw, LIST_BODY_100);
    const agent = (agents as Array<{ id: string; siteId: string }>)[0];
    expect(agent, 'Expected at least one agent in this account').toBeTruthy();
    return agent!;
  }

  test('Get Supervisors — 200 (no-param GET)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Agent Management', /^Get Supervisors/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Get Agent Extensions — 200 (agentId + siteId params, { pattern } body)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const { id: agentId, siteId } = await firstAgent(portal);

    const op = await portal.openOperation('Agent Management', /^Get Agent Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    await op.addParameter('agentId', agentId);
    await op.addParameter('siteId', siteId);
    const { status } = await sendJson(op, portal.raw, { pattern: '' });
    expect(status).toBe(200);
  });

  test('Get Agent — 200 for a live-discovered agent id', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const { id: agentId } = await firstAgent(portal);

    const getOp = await portal.openOperation('Agent Management', /^Get Agent \(/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await getOp.openConsole();
    await getOp.selectSubscriptionKey(API_KEY_OPTION);
    await getOp.addParameter('agentId', agentId);
    const { status, body } = await getOp.send();
    expect(status).toBe(200);
    // ADO 37326: response carries firstName/lastName/email/site (not a bare `id`).
    expect(typeof (body as { firstName: string }).firstName).toBe('string');
  });

  /** Best-effort cleanup — deletes an agent without asserting (for `finally`). */
  async function tryDeleteAgent(portal: DeveloperPortalPage, agentId: string): Promise<void> {
    try {
      const op = await portal.openOperation('Agent Management', /^Delete Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.addParameter('agentId', agentId);
      await op.send();
    } catch {
      /* leave the disposable agent — every account here is disposable per ADO 37293 */
    }
  }

  test('Create Agent → Delete Agent — 204 (Delete asserted independently of Update Agent)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const stamp = Date.now();
    const { siteId } = await firstAgent(portal);
    let agentId: string | undefined;

    try {
      const createOp = await portal.openOperation('Agent Management', /^Create Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await createOp.openConsole();
      await createOp.selectSubscriptionKey(API_KEY_OPTION);
      const { status: createStatus, body: created } = await sendJson(createOp, portal.raw, agentDto('AQA', `del ${stamp}`, siteId));
      expect(createStatus).toBe(200);
      agentId = (created as { id: string }).id;
      expect(agentId).toBeTruthy();

      const deleteOp = await portal.openOperation('Agent Management', /^Delete Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await deleteOp.openConsole();
      await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
      await deleteOp.addParameter('agentId', agentId);
      const { status: deleteStatus } = await deleteOp.send();
      expect(deleteStatus).toBe(204); // ADO 37320
      agentId = undefined; // deleted — nothing to clean up
    } finally {
      if (agentId) await tryDeleteAgent(portal, agentId);
    }
  });

  test('Update Agent — KNOWN BUG regression: 400 "Configured site does not contain selected agent or extension" despite Create + Get confirming the site', async ({ homePage }, testInfo) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const stamp = Date.now();
    // `siteId` is read live off an existing agent, so it is unambiguously
    // the key's *current* site — not the possibly-stale `KNOWN.siteId`.
    const { siteId } = await firstAgent(portal);
    let agentId: string | undefined;

    try {
      // 1) Create Agent with a known siteId.
      const createReqBody = agentDto('AQA', `updbug ${stamp}`, siteId);
      const createOp = await portal.openOperation('Agent Management', /^Create Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await createOp.openConsole();
      await createOp.selectSubscriptionKey(API_KEY_OPTION);
      const { status: createStatus, body: created } = await sendJson(createOp, portal.raw, createReqBody);
      expect(createStatus, 'Create Agent should return 200').toBe(200);
      agentId = (created as { id: string }).id;
      expect(agentId, 'Create Agent response should carry an id').toBeTruthy();
      const createRespSiteId =
        (created as { siteId?: string; site?: string }).siteId ?? (created as { site?: string }).site;

      // 2) Get Agent immediately, read the site back.
      const getOp = await portal.openOperation('Agent Management', /^Get Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await getOp.openConsole();
      await getOp.selectSubscriptionKey(API_KEY_OPTION);
      await getOp.addParameter('agentId', agentId!);
      const { status: getStatus, body: fetched } = await getOp.send();
      expect(getStatus, 'Get Agent should return 200').toBe(200);
      const getRespSiteId =
        (fetched as { siteId?: string; site?: string }).siteId ?? (fetched as { site?: string }).site;

      // 3) Update Agent — identical body to Create except `id` (required) and
      // one harmless field (`notes`); same `siteId`.
      const updateReqBody = agentDto('AQA', `updbug ${stamp}`, siteId, {
        id: agentId, notes: `AQA update-bug marker ${stamp}`,
      });
      const updateOp = await portal.openOperation('Agent Management', /^Update Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await updateOp.openConsole();
      await updateOp.selectSubscriptionKey(API_KEY_OPTION);
      const { status: updateStatus, body: updateBody } = await sendJson(updateOp, portal.raw, updateReqBody);

      // 4) Evidence package — attached to the run and printed to the console.
      const evidence = {
        agentId,
        createRequestSiteId: createReqBody.siteId,
        createResponseSiteId: createRespSiteId,
        getResponseSiteId: getRespSiteId,
        sitesAllMatch:
          createReqBody.siteId === createRespSiteId && createRespSiteId === getRespSiteId,
        updateRequestChangedField: 'notes',
        updateRequestBody: updateReqBody,
        updateResponseStatus: updateStatus,
        updateResponseBody: updateBody,
      };
      await testInfo.attach('update-agent-400-evidence', {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json',
      });
      console.log('[Update Agent 400 — evidence]\n' + JSON.stringify(evidence, null, 2));

      // Sanity: the site round-trips through Create and Get unchanged. If
      // either of these fails, the finding is different (Create ignoring the
      // body `siteId`, or Get returning another site) — not the Update bug.
      expect(createRespSiteId, 'Create response siteId should equal the sent siteId').toBe(createReqBody.siteId);
      expect(getRespSiteId, 'Get Agent siteId should equal the created siteId').toBe(createRespSiteId);

      // The bug: Update still 400s with the site-scoping message even though
      // Create + Get both place the agent on this exact site. If this ever
      // returns 200, the bug is fixed — flip to `expect(updateStatus).toBe(200)`
      // and move Update Agent to happy-path.
      expect(updateStatus, 'Update Agent — see the attached update-agent-400-evidence').toBe(400);
      expect(JSON.stringify(updateBody)).toContain('Configured site does not contain selected agent or extension');
    } finally {
      if (agentId) await tryDeleteAgent(portal, agentId);
    }
  });

  test('Batch Delete Agents — deletes two throwaway agents this test creates', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const stamp = Date.now();
    const { siteId } = await firstAgent(portal);
    const ids: string[] = [];

    for (const suffix of ['a', 'b']) {
      const addOp = await portal.openOperation('Agent Management', /^Create Agent \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await addOp.openConsole();
      await addOp.selectSubscriptionKey(API_KEY_OPTION);
      const { status, body } = await sendJson(addOp, portal.raw, agentDto('AQA', `batch ${stamp} ${suffix}`, siteId));
      expect(status).toBe(200);
      ids.push((body as { id: string }).id);
    }

    const batchOp = await portal.openOperation('Agent Management', /^Batch Delete Agents/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await batchOp.openConsole();
    await batchOp.selectSubscriptionKey(API_KEY_OPTION);
    // ADO 37324: body is a bare array of id strings — sendJson stringifies it as `["id1","id2"]`.
    const { status } = await sendJson(batchOp, portal.raw, ids);
    expect(status).toBe(200);
  });

  test('Create Agent Extension Mapping → Update Agent Extension → Delete Agent Extension — full round trip', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    const listAgentsOp = await portal.openOperation('Agent Management', /^List Agents/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listAgentsOp.openConsole();
    await listAgentsOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: agentsStatus, body: agentsBody } = await sendJson(listAgentsOp, portal.raw, LIST_BODY_100);
    expect(agentsStatus).toBe(200);
    const freeAgent = (agentsBody as Array<{ id: string; assignedExtension: boolean | null }>)
      .find(a => !a.assignedExtension);
    expect(freeAgent, 'Expected at least one agent with no assigned extension in this account').toBeTruthy();

    const listExtensionsOp = await portal.openOperation('Extension Management', /^List Extensions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await listExtensionsOp.openConsole();
    await listExtensionsOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: extStatus, body: extBody } = await sendJson(listExtensionsOp, portal.raw, LIST_BODY_100);
    expect(extStatus).toBe(200);
    const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
    const freeExtension = (extBody as Array<{ id: string; agentId: string }>).find(e => e.agentId === ZERO_GUID);
    expect(freeExtension, 'Expected at least one unassigned extension in this account').toBeTruthy();

    // `openConsole(..., { retries })` here: the Send-never-fires console race
    // hit the Delete step of this round trip on 2026-08-29 (page.waitForResponse
    // 30s timeout) — reopening the operation fresh clears the blind console.
    const createOp = await openConsole(portal, 'Agent Management', /^Create Agent Extension Mapping/, { retries: 3 });
    await createOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: createStatus, body: created } = await sendJson(createOp, portal.raw, {
      agentId: freeAgent!.id, extensionId: freeExtension!.id,
    });
    expect(createStatus).toBe(200);
    const assignment = created as { id: string; agentId: string; extensionId: string };
    expect(assignment.agentId).toBe(freeAgent!.id);

    const updateOp = await openConsole(portal, 'Agent Management', /^Update Agent Extension/, { retries: 3 });
    await updateOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status: updateStatus } = await sendJson(updateOp, portal.raw, {
      id: assignment.id, agentId: freeAgent!.id, extensionId: freeExtension!.id,
    });
    expect(updateStatus).toBe(200);

    const deleteOp = await openConsole(portal, 'Agent Management', /^Delete Agent Extension/, { retries: 3 });
    await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
    await deleteOp.fillParameters(assignment.id);
    const { status: deleteStatus } = await deleteOp.send();
    expect(deleteStatus).toBe(200);
  });
});
