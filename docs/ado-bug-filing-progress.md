# ADO bug filing — progress (Developer Portal / API Management)

Status of filing the reconciliation results into Azure DevOps (org `callcabinetusa`, project **Atmos Systems**).
Paused 2026-08-30. **Do not re-run the create step for anything marked DONE below — the tickets already exist.**

Scope decided with the user:
- One Bug per problem class (groups **A, B, C, D, F, G, H**) + separate Bugs for **BUG 03**, **BUG 16**, and **BUG 20 second failure mode**. 10 Bugs total.
- **Group E is NOT filed** — all four members already exist in ADO (#38091, #38119, #38122, #38088, #38116).
- 12 comments on existing tickets.
- All ADO content (titles, descriptions, Affected-operations tables, evidence, comments) **in English**.
- Assignee left **empty** on every new Bug (team assigns).
- Area Path `Atmos Systems`, Iteration `Atmos Systems\Iteration 20`.
- Every new Bug linked **Related** to the parent stories **#37981** and **#37998**; group **C** additionally Related to **#36027** (per-site scoping).

## Agreed Priority / Severity

| Bug(s) | Priority | Severity |
|---|---|---|
| B, C | 2 | 2 - High |
| A, D, F, G, BUG 03, BUG 16, BUG 20-m2 | 3 | 3 - Medium |
| H | 3 | 4 - Low |

(The team's existing dev-portal bugs skew conservative — even the per-site security leak #38113 is Priority 3 / Severity "2 - High" — hence B/C at "2 - High" rather than Critical.)

---

## 1. Bugs — ALL 10 CREATED ✅

Created via `POST _apis/wit/workitems/$Bug` (json-patch). Fields, tags, and Related links were echoed back in each create response and are recorded below. Bodies were written in English with the structure: Summary / Environment / **Affected operations** table (every endpoint where the problem is confirmed / suspected / not-checked) / Evidence (verbatim gateway capture from `artifacts/dev-portal-evidence-2026-08-29/raw/*.json`, subscription-key header already redacted at capture time) / Expected / Actual / Notes-ruled-out. `Microsoft.VSTS.Common.AcceptanceCriteria` holds the Expected statement; `RemainingWork` / `OriginalEstimate` set to 0 (Bug template requires them).

| Group | ID | Priority / Severity | Related links (from create response) | Title |
|---|---|---|---|---|
| **A** | **#38164** | 3 / 3 - Medium | 37981, 37998 | Development portal API responses return placeholder identifiers instead of the real customerId (Get/List Agent, Create Custom Role, Add IP Whitelist) |
| **B** | **#38165** | 2 / 2 - High | 37981, 37998 | Save Completed QAs returns 201 but the evaluation is not persisted (Development portal) |
| **C** | **#38170** | 2 / 2 - High | 37981, 37998, **36027** | Development portal site-scoping check rejects operations on the API key's own site (Update Agent, Email QA) |
| **D** | **#38171** | 3 / 3 - Medium | 37981, 37998 | Development portal endpoints return 500 instead of 400 when a required body field is omitted (Add IP Whitelist, Create Custom Role) |
| **F** | **#38172** | 3 / 3 - Medium | 37981, 37998 | Development portal endpoints return 500 for fully valid requests (Get Call PCI Data, Email Call, Get Report By Template, Preview Alert Log, Get Alert Notification old) |
| **G** | **#38179** | 3 / 3 - Medium | 37981, 37998 | Development portal Try-it console cannot execute several operations (List Chats default take, Delete Custom Role, Get Alert Trigger Operators, Generate QA PDF/Excel) |
| **H** | **#38180** | 3 / 4 - Low | 37981, 37998 | Development portal endpoint behaviour does not match the published contract (Tag name rules, Get AQA Phrases formId, Get User Activity Summary period) |
| **BUG 03** | **#38181** | 3 / 3 - Medium | 37981, 37998 | Get Custom Role ignores the requested roleId and returns an unrelated locked system role (Development portal) |
| **BUG 16** | **#38188** | 3 / 3 - Medium | 37981, 37998 | Submit Call Redaction Request hangs with no response when a timing field is omitted (Development portal) |
| **BUG 20-m2** | **#38189** | 3 / 3 - Medium | 37981, 37998 | Delete User Try-it console "Send" button fires no network request (Development portal) |

Tags as ADO stored them (ADO normalised "IP Whitelist" → "IP WHITELIST" against an existing tag — cosmetic):
- #38164 — `Agent Management; API Management; Development; IP WHITELIST; Role Management`
- #38165 — `API Management; Development; QA`
- #38170 — `Agent Management; API Management; Development; QA`
- #38171 — `API Management; Development; IP WHITELIST; Role Management`
- #38172 — `API Management; Calls; Development; Notifications; Reports`
- #38179 — `API Management; Development`
- #38180 — `API Management; Development; QA; Reports; Tag Management`
- #38181 — `API Management; Development; Role Management`
- #38188 — `API Management; Development; Manual Redaction`
- #38189 — `API Management; Development; User Management`

### Verification of Related links on #38164 / #38165 (user asked to double-check)

The independent verification GET was interrupted twice and **not completed**. However, the `POST .../workitems/$Bug` **create response** for every one of the 10 bugs echoed back its `relations`, and the filing helper printed them — for #38164: `Related -> 37998`, `Related -> 37981`; for #38165: `Related -> 37981`, `Related -> 37998`; for #38170: `Related -> 37981`, `Related -> 37998`, `Related -> 36027`. So the links **were set at creation time** (authoritative — ADO returns the persisted work item).

**Task for tomorrow (optional, low priority — do NOT edit, just read):** one `POST _apis/wit/workitemsbatch` with `{"ids":[38164,38165,38170,38171,38172,38179,38180,38181,38188,38189],"$expand":"relations"}` (note: `$expand` cannot be combined with `fields`) to belt-and-braces confirm relations + tags + priority on all 10. If any Related link is missing, add it with a `PATCH` `{"op":"add","path":"/relations/-","value":{"rel":"System.LinkTypes.Related","url":"https://dev.azure.com/callcabinetusa/_apis/wit/workItems/<n>"}}` — but the create responses indicate this will not be needed.

### Remaining from the 10 bugs

**None.** All 10 are created. Do not re-file.

---

## 2. Comments on existing tickets — 0 of 12 ADDED ❌

**Nothing has been commented yet.** All 12 remain to be posted, via
`POST _apis/wit/workItems/{id}/comments?api-version=7.1-preview.4` with body `{"text": "<html>"}` (comment only — **never** PATCH the existing work items).

Each comment opens with the standard evidence-provenance line, then adds information **not in the ticket's original description**: verbatim raw request/response captures, additional repro variants, ruled-out hypotheses, and claim boundaries. Draft text for each is below — regenerate/refine from `artifacts/dev-portal-evidence-2026-08-29/raw/*.json` and post in order.

Standard opening line for every comment:

> *Additional detail from the AQA evidence run (staging, company CC Test 1, key "Primary: API_test" scoped to site "UA team recording" / 8cc22cd2-a4b7-46c5-b907-9050e110dac5, build feature/chat-listing @ ed251c2, captured 2026-08-29 via the real Try-it console + a network listener; subscription-key header redacted at capture time. No screenshots/traces — those runs were blocked).*

| # | Target | Our BUG | Comment must contain |
|---|---|---|---|
| 1 | **#38091** | 06 (DUP) | `POST /api/calls/chats/list/` — 6 body variants all → 500 (`{}`, standard list body, date-range-only, current-year StartTime/EndTime, small page, no-filter-key). In 4/6 the server validation error names `SiteId` as an unsupported filter field; the caller never sends a SiteId filter in any variant → server-injected for per-site scoping. Independent console problem: the pre-filled default body sets `take:10000` > server max 500 (per coverage notes; no raw of a take:10000 send). Ruled out: `{}` and a well-formed date-range body both 500; same key reads Calls/Agents/Extensions fine in the same session. List Chats is the only chatId source, so this blocks the 9 other Chats ops. |
| 2 | **#38119** | 17 (DUP) | `POST /api/settings/extensions/list/?showDeleted=false` — `Name eq` → 200 (1 row), `Name contains` → 200, `Name equals` → 500 `{}`, `SiteName equals` → 500 `{}`. Verdict: "equals" 500s on ANY field; "eq"/"contains" work. Portal's own example uses `equals`. Ruled out: not field-specific (reproduced on `Name`), not a value problem (same value → 200 with `eq`). Possibly the same shared filter engine as List Retention (#38122). |
| 3 | **#38122** | 18 (DUP) | `POST /api/settings/retention/list/` — `{}` unfiltered → 200 with the key's own site row (`{"siteID":"8cc22cd2-…","expirationDays":365,…}`). All 4 casings `SiteID`/`siteID`/`SiteId`/`siteId` `eq` own-site → 500 `{}`; `SiteID eq` another site (39e0cb7f-…) → 500 `{}`. Verdict: every SiteID/siteId filter 500s, casing- and value-independent. Ruled out: not a site-isolation leak (unfiltered is already correctly scoped); confirmed twice, two sites, incl. the key's own site id. |
| 4 | **#38088** | 26 (part) | The 3 body shapes (from the tenant-scoping check run, **no dedicated raw capture**): (1) unmodified default example (has a `customerId=00000000` filter) → 500 "Parameter '@CustomerId' was supplied multiple times" (backend auto-injects its own customerId; example's placeholder filter collides); (2) remove the `filter` key `{"skip":0,"take":50}` → 500 NRE; (3) explicit empty `filter` object → 200 (only working shape). Related: `sort` by `siteName` on the same endpoint → 500 "Invalid column name 'siteName'" (#38116). AQA groups both as one "broken default body" class; retest should cover all 3 shapes + the siteName sort. |
| 5 | **#38116** | 26 (part) | `POST .../GetHeartbeatsTable` with `sort:[{"field":"siteName","dir":"asc"}]` → 500 "Invalid column name 'siteName'." (no raw capture). Context: complementary to #38088 (filter handling); this is the sort field. Retest: default example runs as-is; omitting `filter` returns a validation error not NRE; `siteName` sorts or is removed + invalid sort field → 400. |
| 6 | **#38095** | 23 (DUP) | Observed on Update Multiple Call Tags (PUT calls/calls/tags), and Update Legal Hold / Add Call Note — non-GET ops whose OpenAPI schema fetch loses the render race: no body schema/example, no pre-filled `Content-Type`, manual JSON sent as `text/plain` → 415. Manually adding `Content-Type: application/json` makes the same body succeed → payload is fine, only the header is wrong. Intermittent — reloading the same op renders correctly with no other change. (No dedicated raw — surfaced as 415s during other runs.) |
| 7 | **#38113** | 24 (DUP) | **Scope clarification.** Cross-site **List and Get: CONFIRMED** on the 2026-08-27 controlled run — fresh user created blank, bound exclusively to Site A (Analytics Synthetic Data / 39e0cb7f-…) via Update Restricted User Access, verified (`sites=["Analytics Synthetic Data"]`), key switched to Site B (UA team recording / 8cc22cd2-…); from Site B, Get Restricted User returned the full byte-identical record and List Restricted Accesses still enumerated the user; the entire ~100-row list was byte-for-byte identical, same order, for both site assignments of the same key (completely independent of the calling key's site). Cross-site **Update: NEVER executed** (a key on Site B modifying a Site-A user) — expected broken too, but an assumption, not evidence. **Cross-customer: NOT tested** (DTO has no customerId). The 2026-08-29 fresh re-run was blocked — the account no longer had selectable access to CC Test 1; time and cause unknown. |
| 8 | **#38125** | 13 (part) | Verbatim: `POST /api/settings/agent-groups/` with `agentJson:"[]"` → 200 `{"id":0,…,"agents":[],"agentJson":"[]"}`; then `POST /agent-groups/list/` → 200, the group "AQA evidence group B …" is NOT in the list. Contrast: non-empty `agentJson` with a real agent id DOES persist (found in List with a real id) — but the create response still says `id:0` (that half is #38128). Ruled out: not a wrong-name search; reproduced twice, two sites. |
| 9 | **#38128** | 13 (part) | Verbatim: `POST /api/settings/agent-groups/` with `agentJson:"[\"b276c869-…\"]"` → 200 `{"id":0,…,"agents":["b276c869-…"]}`; then `POST /agent-groups/list/` → 200 shows `{"id":1016,"name":"AQA evidence group A …","agents":["b276c869-…"]}`; `GET /api/settings/get-agent-groups/1016` → 200. Group genuinely created with real id **1016**, but create response returns `id:0` — caller cannot learn the id from create, must List + match by name (racy). Ruled out: the full create body is captured, the only `id` field is 0; distinct from #38125 (reproduces even when creation succeeds). |
| 10 | **#38134** | 30 (DUP) | Reproduces on both production and staging portal hosts. The page is the generic error surface — *"Oops! We've entered into uncharted territory."* — the same message shown **intentionally** for an unauthenticated direct link (see #36244), but here on the **authenticated** Profile nav item from a normally loaded portal session → the Profile route appears unwired / not registered rather than a transient error. No gateway request involved (portal client-side routing). Retest check: whether any other nav item lands on the same page. |
| 11 | **#37624** | 20 (PARTIAL) | A **second, distinct failure mode** of Delete User via the dev portal — filed separately, linked. This ticket = a **500** from `settings/users/delete` on prod. On the **staging Try-it console** AQA saw: console renders, Send button present, clicking it fires **no network request at all** (no OPTIONS, no POST); 3/3, `firedApiCalls=0` each. Add User + Get User in the same console session fired real requests (200) → session/key fine. May share a backend root cause or be independent (console layer vs backend). New ticket: **#38189** "Delete User Try-it console 'Send' button fires no network request" — linked Related. |
| 12 | **#38081** | 25 (PARTIAL) | **Update — the functional 500 no longer reproduces.** On a later run `POST https://developer1.callcabinet.com/calls/calls/search/` (no `/api/` prefix) returned **200** with valid data (`[{"Id":"d61ac345-…","StampStartTime":"2026-08-25T13:07:32Z",…}]`). What remains is only the routing inconsistency: published without `/api/` while every other endpoint has it, and the portal's own doc URL carries the same wrong path. Suggestion: re-scope this ticket to the route inconsistency (P2), or close it if the routing is intentional and only the doc URL needs fixing. |

---

## 3. Exact resume point

1. **Bugs:** all 10 done — nothing to do.
2. **(Optional)** one read-only `workitemsbatch` (`$expand:relations`) over the 10 ids to confirm relations/tags/priority. Create responses already showed them correct.
3. **Comments:** start at comment **#1 (target #38091)** and work down the table above through **#12 (target #38081)**. Post one at a time, sequentially, with pauses — no parallel request series. Comment only; do not PATCH any existing work item.
4. After all 12 comments: update this file's comment table to DONE and note each comment id.

### Request discipline (still applies)

Sequential, batched, with pauses. No wide keyword sweeps. No consecutive retries of a failing call — diagnose instead. The subscription token lives in `.mcp.json` (`mcpServers.ado.env.PERSONAL_ACCESS_TOKEN`, used as `Authorization: Basic <value>`); never print it. Fallback token possibly in `C:/Users/Work/Documents/projects/cloude/.env` — only if the primary 401s.
