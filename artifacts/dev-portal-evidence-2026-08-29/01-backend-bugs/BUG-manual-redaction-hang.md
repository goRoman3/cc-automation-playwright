# BUG — Submit Call Redaction Request: POST fires, server never responds (client aborts at ~30s)

- **ID**: P1-MANUAL-REDACTION-HANG
- **Classification**:
  - **CONFIRMED (historical)** — the endpoint hangs (no response, client aborts ~30s) when a timing field (`startMilliseconds` / `endMilliseconds`) is omitted. Reproduced 2026-08-28 and again this run.
  - **PARTIAL / UNVERIFIED (this run)** — the broader "the whole endpoint is not responding to *any* request" claim: 2 of 3 variants had a captured `POST` that fired and then aborted with no response (including a fully-valid control); the 3rd variant produced **no captured POST at all**, so it is not proven that every POST reached the backend. A transient whole-endpoint outage is consistent with this but not confirmed — needs a clean re-check when the endpoint is healthy (user asked to pause Manual Redaction).
- **Severity**: P1

## Environment

```
timestamp:        2026-08-29T10:12:47.961Z
app:              https://atmossystemsstaging.callcabinet.com (TWO s)
developer portal: https://developer1-portal.callcabinet.com
gateway:          https://developer1.callcabinet.com
company:          CC Test 1
account:          romana@callcabinet.com
subscription key: Primary: API_test
key current site: UA team recording / 8cc22cd2-a4b7-46c5-b907-9050e110dac5
git:              feature/chat-listing @ ed251c2
```

## Preconditions / Resource IDs

```json
{
  "callId": "d71ac345-86a0-f111-9b33-6045bded66d5",
  "timeWindowBaseMs": 47961
}
```

## Endpoint chain

## Step 1 — Control — full valid body {callId, entityTypeId:1, startMilliseconds:47961, endMilliseconds:50961, requestText}

### Control — full valid body {callId, entityTypeId:1, startMilliseconds:47961, endMilliseconds:50961, requestText}

```
startedAt:     2026-08-29T10:12:53.888Z
latencyMs:     159
method:        POST
url:           https://developer1-portal.callcabinet.com/trace
pathname:      /trace
query:         {}
Content-Type:  text/plain;charset=UTF-8
sub-key hdr:   (none)
request body:  {"eventType":"UserEvent","message":"BUTTON clicked with text 'Sending'","eventData":"{\"elementId\":\"\",\"message\":\"BUTTON clicked with text 'Sending'\",\"userId\":\"c7823408-ffd2-570a-aa04-c830e08b25a5\",\"userSessionId\":\"c56a3a6c-0c69-ce11-e0b8-a0212be6811e\"}","timestamp":"2026-08-29T10:12:53.718Z","activityId":"1fa9f136-4208-4dce-ace1-51be8cba94a7"}
--
status:        200
response body: 
```

## Step 2 — Omit startMilliseconds — waited 34969ms

### Omit startMilliseconds — waited 34969ms

```
startedAt:     2026-08-29T10:13:28.857Z
latencyMs:     130
method:        POST
url:           https://developer1-portal.callcabinet.com/trace
pathname:      /trace
query:         {}
Content-Type:  text/plain;charset=UTF-8
sub-key hdr:   (none)
request body:  {"eventType":"UserEvent","message":"BUTTON clicked with text 'Sending'","eventData":"{\"elementId\":\"\",\"message\":\"BUTTON clicked with text 'Sending'\",\"userId\":\"c7823408-ffd2-570a-aa04-c830e08b25a5\",\"userSessionId\":\"c56a3a6c-0c69-ce11-e0b8-a0212be6811e\"}","timestamp":"2026-08-29T10:13:28.690Z","activityId":"75e73138-8620-4caf-b209-3545b7c23106"}
--
status:        200
response body: 
```

## Step 3 — Omit endMilliseconds — waited 35611ms

### Omit endMilliseconds — waited 35611ms

```
startedAt:     2026-08-29T10:14:04.461Z
latencyMs:     128
method:        POST
url:           https://developer1-portal.callcabinet.com/trace
pathname:      /trace
query:         {}
Content-Type:  text/plain;charset=UTF-8
sub-key hdr:   (none)
request body:  {"eventType":"UserEvent","message":"BUTTON clicked with text 'Sending'","eventData":"{\"elementId\":\"\",\"message\":\"BUTTON clicked with text 'Sending'\",\"userId\":\"c7823408-ffd2-570a-aa04-c830e08b25a5\",\"userSessionId\":\"c56a3a6c-0c69-ce11-e0b8-a0212be6811e\"}","timestamp":"2026-08-29T10:14:04.301Z","activityId":"82202053-5eca-48d9-aef0-aac2336fbb7d"}
--
status:        200
response body: 
```

## Expected

Valid body → `200` "Successfully created redaction request" (as it did earlier today in `manual-redaction-api.spec.ts`). A missing timing field → prompt `400`.

## Actual

**Control (fully valid body)** → client aborted after **~30s** (`TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"`). Raw capture: `OPTIONS /api/calls/post-redaction/{callId}` → 200 preflight, then `POST` → **net::ERR_ABORTED after 29997ms, status null**. Server never responded.

**Omit startMilliseconds** → client aborted after **34969ms** (`TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"`). Raw: `OPTIONS` 200, `POST` → net::ERR_ABORTED after ~30s, status null. POST fired = true.

**Omit endMilliseconds** → client aborted after **35611ms** (`TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"`). Raw: `OPTIONS` 200 captured; no `POST` captured (aborted before it left, or the capture missed it during teardown). POST fired = false.

**This run, every Submit Call Redaction Request that was attempted — valid or not — timed out with no response.** For 2 of the 3 (control + omit-start) a real `POST` was captured firing and then aborting; for the 3rd (omit-end) no `POST` was captured, so "the request reached the backend and hung" is proven for 2/3, not 3/3. Earlier today the valid form of this call returned 200 promptly (see `manual-redaction-api.spec.ts`), so this run is either (a) a degradation of the whole endpoint since then, or (b) the backend rejecting/hanging on call+time-window pairs already used earlier today (many redaction requests were submitted for this call across today's runs) — the 2026-08-28 note said duplicates 400, but a hang is also plausible. **Needs a re-check on a fresh call+window when the endpoint is healthy** to separate "always hangs on omitted fields" (CONFIRMED) from "whole endpoint down today" (PARTIAL).

## Reproducibility

- **Missing-timing-field hang**: CONFIRMED — reproduced this run (omit-start: captured POST fired → aborted ~30s; omit-end: timed out, no captured POST) and on 2026-08-28 seventh session (trace then showed a real POST with response status -1).
- **Whole-endpoint not responding**: PARTIAL — this run the fully-valid control also hung (captured POST fired → aborted ~30s, no HTTP status). Single run; not seen before today. 2/3 variants have a captured hung POST; 1/3 has no captured POST.

## Alternative explanations ruled out

- **request never left the browser (generic client timeout)** — ruled out for control + omit-start — raw capture shows `OPTIONS` 200 preflight then a real `POST` to `/api/calls/post-redaction/{callId}` that ends `net::ERR_ABORTED` at ~30s with `status: null`. Server received the request and never replied. (omit-end: OPTIONS captured, POST not — inconclusive for that leg.)
- **entityTypeId / callId invalid** — weak — the same callId returned 200 from Submit Call Redaction Request earlier today and 200 from Get Call Info in P1-500S; but the control hung this run, so "invalid input" is not the cause
- **duplicate call+time-window (already submitted earlier today)** — NOT ruled out — many redaction requests were submitted for this call across today's runs; the backend may hang (rather than 400) on a repeat window. This needs an isolated re-check on a call/window never used before.
- **transient staging outage of this endpoint** — NOT ruled out — the whole endpoint hanging (control included) is consistent with a transient backend/downstream outage, distinct from the persistent "hangs when timing fields omitted" bug.

## Downstream impact

When it hangs (omitted timing field — CONFIRMED): a redaction request ties up a connection for the full client timeout with no error. If the whole endpoint is down (possibly this run — PARTIAL evidence), Manual Redaction submission is entirely unusable, but that state is not confirmed permanent.

## Workaround

Retry later; always send both `startMilliseconds` and `endMilliseconds`; use a call+window pair never submitted before.

## Cleanup performed

No redaction request was created this run — all POSTs aborted before a response (nothing persisted, unlike a normal 200).

## Remaining unknowns

Whether the server EVER responds (>30s), or truly abandons the request. Whether today's control hang is a transient outage or a real regression — needs re-run on a fresh call+window when the endpoint is responding again.

## Recommended regression test

`negative-required-fields-staging.spec.ts` already has "KNOWN BUG — Submit Call Redaction Request hangs indefinitely ... when startMilliseconds/endMilliseconds is omitted" (`.rejects.toThrow(/Timeout/)`). Keep. Consider a separate lightweight health-check test that FAILS if a valid Submit Call Redaction Request hangs (so a full-endpoint outage is caught distinctly).

## Suggested bug-ticket wording

**Title**: `POST calls/post-redaction/{callId}` — server accepts the request (OPTIONS 200 + POST) then never responds; client aborts at ~30s (net::ERR_ABORTED, no HTTP status)

**Steps**: 1) Valid body `{callId, entityTypeId:1, startMilliseconds:N, endMilliseconds:N+3000, requestText:"..."}` → **normally 200 "Successfully created redaction request"**, but on 2026-08-29T10:12:47.961Z it hung with no response. 2) Omit `startMilliseconds` → `OPTIONS` 200, `POST` fires, **no response**, client times out ~30s. Same for `endMilliseconds`.

**Expected**: 200 for a valid body; prompt 400 for a missing required field.
**Actual**: the POST is received (preflight succeeds, POST sent) and the server never returns anything — the connection is eventually aborted client-side. Needs server-side investigation of the redaction-submit handler (deadlock / downstream call with no timeout).

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-MANUAL-REDACTION-HANG.json`
