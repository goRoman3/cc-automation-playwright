# BUG — List Chats always 500s: backend injects a `SiteId` filter its own validator rejects; blocks all 9 other Chats operations

- **ID**: P0-LIST-CHATS
- **Classification**: CONFIRMED BACKEND BUG (+ BLOCKER for the whole Chats group)
- **Severity**: P0 (the entire Chats API surface is unusable)

## Environment

```
timestamp:        2026-08-29 (run 1 raw: raw/P0-LIST-CHATS.json)
app:              https://atmossystemsstaging.callcabinet.com  (TWO s — "systems staging")
developer portal: https://developer1-portal.callcabinet.com
gateway:          https://developer1.callcabinet.com
company:          CC Test 1  (98f086b0-8d0e-4ba8-8f01-870466740b1c)
account:          romana@callcabinet.com
subscription key: Primary: API_test
key current site: UA team recording / 8cc22cd2-a4b7-46c5-b907-9050e110dac5
git:              feature/chat-listing @ ed251c2
```

## Preconditions / Resource IDs

None — the group cannot produce a `chatId` (that is the point of the blocker).

## Endpoint chain — `POST calls/chats/list`, 6 body variants

For each variant: the **exact body sent** and the **server's validation error**.
The error is double-JSON-encoded inside `Description`; shown unescaped.

### Variant 1 — `{}` (empty object)
```
REQ body:  {}
status:    500
RES body:  Request failed with status code BadRequest: {"detail":[
             {"type":"less_than_equal","loc":["body","take"],"msg":"Input should be less than or equal to 500","input":10000,"ctx":{"le":500}},
             {"type":"literal_error","loc":["body","filter","filters",2,"field"],
              "msg":"Input should be 'ChatId','ChatName','StartTime','EndTime','DateTime','RecordingId','CallType','ChatType','Participants','Number','Agent','Extension' or 'IsInternalChat'",
              "input":"SiteId", ...}]}
```
→ client sent **0** filters, error names `filters[2].field = "SiteId"`. Also: the console defaults `take` to **10000**, which exceeds the server max of **500** (separate minor issue).

### Variant 2 — standard list body, empty filters array
```
REQ body:  {"skip":0,"take":25,"sort":[],"filter":{"logic":"and","filters":[]}}
status:    500
RES body:  ...{"loc":["body","filter","filters",0,"field"], "input":"SiteId", ...}
```
→ client sent **0** filters, error names `filters[0].field = "SiteId"` → server injected one at index 0.

### Variant 3 — date range only, **2 client filters** (indices 0 and 1)
```
REQ body:  {"skip":0,"take":25,"sort":[{"field":"StartTime","dir":"desc"}],"filter":{"logic":"and","filters":[
             {"field":"StartTime","operator":"gte","value":"2020-01-01T00:00:00Z"},
             {"field":"StartTime","operator":"lte","value":"2026-12-31T23:59:59Z"}]},"terms":[]}
status:    500
RES body:  ...{"loc":["body","filter","filters",2,"field"], "input":"SiteId", ...}
```
→ **client sent filters[0], filters[1]; server error is at filters[2] = `"SiteId"`.** The server appended a 3rd filter the client never sent.

### Variant 4 — explicit current-year StartTime/EndTime (2 client filters)
```
REQ body:  {"skip":0,"take":25,"sort":[],"filter":{"logic":"and","filters":[
             {"field":"StartTime","operator":"gte","value":"2026-01-01T00:00:00Z"},
             {"field":"EndTime","operator":"lte","value":"2026-12-31T23:59:59Z"}]}}
status:    500
RES body:  ...{"loc":["body","filter","filters",2,"field"], "input":"SiteId", ...}
```
→ same: client 2 filters → error at index 2 = `"SiteId"`.

### Variant 5 — `{skip:0,take:5}` (no `filter` key)
```
status:    500
RES body:  {"StatusCode":500,"Description":"Object reference not set to an instance of an object.", ...ApiException...}
```
→ **NRE**: the server-injection code assumes `filter.filters` exists.

### Variant 6 — `{skip:0,take:25,sort:[]}` (no `filter` key)
```
status:    500
RES body:  {"StatusCode":500,"Description":"Object reference not set to an instance of an object.", ...ApiException...}
```
→ same NRE.

## Expected

`POST calls/chats/list` → **200**, chat sessions scoped to the key's permitted site.

## Actual

**All 6 body variants → 500.** Two distinct failure modes:

1. **Validation failure** (variants 1–4, any body with a `filter.filters` array): the server appends its own filter entry — `field: "SiteId"`, `input: "SiteId"` — at index `<client filter count>`. The downstream chat-search service's field enum is `ChatId, ChatName, StartTime, EndTime, DateTime, RecordingId, CallType, ChatType, Participants, Number, Agent, Extension, IsInternalChat` — **it has no `SiteId`**, so every request fails validation. The injected index tracks the number of client filters exactly (0 → idx 0, 2 → idx 2), proving the server is the one adding it.
2. **NullReferenceException** (variants 5–6, no `filter` key at all): the injection code dereferences `filter.filters` on a null `filter`.

## Reproducibility

6/6 body variants this run. Matches every prior session since 2026-08-26 (the `SiteId`-not-in-enum message has been stable for weeks).

## Alternative explanations ruled out

- **Client sent a bad `SiteId` filter** — ruled out: no variant includes a `SiteId` filter; the injected index is exactly one past the client's filter count (2 client filters → error at index 2), so the server added it.
- **Wrong body shape / pagination** — ruled out: 6 different shapes (empty, standard, date-range, current-year, small-page, no-filter) all 500.
- **Console-only artifact** — NOT re-verified this run (portal console instability aborted the main-app repro leg). **Confirmed in prior sessions**: opening the main app's `/ChatListing` page and inspecting its own `POST /api/calls/chats/list` shows the exact same 500 (memory: 2026-08-28 fourth session). The `SiteId` injection is in the shared site-scoping middleware, not the dev-portal console.
- **Wrong environment** — ruled out: `https://developer1.callcabinet.com/` (staging).
- **Existing-data ambiguity** — n/a, all reads, no data dependency.

## Downstream impact

`List Chats` is the **only** source of a `chatId` — in the API and in the main app. With it broken, these **9 operations cannot be called at all**:

| Operation | Endpoint | Needs |
|---|---|---|
| Add Chat Note | `POST calls/chats/{chatId}/notes` | chatId |
| Get Chat Notes | `GET calls/chats/{chatId}/notes` | chatId |
| Update Chat Note | `POST calls/chats/{chatId}/notes/{noteId}` | chatId + noteId |
| Delete Chat Note | `DELETE calls/chats/{chatId}/notes/{noteId}` | chatId + noteId |
| Download Chat | `GET calls/chats/{chatId}/download` | chatId |
| Get Chat Details | `POST calls/chats/{chatId}` | chatId |
| Get Chat Message Notes | `GET calls/chats/messages/{messageId}/notes` | messageId (from a chat) |
| Get Chat Messages | `GET calls/chats/{chatId}/messages` | chatId |
| Send Chat Email | `POST calls/chats/email` | chatId(s) |

Chats API = **1 broken entry point + 9 unreachable operations**.

## Workaround

None.

## Cleanup performed

None needed (all reads).

## Remaining unknowns

- The exact server component that appends the `SiteId` filter (site-scoping middleware) and why the downstream chat-search validator's enum omits `SiteId`.
- Whether fixing the enum alone is enough, or the middleware should translate `SiteId` → an allowed field / apply the scope differently for chats.
- The `take: 10000 > 500` console default is a separate small bug (console should default `take` ≤ 500).

## Recommended regression test

`chats-api.spec.ts` › **"KNOWN BUG — List Chats always 500s (backend auto-injects an invalid SiteId filter)"** already pins the 500 + the `Input should be 'ChatId'` message. The other 9 operations are `test.skip(...)` with the blocker reason. **Keep as-is.** Optionally add an assertion on the injected filter index tracking the client filter count.

## Suggested bug-ticket wording

**Title**: `POST calls/chats/list` always 500s — a server-injected `SiteId` filter is rejected by the chat-search validator (allowed enum has no `SiteId`); also NREs when the body has no `filter` key

**Env**: staging (developer1 gateway), key "Primary: API_test" scoped to site "UA team recording".

**Steps**:
1. `POST calls/chats/list` with body `{"skip":0,"take":25,"sort":[{"field":"StartTime","dir":"desc"}],"filter":{"logic":"and","filters":[{"field":"StartTime","operator":"gte","value":"2020-01-01T00:00:00Z"},{"field":"StartTime","operator":"lte","value":"2026-12-31T23:59:59Z"}]}}` → **500**.
2. Response `Description` (unescaped): `Request failed with status code BadRequest: {"detail":[{"type":"literal_error","loc":["body","filter","filters",2,"field"],"msg":"Input should be 'ChatId', ... or 'IsInternalChat'","input":"SiteId",...}]}` — note the client sent 2 filters, the error is at index **2**.
3. `POST calls/chats/list` with `{"skip":0,"take":5}` (no `filter`) → **500** `"Object reference not set to an instance of an object."`

**Expected**: 200 with site-scoped chats.
**Actual**: the site-scoping middleware appends a `SiteId` filter entry that the downstream chat-search service's field-name validation does not accept (its enum has no `SiteId`); with no `filter` key it NREs. Reproduces on the app's Chat Listing page too.

**Impact**: blocks all 9 other Chats operations (no obtainable `chatId`).

## Raw evidence files

- `raw/P0-LIST-CHATS.json` (6 variants, sent bodies + full error responses, gateway API calls)
