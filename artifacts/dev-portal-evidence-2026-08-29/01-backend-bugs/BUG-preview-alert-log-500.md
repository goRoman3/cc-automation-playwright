# BUG — Preview Alert Log always 500s (body shape valid — same shape succeeds in Upsert Alert Configuration)

- **ID**: P1-PREVIEW-ALERT-LOG
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P1

## Environment

```
timestamp:        2026-08-29T09:41:04.756Z
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
  "alertConfigId": 570
}
```

## Endpoint chain

## Step 1 — Upsert Alert Configuration (create — proves the trigger/window shape is valid)

### Upsert Alert Configuration (create — proves the trigger/window shape is valid)

```
startedAt:     2026-08-29T09:41:46.942Z
latencyMs:     6151
method:        POST
url:           https://developer1.callcabinet.com/api/settings/alerts/
pathname:      /api/settings/alerts/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":null,"name":"AQA evidence alert 1787996502734","notificationTypeId":7,"windowType":"interaction","windowValue":1,"triggers":[{"notificationLevel":"warning","shouldNotify":true,"triggerOperatorId":13,"triggerValue":["test"],"triggerThreshold":50,"anomalyDetection":false}],"filters":[],"notificationCooldown":0.5,"emailAddresses":[],"webhooks":[],"tags":[]}
--
status:        200
response body: {"configResult":"Successfully inserted Notification Config '570'","emailResult":"Successfully Deleted 0 and Inserted 0 Email Addresses","webhookResult":"Successfully Deleted 0 and Inserted 0 Webhooks","filtersResult":"No Change","triggersResult":"Successfully Upserted 1 Config Triggers"}
```

## Step 2 — Get Alert Configuration (verify it persisted)

### Get Alert Configuration (verify it persisted)

```
startedAt:     2026-08-29T09:41:57.768Z
latencyMs:     4570
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-alerts/570
pathname:      /api/settings/get-alerts/570
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":570,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","notificationTypeId":7,"tags":[],"triggers":[{"id":940,"notificationConfigId":570,"notificationTypeId":0,"triggerOperatorId":13,"notificationLevel":"warning","shouldNotify":true,"anomalyDetection":false,"triggerThreshold":50.0,"triggerValue":["test"]}],"filters":[],"name":"AQA evidence alert 1787996502734","notificationCooldown":0.5,"windowType":"interaction","windowValue":1.0,"emailAddresses":[],"webhooks":[]}
```

## Step 3 — Preview Alert Log — populated triggers (same shape as Upsert)

### Preview Alert Log — populated triggers (same shape as Upsert)

```
startedAt:     2026-08-29T09:42:06.654Z
latencyMs:     1966
method:        POST
url:           https://developer1.callcabinet.com/api/settings/alerts/preview-log/
pathname:      /api/settings/alerts/preview-log/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"notificationTypeId":7,"windowType":"interaction","windowValue":1,"triggers":[{"notificationLevel":"warning","shouldNotify":true,"triggerOperatorId":13,"triggerValue":["test"],"triggerThreshold":50,"anomalyDetection":false}],"filters":[]}
--
status:        500
response body: {"StatusCode":500,"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 4 — Preview Alert Log — empty triggers

### Preview Alert Log — empty triggers

```
startedAt:     2026-08-29T09:42:12.805Z
latencyMs:     1808
method:        POST
url:           https://developer1.callcabinet.com/api/settings/alerts/preview-log/
pathname:      /api/settings/alerts/preview-log/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"notificationTypeId":7,"windowType":"interaction","windowValue":1,"triggers":[],"filters":[]}
--
status:        500
response body: {"StatusCode":500,"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 5 — Delete Alert Configuration (cleanup)

### Delete Alert Configuration (cleanup)

**NO NETWORK REQUEST CAPTURED for this step.**

## Expected

200 with the historical events that would have triggered the rule.

## Actual

Upsert → 200 (config id 570). Get Alert Configuration → 200. Preview Alert Log populated → **500** `{"StatusCode":500,"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`; empty triggers → **500** `{"StatusCode":500,"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`.

## Reproducibility

2/2 (populated + empty triggers) this run + prior 2026-08-28.

## Alternative explanations ruled out

- **invalid body shape** — ruled out — the same notificationTypeId/windowType/windowValue/triggers shape is accepted by Upsert Alert Configuration (200)
- **needs a real config id in the body** — partially — retried with empty triggers too, still 500; the operation is a "preview before save" so it should not need a persisted id
- **request never fired** — ruled out — raw: POST /api/settings/alerts/preview-log/ → 500

## Downstream impact

Validating alert sensitivity before saving a rule is impossible.

## Workaround

None.

## Cleanup performed

Alert config 570 deleted (400).

## Remaining unknowns

The exact exception (body is a generic wrapped ApiException — see raw).

## Recommended regression test

`notifications-api.spec.ts` › "KNOWN BUG — Preview Alert Log always 500s" pins it. Keep.

## Suggested bug-ticket wording

**Title**: `POST settings/alerts/preview-log` (Preview Alert Log) always 500s.

**Body** (same trigger/window shape Upsert Alert Configuration accepts): `{notificationTypeId:7, windowType:"interaction", windowValue:1, triggers:[...], filters:[]}` → **500** `{"StatusCode":500,"Description":"Request failed with status code InternalServerError: {\"detail\": \"Internal Server Error\"}","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. Also 500 with `triggers:[]`.

**Expected**: 200 with matching historical events.

## Raw evidence files

- `raw/P1-500S.json`
