# Developer Portal / API Management — MASTER findings report (2026-08-29)

Single consolidated document: every finding with its inline request→response
proof (from `raw/*.json`), Expected vs Actual, ruled-out alternatives,
downstream impact, and pointers to the full per-finding report + raw capture.

**Read this file top-to-bottom.** For the status matrix, P0/P1/P2 order and
the 14 deliverable answers see `00-summary.md`.

---

## Environment (identical for every finding unless noted)

```
app:              https://atmossystemsstaging.callcabinet.com     (TWO "s" — "systems staging")
developer portal: https://developer1-portal.callcabinet.com
gateway:          https://developer1.callcabinet.com
company:          CC Test 1        (98f086b0-8d0e-4ba8-8f01-870466740b1c)
account:          romana@callcabinet.com   (.env `user` / `adminpass`)
subscription key: Primary: API_test
key site:         UA team recording (8cc22cd2-a4b7-46c5-b907-9050e110dac5)  — read live via Get Sites Storage Usage at each batch start, 09:31–10:24 UTC
git:              feature/chat-listing @ ed251c2
```

Every batch's `precondition` (in each `raw/*.json`) records `company = CC Test 1`
+ that site. **No 401/403/"not allowed for current subscription" appears in
any captured response** — the account had valid CC Test 1 + key access
throughout the captures. (It was removed from CC Test 1 **after** 10:24, before
the console/security specs could run — see §22.)

> **Raw-capture note**: `ApiOperationPage.send()` fires "Send" via a
> forced-click-then-raw-DOM fallback; when the forced click exceeds its 5 s
> bound but still registers, the request goes out **twice** — identical
> response each time. `writeRaw` collapses **consecutive** identical sends, so
> most double-fires are already removed from `raw/*.json`; a duplicate pair
> separated by other calls can still appear. The reports select the final
> matching response. Non-consecutive pairs were **not** physically de-duplicated.
> A duplicate row is this double-fire, not a product retry.

---

# PART A — CONFIRMED BACKEND BUGS

---

## 1. Update Agent — 400 for any agent on the key's own site (+ a 2nd contract bug)

- **ID** P0-UPDATE-AGENT · **Classification** CONFIRMED BACKEND BUG · **Severity** P0 (`Update Agent` is unusable)
- **Endpoint** `POST settings/agents/update` (ADO 37298) · **Reports** `01-backend-bugs/BUG-update-agent-site-scoping.md` · **Raw** `raw/P0-UPDATE-AGENT.json`

### Proof (chain, verbatim from raw)

```
1  POST /api/settings/agents/list/                → 200   (20 agents, all siteId 8cc22cd2-… "UA team recording")
2  POST /api/settings/agents/
     REQ {"firstName":"AQA","lastName":"evidence updbug …","siteId":"8cc22cd2-…","customerId":"98f086b0-…", …}
                                                  → 200   RES {"id":"d04e84fa-11d7-456b-835a-6e14bf3b76de","siteId":"8cc22cd2-…","customerId":"98f086b0-…", …}
3  GET  /api/settings/get-agents/d04e84fa-…       → 200   RES {"id":"d04e84fa-…","site":"UA team recording","siteId":"8cc22cd2-…","customerId":"00000000-0000-0000-0000-000000000000", …}
4  POST /api/settings/agents/update/   (mode 1 — clean DTO + id, only `notes` changed, same siteId)
                                                  → 400   RES "Configured site does not contain selected agent or extension."
5  POST /api/settings/agents/update/   (mode 2 — body = the step-3 Get response, only `notes` changed)
                                                  → 500   RES {"StatusCode":500,"Description":"Object reference not set to an instance of an object.", …ApiException}
6  GET  /api/settings/get-agents/d04e84fa-…       → 200   (agent still present, unchanged, after both failed updates)
7  POST /api/settings/agents/update/   (CONTROL — a PRE-EXISTING agent ef93c7a0-… "Mykyta Kviatkovskyi", hadExtension=true, same siteId)
                                                  → 400   RES "Configured site does not contain selected agent or extension."
8  DELETE /api/settings/delete-agents/d04e84fa-…  → 204
```

### Expected vs Actual
- **Expected**: step 4 → 200, agent updated. The agent was just created on this exact `siteId`, `Get Agent` confirms it, and the same DTO is accepted by `Create Agent`.
- **Actual**: step 4 → **400** site-scoping rejection. Step 5 → **500 NRE**. Step 7 (a pre-existing agent, with an extension) → **400** — so the bug is **not limited to freshly-created agents; `Update Agent` is broken for every agent.**

### Second bug found in the same chain — `customerId` zero-GUID
`GET settings/agents/{id}` and `POST settings/agents/list` return
`customerId: "00000000-0000-0000-0000-000000000000"` — **not** the real
customer id (`Create Agent`'s response returns the real `98f086b0-…`). This
is why the natural read→modify→write flow (mode 2) 500s: the update path
dereferences a null customer.

### Alternatives ruled out
| Hypothesis | Verdict |
|---|---|
| wrong `siteId` | ruled out — create-req = create-resp = get-resp `siteId` = the key's live site (`8cc22cd2-…`), all four identical |
| stale key-site assignment | ruled out — `siteId` sourced live from an existing agent **and** `Get Sites Storage Usage` → same site |
| agent not persisted / invisible | ruled out — `Get Agent` → 200 with the full DTO both before and after the failed updates |
| wrong body / missing field | ruled out — identical DTO accepted by `Create Agent`; mode 2 uses the exact Get body |
| console/request never fired | ruled out — raw capture: `POST /api/settings/agents/update/` fired, real 400/500 body, 269 ms / 811 ms |
| only freshly-created agents affected | **ruled out** — pre-existing agent `ef93c7a0-…` (with an extension) also 400s |

### Downstream impact
`Update Agent` cannot be used. Any partner integration that edits an agent
(name, site, groups, extensions, screenshot settings, notes) is blocked. The
read-then-write pattern additionally 500s because Get/List omit the real
`customerId`.

### Regression
`agent-management-api.spec.ts` › *"Update Agent — KNOWN BUG regression"* pins
mode 1 (400 + message + evidence attachment). **Add**: assert mode 2 → 500 NRE;
assert `Get`/`List Agent` return `customerId === "00000000-…"`.

### Suggested ticket
`POST settings/agents/update` 400s *"Configured site does not contain selected
agent or extension."* for an agent on the caller's own site (any agent, incl.
pre-existing with an extension). Create + Get confirm the agent is on that
site; Update's site/agent check disagrees. Separately, `GET
settings/agents/{id}` returns a zero-GUID `customerId`, which makes a
read-then-write update 500 with a NullReferenceException.

---

## 2. Get Custom Role — ignores its `roleId` path parameter

- **ID** P0-GET-CUSTOM-ROLE · **Classification** CONFIRMED BACKEND BUG · **Severity** P0
- **Endpoint** `GET settings/custom-roles/{roleId}` (ADO 37611) · **Report** `01-backend-bugs/BUG-get-custom-role-ignores-roleid.md` · **Raw** `raw/P0-GET-CUSTOM-ROLE.json`

### Proof

```
1  POST /api/settings/custom-roles/                 REQ {"name":"AQA evidence role 1787995956290"}
                                                    → 200  RES {"id":"dfa8ea02-7921-4ca4-bab1-3c5f0572261c","name":"AQA evidence role …","customerId":"00000000-…"}
2  POST /api/settings/custom-roles/list/            → 200  (the created role IS present in the list)
3  GET  /api/settings/get-custom-roles/dfa8ea02-…   → 200  RES {"id":"a7b39308-c4e8-4fe4-8a44-bca1810eb3b1","name":"Restricted User","locked":true, …}
4  GET  /api/settings/get-custom-roles/dfa8ea02-…   → 200  RES {"id":"bb4209df-…","name":"Restricted User", …}
5  GET  /api/settings/get-custom-roles/dfa8ea02-…   → 200  RES {"id":"370aae69-…","name":"Restricted User", …}
6  GET  /api/settings/get-custom-roles/11111111-1111-1111-1111-111111111111   (bogus GUID)
                                                    → 200  RES {"id":"d30a720d-…","name":"Restricted User", …}
7  GET  /api/settings/get-custom-roles/11111111-…   → 200  RES {"id":"77946e4b-…","name":"Restricted User", …}
```

### Expected vs Actual
- **Expected**: the role for `{roleId}` (name `AQA evidence role …`), or `404` for the bogus GUID.
- **Actual**: **every** call (real id ×3, bogus GUID ×2) returns `200` with `name: "Restricted User"` — a fixed locked system role. The `roleId` in the URL path (captured) **never** matches the returned `id`; the returned `id` even **differs between identical calls** (`a7b39308` / `bb4209df` / `370aae69`), consistent with an unfiltered / non-deterministic query (missing `WHERE id = @roleId`).

### Alternatives ruled out
invalid id (role confirmed present in List, step 2) · console didn't attach the param (URL path contains the `roleId` — raw) · flaky (5/5 fresh opens) · existing-data ambiguity (unique AQA name).

### Downstream impact
Reading a specific custom role by id is impossible via this endpoint (verify
after create/update, render permissions, audit). Callers must use `List Custom
Roles` + client-side filter.

### Regression
`role-management-api.spec.ts` › *"Create Custom Role → Get Custom Role (KNOWN
BUG: ignores roleId)"* pins 200 + shape. **Strengthen**: assert `returnedId !==
requestedRoleId`.

---

## 3. Save completed QAs — returns 201 but never persists

- **ID** P0-SAVE-COMPLETED-QAS · **Classification** CONFIRMED BACKEND BUG · **Severity** P0 (silent data loss; blocks Suppress QA)
- **Endpoint** `POST qc/Quality/SaveCompletedForm` (ADO 37564) · **Report** `01-backend-bugs/BUG-save-completed-qas-not-persisted.md` · **Raw** `raw/P0-SAVE-COMPLETED-QAS.json`

### Proof

```
1  GET  /api/qc/Quality/GetForms/?callId=d71ac345-…     → 200  (form id 776 "Postman test evaluation", not archived)
2  POST /api/qc/Quality/SaveCompletedForm/
     REQ {"id":776,"callId":"d71ac345-…","questions":[],"sections":[],"notes":"AQA-EVIDENCE-1787997735831"}
                                                         → 201  RES {"resultMessage":null,"doesOriginalFormChanged":true,"lastLog":null}
3  GET  /api/qc/Quality/GetAnsweredForms/?callId=d71ac345-…   → 200  RES []        (immediately)
4  GET  /api/calls/details/d71ac345-…?qcRando=false           → 200  model.hasAnsweredForms = false
   … wait 5 s …
5  GET  /api/qc/Quality/GetAnsweredForms/?callId=d71ac345-…   → 200  RES []        (after 5 s)
6  GET  /api/calls/details/d71ac345-…?qcRando=false           → 200  model.hasAnsweredForms = false
```

### Expected vs Actual
- **Expected**: after `201`, the evaluation is readable via `List Completed Qas` and `model.hasAnsweredForms` becomes `true`.
- **Actual**: `201` with `doesOriginalFormChanged: true`, but **zero** state change — `GetAnsweredForms` empty and `hasAnsweredForms` false, immediately and after a 5 s delay.

### Alternatives ruled out
write failed (2xx) · eventual consistency (still absent after 5 s) · wrong callId/form (form 776 from `GetForms` for this exact call; call is the known own-site call) · List filters it out (the call's own `hasAnsweredForms` flag also stays false).

### Downstream impact
`Suppress QA` is untestable/unusable — no real completed-QA id can ever be
produced through the API. Partner workflows submitting completed evaluations
lose them silently.

### Regression — `qa-api.spec.ts` › *"KNOWN BUG — Save completed QAs returns 201 but never actually persists"*. Keep.

---

## 4. List Chats — always 500; server injects a `SiteId` filter its own validator rejects; blocks 9 operations

- **ID** P0-LIST-CHATS · **Classification** CONFIRMED BACKEND BUG / BLOCKER · **Severity** P0
- **Endpoint** `POST calls/chats/list` · **Report** `05-blockers/BLOCKER-list-chats-500.md` · **Raw** `raw/P0-LIST-CHATS.json`

### Proof — 6 body variants, all 500

```
POST /api/calls/chats/list/   {}
   → 500  ...BadRequest {"detail":[
            {"type":"less_than_equal","loc":["body","take"],"msg":"Input should be <= 500","input":10000,"ctx":{"le":500}},   ← console defaults take:10000 > server max 500
            {"type":"literal_error","loc":["body","filter","filters",2,"field"],"msg":"Input should be 'ChatId','ChatName',…,'IsInternalChat'","input":"SiteId",…}]}

POST /api/calls/chats/list/   {"skip":0,"take":25,"sort":[],"filter":{"logic":"and","filters":[]}}          (0 client filters)
   → 500  ...{"loc":["body","filter","filters",0,"field"],"input":"SiteId",…}                              ← server injected at index 0

POST /api/calls/chats/list/   {…"filter":{"filters":[{StartTime gte},{StartTime lte}]}…}                    (2 client filters, idx 0 & 1)
   → 500  ...{"loc":["body","filter","filters",2,"field"],"input":"SiteId",…}                              ← server injected at index 2 (one past the client's filters)

POST /api/calls/chats/list/   {…"filter":{"filters":[{StartTime gte},{EndTime lte}]}…}                      (2 client filters)
   → 500  ...{"loc":["body","filter","filters",2,"field"],"input":"SiteId",…}

POST /api/calls/chats/list/   {"skip":0,"take":5}            (no `filter` key)   → 500  "Object reference not set to an instance of an object."
POST /api/calls/chats/list/   {"skip":0,"take":25,"sort":[]} (no `filter` key)  → 500  "Object reference not set to an instance of an object."
```

### Proof of the injection
Client sends **N** filters → the validation error names `filters[N].field = "SiteId"`. N=0 → index 0; N=2 → index 2. **The server appends the `SiteId` filter itself**, at the end of the client's list. The chat-search validator's allowed field enum is `ChatId, ChatName, StartTime, EndTime, DateTime, RecordingId, CallType, ChatType, Participants, Number, Agent, Extension, IsInternalChat` — **no `SiteId`**. With no `filter` key at all → NRE (the injection code dereferences `filter.filters` on null).

### Alternatives ruled out
client sent a `SiteId` filter (none did; index tracks the client count) · body shape / pagination (6 shapes all 500) · console-only artifact (**not re-verified this session** — the main-app repro leg was interrupted; **confirmed in prior sessions**: the app's `/ChatListing` page's own `POST /api/calls/chats/list` fails identically) · wrong environment (`developer1`).

### Downstream impact (dependency graph)
`List Chats` is the **only** source of a `chatId` (API and main app). Blocked: **Add / Get / Update / Delete Chat Note, Download Chat, Get Chat Details, Get Chat Message Notes, Get Chat Messages, Send Chat Email** — 9 operations unreachable.

### Regression — `chats-api.spec.ts` › *"KNOWN BUG — List Chats always 500s"* + 9 `test.skip`. Keep.

---

## 5. Get Call PCI Data — always 500 for a valid own-site call

- **ID** P1-GET-CALL-PCI-DATA · **Endpoint** `GET media/call-details/call-pci` · **Report** `01-backend-bugs/BUG-get-call-pci-data-500.md` · **Raw** `raw/P1-500S.json`

```
GET /api/calls/details/d71ac345-…?qcRando=false                        → 200   (call is valid, own site, model.id = d71ac345-…)
GET /api/media/call-details/call-pci/?callId=d71ac345-…                → 500   (empty body)
GET /api/media/call-details/call-pci/?callId=00000000-0000-4000-8000-000000000000  (bogus)  → 500
```
**Expected** 200 with PCI metadata (or empty). **Actual** 500, no body, for a call `Get Call Info` returns 200 for. Ruled out: call invalid (Get Call Info → 200), "no PCI data = empty 200" (status is 500), request never fired (raw: GET fired → 500, 503 ms).

---

## 6. Email Call — always 500 with a schema-correct body

- **ID** P1-EMAIL-CALL · **Endpoint** `POST calls/email/` · **Report** `01-backend-bugs/BUG-email-call-500.md` · **Raw** `raw/P1-500S.json`

```
POST /api/calls/email/
   REQ {"mails":["romana@callcabinet.com"],"callId":"d71ac345-…","subject":"AQA evidence test","text":"AQA evidence - ignore","callIds":["d71ac345-…"]}
   → 500   (empty body)
```
All 5 documented required fields present; recipient is the test account's own address. Ruled out: missing field · invalid recipient · call invalid. **Actual** 500. **Impact** emailing a call recording via the API is impossible.

---

## 7. Get Report By Template — always 500 (NRE) with a real template + valid inputs

- **ID** P1-GET-REPORT-BY-TEMPLATE · **Endpoint** `POST reports/reports/get-report-chart` · **Report** `01-backend-bugs/BUG-get-report-by-template-500.md` · **Raw** `raw/P1-500S.json`

```
GET  /api/reports/reports/get-report-templates/     → 200   (199 templates; picked id 145 "Call Duration /By day/LastMonth")
POST /api/reports/reports/get-report-chart/
   REQ {"id":145,"templateId":145,"criteriaId":1,"timeZone":-12,"startString":"2026-08-01T00:00:00Z","endString":"2026-08-29T23:59:59Z","criteriaParams":[],"agentParams":[],"extensionParams":[]}
   → 500   {"StatusCode":500,"Description":"Object reference not set to an instance of an object.", …ApiException}
```
All 9 documented required fields present; template id from `List Report Templates`; valid date range. Ruled out: invalid template id · missing field · request never fired. 2026-08-28 also tried populated `criteriaParams` — same 500.

---

## 8. Preview Alert Log — always 500 (body shape valid — same shape succeeds in Upsert)

- **ID** P1-PREVIEW-ALERT-LOG · **Endpoint** `POST settings/alerts/preview-log` · **Report** `01-backend-bugs/BUG-preview-alert-log-500.md` · **Raw** `raw/P1-500S.json`

```
POST /api/settings/alerts/                          → 200   RES "Successfully inserted Notification Config '570'"      ← proves the trigger/window shape is VALID
GET  /api/settings/get-alerts/570                   → 200   (config 570 persisted, full triggers)
POST /api/settings/alerts/preview-log/
   REQ {"notificationTypeId":7,"windowType":"interaction","windowValue":1,"triggers":[{…same shape…}],"filters":[]}
   → 500   {"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}", …}
POST /api/settings/alerts/preview-log/   (triggers:[])   → 500   (same)
DELETE /api/settings/alerts/570  (cleanup)          → 200
```
**Expected** 200 with the historical events that would have triggered the rule. **Actual** 500 (populated + empty triggers) — the same `notificationTypeId`/`windowType`/`windowValue`/`triggers` shape is accepted by `Upsert Alert Configuration`.

---

## 9. Get Alert Notification (old) — always 500 (NRE) for a real freshly-created id

- **ID** P1-GET-ALERT-NOTIFICATION-OLD · **Endpoint** `GET settings/alerts/old/{notificationId}` · **Report** `01-backend-bugs/BUG-get-alert-notification-old-500.md` · **Raw** `raw/P1-500S.json`

```
POST /api/settings/alerts/            → 200   (config 570)
GET  /api/settings/get-alerts/570     → 200   (the NON-legacy endpoint — proves id 570 is real)
GET  /api/settings/alerts/old/570     → 500   {"Description":"Object reference not set to an instance of an object.", …ApiException}
GET  /api/settings/alerts/old/1       → 500   (bogus id — identical NRE)
```
**Expected** 200 (or 404 for the bogus id). **Actual** 500 NRE for a real id and a bogus id alike. **Workaround** use `GET settings/alerts/{notificationId}` (non-legacy) — works.

---

## 10. Create Agent Group — returns `id: 0`; empty `agentJson` is a silent no-op

- **ID** P1-CREATE-AGENT-GROUP-ID-ZERO · **Endpoint** `POST settings/agent-groups` · **Report** `01-backend-bugs/BUG-create-agent-group-id-zero.md` · **Raw** `raw/P1-CREATE-AGENT-GROUP-ID-ZERO.json`

```
CASE A — agentJson with a real agent id
POST /api/settings/agent-groups/     REQ {"customerId":"98f086b0-…","name":"AQA evidence group A …","isActive":true,"agentJson":"[\"b276c869-…\"]"}
                                     → 200   RES {"id":0,"name":"AQA evidence group A …","agents":["b276c869-…"], …}     ← id:0
POST /api/settings/agent-groups/list/   → 200   the group IS present, real id = 1016
GET  /api/settings/get-agent-groups/1016 → 200   RES {"id":1016,"agentJson":"[\"B276C869-…\"]", …}                      ← agentJson UPPERCASED (vs create's lowercase)
DELETE /api/settings/delete-agent-groups/1016 → 200

CASE B — empty agentJson
POST /api/settings/agent-groups/     REQ {"customerId":"98f086b0-…","name":"AQA evidence group B …","isActive":true,"agentJson":"[]"}
                                     → 200   RES {"id":0,"agents":[], …}
POST /api/settings/agent-groups/list/   → 200   the group is NOT in the list → silent no-op
```
**Expected** the real generated id in the response; empty `agentJson` → an empty group or a 400. **Actual** `id: 0` always (case A persists as 1016, learnable only via `List`); case B persists nothing. **Bonus** Get returns `agentJson` uppercased.

---

## 11. Add IP Whitelist / Create Custom Role — 500 (not 400) on a missing required field

- **ID** P1-NEGATIVE-500S · **Report** `01-backend-bugs/BUG-negative-missing-field-500.md` · **Raw** `raw/P1-NEGATIVE-500S.json`

```
POST /api/settings/ip-whitelist/     {}                          → 500   {"Description":"Object reference not set to an instance of an object.", …}     ← NRE
POST /api/settings/ip-whitelist/     {"ipAddress":"203.0.113.49"} → 200   {"id":1526,"customerId":null,"ipAddress":"203.0.113.49"}                       ← endpoint works; customerId null
POST /api/settings/ip-whitelist/delete/   {"id":1526,"ipAddress":"203.0.113.49"} → 200

POST /api/settings/custom-roles/     {}                           → 500   {"Description":"An error occurred while saving the entity changes. See the inner exception for details.", …}   ← EF save error (DIFFERENT cause)
POST /api/settings/custom-roles/     {"name":"AQA evidence role neg …"} → 200   {"id":"c730305a-…","customerId":"00000000-…"}                            ← endpoint works; customerId zero-GUID
```
**Expected** 400 with a field-level message. **Actual** 500 — **and the two have different server causes**: Add IP Whitelist → NullReferenceException, Create Custom Role → EF `SaveChanges` error. Both work with a valid body.

### Regression — `negative-required-fields-staging.spec.ts` › *"KNOWN BUG — Add IP Whitelist 500s …"* + *"KNOWN BUG — Create Custom Role 500s …"*. Keep.

---

## 12. Submit Call Redaction Request — POST fires, server never responds (client aborts ~30 s)

- **ID** P1-MANUAL-REDACTION-HANG · **Endpoint** `POST calls/post-redaction/{callId}` · **Report** `01-backend-bugs/BUG-manual-redaction-hang.md` · **Raw** `raw/P1-MANUAL-REDACTION-HANG.json`
- **Classification** — split:
  - **CONFIRMED (historical)**: the endpoint hangs (no response, client aborts ~30 s) when a timing field is omitted. Reproduced 2026-08-28 and this run.
  - **PARTIAL / UNVERIFIED (this run)**: "the whole endpoint is not responding to any request". A fully-valid control also hung — but only 2 of 3 variants had a **captured** POST that fired then aborted; the 3rd (omit-end) produced no captured POST, so it is not proven every POST reached the backend. A transient whole-endpoint outage fits but is not confirmed.
- ⚠️ **Per the user's request, Manual Redaction was NOT re-tested after this — no further requests were sent.**

### Proof (this run — 2/3 variants: captured POST fired then aborted; 1/3: no captured POST)

```
OPTIONS /api/calls/post-redaction/d71ac345-…   → 200   (preflight OK — auth is fine)
POST    /api/calls/post-redaction/d71ac345-…
   REQ {"callId":"d71ac345-…","entityTypeId":1,"startMilliseconds":47961,"endMilliseconds":50961,"requestText":"AQA evidence control"}   ← FULLY VALID body
   → (no response)   net::ERR_ABORTED after 29990 ms, HTTP status = null     ← captured POST

OPTIONS /api/calls/post-redaction/d71ac345-…   → 200
POST    /api/calls/post-redaction/d71ac345-…
   REQ {"callId":"d71ac345-…","entityTypeId":1,"endMilliseconds":67961,"requestText":"AQA evidence omit-start"}   ← startMilliseconds omitted
   → (no response)   net::ERR_ABORTED after 29973 ms, HTTP status = null      ← captured POST

(omit-end variant)  OPTIONS captured 200; NO POST captured — client timed out ~30 s before/around the send
```

### Expected vs Actual
- **Expected**: a valid body → `200 "Successfully created redaction request"` (as it returned earlier the same day in `manual-redaction-api.spec.ts`); a missing timing field → a prompt `400`.
- **Actual**: OPTIONS preflight succeeds (200); for the 2 variants with a captured POST, the server returns nothing and the connection is aborted client-side at ~30 s (incl. the fully-valid control). The omit-end variant timed out with no captured POST. Missing-timing-field hang matches 2026-08-28; the valid-control hang is new this run and unconfirmed as a permanent state.

### Alternatives — ruled out vs NOT ruled out
| Hypothesis | Verdict |
|---|---|
| request never left the browser | **ruled out for 2/3** — raw: `OPTIONS` 200 then a real `POST` that ends `net::ERR_ABORTED` at ~30 s, `status: null`. Omit-end: no captured POST — inconclusive for that leg. |
| callId / entityTypeId invalid | weak — same callId returned 200 elsewhere earlier today; the control hung, so "invalid input" is not the cause |
| duplicate call+time-window (submitted earlier today) | **NOT ruled out** — many redaction requests were submitted for this call across today's runs; the backend may hang (rather than 400) on a repeat window. Needs an isolated re-check on a fresh call+window. |
| transient staging outage of this endpoint | **NOT ruled out** — the valid control hanging is consistent with a transient backend/downstream outage this run, distinct from the CONFIRMED "hangs when timing fields omitted" bug. |

### Downstream impact
When it hangs (omitted timing field — CONFIRMED): a request ties up a connection for the full client timeout with no error. If the whole endpoint is down (as possibly this run): Manual Redaction submission is entirely unusable — but that state is not confirmed permanent.

### Regression — `negative-required-fields-staging.spec.ts` › *"KNOWN BUG — Submit Call Redaction Request hangs indefinitely …"* (`.rejects.toThrow(/Timeout/)`). Keep. Consider a separate health-check that fails distinctly on a full-endpoint outage.

---

## 13. List Extensions — the `equals` filter operator 500s on any field

- **ID** P1-LIST-EXTENSIONS-EQUALS-FILTER · **Endpoint** `POST settings/extensions/list` · **Report** `01-backend-bugs/BUG-list-extensions-equals-operator-500.md` · **Raw** `raw/P1-LIST-EXTENSIONS-EQUALS-FILTER.json`

```
POST /api/settings/extensions/list/?showDeleted=false   {filter:[]}                                     → 200   (baseline)
   filter {field:"Name",     operator:"eq",       value:"UA team extension"}                            → 200
   filter {field:"Name",     operator:"contains",  value:"UA "}                                          → 200
   filter {field:"Name",     operator:"equals",    value:"UA team extension"}                            → 500   {}       ← empty body, no detail
   filter {field:"SiteName", operator:"eq",       value:"UA team recording"}                            → 200
   filter {field:"SiteName", operator:"equals",    value:"UA team recording"}                            → 500   {}
   filter {field:"SiteName", operator:"contains",  value:"UA "}                                          → 200
```
**Verdict — operator-wide.** `equals` → 500 on **both** `Name` and `SiteName`; `eq` / `contains` → 200 on both. Ruled out: SiteName-field-specific (`Name equals` also 500s) · bad value (same value works with `eq`). The console's own canned example for this operation uses `operator:"equals"` → a copy-paste user gets an opaque 500.

### Regression (proposed) — add: `List Extensions` `{operator:"equals"}` → 500; `{operator:"eq"}` → 200.

---

## 14. List Retention Policies — any `SiteID`/`siteId` filter → 500 (casing- and value-independent)

- **ID** P1-LIST-RETENTION-SITEID-FILTER · **Endpoint** `POST settings/retention/list` · **Report** `01-backend-bugs/BUG-list-retention-siteid-filter-500.md` · **Raw** `raw/P1-LIST-RETENTION-SITEID-FILTER.json`

```
POST /api/settings/retention/list/   {}                                                                    → 200   (baseline)
   filter {field:"SiteID", operator:"eq", value:"8cc22cd2-…"}   (own site)                                 → 500
   filter {field:"siteID", operator:"eq", value:"8cc22cd2-…"}                                              → 500
   filter {field:"SiteId", operator:"eq", value:"8cc22cd2-…"}                                              → 500
   filter {field:"siteId", operator:"eq", value:"8cc22cd2-…"}                                              → 500
   filter {field:"SiteID", operator:"eq", value:"39e0cb7f-…"}   (another site)                             → 500
```
**Verdict — casing- and value-independent.** All 4 casings + own/other site id → 500; unfiltered → 200. Ruled out: wrong casing · bad value · unfiltered list also broken.

### Regression (proposed) — add: `List Retention Policies` with a `SiteID` eq filter → 500; unfiltered → 200.

---

# PART B — CONTRACT / DOCUMENTATION

---

## 15. Update Tag — `name` silently restricted to alphanumeric + spaces (undocumented; broader than "parentheses")

- **ID** P1-UPDATE-TAG-VALIDATION · **Endpoint** `POST settings/tags/update` (+ `POST settings/tags`) · **Report** `01-backend-bugs/CONTRACT-update-tag-name-validation.md` · **Raw** `raw/P1-UPDATE-TAG-VALIDATION.json`

```
POST /api/settings/tags/          {"name":"AQA evidence tag …"}                    → 200   (baseline tag created, id f9c7ebd8-…)
POST /api/settings/tags/update/   {"id":…,"name":"AQA tag … ok"}   (alphanumeric+spaces)   → 200
POST /api/settings/tags/update/   {"id":…,"name":"AQA tag … (x)"}  (parentheses)           → 400   {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]}, …RFC9110, traceId}
POST /api/settings/tags/update/   {"id":…,"name":"AQA-tag-…"}      (hyphen)                 → 400   (same)
POST /api/settings/tags/update/   {"id":…,"name":"AQA_tag_…"}      (underscore)             → 400   (same)
POST /api/settings/tags/update/   {"id":…,"name":"AQA tag ….v2"}   (period)                 → 400   (same)
POST /api/settings/tags/          {"name":"AQA add (paren) …"}     (Add Tag w/ parentheses) → 400   (same — Add Tag enforces it too)
POST /api/settings/tags/{tagId}   (cleanup)                        → 200
```
**Finding is broader than the 2026-08-28 note**: not just parentheses — **`-`, `_`, `.` are all rejected**; only alphanumeric + spaces pass; and `Add Tag` enforces the same rule. Undocumented in the operation's schema/description.

### Regression (proposed) — add a validation case: Update Tag with `-`/`_`/`.`/`(` → 400 "Alphanumeric characters and spaces allowed only".

---

## 16. `Get Agent` / `List Agents` return a zero-GUID `customerId`

- **ID** CONTRACT-AGENT-CUSTOMERID · Discovered inside §1. `GET settings/agents/{id}` and `POST settings/agents/list` return `customerId: "00000000-0000-0000-0000-000000000000"`; `POST settings/agents` (create) returns the real `98f086b0-…`. Causes the read-then-write 500 (§1 mode 2). The same zero-GUID also appears on `Create Custom Role`'s response body (§11) and `Add IP Whitelist` returns `customerId: null`.

---

## 17. Update Agent Group — full-record replace (omitting `isActive`) — NOT REPRODUCED this run

- **ID** CONTRACT-UPDATE-AGENT-GROUP-FULLREPLACE · **Endpoint** `POST settings/agent-groups/update` · **Report** `01-backend-bugs/CONTRACT-update-agent-group-full-replace.md` · **Raw** `raw/P1-UPDATE-AGENT-GROUP-FULLREPLACE.json`

```
create group (isActive:true) → List → isActive BEFORE = true
POST /api/settings/agent-groups/update/   {id, customerId, name, agentJson}   (isActive OMITTED)
   → 200   RES {... "isActive":false ...}      ← response body claims deactivation
List → isActive AFTER = true                    ← persisted record NOT deactivated this run
```
**2026-08-28** the same omission set the **persisted** `isActive` to `false`. **This run** persistence stayed `true`. Classification **NOT REPRODUCED** — either the behaviour changed, was fixed, or is non-deterministic.

**Preserved observation** — the Update **response body** still reported `"isActive":false` while `List` shows `true`: a response-vs-persistence mismatch. Possibly a harmless response-serialisation artifact (response defaults `isActive` when the request omits it; persistence leaves it alone), but a caller trusting the response would believe the group was deactivated. This is the likely place a regression would resurface. `group-management-api.spec.ts` › *"Update Agent Group"* already sends `isActive:true` explicitly.

---

# PART C — CONSOLE / UI

Full consolidated write-up: **`03-console-ui/CONSOLE-RACE-REPORT.md`**. Summary:

## 18. Delete User — "Send" fires no network request

- **ID** P1-DELETE-USER-SEND · **Report** `03-console-ui/BUG-delete-user-send-inert.md` · **Raw** `raw/P1-DELETE-USER-SEND.json`

```
POST /api/settings/users/           → 200   (Add User — real request fired, userId 545fdb55-…)
GET  /api/settings/users/{userId}   → 200   (Get User — real request fired, returns userRId)
Delete User → click "Send" ×3 fresh attempts → settings/users/delete calls fired = [0, 0, 0]     ← NO OPTIONS, NO POST
```
**Ruled out**: params not attached (request preview shows `POST .../users/delete/?userId=…&userRId=…`), Send disabled/duplicate (2026-08-28), dead session (Add/Get fire in it), the schema race (console renders fully — Send visible, params fillable — the click just no-ops). `user-management-api.spec.ts` asserts `.rejects.toThrow(/Timeout/)`.

## 19. Delete Custom Role — Try-it console never renders a Send button

- **ID** CONSOLE-DELETE-CUSTOM-ROLE · **7/7** console-open attempts across 3 `role-management-api.spec.ts` runs (2026-08-29), incl. an isolated `Create → Delete` test. Drawer stays on `progressbar "Loading…"` — no Parameters section, no Send button, ever. Sibling ops (`List`/`Create Custom Role`, other `Delete {id}` ops) render fine. The `openConsole(..., {retries})` wrapper does **not** help. `role-management-api.spec.ts` › *"KNOWN BUG — Delete Custom Role: Try-it console never finishes loading"* asserts `sendButtonRendered === false`.
- **Evidence gap**: the dedicated `evidence-console.spec.ts` re-run on 2026-08-29 afternoon was blocked at login (§22).

## 20. Get Alert Trigger Operators — console sends the literal `{id}` (CONFIRMED console defect; backend unverified)

- **ID** CONSOLE-GET-ALERT-TRIGGER-OPERATORS · **Classification: CONFIRMED CONSOLE DEFECT / backend behaviour unverified.** The console bakes literal `?id={id}` into the URL, renders no fillable field, "Add parameter" adds a *separate* param. Every send → `400 {"errors":{"id":["The value '{id}' is not valid."]}}`. The `id` query param is documented **optional**. Pinned by `notifications-api.spec.ts` KNOWN BUG test.
- **Evidence gap**: the direct-backend contrast (`fetch` without `id` → should succeed → would confirm console-only) could not run this session (§22). Not asserted as CONSOLE-ONLY until that leg runs.

## 21. Schema-blind "Add body" ships `Content-Type: text/plain` → 415

- **ID** CONSOLE-CONTENT-TYPE · When the OpenAPI schema fetch loses the render race, "Add body" produces a JSON payload but the request goes out with `Content-Type: text/plain;charset=UTF-8` → `415`. Adding `Content-Type: application/json` manually → the same body succeeds. The only thing that changes between fail and pass is the header the console constructs. Pinned by `tenant-scoping-bugs.spec.ts` › Bug 3. Intermittent; not re-captured this session (§22).

---

# PART D — SECURITY / SITE SCOPING (List/Get carried on prior-session data; Update never tested; re-run blocked)

## 22. Restricted User Management — List/Get not site-scoped (cross-site read CONFIRMED historically); Update isolation UNVERIFIED

- **ID** P0-RESTRICTED-USER-SCOPING · **Report** `02-security-site-scoping/BUG-restricted-user-no-site-scoping.md`
- **Classification** SECURITY / TENANT ISOLATION:
  - **`List Restricted Accesses` + `Get Restricted User` cross-site read** — CONFIRMED on the 2026-08-27 controlled site-switch run. Not re-verified 2026-08-29 (blocked).
  - **`Update Restricted User Access` cross-site write** — **UNVERIFIED** — never executed cross-site in any session. Expected broken too (given List/Get), but that is an assumption.

### The blocker
`evidence-console.spec.ts` and `evidence-security.spec.ts` (2026-08-29 afternoon)
all failed in `stagingLogin` → `LoginPage.completeLogin` → `AlreadyLoggedInModal.logOutOtherSession()`
→ `logOutOtherSessionButton.click()` (300 s timeout). **The page snapshot at
failure shows the "Select your default company" screen** with options
`1Test_Dev_UA_Svitlana_Company_3`, `Charl_Test`, `Roman_QA_TEST` — **CC Test 1
is NOT in the list.** The account `romana@callcabinet.com` **has been removed
from CC Test 1** (very likely a spam mitigation from the volume of Manual
Redaction + create/delete calls across the day). Every dev-portal test needs
CC Test 1 + its `Primary: API_test` key → **all blocked** until access is
restored.

### The finding (2026-08-27 controlled run — full chain in the report)
```
Key on site A (Analytics Synthetic Data, 39e0cb7f-…):
  PUT  settings/restricted-access/access/   {userId:2f6e7fd3-…, siteIds:["39e0cb7f-…"]}   → 200
  GET  settings/restricted-access/2f6e7fd3-…                                              → 200   sites = ["Analytics Synthetic Data"]   ← bound to site A
--- switch key's site A → B (UA team recording, 8cc22cd2-…) ---
  GET  settings/restricted-access/2f6e7fd3-…                                              → 200   FULL record, byte-identical   ← readable from the WRONG site
  POST settings/restricted-access/list   (filtered by email)                             → 200   record present               ← listed from the WRONG site
```
The 2026-08-27 cross-site comparison also showed the **entire** ~100-row `List
Restricted Accesses` result returning **byte-for-byte identical, same order**
for two different site assignments of the same key — i.e. the result is
*completely independent* of the key's site.

**Expected** cross-site → blocked (404/400/204), like Calls/Reports/Manual
Redaction/Extension/Retention (`400 "Configured site does not contain
selected …"`). **Actual** `Get` and `list` are fully readable from any site;
`Update` cross-site was **not tested** (expected to be affected too, unproven).

**Impact** a key scoped to one site can enumerate and read the full record of
restricted users belonging to *other* sites of the same customer. Whether it
can also **modify** their access grants cross-site is **unverified**.
Cross-**customer** exposure not confirmed (DTO has no `customerId`).

### To finish — re-run `tests/dev-portal/evidence-security.spec.ts` once `romana@callcabinet.com` is back in CC Test 1.

---

# PART E — SUSPECTED SCOPING GAPS (carried on prior data — re-run blocked)

## 23. List Notification Rules / List Alert Events / List Report Templates / List Server Heartbeats

- **ID** SUSPECTED-SCOPING-GAPS · **Report** `04-suspected-scoping/SCOPING-suspected-gaps.md` · **Classification** SUSPECTED SCOPING GAP (product intent unconfirmed)

Across 3 independent site switches (2026-08-29 ninth session), all four return
**identical** results before/after — while every *confirmed* site-scoped
endpoint re-scoped in the same runs (`List Extensions` 1→13, `List Agents`
1→17, `List Agent Groups` []→1, `List Retention Policies` re-scoped).

- `List Notification Rules` — `Add Notification Rule` exposes a `siteIds` field → plausibly *should* be site-filtered.
- `List Server Heartbeats` — already a documented customer-scoped-but-not-site-scoped gap.
- `List Alert Events`, `List Report Templates` — unchanged; intent unclear.

**Not a bug until product confirms each *should* be site-scoped.** Currently
listed in `tenant-isolation-staging.spec.ts`'s `NOT_SITE_SCOPED` set with
"unconfirmed, not ruled out" comments so the suite stays green.

---

# PART F — NOT REPRODUCED / ROUTING

## 24. Create Extension for the key's own site — NOT REPRODUCED

- **ID** P1-CREATE-EXTENSION-OWN-SITE · **Report** `01-backend-bugs/CHECK-create-extension-own-site.md` · **Raw** `raw/P1-CREATE-EXTENSION-OWN-SITE.json`

```
POST /api/settings/extensions   {name:"AQA evidence ext own …-0", siteId:"8cc22cd2-…"}   → 200   "fd13db15-7545-4668-aeca-8974c21cb391"
POST /api/settings/extensions   {name:"…-1", siteId:"8cc22cd2-…"}                          → 200   "b6830306-a6a3-4351-9fde-0462196ea480"
POST /api/settings/extensions   {name:"…-2", siteId:"8cc22cd2-…"}                          → 200   "0a0f1da1-0ede-4d29-8f1b-4d1718ba5263"
POST /api/settings/extensions   {name:"AQA evidence ext cross …", siteId:"39e0cb7f-…"}     → 400   "Configured site does not contain selected extension."     ← cross-site rejection works
+ 3× DELETE /api/settings/... (cleanup) → 200
```
The 2026-08-29 write-path session's own-site 500 (*"An error occurred while
saving the entity changes"*) **did not recur** — 3/3 succeeded. Cross-site
rejection is enforced. **Watch item** — the intermittent 500 may still recur.

## 25. List Calls — routes without the `/api/` prefix, but returns 200

- **ID** P1-LIST-CALLS-ROUTE · **Report** `01-backend-bugs/CHECK-list-calls-route.md` · **Raw** `raw/P1-LIST-CALLS-ROUTE.json`

```
GET  https://developer1.callcabinet.com/api/calls/details/d71ac345-…?qcRando=false     → 200     ← every WORKING Calls endpoint uses /api/
POST https://developer1.callcabinet.com/calls/calls/search/                            → 200     ← List Calls: NO /api/ prefix, but 200 with real calls
     REQ {"skip":0,"take":25,"sort":[],"filter":{"logic":"and","filters":[]}}
     RES [{"Id":"d61ac345-…","StampStartTime":"2026-08-25T13:07:32Z", …}]
```
The documented `tenant-scoping-bugs.spec.ts` › Bug 1 ("List Calls 500s / missing `/api/`") **did not reproduce as a 500** — the prefix-less route now works. Downgraded to a **routing inconsistency (P2)**: List Calls is the only Calls endpoint published without `/api/`. Re-check / update Bug 1.

---

# PART G — BLOCKED & DESTRUCTIVE (documentation only)

Full dependency graphs + fixture requirements: **`05-blockers/BLOCKERS-and-destructive.md`**.

- **Chats ×9** — no `chatId` obtainable (§4). `test.skip` in `chats-api.spec.ts`.
- **QA Suppress QA** — no completed-QA id (§3 never persists). `test.skip` in `qa-api.spec.ts`.
- **QA Generate QA PDF / Excel** — require `multipart/form-data`; the Try-it console only offers Raw/Binary. `test.skip` in `qa-api.spec.ts`.
- **Batch Expire Calls / Reassign Calls / Delete Client Heartbeat / Delete Server Heartbeat** — destructive, no disposable fixture; **not executed**. `test.skip` in `calls-api.spec.ts` / `heartbeats-api.spec.ts`. Fixture requirements documented.

---

# PART H — NEW FINDINGS / DIAGNOSTIC DISCOVERIES (not in the original brief)

*New product findings:*
1. **`customerId: 00000000-…`** in `Get Agent` / `List Agents` responses (§16) — a contract bug in its own right that also causes §1's mode-2 500. Zero-GUID / null `customerId` also on `Create Custom Role` and `Add IP Whitelist` responses.
2. **`take: 10000 > 500`** — the console defaults `take` to 10000 for `List Chats`, exceeding the server's max of 500 (surfaces in §4's `{}` variant error).

*Diagnostic detail on already-known defects (not separate new problems):*
3. **Different 500 causes for the two negative-field bugs** (§11) — Add IP Whitelist → NullReferenceException; Create Custom Role → EF `SaveChanges` error. Refines the existing "500-not-400" finding.
4. **`agentJson` casing flips** — `Create Agent Group` accepts lowercase GUIDs, `Get Agent Group` returns them UPPERCASED (§10). Observed alongside the existing `id:0` finding.

---

# PART I — CLASSIFICATION CHANGES vs the brief

| Item | Was | Now |
|---|---|---|
| Update Agent 400 | "rejects freshly-created agent" | **every agent** — a pre-existing agent with an extension also 400s (§1) |
| List Calls | "500 + missing `/api/`" | **routes without `/api/` but returns 200** — routing inconsistency only, P1 → P2 (§25) |
| List Extensions `equals` 500 | "SiteName-specific" | **operator-wide** — `equals` 500s on any field (§13) |
| Update Tag validation | "rejects parentheses" | **also `-`, `_`, `.`**; `Add Tag` enforces it too (§15) |
| Manual Redaction | "hangs when a timing field is omitted" (CONFIRMED, kept) | **plus** a possible whole-endpoint outage this run — the valid control also hung, but 1/3 variants had no captured POST → "whole endpoint not responding" is **PARTIAL** evidence, not confirmed; transient-vs-permanent unresolved (§12) |
| Create Extension own-site 500 | "intermittent 500" | **NOT REPRODUCED** — 3/3 succeeded (§24) |
| Update Agent Group full-replace | CONFIRMED (2026-08-28) | **NOT REPRODUCED** — persisted `isActive` preserved; but the Update *response body* still reported `isActive:false` (response-vs-persistence mismatch, kept as an observation) (§17) |
| Restricted User scoping | "List/Get/Update not site-scoped" | **List/Get cross-site read CONFIRMED** (2026-08-27); **Update isolation UNVERIFIED** — never tested cross-site (§22) |
| Get Alert Trigger Operators | "CONSOLE-ONLY" | **CONFIRMED CONSOLE DEFECT / backend behaviour unverified** — direct-backend leg not run (§20) |

---

# PART J — RECOMMENDED PRIORITY

**P0** — §22 Restricted User scoping — List/Get cross-site read (security; Update isolation still to verify) · §1 Update Agent (whole op dead) · §3 Save completed QAs (silent data loss) · §4 List Chats (blocks 10 ops)
**P1** — §12 Manual Redaction (missing-field hang confirmed; possible whole-endpoint outage — verify) · §7/§8/§9/§5/§6 500s · §2 Get Custom Role · §10 Create Agent Group id:0 · §13/§14 filter 500s · §18 Delete User console · §16 `customerId` zero-GUID · §11 negative-field 500s
**P2** — §19/§20/§21 console bugs · §15 Update Tag validation docs · §25 List Calls `/api/` routing · §23 suspected scoping (triage) · test-infra: replace hardcoded `KNOWN.siteId` (§ENV)

---

# PART K — ARTIFACT INDEX

```
artifacts/dev-portal-evidence-2026-08-29/
├── 00-summary.md                     ← 14-point answers + 30-row status matrix + P0/P1/P2 + regression list
├── MASTER-FINDINGS-REPORT.md         ← THIS FILE (all findings + inline proofs)
├── 01-backend-bugs/                  14 reports (BUG-*, CHECK-*, CONTRACT-*)
├── 02-security-site-scoping/         BUG-restricted-user-no-site-scoping.md
├── 03-console-ui/                    CONSOLE-RACE-REPORT.md, BUG-delete-user-send-inert.md
├── 04-suspected-scoping/             SCOPING-suspected-gaps.md
├── 05-blockers/                      BLOCKER-list-chats-500.md, BLOCKERS-and-destructive.md
├── 06-environment/                   ENV-site-assignment-audit.md
└── raw/                              15 JSON captures (gateway API calls, key header redacted, consecutive Send double-fire pairs collapsed — non-consecutive may remain, bodies capped 8 KB)

test-results/dev-portal-evidence-*/   Playwright traces (trace.zip) + failure screenshots + error-context.md — view: npx playwright show-trace <path>

Re-runnable specs (tests/dev-portal/):
  evidence-p0.spec.ts   evidence-batch2.spec.ts   evidence-batch3.spec.ts   evidence-batch4.spec.ts
  evidence-console.spec.ts   evidence-security.spec.ts   _evidence.ts (harness)
Run:  npx playwright test tests/dev-portal/evidence-*.spec.ts --project=chromium --workers=1 --trace on
```

---

# PART L — OPEN ACTIONS

1. **Restore `romana@callcabinet.com` to CC Test 1** (admin role) + confirm CC Test 1 still has the `Primary: API_test` subscription key with a site assigned. Until then no dev-portal test can run.
2. Re-run `evidence-console.spec.ts` + `evidence-security.spec.ts` → refreshes §19–§23: §22 List/Get to a fresh CONFIRMED and **runs cross-site `Update Restricted User Access` for the first time** (record the actual result), §20 gets its direct-backend contrast, §21/§23 get fresh single-switch captures.
3. Re-check §12 Manual Redaction on a **fresh** call+time-window when the endpoint is responding (separately from the "omitted timing field" bug) — **only after the user lifts the pause**.
4. Fix `AlreadyLoggedInModal.logOutOtherSession()` (add a timeout) + teach `LoginPage.completeLogin` to handle the "Select Company" screen.
5. Test-infra: replace hardcoded `KNOWN.siteId` in `calls-api` / `qa-api` / `retention-management-api` / `manual-redaction-api` / `notifications-api` / `reports-api` / `extension-management-api` with a live per-run read; add an `afterAll` to the tenant suites that restores the key's site.
