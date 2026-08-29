# Developer Portal / API Management — Full Evidence Investigation (2026-08-29)

Complete evidence package for every known Developer Portal / API Management
issue on **staging** (`atmossystemsstaging.callcabinet.com` → portal
`developer1-portal.callcabinet.com` → gateway `developer1.callcabinet.com`).

- **Account**: `romana@callcabinet.com` · **Company**: CC Test 1 (`98f086b0-8d0e-4ba8-8f01-870466740b1c`)
- **Subscription key**: `Primary: API_test` · **Key site during the run**: `UA team recording` (`8cc22cd2-a4b7-46c5-b907-9050e110dac5`)
- **Tests branch / commit**: `feature/chat-listing` @ `ed251c2`
- **Method**: each finding driven through the real "Try this operation" console (or the main app), with a **context-level network listener** capturing every gateway request/response verbatim (subscription-key header redacted) → `raw/<ID>.json`. One report per finding under the numbered folders. `--workers=1` throughout; `--trace on`.
- **Harness**: `tests/dev-portal/_evidence.ts` (capture + report builder), `evidence-*.spec.ts` (the investigation specs). Kept alongside the regression suite; each finding maps to an existing or proposed regression test, a documented `test.skip`, or a re-runnable investigation spec — not all are `KNOWN BUG` regressions (NOT REPRODUCED items, suspected-scoping, destructive exclusions and multipart-console blockers are documented differently).

> **Note on the raw capture**: `ApiOperationPage.send()` fires the Send click via a forced-click-then-raw-DOM fallback; when the forced click exceeds its 5 s bound but still registers, the request goes out twice, with an identical response. `writeRaw` collapses **consecutive** identical sends, so most double-fires are already removed from `raw/*.json`; a duplicate pair separated by other calls can still appear. The reports select the final matching response. Physical de-duplication of non-consecutive pairs was **not** performed.

---

## 1. Deliverable answers

| # | Question | Answer |
|--:|---|---|
| 1 | Total known issues investigated | **23** primary investigation findings (20 from the brief + 3 new, below). The §2 summary matrix has **30 rows** — it additionally breaks out derived blockers (Chats ×9, QA Suppress, QA PDF/Excel), the environment blocker, the suspected-scoping group, and the destructive-not-run group as their own rows. |
| 2 | Confirmed **backend** bugs | **14** distinct findings — Update Agent (400), Get Custom Role (ignores roleId), Save completed QAs (no persist), List Chats (500 / SiteId injection), Get Call PCI Data (500), Email Call (500), Get Report By Template (500 NRE), Preview Alert Log (500), Get Alert Notification-old (500 NRE), Create Agent Group (id:0 + empty-agentJson no-op), Add IP Whitelist / Create Custom Role (500-not-400 — counted as **one** paired finding), List Extensions `equals` (500), List Retention Policies `SiteID` filter (500), Manual Redaction submit (missing-timing-field hang — CONFIRMED historically; whole-endpoint-not-responding this run — PARTIAL). *(14 distinct findings even with the paired one counted once.)* |
| 3 | Confirmed **security / tenant-isolation** bugs | **1** — Restricted User Management: **List/Get cross-site exposure historically CONFIRMED** (2026-08-27 controlled run — a key scoped to site B read the full record of, and enumerated, a user bound to site A). **Update isolation UNVERIFIED** — cross-site `Update Restricted User Access` was never executed, and the fresh re-run is blocked by the environment (account lost CC Test 1 access). See §5. |
| 4 | Confirmed **console/UI** bugs | **4** — Delete User "Send" fires nothing; Delete Custom Role console never leaves "Loading…"; Get Alert Trigger Operators sends the literal `{id}` (CONFIRMED console defect; backend behaviour without `{id}` unverified); schema-blind "Add body" ships `Content-Type: text/plain` (intermittent). |
| 5 | **Contract / documentation** bugs | **2 confirmed** — Update Tag name is silently restricted to alphanumeric+spaces (rejects `- _ . ( )`, undocumented); `Get`/`List Agent` responses return `customerId: 00000000-…` not the real id. **1 historical, NOT REPRODUCED** — Update Agent Group full-record replace (omitting `isActive` deactivated the group in 2026-08-28; not reproduced this run, though the Update *response body* still reported `isActive:false` while persistence stayed `true` — see the report). |
| 6 | **Suspected** scoping findings | **4** endpoints — List Notification Rules, List Alert Events, List Report Templates, List Server Heartbeats — unchanged across a site switch; intent unconfirmed. See §6. |
| 7 | **Blocked** operations | **16** — Chats ×9 (no chatId), QA Suppress (no completed-QA id), QA Generate PDF/Excel (multipart not buildable in console), Batch Expire Calls / Reassign Calls / Delete Client Heartbeat / Delete Server Heartbeat (destructive, no disposable fixture). Full dependency graphs: `05-blockers/`. |
| 8 | Problems **not reproduced** | **3** — Create Extension own-site 500 (3/3 succeeded this run); Update Agent Group full-replace deactivation (isActive preserved this run); List Calls 500 (routes without `/api/` but returns 200 — the functional break is gone, the routing inconsistency remains → P2). |
| 9 | Problems whose **classification changed** | Update Agent — scope widened from "freshly-created agents" to **every agent** (a pre-existing agent with an extension also 400s). List Calls — 500 → routing inconsistency only (P1 → P2). List Extensions `equals` — "SiteName-specific" → **operator-wide** (any field). Update Tag validation — "parentheses" → **also `-`, `_`, `.`**, and `Add Tag` enforces it too. Manual Redaction — "hangs when a timing field is omitted" (CONFIRMED, historical) → **plus** a possible whole-endpoint outage this run (a valid control also hung), but one of three variants produced no captured POST, so "whole endpoint not responding" is **PARTIAL** evidence, not confirmed. |
| 10 | **New findings / diagnostic discoveries** | (a) `GET settings/agents/{id}` and `POST settings/agents/list` return `customerId: 00000000-0000-0000-0000-000000000000` (contract bug in its own right; also causes Update Agent's 500-NRE mode). (b) `POST calls/chats/list` with `{}` also fails `take` validation — the console defaults `take:10000` > server max 500. (c) *Diagnostic detail on an already-known defect:* Add IP Whitelist vs Create Custom Role missing-field 500s have **different** server causes (NRE vs EF save error) — not a separate new product problem. |
| 11 | **Evidence gaps** still remaining | Restricted User Management: cross-site **Update** isolation (never executed — only List/Get confirmed) and cross-**customer** exposure (needs a 2nd customer's known id); fresh re-run blocked by the environment. Whether the main app's own routes for Update Agent / Save QAs / Delete User behave differently. Whether Manual Redaction's control hang this run is a transient whole-endpoint outage or a regression (needs re-run on a fresh call+window when healthy — user asked to pause Manual Redaction); the missing-timing-field hang itself is confirmed. Backend behaviour of Get Alert Trigger Operators **without** `{id}` (console defect confirmed; direct-backend leg not run). Whether populated `criteriaParams` change Get Report By Template (2026-08-28 said no). Product intent for the 4 suspected scoping endpoints. |
| 12 | Recommended **P0 / P1 / P2** order | **P0**: Restricted User site scoping — List/Get cross-site read (security; Update isolation still to verify) → Update Agent (whole op dead) → Save completed QAs (silent data loss) → List Chats (blocks 10 ops). **P1**: Manual Redaction (missing-field hang confirmed; possible whole-endpoint outage — verify) → Get Report By Template / Preview Alert Log / Get Alert Notification-old / Get Call PCI Data / Email Call (500s) → Get Custom Role (ignores id) → Create Agent Group (id:0) → List Extensions `equals` / List Retention `SiteID` (filter 500s) → Delete User console → `customerId` zero-GUID contract bug → Add IP Whitelist / Create Custom Role 500-not-400. **P2**: Delete Custom Role / Get Alert Trigger Operators / Content-Type console bugs → Update Tag validation docs → List Calls `/api/` routing → suspected scoping (needs triage) → test-infra: replace hardcoded `KNOWN.siteId`. |
| 13 | Regression tests to add / change | See §7. |
| 14 | Artifact paths | See §8 (every raw file, report, trace, screenshot). |

---

## 2. Summary matrix

| ID | Group | Operation | Classification | Status | Repro | HTTP | Chain complete? | Evidence complete? | Regression exists? | Severity |
|---|---|---|---|---|---|---|---|---|---|---|
| P0-UPDATE-AGENT | Agent Management | Update Agent (+ Get/List Agent customerId) | CONFIRMED BACKEND BUG | CONFIRMED | 4/4 (mode1) | POST | yes | yes | yes | P0 |
| P0-GET-CUSTOM-ROLE | Role Management | Get Custom Role | CONFIRMED BACKEND BUG | CONFIRMED | 5/5 | GET | yes | yes | yes | P0 |
| P0-SAVE-COMPLETED-QAS | QA | Save completed QAs | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | POST | yes | yes | yes | P0 |
| P0-LIST-CHATS | Chats | List Chats (+ 9 blocked) | CONFIRMED BACKEND BUG / BLOCKER | CONFIRMED | 6/6 | POST | yes | yes | yes | P0 |
| P0-RESTRICTED-USER-SCOPING | Restricted User Management | List + Get Restricted User Access (cross-site read); Update isolation UNVERIFIED | SECURITY / TENANT ISOLATION | List/Get cross-site exposure CONFIRMED 2026-08-27; Update UNVERIFIED; fresh re-run blocked by environment | List/Get 1/1 (2026-08-27) · Update 0/0 · 0/1 (2026-08-29 blocked) | GET/POST (Update PUT not run) | List/Get yes; Update no | partial | proposed | P0 |
| P1-GET-CALL-PCI-DATA | Calls | Get Call PCI Data | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | GET | yes | yes | yes | P1 |
| P1-EMAIL-CALL | Calls | Email Call | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | POST | yes | yes | yes | P1 |
| P1-GET-REPORT-BY-TEMPLATE | Reports | Get Report By Template | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | POST | yes | yes | yes | P1 |
| P1-PREVIEW-ALERT-LOG | Notifications | Preview Alert Log | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | POST | yes | yes | yes | P1 |
| P1-GET-ALERT-NOTIFICATION-OLD | Notifications | Get Alert Notification (old) | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | GET | yes | yes | yes | P1 |
| P1-CREATE-AGENT-GROUP-ID-ZERO | Group Management | Create Agent Group | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 (each case) | POST | yes | yes | yes | P1 |
| P1-NEGATIVE-500S | IP Whitelist / Role Management | Add IP Whitelist / Create Custom Role | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 each | POST | yes | yes | yes | P1 |
| P1-LIST-EXTENSIONS-EQUALS-FILTER | Extension Management | List Extensions (equals operator) | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 equals, 4/4 eq/contains | POST | yes | yes | proposed | P1 |
| P1-LIST-RETENTION-SITEID-FILTER | Retention Management | List Retention Policies (SiteID filter) | CONFIRMED BACKEND BUG | CONFIRMED | 5/5 | POST | yes | yes | proposed | P1 |
| P1-MANUAL-REDACTION-HANG | Manual Redaction | Submit Call Redaction Request | CONFIRMED (missing-timing-field hang, historical) / PARTIAL (whole-endpoint not responding, this run) | hang CONFIRMED; endpoint-dead PARTIAL | 2/3 POST fired + hung (~30s, no status); 1/3 no POST captured | POST | yes | partial | yes | P1 |
| P1-CREATE-EXTENSION-OWN-SITE | Extension Management | Create Extension (own site) | NOT REPRODUCED | NOT REPRODUCED | 0/3 | POST | yes | yes | partial | P1 |
| P1-DELETE-USER-SEND | User Management | Delete User (console Send) | CONSOLE/UI BUG | CONFIRMED | 3/3 | POST | yes | yes | yes | P1 |
| ENV-SITE-ASSIGNMENT | (infra) | account lost CC Test 1 membership/access (primary blocker) + subscription-key site-assignment hardcode risk + AlreadyLoggedInModal misclassifies the Select-Company screen (separate harness bug) | INFRASTRUCTURE/ENVIRONMENT | CONFIRMED (blocker) | 1/1 | — | yes | yes | proposed | P1 |
| CONTRACT-AGENT-CUSTOMERID | Agent Management | Get Agent / List Agents | CONTRACT/DOC BUG | CONFIRMED | 1/1 | GET/POST | yes | yes | proposed | P1 |
| CONSOLE-DELETE-CUSTOM-ROLE | Role Management | Delete Custom Role (console) | CONSOLE/UI BUG | CONFIRMED (7/7, 3 runs) | 7/7 | — | yes | yes | yes | P2 |
| CONSOLE-GET-ALERT-TRIGGER-OPERATORS | Notifications | Get Alert Trigger Operators (console) | CONSOLE/UI BUG | CONFIRMED CONSOLE DEFECT / backend behavior unverified | 1/1 console | GET | yes | partial | yes | P2 |
| CONSOLE-CONTENT-TYPE | Calls | Update Multiple Call Tags (console Content-Type) | CONSOLE/UI BUG (intermittent) | CONFIRMED (prior sessions) | intermittent | PUT | yes | partial | yes | P2 |
| CONTRACT-UPDATE-TAG-VALIDATION | Tag Management | Update Tag / Add Tag (name validation) | CONTRACT/DOC BUG | CONFIRMED | 1/1 each variant | POST | yes | yes | proposed | P2 |
| P1-LIST-CALLS-ROUTE (raw label; severity is P2) | Calls | List Calls | ROUTING INCONSISTENCY (missing /api/, but 200) | historic 500 NOT REPRODUCED; routing inconsistency stands | 1/1 (200) | POST | yes | yes | re-check Bug 1 | P2 |
| CONTRACT-UPDATE-AGENT-GROUP-FULLREPLACE | Group Management | Update Agent Group | CONTRACT/DOC BUG | NOT REPRODUCED (was 2026-08-28) | 0/1 | POST | yes | yes | yes | P2 |
| SUSPECTED-SCOPING-GAPS | Notifications / Reports / Heartbeats | List Notification Rules / Alert Events / Report Templates / Server Heartbeats | SUSPECTED SCOPING GAP | SUSPECTED (blocked re-run; prior 3-switch data) | 3-switch prior · 0/1 (2026-08-29 blocked) | POST/GET | yes | partial | exists (NOT_SITE_SCOPED) | P2 |
| BLOCKED-CHATS-9 | Chats | 9 chat operations (Add/Get/Update/Delete Chat Note, Download Chat, Get Chat Details/Message Notes/Messages, Send Chat Email) | BLOCKED BY UPSTREAM BUG | BLOCKED | n/a | — | dependency graph | yes | test.skip | P0 (via List Chats) |
| BLOCKED-QA-SUPPRESS | QA | Suppress QA | BLOCKED BY UPSTREAM BUG | BLOCKED | n/a | POST | dependency graph | yes | test.skip | P1 (via Save QAs) |
| BLOCKED-QA-PDF-EXCEL | QA | Generate QA PDF / Excel | BLOCKED (console cannot build multipart) | BLOCKED | n/a | POST | doc | yes | test.skip | P2 |
| DESTRUCTIVE-NOT-RUN | Calls / Heartbeats | Batch Expire Calls, Reassign Calls, Delete Client/Server Heartbeat | DESTRUCTIVE — NOT EXECUTED | doc only | n/a | — | doc | yes | test.skip | P2 |

Legend — Status: CONFIRMED / PARTIAL / PROBABLE / CONFIRMED CONSOLE DEFECT (backend unverified) / CONTRACT ISSUE / SUSPECTED / BLOCKED / NOT REPRODUCED / FIXED / INCONCLUSIVE. ("CONSOLE-ONLY" is used only once a direct-backend contrast has proven the backend is fine.)

---

## 3. Finding / report pointers — one line per report

### 3a. Confirmed backend bugs

| Report | Endpoint | Actual |
|---|---|---|
| `01-backend-bugs/BUG-update-agent-site-scoping.md` | `POST settings/agents/update` | 400 "Configured site does not contain selected agent or extension" for an agent on the key's own site (any agent). + 500 NRE when replaying the Get body because Get returns `customerId: 0000…` |
| `01-backend-bugs/BUG-get-custom-role-ignores-roleid.md` | `GET settings/custom-roles/{roleId}` | 200 but returns a fixed unrelated "Restricted User" system role for any id (real or bogus); returned id ≠ requested id |
| `01-backend-bugs/BUG-save-completed-qas-not-persisted.md` | `POST qc/Quality/SaveCompletedForm` | 201, then `List Completed Qas` empty + `hasAnsweredForms` false, immediately and after 5 s |
| `05-blockers/BLOCKER-list-chats-500.md` | `POST calls/chats/list` | 500 on all 6 body variants; server appends `SiteId` filter at index `<client-filter-count>`; chat-search validator has no `SiteId`; NRE when no `filter` key |
| `01-backend-bugs/BUG-get-call-pci-data-500.md` | `GET media/call-details/call-pci` | 500 (empty body) for a valid own-site call; Get Call Info → 200 for the same id |
| `01-backend-bugs/BUG-email-call-500.md` | `POST calls/email/` | 500 (empty body) with all 5 required fields, own-address recipient |
| `01-backend-bugs/BUG-get-report-by-template-500.md` | `POST reports/reports/get-report-chart` | 500 NRE with real template id 145 + all 9 required fields + valid date range |
| `01-backend-bugs/BUG-preview-alert-log-500.md` | `POST settings/alerts/preview-log` | 500 (downstream `Internal Server Error`) with the same trigger/window shape Upsert Alert Configuration accepts; empty triggers too |
| `01-backend-bugs/BUG-get-alert-notification-old-500.md` | `GET settings/alerts/old/{notificationId}` | 500 NRE for a real freshly-created id (proven via non-legacy `Get Alert Configuration` → 200); bogus id too |
| `01-backend-bugs/BUG-create-agent-group-id-zero.md` | `POST settings/agent-groups` | 200 with `id: 0` always; empty `agentJson:"[]"` → 200 but never appears in List (silent no-op) |
| `01-backend-bugs/BUG-negative-missing-field-500.md` | `POST settings/ip-whitelist`, `POST settings/custom-roles` | 500 (NRE / EF save error) instead of 400 when a required field is omitted; valid body → 200 |
| `01-backend-bugs/BUG-list-extensions-equals-operator-500.md` | `POST settings/extensions/list` | `filter.operator:"equals"` → 500 (empty body) on any field; `eq`/`contains` → 200 |
| `01-backend-bugs/BUG-list-retention-siteid-filter-500.md` | `POST settings/retention/list` | any `SiteID`/`siteID`/`SiteId`/`siteId` filter → 500, own site id and another site id alike; unfiltered → 200 |
| `01-backend-bugs/BUG-manual-redaction-hang.md` | `POST calls/post-redaction/{callId}` | missing-timing-field hang CONFIRMED (historical). This run: 2/3 variants — OPTIONS 200 then POST fired → `net::ERR_ABORTED` at ~30 s, no HTTP status (valid control included); 3rd variant — no POST captured. Whole-endpoint outage = PARTIAL evidence. |

### 3b. Checks / contract findings / not reproduced — **not backend bugs**

| Report | Endpoint | Actual |
|---|---|---|
| `01-backend-bugs/CONTRACT-update-tag-name-validation.md` | `POST settings/tags/update` | CONTRACT/DOC — rejects `( ) - _ .` in `name` (400 "Alphanumeric characters and spaces allowed only"); `Add Tag` enforces it too; undocumented |
| `01-backend-bugs/CONTRACT-update-agent-group-full-replace.md` | `POST settings/agent-groups/update` | **NOT REPRODUCED** this run — omitting `isActive` did not deactivate persistence (did in 2026-08-28); the Update *response body* still reported `isActive:false` while List stayed `true` (response-vs-persistence mismatch, kept as an observation) |
| `01-backend-bugs/CHECK-create-extension-own-site.md` | `POST settings/extensions` | **NOT REPRODUCED** — 3/3 own-site creates → 200; cross-site → 400. Watch item. |
| `01-backend-bugs/CHECK-list-calls-route.md` | `POST calls/calls/search` | **ROUTING INCONSISTENCY (P2)** — routes to `…/calls/calls/search/` **without `/api/`** (unlike every other endpoint) but returns **200**; the historic 500 functional break is not reproduced |

---

## 4. Console / UI bugs

Consolidated: `03-console-ui/CONSOLE-RACE-REPORT.md`. Individual: `03-console-ui/BUG-delete-user-send-inert.md`.

---

## 5. Security — Restricted User Management site scoping

`02-security-site-scoping/BUG-restricted-user-no-site-scoping.md`. Chain: bind a restricted user to site A (via `Update Restricted User Access`) → switch the key's site to B → re-read the same user id under B.

**Status**: **List/Get cross-site exposure historically CONFIRMED** — the 2026-08-27 controlled run bound a fresh restricted user to site A, switched the key to site B, and `Get Restricted User` returned the full byte-identical record + `List Restricted Accesses` still enumerated it (and the whole ~100-row list was byte-identical across the two site assignments). **Cross-site `Update Restricted User Access` was never executed** — Update isolation is **UNVERIFIED** (expected to be broken too, given List/Get, but not proven). The 2026-08-29 fresh re-run is **blocked** — the account lost CC Test 1 access (§ENV). Cross-**customer** exposure is also unverified (DTO has no `customerId`).

---

## 6. Suspected per-site scoping gaps

`04-suspected-scoping/SCOPING-suspected-gaps.md` — List Notification Rules / List Alert Events / List Report Templates / List Server Heartbeats, before vs after one site switch.

---

## 7. Regression tests — add / change

> Not every finding is a `KNOWN BUG` regression: NOT REPRODUCED items (Create Extension own-site, Update Agent Group full-replace), suspected-scoping, destructive exclusions and multipart-console blockers are covered by a documented `test.skip`, a `NOT_SITE_SCOPED` set entry, or just the re-runnable `evidence-*.spec.ts`.

**Already pinned (keep as `KNOWN BUG` until fixed):** Update Agent 400 (`agent-management-api`), Get Custom Role ignores roleId (`role-management-api`), Delete Custom Role console (`role-management-api`), Save completed QAs / Email QA (`qa-api`), List Chats 500 (`chats-api`), Get Call PCI Data / Email Call (`calls-api`), Get Report By Template (`reports-api`), Preview Alert Log / Get Alert Notification-old / Get Alert Trigger Operators (`notifications-api`), Delete User Send inert (`user-management-api`), Add IP Whitelist / Create Custom Role 500 / Submit Call Redaction hang (`negative-required-fields-staging`), Content-Type text/plain (`tenant-scoping-bugs` Bug 3), Extension/Retention cross-tenant writes (`tenant-isolation-negative-writes-staging`).

**Add:**
1. `agent-management-api` — assert mode-2 (replay Get body) → 500 NRE; assert `Get`/`List Agent` return `customerId === "00000000-…"` (KNOWN BUG).
2. `agent-management-api` — `Update Agent` on a **pre-existing** agent → 400 (widen the existing test's scope note).
3. `group-management-api` — assert Create Agent Group response `id === 0`; assert empty-`agentJson` create is absent from List.
4. `extension-management-api` — `List Extensions` `{operator:"equals"}` → 500; `{operator:"eq"}` → 200 (KNOWN BUG).
5. `retention-management-api` — `List Retention Policies` `SiteID` eq filter → 500; unfiltered → 200 (KNOWN BUG).
6. `negative-required-fields-staging` (or a validation suite) — Update Tag with `(`/`-`/`_`/`.` → 400.
7. `tenant-isolation-*` — a new "restricted-user" negative phase: bind to site A, switch to B, assert `Get Restricted User` and `List Restricted Accesses` do **not** return the user, and `Update Restricted User Access` → 400. Currently `List`/`Get` cross-site read is confirmed to succeed (→ the test documents the bug); the cross-site `Update` assertion is **new/unverified** — it has never been run.
8. **Test infra** — replace every hardcoded `KNOWN.siteId` in `calls-api` / `qa-api` / `retention-management-api` / `manual-redaction-api` / `notifications-api` / `reports-api` / `extension-management-api` with a live `currentSiteId(portal)` read; add an `afterAll` in the tenant suite that restores the key's site.

→ **2026-08-30 — items 5–8 done + cross-tenant coverage reorganised into a systematic 127-op matrix (UNVERIFIED, `npx tsc --noEmit` green, nothing run live):**
   - `_helpers.ts` gained `currentKeySite` / `currentSiteId` / `firstOwnSiteCall` / `firstOwnSiteCallId` / `assignedTagId`; the 7 `*-api.spec.ts` migrated off the site-bound `KNOWN.*` constants to live per-run reads; key-site restore added to `tenant-isolation-staging.spec.ts` + `tenant-isolation-negative-writes-staging.spec.ts` Phase 2 (`finally`, not `afterAll` — hooks can't take `page`).
   - **Cross-tenant matrix** — `cross-tenant-catalog.ts` (127 ops classified: read 53 · write 31 · blocked 27 · destructive 5 · n/a 11) + `cross-tenant-plans.ts` (84 executable Read/Write plans, payloads lifted from `*-api.spec.ts` / ADO 37288 / evidence) + `_cross-tenant.ts` engine (one A→B→back switch, per-op try/catch, verdicts `OK/LEAK/SUSPECTED/HYPOTHESIS-FAIL/ERROR/SKIP`) + `cross-tenant-matrix.spec.ts` (`npm run test:cross-tenant-matrix`; one named `test.skip` per non-driven op). §7 items 1 (restricted-user, as read+write `hypothesis`) and the earlier "extend write checks to Calls/Reports/MR/Groups" are folded in. The two point specs from the first pass were deleted (subsumed). Human render: `tests/dev-portal/cross-tenant-catalog.md` (`npm run gen:cross-tenant-catalog`).
   - **Negative-required-fields matrix** (item 6, generalised) — `_negative-fields.ts` engine (control → per-field omission → `finally` cleanup) + `negative-fields-catalog.ts` (11 create-from-body ops; 26 required-field rows: 5 confirmed `400`, 2 `known-bug-500` = Add IP Whitelist / Create Custom Role, 5 `hypothesis-400`, 13 `needs-schema-confirmation`, 1 `special`) + `negative-required-fields-matrix.spec.ts` (`npm run test:negative-fields-matrix`; named skips for the 7 excluded — Add User, Manual Redaction, all Update/Delete ops, retention/settings updates). `known-bug-500` rows go RED (`FIXED-FLIP-ME`) if the endpoint starts returning 400. Old `negative-required-fields-staging.spec.ts` retained for Add User + Manual Redaction.
   - **Boundary-values matrix** (follow-up item 1) — same shared engine (`runFieldProbeMatrix`); `boundary-fields-catalog.ts` (13 specs, 54 probe rows — `empty-string`/`whitespace`/`null`/`bad-guid`/`zero-guid`/`out-of-range`/`negative`/`wrong-type`/`bad-format`/`bad-json`; 1 confirmed `'400'` = Add Tag non-alphanumeric name, 1 `special` = Create Agent Group `agentJson:"[]"`, rest `hypothesis-*` / `needs-schema-confirmation`; `bad-date` + over-length deferred) + `boundary-values-matrix.spec.ts` (`npm run test:boundary-matrix`).
   - **Response-contract matrix** (follow-up item 2) — `_contract-checks.ts` engine (invoke-with-valid-request = control → per-assertion structure/type checks → `finally` cleanup; dotted paths incl. `[].x` per array element) + `contract-checks-catalog.ts` (8 ops, 23 assertions: 15 `'ok'`, 3 `'known-bug'`, 4 `'hypothesis'`, 1 `'needs-schema-confirmation'`) + `contract-checks-matrix.spec.ts` (`npm run test:contract-matrix`). Pins the two confirmed contract bugs of this class: **`customerId` = all-zero GUID** on Get/List Agent (CONTRACT-AGENT-CUSTOMERID) and **`id` = 0** on Create Agent Group (P1-CREATE-AGENT-GROUP-ID-ZERO) — each `expect:'known-bug'`, `OK` while present, `FIXED-FLIP-ME` when fixed; with Create Agent + List Agent Groups as the `expect:'ok'` contrast (their `customerId` IS real).
   - **Authorization matrix** (follow-up item 3 — first coverage of this class) — `_auth-checks.ts` engine over modes `valid` / `unscoped-own-key` (`Primary: 1` — CONFIRMED blanket-500, `expect:'known-bug'`) / `garbage-key-header` (junk `Ocp-Apim-Subscription-Key` — `expect:'hypothesis-reject'`; a `2xx` → hard `AUTH-BYPASS`) + `auth-checks-catalog.ts` (4 read-only ops, 2 customer-level + 2 site-scoped) + `auth-checks-matrix.spec.ts` (`npm run test:auth-matrix`). Deferred (named skips): true `no-key` (console always has a key), `foreign-tenant-key` (no 2nd customer key), `expired-key` (none exists).
   - **Idempotency & retries matrix** (follow-up item 4) — `_idempotency-checks.ts` engine reusing the confirmed create-op bases + `idempotency-checks-catalog.ts` (10 ops; 9 `double-create` + 8 `delete-deleted` + 8 `update-nonexistent`) + `idempotency-checks-matrix.spec.ts` (`npm run test:idempotency-matrix`). All expectations `hypothesis` (nothing CONFIRMED for this class); soft-flags the likely-bug shapes — `STALE-5XX` (5xx on delete-deleted / update-nonexistent — NRE class), `PHANTOM-WRITE` (2xx updating a nonexistent id), `DUP-SILENT`. Excludes Create Custom Role (Delete console broken), Update Agent (confirmed 400 bug), and Create Agent Group's double/delete (id:0 bug).
   - Full first-run guidance + known plan weak spots (all matrices): **`tests/dev-portal/UNVERIFIED.md`**.

**Re-check / possibly remove:** `tenant-scoping-bugs` Bug 1 (List Calls 500) — did not reproduce; List Calls returns 200 (routes without `/api/`). Update to assert the routing inconsistency, or drop.

---

## 8. Artifact index

- **Reports**: `01-backend-bugs/*.md`, `02-security-site-scoping/*.md`, `03-console-ui/*.md`, `04-suspected-scoping/*.md`, `05-blockers/*.md`, `06-environment/*.md`
- **Raw request/response captures** (gateway API calls only; **consecutive** Send-double-fire pairs collapsed — non-consecutive duplicates may remain, reports read the final matching response; bodies capped at 8 KB): `raw/*.json`
- **Playwright traces + failure screenshots**: `test-results/dev-portal-evidence-*/` (per test — `trace.zip`, `test-failed-*.png`, `error-context.md`). View with `npx playwright show-trace <path>`.
- **The investigation specs** (re-runnable): `tests/dev-portal/evidence-p0.spec.ts`, `evidence-batch2.spec.ts`, `evidence-batch3.spec.ts`, `evidence-batch4.spec.ts`, `evidence-console.spec.ts`, `evidence-security.spec.ts`. Run: `npx playwright test tests/dev-portal/evidence-*.spec.ts --project=chromium --workers=1 --trace on`.
