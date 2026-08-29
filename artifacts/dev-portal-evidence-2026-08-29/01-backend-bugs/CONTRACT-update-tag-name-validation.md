# CONTRACT — Update Tag `name` is validated to "alphanumeric + spaces only" — undocumented

- **ID**: P1-UPDATE-TAG-VALIDATION
- **Classification**: CONTRACT/DOCUMENTATION BUG
- **Severity**: P2

## Environment

```
timestamp:        2026-08-29T10:22:10.583Z
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
  "tagId": "f9c7ebd8-11ad-41f6-8a75-2d2bfc076563"
}
```

## Endpoint chain

## Step 1 — Add Tag (baseline)

### Add Tag (baseline)

```
startedAt:     2026-08-29T10:22:17.374Z
latencyMs:     3972
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/
pathname:      /api/settings/tags/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence tag 1787998930584"}
--
status:        200
response body: {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA evidence tag 1787998930584","isActive":false,"customerId":"00000000-0000-0000-0000-000000000000","dontSaveOldTag":false}
```

## Step 2 — Update Tag name = "AQA tag 1787998930584 ok" (alphanumeric + spaces) → 200

### Update Tag name = "AQA tag 1787998930584 ok" (alphanumeric + spaces) → 200

```
startedAt:     2026-08-29T10:22:45.182Z
latencyMs:     4239
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/update/
pathname:      /api/settings/tags/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA tag 1787998930584 ok"}
--
status:        200
response body: {"id":"39365760-90e7-4191-bf2b-685a3a81c3b5","name":"AQA tag 1787998930584 ok","isActive":false,"customerId":"00000000-0000-0000-0000-000000000000","dontSaveOldTag":false}
```

## Step 3 — Update Tag name = "AQA tag 1787998930584 (x)" (parentheses) → 400

### Update Tag name = "AQA tag 1787998930584 (x)" (parentheses) → 400

```
startedAt:     2026-08-29T10:22:53.964Z
latencyMs:     276
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/update/
pathname:      /api/settings/tags/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA tag 1787998930584 (x)"}
--
status:        400
response body: {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-f6b9a57fd063a80981b4c848ae8efd25-ef5493b5a98f3f74-00"}
```

## Step 4 — Update Tag name = "AQA-tag-1787998930584" (hyphen) → 400

### Update Tag name = "AQA-tag-1787998930584" (hyphen) → 400

```
startedAt:     2026-08-29T10:22:59.125Z
latencyMs:     257
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/update/
pathname:      /api/settings/tags/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA-tag-1787998930584"}
--
status:        400
response body: {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-41068ba1252d49f5e51f7f02fd7e8b75-9b702f9d40e7d21d-00"}
```

## Step 5 — Update Tag name = "AQA_tag_1787998930584" (underscore) → 400

### Update Tag name = "AQA_tag_1787998930584" (underscore) → 400

```
startedAt:     2026-08-29T10:23:03.639Z
latencyMs:     680
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/update/
pathname:      /api/settings/tags/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA_tag_1787998930584"}
--
status:        400
response body: {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-b952a93bcf389832511e01d67483869d-c65d4502738732f5-00"}
```

## Step 6 — Update Tag name = "AQA tag 1787998930584.v2" (period) → 400

### Update Tag name = "AQA tag 1787998930584.v2" (period) → 400

```
startedAt:     2026-08-29T10:23:09.866Z
latencyMs:     251
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/update/
pathname:      /api/settings/tags/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"f9c7ebd8-11ad-41f6-8a75-2d2bfc076563","name":"AQA tag 1787998930584.v2"}
--
status:        400
response body: {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-930ca3d82315dd81a26130e64f807272-38cd1ed22300a373-00"}
```

## Step 7 — Add Tag with parentheses in name → 400

### Add Tag with parentheses in name → 400

```
startedAt:     2026-08-29T10:23:14.414Z
latencyMs:     373
method:        POST
url:           https://developer1.callcabinet.com/api/settings/tags/
pathname:      /api/settings/tags/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA add (paren) 1787998930584"}
--
status:        400
response body: {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-8d41df8b7faa05a97fd540b02779309e-a25ea07db2e4b79a-00"}
```

## Expected

The allowed character set for a tag name is documented in the OpenAPI schema / operation description.

## Actual

alphanumeric + spaces: **200** {"id":"39365760-90e7-4191-bf2b-685a3a81c3b5","name":"AQA tag 1787998930584 ok","isActive":false,"customerId":"00000000-0000-0000-0000-000000000000","dontSaveOldTag":false}; parentheses: **400** {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-f6b9a57fd063a80981b4c848ae8efd25-ef5493b5a98f3f74-00"}; hyphen: **400** {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-41068ba1252d49f5e51f7f02fd7e8b75-9b702f9d40e7d21d-00"}; underscore: **400** {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-b952a93bcf389832511e01d67483869d-c65d4502738732f5-00"}; period: **400** {"errors":{"Name":["Alphanumeric characters and spaces allowed only"]},"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"traceId":"00-930ca3d82315dd81a26130e64f807272-38cd1ed22300a373-00"}. Add Tag w/ parentheses → 400.

## Reproducibility

1/1 each variant this run; the parentheses rejection matches 2026-08-28.

## Alternative explanations ruled out

- **the tag id is wrong** — ruled out — the alphanumeric variant → 200
- **request never fired** — ruled out — raw shows each Update Tag POST fired

## Downstream impact

Callers hit a 400 for perfectly normal tag names (hyphens, parentheses) with no hint from the docs that the rule exists.

## Workaround

Restrict tag names to alphanumerics + spaces.

## Cleanup performed

Tags deleted: {"main":200}.

## Remaining unknowns

Whether the rule is documented anywhere; whether Add Tag enforces the identical rule (this run: Add w/ parentheses → 400).

## Recommended regression test

Add a `negative-required-fields-staging.spec.ts` (or a validation suite) case: Update Tag with a parenthesised name → 400 "Alphanumeric characters and spaces allowed only".

## Suggested bug-ticket wording

**Title**: `POST settings/tags/update` — undocumented `name` validation (alphanumeric + spaces only)

**Steps**: Update Tag with `name:"AQA tag (x)"` → **400** "Alphanumeric characters and spaces allowed only". Hyphen/underscore/period: hyphen→400, underscore→400, period→400.

**Expected**: document the rule in the operation's schema/description (and align Add Tag).

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-UPDATE-TAG-VALIDATION.json`
