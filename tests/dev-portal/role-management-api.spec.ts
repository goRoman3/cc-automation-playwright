import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, KNOWN, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, openConsole,
} from './_helpers';

/**
 * Role Management group (staging) — 6/6 operations covered.
 *
 * Live-verified 2026-08-29: List Custom Roles, List Custom Role
 * Restrictions (ADO 37612, no-param GET), Create Custom Role (catalogue
 * name is "Create", not "Add"), Update Custom Role (ADO 37614 —
 * `settings/custom-roles/permissions`, `access` is a JSON *string*).
 *
 * - KNOWN BUG — `Get Custom Role` ignores its own `roleId` path parameter:
 *   both a real created id and a bogus GUID return the same locked system
 *   role. Asserted as 200 + shape only.
 * - KNOWN BUG — `Delete Custom Role`'s Try-it console never finishes
 *   loading: after "Try this operation" the drawer stays on a
 *   `progressbar "Loading…"` and no Parameters section / Send button ever
 *   render (reproduced 6/6 console-open attempts across 2 runs on
 *   2026-08-29, in a dedicated `Create → Delete` test with no other steps
 *   before it — so it is not the transient schema/render race). The
 *   operation cannot be exercised through the console; the test documents
 *   the stuck-loading state as the KNOWN BUG.
 */
test.describe('Developer Portal (staging) — Role Management API', () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  /** Best-effort cleanup — deletes a role without asserting (for `finally`). */
  async function tryDeleteRole(portal: DeveloperPortalPage, roleId: string): Promise<void> {
    try {
      const op = await openConsole(portal, 'Role Management', /^Delete Custom Role/, { retries: 2 });
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.fillParameters(roleId);
      await op.send();
    } catch {
      /* Delete Custom Role console is broken (see file header) — role is disposable */
    }
  }

  async function createRole(portal: DeveloperPortalPage, name: string): Promise<string> {
    const addOp = await portal.openOperation('Role Management', /^Create Custom Role/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await addOp.openConsole();
    await addOp.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await sendJson(addOp, portal.raw, { name });
    expect(status).toBe(200);
    const id = (body as { id: string }).id;
    expect(id).toBeTruthy();
    return id;
  }

  test('List Custom Roles — 200 baseline', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Role Management', /^List Custom Roles/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await sendJson(op, portal.raw, LIST_BODY);
    expect(status).toBe(200);
  });

  test('List Custom Role Restrictions — 200 (no-param GET)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const op = await portal.openOperation('Role Management', /^List Custom Role Restrictions/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await op.openConsole();
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status } = await op.send();
    expect(status).toBe(200);
  });

  test('Create Custom Role → Get Custom Role (KNOWN BUG: ignores roleId)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    let roleId: string | undefined;
    try {
      roleId = await createRole(portal, `AQA coverage role ${Date.now()}`);

      const getOp = await portal.openOperation('Role Management', /^Get Custom Role \(/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await getOp.openConsole();
      await getOp.selectSubscriptionKey(API_KEY_OPTION);
      await getOp.fillParameters(roleId);
      const { status, body } = await getOp.send();
      expect(status).toBe(200);
      // KNOWN BUG: returns some locked system role regardless of `roleId` —
      // only the 200 + shape is meaningful, not the identity.
      expect(typeof (body as { name: string }).name).toBe('string');
    } finally {
      if (roleId) await tryDeleteRole(portal, roleId);
    }
  });

  test('Create Custom Role → Update Custom Role — 200 (settings/custom-roles/permissions)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    let roleId: string | undefined;
    try {
      const roleName = `AQA coverage role ${Date.now()}`;
      roleId = await createRole(portal, roleName);

      // ADO 37614: { id, name, access, locked, customerId } — `access` is a
      // JSON string of a permission-id array (empty "[]" here).
      const updateOp = await portal.openOperation('Role Management', /^Update Custom Role/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await updateOp.openConsole();
      await updateOp.selectSubscriptionKey(API_KEY_OPTION);
      const { status: updateStatus } = await sendJson(updateOp, portal.raw, {
        id: roleId, name: `${roleName} updated`, access: '[]',
        locked: false, customerId: KNOWN.customerId,
      });
      expect(updateStatus).toBe(200);
    } finally {
      if (roleId) await tryDeleteRole(portal, roleId);
    }
  });

  test('KNOWN BUG — Delete Custom Role: Try-it console never finishes loading (no Send button)', async ({ homePage }, testInfo) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    let roleId: string | undefined;
    try {
      roleId = await createRole(portal, `AQA delete-bug role ${Date.now()}`);

      // Open the operation and click "Try this operation" — then check
      // whether the console ever renders a Send button (it should within a
      // few seconds; the bug is it stays on a "Loading…" progressbar).
      const op = await portal.openOperation('Role Management', /^Delete Custom Role/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      let sendButtonRendered = true;
      try {
        await op.openConsole(20_000);
      } catch {
        sendButtonRendered = false;
      }
      const loadingVisible = await portal.raw
        .getByRole('progressbar', { name: 'Loading...' })
        .isVisible()
        .catch(() => false);

      await testInfo.attach('delete-custom-role-console-stuck', {
        body: JSON.stringify({ roleId, sendButtonRendered, loadingVisible }, null, 2),
        contentType: 'application/json',
      });
      console.log(`[Delete Custom Role console] sendButtonRendered=${sendButtonRendered} loadingVisible=${loadingVisible}`);

      // KNOWN BUG: the console never renders a Send button. If it ever does,
      // this assertion fails — flip Delete Custom Role to a real happy-path
      // Create → Delete test at that point.
      expect(sendButtonRendered, 'Delete Custom Role console rendered a Send button — the bug may be fixed').toBe(false);
    } finally {
      if (roleId) await tryDeleteRole(portal, roleId);
    }
  });
});
