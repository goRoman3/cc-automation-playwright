# Roman_QA_TEST migration — handoff summary and live smoke-test plan

**Status as of 2026-09-04: fully static.** Everything below was prepared with `tsc --noEmit`,
`schema.json` cross-checks, pure-logic unit tests, and `grep`/diff review only — **zero
browser/e2e/network/account-session runs**. Nothing in this file has been executed live.

## Why this exists

The account this suite logs in as (`user`/`adminpass`) now lands on company **Roman_QA_TEST**,
not **CC Test 1** — confirmed via UID cross-reference against the sibling `cloude` recon project
(customerId `7765ca28-9efe-4bb2-b07d-cede889ca2d3`, vs. CC Test 1's `98f086b0-...`). CC Test 1's
data (`KNOWN.*` in `_helpers.ts`) is not reachable from this account any more. This suite was
built and live-verified entirely against CC Test 1 (2026-08-25 through 2026-08-29) — this
migration prepares it to run against Roman_QA_TEST instead, **without knowing yet what data
Roman_QA_TEST actually has**.

## Commit/handoff summary, by category

### 1. Operation-naming fixes (catalogue drift, unrelated to the tenant switch)
The APIM catalogue renamed several operations since the 2026-08-27 fix that only covered
Agent/Extension/Custom Role/Agent Group: `Add Site→Create Site`, `Add Tag→Create Tag`,
`Add User→Create User`, `Add Notification Rule→Create Notification Rule`, every `Get X→Preview X`
(single-record) / `List X` (collection), `Edit Call Note Details→Update Call Note Details`,
`IP Whitelist List→List IP Whitelist`, `Generate QA PDF/Excel→Export QA PDF/Excel`. Confirmed via
`tests/dev-portal/apim-schema.json` (a trimmed copy of the sibling `cloude` recon project's fresh
2026-09-04 catalogue capture) and a repeatable schema↔matcher static cross-check (see below) — not
a single live-observed rename, a documented catalogue diff.

### 2. Gateway-host fix (`pages/dev-portal/ApiOperationPage.ts`)
New exported `isGatewayResponseUrl()`, used by `send()`'s `waitForResponse` matcher. Widened from
`developer1?\.callcabinet\.com` to also accept `smarshcra-apim-staging(-eus2)?\.azure-api\.net` —
two *exact* hosts, evidenced by (a) a live response trace against Roman_QA_TEST and (b) CC Test
1's own `www-authenticate` header from a 2026-08-21 diagnostic (in the sibling `cloude` project),
which already named that same underlying APIM identity. Deliberately excludes the portal's own
`*.developer.azure-api.net` CMS traffic and any unconfirmed `-<suffix>` variant. Static regression:
`tests/dev-portal/gateway-host-matcher.spec.ts` (9 cases, no browser/network).

### 3. Roman_QA_TEST customerId migration
New `TARGET_CUSTOMER_ID` in `_helpers.ts`, value `7765ca28-9efe-4bb2-b07d-cede889ca2d3` — Roman_QA_TEST's
customerId per the same recon cross-reference as above, overridable via `DEV_PORTAL_CUSTOMER_ID`.
Every generic create/update body that used to send `KNOWN.customerId` (CC Test 1's) now sends this
instead: `agentDto()` (shared + the local duplicate that used to live in
`agent-management-api.spec.ts`), `contract-checks-catalog.ts`, `idempotency-checks-catalog.ts`,
`negative-fields-catalog.ts`, `role-management-api.spec.ts`, `cross-tenant-plans.ts` (5 sites),
`group-management-api.spec.ts`. **Not independently confirmed the backend actually validates
`customerId` against the session** — see smoke-test #2 below.

### 4. Self-seeding conversions (no longer depend on pre-existing data)
- `agent-management-api.spec.ts`: `List Agent Extensions`, `Preview Agent` — now create their own
  disposable agent (reusing the file's own proven Create/Delete lifecycle) instead of borrowing one.
- `group-management-api.spec.ts`: `Update Agent Group` — rewritten to create its own disposable
  group (list-by-name workaround for the `id:0` response bug) instead of depending on a specific
  pre-existing group id (`1004`, CC-Test-1-only, now removed from `KNOWN.*`).

### 5. Seed-dependent guards (skip cleanly, never fail, on missing prerequisites)
8 new `require*` helpers in `_helpers.ts` (`requireAgent`, `requireUnassignedAgent`,
`requireUnassignedExtension`, `requireExtensionSample`, `requireQaForm`, `requireRestrictedUser`,
`requireDisposableReportTemplate`, `requireSecondSite`), each following one strict rule audited
this session and reconfirmed clean: **a non-200 from the underlying List/Preview call THROWS
(a real bug); `undefined` means only a genuinely empty 200 response (no seed data) — never both
collapsed into the same skip.** Wired into `agent-management-api.spec.ts`,
`group-management-api.spec.ts`, `extension-management-api.spec.ts`, `qa-api.spec.ts`,
`restricted-user-management-api.spec.ts`, `reports-api.spec.ts`,
`tenant-isolation-negative-writes-staging.spec.ts`, `tenant-isolation-staging.spec.ts`,
`cross-tenant-matrix.spec.ts`. Every skip reason names the exact check that came back empty (e.g.
`"List Agents returned zero agents to seed a group with."`), never a blanket "Roman_QA_TEST is
empty" claim — audited this session, all 12 reason strings confirmed precise.

**`requireSecondSite()`'s own documented, live-unconfirmed assumption** (repeating it here since it's
load-bearing for the whole cross-site family): it reads `List Sites` (Site Management API) and
assumes that set matches what `ApiManagementSettingsPage`'s site-switch dropdown (Settings > API
Management > edit key > site combobox — a *different*, UI-scraped control) actually offers. Both
are documented elsewhere as "the account's full site list," not a narrower per-key subset, but this
has never been cross-checked live. If a live run ever shows the dropdown offering fewer/different
sites than `List Sites` reports, this assumption needs revisiting before trusting the guard further.

### 6. Cleanup hardening
Fixed missing `try/finally` (mid-test assertion failure would previously leak the created object
permanently) in: `Batch Delete Agents`, `Create Agent Group → Get → Delete` lifecycle,
`Create Agent Extension Mapping` round trip (restores the *borrowed* extension to unassigned even
on failure), and the two newly-self-seeded agent tests. One remaining structural limit, not a bug:
if `Create Agent Group`'s id-readback `List Agent Groups` call itself fails to find the
just-created group by name, there is no id to clean up with at all (the `id:0` response KNOWN BUG
is *why* a list-by-name readback is needed in the first place — if that also fails, cleanup is
impossible from within the test).

**Noted, NOT fixed this session** (pre-existing, same risk class, broader scope): the create-then-
delete lifecycle tests in `extension-management-api.spec.ts`, `site-management-api.spec.ts`,
`tag-management-api.spec.ts`, `ip-whitelist-api.spec.ts`, `user-management-api.spec.ts`,
`notifications-api.spec.ts` (both objects), `role-management-api.spec.ts` also have no
`try/finally` — a mid-lifecycle failure in any of them leaks the created disposable object the same
way the fixed ones used to. Left alone as a separate, larger cleanup-hardening effort, not required
to unblock the Roman_QA_TEST migration itself.

### 7. Deferred / explicitly not done
- No architectural rewrite of the cross-tenant/cross-site family — only early `requireSecondSite()`
  guards added ahead of the existing switch logic, per explicit instruction.
- `requireUnassignedExtension` NOT converted to self-seeding — no evidence a freshly-created
  extension's `agentId` actually starts at the all-zero GUID.
- `requireQaForm`, `requireRestrictedUser`, `requireDisposableReportTemplate` intentionally remain
  pure seed-dependent guards — none of the underlying objects are creatable through this API.
- No new negative probes added from `schema.required` alone anywhere this session.
- Historical `evidence-*.spec.ts` and `tenant-scoping-bugs.spec.ts` — untouched, still read
  `KNOWN.*` (CC Test 1's frozen data) directly, by design.

---

## Live smoke-test plan (prepared only — NOT run)

Run **in this order**, stopping to diagnose at the first blocker rather than proceeding — each
step's own scope is deliberately narrow so a failure points at one thing.

### 1. Gateway/send — does a response even come back?
**Action**: open any single read-only operation (e.g. Site Management → `List Sites`) through the
console, click Send, let `send()` resolve.
**Expected**: `send()` returns *some* status within its 30s window — even a 500 is fine here, the
only thing under test is whether `isGatewayResponseUrl()` recognizes the real response URL.
**Blocker**: a 30s timeout on `waitForResponse` → the current session's actual gateway host isn't
one of the two hosts `isGatewayResponseUrl()` accepts. Capture a fresh trace before touching
anything else — do not guess a third host into the matcher.

### 2. `TARGET_CUSTOMER_ID` write — does the backend accept it?
**Action**: run one generic create that sends it (e.g. `agent-management-api.spec.ts`'s
`Create Agent → Delete Agent` test, or `group-management-api.spec.ts`'s lifecycle test).
**Expected**: 200, the created object is real (appears in the matching List).
**Blocker**: a 400/403 shaped like a cross-tenant/customer-mismatch rejection → `TARGET_CUSTOMER_ID`'s
value is wrong for *this* session's actual identity (either the session drifted to a third
company, or the recon-derived value was wrong) — re-derive it from a fresh capture, don't retry
with a guess.

### 3. One self-seeded Agent lifecycle
**Action**: `agent-management-api.spec.ts`'s `Create Agent → Delete Agent` test, alone.
**Expected**: full pass — Create 200, agent visible in `List Agents`, Delete succeeds, agent gone
afterward.
**Blocker vs. known regression**: distinguish a `TARGET_CUSTOMER_ID`/site-resolution failure (step
2's territory) from the *already-documented* `Update Agent` 400 bug class (different operation,
not exercised by this specific test) before concluding anything is newly broken.

### 4. `requireSecondSite()`
**Action**: run `tenant-isolation-staging.spec.ts`'s `Switch` test via
`TENANT_PHASE=switch npm run test:tenant-switch`.
**Expected**: either the guard finds ≥2 sites and the test proceeds to the actual switch, or it
skips cleanly with the exact `noSeedDataReason(...)` text — never a crash either way.
**Blocker**: a thrown exception (means `List Sites` itself returned non-200 — a real bug, not a
site-count question). **Also record**: if the guard finds ≥2 sites, does the *actual* switch
dropdown later offer the same count? This is the one live-unconfirmed assumption from section 5
above — settle it here.

### 5. A seed-dependent guard
**Action**: `restricted-user-management-api.spec.ts`, all 3 tests.
**Expected**: baseline `List` test passes; the other two either run for real (Roman_QA_TEST has
restricted-user data) or skip cleanly with the exact reason text.
**Blocker**: any of the 3 *fails* (not skips) with an assertion error — either the baseline 200
check itself is broken (real API regression) or the skip-guard's falsy-check has a defect letting
something through it shouldn't.

### 6. Negative probes
**Action**: `negative-required-fields-matrix.spec.ts` (the whole matrix, or at minimum the 3 specs
touched this session: `agent-mgmt/create-agent`, `notifications/upsert-alert-configuration`,
`role-mgmt/create-custom-role`).
**Expected**: CONTROL rows `OK`; every field-omission probe reports a verdict — this is the first
live data point for the `hypothesis-400` fields added this session (`groups`, `extensions`, `id`,
`emailAddresses`, `triggers`, `notificationTypeId`) and the `not-enforced` `access` field.
**Blocker**: any `CONTROL-FAIL` row → `TARGET_CUSTOMER_ID` or another resolved value is wrong, not
a genuine field-validation finding — don't reclassify a field's expectation off a run where the
control itself never even succeeded. A `LEAK`/`REGRESSION` row is a real product finding to
triage, not a suite defect.

### 7. Full suite
**Action**: `npm run test:dev-portal` (single-worker, per the account's one-session constraint).
**Expected**: the majority of tests pass or skip cleanly with a `noSeedDataReason(...)` message;
a bounded, already-documented set of KNOWN BUG regression tests still fail in their expected way.
**Blocker**: any failure carrying seed-data-shaped symptoms (empty list, missing record) that did
**not** go through a `test.skip` — means a guard that looked complete in this static pass actually
isn't triggering live. Fix that guard specifically; don't reach for a suite-wide change.

---

## Live smoke-test checkpoint (2026-09-04) — Step 1 run, blocked past it

Step 1 ("Gateway/send — does a response even come back?") was run live: `List Sites — 200 baseline`
via `npx playwright test`, plus a temporary diagnostic (written, run, deleted — nothing committed) to
capture the raw network response, since the assertion alone doesn't surface response bodies. Logged in
as `romana@callcabinet.com`, confirmed on **Roman_QA_TEST** in the company selector.

**Gateway host matcher — LIVE CONFIRMED.** `send()` resolved in ~15–18s (no 30s timeout) against
`https://smarshcra-apim-staging-eus2.azure-api.net/...`, one of `isGatewayResponseUrl()`'s two accepted
hosts. Step 1's own narrow success criterion — a response comes back at all, even a 500 — is met.

**Staging backend — BLOCKED / 500, not isolated to one endpoint.** Three calls, all a generic
`{"statusCode":500,"message":"Internal server error","activityId":"..."}` (a distinct `activityId`
each time, so not one cached failure repeating):
- `List Sites` → `activityId 06e6f20d-c2da-4744-b85a-01c39a0fa6ad`
- `List Sites` rerun → `activityId 5ea24a26-e033-483f-ab58-d12c7ec3d777`
- `List Agents` (a different catalogue group/route, `/api/settings/agents/list/`) → `activityId
  6a55b88e-d26d-43ff-8612-6f91c4a5e0c9`

Neither request body includes `customerId`, so this is not a `TARGET_CUSTOMER_ID`-wrong-value symptom
(that would look like a 400/403 scoping rejection, per step 2 above) — it's a bare unhandled-exception
shape, reproducible across two independent groups and repeat calls. **No code changes made** — the
gateway matcher, request payloads, tenant logic, and `require*` guards are all confirmed correct as-is;
there is nothing in this repo to patch. These 500s are not a seed-data condition either — per the
guards' own documented rule, a non-200 from a List call THROWS as a real bug, never collapses into a
seed-missing skip.

**Current status**:

| Item | Status |
|---|---|
| gateway host matcher | LIVE CONFIRMED |
| staging backend | BLOCKED / 500 |
| `TARGET_CUSTOMER_ID` write | NOT VALIDATED |
| self-seeded Agent lifecycle | NOT VALIDATED |
| `requireSecondSite()` | NOT VALIDATED |
| seed guards | NOT VALIDATED |
| negative probes | NOT VALIDATED |
| full suite | NOT RUN |

**Recovery gate for resuming steps 2–7** (deliberately stricter than one lucky 200, to avoid resuming
mid-partial-recovery): re-run `List Sites` first. If it returns a real success, also check one
independent List endpoint (`List Agents`) before trusting recovery — only if **both** come back clean
does the smoke plan resume at step 2, in the original order. If either still 500s, stop again and
capture a fresh `activityId`; still no code changes.

One-line project status: **static migration complete; gateway matcher live-confirmed; further
validation blocked by staging backend 500s.**

## Static checks passed this session (repeated at the end of every turn)
`tsc --noEmit` clean · schema↔matcher sweep (127-op `apim-schema.json` vs. every `/^.../ ` matcher
in `tests/dev-portal/` + `pages/dev-portal/`) — 1 finding, a stable historical-prose false positive,
unchanged across every re-run · `gateway-host-matcher.spec.ts` pure-logic suite, 9/9, no
browser/network · repo-wide GUID/ID sweep — zero tenant-specific literals outside `evidence-*.spec.ts`
/ `tenant-scoping-bugs.spec.ts` / the universal all-zero sentinel · `git diff` reviewed file-by-file
each turn, unrelated pre-existing WIP never touched.
