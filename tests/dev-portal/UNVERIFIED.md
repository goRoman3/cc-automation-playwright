# dev-portal matrix work — WRITTEN, NOT RUN LIVE

Tracking list for the 2026-08-30 rework. **Nothing below has been executed
against staging** — the shared account `romana@callcabinet.com` is out of
company CC Test 1, so no dev-portal spec can run. `npx tsc --noEmit` is green;
that is the only verification done.

Six declarative matrices, in reading order below: **cross-tenant isolation**
(127 ops), **negative-required-fields**, and the four follow-ups —
**boundary-values** (item 1), **response-contract** (item 2), **authorization**
(item 3), **idempotency & retries** (item 4). Items 0+1 share the
`runFieldProbeMatrix` engine (request-mutation probes); item 4 reuses the
item-0 `NegFieldSpec` create-op bases; items 2 and 3 have their own thin
drivers (they assert on the *response* / on *auth outcome*, not on a mutated
request) but follow the same conventions — the shared `fireConsole()` request
primitive (in `_helpers.ts` — one copy, replaces the seven local
`fire()`/`fireJson()`/`fireGet()`/`invoke()` copies), per-spec try/catch →
rows, `resolve`/`identify`/`cleanup` in `finally`, `render*Matrix`, a CONTROL
invocation, and the shared expectation vocabulary
(`known-bug` / `hypothesis*` / `needs-schema-confirmation`, verdict
`FIXED-FLIP-ME` when a pinned bug is fixed).

When CC Test 1 access is restored, run each item, then move it to "verified"
with the observed result. Do **not** loosen any `expect.soft` before the first
real run — several are hypotheses whose failure IS the signal.

## Negative-required-fields MATRIX

Same shape as the cross-tenant matrix — declarative table + engine + spec.
Scope: **create-from-body ops only** (11), each with a CONTROL case (full
valid body → success) + per-field omission + `finally` cleanup.

| File | Role | Status |
|---|---|---|
| `_negative-fields.ts` | engine — `runNegativeFieldMatrix` (control → per-field omission → cleanup), verdict logic, `renderNegMatrix` | ⬜ NOT RUN |
| `negative-fields-catalog.ts` | 11 `NegFieldSpec`s; 26 required-field rows classified: **5 `'400'`** (confirmed), **2 `'known-bug-500'`** (Add IP Whitelist `ipAddress`, Create Custom Role `name` — BUG-negative-missing-field-500), **5 `'hypothesis-400'`**, **13 `'needs-schema-confirmation'`**, **1 `'special'`** (Create Agent Group `agentJson` empty→silent no-op) | ⬜ NOT RUN |
| `negative-required-fields-matrix.spec.ts` | `test:negative-fields-matrix` — runs it, writes `artifacts/.../negative-required-fields-matrix-latest.md`, + named `test.skip` per excluded op (7) | ⬜ NOT RUN |
| `negative-required-fields-staging.spec.ts` | UNCHANGED (header note added) — retained for the 2 ops the matrix excludes (Add User, Manual Redaction) | pre-existing |

### First-run reading

- **HARD fails**: `CONTROL-FAIL` (valid body didn't succeed — rows meaningless), `LEAK` (a confirmed-`'400'` field was silently accepted when omitted — the exact bug guarded), `REGRESSION` (confirmed-`'400'` field now errors differently), **`FIXED-FLIP-ME`** (a `'known-bug-500'` / `'not-enforced'` field now returns 400 — the bug is FIXED; update `expect` in `negative-fields-catalog.ts`. This is the intended "goes RED when Smarsh fixes it").
- **`HYPOTHESIS-FAIL`** (soft): `hypothesis-400` fields whose rejection was never actually observed — `agent-mgmt/create-agent-extension-mapping` (`agentId`, `extensionId`), `notifications/add-notification-rule` (`name`), `group-mgmt/create-agent-group` (`name`, `customerId`). First data points; don't loosen before a real run.
- **`RECORDED`** (logged, not asserted): all 13 `needs-schema-confirmation` fields (Create Agent full DTO, Upsert Alert Configuration full DTO, some rule fields) + the Create Agent Group `agentJson` `special` row. Required-ness genuinely unknown — no assertion written, per instruction.
- **`leftovers`**: `role-mgmt/create-custom-role` — Delete Custom Role console is broken, so the disposable role (uniquely named `AQA neg role *`) is LEFT. Grep + delete manually. Same for any `known-bug-500`/`hypothesis` omission that unexpectedly 2xx's and can't be identified.

### Known plan weak spots

- **Cleanup path-param names** for `Delete Site` (`siteId`?), `Delete Tag` (`tagId`?) are assumed — the underlying specs use positional `fillParameters`. If wrong, the disposable is left (CC Test 1 has hundreds of sites/tags — harmless). Flagged via `cleanupCaveat`.
- **`Add IP Whitelist` control** adds `203.0.113.49` (RFC 5737 TEST-NET-3, reserved) to the account whitelist and deletes it — transient real config change, same as the evidence run.
- **`Create Agent` / `Upsert Alert Configuration`** field lists are a *subset* (4–5 plausibly-meaningful fields) marked `needs-schema-confirmation`, not the full ~20-field DTO — the full reduced required set was never established (suite-rework doc).

## Boundary-values MATRIX (item 1 — follow-up)

Same engine as the negative matrix (`runFieldProbeMatrix` — control → per-probe
→ `finally` cleanup). New wrapper `runBoundaryMatrix` + `boundaryProbes()` in
`_negative-fields.ts`. Instead of *omitting* a required field, sends it
present-but-degenerate: empty string / whitespace / `null` / malformed GUID /
all-zero GUID / out-of-range / negative / wrong-type / bad-format / malformed
JSON.

| File | Role | Status |
|---|---|---|
| `_negative-fields.ts` | `+ runBoundaryMatrix`, `boundaryProbes`, `BoundaryField`/`BoundaryKind`/`BoundarySpec`, `renderBoundaryMatrix` | ⬜ NOT RUN — typecheck only |
| `boundary-fields-catalog.ts` | `BOUNDARY_SPECS` — 11 create-from-body ops (reuse each `NEG_FIELD_SPEC`'s `validBody`/`resolve`/`identify`/`cleanup` via `ext()`) + 2 READ ops for pagination bounds (`List Calls`, `List Agents` — no cleanup). 54 boundary rows: **1 `'400'`** (Add Tag `name`=bad-format — CONFIRMED CONTRACT-update-tag-name-validation), **1 `special`** (Create Agent Group `agentJson`="[]" — CONFIRMED 200 silent non-persist), **~25 `hypothesis-400`**, **~9 `hypothesis-reject`**, **~18 `needs-schema-confirmation`** | ⬜ NOT RUN |
| `boundary-values-matrix.spec.ts` | `test:boundary-matrix` — runs it, writes `artifacts/.../boundary-values-matrix-latest.md`; named `test.skip` per `BOUNDARY_DEFERRED` (2) + the same `EXCLUDED_FROM_NEG_MATRIX` (7) | ⬜ NOT RUN |

### First-run reading

- **HARD fails**: `CONTROL-FAIL`; `LEAK` — the ONLY confirmed `'400'` boundary
  (Add Tag `name`=`"AQAneg-1_."`) was silently accepted → the alphanumeric-only
  name validator regressed; `REGRESSION`; `FIXED-FLIP-ME` — a `known-bug-500`
  boundary now 400s (none classified `known-bug-500` in this matrix yet, so this
  should not fire on the first run).
- **`HYPOTHESIS-FAIL`** (soft): every `hypothesis-400` / `hypothesis-reject` row.
  These are the bulk of the matrix — the confirmed facts are about field
  *omission*, not degenerate *values*, and per the rules the two are NOT
  conflated. First data points; do **not** loosen `expect` in
  `boundary-fields-catalog.ts` before a real run. Likely-real signals to watch:
  empty/`null` `name` on Create Extension / Add Site / Add Call Note `note`;
  malformed-GUID `siteId`/`agentId`/`extensionId`; `take:10000` on `List Calls`
  (evidence new-finding (b) — server `take` max is 500, seen tripping on
  `chats/list`; never observed on `List Calls` itself).
- **`RECORDED`** (logged, not asserted): all `needs-schema-confirmation` rows
  (all-zero-GUID slots, `Create Agent` full-DTO fields, `Upsert Alert
  Configuration` full-DTO fields, `Add IP Whitelist` empty/`null` `ipAddress`
  — may re-hit the omission NRE, unknown) + the Create Agent Group
  `agentJson`="[]" `special` row (CONFIRMED 200 + silent non-persist).
- **`leftovers`**: `role-mgmt/create-custom-role` — no Delete Custom Role
  console, so the CONTROL role **and** any boundary probe that unexpectedly
  2xx's are LEFT (uniquely named `AQA neg role *`). This matrix adds up to 2
  more such rows per run on top of the neg matrix's. Grep + delete manually.

### Known plan weak spots

- **`bad-date` probes are NOT in this matrix** (`BOUNDARY_DEFERRED[0]`, named
  skip) — no in-scope op has a confirmed valid body with a date field (the
  reports read-plans in `cross-tenant-plans.ts` send no body). Needs a live
  `Get Call Volume Statistics` / `Get Report By Template` body captured first.
- **Over-limit string length** also deferred (`BOUNDARY_DEFERRED[1]`) — no
  confirmed server-side max for any name/note field; a length would be a guess.
- **CONTROL side effects** (same as the neg matrix, doubled when both run):
  Add Site creates a real disposable site each run; Add Tag a real tag;
  Add IP Whitelist adds `203.0.113.49` (RFC 5737 TEST-NET-3) to the real
  account whitelist then deletes it; Create Custom Role a real role (not
  cleaned — console broken).
- **`List Calls` / `List Agents` pagination specs** assume the console renders
  a JSON body editor for these (`LIST_BODY` shape). If the console is
  schema-blind that run, `sendJson`'s `addBody()` fallback covers it — but a
  `take`/`skip` swap on a body the console never accepted would `ERROR`, not
  mislead.

## Response-contract MATRIX (item 2 — follow-up)

Invoke each in-scope op with its confirmed-valid request, then assert the
response body's structure/types. Same NOT-RUN status; `npx tsc --noEmit` green.

| File | Role | Status |
|---|---|---|
| `_contract-checks.ts` | engine — `runContractMatrix` (invoke=control → per-assertion → `finally` cleanup), dotted-path resolver (`[].x` = per array element), value checks (`guid` / `non-zero-guid` / `positive-int` / …), `renderContractMatrix` | ⬜ NOT RUN |
| `contract-checks-catalog.ts` | `CONTRACT_SPECS` — 8 ops, 23 assertions: **15 `'ok'`** (documented-correct — FAIL = `CONTRACT-VIOLATION`), **3 `'known-bug'`**, **4 `'hypothesis'`**, **1 `'needs-schema-confirmation'`** | ⬜ NOT RUN |
| `contract-checks-matrix.spec.ts` | `test:contract-matrix` — runs it, writes `artifacts/.../contract-checks-matrix-latest.md`; named `test.skip` per `CONTRACT_EXCLUDED` (5 — incl. **Get Custom Role**, explicitly: drivable but its bug is a request/response-correlation defect the shape-only engine can't pin; already covered in `role-management-api.spec.ts`) | ⬜ NOT RUN |

### The two must-catch confirmed bugs (`expect: 'known-bug'` → `OK` while present, `FIXED-FLIP-ME` when fixed)

1. `contract/get-agent` — `customerId` `[non-zero-guid]` and `contract/list-agents` — `[].customerId` `[non-zero-guid]` → `CONTRACT-AGENT-CUSTOMERID`: `GET settings/agents/{id}` and `POST settings/agents/list` return the all-zero customerId.
2. `contract/create-agent-group` — `id` `[positive-int]` → `P1-CREATE-AGENT-GROUP-ID-ZERO`: the Create response id is always `0`.

**Contrast rows (`expect: 'ok'`, CONFIRMED)**: `contract/create-agent` — `customerId` `[non-zero-guid]` (Create's response DOES carry the real id — the bug is read-side only); `contract/list-agent-groups` — `[].customerId` `[non-zero-guid]` (List Agent Groups carries the real id, unlike List Agents). If either of these `ok` rows FAILS it's a `CONTRACT-VIOLATION` — investigate before assuming the contrast is wrong.

### First-run reading

- **HARD**: `CONTROL-FAIL` (op wouldn't 2xx), `CONTRACT-VIOLATION` (an `'ok'` assertion failed — new break), `FIXED-FLIP-ME` (a `'known-bug'` assertion now passes → the bug is fixed; change that row's `expect` to `'ok'`).
- **`HYPOTHESIS-FAIL`** (soft): the 4 `'hypothesis'` rows — Get Agent `site` string, Create Agent Group `agents` array, Get Call Info `model.siteId` / `model.hasAnsweredForms`. Structure guesses; update the assertion once verified.
- **`RECORDED`**: `contract/get-call-info` `model.userId` `[non-zero-guid]` — the raw capture showed the all-zero GUID here, but that may legitimately mean "no user"; recorded, not asserted.
- **`leftovers`**: `contract/create-agent-group` — cleaned by name via List; `contract/create-agent` / `create-extension` / `upsert-alert-configuration` cleaned by id. No broken-cleanup ops in this matrix (unlike the neg/boundary ones).

## Authorization MATRIX (item 3 — follow-up)

Read-only ops × a degraded subscription key. First coverage of this class.

| File | Role | Status |
|---|---|---|
| `_auth-checks.ts` | engine — `runAuthMatrix` over modes `valid` / `unscoped-own-key` / `garbage-key-header`; `renderAuthMatrix` | ⬜ NOT RUN |
| `auth-checks-catalog.ts` | `AUTH_OPS` — 4 read-only ops (2 customer-level: Get Company Info, List Sites; 2 site-scoped: List Agents, Get Sites Storage Usage) + `AUTH_DEFERRED` (3 modes) | ⬜ NOT RUN |
| `auth-checks-matrix.spec.ts` | `test:auth-matrix` — runs it, writes `artifacts/.../auth-checks-matrix-latest.md`; named `test.skip` per deferred mode | ⬜ NOT RUN |

### Modes

- **`valid`** — `Primary: API_test` (control → 2xx).
- **`unscoped-own-key`** — `Primary: 1`, the account's own non-site-scoped default. **CONFIRMED**: blanket-500s every operation regardless of shape/host (`pages/dev-portal/ApiOperationPage.ts` doc, `_helpers.ts` doc, tenant-scoping bug reports). `expect: 'known-bug'` — a correct impl would 200 a customer-level read and 401/403 a site-scoped one. Row = `OK` while it 500s; `FIXED-FLIP-ME` when it starts 2xx-ing or 401/403-ing.
- **`garbage-key-header`** — real key selected, then `Ocp-Apim-Subscription-Key` overridden with 32 zeros via "Add header". APIM's documented behaviour is `401` "invalid subscription key"; **NEVER observed here**, and whether the console lets a manual header win over the dropdown is itself unverified → `expect: 'hypothesis-reject'`. **A `2xx` here → `AUTH-BYPASS` (HARD fail)** — a real security hole. A `500` may just mean the console kept the real key (→ `HYPOTHESIS-FAIL`, recorded).

### Deferred modes (named `test.skip`, no fixture)

- `no-key` — the console dropdown always has a value; no affordance to send with the header absent. Needs a raw `page.request` outside the console.
- `foreign-tenant-key` — no second customer's subscription key available.
- `expired-key` — none exists; can't safely expire one.

### First-run reading

- If the `garbage-key-header` rows come back `HYPOTHESIS-FAIL` with `500`, the console probably ignored the manual header — that's a harness limitation, not a finding. Try a raw request to actually test invalid-key rejection.
- If any `garbage-key-header` row is `AUTH-BYPASS`, stop and file it.
- The `unscoped-own-key` rows against **customer-level** ops (Get Company Info, List Sites) are the most interesting: if those also 500, the blanket-500 is confirmed even where an unscoped key *should* work.

## Idempotency & retries MATRIX (item 4 — follow-up)

Reuses the confirmed create-op bases (`NEG_FIELD_SPECS`) and layers three
scenarios per op.

| File | Role | Status |
|---|---|---|
| `_idempotency-checks.ts` | engine — `runIdempotencyMatrix` (control create → `doubleCreate` / `deleteDeleted` / `updateNonexistent` → `finally` cleanup); `renderIdempotencyMatrix` | ⬜ NOT RUN |
| `idempotency-checks-catalog.ts` | `IDEMPOTENCY_SPECS` — 10 create ops; 9 `double-create` + 8 `delete-deleted` + 8 `update-nonexistent` scenario rows | ⬜ NOT RUN |
| `idempotency-checks-matrix.spec.ts` | `test:idempotency-matrix` — runs it, writes `artifacts/.../idempotency-checks-matrix-latest.md` | ⬜ NOT RUN |

### Scenarios & verdicts

- **`double-create`** — same valid body twice. Records `1st→N, 2nd→M, distinct id?`. `expectSecond` per op: `new-object` (a 2nd row is expected) / `unknown` (dedup plausible — Add Tag, Add IP Whitelist, Create Extension, Create Agent Extension Mapping). A `5xx` on the 2nd → `HYPOTHESIS-FAIL`; a 2nd distinct object where `same-object` was expected → `DUP-SILENT`.
- **`delete-deleted`** — create → delete → delete again. `404` → `OK`; idempotent `2xx` → `RECORDED` (acceptable but verify); **`5xx` → `STALE-5XX`** (NRE on a missing entity — same class as `BUG-negative-missing-field-500`).
- **`update-nonexistent`** — Update with the just-deleted id (or all-zero GUID / `999999999`). `404`/`4xx` → `OK`; **`2xx` → `PHANTOM-WRITE`** (silent no-op / phantom write); **`5xx` → `STALE-5XX`**.

**Every expectation is `hypothesis`** — nothing about idempotency is CONFIRMED for these ops. `STALE-5XX` / `PHANTOM-WRITE` / `DUP-SILENT` / `HYPOTHESIS-FAIL` are all asserted **soft** (aggregated `expect.soft`) — first data points, decide with the API owner, don't add a hard assertion yet. Only `CONTROL-FAIL` is hard.

### Excluded

- `role-mgmt/create-custom-role` — Delete Custom Role console broken → no `deleteDeleted`, no cleanup.
- `agent-mgmt/create-agent` `update-nonexistent` — `Update Agent` is a confirmed 400 bug for any agent (a 400 on a bogus id would be uninformative).
- `group-mgmt/create-agent-group` `double-create` / `delete-deleted` — the `id:0` response bug forces `identify` onto the group NAME, which can't distinguish "same object" from "2nd object, same name" and can't feed a delete-by-id. Only `update-nonexistent` (with a `999999999` id) is run.

### Known plan weak spots

- `double-create` on ops whose `identify` keys on **name** (none currently — all use a real id or `configResult`) would misreport "same object". Watched.
- `update-nonexistent` bodies for `Update Extension` / `Update Site` use fully-bogus values (`id`=`siteId`=bogus) — a 400 could be "bad body" rather than "no such id". The status *class* (4xx vs 5xx vs 2xx) is still the signal.
- `notifications/upsert-alert-configuration` `update-nonexistent` calls **Upsert** with a bogus numeric id (`999999999`). If upsert-on-missing-id *creates* rather than 404s, the engine now runs `base.identify` on the 2xx response and, when it yields an id (the `configResult` string does), adds the phantom config to `toClean` so the `finally` deletes it. If `identify` returns nothing the row note says so — grep the throwaway name (`AQA idem nx`) and delete manually.

## Cross-tenant isolation MATRIX (systematic — replaces the point specs)

The 2026-08-30 rework turned cross-tenant coverage into a declarative table over
**all 127 catalogue operations**, driven by one engine and one spec. The two
self-contained point specs from the first pass
(`tenant-isolation-negative-restricted-user-staging.spec.ts`,
`tenant-isolation-negative-writes-extra-staging.spec.ts`) were **deleted** —
subsumed.

| File | Role | Status |
|---|---|---|
| `_cross-tenant.ts` | engine — types, `runCrossTenantMatrix` (one A→B→back switch, per-op try/catch into `MatrixRow`s), `renderMatrix`, normalisation | ⬜ NOT RUN — typecheck only |
| `cross-tenant-catalog.ts` | **source of truth** — 127 ops classified `read`(53) / `write`(31) / `blocked`(27) / `destructive`(5) / `n/a`(11); import-time integrity gate | ⬜ NOT RUN |
| `cross-tenant-plans.ts` | executable `ReadPlan` / `WritePlan` per driven op (84) — payloads lifted verbatim from `*-api.spec.ts` / ADO 37288 / evidence raw captures, never invented | ⬜ NOT RUN |
| `cross-tenant-matrix.spec.ts` | `test:cross-tenant-matrix` — runs the sweep, writes `artifacts/dev-portal-evidence-2026-08-29/cross-tenant-matrix-latest.md`, + one named `test.skip` per `blocked`/`destructive`/`n/a` op (43) | ⬜ NOT RUN |
| `cross-tenant-catalog.md` | human-readable render of the catalogue (`npm run gen:cross-tenant-catalog`) | generated |

### First live run — how to read the matrix (NOT just pass/fail)

- **HARD fails**: `switchThrew` (harness broke), `restoredToSiteA=false` (key left on the wrong site — restore manually!), any **`LEAK`** row (a per-site key read/mutated another site's data — a real isolation bug).
- **`HYPOTHESIS-FAIL`** (soft): the expected rejection has never actually been observed. On the first run these are **expected** for `restricted-user/list-restricted-accesses`, `restricted-user/get-restricted-user` (DOCUMENTED unscoped — BUG-restricted-user-no-site-scoping) and `restricted-user/update-restricted-user-access` (cross-site Update NEVER executed). Read the row's `observed`; update the plan's `expectation` only once a real run confirms a direction. Do NOT loosen.
- **`SUSPECTED`** (logged, not asserted): every `triage` read (suspected scoping gaps — List Notification Rules / List Alert Events / List Report Templates / …) and every `onSuccess:'suspected'` write (alert-config / custom-role site-scoping unconfirmed). These need **product triage**, not a code change.
- **`ERROR`** (logged): the op could not be driven this run — usually a resolver found no id (empty account) or a payload shape drifted. Fix the plan/data, not the engine.
- **`SKIP`**: `blocked` / `destructive` / `n/a` — see the row note + `cross-tenant-catalog.md` for why.

### Known plan weak spots to verify on the first run

- **Reports pointed reads** (`get-site-usage-statistics`, `get-storage-usage`): the plan's `resolve` captures site A's `siteId` under site A, and Phase B replays the same resolved map — so the site-B leg asks for site A's figures. Confirm the engine's resolved-map replay actually does this (it stores `base.resolved` and reuses it — verified in code, not live).
- **Agent Extension sub-CRUD** (`create/update/delete-agent-extension`): needs a free agent (`!assignedExtension`) AND a free extension (`agentId == zero-GUID`) on site A — if the account has none, these `ERROR`.
- **`notifications/get-alert-configuration`** read: no standalone id source → sends `notificationId=0`, will likely `ERROR`. The real signal for that object is the Upsert/Delete write rows.
- **Manual Redaction Submit**: classified `blocked` (standing "do not fire" hold + endpoint hang) → named skip. The matrix never fires it.
- **`role-mgmt/*` cleanup**: `Delete Custom Role` console is broken → a leaked/created disposable role is **left** (uniquely named `xt-role*`). Grep + delete manually after a run.
- **create-X LEAK cleanup**: `remove` re-lists under site A and deletes the orphan by its unique marker (`xt-*`). If a `create-X` LEAKs and the orphan is NOT visible under site A, it's left — grep by marker.

## Changed specs — item 8 (drop site-bound `KNOWN.*` constants → live per-run reads)

`_helpers.ts` gained `currentKeySite` / `currentSiteId` / `firstOwnSiteCall` /
`firstOwnSiteCallId` / `assignedTagId`. Migrated off the stale constants:

| Spec | Was | Now | Status |
|---|---|---|---|
| `calls-api.spec.ts` | `KNOWN.callId` / `KNOWN.tagId` (module consts) | `firstOwnSiteCallId(portal)` per test; tag tests use `firstOwnSiteCall({withTags:true})` + `assignedTagId`, `test.skip` if none | ⬜ NOT RUN — adds one `List Calls` round-trip per test |
| `qa-api.spec.ts` | `KNOWN.callId` | `firstOwnSiteCallId(portal)` per test; `firstAvailableFormId(portal, callId)` now takes callId | ⬜ NOT RUN |
| `manual-redaction-api.spec.ts` | `KNOWN.callId` | `firstOwnSiteCallId(portal)` per test | ⬜ NOT RUN |
| `retention-management-api.spec.ts` | `KNOWN.siteId` | `currentSiteId(portal)` | ⬜ NOT RUN |
| `reports-api.spec.ts` | `KNOWN.siteId` | `currentSiteId(portal)` per test | ⬜ NOT RUN |
| `notifications-api.spec.ts` | `KNOWN.siteId` in `Add Notification Rule` body | `currentSiteId(portal)` | ⬜ NOT RUN |
| `extension-management-api.spec.ts` | `const siteId = KNOWN.siteId` (module) | `currentSiteId(portal)` per test | ⬜ NOT RUN |

`KNOWN.siteId` / `KNOWN.callId` / `KNOWN.tagId` still exist in `_helpers.ts`
(used by `evidence-*.spec.ts` and as a fallback in
`restricted-user-management-api.spec.ts`) — just no longer relied on by the 7
files above.

## Changed specs — item 8 (Phase 2 auto-restores the key's site)

| Spec | Change | Status |
|---|---|---|
| `tenant-isolation-staging.spec.ts` | `Baseline` gains `siteAName` (Phase 1 records it); Phase 2 `finally` switches the key back to it | ⬜ NOT RUN |
| `tenant-isolation-negative-writes-staging.spec.ts` | same — `Baseline.siteAName` + Phase 2 `finally` restore | ⬜ NOT RUN |

The `Switch` test in `tenant-isolation-staging.spec.ts` still deliberately
leaves the key switched (that's its job — set up for Phase 2); only Phase 2
restores.

## Not covered / deferred (see `cross-tenant-catalog.md` for the full per-op reasons)

- **27 `blocked`** — upstream 500 (List Chats, Get Call PCI Data, Email Call, Preview Alert Log, Get Alert Notification old, Get Report By Template, List Client Heartbeats, Save completed QAs, Email QA), missing id (Chats ×9, Suppress QA), console broken (Delete Custom Role, Delete User, Get Alert Trigger Operators, Get Custom Role), multipart (Generate QA PDF/Excel), standing hold (Submit Call Redaction Request), or KNOWN BUG that masks the signal (Update Agent).
- **5 `destructive`** — Batch Expire Calls, Reassign Calls, Delete Client/Server Heartbeat, Delete Site — no disposable fixture / blast radius too large.
- **11 `n/a`** — customer-level objects with no per-site dimension: Update Company/SSO Settings, Add/Delete IP Whitelist, Delete Report Template, Add Site, Add/Update/Delete Tag, Add/Update User.
- **`Delete *` cross-site** (agent, agent group, call note, extension, notification rule, alert config) — driven with `destructiveIfLeaked: true` + `verifyIntact`; a LEAK is a hard fail and the disposable is re-created/cleaned under site A.
