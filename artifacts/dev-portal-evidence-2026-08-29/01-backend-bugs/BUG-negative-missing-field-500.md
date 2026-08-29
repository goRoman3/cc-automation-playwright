# BUG — Add IP Whitelist and Create Custom Role return 500 (not a 400 validation error) when a required field is omitted

- **ID**: P1-NEGATIVE-500S
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P1 (validation gaps — unhandled null instead of a 400)

## Environment

```
timestamp:        2026-08-29T10:06:32.530Z
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
  "testIp": "203.0.113.49",
  "createdRoleName": "AQA evidence role neg 1787998017305"
}
```

## Endpoint chain

## Step 1 — Add IP Whitelist — body `{}` (ipAddress omitted)

### Add IP Whitelist — body `{}` (ipAddress omitted)

```
startedAt:     2026-08-29T10:06:37.373Z
latencyMs:     266
method:        POST
url:           https://developer1.callcabinet.com/api/settings/ip-whitelist/
pathname:      /api/settings/ip-whitelist/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {}
--
status:        500
response body: {"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 2 — Add IP Whitelist — valid body {ipAddress:"203.0.113.49"} (control)

### Add IP Whitelist — valid body {ipAddress:"203.0.113.49"} (control)

```
startedAt:     2026-08-29T10:06:41.865Z
latencyMs:     3430
method:        POST
url:           https://developer1.callcabinet.com/api/settings/ip-whitelist/
pathname:      /api/settings/ip-whitelist/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"ipAddress":"203.0.113.49"}
--
status:        200
response body: {"id":1526,"customerId":null,"ipAddress":"203.0.113.49"}
```

## Step 3 — Create Custom Role — body `{}` (name omitted)

### Create Custom Role — body `{}` (name omitted)

```
startedAt:     2026-08-29T10:06:57.012Z
latencyMs:     293
method:        POST
url:           https://developer1.callcabinet.com/api/settings/custom-roles/
pathname:      /api/settings/custom-roles/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {}
--
status:        500
response body: {"StatusCode":500,"Description":"An error occurred while saving the entity changes. See the inner exception for details.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 4 — Create Custom Role — valid body {name:"..."} (control)

### Create Custom Role — valid body {name:"..."} (control)

```
startedAt:     2026-08-29T10:07:02.417Z
latencyMs:     276
method:        POST
url:           https://developer1.callcabinet.com/api/settings/custom-roles/
pathname:      /api/settings/custom-roles/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence role neg 1787998017305"}
--
status:        200
response body: {"id":"c730305a-cf92-4d78-a323-3cb67d9917a0","name":"AQA evidence role neg 1787998017305","access":null,"locked":false,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Expected

A missing required field → `400` with a field-level validation message.

## Actual

Add IP Whitelist, ipAddress omitted → **500** `{"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. Valid body → 200 (endpoint works).

Create Custom Role, name omitted → **500** `{"StatusCode":500,"Description":"An error occurred while saving the entity changes. See the inner exception for details.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. Valid body → 200 (endpoint works).

## Reproducibility

1/1 each this run; matches 2026-08-28 seventh session.

## Alternative explanations ruled out

- **endpoint is just broken** — ruled out — both endpoints return 200/200 with a valid body
- **request never fired** — ruled out — raw shows the POSTs fired and returned 500/500

## Downstream impact

Callers get an opaque 500 instead of knowing which field they missed. Minor, but it hides an unhandled-null path.

## Workaround

Always send the required fields.

## Cleanup performed

IP whitelist entry deleted (200). Custom role "AQA evidence role neg 1787998017305" left (Delete Custom Role console is broken — see console-race report); disposable.

## Remaining unknowns

Whether other Add/Create endpoints share this (Add Tag/Site/Extension return a clean 400 per 2026-08-28).

## Recommended regression test

`negative-required-fields-staging.spec.ts` already has "KNOWN BUG — Add IP Whitelist 500s ... when ipAddress is omitted" and "KNOWN BUG — Create Custom Role 500s ... when name is omitted". Keep.

## Suggested bug-ticket wording

**Title**: `POST settings/ip-whitelist` and `POST settings/custom-roles` return 500 instead of 400 when a required field is missing.

**Steps**: `POST settings/ip-whitelist {}` → **500** `{"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. `POST settings/custom-roles {}` → **500** `{"StatusCode":500,"Description":"An error occurred while saving the entity changes. See the inner exception for details.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}`. Both work with a valid body.

**Expected**: 400 with a field-level message.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-NEGATIVE-500S.json`
