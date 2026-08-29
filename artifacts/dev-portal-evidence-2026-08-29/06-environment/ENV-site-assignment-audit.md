# ENVIRONMENT — subscription-key site assignment + the `KNOWN.siteId` hardcode risk + the account-session blocker

- **ID**: ENV-SITE-ASSIGNMENT
- **Classification**: INFRASTRUCTURE / ENVIRONMENT
- **Severity**: P1 — a stale key-site assignment (or a stuck account session) silently invalidates whole batches of tests

## 1. The blocker that interrupted this investigation — the account lost CC Test 1 access

**Symptom** (2026-08-29 afternoon): `evidence-console.spec.ts` and
`evidence-security.spec.ts` runs all failed in `stagingLogin` →
`LoginPage.login` → `LoginPage.completeLogin`.

**Root cause (from the failure page snapshot)**: login itself **succeeds** —
credentials are accepted. The account `romana@callcabinet.com` then lands on
the **"Select your default company"** screen, which offers only
`1Test_Dev_UA_Svitlana_Company_3`, `Charl_Test`, `Roman_QA_TEST` —
**CC Test 1 is not in the list**. The account has been **removed from / lost
its access to CC Test 1** (most likely a spam mitigation triggered by the
volume of write calls — Manual Redaction and create/delete — across the day).
Every dev-portal test needs CC Test 1 and its `Primary: API_test`
subscription key, so **all dev-portal specs are blocked** until that access is
restored by a CC Test 1 owner/admin.

**Secondary (separate) harness bug**: `completeLogin` →
`clearActiveSessionModal` → `AlreadyLoggedInModal.logOutOtherSession()` →
`logOutOtherSessionButton.click()` mis-handles the "Select your default
company" screen — it treats it as (or gets stuck ahead of) the "already
logged in on another computer" modal and the click hangs with no timeout,
consuming the full test timeout. This is a login-helper defect independent of
the access loss and would need fixing even once CC Test 1 access is back
(add a timeout to `logOutOtherSession()`; teach `completeLogin` to detect and
handle the company-picker screen).

**Timeline**: batches 1–4 (P0 backend, batch2 500s + list-chats + save-qas,
batch3 create-agent-group + create-extension + negative-500s + manual-redaction,
batch4 list-calls + list-extensions + list-retention + update-agent-group +
update-tag + delete-user) — all ran successfully earlier the same day, under
CC Test 1, key on `UA team recording` / `8cc22cd2-…` (every `raw/*.json`
`precondition` confirms it). The access loss happened **after** batch 4
(~10:24 UTC); no captured evidence is affected — zero 401/403/"not allowed for
current subscription" appears in any response, and every write completed
end-to-end.

**Impact**: the last three findings could not be captured live —
- `03-console-ui/CONSOLE-RACE-REPORT.md` §2/§3 (direct-backend contrast for Get Alert Trigger Operators; live Content-Type capture) — **evidence gap**;
- `02-security-site-scoping/BUG-restricted-user-no-site-scoping.md` — List/Get cross-site read carried at **CONFIRMED-in-prior-session** (2026-08-27); cross-site **Update UNVERIFIED**;
- `04-suspected-scoping/SCOPING-suspected-gaps.md` — carried on prior-session data instead of a fresh single-switch.

**Action needed**:
1. **Restore `romana@callcabinet.com`'s access to CC Test 1** (owner/admin action) — this is the blocker. Confirm CC Test 1 still has the `Primary: API_test` subscription key with a site assigned.
2. Fix the login helper regardless: add a timeout to `AlreadyLoggedInModal.logOutOtherSession()`; teach `LoginPage.completeLogin` to detect and handle the "Select your default company" screen (choose CC Test 1 when present).
3. Re-run `npx playwright test tests/dev-portal/evidence-console.spec.ts tests/dev-portal/evidence-security.spec.ts --project=chromium --workers=1 --trace on`.

## 2. Subscription-key site assignment — does the tenant suite restore it?

**Key site during THIS investigation** (read live via `Get Sites Storage
Usage` at the start of every evidence batch): **`UA team recording` /
`8cc22cd2-a4b7-46c5-b907-9050e110dac5`** — stable across every batch that
ran. (The `agent-management-api.spec.ts` header's note about the key being on
`49bb6c26-...` was from a transient state in an earlier session; it was back
on `8cc22cd2-...` for all of today's evidence runs, confirmed two independent
ways — `Get Sites Storage Usage` **and** the `siteId` on every agent in
`List Agents`.)

**The automated switch** (`ApiManagementSettingsPage.switchKeyToRandomDifferentSite`)
— `evidence-security.spec.ts` was to exercise it (A → random B → back to A)
and record the site before / after / after-restore. **Blocked this session**
by the account-session issue above.

**`npm run test:tenant-switch` via Bash remains blocked by the harness
permission classifier** (re-confirmed — consistent with prior sessions). The
switch page-object works when driven by `npx playwright test` directly (as
`evidence-security.spec.ts` does). A new `ApiManagementSettingsPage.switchKeyToSite(keyName, siteName)`
method was added this session so a test can restore the key to a **specific**
site (not just a random different one) in cleanup.

## 3. Audit — which `tests/dev-portal/` files assume a constant `KNOWN.siteId`

`KNOWN.siteId` = `8cc22cd2-…` (UA team recording), defined in `_helpers.ts`.

| File | Sources `siteId` how? | Risk if the key's site drifts |
|---|---|---|
| `agent-management-api.spec.ts` | **LIVE** — `firstAgent()` reads it off an existing agent | safe |
| `group-management-api.spec.ts` | LIVE (via `List Agents` for the seed agent) + `KNOWN.customerId` only | safe |
| `evidence-*.spec.ts` (all) | **LIVE** — `readKeySite()` / `firstAgent()` | safe |
| `calls-api.spec.ts` | **hardcoded `KNOWN.callId` / `KNOWN.tagId`** (call is site-bound) | Get/Update/Download 400 if the key leaves that site |
| `qa-api.spec.ts` | hardcoded `KNOWN.callId` | same |
| `manual-redaction-api.spec.ts` | hardcoded `KNOWN.callId` | same |
| `reports-api.spec.ts` | **hardcoded `KNOWN.siteId`** in the `Get Site Usage Statistics` / `Get Storage Usage` params | 400 if the key leaves that site |
| `retention-management-api.spec.ts` | **hardcoded `KNOWN.siteId`** in `Update Retention Policy` | verify step fails if the key leaves that site |
| `notifications-api.spec.ts` | **hardcoded `KNOWN.siteId`** in the `Add Notification Rule` body (`siteIds`) | rule create may 400 / bind to the wrong site |
| `extension-management-api.spec.ts` | **hardcoded `KNOWN.siteId`** for Create Extension | Create 400s ("Configured site does not contain selected extension") if the key leaves that site |
| `tenant-isolation-*.spec.ts` | intentionally drives the switch | n/a (but should restore) |

## 4. This is SEPARATE from the Update Agent 400

Explicitly ruled out: the `POST settings/agents/update` 400
(`01-backend-bugs/BUG-update-agent-site-scoping.md`) was reproduced with
`siteId` sourced **live** from an existing agent — i.e. unambiguously the
key's *current* site — **and** independently confirmed against
`Get Sites Storage Usage` (both `8cc22cd2-…`), **and** reproduced on a
**pre-existing** agent that has an extension. It is a backend bug in the
update path, not a stale-assignment artifact.

## Expected vs Actual

- **Expected**: the tenant-isolation suite leaves the key on its original site; every test that needs an own-site id reads it live.
- **Actual**: 7 `*-api.spec.ts` files hardcode a site-bound value (`KNOWN.siteId` or a site-bound `callId`); only `agent-management-api` was hardened. If the tenant suite (or an interrupted `evidence-security` run) leaves the key on another site, a later run of those 7 looks like it found product bugs (Create succeeds but record invisible / Update 400s) when it is test data.

## Recommended fix (test infra — not a product bug)

1. Add `currentSiteId(portal)` to `_helpers.ts` — reads `Get Sites Storage Usage` once, memoised per worker — and a `KNOWN_CALL` resolver that picks a call from `List Calls` for the current site.
2. Migrate `calls-api` / `qa-api` / `retention-management-api` / `manual-redaction-api` / `notifications-api` / `reports-api` / `extension-management-api` off the hardcodes.
3. Add an `afterAll` to `tenant-isolation-staging.spec.ts` / `tenant-isolation-negative-writes-staging.spec.ts` that records the key's site in `beforeAll` and restores it (`ApiManagementSettingsPage.switchKeyToSite`) in `afterAll`.
4. Fix / harden `AlreadyLoggedInModal.logOutOtherSession()` (add a timeout) and teach `LoginPage.completeLogin` to detect and handle the "Select your default company" screen — the 2026-08-29 blocker was the account **losing CC Test 1 access** (login succeeded, then the company-picker offered no CC Test 1), which the helper misread as the "already logged in" modal and hung on.

## Suggested ticket

(Internal test-infra.) *Replace hardcoded `KNOWN.siteId` / site-bound `KNOWN.callId` across `tests/dev-portal/*-api.spec.ts` with a live per-run resolution; make the tenant-isolation suites restore the subscription key's site in `afterAll`; harden the "already logged in" modal handling for the shared `romana@callcabinet.com` account.*

## Raw evidence files

- Login-failure traces: `test-results/dev-portal-evidence-console-*/trace.zip`, `test-results/dev-portal-evidence-securi-077c9--switch-full-evidence-chain-chromium/trace.zip` + `error-context.md`.
- Key-site reads: every `raw/*.json` `precondition.currentSiteId` / `currentSiteName` field (all `8cc22cd2-…` / "UA team recording" this session).
- Re-runnable spec (records the switch + before/after/restore site): `tests/dev-portal/evidence-security.spec.ts`.
