import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { ApiOperationPage } from '../../pages/dev-portal/ApiOperationPage';
import { STAGING_APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS } from './_helpers';

/**
 * Negative validation checks: for each operation with a known, confirmed
 * required-fields-only body (established live in `happy-path-staging.spec.ts`),
 * omit one required field at a time and confirm the API rejects the request
 * rather than silently accepting it with a null/default value. Same staging
 * host/account/subscription key as `happy-path-staging.spec.ts` — see that
 * file's header for the host-confusion background.
 *
 * One test per operation, looping over its required fields in a single
 * console session (not one test per field) — keeps the file's test count
 * manageable while still exercising every required field individually.
 *
 * Scope (first batch, 2026-08-28): the 8 groups/operations whose minimal
 * required-fields-only body was already confirmed live while building the
 * happy-path suite. Groups with only a full-object body (no reduced
 * required set established — e.g. Upsert Alert Configuration, Update Agent
 * Group, Update Company/SSO Settings) are deliberately left out here; they'd
 * need their own live field-by-field exploration first, which this batch
 * didn't budget for.
 *
 * **2026-08-30**: the create-from-body cases here (Add Tag / Add Site /
 * Create Extension / Add IP Whitelist / Create Custom Role / Add Call Note)
 * are now covered systematically — with a per-op CONTROL case (full valid
 * body → success) and `finally` cleanup — by the declarative
 * `negative-required-fields-matrix.spec.ts` (`_negative-fields.ts` engine +
 * `negative-fields-catalog.ts`). This file is retained for the two ops the
 * matrix EXCLUDES: **Add User** (control creates a real user + invitation
 * email, and Delete User's console is broken) and **Manual Redaction** (the
 * hold + endpoint hang). Not run live either — see `tests/dev-portal/UNVERIFIED.md`.
 */

/** Same schema-blind-console workaround as happy-path-staging.spec.ts. */
async function sendJson(
  op: ApiOperationPage,
  page: import('@playwright/test').Page,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const bodyField = page.getByLabel('Request body', { exact: true });
  if (!(await bodyField.isVisible().catch(() => false))) {
    await op.addBody();
    await op.addHeader('Content-Type', 'application/json');
  }
  await op.setRequestBody(body);
  return op.send();
}

/**
 * Sends `fullBody` once per key in `requiredFields`, each time with that one
 * key omitted, asserting the response is a client error (4xx) rather than a
 * silent 200 (which would mean the field isn't actually enforced despite
 * being part of the confirmed required-only body). Returns each field's
 * observed status so a caller can react to an unexpected 200 (e.g. clean up
 * a record that got created despite the missing field).
 */
async function collectFieldOmissionResults(
  op: ApiOperationPage,
  page: import('@playwright/test').Page,
  fullBody: Record<string, unknown>,
  requiredFields: string[],
): Promise<Record<string, { status: number; body: unknown }>> {
  const results: Record<string, { status: number; body: unknown }> = {};
  for (const field of requiredFields) {
    const partial = { ...fullBody };
    delete partial[field];
    results[field] = await sendJson(op, page, partial);
  }
  return results;
}

test.describe('Development portal (staging) — negative validation: missing required fields', () => {
  test.describe.configure({ timeout: 90_000 });

  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'Set user / adminpass in .env to run these staging Development portal checks',
  );

  test.beforeEach(async ({ page, loginPage }) => {
    await page.goto(STAGING_APP_URL);
    await loginPage.login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.waitForURL('**/Home', { timeout: 20_000 });
  });

  test.afterEach(async ({ page }) => {
    for (const p of page.context().pages()) {
      if (p !== page) await p.close().catch(() => {});
    }
  });

  test.describe('IP Whitelist', () => {
    // KNOWN BUG (found 2026-08-28): omitting `ipAddress` entirely 500s
    // (unhandled null) instead of a proper 400 validation error.
    test('KNOWN BUG — Add IP Whitelist 500s (not 400) when ipAddress is omitted', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('IP Whitelist', /^Add IP Whitelist/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await sendJson(op, portal.raw, {});
      expect(status).toBe(500);
    });
  });

  test.describe('Tag Management', () => {
    test('Add Tag — rejects (400) when name is omitted', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Tag Management', /^Add Tag/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await sendJson(op, portal.raw, {});
      expect(status).toBe(400);
    });
  });

  test.describe('Site Management', () => {
    test('Add Site — rejects (400) when name is omitted', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Site Management', /^Add Site/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await sendJson(op, portal.raw, {});
      expect(status).toBe(400);
    });
  });

  test.describe('Role Management', () => {
    // KNOWN BUG (found 2026-08-28): omitting `name` entirely 500s (unhandled
    // null) instead of a proper 400 validation error — same bug class as
    // Add IP Whitelist above.
    test('KNOWN BUG — Create Custom Role 500s (not 400) when name is omitted', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const op = await portal.openOperation('Role Management', /^Create Custom Role/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { status } = await sendJson(op, portal.raw, {});
      expect(status).toBe(500);
    });
  });

  test.describe('Extension Management', () => {
    test('Create Extension — rejects (400) when name or siteId is omitted', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const siteId = '8cc22cd2-a4b7-46c5-b907-9050e110dac5'; // UA team recording — the key's own site
      const op = await portal.openOperation('Extension Management', /^Create Extension/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const results = await collectFieldOmissionResults(
        op, portal.raw,
        { name: `AQA negative-test extension ${Date.now()}`, siteId },
        ['name', 'siteId'],
      );
      for (const [field, result] of Object.entries(results)) {
        expect(result.status, `omitting '${field}'`).toBe(400);
      }
    });
  });

  test.describe('User Management', () => {
    // Live-verified 2026-08-28: `userRoleIdCombined` IS enforced (400), but
    // `qcRId` is NOT — omitting it still creates a real user (200) despite
    // both being part of the happy-path suite's confirmed
    // "required-fields-only" body (that just means they're the minimal set
    // that returns 200 with real values, not that each one is independently
    // enforced). `email`/`firstName`/`lastName` are asserted as enforced
    // here as a hypothesis carried over from the happy-path body — not yet
    // individually confirmed omitted one-at-a-time before this test existed;
    // this run is what confirms (or corrects) that.
    test('Add User — most required fields rejected when omitted; qcRId is not enforced', async ({ homePage }) => {
      // ⚠️ Same throwaway-address convention as the happy-path Add User test
      // — an unenforced field still creates a real user and sends a real
      // invitation email. Never run against a real address.
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const email = `aqa-negative-test+${Date.now()}@callcabinet.com`;
      const op = await portal.openOperation('User Management', /^Add User/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const fullBody = { userRoleIdCombined: '3', qcRId: 0, email, firstName: 'AQA', lastName: 'negative test' };
      const enforcedFields = ['userRoleIdCombined', 'email', 'firstName', 'lastName'];
      const unenforcedFields = ['qcRId'];
      const results = await collectFieldOmissionResults(op, portal.raw, fullBody, [...enforcedFields, ...unenforcedFields]);

      for (const field of enforcedFields) {
        expect(results[field].status, `omitting '${field}'`).toBe(400);
      }

      for (const field of unenforcedFields) {
        const result = results[field];
        if (result.status !== 200) continue; // confirms it's now enforced — nothing to clean up
        const createdId = (result.body as { id?: string }).id;
        const createdUserRId = (result.body as { userRId?: string }).userRId;
        if (!createdId) continue;
        const deleteOp = await portal.openOperation('User Management', /^Delete User/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await deleteOp.openConsole();
        await deleteOp.selectSubscriptionKey(API_KEY_OPTION);
        await deleteOp.addParameter('userId', createdId);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await deleteOp.addParameter('userRId', createdUserRId ?? '');
        await deleteOp.send().catch(() => {});
      }
    });
  });

  test.describe('Manual Redaction', () => {
    // Live-verified 2026-08-28: only `callId` and `requestText` are
    // actually enforced (400) — `entityTypeId` is NOT, despite being part
    // of the happy-path suite's confirmed required-fields-only body.
    // Omitting it still returns 200 and creates a real redaction request
    // (no Delete op exists for this group — uses its own unique window to
    // avoid colliding with the happy-path suite's own test).
    // `startMilliseconds`/`endMilliseconds` are handled separately below —
    // neither is validated nor accepted, both hang the backend entirely.
    test('Submit Call Redaction Request — callId/requestText rejected when omitted; entityTypeId is not enforced', async ({ homePage }) => {
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const callId = 'd71ac345-86a0-f111-9b33-6045bded66d5'; // UA team recording — known-good for this key
      const op = await portal.openOperation('Manual Redaction', /^Submit Call Redaction Request/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.addParameter('callId', callId);

      const enforcedFields = ['callId', 'requestText'];
      const unenforcedFields = ['entityTypeId'];
      for (const field of [...enforcedFields, ...unenforcedFields]) {
        const startMilliseconds = Date.now() % 100_000;
        const fullBody: Record<string, unknown> = {
          callId, entityTypeId: 1, startMilliseconds, endMilliseconds: startMilliseconds + 5000,
          requestText: 'AQA negative-test redaction',
        };
        delete fullBody[field];
        const { status } = await sendJson(op, portal.raw, fullBody);
        if (unenforcedFields.includes(field)) continue; // documented above — don't assert 400 for these
        expect(status, `omitting '${field}'`).toBe(400);
      }
    });

    // KNOWN BUG (found 2026-08-28, reproduced 3+ times each): omitting
    // either time-window field isn't rejected AND doesn't succeed — the
    // real network request fires (confirmed via `--trace on` network log
    // for `endMilliseconds`: a genuine `OPTIONS` 200 preflight followed by
    // a real `POST` to `.../api/calls/post-redaction/{callId}`) but the
    // server never responds at all, timing out at 30s every time (trace
    // shows the POST's response status as `-1`, i.e. the connection never
    // completed) — a server-side hang, not a client-side console issue like
    // the schema-race bugs documented elsewhere in this suite. (An earlier
    // exploratory run saw a single fast 200 for `startMilliseconds`
    // omission before this was isolated — not reproduced again in 3
    // follow-up isolated attempts, treated as a one-off, not the real
    // behavior.)
    for (const missingField of ['startMilliseconds', 'endMilliseconds'] as const) {
      test(`KNOWN BUG — Submit Call Redaction Request hangs indefinitely (no response) when ${missingField} is omitted`, async ({ homePage }) => {
        const portal = await DeveloperPortalPage.openFrom(homePage);
        const callId = 'd71ac345-86a0-f111-9b33-6045bded66d5'; // UA team recording — known-good for this key
        const op = await portal.openOperation('Manual Redaction', /^Submit Call Redaction Request/);
        await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
        await op.openConsole();
        await op.selectSubscriptionKey(API_KEY_OPTION);
        await op.addParameter('callId', callId);
        const startMilliseconds = Date.now() % 100_000;
        const fullBody: Record<string, unknown> = {
          callId, entityTypeId: 1, startMilliseconds, endMilliseconds: startMilliseconds + 5000,
          requestText: 'AQA negative-test redaction',
        };
        delete fullBody[missingField];
        await expect(sendJson(op, portal.raw, fullBody)).rejects.toThrow(/Timeout/);
      });
    }
  });

  test.describe('Calls', () => {
    test('Add Call Note — rejects (400) when note is omitted', async ({ homePage }) => {
      // Only `note` is checked here — `callId` is also the path/query
      // parameter (added via `addParameter`, separate from the body), so
      // omitting it from the body alone doesn't test "no callId at all";
      // that would need removing the parameter too, which isn't covered by
      // this loop-over-body-keys helper. Left as a follow-up.
      const portal = await DeveloperPortalPage.openFrom(homePage);
      const callId = 'd71ac345-86a0-f111-9b33-6045bded66d5'; // UA team recording — known-good for this key
      const op = await portal.openOperation('Calls', /^Add Call Note/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      await op.addParameter('callId', callId);
      const { status } = await sendJson(op, portal.raw, { callId });
      expect(status).toBe(400);
    });
  });
});
