# BUG — List Retention Policies: any SiteID/siteId filter → 500 (casing- and value-independent)

- **ID**: P1-LIST-RETENTION-SITEID-FILTER
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P1

## Environment

```
timestamp:        2026-08-29T10:20:08.396Z
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
  "otherSiteId": "39e0cb7f-68a8-431c-8754-6941a2f6a547"
}
```

## Endpoint chain

## Step 1 — List Retention Policies unfiltered → 200

### List Retention Policies unfiltered → 200

```
startedAt:     2026-08-29T10:20:13.089Z
latencyMs:     340
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {}
--
status:        200
response body: [{"siteID":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","siteName":"UA team recording","expirationDays":365,"hasRetentionPlan":false,"customerId":"00000000-0000-0000-0000-000000000000"}]
```

## Step 2 — filter { SiteID = own } → 500

### filter { SiteID = own } → 500

```
startedAt:     2026-08-29T10:20:17.873Z
latencyMs:     158
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"SiteID","operator":"eq","value":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}]}}
--
status:        500
response body: {}
```

## Step 3 — filter { siteID = own } → 500

### filter { siteID = own } → 500

```
startedAt:     2026-08-29T10:20:23.037Z
latencyMs:     297
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"siteID","operator":"eq","value":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}]}}
--
status:        500
response body: {}
```

## Step 4 — filter { SiteId = own } → 500

### filter { SiteId = own } → 500

```
startedAt:     2026-08-29T10:20:27.835Z
latencyMs:     167
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"SiteId","operator":"eq","value":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}]}}
--
status:        500
response body: {}
```

## Step 5 — filter { siteId = own } → 500

### filter { siteId = own } → 500

```
startedAt:     2026-08-29T10:20:32.452Z
latencyMs:     288
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"siteId","operator":"eq","value":"8cc22cd2-a4b7-46c5-b907-9050e110dac5"}]}}
--
status:        500
response body: {}
```

## Step 6 — filter { SiteID = other } → 500

### filter { SiteID = other } → 500

```
startedAt:     2026-08-29T10:20:37.499Z
latencyMs:     161
method:        POST
url:           https://developer1.callcabinet.com/api/settings/retention/list/
pathname:      /api/settings/retention/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[{"field":"SiteID","operator":"eq","value":"39e0cb7f-68a8-431c-8754-6941a2f6a547"}]}}
--
status:        500
response body: {}
```

## Expected

A `SiteID` filter either filters the result or returns a `400`. Never a bare 500 — least of all filtering by the caller's own site id.

## Actual

Unfiltered → 200. Filtered: SiteID = own→500, siteID = own→500, SiteId = own→500, siteId = own→500, SiteID = other→500. Every casing and both own/other site values → 500.

## Reproducibility

5/5 filter variants 500 this run; matches 2026-08-25/27.

## Alternative explanations ruled out

- **wrong field casing** — ruled out — SiteID / siteID / SiteId / siteId all 500
- **bad site id value** — ruled out — own site id and another site id both 500
- **unfiltered list is also broken** — ruled out — unfiltered → 200

## Downstream impact

Retention policies cannot be filtered by site via the API — callers must fetch all and filter client-side.

## Workaround

Fetch unfiltered; filter by `siteID` in the response client-side.

## Cleanup performed

None (reads).

## Remaining unknowns

The exact server exception (2026-08-27 saw a bare 500).

## Recommended regression test

Add a `KNOWN BUG` test to `retention-management-api.spec.ts`: `List Retention Policies` with a `SiteID` eq filter → 500; unfiltered → 200.

## Suggested bug-ticket wording

**Title**: `POST settings/retention/list` 500s when `filter` contains a `SiteID`/`siteId` entry (any casing, any value).

**Steps**: unfiltered → 200. `{filter:{filters:[{field:"SiteID",operator:"eq",value:"<own site id>"}]}}` → **500**. Same for `siteID`/`SiteId`/`siteId` and for another site's id.

**Expected**: filtered result or 400.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-LIST-RETENTION-SITEID-FILTER.json`
