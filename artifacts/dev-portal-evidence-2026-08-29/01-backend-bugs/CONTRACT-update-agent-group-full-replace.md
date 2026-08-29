# CONTRACT — Update Agent Group is a full-record replace: omitting `isActive` silently deactivates the group

- **ID**: P1-UPDATE-AGENT-GROUP-FULLREPLACE
- **Classification**: NOT REPRODUCED
- **Severity**: P1 (data-affecting, easy to hit)

## Environment

```
timestamp:        2026-08-29T10:21:04.315Z
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
  "groupId": 1018,
  "name": "AQA evidence grp fullreplace 1787998869701"
}
```

## Endpoint chain

## Step 1 — Create Agent Group (isActive:true)

### Create Agent Group (isActive:true)

**NO NETWORK REQUEST CAPTURED for this step.**

## Step 2 — List Agent Groups → isActive before = true

### List Agent Groups → isActive before = true

```
startedAt:     2026-08-29T10:21:19.946Z
latencyMs:     325
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/list/
pathname:      /api/settings/agent-groups/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":617,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"agent-007","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1007,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"APIM AG","isActive":true,"agents":["f1adfbab-8e03-49dd-b817-d2b2aa1fa708"],"agentJson":"[\"F1ADFBAB-8E03-49DD-B817-D2B2AA1FA708\"]"},{"id":1018,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence grp fullreplace 1787998869701","isActive":true,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"},{"id":985,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"Best recording team ever )","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","1f3cd975-7912-43cd-ac6a-dc20567bb921","0dd4d7a5-a989-4fef-81fe-dde67968b5a3","1c46f66b-199b-416a-914e-e73ca3e3dd8b"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"1F3CD975-7912-43CD-AC6A-DC20567BB921\",\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\",\"1C46F66B-199B-416A-914E-E73CA3E3DD8B\"]"},{"id":1004,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"CrossTenantCheck 2026-08-27T10:25:59.113Z","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1010,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"myGroup1","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1011,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup2","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1012,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup3","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":901,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"svitlana test 140126","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","6efd9e7c-6406-4816-bf71-78d47cedbcc4","6d93919c-90e7-4ed5-b395-e79f16db667d"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"6EFD9E7C-6406-4816-BF71-78D47CEDBCC4\",\"6D93919C-90E7-4ED5-B395-E79F16DB667D\"]"}]
```

## Step 3 — Update Agent Group OMITTING isActive (id, customerId, name, agentJson only)

### Update Agent Group OMITTING isActive (id, customerId, name, agentJson only)

```
startedAt:     2026-08-29T10:21:25.678Z
latencyMs:     365
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/update/
pathname:      /api/settings/agent-groups/update/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":1018,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence grp fullreplace 1787998869701","agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"}
--
status:        200
response body: {"id":1018,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence grp fullreplace 1787998869701","isActive":false,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"}
```

## Step 4 — List Agent Groups → isActive after = true

### List Agent Groups → isActive after = true

```
startedAt:     2026-08-29T10:21:31.395Z
latencyMs:     292
method:        POST
url:           https://developer1.callcabinet.com/api/settings/agent-groups/list/
pathname:      /api/settings/agent-groups/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":100,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":617,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"agent-007","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1007,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"APIM AG","isActive":true,"agents":["f1adfbab-8e03-49dd-b817-d2b2aa1fa708"],"agentJson":"[\"F1ADFBAB-8E03-49DD-B817-D2B2AA1FA708\"]"},{"id":1018,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence grp fullreplace 1787998869701","isActive":true,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"},{"id":985,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"Best recording team ever )","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","1f3cd975-7912-43cd-ac6a-dc20567bb921","0dd4d7a5-a989-4fef-81fe-dde67968b5a3","1c46f66b-199b-416a-914e-e73ca3e3dd8b"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"1F3CD975-7912-43CD-AC6A-DC20567BB921\",\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\",\"1C46F66B-199B-416A-914E-E73CA3E3DD8B\"]"},{"id":1004,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"CrossTenantCheck 2026-08-27T10:25:59.113Z","isActive":true,"agents":["0dd4d7a5-a989-4fef-81fe-dde67968b5a3"],"agentJson":"[\"0DD4D7A5-A989-4FEF-81FE-DDE67968B5A3\"]"},{"id":1010,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"myGroup1","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1011,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup2","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":1012,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"MyGroup3","isActive":true,"agents":["ef93c7a0-9d7e-4abb-98d3-46173fc5fc68","d2967d17-555d-480b-a33e-ca210d45d4a3","872dbfa2-1842-4c2d-bae1-e9c81d4e0183"],"agentJson":"[\"EF93C7A0-9D7E-4ABB-98D3-46173FC5FC68\",\"D2967D17-555D-480B-A33E-CA210D45D4A3\",\"872DBFA2-1842-4C2D-BAE1-E9C81D4E0183\"]"},{"id":901,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"svitlana test 140126","isActive":true,"agents":["d8f6b6d1-f646-42b0-aa49-19cdfefe8580","6efd9e7c-6406-4816-bf71-78d47cedbcc4","6d93919c-90e7-4ed5-b395-e79f16db667d"],"agentJson":"[\"D8F6B6D1-F646-42B0-AA49-19CDFEFE8580\",\"6EFD9E7C-6406-4816-BF71-78D47CEDBCC4\",\"6D93919C-90E7-4ED5-B395-E79F16DB667D\"]"}]
```

## Expected

Either `isActive` is preserved when omitted (partial patch), or the schema marks it required so the caller must send it.

## Actual

isActive before = **true**. Update omitting isActive → 200 `{"id":1018,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c","name":"AQA evidence grp fullreplace 1787998869701","isActive":false,"agents":["b276c869-0266-419b-87fa-31be01ca4192"],"agentJson":"[\"B276C869-0266-419B-87FA-31BE01CA4192\"]"}`. isActive after (List) = **true**. → the 2026-08-28 full-replace deactivation is **not reproduced** — persistence kept `isActive:true`.

### Preserved observation — response-vs-persistence mismatch

The Update **response body** reported `"isActive":false`, but the subsequent
`List Agent Groups` shows the group with `"isActive":true`. So the update
endpoint's own response echoed a deactivation that did **not** happen in the
stored record. Whether this is a harmless response-serialisation artifact
(response omits/defaults `isActive` when the request omits it, while the
persistence layer correctly leaves it untouched) or a latent inconsistency,
it is worth keeping: a caller trusting the response would believe the group
was deactivated. This is the residue of the 2026-08-28 defect and the likely
place a regression would resurface.

## Reproducibility

Full-replace deactivation of the **persisted** record: **0/1 this run** (was 1/1 on 2026-08-28). Response-body `isActive:false` on an omitted-`isActive` update: 1/1 this run.

## Alternative explanations ruled out

- **the group was already inactive** — ruled out — isActive before = true
- **wrong group matched** — ruled out — matched by unique AQA name then by id
- **update failed** — ruled out — update → 200

## Downstream impact

On 2026-08-28 this silently deactivated the persisted group (agents stop being grouped for reporting/recording rules) for any caller doing a "change the name" style partial update with the docs' minimal set (`id, customerId, name, agentJson`). **This run the persisted record stayed active** — only the response body claimed `isActive:false`. If the deactivation behaviour returns, the impact is as described; meanwhile a caller that trusts the response would still wrongly believe the group is inactive.

## Workaround

Always send every field you want preserved, especially `isActive:true`.

## Cleanup performed

Group restored to isActive:true then deleted (200).

## Remaining unknowns

Whether other fields (agentJson, name) also full-replace to null/empty when omitted. Whether the OpenAPI marks isActive required.

## Recommended regression test

`group-management-api.spec.ts` › "Update Agent Group" already sends `isActive:true` explicitly and asserts the response `isActive === true` — with a comment about the full-replace trap. Keep. Consider a dedicated test that omits it and asserts the deactivation (KNOWN BUG) so a fix is noticed.

## Suggested bug-ticket wording

**Title**: `POST settings/agent-groups/update` is a full-record replace — omitting `isActive` deactivates the group

**Steps**: create an active group. `POST settings/agent-groups/update` with `{id, customerId, name, agentJson}` (no `isActive`) → 200; the group's `isActive` becomes **false**.

**Expected**: preserve `isActive` when omitted, or make it required in the schema and document the full-replace semantics.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-UPDATE-AGENT-GROUP-FULLREPLACE.json`
