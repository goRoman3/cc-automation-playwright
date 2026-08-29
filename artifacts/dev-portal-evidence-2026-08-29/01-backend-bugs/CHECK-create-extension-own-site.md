# Create Extension for the key's own site — re-investigation (history: intermittent 500)

- **ID**: P1-CREATE-EXTENSION-OWN-SITE
- **Classification**: NOT REPRODUCED (own-site create succeeded 3/3)
- **Severity**: P1

## Environment

```
timestamp:        2026-08-29T10:05:27.410Z
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
  "ownSiteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
  "crossSiteId": "39e0cb7f-68a8-431c-8754-6941a2f6a547"
}
```

## Endpoint chain

## Step 1 — Create Extension own-site attempt 1 (AQA evidence ext own 1787997927410-0) → 200

### Create Extension own-site attempt 1 (AQA evidence ext own 1787997927410-0) → 200

```
startedAt:     2026-08-29T10:05:32.357Z
latencyMs:     856
method:        POST
url:           https://developer1.callcabinet.com/api/settings/extensions/
pathname:      /api/settings/extensions/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence ext own 1787997927410-0","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}
--
status:        200
response body: "fd13db15-7545-4668-aeca-8974c21cb391"
```

## Step 2 — Create Extension own-site attempt 2 (AQA evidence ext own 1787997933213-1) → 200

### Create Extension own-site attempt 2 (AQA evidence ext own 1787997933213-1) → 200

```
startedAt:     2026-08-29T10:05:37.821Z
latencyMs:     1489
method:        POST
url:           https://developer1.callcabinet.com/api/settings/extensions/
pathname:      /api/settings/extensions/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence ext own 1787997933213-1","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}
--
status:        200
response body: "b6830306-a6a3-4351-9fde-0462196ea480"
```

## Step 3 — Create Extension own-site attempt 3 (AQA evidence ext own 1787997939311-2) → 200

### Create Extension own-site attempt 3 (AQA evidence ext own 1787997939311-2) → 200

```
startedAt:     2026-08-29T10:05:43.783Z
latencyMs:     757
method:        POST
url:           https://developer1.callcabinet.com/api/settings/extensions/
pathname:      /api/settings/extensions/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence ext own 1787997939311-2","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}
--
status:        200
response body: "0a0f1da1-0ede-4d29-8f1b-4d1718ba5263"
```

## Step 4 — Create Extension cross-site (siteId 39e0cb7f-68a8-431c-8754-6941a2f6a547) → 400

### Create Extension cross-site (siteId 39e0cb7f-68a8-431c-8754-6941a2f6a547) → 400

```
startedAt:     2026-08-29T10:05:49.278Z
latencyMs:     262
method:        POST
url:           https://developer1.callcabinet.com/api/settings/extensions/
pathname:      /api/settings/extensions/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence ext cross 1787997944540","siteId":"39e0cb7f-68a8-431c-8754-6941a2f6a547"}
--
status:        400
response body: "Configured site does not contain selected extension."
```

## Expected

Own-site create → 200 with a new extension id; cross-site create → 400 "Configured site does not contain selected extension."

## Actual

Own-site: [200, 200, 200] (bodies in raw). Cross-site: **400** `"Configured site does not contain selected extension."`.

## Reproducibility

own-site 3/3 succeeded, 0/3 500 this run.

## Alternative explanations ruled out

- **stale key-site** — ruled out — ownSite (8cc22cd2-a4b7-46c5-b907-9050e110dac5) is from live Get Sites Storage Usage
- **wrong body** — ruled out — {name, siteId} is the confirmed minimal Create Extension body; cross-site uses the same shape and 400s correctly
- **cross-site rejection is broken** — ruled out — cross-site create → 400 "Configured site does not contain selected extension."

## Downstream impact

None if own-site create is reliable — the 2026-08-29 write-path session's 500 did not reproduce this run.

## Workaround

n/a

## Cleanup performed

Deleted: {"fd13db15-7545-4668-aeca-8974c21cb391":200,"b6830306-a6a3-4351-9fde-0462196ea480":200,"0a0f1da1-0ede-4d29-8f1b-4d1718ba5263":200}.

## Remaining unknowns

What triggers the intermittent 500 (server load? a specific site state?). Needs many more attempts across sessions to characterise.

## Recommended regression test

No change — the lifecycle test's Create step is currently reliable.

## Suggested bug-ticket wording

(no ticket — not reproduced this run)

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-CREATE-EXTENSION-OWN-SITE.json`
