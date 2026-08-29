import { type Page } from '@playwright/test';
import type { ApiOperationPage } from '../../pages/dev-portal/ApiOperationPage';
import type { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { LoginPage } from '../../pages/login/LoginPage';

/**
 * Shared setup for the staging Developer Portal / API Management specs.
 *
 * Every `tests/dev-portal/*-api.spec.ts` file drives the **staging** Azure
 * APIM "Try this operation" console — reached from
 * `atmossystemsstaging.callcabinet.com` (two "s"es, "systems staging") →
 * `developer1-portal.callcabinet.com`. `.env`'s `BASE_URL` now points here
 * too (fixed 2026-08-29 — it previously held the one-"s" production
 * gateway host, where every operation blanket-500s regardless of request
 * shape, which the pre-2026-08-29 versions of these files documented and
 * worked around with their own hardcoded copy of this URL). `STAGING_APP_URL`
 * below is the single source for that host now — every spec in this folder
 * imports it from here rather than redeclaring the literal.
 *
 * Account: `user` / `adminpass` (non-standard env var names, matches the
 * other staging specs in this folder — lands directly on company CC Test 1,
 * no company switch needed). Subscription key: "Primary: API_test" (the
 * default "Primary: 1" 500s regardless of host).
 *
 * Background: docs/bug-reports/dev-portal-api-management-full-report-2026-08-27.md
 * (two-hosts trap, per-site key scoping, console flakiness) and
 * docs/bug-reports/dev-portal-happy-path-coverage-2026-08-28.md
 * (per-operation happy-path findings + confirmed bugs).
 *
 * Run single-worker — the `user`/`adminpass` account tolerates only one
 * active session (`npm run test:dev-portal` sets `--workers=1`).
 */
export const STAGING_APP_URL = `${process.env.BASE_URL}/`;
export const ADMIN_EMAIL = process.env.user;
export const ADMIN_PASSWORD = process.env.adminpass;
export const API_KEY_OPTION = 'Primary: API_test';

/**
 * Pause after navigating to an operation, before clicking "Try this
 * operation" — gives the console's async OpenAPI-schema fetch a head start
 * so it doesn't lose the render race and fall back to a schema-blind state
 * (no param fields, no body editor). See the bug reports' §3.2/§3.3.
 */
export const SCHEMA_LOAD_PAUSE_MS = 2_000;

export const MISSING_CREDS_REASON =
  'Set `user` / `adminpass` in .env to run the staging Developer Portal checks';
export const missingStagingCreds = !ADMIN_EMAIL || !ADMIN_PASSWORD;

/**
 * Known-good CC Test 1 data on the site the "Primary: API_test" key is
 * currently scoped to (**UA team recording**). Tests that need a real
 * call/site/tag to act on read from here. If the key's site assignment is
 * changed, or these shared-QA-account records are deleted, refresh them
 * from a `List*` response.
 */
export const KNOWN = {
  callId: 'd71ac345-86a0-f111-9b33-6045bded66d5',
  siteId: '8cc22cd2-a4b7-46c5-b907-9050e110dac5',
  /** A tag already assigned to `callId` — re-applying it is a no-op. */
  tagId: '77A27B7E-817D-4474-8106-05762B889099',
  customerId: '98f086b0-8d0e-4ba8-8f01-870466740b1c',
  partnerId: 'a7843c69-aec0-4c36-9019-f193d5c90694',
  /** Disposable agent group created 2026-08-27 (see the full report §4.5). */
  disposableAgentGroupId: 1004,
} as const;

export const LIST_BODY = { skip: 0, take: 25, sort: [], filter: { logic: 'and', filters: [] } };
export const LIST_BODY_100 = { skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [] } };

/* ────────────────────────────────────────────────────────────────────────────
 * Confirmed create-operation DTOs — the exact shapes live-verified 2026-08-29
 * in the consolidated `*-api.spec.ts`. Shared here so the cross-tenant matrix
 * and the negative-required-fields matrix build the *same* valid body (one
 * source of truth), not two hand-copied variants that can drift.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Full Agent DTO — ADO 37293/37298 (agent-management-api.spec.ts `agentDto`). */
export const agentDto = (
  firstName: string, lastName: string, siteId: string, extra: Record<string, unknown> = {},
) => ({
  firstName, lastName, email: null, siteId, site: '',
  enableScreenshots: false, enableCompliance: false, emailOnQcComplete: false,
  screenshotInterval: null, windowsUsername: '', supervisor: null, specialEmail: null,
  mEmail: null, assignedSupervisor: null, assignedExtension: false,
  groups: [] as string[], groupsDisplayName: '', extensions: [] as string[],
  extensionsDisplayName: null, extensionsJson: null, groupsJson: null, notes: '',
  customerId: KNOWN.customerId, ...extra,
});

/** Notification-rule DTO — notifications-api.spec.ts `baseRule`. */
export const ruleDto = (name: string, siteIds: string[], id?: string) => ({
  ...(id ? { id } : {}), name,
  triggerType: 0, actionType: 1, webhook: '', emailsToSend: 'aqa-matrix@example.com',
  triggeredByParticipant: 0, keyWord: 'testing', siteId: null, applicationName: null,
  applicationScorePath: '', applicationScoreOperator: null, applicationScoreValue: 0,
  tagIds: [] as string[], siteIds, groupIds: [] as string[],
});

/** Alert-config DTO — notifications-api.spec.ts `alertBody`. */
export const alertDto = (name: string, id: number | null) => ({
  id, name, notificationTypeId: 7, windowType: 'interaction', windowValue: 1,
  triggers: [{ notificationLevel: 'warning', shouldNotify: true, triggerOperatorId: 13, triggerValue: ['test'], triggerThreshold: 50, anomalyDetection: false }],
  filters: [], notificationCooldown: 0.5, emailAddresses: [], webhooks: [], tags: [],
});

/** Logs in to the staging app shell and waits for Home. */
export async function stagingLogin(page: Page, loginPage: LoginPage): Promise<void> {
  await page.goto(STAGING_APP_URL);
  await loginPage.login(ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.waitForURL('**/Home', { timeout: 20_000 });
}

/**
 * Closes every tab except the primary `page` — the Development portal opens
 * in a new tab per test and accumulating them across a run was observed to
 * eventually crash the browser process ("Target page, context or browser
 * has been closed").
 */
export async function closeExtraTabs(page: Page): Promise<void> {
  for (const p of page.context().pages()) {
    if (p !== page) await p.close().catch(() => {});
  }
}

/**
 * Sends `body` as JSON on a freshly-opened console, working around the
 * "schema-blind" console race (bug reports §3.2/§3.3): when the console's
 * async schema fetch loses the render race, no request-body editor or
 * `Content-Type` is pre-filled, so `setRequestBody()` has nothing to
 * target. Detects that state (body field not visible) and manually adds a
 * body + `Content-Type: application/json` header first.
 */
export async function sendJson(
  op: ApiOperationPage,
  page: Page,
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
 * Opens an operation and its "Try this operation" console, retrying the
 * whole navigate → click "Try this operation" → wait-for-Send sequence
 * (re-opening the operation fresh each attempt) up to `retries` times.
 *
 * Targets the documented console schema/render race, where "Try this
 * operation" can be briefly unresponsive or the Send button never renders —
 * a fresh re-open clears it. **Does NOT retry the actual request**: only
 * console setup is retried, so a genuine API failure still surfaces on the
 * first `send()` and isn't masked. `retries` defaults to 1 (no retry).
 */
export async function openConsole(
  portal: DeveloperPortalPage,
  group: string,
  operation: RegExp,
  { retries = 1 }: { retries?: number } = {},
): Promise<ApiOperationPage> {
  // With retries, bound each Send-button wait shorter so N attempts (each
  // also paying a full re-navigation) fit inside one test's time budget.
  const perAttemptTimeout = retries > 1 ? 10_000 : 15_000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const op = await portal.openOperation(group, operation);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole(perAttemptTimeout);
      return op;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Open one operation's console, select a subscription key, optionally add
 * headers + params, then send — the request primitive every dev-portal matrix
 * needs. Consolidates the seven near-identical local `fire()` / `fireJson()` /
 * `fireGet()` / `invoke()` copies that had accreted across `_negative-fields`,
 * `_cross-tenant`, `cross-tenant-plans`, `_contract-checks`, `_auth-checks`,
 * `_idempotency-checks` and `contract-checks-catalog`.
 *
 * Behaviour matches those copies exactly:
 *  - `key` defaults to the site-scoped `API_KEY_OPTION` (`Primary: API_test`);
 *  - `retries` defaults to 3 (all copies used 3);
 *  - `body === undefined` → plain `send()` (the old `fireGet`); a defined body
 *    → `sendJson()` with its schema-blind `addBody()` + `Content-Type` fallback
 *    (the old `fireJson`). `_auth-checks` had this fallback hand-inlined
 *    byte-for-byte — it now goes through `sendJson` like everyone else.
 *
 * The ONE point of variance that made the copies look different — the auth
 * matrix selecting a degraded key and injecting a junk
 * `Ocp-Apim-Subscription-Key` header — is expressed here as the `key` and
 * `headers` parameters (headers are added right after the key is selected and
 * before params, preserving the auth copy's ordering).
 */
export async function fireConsole(
  portal: DeveloperPortalPage,
  group: string,
  operation: RegExp,
  opts: {
    body?: unknown;
    params?: Array<[string, string]>;
    /** subscription-key dropdown option (default: `API_KEY_OPTION`). */
    key?: string;
    /** request headers added after the key is selected, before params. */
    headers?: Array<[string, string]>;
    /** console-open retry budget (default 3). */
    retries?: number;
  } = {},
): Promise<{ status: number; body: unknown }> {
  const op = await openConsole(portal, group, operation, { retries: opts.retries ?? 3 });
  await op.selectSubscriptionKey(opts.key ?? API_KEY_OPTION);
  for (const [n, v] of opts.headers ?? []) await op.addHeader(n, v);
  for (const [n, v] of opts.params ?? []) await op.addParameter(n, v);
  return opts.body === undefined ? op.send() : sendJson(op, portal.raw, opts.body);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Live per-run resolution of site-bound inputs.
 *
 * `KNOWN.siteId` / `KNOWN.callId` / `KNOWN.tagId` above are a snapshot of one
 * site ("UA team recording") and go stale the moment the "Primary: API_test"
 * key is re-scoped to another site — which the tenant-isolation suites and
 * `evidence-security.spec.ts` do deliberately, and don't always restore if a
 * run is interrupted. A spec that then hardcodes `KNOWN.siteId` acts on a site
 * the key no longer sees and reports test-data noise as product bugs (Create
 * succeeds but the record is invisible / Update 400s).
 *
 * Prefer these resolvers: they read whatever site the key is *currently*
 * scoped to, so a spec stays internally consistent regardless of a leftover
 * switch. See artifacts/dev-portal-evidence-2026-08-29/06-environment/
 * ENV-site-assignment-audit.md §3 for the full audit of which files needed it.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The key's CURRENT site, read live via `Get Sites Storage Usage` (returns
 * exactly one row, scoped to the calling key's own site). Returns `{id:null,
 * name:null}` if the call doesn't come back 200-with-a-row so callers can
 * decide whether to skip or fail.
 */
export async function currentKeySite(
  portal: DeveloperPortalPage,
): Promise<{ id: string | null; name: string | null }> {
  try {
    const op = await openConsole(portal, 'Reports', /^Get Sites Storage Usage/, { retries: 2 });
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const { status, body } = await op.send();
    if (status !== 200 || !Array.isArray(body) || body.length === 0) return { id: null, name: null };
    const row = body[0] as Record<string, unknown>;
    return {
      id: (row.siteId ?? row.siteID ?? row.id ?? null) as string | null,
      name: (row.siteName ?? row.name ?? null) as string | null,
    };
  } catch {
    return { id: null, name: null };
  }
}

/** The key's current site id, or throws — use where a missing site should fail the test, not skip it. */
export async function currentSiteId(portal: DeveloperPortalPage): Promise<string> {
  const { id } = await currentKeySite(portal);
  if (!id) {
    throw new Error(
      'currentSiteId: could not read the key\'s current site (Get Sites Storage Usage returned no siteId). ' +
      'The key may be mid-switch or de-scoped — check Settings > API Management.',
    );
  }
  return id;
}

/**
 * A real call id on the key's CURRENT site (`List Calls` → first row). Pass
 * `{ withTags: true }` to prefer a call that already has tags assigned (for
 * no-op-safe `Update Call Tags` checks). Throws if the current site has no
 * calls at all.
 */
export async function firstOwnSiteCall(
  portal: DeveloperPortalPage,
  { withTags = false }: { withTags?: boolean } = {},
): Promise<{ id: string; hasTags: boolean }> {
  const op = await openConsole(portal, 'Calls', /^List Calls/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY);
  if (status !== 200) throw new Error(`firstOwnSiteCall: List Calls returned ${status}`);
  const rows = body as Array<{ Id: string; HasTags?: boolean }>;
  if (!rows.length) throw new Error('firstOwnSiteCall: List Calls returned no rows for the current site');
  const pick = withTags ? rows.find(r => r.HasTags) ?? rows[0] : rows[0];
  return { id: pick.Id, hasTags: !!pick.HasTags };
}

/** Convenience: just the id from {@link firstOwnSiteCall}. */
export async function firstOwnSiteCallId(portal: DeveloperPortalPage): Promise<string> {
  return (await firstOwnSiteCall(portal)).id;
}

/**
 * The first `tagId` in a call's own `assignedTags` (a JSON *string* on
 * `Get Call Info`'s `model`), or `null` if the call has none / the read
 * fails. Re-applying this tag via `Update Call Tags` is a genuine no-op.
 */
export async function assignedTagId(portal: DeveloperPortalPage, callId: string): Promise<string | null> {
  const op = await openConsole(portal, 'Calls', /^Get Call Info/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  await op.addParameter('callId', callId);
  const { status, body } = await op.send();
  if (status !== 200) return null;
  const raw = (body as { model?: { assignedTags?: unknown } })?.model?.assignedTags;
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const tags = JSON.parse(raw) as Array<{ tagId?: string }>;
    return tags[0]?.tagId ?? null;
  } catch {
    return null;
  }
}
