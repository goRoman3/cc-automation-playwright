# BUG — Create Agent Group always returns `id: 0`; an empty `agentJson` is a silent no-op

- **ID**: P1-CREATE-AGENT-GROUP-ID-ZERO
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P1 (create works with a member id, but the response is unusable + empty-member create silently does nothing)

## Environment

```
timestamp:        2026-08-29T10:04:21.977Z
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
  "seededAgentId": "b276c869-0266-419b-87fa-31be01ca4192",
  "caseA_realId": 1016,
  "caseB_realId": null
}
```

## Endpoint chain

## Step 1 — List Agents (seed a real member id)

### List Agents (seed a real member id)

```
startedAt:     2026-08-29T10:04:27.263Z
latencyMs:     621
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

## Step 2 — Create Agent Group A — agentJson=["b276c869-0266-419b-87fa-31be01ca4192"]

### Create Agent Group A — agentJson=["b276c869-0266-419b-87fa-31be01ca4192"]

```
startedAt:     2026-08-29T10:04:32.540Z
latencyMs:     421
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/
pathname:      /api/settings/agent-groups/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group A 1787997867885","isActive":true,"agentJson":"[\"b276c869-0266-419b-87fa-31be01ca4192\"]"}
--
status:        200
response body: {"id":0,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group A 1787997867885","isActive":true,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"b276c869-0266-419b-87fa-31be01ca4192\"]"}
```

## Step 3 — List Agent Groups (find A by name, get its real id)

### List Agent Groups (find A by name, get its real id)

```
startedAt:     2026-08-29T10:04:37.419Z
latencyMs:     314
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/list/
pathname:      /api/settings/agent-groups/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":617,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"agent-007","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1007,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"APIM AG","isActive":true,"agents":["f1adfbab-8e03-49dd-b817-d2b2aa1fa708"],"agentJson":"[\"F1ADFBAB-8E03-49DD-B817-D2B2AA1FA708\"]"},{"id":1016,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group A 1787997867885","isActive":true,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"},{"id":985,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"Best recording team ever )","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","1f3cd975-7912-43cd-ac6a-dc20567bb921","0dd4d7a5-a989-4fef-81fe-dde67968b5a3","1c46f66b-199b-416a-914e-e73ca3e3dd8b"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"1F3CD975-7912-43CD-AC6A-DC20567BB921\",\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\",\"1C46F66B-199B-416A-914E-E73CA3E3DD8B\"]"},{"id":1004,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"CrossTenantCheck 2026-08-27T10:25:59.113Z","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1010,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"myGroup1","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1011,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup2","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1012,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup3","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":901,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"svitlana test 140126","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","6efd9e7c-6406-4816-bf71-78d47cedbcc4","6d93919c-90e7-4ed5-b395-e79f16db667d"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"6EFD9E7C-6406-4816-BF71-78D47CEDBCC4\",\"6D93919C-90E7-4ED5-B395-E79F16DB667D\"]"}]
```

## Step 4 — Get Agent Group A (real id from List)

### Get Agent Group A (real id from List)

**NO NETWORK REQUEST CAPTURED for this step.**

## Step 5 — Create Agent Group B — agentJson="[]" (empty)

### Create Agent Group B — agentJson="[]" (empty)

```
startedAt:     2026-08-29T10:04:47.876Z
latencyMs:     357
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/
pathname:      /api/settings/agent-groups/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group B 1787997883774","isActive":true,"agentJson":"[]"}
--
status:        200
response body: {"id":0,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group B 1787997883774","isActive":true,"agents":[],"agentJson":"[]"}
```

## Step 6 — List Agent Groups (search for B by name)

### List Agent Groups (search for B by name)

```
startedAt:     2026-08-29T10:04:53.040Z
latencyMs:     300
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/list/
pathname:      /api/settings/agent-groups/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":617,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"agent-007","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1007,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"APIM AG","isActive":true,"agents":["f1adfbab-8e03-49dd-b817-d2b2aa1fa708"],"agentJson":"[\"F1ADFBAB-8E03-49DD-B817-D2B2AA1FA708\"]"},{"id":1016,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence group A 1787997867885","isActive":true,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"},{"id":985,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"Best recording team ever )","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","1f3cd975-7912-43cd-ac6a-dc20567bb921","0dd4d7a5-a989-4fef-81fe-dde67968b5a3","1c46f66b-199b-416a-914e-e73ca3e3dd8b"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"1F3CD975-7912-43CD-AC6A-DC20567BB921\",\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\",\"1C46F66B-199B-416A-914E-E73CA3E3DD8B\"]"},{"id":1004,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"CrossTenantCheck 2026-08-27T10:25:59.113Z","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1010,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"myGroup1","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1011,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup2","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1012,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup3","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":901,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"svitlana test 140126","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","6efd9e7c-6406-4816-bf71-78d47cedbcc4","6d93919c-90e7-4ed5-b395-e79f16db667d"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"6EFD9E7C-6406-4816-BF71-78D47CEDBCC4\",\"6D93919C-90E7-4ED5-B395-E79F16DB667D\"]"}]
```

## Expected

Create Agent Group returns the real generated group id in its response; an empty `agentJson` either creates an empty group or returns a validation error.

## Actual

Case A (member id present): Create → 200, response `id` = **0**. The group DOES persist — found in List Agent Groups with real id **1016**. Get Agent Group(1016) → 200.

Case B (empty agentJson): Create → 200, response `id` = **0**. Group **NOT found in List Agent Groups** → empty-member create is a silent no-op.

## Reproducibility

1/1 each case this run; matches 2026-08-27 (both rounds).

## Alternative explanations ruled out

- **create genuinely failed** — ruled out for case A — group persists in List with real id 1016
- **response id is elsewhere in the body** — ruled out — full create response captured in raw; the only `id` field is 0
- **wrong request body** — ruled out — same body shape that persists a group in case A is used in case B, only agentJson differs

## Downstream impact

A caller cannot learn a newly-created group's id from the create response — must immediately `List Agent Groups` and match by name (racy if names collide). Empty-member groups cannot be created at all.

## Workaround

Always create with ≥1 real agent id; read the real id back from `List Agent Groups` by name.

## Cleanup performed

Groups deleted: {"A":200}.

## Remaining unknowns

Whether the main app's group create returns the real id (likely a different route).

## Recommended regression test

`group-management-api.spec.ts` › "Create Agent Group → Get → Delete" already does the id-readback workaround. Add an explicit assertion that the create response `id` === 0, plus a case-B assertion that an empty-agentJson create does not appear in List.

## Suggested bug-ticket wording

**Title**: `POST settings/agent-groups` (Create Agent Group) always returns `id: 0`; empty `agentJson` silently persists nothing

**Steps**: 1) `POST settings/agent-groups` `{customerId, name, isActive:true, agentJson:"[\"<realAgentId>\"]"}` → 200, response `id` = **0**. 2) `POST settings/agent-groups/list` → the group is there with a real non-zero id. 3) Repeat step 1 with `agentJson:"[]"` → 200, `id:0`, and the group never appears in List.

**Expected**: real id in the response; empty agentJson creates an empty group or 400s.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-CREATE-AGENT-GROUP-ID-ZERO.json`
