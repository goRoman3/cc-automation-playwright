# BUG — Get Alert Notification (old) always 500s (NRE), even for a real freshly-created config id

- **ID**: P1-GET-ALERT-NOTIFICATION-OLD
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
  "alertConfigId": 570,
  "bogusId": "1"
}
```

## Endpoint chain

## Step 1 — Upsert Alert Configuration (create)

### Upsert Alert Configuration (create)

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

## Step 2 — Get Alert Configuration (the non-legacy endpoint — works, proves the id is real)

### Get Alert Configuration (the non-legacy endpoint — works, proves the id is real)

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

## Step 3 — Get Alert Notification (old) — SAME real id

### Get Alert Notification (old) — SAME real id

```
startedAt:     2026-08-29T09:42:20.659Z
latencyMs:     281
method:        GET
url:           https://developer1.callcabinet.com/api/settings/alerts/old/570
pathname:      /api/settings/alerts/old/570
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        500
response body: {"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 4 — Get Alert Notification (old) — bogus id "1" (contrast)

### Get Alert Notification (old) — bogus id "1" (contrast)

```
startedAt:     2026-08-29T09:42:25.426Z
latencyMs:     290
method:        GET
url:           https://developer1.callcabinet.com/api/settings/alerts/old/1
pathname:      /api/settings/alerts/old/1
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        500
response body: {"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Expected

200 with the (legacy) alert-notification record for the id — or 404 for the bogus id.

## Actual

Get Alert Configuration (real id 570) → 200 (id is real). Get Alert Notification (old), same id → **500** `{"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. Bogus id "1" → **500** `{"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`.

## Reproducibility

1/1 real + 1/1 bogus this run + prior 2026-08-28.

## Alternative explanations ruled out

- **id does not exist** — ruled out — Get Alert Configuration returns the record for the same id (200)
- **id-format mismatch (int vs GUID)** — both real int id and bogus "1" produce the same 500 NRE
- **request never fired** — ruled out — raw: GET /api/settings/alerts/old/570 → 500

## Downstream impact

The legacy alert-notification lookup is completely broken; callers must use the non-legacy `Get Alert Configuration` instead.

## Workaround

Use `GET settings/alerts/{notificationId}` (non-legacy) — works.

## Cleanup performed

Alert config 570 deleted (400).

## Remaining unknowns

Whether any id ever worked on this legacy route.

## Recommended regression test

`notifications-api.spec.ts` › "KNOWN BUG — Get Alert Notification (old) always 500s" pins it (real id + NRE message). Keep.

## Suggested bug-ticket wording

**Title**: `GET settings/alerts/old/{notificationId}` (Get Alert Notification legacy) always 500s (NullReferenceException) even for a real id.

**Steps**: create a config via `POST settings/alerts` → note id N; `GET settings/alerts/{N}` → 200; `GET settings/alerts/old/{N}` → **500** `{"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`.

**Expected**: 200 or 404.

## Raw evidence files

- `raw/P1-500S.json`
