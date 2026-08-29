import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import { STAGING_APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS } from './_helpers';

/**
 * Regression checks for bugs found while validating the new per-site API
 * key scoping feature on the **staging** Development portal — see
 * `docs/bug-reports/dev-portal-tenant-scoping-2026-08-26.md` for full
 * write-ups (reproduction steps, exact request/response bodies).
 *
 * Staging, not prod: navigates directly to `STAGING_APP_URL` (`_helpers.ts`,
 * itself sourced from `.env`'s `BASE_URL` — note the extra "s" in
 * "systems staging") rather than using `loginPage.goto()`, which relies on
 * the same `BASE_URL` indirectly through Playwright's `baseURL` config.
 *
 * Account: the `user`/`adminpass` env vars (non-standard names, not wired
 * into `getTestUser()` — added ad hoc for this investigation). Company:
 * CC Test 1. Subscription key: "Primary: API_test", configured with a
 * per-site permission via Settings > API Management.
 *
 * Bugs 2 and 3 (see the bug report) turned out to be **intermittent**, not
 * deterministic — a suspected async schema-load race in the console: when
 * the operation's schema fetch finishes before the console renders,
 * everything works (parameter fields, pre-filled body, correct
 * Content-Type); when it doesn't, the console falls back to a bare,
 * schema-blind state instead of waiting. Two mitigations used throughout
 * this file to get a consistent, watchable repro:
 *  - `SCHEMA_LOAD_PAUSE_MS`: a short pause after navigating to an operation
 *    and before clicking "Try this operation", to give the schema fetch a
 *    head start.
 *  - Re-opening the operation fresh (`portal.openOperation(...)` again)
 *    before every distinct attempt within a test, rather than mutating an
 *    already-open console's body/subscription key in place — changing the
 *    subscription key on an already-open console was observed not to
 *    reliably take effect on the next `Send`.
 */
// Known CC Test 1 calls, still present on staging as of 2026-08-27.
const CALL_ID_ANALYTICS_SYNTHETIC_DATA = 'c849409a-bc60-f111-8fcb-7c1e5215eb0e';

test.describe('Development portal (staging) — tenant-scoping bug regressions', () => {
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

  test('Bug 1 — List Calls 500s with an empty body (request routed without the /api/ prefix)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const operation = await portal.openOperation('Calls', /^List Calls/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await operation.openConsole();

    await test.step('Replace the placeholder example body with a real date-range filter', async () => {
      await operation.setRequestBody({
        skip: 0,
        take: 200,
        sort: [{ field: 'stampStartTime', dir: 'desc' }],
        filter: {
          logic: 'and',
          filters: [
            { field: 'stampStartTime', operator: 'gte', value: '2020-01-01T00:00:00Z' },
            { field: 'stampStartTime', operator: 'lte', value: '2026-12-31T23:59:59Z' },
          ],
        },
        speaker: 0,
        terms: [],
        query: '',
        ai_search_enabled: false,
      });
    });

    await operation.selectSubscriptionKey(API_KEY_OPTION);

    await test.step('Send and confirm the known 500 (empty body — see bug report item 1)', async () => {
      const { status, body } = await operation.send();
      expect(status).toBe(500);
      expect(body).toEqual({});
    });
  });

  test('Bug 2 — console has no fillable {callId} field for non-GET operations (Update Legal Hold)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    await test.step('Attempt 1 (fresh operation open)', async () => {
      const operation = await portal.openOperation('Calls', /^Update Legal Hold/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      const hasField = await operation.hasParameterField('callId');
      test.info().annotations.push({ type: 'attempt-1', description: `callId field present: ${hasField}` });
    });

    await test.step('Attempt 2 (re-open the operation fresh — do not reuse the same drawer)', async () => {
      const operation = await portal.openOperation('Calls', /^Update Legal Hold/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      const hasField = await operation.hasParameterField('callId');
      test.info().annotations.push({ type: 'attempt-2', description: `callId field present: ${hasField}` });
    });

    // Intermittent (see the bug report) — logged via the annotations above
    // for whoever's watching this run rather than hard-asserted either way.
  });

  test('Bug 3 — "Add body" with no example defaults to Content-Type: text/plain, causing a spurious 415', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const operation = await portal.openOperation('Calls', /^Update Multiple Call Tags/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await operation.openConsole();

    const needsAddBody = await portal.raw.getByRole('button', { name: 'Add body' }).isVisible().catch(() => false);
    test.info().annotations.push({ type: 'schema-blind-state', description: `"Add body" button present: ${needsAddBody}` });

    if (needsAddBody) {
      await operation.addBody();
    }
    await operation.setRequestBody({ calls: [{ callId: CALL_ID_ANALYTICS_SYNTHETIC_DATA, tags: [] }] });
    await operation.selectSubscriptionKey(API_KEY_OPTION);

    await test.step('Send WITHOUT adding a Content-Type header — 415 only reproduces in the schema-blind state', async () => {
      const { status } = await operation.send();
      test.info().annotations.push({ type: 'result', description: `status: ${status}` });
    });
  });

  test('Bug 4 — List Chats 500s on every request (backend auto-injects an invalid SiteId filter field)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const operation = await portal.openOperation('Chats', /^List Chats/);
    await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
    await operation.openConsole();

    await test.step('Send a clean date-range-only body (no site filter added by the caller)', async () => {
      await operation.setRequestBody({
        skip: 0,
        take: 50,
        sort: [{ field: 'StartTime', dir: 'desc' }],
        filter: {
          logic: 'and',
          filters: [
            { field: 'StartTime', operator: 'gte', value: '2020-01-01T00:00:00Z' },
            { field: 'StartTime', operator: 'lte', value: '2026-12-31T23:59:59Z' },
          ],
        },
        terms: [],
      });
    });

    await operation.selectSubscriptionKey(API_KEY_OPTION);

    await test.step('Send and confirm the 500 references an invalid "SiteId" filter field', async () => {
      const { status, body } = await operation.send();
      expect(status).toBe(500);
      expect(JSON.stringify(body)).toContain('SiteId');
    });
  });

  test('Bug 5 — List Client Heartbeats: broken default body, undocumented required shape', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);

    await test.step('Attempt 1: unmodified pre-filled example body — 500, customerId collision', async () => {
      const operation = await portal.openOperation('Heartbeats', /^List Client Heartbeats/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      await operation.selectSubscriptionKey(API_KEY_OPTION);
      const { status, body } = await operation.send();
      expect(status).toBe(500);
      expect(JSON.stringify(body)).toContain("Parameter '@CustomerId' was supplied multiple times");
    });

    await test.step('Attempt 2 (fresh open): empty filter + sort by siteName — 500, invalid column name', async () => {
      const operation = await portal.openOperation('Heartbeats', /^List Client Heartbeats/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      await operation.selectSubscriptionKey(API_KEY_OPTION);
      // Must pass an explicit empty filter (not omit it) — omitting it
      // entirely is Attempt 3's null-reference case below, not this one.
      await operation.setRequestBody({
        skip: 0,
        take: 25,
        sort: [{ field: 'siteName', dir: 'asc' }],
        filter: { logic: 'and', filters: [] },
      });
      const { status, body } = await operation.send();
      expect(status).toBe(500);
      expect(JSON.stringify(body)).toContain("Invalid column name 'siteName'");
    });

    await test.step('Attempt 3 (fresh open): drop sort too — {skip, take} only — 500, null reference', async () => {
      const operation = await portal.openOperation('Heartbeats', /^List Client Heartbeats/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      await operation.selectSubscriptionKey(API_KEY_OPTION);
      await operation.setRequestBody({ skip: 0, take: 50 });
      const { status, body } = await operation.send();
      expect(status).toBe(500);
      expect(JSON.stringify(body)).toContain('Object reference not set to an instance of an object');
    });

    await test.step('Attempt 4 (fresh open): explicit empty filter object — finally 200', async () => {
      const operation = await portal.openOperation('Heartbeats', /^List Client Heartbeats/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await operation.openConsole();
      await operation.selectSubscriptionKey(API_KEY_OPTION);
      await operation.setRequestBody({ skip: 0, take: 50, filter: { logic: 'and', filters: [] } });
      const { status } = await operation.send();
      expect(status).toBe(200);
    });
  });

  test('Bug 6 — /profile is broken (portal-level error page)', async ({ homePage }) => {
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const page = portal.raw;

    await test.step('Click the "Profile" nav link from the loaded portal home', async () => {
      // The link exists in the DOM but renders hidden behind a responsive
      // nav toggle at this viewport size, and even Playwright's `force`
      // click times out on it — since the bug under test is what /profile
      // itself does (not this navigation nuance), click it directly via a
      // raw DOM click instead of hunting for the toggle.
      await page.evaluate(() => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.textContent?.trim() === 'Profile') as HTMLAnchorElement | undefined;
        link?.click();
      });
    });

    await test.step('Confirm the generic portal-level error page', async () => {
      await expect(page.getByText('Oops!')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/uncharted territory/i)).toBeVisible();
    });
  });
});
