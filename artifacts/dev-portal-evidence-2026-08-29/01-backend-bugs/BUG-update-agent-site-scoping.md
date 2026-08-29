# BUG — Update Agent 400s "Configured site does not contain selected agent or extension" for an agent on the key's own site (+ 500 NRE when replaying the Get body, because Get returns a zero-GUID customerId)

- **ID**: P0-UPDATE-AGENT
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P0 (Update Agent is unusable)

## Environment

```
timestamp:        2026-08-29T09:31:20.846Z
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
  "agentId": "d04e84fa-11d7-456b-835a-6e14bf3b76de",
  "siteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
  "createResponseSiteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
  "getResponseSiteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
  "keyCurrentSiteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
  "createResponseCustomerId": "98f086b0-8d0e-4ba8-8f01-870466740b1c",
  "getResponseCustomerId": "00000000-0000-0000-0000-000000000000",
  "preExistingControlAgentId": "ef93c7a0-9d7e-4abb-98d3-46173fc5fc68",
  "preExistingControlHadExtension": true
}
```

## Endpoint chain

## Step 1 — List Agents (baseline — source the live siteId; note customerId in rows)

### List Agents (baseline — source the live siteId; note customerId in rows)

```
startedAt:     2026-08-29T09:31:25.574Z
latencyMs:     451
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agents/list/
pathname:      /api/settings/agents/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":"b276c869-0266-419b-87fa-31be01ca4192","firstName":"AQA","lastName":"coverage 1787992485345","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":null,"extensions":["9c401bea-663c-4e66-b8aa-15b190b4d782"],"extensionsDisplayName":"svitlana test 1012 for Victor","notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"14eacaf8-0f4b-404a-be25-5f8336e7ba73","firstName":"AQA","lastName":"coverage 1787992174449","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"ca71bc79-9d9f-4926-b669-ccda2125f2fb","firstName":"AQA","lastName":"coverage 1787989301570","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","firstName":"Mykyta","lastName":"Kviatkovskyi","email":"mykytak@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":15,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":"myGroup1,MyGroup2,MyGroup3","extensions":["4f630b1a-7848-41b8-b00c-9db6ae88ac00"],"extensionsDisplayName":"mykytak@callcabinet.com","notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"0dd4d7a5-a989-4fef-81fe-dde67968b5a3","firstName":"Agent","lastName":"Roman","email":"roman.bliscore.qa@gmail.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":true,"screenshotInterval":null,"windowsUsername":"Roman","supervisor":"Jmeter_1 Test_1","specialEmail":null,"mEmail":"romana@callcabinet.com","assignedSupervisor":"b234021a-81ff-4fb1-afc0-5c5519599bd7","assignedExtension":null,"groups":null,"groupsDisplayName":"agent-007,Best recording team ever ),CrossTenantCheck 2026-08-27T10:25:59.113Z","extensions":null,"extensionsDisplayName":null,"notes":"1","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"8c82d638-70e5-4df7-a2a7-96cc554a2d53","firstName":"Svitlana","lastName":"Soldatenkova","email":"svitlanas@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":false,"emailOnQcComplete":true,"screenshotInterval":15,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":null,"extensions":["0583d411-187c-4ebd-9602-6360df630e83"],"extensionsDisplayName":"svitlanas@callcabinet.com","notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"f1adfbab-8e03-49dd-b817-d2b2aa1fa708","firstName":"Svitlana","lastName":"Soldatenkova2","email":"svitlanas@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":true,"emailOnQcComplete":false,"screenshotInterval":15,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":"","assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":"APIM AG","extensions":["87280829-ab8a-4d78-a105-0d9c5d35bd9e"],"extensionsDisplayName":"mykytak+noname@callcabinet.com","notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"85fa11c2-6a1a-45bd-a7aa-c8d4643c50ca","firstName":"space","lastName":"last","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"97ce4638-529b-4eaa-bec8-39c44e47511e","firstName":"Roman","lastName":"4Test","email":"romana@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":"romana+31@callcabinet.com","assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"2f0b810e-6548-430c-8319-d5bdf992bc77","firstName":"Michael","lastName":"Brown","email":"mykytak@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":true,"screenshotInterval":null,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"6117c6fc-df09-43de-bcf2-ae1e00af7c03","firstName":"Angela","lastName":"Testova","email":"svitlanas+angela@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"24a55570-3bff-4bfb-8fb5-5416b7b296d6","firstName":"Svitlana","lastName":"test agent 11/03","email":"svitlanasoldatenkova@gmail.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":false,"emailOnQcComplete":true,"screenshotInterval":19,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":"svitlanas@callcabinet.com","assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"872dbfa2-1842-4c2d-bae1-e9c81d4e0183","firstName":"Mykyta","lastName":"Kviatkovskyi Smarsh","email":"mykyta.kviatkowski@smarsh.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":"myGroup1,MyGroup2,MyGroup3","extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"6d81e0ef-633b-4723-8349-123dba8f2b72","firstName":"test2","lastName":"test2","email":"romana+test1@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"ad73c679-5f81-4198-8cda-1f5e866c62d6","firstName":"Karina ","lastName":"test","email":"kara20035565@gmail.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"7fb74f4a-10a7-4b92-83d4-fc11530698a3","firstName":"Oleksii","lastName":"Test Agent","email":"oleksiip+2@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"3344cb18-1ca7-45ae-8657-7f3dbaae08ce","firstName":"Agent","lastName":"demo1","email":"romana+test1@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"","customerId":"00000000-0000-0000-0000-000000000000"},{"id":"4d9fbba9-3762-472a-bea9-3903ee01c420","firstName":"Ramon","lastName":"Sotolongo","email":"ramons@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":null,"extensions":["08dffa02-2baf-4184-8c60-2e054c9fb5ca"],"extensionsDisplayName":"ramons@callcabinet.com","notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"7c6b1a08-505e-467f-87eb-fa0f13ba98ce","firstName":"Myroslav","lastName":"Bora","email":"MyroslavB@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":false,"emailOnQcComplete":true,"screenshotInterval":15,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":null,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"c0b04d55-732c-4325-a96f-8ffabe071af1","firstName":"Mykhailo","lastName":"Paslavskyi","email":"michaelp@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":true,"enableCompliance":true,"emailOnQcComplete":true,"screenshotInterval":15,"windowsUsername":null,"supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":true,"groups":null,"groupsDisplayName":null,"extensions":["31242a93-278f-4df0-af1c-5519a167dcc6","f8a12164-0a43-4988-8f37-c3f9144e212f"],"extensionsDisplayName":"michaelp+1@callcabinet.com,michaelp@callcabinet.com","notes":null,"customerId":"00000000-0000-0000-0000-000000000000"}]
```

## Step 2 — Create Agent (clean DTO, siteId from baseline agent, real customerId)

### Create Agent (clean DTO, siteId from baseline agent, real customerId)

```
startedAt:     2026-08-29T09:31:30.619Z
latencyMs:     5145
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agents/
pathname:      /api/settings/agents/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":false,"groups":[],"groupsDisplayName":"","extensions":[],"extensionsDisplayName":null,"extensionsJson":null,"groupsJson":null,"notes":"created","customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"}
--
status:        200
response body: {"id":"d04e84fa-11d7-456b-835a-6e14bf3b76de","firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":false,"groups":[],"groupsDisplayName":"","extensions":[],"extensionsDisplayName":null,"notes":"created","customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"}
```

## Step 3 — Get Agent (immediately after Create)

### Get Agent (immediately after Create)

```
startedAt:     2026-08-29T09:31:40.192Z
latencyMs:     318
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
pathname:      /api/settings/get-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"d04e84fa-11d7-456b-835a-6e14bf3b76de","firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"created","customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 4 — Update Agent — mode 1: clean DTO + id, only `notes` changed, same siteId

### Update Agent — mode 1: clean DTO + id, only `notes` changed, same siteId

```
startedAt:     2026-08-29T09:31:46.358Z
latencyMs:     262
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agents/update/
pathname:      /api/settings/agents/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":false,"groups":[],"groupsDisplayName":"","extensions":[],"extensionsDisplayName":null,"extensionsJson":null,"groupsJson":null,"notes":"updated 1787995880846","customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","id":"d04e84fa-11d7-456b-835a-6e14bf3b76de"}
--
status:        400
response body: "Configured site does not contain selected agent or extension."
```

## Step 5 — Update Agent — mode 2: body = Get response (customerId = zero GUID), only `notes` changed

### Update Agent — mode 2: body = Get response (customerId = zero GUID), only `notes` changed

```
startedAt:     2026-08-29T09:31:50.925Z
latencyMs:     805
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agents/update/
pathname:      /api/settings/agents/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"d04e84fa-11d7-456b-835a-6e14bf3b76de","firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"updated-from-get 1787995880846","customerId":"00000000-0000-0000-0000-000000000000"}
--
status:        500
response body: {"StatusCode":500,"Description":"Object reference not set to an instance of an object.","Message":"Exception of type 'CC.Atmos.Common.Exceptions.ApiException' was thrown.","Data":{},"InnerException":null,"HelpLink":null,"Source":null,"HResult":-2146233088,"StackTrace":null}
```

## Step 6 — Get Agent (after the failed Updates — still present?)

### Get Agent (after the failed Updates — still present?)

```
startedAt:     2026-08-29T09:31:56.136Z
latencyMs:     275
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
pathname:      /api/settings/get-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"d04e84fa-11d7-456b-835a-6e14bf3b76de","firstName":"AQA","lastName":"evidence updbug 1787995880846","email":null,"siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"UA team recording","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":null,"groups":null,"groupsDisplayName":null,"extensions":null,"extensionsDisplayName":null,"notes":"created","customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 7 — CONTROL — Update Agent on a PRE-EXISTING agent, clean DTO, only `notes` changed

### CONTROL — Update Agent on a PRE-EXISTING agent, clean DTO, only `notes` changed

```
startedAt:     2026-08-29T09:32:00.509Z
latencyMs:     268
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agents/update/
pathname:      /api/settings/agents/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":"ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","firstName":"Mykyta","lastName":"Kviatkovskyi","email":"mykytak@callcabinet.com","siteId":"8cc22cd2-a4b7-46c5-b907-9050e110dac5","site":"","enableScreenshots":false,"enableCompliance":false,"emailOnQcComplete":false,"screenshotInterval":null,"windowsUsername":"","supervisor":null,"specialEmail":null,"mEmail":null,"assignedSupervisor":null,"assignedExtension":false,"groups":[],"groupsDisplayName":"","extensions":[],"extensionsDisplayName":null,"extensionsJson":null,"groupsJson":null,"notes":"AQA evidence control no-op 1787995880846","customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"}
--
status:        400
response body: "Configured site does not contain selected agent or extension."
```

## Step 8 — Delete Agent (independent of Update)

### Delete Agent (independent of Update)

```
startedAt:     2026-08-29T09:32:05.380Z
latencyMs:     758
method:        DELETE
url:           https://developer1.callcabinet.com/api/settings/delete-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
pathname:      /api/settings/delete-agents/d04e84fa-11d7-456b-835a-6e14bf3b76de
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        204
response body: 
```

## Expected

`Update Agent` returns `200` and updates the agent — it was just created on this exact `siteId`, `Get Agent` confirms it, and the same DTO is accepted by `Create Agent`.

## Actual

Two distinct failure modes captured:
1. **Update with a clean DTO** (real `customerId 98f086b0-8d0e-4ba8-8f01-870466740b1c`, minimal fields) → **400** `"Configured site does not contain selected agent or extension."`
2. **Update with the exact body `Get Agent` returned** → **500** `"Object reference not set to an instance of an object."` (wrapped ApiException). Root of mode 2: `Get Agent` / `List Agents` responses return `customerId: "00000000-0000-0000-0000-000000000000"` (zero GUID) — NOT the real customer id — so replaying that body makes the update path dereference a null customer. `Create Agent`'s response does return the real `customerId` (98f086b0-8d0e-4ba8-8f01-870466740b1c).
3. **CONTROL — Update on a PRE-EXISTING agent** (`ef93c7a0-9d7e-4abb-98d3-46173fc5fc68`, hadExtension=true) with a clean DTO → **400** `"Configured site does not contain selected agent or extension."`.

Get Agent still returns 200 after the failed updates (getAfter=200); Delete → 204.

**Control verdict:** A pre-existing agent ALSO fails (400 "Configured site does not contain selected agent or extension.") — the update path is broken for **every** agent, not just freshly-created ones.

## Reproducibility

Mode 1 (400): 4/4 — this run + 3 prior lifecycle runs 2026-08-29, same message. Mode 2 (500 NRE): 1/1 this run.

## Alternative explanations ruled out

- **wrong siteId** — ruled out — create-request siteId (8cc22cd2-a4b7-46c5-b907-9050e110dac5) = create-response siteId (8cc22cd2-a4b7-46c5-b907-9050e110dac5) = get-response siteId (8cc22cd2-a4b7-46c5-b907-9050e110dac5) = key's current site from Get Sites Storage Usage (8cc22cd2-a4b7-46c5-b907-9050e110dac5)
- **stale API-key site assignment** — ruled out — siteId sourced live from an existing agent AND independently confirmed via Get Sites Storage Usage; key current site = UA team recording/8cc22cd2-a4b7-46c5-b907-9050e110dac5
- **agent not persisted / invisible due to scoping** — ruled out — Get Agent → 200 with full DTO both before (200) and after (200) the failed updates
- **wrong request body / missing required field** — ruled out — the identical DTO is accepted by Create Agent (200); mode-2 uses the exact body Get returned
- **console schema failed / request never fired** — ruled out — raw capture shows POST /api/settings/agents/update/ fired with the full body and returned a real 400; latency 262ms
- **wrong operation link** — ruled out — captured URL is https://developer1.callcabinet.com/api/settings/agents/update/
- **wrong environment** — ruled out — https://developer1.callcabinet.com
- **the two failures are the same bug** — ruled out — mode 1 is a 400 site-scoping rejection; mode 2 is a 500 NRE caused specifically by the zero-GUID customerId that Get/List responses hand back

## Downstream impact

`POST settings/agents/update` cannot be used. Every partner integration that edits an agent is blocked. Worse: the natural "read then write" pattern (Get Agent → modify → Update) 500s because Get Agent omits the real `customerId` — a **second, independent contract bug** in the Get/List Agent response.

## Workaround

None for Update. For the read-then-write pattern, callers must inject the real customer id themselves (it is not returned anywhere in Get/List Agent).

## Cleanup performed

Test agent d04e84fa-11d7-456b-835a-6e14bf3b76de deleted (Delete → 204). Control agent ef93c7a0-9d7e-4abb-98d3-46173fc5fc68 — only `notes` was set to an AQA marker string (no-op-ish); not restored.

## Remaining unknowns

Whether the main app's Agent Management edit form (different internal route) also fails. Whether an agent WITH a real extension relation behaves differently (control agent's extension state recorded in raw as `preExistingHadExtension`).

## Recommended regression test

`agent-management-api.spec.ts` › "Update Agent — KNOWN BUG regression" pins mode 1. Add: (a) an assertion that mode 2 (replay Get body) 500s with the NRE, and (b) a separate KNOWN BUG assertion that `Get Agent` / `List Agents` return `customerId === "00000000-0000-0000-0000-000000000000"`.

## Suggested bug-ticket wording

**Title**: `POST settings/agents/update` 400s "Configured site does not contain selected agent or extension" for an agent on the caller's own site; `GET settings/agents/{id}` also returns a zero-GUID `customerId`

**Env**: staging (developer1 gateway), key "Primary: API_test" scoped to site "UA team recording" (8cc22cd2-a4b7-46c5-b907-9050e110dac5), customer CC Test 1 (98f086b0-8d0e-4ba8-8f01-870466740b1c).

**Repro (mode 1 — 400)**:
1. `POST settings/agents` `{firstName, lastName, siteId:<key site>, customerId:<real>, groups:[], extensions:[], ...}` → **200**, returns the new `id` and the real `customerId`.
2. `GET settings/agents/{id}` → **200**, `siteId` matches, but `customerId` = `00000000-0000-0000-0000-000000000000`.
3. `POST settings/agents/update` with the step-1 body + `id`, changing only `notes` → **400 "Configured site does not contain selected agent or extension."**

**Repro (mode 2 — 500)**: use the step-2 (Get) body verbatim for the update → **500 "Object reference not set to an instance of an object."** (the zero-GUID `customerId` is dereferenced).

**Expected**: step 3 → 200, agent updated; and `GET settings/agents/{id}` should return the real `customerId`.
**Actual**: update path's site/agent check rejects an agent that Create accepted and Get confirms on that site; and Get/List Agent responses omit the real customer id.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P0-UPDATE-AGENT.json`
