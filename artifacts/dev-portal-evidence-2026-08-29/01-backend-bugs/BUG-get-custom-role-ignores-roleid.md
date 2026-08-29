# BUG — Get Custom Role ignores its `roleId` path parameter (returns an unrelated system role)

- **ID**: P0-GET-CUSTOM-ROLE
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P0 (Get Custom Role cannot fetch any specific role)

## Environment

```
timestamp:        2026-08-29T09:32:36.290Z
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
  "createdRoleId": "dfa8ea02-7921-4ca4-bab1-3c5f0572261c",
  "createdRoleName": "AQA evidence role 1787995956290",
  "bogusRoleId": "11111111-1111-1111-1111-111111111111"
}
```

## Endpoint chain

## Step 1 — Create Custom Role

### Create Custom Role

```
startedAt:     2026-08-29T09:32:40.712Z
latencyMs:     264
method:        POST
url:           https://developer1.callcabinet.com/api/settings/custom-roles/
pathname:      /api/settings/custom-roles/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"name":"AQA evidence role 1787995956290"}
--
status:        200
response body: {"id":"dfa8ea02-7921-4ca4-bab1-3c5f0572261c","name":"AQA evidence role 1787995956290","access":null,"locked":false,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 2 — List Custom Roles (verify the created role exists)

Created role **is** present in List Custom Roles: `{"id":"dfa8ea02-7921-4ca4-bab1-3c5f0572261c","name":"AQA evidence role 1787995956290","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"}`

### List Custom Roles (verify the created role exists)

```
startedAt:     2026-08-29T09:32:45.587Z
latencyMs:     271
method:        POST
url:           https://developer1.callcabinet.com/api/settings/custom-roles/list/
pathname:      /api/settings/custom-roles/list/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"skip":0,"take":200,"sort":[],"filter":{"logic":"and","filters":[]}}
--
status:        200
response body: [{"id":"30766b44-93cb-49ce-869e-e5da1147b1e1","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"6e78903e-393d-45c1-9e4a-ff8a34a6a66a","name":"Support User","access":"[2,27,28,20,21,29,116,30,36,39,40,41,42,118,22,23,24,26,31,37,38,43,44,45,46,49,51,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,99,125,126,127,135, 152,156, 157, 158,211]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"58b5c115-4cee-4038-9e14-7270d9594394","name":"Restricted Admin","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,39,22,23,24,25,26,31,37,38,58,59,60,61,62,76,77,78,79,80,81,82,83,84,120,121,122,123,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207,211]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"5c3edf86-7d09-4b54-afee-f8cce7445ba8","name":"Standard User","access":"[0,2,3,4,5,6,7,8,9,10,11,12,13,14,15,27,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"b2a21b8a-3f1f-459c-a6bd-09f03dd2328e","name":"Admin","access":"[0,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,52,53,54,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,109,110,112,99,120,121,122,123,125,126,127,129,135,149,152,156, 157, 158, 159, 160, 200, 201, 202, 203, 204, 205, 206, 207,211, 212, 213, 214, 216, 217, 218]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"d51c3090-15ef-48bb-9aac-03e4d31c1f50","name":"Super Admin","access":"[0,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,99,120,121,122,123,125,126,127,129,135,148,149, 152,156, 157, 158, 159, 160, 163, 164, 165, 166, 168, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 211, 212, 213, 214, 215, 216, 217, 218,219,220]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"},{"id":"ef342563-0d55-4230-9d58-2c2fb6ce0fa7","name":"[log test]","access":"[0,127,2,27,156,157,158,168,208,209,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,63,65,66,67,68,62,64,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,200,202,204,205,206,201]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"a3c71cf6-5219-4e87-8d0a-fa87c7e5aeec","name":"[mp_test]","access":"[0,1,127,2,27,28,156,157,158,168,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162,200,202,204,205,206,201,208,209]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"b1bccb60-6078-469d-94b5-818d13695e16","name":"[mp_test]_1","access":"[0,1,127,2,27,28,156,157,158,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,68,67,66,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162,200,202,204,205,206,201]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"1d2e3908-7fc9-409a-ac5e-7a67a02344aa","name":"[mp_test]123","access":"[5,6,7,12,13,14,108,34]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"04999d95-71de-4ed5-a71e-f9d2a84e35cc","name":"[new_mp]","access":"[27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,43,44,45,46,48,49,50,51,117,52,53,54,148]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"fab144c1-85a8-44b7-b5f0-1a89f45bdfb3","name":"148 qc test","access":"[39,49,50,148]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6b0948d0-546c-4cd4-89a3-c537ebbbe6d6","name":"43","access":"[2,5,6,39,218,214,215,217]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6ca6865d-4bea-4799-aa87-da64dd15f17e","name":"aaaaaa1","access":"[168,156,5,6,39,77]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"54df3002-0468-4b76-9907-5c94dbd279e0","name":"Admin Demo","access":"[0,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,99,120,121,122,123,125,126,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"8d8b6b3f-a21c-44f5-b059-8c78bb1b7dc4","name":"ADTest default user","access":"[5,6,39,22,23,24,25,26,31,38,43,44,45,46,49,50,51,119,55,56,57,58,59,60,61,62,63,65,66,67,68,69,70,71,72,76,77,78,79,80,83,84]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"d03b1d24-52bb-4969-8447-dc507ace2b76","name":"ADTest restricted user","access":"[1,3,5,6,39,119,55,56,57]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"59765c63-050c-4fb3-8def-1fecad190b43","name":"agent N","access":"[0,1,127,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"9e0f5abc-9ab8-4fcc-a40c-c8406f654d21","name":"Agent roleRole","access":"[39,59,63,64,66,67,68]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e75514ee-f7a3-40cc-8a9c-9ffd7d2b8277","name":"agent test M","access":"[39,59,63,64,66,67]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"841179e1-e985-4114-9b76-5f67880c956a","name":"alarm_management_test","access":"[3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,219]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"2c53bc1e-12ea-432b-97e7-22e9efea398f","name":"AlexTest","access":"[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3975983a-2911-4b34-834c-8be284148b0d","name":"AllMight","access":"[0,1,2,27,28,127,156,157,158,168,208,209,212,213,216,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,23,24,25,26,31,37,38,22,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,211,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,200,202,204,205,206,201,218,214,215,217,219,220]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"80f3b893-3f5e-44a4-af0c-80f6804c6e4e","name":"analyticsTest","access":"[3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"fe180897-f0d2-42ce-ae46-c188bac4125f","name":"analyticsTranscription01","access":"[2,158,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"f8ed9eb3-f4ec-4bf8-a223-57f9847b06cf","name":"APIM_TEST_ROLE_DO_NOT_TOUCH","access":"[0,127,2,27,28,156,157,158,168,208,209,216,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,211,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,125,126,200,202,204,205,206,201,218,215,217]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"d74c4815-139c-4ad7-9e1c-3cd3572102b2","name":"AQA coverage role 1787987967914 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"c6dcfedf-d15f-4b60-9704-89df75f5dded","name":"AQA coverage role 1787988164760 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"af00727e-700a-4b9b-a018-6abbc5baf2df","name":"AQA coverage role 1787992376488 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"94584834-ca10-4513-b9c2-8cdade745a64","name":"AQA coverage role 1787992605025 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"aff2ebc3-aab2-491b-91cf-22516855e41f","name":"AQA coverage role 1787994275460 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"20dd640e-ba6a-49f7-b2a1-6296c8bae252","name":"AQA coverage role 1787994425625 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"bf4cdadd-b777-48c3-8507-fa6f7ae2e0d4","name":"AQA coverage role 1787994647564","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"72242f77-eab7-4ca7-9da3-977ee470c3ec","name":"AQA coverage role 1787994713671 updated","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"8c12a294-2a0a-4029-a36c-1326dfa56ec6","name":"AQA delete-bug role 1787994780157","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e8162846-45ca-4a34-8b70-9f8248d3bfe3","name":"AQA evidence role 1787995559708","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"dfa8ea02-7921-4ca4-bab1-3c5f0572261c","name":"AQA evidence role 1787995956290","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"133c8c14-5188-4d1a-a40e-89791e24c0d1","name":"call listing permisions test","access":"[5,6,7,9]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"c75951ae-9c26-43bf-96b8-bab4137314cd","name":"callsdeleting test","access":"[5,13]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"b0b43a6b-6ca5-4bd9-9a5c-2589161f50b0","name":"Custom Restricted Yowi","access":"[0,1,127,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,44,43,45,49,54,119,57,56,55,59,67,66,70,77,80,81,121,120,122,123,125,126]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"68069726-33ec-4046-a972-2bd6ca9e358c","name":"CUSTOM Role","access":"[0,1,3,5,6,7,8,10,14,108,17,35,39,22,48,49,119,58,59,60,69,70,76,77,82,85,86,87,88,109,110,120,121,125,126,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"2f4bb7d7-c926-4fc9-b241-0d4653674a01","name":"Custom Role","access":"[0,1,2,27,3,4,5,39,159,160]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"29be2b09-2a90-4b4f-bf1e-b4a7a837d7f6","name":"Custom user role","access":"[1,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,39,118]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"ec98bbbf-8b1c-47af-9783-4e14dd75e8a5","name":"customPartner","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"f4f27fdc-10b0-4d16-9351-2626246b8d83","name":"dimaRoleTest","access":"[0,5,6,39,48,49,50,51,117,52,53,54,148]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3ff67c23-10c4-4567-b83d-8dcd4ba345dc","name":"dmitrysroletest","access":"[3,4,5,6,9,10,11,12,13,14,15,16,149,108,8]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"1220ff36-3fad-496b-9b20-1843c94b7f56","name":"DownloadTemplate","access":"[0,28,156,157,158,168,3,5,6,7,8,9,10,11,12,14,16,149,108,39,49,52,54,59,65]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e5a83344-19e4-4e39-ac76-adc34e2b849d","name":"Full Access","access":"[0,1,2,27,28,3,4,5,6,7,8,9,12,13,14,15,16,17,18,19,20,21,29,30,32,33,34,35,36,39,40,41,42,22,23,24,25,26,31,37,38,43,44,45,48,49,50,51,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,83,84,85,86,87,88,93,94,100,101,102,103,104,108,109,110,111,112,113,114,115,99,119,120,121,122,123,120,121,122,123,149,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"4db53063-900f-4a51-9083-bff3bb05f6c3","name":"full house","access":"[0,1,127,2,27,28,156,157,158,168,208,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,26,31,37,38,23,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,211,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162,200,202,204,205,206,201]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"5bb8460d-420c-4d74-9ab4-bb7c26662034","name":"gladiator","access":"[5,6,7,8,14,36,39,44,45,46,59,63,64,65,77,83,102,110,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"473594b0-b512-4941-8054-f86591708230","name":"Gorilla","access":"[0,1,127,2,27,28,156,157,158,208,209,212,213,216,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,53,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,200,202,204,205,206,201,218,214]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"9d7608b4-83f5-4919-8d03-17435d9ed372","name":"hup_role","access":"[0,1,127,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,22,23,24,25,26,31,37,38]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"06875a51-134f-421c-b44b-c5b219201ecf","name":"IT Admin","access":"[1,3,5,6,7,9,10,11,12,13,14,39,48,49,50,51,119,55,58,59,60,61,65,66,67,68,76,77,78,79,83,93]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"0e0b7818-98bc-4090-befe-cb23d7932286","name":"ITP User test1","access":"[1,3,5,6,7,10]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e092bfbf-5b93-4883-a44b-5290aad3a632","name":"karina test","access":"[1,127,5]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"8ec4468f-39e6-4f60-8e81-55bb6be0c3f6","name":"karina test12","access":"[127]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"a5c52c68-6978-44c5-87a7-2f92448cfdc4","name":"KatyRole","access":"[0,1,127,2,27,28,5,6,7,39]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"eed00b50-bb28-41c1-8b67-cd8cad97186c","name":"kozak_251126","access":"[127,2,27,28,156,157,158,5,6,20,21,29,116,30,36,39,40,41,42,118,22,23,24,26,31,37,38,43,44,45,46,49,51,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,99,125,126]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"fbd349b2-3de2-49dc-bb05-b4493a5f1ec7","name":"Legal Hold Support","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"9d372e5d-13e4-40d6-9eab-d595a381ee28","name":"Les user","access":"[1,27,3,4,5,6,7,8,9,10,12,14,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3dfb3e00-5c5c-4f9b-9bf8-9c7ea618d272","name":"Limited Admin","access":"[0,1,27]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"01364b3a-6cb2-405c-9947-ac83475390eb","name":"manualRedaction","access":"[0,1,127,2,27,28,156,157,158,168,208,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"983de8ec-36d7-47e8-9348-8cce4f72add3","name":"manualRedaction Approver","access":"[156,157,158,168,208,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"b2eaee24-866f-49fd-bfec-162ec2ef5801","name":"manualRedaction Requestor","access":"[0,1,127,2,27,28,156,157,158,168,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162,200,202,204,205,206,201]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"964095d0-4b61-4593-a817-a8d684455e59","name":"MAX_TWST","access":"[0,156]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"37e5874f-3dea-4755-b3fd-fb4d3a934da6","name":"Mikro Test","access":"[3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,120,121,122,123,120,121,122,123,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"a6e7f3a2-62dd-4957-a647-46cc17675404","name":"mockAdmin","access":"[39,48,49,50,52,53,54,51]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"86290e60-d911-4fb1-b2ad-c278aae90f41","name":"mykolaTestCallDeleteDisable","access":"[0,1,127,2,27,28,3,4,5,6,7,8,9,10,11,12,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"fb3d177b-3eb8-42ad-b327-574d9766f01d","name":"niktest","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"4443c91c-7f50-43d5-aa20-c9100605163e","name":"No permision","access":"[5,6,8,14,16,108,18,39,120,121,122,123]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"30069f77-e4f1-42bd-a56e-7002b24f1f8a","name":"no settings","access":"[3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,39,40]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"f62239ad-09a7-4223-9cfe-009149cf2282","name":"NoDownload","access":"[0,127,2,27,28,156,157,158,168,3,4,5,6,7,8,9,11,12,13,14,15,16,149,108,17,18,19,20,21,29,116,30,32,124,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162,200,202,204,205,206,201]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"9496d146-b7a8-4375-b9ad-23d10fac6bde","name":"NotificationViewOnly","access":"[39,118]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"77465545-136d-431e-8f3f-f92f499f9799","name":"Nrole","access":"[1,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"c76eedeb-8b3e-4797-b496-9ff500a7f95d","name":"Oleksii Test","access":"[157,158,5,6,39,48,49,50,51,117,52,53,54,148]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"b4ad2cd2-e337-44d1-b20e-da0ea77c7eea","name":"QA_screenshot_test","access":"[5,6,31,38,26]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"95bd51f8-222d-42da-8891-67d31287d03a","name":"Regression2909","access":"[28,5,6]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"b8ce2ca5-8cd0-46e0-b40c-f79aa4fab607","name":"resrtricted_test_kozak","access":"[5,7,14,3,8,6,39,40,118,42,41,36,35,34,33,124,32,30,116,29,21,20,19,18,17]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"21b085eb-e4ab-46d3-a293-c1fa6a006c83","name":"Restricted Admin Demo","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,39,22,23,24,25,26,31,37,38,58,59,60,61,62,76,77,78,79,80,81,82,83,84,120,121,122,123,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"0058f0d7-429c-46ee-86f0-0abbd1b687ff","name":"Restricted Custom Role (Test)","access":"[0,1,2,27,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,29,116,30,32,33,34,35,36,39,40,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,83,84,85,86,87,88,93,94,100,101,102,103,104,109,110,112,99,120,121,122,123,149,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6928253c-09ba-47b5-b176-0151e5212ea5","name":"Restricted roles test","access":"[1,3,5,6,7,10]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"d68a05c8-1b1c-4934-85e1-8508ea3532bb","name":"restricted_23_03","access":"[0,1,127,2,27,28,156,157,158,168,208,209,212,213,216,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,211,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,200,202,204,205,206,201,218,214,215,217,219,220,221,222,223,224]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"71b14b9a-ebc4-4615-b972-333abefad07b","name":"RESTRICTED_ALL","access":"[0,1,127,2,27,28,156,157,158,168,208,209,212,213,216,40,30,116,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,17,18,19,20,21,29,32,124,33,34,35,36,39,41,42,118,22,23,24,25,26,31,37,38,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,211,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,200,202,204,205,206,201,218,214,215,217]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"0a669a58-92c6-47b8-9217-3164c02128f4","name":"restrictedLogs","access":"[1,28,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,39,43,44,45,46,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"d6f8e008-2223-40a6-a63f-e65d83d4cc30","name":"restrictedView2","access":"[1]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"64c87814-a165-47d5-b717-81b0519b024d","name":"restrictTest","access":"[1]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"facc261a-7f78-4a8c-b53c-7ce4265cca8b","name":"RM Demo","access":"[3,5,22,23,24,25,26,31,37,38,119,55,56,57,69,70,71,72,76,77,78,79,80,83,84]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6117f699-3ee0-4f2c-bdb7-ecc4a878fdd0","name":"RM Training","access":"[3,4,5,38,48,63,59,49]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"2199f764-f44c-4619-8714-af22b46440e9","name":"role test qwe","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6220a7a0-58f9-43cc-a26d-1a5822a32fe7","name":"RoleModel1","access":"[39,59,58,60,62,61,63,64,67,66,65,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,100,101,102,103,104,109,110,112,129,99,120,121,122,123,125,126,159,160,161,162]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"a5f9f621-a5b2-4181-a243-2d4aed100f57","name":"ron","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"496166f5-ea99-477e-96b4-18c8093ff00c","name":"SecTest","access":"[2,5,6,39,118,116,22,25,26,43,44,48,49,119,58,59,66,67,69,70,76,77,85,86,93,94,101,102,109,129,120,121,125,159]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"77098b91-0e8c-4602-b17a-068bd4fed78e","name":"settings only","access":"[6,14,5,8,3,7,17,18,19,20,21,29,116,32,124,33,34,35,36,39,41,42,118,43,44,45,46,48,49,50,51,117,52,53,54,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"427a6a98-d608-43d6-8f90-f8bbd3ad293a","name":"settings only + [mp_test]_1 (SCIM-Merged)","access":"[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,99,100,101,102,103,104,108,109,110,112,116,117,118,119,120,121,122,123,124,125,126,127,129,148,149,156,157,158,159,160,161,162,200,201,202,204,205,206]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"cb00b196-a6f0-4daf-8720-68a7fbcb8ec4","name":"share extensions permission","access":"[0,1,127,2,27,28,20,21,29,116,30,124,36,39,40,41,42,118,22,23,24,26,31,37,38,43,44,45,46,49,50,117,52,53,54,148,119,55,56,57,58,59,60,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,109,110,112,99,120,121,122,123,125,126,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"37341720-7b34-48ca-9a95-b363c9668028","name":"shareTag","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"43ae6574-f6ee-44c4-86d0-9e4375eca971","name":"smoke role1","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"30d3394a-1d26-422b-9ffd-165f8719d43c","name":"Standard User Demo","access":"[0,2,27,5,6,22,23,24,25,26,31,37,38,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"634c35ae-c534-485c-9bbd-5c95fbc3bb69","name":"Strict Access","access":"[1,2,27,5,6,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"eeb3ee11-2bee-4b09-8299-c7627c49907c","name":"Support User Demo","access":"[2,27,28,20,21,29,116,30,36,39,40,41,42,118,22,23,24,26,31,37,38,43,44,45,46,49,51,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,94,100,101,102,103,104,99,125,126]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"73e63dbc-771b-4c6c-8e45-8306152f6fdd","name":"svitlana test","access":"[156,157,158,168,208,209,212,5,6,39,48,49,52,54,93]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"5b18d668-11e5-4389-9267-b435767772fa","name":"svitlana test 10/06","access":"[40,3,4,5,6,36]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e77d8a94-2f5a-4e04-a259-209e98da84b4","name":"svitlana test 1007 222","access":"[156,157,158,168]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"2ea34241-f065-4997-a394-986ea6bdc56a","name":"svitlana test 2","access":"[]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"9dd58777-dffc-4a3f-b0bd-ea4a438c4b6e","name":"svitlana test 2108 1","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"7e5508d7-1eec-433e-847c-d40261cc67b5","name":"svitlana test 3","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"42abffb5-535a-4aad-8f08-4b896acfd2d9","name":"svitlana test 6","access":"[0,127,2,28,5,6,39,44,59,63,93,109,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"94a46dd1-c960-4256-aab5-202b997b6b22","name":"test","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"75c6bfbd-ebb2-4136-810e-71c940a15a46","name":"test adobepophealth","access":"[1,2,5,3,4,6,7,8,9,10,11,12,14,15,16,39,17,18,19,20,21,33,34,42]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"7d33fa86-0f3a-42b2-8d1d-8d6abdaf309e","name":"Test Call","access":"[0,5,6,9,11,13,22,23,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"56525f3e-7f0d-43a4-88be-a30bb1901efe","name":"test role 1","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e4ad2dbd-d216-466d-838c-8398c5fb6390","name":"test role 166","access":"[158,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"5a817572-56b2-4edd-a14c-1f22b243cf58","name":"Test_Role (M_P)","access":"[0,1,127,2,27,3,5]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"5bf064c0-e8dc-4d87-a606-1a1f12def148","name":"Test_SM","access":"[0,6,8,9,11,17,18,19,32,33,34,35,39,40,41,42,22,23,24,25,26,31,37,38,43,99,44,149]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3021b43a-7951-4519-ab25-257e423b2f86","name":"Test_T","access":"[27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108,39,43,44,45,46,49,50,148,119,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,76,77,78,79,80,83,84,99,120,121]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"ad0f1438-e3ca-4c75-8136-ecd1ca668f44","name":"testApprover","access":"[156,157,158,168,208,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"8f2cdb40-9741-4cf5-9c54-b7edee66cc5e","name":"testArtem","access":"[0,1,127,2,27,28,156,157,158,3,4,5,6,7,8,39,102,129,159]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"e1c19c49-a54b-4db0-b6f5-0b3d00ff0e64","name":"Tester","access":"[1,27,3,4,5,6,7,8,9,10,14,17,18,19,20,29,43,44,48,49,50,51,119,58,59,60,93,94,109,120,121,122,123,125,126,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"d388939d-6d8c-4a01-98b6-c0ed82a4c4ed","name":"testError","access":"[1,39,58,59,60,61,62,63,64,65,66,67,68,76,77,78,79,80,81,82,83,84]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"44a6b23a-a85b-4762-8477-777a3a5bf9cd","name":"testingTagManagment","access":null,"locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"6ac2e99b-6888-4206-8fb9-4bcdacbe007e","name":"testRequestor ","access":"[156,157,158,168,209,3,4,5,6,7,8,9,10,11,12,13,14,15,16,149,108]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"32c3bbfc-bd3e-4277-805b-f1eea9336b91","name":"testSingleNote","access":"[5,6,8]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3fbbaf54-1ecb-4ba4-b85c-2aed76a83334","name":"Unique","access":"[0,1,3,4,5,6,7,8,9,10,14,15,16,108,17,18,19,32,34,36,39,48,49,50,51,52,53,54,148,119,58,59,109,110,112,120,121,122,123,125,126,129]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"98642eb6-84db-4a32-b679-ad519612d48c","name":"Viktor SSO test","access":"[212,40,30,216,116,39,58,59]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"5a3e4fb1-7c54-4f47-972a-d2c95549d67e","name":"z20Test`1","access":"[0,1,2,127,5,6,149,39,69,70]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"},{"id":"3e1f9b36-0e56-46f8-b32e-55187aa7dab4","name":"zelda_test_roleeeeeeeeeeeeeeeeeeee","access":"[0,1,3,4,5,6,7,8,9,14,15,16,108,36,39,48,49,50,51,117,52,53,54,148]","locked":false,"customerId":"98f086b0-8d0e-4ba8-8f01-870466740b1c"}]
```

## Step 3 — Get Custom Role — REAL id, attempt 1

### Get Custom Role — REAL id, attempt 1

```
startedAt:     2026-08-29T09:32:50.127Z
latencyMs:     365
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
pathname:      /api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"a7b39308-c4e8-4fe4-8a44-bca1810eb3b1","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 4 — Get Custom Role — REAL id, attempt 2

### Get Custom Role — REAL id, attempt 2

```
startedAt:     2026-08-29T09:32:55.015Z
latencyMs:     154
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
pathname:      /api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"bb4209df-a299-44a0-b0d1-d6f6488b603c","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 5 — Get Custom Role — REAL id, attempt 3

### Get Custom Role — REAL id, attempt 3

```
startedAt:     2026-08-29T09:32:59.135Z
latencyMs:     265
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
pathname:      /api/settings/get-custom-roles/dfa8ea02-7921-4ca4-bab1-3c5f0572261c
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"370aae69-6669-465e-a869-0e1992a45543","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 6 — Get Custom Role — BOGUS GUID, attempt 1

### Get Custom Role — BOGUS GUID, attempt 1

```
startedAt:     2026-08-29T09:33:03.734Z
latencyMs:     269
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-custom-roles/11111111-1111-1111-1111-111111111111
pathname:      /api/settings/get-custom-roles/11111111-1111-1111-1111-111111111111
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"d30a720d-80f0-4321-b933-5cd03e0339a3","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Step 7 — Get Custom Role — BOGUS GUID, attempt 2

### Get Custom Role — BOGUS GUID, attempt 2

```
startedAt:     2026-08-29T09:33:08.112Z
latencyMs:     158
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-custom-roles/11111111-1111-1111-1111-111111111111
pathname:      /api/settings/get-custom-roles/11111111-1111-1111-1111-111111111111
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"77946e4b-a0f6-41ba-a0c8-f97c0c9ac814","name":"Restricted User","access":"[1,2,27,3,4,5,6,7,8,9,10,11,12,13,14,15,16,108,17,18,19,20,21,33,34,35,36,42,22,23,24,25,26,31,37,38,149, 152,156, 157, 158, 200, 201, 202, 203, 204, 205, 206, 207]","locked":true,"customerId":"00000000-0000-0000-0000-000000000000"}
```

## Expected

Get Custom Role returns the role identified by `{roleId}` — i.e. the just-created role (name `AQA evidence role 1787995956290`) for the real id, and `404`/`400` for the bogus GUID.

## Actual

REAL id → statuses [200, 200, 200], returned names ["Restricted User", "Restricted User", "Restricted User"], returned ids ["a7b39308-c4e8-4fe4-8a44-bca1810eb3b1", "bb4209df-a299-44a0-b0d1-d6f6488b603c", "370aae69-6669-465e-a869-0e1992a45543"]

BOGUS GUID → statuses [200, 200], returned names ["Restricted User", "Restricted User"], returned ids ["d30a720d-80f0-4321-b933-5cd03e0339a3", "77946e4b-a0f6-41ba-a0c8-f97c0c9ac814"]

The requested `roleId` in the URL path (captured) never matches the returned `id`. Bogus and real ids behave identically.

## Reproducibility

5/5 this run (3 real + 2 bogus), plus prior observations 2026-08-28/29.

## Alternative explanations ruled out

- **invalid / non-existent role id** — ruled out — the created role IS present in List Custom Roles (true); still not returned by Get
- **wrong customer / wrong environment** — ruled out — same key/company/host throughout; see Environment block
- **console did not attach the path param** — ruled out — captured request URL contains the roleId in the path (see raw calls)
- **flaky console state** — ruled out — reproduced on 5 independent fresh console opens
- **existing-data ambiguity** — ruled out — the target role was created by this test with a unique name

## Downstream impact

Any workflow that reads a specific custom role by id (verify a role after create/update, render its permissions, audit) is impossible via this endpoint. Callers must use `List Custom Roles` + client-side filter instead.

## Workaround

`POST settings/custom-roles/list` and filter by id/name client-side.

## Cleanup performed

Created role left in place — `Delete Custom Role`'s console is itself broken (see P0-DELETE-CUSTOM-ROLE-CONSOLE). Role is disposable (unique AQA name).

## Remaining unknowns

Whether the returned system role's underlying `id` varies between calls (needs the raw bodies compared — see raw file `realIdResults`/`bogusIdResults`).

## Recommended regression test

`role-management-api.spec.ts` › "Create Custom Role → Get Custom Role (KNOWN BUG: ignores roleId)" pins the 200 + shape. Consider strengthening to assert `returnedId !== requestedRoleId` so it fails loudly when the backend starts honouring the param.

## Suggested bug-ticket wording

**Title**: `GET settings/custom-roles/{roleId}` ignores the path parameter and returns an unrelated (locked system) role

**Steps**: 1) `POST settings/custom-roles` `{name}` → 200, note `id`. 2) `GET settings/custom-roles/{that id}` → 200 but the response `id`/`name` is a different, locked system role. 3) `GET settings/custom-roles/11111111-1111-1111-1111-111111111111` (bogus) → identical 200 response.

**Expected**: the role for the given id, or 404. **Actual**: a fixed unrelated role for any id — the query is missing its `WHERE id = @roleId`.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P0-GET-CUSTOM-ROLE.json`
