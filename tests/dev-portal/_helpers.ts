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
 * other staging specs in this folder). **As of 2026-09-04 this account lands
 * on company Roman_QA_TEST, not CC Test 1** — CC Test 1's data is no longer
 * reachable from it (confirmed live 2026-09-04; see the naming-trap/host
 * fixes the same day). Roman_QA_TEST is now the target tenant everywhere in
 * this file; `TARGET_CUSTOMER_ID` below is its customerId, `KNOWN.*` in this
 * file is CC Test 1's frozen historical data (kept only for the
 * CC-Test-1-only evidence specs, never for generic tests). Subscription key: `DEV_PORTAL_SUBSCRIPTION_KEY`
 * (the default "Primary: 1" 500s regardless of host — this must name a
 * *non-default* key). The exact key name is environment-specific and has
 * changed before (e.g. a prior "Primary: API_test" key was renamed/replaced
 * on staging) — set it in `.env`, don't hardcode it here.
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
/** e.g. `Primary: API_test` — set in `.env`, see the file header. */
export const API_KEY_OPTION = process.env.DEV_PORTAL_SUBSCRIPTION_KEY ?? '';

/**
 * The account's own default, **non**-site-scoped subscription key — used
 * only by `_auth-checks.ts`'s `unscoped-own-key` auth mode (deliberately the
 * *opposite* of `API_KEY_OPTION`: that one must be a site-scoped key, this
 * one must not be). Historically named `Primary: 1`, hardcoded until
 * 2026-09-04; parameterized here for the same drift risk as
 * `API_KEY_OPTION` (subscription-key names have already been renamed on
 * staging once — see this file's header). Unlike `API_KEY_OPTION`, this one
 * keeps a default rather than requiring the env var, since its old name
 * isn't independently confirmed stale — only the *pattern* of hardcoding a
 * key name in code is. Override with `DEV_PORTAL_UNSCOPED_SUBSCRIPTION_KEY`
 * if `Primary: 1` turns out to be wrong too.
 */
export const UNSCOPED_KEY_OPTION = process.env.DEV_PORTAL_UNSCOPED_SUBSCRIPTION_KEY ?? 'Primary: 1';

/**
 * Domain used for disposable test-only email addresses (e.g. `Add User`,
 * `Save Notification Rule` recipients) — defaults to `ADMIN_EMAIL`'s own
 * domain so no separate env var is needed in the common case, but can be
 * overridden with `TEST_EMAIL_DOMAIN` if the login account's domain isn't
 * the right one to send disposable test data to.
 */
export const TEST_EMAIL_DOMAIN = process.env.TEST_EMAIL_DOMAIN ?? ADMIN_EMAIL?.split('@')[1] ?? '';

/** A throwaway `<prefix>+<timestamp>@<TEST_EMAIL_DOMAIN>` address for disposable test records. */
export function disposableEmail(prefix: string): string {
  return `${prefix}+${Date.now()}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Pause after navigating to an operation, before clicking "Try this
 * operation" — gives the console's async OpenAPI-schema fetch a head start
 * so it doesn't lose the render race and fall back to a schema-blind state
 * (no param fields, no body editor). See the bug reports' §3.2/§3.3.
 */
export const SCHEMA_LOAD_PAUSE_MS = 2_000;

export const MISSING_CREDS_REASON =
  'Set `user` / `adminpass` / `DEV_PORTAL_SUBSCRIPTION_KEY` in .env to run the staging Developer Portal checks';
export const missingStagingCreds = !ADMIN_EMAIL || !ADMIN_PASSWORD || !API_KEY_OPTION;

/**
 * **CC Test 1's** customerId — a distinct company from the current target
 * tenant, Roman_QA_TEST (see this file's header). Do NOT use this for any
 * generic create/update body: the backend may validate a body's `customerId`
 * against the authenticated session's own company, in which case a
 * CC-Test-1 value sent under a Roman_QA_TEST session would be rejected as a
 * cross-tenant write. Kept only because the CC-Test-1-only `evidence-*.spec.ts`
 * investigation files still read it directly (frozen historical record —
 * see `_helpers.ts` header). For anything else, use `TARGET_CUSTOMER_ID`.
 */
const CC_TEST_1_CUSTOMER_ID = '98f086b0-8d0e-4ba8-8f01-870466740b1c';

/**
 * Roman_QA_TEST's customerId — the current target tenant (see this file's
 * header). Confirmed, not guessed: the sibling `cloude` recon project's
 * `recon/output/custkey-2026-09-02T15-22-42.json` records company
 * "Roman_QA_TEST" with `uid: "7765ca28-9efe-4bb2-b07d-cede889ca2d3"` — the
 * same field name that, for CC Test 1, matches `CC_TEST_1_CUSTOMER_ID`
 * exactly (`uid: "98f086b0-..."` in that same recon file), so `uid` and the
 * request-body `customerId` are the same value for a company. Independently
 * corroborated by this exact id appearing in the portal's own
 * `developer/users/7765ca28-.../...` management-API calls during the
 * 2026-09-04 live trace that first found the CC Test 1 → Roman_QA_TEST
 * switch. Override with `DEV_PORTAL_CUSTOMER_ID` if this ever needs
 * updating without a code change.
 *
 * Unconfirmed until a live run: whether the backend actually enforces
 * `customerId` against the session (in which case this value matters) or
 * ignores it (in which case any generic create/update would have worked
 * regardless) — either way this is the correct value to send.
 */
export const TARGET_CUSTOMER_ID = process.env.DEV_PORTAL_CUSTOMER_ID ?? '7765ca28-9efe-4bb2-b07d-cede889ca2d3';

/**
 * Known-good **CC Test 1** data on the site its key was scoped to (**UA team
 * recording**) — a frozen historical snapshot, NOT current Roman_QA_TEST
 * data. Read directly only by the CC-Test-1-only `evidence-*.spec.ts`
 * investigation files (see each file's own header) and by
 * `tenant-scoping-bugs.spec.ts`. Every generic test resolves its own
 * site/call/tag live instead (`currentSiteId()`, `firstOwnSiteCall()`,
 * `assignedTagId()` below) — never read this from a new/generic test.
 */
export const KNOWN = {
  callId: 'd71ac345-86a0-f111-9b33-6045bded66d5',
  siteId: '8cc22cd2-a4b7-46c5-b907-9050e110dac5',
  /** A tag already assigned to `callId` — re-applying it is a no-op. */
  tagId: '77A27B7E-817D-4474-8106-05762B889099',
  customerId: CC_TEST_1_CUSTOMER_ID,
  /** Disposable agent group created 2026-08-27 on CC Test 1 (see the full report §4.5) — does not exist on Roman_QA_TEST. */
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
  customerId: TARGET_CUSTOMER_ID, ...extra,
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
 *  - `key` defaults to the site-scoped `API_KEY_OPTION` (configured via env);
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
 * site ("UA team recording") and go stale the moment the configured
 * `API_KEY_OPTION` key is re-scoped to another site — which the tenant-isolation suites and
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
    const op = await openConsole(portal, 'Reports', /^List Sites Storage Usage/, { retries: 2 });
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
  const op = await openConsole(portal, 'Calls', /^Preview Call Info/, { retries: 2 });
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

/* ────────────────────────────────────────────────────────────────────────────
 * Prerequisite finders ("require*") — 2026-09-04.
 *
 * A generic test that reads a pre-existing object it has no way to create
 * itself (no matching Create/Add op, or the object needs cross-group state
 * only obtainable by chance — e.g. "an agent with no assigned extension")
 * must not hard-`expect(...).toBeTruthy()` on finding one: on a tenant with
 * none of that seed data (Roman_QA_TEST is currently unconfirmed for most of
 * these), that reads as a product regression instead of what it actually is
 * — missing test data. Every finder here returns the object or `undefined`;
 * the CALLING spec still does the actual
 * `test.skip(!thing, noSeedDataReason('...'))` (kept in the spec, not here,
 * matching this file's existing style — e.g. `currentKeySite()` above never
 * calls `test.skip` either). Centralized here purely to stop the same
 * List-and-find logic being copy-pasted per spec file.
 *
 * **`undefined` means "empty result", never "request failed"** — a non-200
 * from the underlying List/Preview call THROWS instead (matches
 * `firstOwnSiteCall()` above), so a real backend error surfaces as a loud
 * test failure, not a silent "no seed data" skip. Getting this backwards
 * would hide a genuine regression behind a misleading skip reason — the
 * exact failure mode `noSeedDataReason()` exists to avoid in the other
 * direction.
 *
 * For each: the "self-seedable?" note records whether a future rewrite could
 * create the prerequisite instead of depending on it (see the 2026-09-04
 * session's own notes for the ones already converted: `Update Agent Group`,
 * 3 of `firstAgent()`'s former call sites).
 */

/** Builds the standard skip reason for a missing generic prerequisite. */
export function noSeedDataReason(what: string): string {
  return `Roman_QA_TEST has no required seeded data — ${what}`;
}

/**
 * First agent on the account (`List Agents`), or `undefined` if none exist.
 * Self-seedable: YES — Agent Management has `Create Agent`; a caller that
 * only needs *a* valid agent (not a specific pre-existing one) should create
 * its own instead of calling this (see `currentSiteId()` for the even
 * narrower case of just needing a valid siteId, no agent required at all).
 */
export async function requireAgent(portal: DeveloperPortalPage): Promise<{ id: string; siteId: string } | undefined> {
  const op = await openConsole(portal, 'Agent Management', /^List Agents/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireAgent: List Agents returned ${status}`);
  return (body as Array<{ id: string; siteId: string }>)[0];
}

/**
 * First agent with no extension currently assigned (`List Agents`, filtered
 * client-side), or `undefined`. Self-seedable: only partially — a freshly
 * `Create Agent`-d agent starts unassigned, so a rewrite COULD self-seed
 * this half; the harder half is `requireUnassignedExtension` below (no
 * per-extension "unassign" op exists in the catalogue at all, so a self-
 * seeded extension may already come pre-assigned depending on backend
 * defaults — unconfirmed).
 */
export async function requireUnassignedAgent(portal: DeveloperPortalPage): Promise<{ id: string } | undefined> {
  const op = await openConsole(portal, 'Agent Management', /^List Agents/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireUnassignedAgent: List Agents returned ${status}`);
  return (body as Array<{ id: string; assignedExtension: boolean | null }>).find(a => !a.assignedExtension);
}

/** The all-zero GUID the backend uses to mean "no object assigned" (e.g. an extension's `agentId` when unassigned). */
export const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * First extension with no agent assigned (`agentId` is the all-zero GUID),
 * or `undefined`. Self-seedable: unconfirmed — `Create Extension` doesn't
 * document what `agentId` a fresh extension starts with; would need a live
 * check before relying on it.
 */
export async function requireUnassignedExtension(portal: DeveloperPortalPage): Promise<{ id: string } | undefined> {
  const op = await openConsole(portal, 'Extension Management', /^List Extensions/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireUnassignedExtension: List Extensions returned ${status}`);
  return (body as Array<{ id: string; agentId: string }>).find(e => e.agentId === ZERO_GUID);
}

/**
 * First extension on the account (`List Extensions`), or `undefined`. For
 * callers that just need *any* real extension name/id to build a request
 * with (e.g. a filter-value probe) — not the unassigned-specific variant
 * above. Self-seedable: YES — Extension Management has `Create Extension`;
 * a caller that can tolerate creating (and cleaning up) a disposable
 * extension should do that instead of depending on this.
 */
export async function requireExtensionSample(portal: DeveloperPortalPage): Promise<{ id: string; name: string } | undefined> {
  const op = await openConsole(portal, 'Extension Management', /^List Extensions/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireExtensionSample: List Extensions returned ${status}`);
  return (body as Array<{ id: string; name: string }>)[0];
}

/**
 * First non-archived QA form available for a call (`List Available QAs`),
 * or `undefined`. Self-seedable: NO, not through this API — form
 * availability for a call is determined by product-side assignment/rotation
 * rules, not something `Save completed QAs` or any other dev-portal op can
 * create; and `Save completed QAs` is itself a confirmed KNOWN BUG (201 but
 * never persists), so it couldn't seed one even if the shape allowed it.
 */
export async function requireQaForm(portal: DeveloperPortalPage, callId: string): Promise<{ id: number } | undefined> {
  const op = await openConsole(portal, 'QA', /^List Available QAs/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  await op.addParameter('callId', callId);
  const { status, body } = await op.send();
  if (status !== 200) throw new Error(`requireQaForm: List Available QAs returned ${status}`);
  return (body as Array<{ id: number; archived: boolean }>).find(f => !f.archived);
}

/**
 * First restricted-user record (`List Restricted Accesses`), or `undefined`.
 * Self-seedable: NO — this catalogue group has no Create/Add operation at
 * all (confirmed against `apim-schema.json`: List / Preview / Update only),
 * so a restricted-user record can only come from outside this API (main
 * app, admin tooling).
 */
export async function requireRestrictedUser(portal: DeveloperPortalPage): Promise<Record<string, unknown> | undefined> {
  const op = await openConsole(portal, 'Restricted User Management', /^List Restricted Accesses/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireRestrictedUser: List Restricted Accesses returned ${status}`);
  const records = (body as { data?: unknown[] }).data ?? (body as unknown[]);
  return Array.isArray(records) ? (records as Record<string, unknown>[])[0] : undefined;
}

/**
 * Highest-id template whose name matches one of the known disposable-test
 * naming conventions (`Test_Post`, `stephan`, `temp*`, `ttemp*`,
 * `savetemptest*`), or `undefined`. Self-seedable: NO — Reports has no
 * Create Report Template operation. **Known limitation**: this is a naming
 * heuristic observed on CC Test 1's accumulated junk data, not a real
 * "is this disposable" flag from the API — if Roman_QA_TEST has templates
 * under different naming conventions, this will report "no seed data" even
 * though disposable-looking templates may actually exist. No structural fix
 * available without an API field to distinguish disposable templates.
 */
export async function requireDisposableReportTemplate(portal: DeveloperPortalPage): Promise<{ id: number; name: string } | undefined> {
  const op = await openConsole(portal, 'Reports', /^List Report Templates/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await op.send();
  if (status !== 200) throw new Error(`requireDisposableReportTemplate: List Report Templates returned ${status}`);
  return (body as Array<{ id: number; name: string }>)
    .filter(t => /^(Test_Post|stephan|temp\d*|ttemp\d*|savetemptest\d*)$/i.test(t.name))
    .sort((a, b) => b.id - a.id)[0];
}

/**
 * Whether the account has ≥2 distinct sites for the cross-tenant/cross-site
 * isolation family (`tenant-isolation-*.spec.ts`, `cross-tenant-*.ts`) to
 * switch a subscription key between. Reads `List Sites` (Site Management —
 * intentionally account-wide, per `site-management-api.spec.ts`'s own
 * `findSiteById()` comment), takes the first 100 rows (enough to prove ≥2
 * exist; no need to enumerate the whole account). Returns the sites found
 * when there are ≥2, `undefined` for a genuine 200-with-fewer-than-2 result
 * — a single-site (or zero-site) Roman_QA_TEST is a real possible state,
 * not an error, same as every other `require*` helper's "empty means
 * empty" rule. A non-200 THROWS instead — never silently read as "not
 * enough sites."
 *
 * **Not independently confirmed**: whether this API's site set exactly
 * matches what `ApiManagementSettingsPage`'s site-switch dropdown offers
 * (a separate, UI-scraped listbox in Settings > API Management, not this
 * API) — inferred only from both being described elsewhere as the
 * account's full site list, not a narrower per-key subset. If a live run
 * ever shows the dropdown offering fewer options than this reports, that
 * assumption needs revisiting.
 */
export async function requireSecondSite(portal: DeveloperPortalPage): Promise<{ sites: Array<{ id: string; name: string }> } | undefined> {
  const op = await openConsole(portal, 'Site Management', /^List Sites/, { retries: 2 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  const { status, body } = await sendJson(op, portal.raw, LIST_BODY_100);
  if (status !== 200) throw new Error(`requireSecondSite: List Sites returned ${status}`);
  const raw = (Array.isArray(body) ? body : []) as Array<{ id?: string; Id?: string; name?: string; Name?: string }>;
  const sites = raw
    .map(s => ({ id: String(s.id ?? s.Id ?? ''), name: String(s.name ?? s.Name ?? '') }))
    .filter(s => s.id);
  return sites.length >= 2 ? { sites } : undefined;
}
