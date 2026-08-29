# SECURITY — Restricted User Management: List + Get ignore the API key's site scope (cross-site read CONFIRMED); Update isolation UNVERIFIED

- **ID**: P0-RESTRICTED-USER-SCOPING
- **Classification**: SECURITY / TENANT ISOLATION
  - **`List Restricted Accesses` + `Get Restricted User` cross-site read** — **CONFIRMED** on the 2026-08-27 controlled site-switch run (see below). Not re-verified 2026-08-29 (blocked).
  - **`Update Restricted User Access` cross-site write** — **UNVERIFIED**. It was never executed cross-site in any session. Expected to be broken too (given List/Get), but that is an assumption, not evidence.
- **Severity**: P0 (access-control records **readable** across sites; write path unverified)

> **Status this session**: `evidence-security.spec.ts` (which does the full
> controlled chain — bind a restricted user to site A, switch the key to
> site B, re-read **and re-write** the same id) **could not run** — after
> login the account `romana@callcabinet.com` lands on the "Select your
> default company" screen and **CC Test 1 is not listed** (the account lost
> CC Test 1 access); `AlreadyLoggedInModal` also misclassifies that screen
> (see `06-environment/ENV-site-assignment-audit.md`). The spec is written
> and typechecks; re-run it once CC Test 1 access is restored.
>
> **List / Get cross-site read** is carried at **CONFIRMED-in-prior-session**
> strength: the controlled chain (up to and including the cross-site `GET`
> and `list`) **was executed end-to-end on 2026-08-27** (recorded in
> `docs/bug-reports/dev-portal-api-management-full-report-2026-08-27.md`
> §4.3). **Cross-site `Update Restricted User Access` was never run** in any
> session — it is UNVERIFIED here.

## Environment

```
app:              https://atmossystemsstaging.callcabinet.com  (TWO s)
developer portal: https://developer1-portal.callcabinet.com
gateway:          https://developer1.callcabinet.com
company:          CC Test 1  (98f086b0-8d0e-4ba8-8f01-870466740b1c)
account:          romana@callcabinet.com  (2026-08-29) / super-admin (2026-08-27 controlled run)
subscription key: Primary: API_test
git:              feature/chat-listing @ ed251c2
```

## Preconditions / Resource IDs (2026-08-27 controlled run)

```json
{
  "restrictedUserId": "2f6e7fd3-c0d9-41a9-a248-4fbe365deeec",
  "restrictedUserEmail": "apiscopingcheck+analytics@callcabinet.com",
  "siteA_name": "Analytics Synthetic Data",
  "siteA_id":   "39e0cb7f-68a8-431c-8754-6941a2f6a547",
  "siteB_name": "UA team recording",
  "siteB_id":   "8cc22cd2-a4b7-46c5-b907-9050e110dac5"
}
```

The user was created fresh via the main app (Settings → User Management → Add
New User, role **Restricted User**) — a blank-slate object, `"sites": null`
initially — specifically so its site intent is unambiguous (not pre-existing
ambiguous data).

## Endpoint chain

### Step 1 — bind the user to site A (`Update Restricted User Access`, a `PUT`; endpoint has **no `/api/` prefix**: `settings/restricted-access/access/`)

```
Request:  PUT https://developer1.callcabinet.com/settings/restricted-access/access/
          body {"userId":"2f6e7fd3-...","agentIds":[],"siteIds":["39e0cb7f-68a8-431c-8754-6941a2f6a547"],"groupIds":[]}
Response: 200 OK
```

### Step 2 — verify under site A (`Get Restricted User`)

```
Request:  GET https://developer1.callcabinet.com/api/settings/restricted-access/2f6e7fd3-c0d9-41a9-a248-4fbe365deeec
Response: 200 OK   "sites": "[\"Analytics Synthetic Data\"]"   ← bound to site A, confirmed
```

### Step 3 — switch the key's site: A → B

`Settings > API Management > pencil on "API_test" > change site to "UA team recording" > Save.` Reopen the Development portal.

### Step 4 — re-read the SAME user id under site B

```
Request:  GET https://developer1.callcabinet.com/api/settings/restricted-access/2f6e7fd3-c0d9-41a9-a248-4fbe365deeec
Response: 200 OK   the complete, unredacted record   "sites": "[\"Analytics Synthetic Data\"]"  (unchanged)
```

### Step 5 — re-enumerate under site B (`List Restricted Accesses`, filtered by the user's email)

```
Request:  POST https://developer1.callcabinet.com/api/settings/restricted-access/list
          body {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"Email","operator":"contains","value":"apiscopingcheck"}]}}
Response: 200 OK   the record is present   (identical to the site-A result)
```

## Expected

With the key scoped to **site B**, a Restricted User bound only to **site A**
should be:
- **not readable** — `Get Restricted User` → `404` / `400` / `204` (empty), the way `Get Agent Group` returns `204` cross-site, or a `400 "Configured site does not contain selected user."` the way Calls / Reports / Manual Redaction / Extension Management / Retention Management all do;
- **not listed** — absent from `List Restricted Accesses`;
- **not mutable** — `Update Restricted User Access` → `400 "Configured site does not contain selected user."`.

## Actual

- `Get Restricted User` under site B → **`200 OK`, the full unredacted record** (email, first/last name, groups, agents, sites, extensions). Byte-identical to the site-A read.
- `List Restricted Accesses` under site B → **the record is still returned**. In the 2026-08-27 cross-site comparison the *entire* 90–100-row result set came back **byte-for-byte identical, in the same order**, for both site assignments of the same key — the result is not merely "not scoped to my site", it is **completely independent of the calling key's site**.
- (Not exercised in the 2026-08-27 controlled run, in `evidence-security.spec.ts` for the re-run) `Update Restricted User Access` under site B for the site-A user — expected to succeed too, given List/Get do.

## Reproducibility

- 2026-08-27 controlled run: 1/1 (create-then-verify, the strongest form).
- 2026-08-27 cross-site comparison on pre-existing data: the same 90–100 records, same order, for two different site assignments of the same key — reproduced across the whole result set.
- 2026-08-29: **0/1 — the re-run was blocked** (account lost CC Test 1 access; see `06-environment/ENV-site-assignment-audit.md`).
- Cross-site **`Update Restricted User Access`**: **0 runs, ever** — UNVERIFIED.

## Alternative explanations ruled out

- **Ambiguous pre-existing data** — ruled out: the target user was created blank (`sites: null`) and explicitly bound to site A via the group's **own** `Update Restricted User Access` operation before the switch.
- **The record was never actually on site A** — ruled out: Step 2's `Get` confirmed `sites = ["Analytics Synthetic Data"]` before the switch.
- **Stale key-site assignment** — ruled out (2026-08-27): the key's site was changed via the real Settings UI and the switch was verified by other groups' responses re-scoping correctly (Extension Management: 1 row → 13 rows; Agent Management: 1 → 17; Retention: re-scoped) in the same session.
- **Same id, different resource** — ruled out: the `Get` response under site B is byte-identical to under site A.
- **Test / environment** — ruled out: staging `developer1` gateway, same account/company throughout.

## Downstream impact

A partner API key scoped to **one** site can, **regardless of which site the
key is scoped to**:
- **enumerate** every restricted-user record of the customer (`List Restricted Accesses`) — **CONFIRMED**,
- **read the full record** of any of them (`Get Restricted User`) — **CONFIRMED**,
- and — **UNVERIFIED, expected given the above** — **modify** their agent/site/group access grants (`Update Restricted User Access`).

The confirmed part is already a within-customer cross-site exposure of
access-control configuration (a read/enumeration leak). Restricted User
Management was **never** on the confirmed per-site-tenancy rollout list
(Calls / Reports / Manual Redaction / QA / Heartbeats / Chats), so this may
be "not yet migrated" rather than a regression — but given the sensitivity
(user access-control assignments), it should be flagged to the feature owner
either way.

**Cross-customer** exposure is **not** confirmed — the `RestrictedUserDto` /
`RestrictedUserListDto` response shape has no `customerId` field, so a
cross-customer leak can neither be confirmed nor ruled out from this data.

## Workaround

None for the reads — `List` / `Get Restricted User` apply no site filter.

## Cleanup performed

2026-08-27 run: the test user `2f6e7fd3-...` was left in place (disposable,
plus-addressed email under a controlled domain). 2026-08-29: no run, nothing
to clean up.

## Remaining unknowns

- Cross-**customer** exposure (needs a second customer's known restricted-user id).
- Whether `Update Restricted User Access` succeeds from the wrong site (expected yes; `evidence-security.spec.ts` step 4 tests it — needs the re-run).
- Whether the main app enforces site scoping here (different internal route).
- "Not yet migrated" vs regression — needs product confirmation.

## Recommended regression test

> **Status 2026-08-30**: implemented as part of the systematic cross-tenant
> matrix — `tests/dev-portal/cross-tenant-catalog.ts` classifies
> `restricted-user/list-restricted-accesses` + `get-restricted-user` as read
> `hypothesis` and `update-restricted-user-access` as write `hypothesis`;
> `cross-tenant-plans.ts` carries the bind→switch→re-read/re-write chain.
> **NOT RUN LIVE** — see `tests/dev-portal/UNVERIFIED.md`. On the first run the
> Get/List rows are expected to fail (documenting this bug); the Update row is
> a first-ever data point.

The chain (also a standalone template):

1. `Update Restricted User Access` — bind a test restricted user to site A.
2. `Get Restricted User` under site A → 200, `sites` = A (baseline).
3. Switch the key's site to B.
4. **Assert** `Get Restricted User(sameId)` is REJECTED (404/400/204).
5. **Assert** `List Restricted Accesses` does NOT contain the user.

1. `Update Restricted User Access` — bind a test restricted user to site A.
2. `Get Restricted User` under site A → 200, `sites` = A (baseline).
3. Switch the key's site to B.
4. **Assert** `Get Restricted User(sameId)` is REJECTED (404/400/204).
5. **Assert** `List Restricted Accesses` does NOT contain the user.
6. **Assert** `Update Restricted User Access(sameId)` → 400 "Configured site does not contain selected user". *(This step has never been run — the assertion is new; current cross-site Update behaviour is unknown.)*
7. Switch back; restore.

Currently steps 4–5 (`Get` / `List`) are known to **succeed** cross-site → the
test documents that part of the bug (KNOWN BUG / `test.fail`) until it is
fixed. Step 6 (`Update`) has never been run — its assertion is new and the
current behaviour is unknown; on the first run, record what actually happens
rather than assuming it fails.

## Suggested bug-ticket wording

**Title**: SECURITY — Restricted User Management API is not site-scoped for reads: a subscription key scoped to site B can enumerate (`List Restricted Accesses`) and read the full record of (`Get Restricted User`) restricted users bound to site A (same customer). `Update Restricted User Access` cross-site is expected to be affected too but has not been tested.

**Env**: staging `developer1` gateway. Key "Primary: API_test", customer CC Test 1. Sites: A = Analytics Synthetic Data (`39e0cb7f-68a8-431c-8754-6941a2f6a547`), B = UA team recording (`8cc22cd2-a4b7-46c5-b907-9050e110dac5`).

**Steps**:
1. Create a Restricted User (any means). Key scoped to site A: `PUT settings/restricted-access/access/` `{userId, agentIds:[], siteIds:["<siteA>"], groupIds:[]}` → 200. `GET settings/restricted-access/{userId}` → 200, `sites` = site A.
2. Change the key's site to B (Settings → API Management → edit key → Save).
3. `GET settings/restricted-access/{userId}` → **200, full record returned** (byte-identical to under site A). `POST settings/restricted-access/list` → **the user is still listed** (the whole list is identical to under site A). `PUT settings/restricted-access/access/` for that user → **not tested cross-site** (expected to succeed).

**Expected**: step 3's `GET` and `list` should be blocked (404/400/204), and `PUT` should be rejected, matching every other site-scoped group (Calls/Reports/Manual Redaction/Extension/Retention all return `400 "Configured site does not contain selected ..."` cross-site).
**Actual**: `List` and `Get Restricted User` apply **no site filter at all** — the result is independent of the key's site. `Update Restricted User Access` cross-site was not exercised; its behaviour is unverified.

## Raw evidence files

- 2026-08-27 controlled-run details: `docs/bug-reports/dev-portal-api-management-full-report-2026-08-27.md` §4.3 (full step-by-step, both rounds + the cross-site comparison table in §7).
- 2026-08-29 re-run (blocked): `raw/SECURITY-SCOPING-ENV.json` will be produced when `evidence-security.spec.ts` runs; `test-results/dev-portal-evidence-securi-*/trace.zip` (login-failure trace).
- Re-runnable spec: `tests/dev-portal/evidence-security.spec.ts`.
