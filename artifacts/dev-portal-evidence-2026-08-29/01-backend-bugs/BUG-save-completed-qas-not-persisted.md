# BUG — Save completed QAs returns 201 but the evaluation is never persisted

- **ID**: P0-SAVE-COMPLETED-QAS
- **Classification**: CONFIRMED BACKEND BUG
- **Severity**: P0 (completed evaluations are silently lost; blocks Suppress QA)

## Environment

```
timestamp:        2026-08-29T10:02:10.353Z
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
  "callId": "d71ac345-86a0-f111-9b33-6045bded66d5",
  "formId": 776,
  "marker": "AQA-EVIDENCE-1787997735831"
}
```

## Endpoint chain

## Step 1 — Get Available QAs (discover form id)

### Get Available QAs (discover form id)

```
startedAt:     2026-08-29T10:02:15.058Z
latencyMs:     770
method:        GET
url:           https://developer1.callcabinet.com/api/qc/Quality/GetForms/?callId=d71ac345-86a0-f111-9b33-6045bded66d5
pathname:      /api/qc/Quality/GetForms/
query:         {"callId":"d71ac345-86a0-f111-9b33-6045bded66d5"}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: [{"id":776,"name":"Postman test evaluation","archived":false},{"id":359,"name":"AAADDDDTT","archived":false},{"id":834,"name":"svitlana test 26/08","archived":false},{"id":851,"name":"=Large_2","archived":false},{"id":811,"name":"Svitlana test 0708","archived":false},{"id":829,"name":"Oleksiip Test 19082025","archived":false},{"id":377,"name":"test 13.07","archived":false},{"id":803,"name":"svitlana test 0408","archived":false},{"id":872,"name":"test del","archived":false},{"id":723,"name":"svitlana test 05/06","archived":false},{"id":873,"name":"svitlana test 1310 staging","archived":false},{"id":724,"name":"svitlana test 05/06/25","archived":false},{"id":160,"name":"test126","archived":false},{"id":303,"name":"test2704","archived":false},{"id":807,"name":"testQAkar","archived":false},{"id":801,"name":"kartest","archived":false},{"id":684,"name":"Oleksii - Test QA","archived":false},{"id":612,"name":"bind all id  test","archived":false},{"id":117,"name":"Test Rayne","archived":false},{"id":22,"name":"Test 100","archived":false},{"id":682,"name":"svitlana test 09/04","archived":false},{"id":725,"name":"svitlana test 06/05/25 2","archived":false},{"id":18,"name":"WWCS Testing Workbook v3","archived":false},{"id":1009,"name":"svitlana test 0307 version 2","archived":false},{"id":954,"name":"MAX_TEST_1","archived":false},{"id":833,"name":"svitlana test 21/08","archived":false},{"id":106,"name":"fname","archived":false},{"id":272,"name":"test2704","archived":false},{"id":172,"name":"test1264","archived":false},{"id":805,"name":"svitlana test 04082025","archived":false},{"id":29,"name":"Dealersales/ Schemes/Client care New client","archived":false},{"id":779,"name":"Oleksii - Test Changed Form","archived":false},{"id":34,"name":"Test 100 w/TF","archived":false}]
```

## Step 2 — Save completed QAs (id=776, callId, questions:[], sections:[], notes:"AQA-EVIDENCE-1787997735831")

### Save completed QAs (id=776, callId, questions:[], sections:[], notes:"AQA-EVIDENCE-1787997735831")

```
startedAt:     2026-08-29T10:02:21.039Z
latencyMs:     271
method:        POST
url:           https://developer1.callcabinet.com/api/qc/Quality/SaveCompletedForm/
pathname:      /api/qc/Quality/SaveCompletedForm/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"id":776,"callId":"d71ac345-86a0-f111-9b33-6045bded66d5","questions":[],"sections":[],"notes":"AQA-EVIDENCE-1787997735831"}
--
status:        201
response body: {"resultMessage":null,"doesOriginalFormChanged":true,"lastLog":null}
```

## Step 3 — List Completed Qas — immediate read-back

### List Completed Qas — immediate read-back

```
startedAt:     2026-08-29T10:02:27.579Z
latencyMs:     278
method:        GET
url:           https://developer1.callcabinet.com/api/qc/Quality/GetAnsweredForms/?callId=d71ac345-86a0-f111-9b33-6045bded66d5
pathname:      /api/qc/Quality/GetAnsweredForms/
query:         {"callId":"d71ac345-86a0-f111-9b33-6045bded66d5"}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: []
```

## Step 4 — Get Call Info — hasAnsweredForms (immediate)

### Get Call Info — hasAnsweredForms (immediate)

```
startedAt:     2026-08-29T10:02:33.759Z
latencyMs:     1980
method:        GET
url:           https://developer1.callcabinet.com/api/calls/details/d71ac345-86a0-f111-9b33-6045bded66d5?qcRando=false
pathname:      /api/calls/details/d71ac345-86a0-f111-9b33-6045bded66d5
query:         {"qcRando":"false"}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {
  "model": {
    "dateFormat": "yyyy/MM/dd H:mm:ss",
    "dontGreyOutQC": true,
    "qCEmailMessage": "Your QA evaluation has been completed.",
    "id": "d71ac345-86a0-f111-9b33-6045bded66d5",
    "startTimestamp": "2026-08-25T13:07:32",
    "durationShort": 154.0,
    "callTypeId": 9,
    "personalCall": false,
    "extensionName": "mykytak@callcabinet.com",
    "groups": "myGroup1,MyGroup2,MyGroup3",
    "agentId": "ef93c7a0-9d7e-4abb-98d3-46173fc5fc68",
    "agentName": "Mykyta Kviatkovskyi",
    "agentWindowsUserName": "",
    "agentMail": "mykytak@callcabinet.com",
    "number": "Myroslav Bora",
    "phoneBook": "biba",
    "directionShort": true,
    "flagged": false,
    "flagType": null,
    "isNotesAvailaible": true,
    "callerId": "Anonymous",
    "customerInternalRef": "",
    "dtmf": null,
    "diD": null,
    "phoneSystemCallId": "f11de236-2253-444f-bbd9-9476041eb3a6",
    "siteName": "UA team recording",
    "siteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
    "callCreated": "2026-08-25T13:10:08",
    "wrapCode": null,
    "foundationURL": "",
    "connectionString": null,
    "originalIdentifier": "63005880-518b-4c49-beee-1fccc0e086b7",
    "partialKey": "9e15e3fe-fe99-4d31-b1de-363bb4065b23",
    "legalHold": false,
    "assignedTags": "[{\"name\": \"hello its me\",\"id\": \"04B6F69F-39E5-4C23-8511-8042F37F9620\", \"tagId\": \"77A27B7E-817D-4474-8106-05762B889099\"}]",
    "sTTStatus": 1,
    "customerTagsJson": "[{\"Id\":\"0d2fe5f7-5dcc-4b23-9da5-0090f9dd7395\",\"Name\":\"Followup required\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"458e4ebd-0ae3-4dd2-9cba-0214a8d4c920\",\"Name\":\"weq3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"77a27b7e-817d-4474-8106-05762b889099\",\"Name\":\"hello its me\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8effff16-7945-491c-a2ae-067addb45d3c\",\"Name\":\"NewTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"57978d3b-8f80-462f-b8a0-0b7497ece630\",\"Name\":\"test 99\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"55eb1795-c893-4d9a-a151-0d946f476b4c\",\"Name\":\"Multilanguage calls 11 August 2025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cf2b6221-ebf6-4ef9-bf6b-0f04b7decf72\",\"Name\":\"test214\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2f74811d-3301-4198-ac03-0f32f39c1171\",\"Name\":\"Test Iterration 7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9adeccbc-d249-4c24-8fbb-10bd6d4046c1\",\"Name\":\"svitlana test 1404\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a8d7c302-d38c-4162-a317-10cb3a099c64\",\"Name\":\"MP Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3a75a908-9833-4d7b-a625-11b617329d47\",\"Name\":\"jjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1dd8cc86-6501-42f5-8958-17a39e70d7e0\",\"Name\":\"PostmanTag3jax\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"95f0c020-3b64-428a-bf19-17aeb8cc1006\",\"Name\":\"cc test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8495ae54-f2ba-45ff-b6b0-18918a26954d\",\"Name\":\"test27\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7b713aca-c52e-4080-870c-1a0f930b3534\",\"Name\":\"aaaa a df  qerqe    11111\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"660c2086-4cad-4a4e-a6ff-1a989346d052\",\"Name\":\"AQA coverage tag 1787937220660 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a70bca98-4a8d-4240-8579-1d4f2abcc1b2\",\"Name\":\"lllllll\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5288e97a-3e27-4d18-b438-1f018232c312\",\"Name\":\"Service Upgrade\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"bf29333a-b4b6-4352-b849-1f5fcf352ddc\",\"Name\":\"zagtest1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9db88d45-a16d-49a0-8860-225afaf1e6aa\",\"Name\":\"General Flag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"940994ad-bf3e-4c96-a883-228b9745d6af\",\"Name\":\"PostmanTaggwlc\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4ed52cfe-5c0f-4e47-82b2-2294e81dedee\",\"Name\":\"jj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e59a82f3-1a9e-4646-8573-22e00b60f0ff\",\"Name\":\"Customer Complaint3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"da04413d-2dd1-4f06-9e43-235cf7e3812b\",\"Name\":\"RomanQATEST\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e5209359-15f8-4057-81ea-23d475eedba4\",\"Name\":\"max test 1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e8b648f2-fb27-4184-85c6-261ac2ebd3da\",\"Name\":\"test Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"473eb278-8e3f-4625-b9d9-27ef92f94535\",\"Name\":\"AQA coverage tag 1787917034865 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2ed99af5-265a-4a2a-be4a-29bdbdcaad23\",\"Name\":\"What is this\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4fba733c-b377-4f13-8fa9-2cce53b7fcd7\",\"Name\":\"PostmanTagmwbc\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ebdfc212-31d5-4b35-870e-3065f97094fa\",\"Name\":\"xzcz\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"62ed747d-4323-4ae4-be27-306b0a04c697\",\"Name\":\"stvasdfa\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cce1e96f-643a-4e5c-931a-3079812f422c\",\"Name\":\"fdfdfdf\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b69b155d-0761-4741-a9da-31fc6613ed8b\",\"Name\":\"Google\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"17d24c81-7f65-4905-962a-322d3ab9ac2c\",\"Name\":\"svitlana test 150425\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b2d5b349-6655-4dd4-ba16-325ef688beee\",\"Name\":\"sport syla 10042025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"15190022-b94c-4de6-9598-344f4062d1a4\",\"Name\":\"PostmanTagpq12 Updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"daaf882b-37ca-4a72-9f37-384bdacd43f9\",\"Name\":\"svitlana test 1007 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"657a366d-d884-46b3-b4a6-392d99e99f7e\",\"Name\":\"new test tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"c754b7a0-00ac-4330-828e-3ab8f62ea874\",\"Name\":\"test ddsa\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ac6b5b6a-0b2b-478e-88ba-41518458378b\",\"Name\":\"Spam call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0849f96e-9401-468e-b0c8-435c314c03fc\",\"Name\":\"Test1802\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3cf23565-74f9-4740-966f-4775ce68cdd2\",\"Name\":\"aaaaajj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1689167c-a6b8-4be1-b45f-48b7d1c0abb6\",\"Name\":\"Product Request\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2c59aa0e-737d-4ab9-b235-4a18c62c1f3d\",\"Name\":\"group tag1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"003b9243-53bf-466c-a970-4b39435fcb08\",\"Name\":\"PostmanTagvmpd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"fc125831-1996-419f-a65d-4e2a6d876068\",\"Name\":\"PostmanTagvrpb\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6c20e043-7d07-4670-b485-507e29c57490\",\"Name\":\"TagName125\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dcab3640-8751-48fa-8a24-51548c4df45e\",\"Name\":\"svitlana test 15042025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"71dd93e1-a7ad-468b-9a63-560db42401c2\",\"Name\":\"Customer Compla1int\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7f26341f-0370-49e2-a494-5715b08bd6ad\",\"Name\":\"aa b c2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a342ff26-e98a-4723-95c2-5add5ec5ac71\",\"Name\":\"PostmanTagTest123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"90fea830-3bee-4549-8095-5d59da4c7866\",\"Name\":\"svitlana test 1007 3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9bd217f5-2875-436a-85e7-628980220d2e\",\"Name\":\"PostmanTag8cib\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"92851051-8b91-4304-b585-62c5bb0c54ab\",\"Name\":\"dsadasdfdssd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"41619828-885e-4867-af06-69950fd0ef01\",\"Name\":\"Special type\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"123809cf-8018-44bc-b25b-6a37695ec9c5\",\"Name\":\"svitlana test 140425\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"daadfc6d-afa3-4e3a-946a-6ae69c074aba\",\"Name\":\"PostmanTag96ol\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"56e79f74-107e-4d98-bfe7-6ce44b94e291\",\"Name\":\"Urgent followup\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e77be0a1-74da-4036-8a8b-721592a73773\",\"Name\":\"PostmanTag2l8r\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"466a6595-8030-4d8a-9eeb-7365731cd6ff\",\"Name\":\"PostmanTag5h4n\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5112d6d1-15c4-4f7a-ab04-7572d687fc76\",\"Name\":\"AQA coverage tag 1787915719424 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0194503f-f398-46d2-81fb-77c57afcfc1c\",\"Name\":\"test 8\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a2a4baa1-f7da-41d9-846d-7de8fe11c3de\",\"Name\":\"test 9\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8a7d5a15-32e2-4ccb-a12a-7e1f219befe7\",\"Name\":\"Test1231\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7f2e56cf-a014-422a-af3c-806b6fce6fab\",\"Name\":\"TagName130i\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cdafcfa3-7c52-4b8c-ab1a-80cb0f0554e7\",\"Name\":\"test tag nik1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f4fa1bf2-1491-4775-aaf1-815c505fed4e\",\"Name\":\"zagtest2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5dc0f10f-8b46-49cb-9843-81b474ef4e37\",\"Name\":\"svitlana test 210826 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"19c9ac94-4910-492a-b70c-8251f4ef0f35\",\"Name\":\"teeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeestttttttttttttttttttttttt\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d765d9fc-ade8-4521-914d-83ac901545a0\",\"Name\":\"Do NOT Delete Call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"61dedec3-c160-48d1-8022-84fa770ea962\",\"Name\":\"PostmanTagntzi\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f37a4154-39d9-487a-8e35-87ec78bb11cd\",\"Name\":\"uio\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"359bc166-3458-4f21-8502-8a525ec83a6d\",\"Name\":\"j1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6cb446ad-65ab-4c58-9d6c-8abe4c9b067a\",\"Name\":\"PostmanTagw82w\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8642cfa5-02c8-4638-958f-8b2ef4f993e9\",\"Name\":\"PostmanTagnkh1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"607c466a-488e-447f-b3ed-8bf3f051f38b\",\"Name\":\"im so\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d3f915f8-e318-4955-9032-8e832e10303f\",\"Name\":\"test 78\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"81ac6bc6-976b-4730-92d3-8fffba848349\",\"Name\":\"sport syla\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"019dd912-bfab-47bf-b10d-91d262fac930\",\"Name\":\"runda1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"69c2f23a-77f9-4590-9fc9-92a3ef518fbf\",\"Name\":\"aa b c22\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"aa054746-af94-4c56-9411-932f7c09a4d6\",\"Name\":\"jjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"54a1abed-72f2-4867-b0da-937f9a5320c3\",\"Name\":\"aa b c1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"548ce054-ccae-4b93-a5ba-95d30e2b23d0\",\"Name\":\"The Greater Dayton School\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d6965684-91dc-494a-92e3-996bd5ba696a\",\"Name\":\"bad tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"74d96104-c046-4ff4-a92a-9bb83543165e\",\"Name\":\"zagtest7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"64e89bce-6330-4407-bf42-9c421db70805\",\"Name\":\"PostmanTag0726\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2404bb5c-e43e-4590-a833-9dc5e8fb1240\",\"Name\":\"PostmanTagr1aq\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4a11eef3-b595-40b3-955f-9e8544b1bcfb\",\"Name\":\"testTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dd8ba5a2-3bf1-4ae9-9c2f-9ec2084d43ec\",\"Name\":\"Customer Complaint\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"189792e5-a170-4995-b117-9fdeca38f795\",\"Name\":\"Agent Needs Training\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cb4bbce3-9d21-40bf-96e3-a0e729864e5b\",\"Name\":\"test123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2708d353-7233-4811-935e-a151ff4f3c0c\",\"Name\":\"zagTest234\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f4cca9d3-3964-427e-af62-a2f8fd6e4ba3\",\"Name\":\"testApi asd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2a4752cd-1622-4703-9cd9-a4006a599595\",\"Name\":\"Rayne Tracing Test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d105bd78-6c1a-48f3-892f-a4d5fbf8b1b6\",\"Name\":\"Regression test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b0c15064-82f0-48f3-a79f-a5de43dfbac7\",\"Name\":\"aaaa a df  qerqe\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dbba04f6-8909-40f8-ad24-a60fafdd909d\",\"Name\":\"Return Authorization\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"05ecac62-5bad-4f2b-958e-a7593a96e61e\",\"Name\":\"AQA coverage test tag updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7fd391f2-185c-4c66-b292-a812b03ebf3f\",\"Name\":\"nik test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a54b99d3-e8da-48e4-8cc1-a85502e9860a\",\"Name\":\"qasewkkkxx\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d71306c7-ecb0-4a43-84b6-ac910a11e9d0\",\"Name\":\"Product Damaged In Transit\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e19f838d-b9a0-4aea-8157-ad4d1c1a4236\",\"Name\":\"Bills Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f0af88eb-14a3-4395-aa46-adad50de4487\",\"Name\":\"olehTestTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3a8222eb-a0c8-4a8a-abc2-aec4bb6b20a4\",\"Name\":\"testApis asd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"228c95cb-55c2-4bae-8adc-b01c9c10bff3\",\"Name\":\"test23\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"fe5c3b8f-84ec-444c-aa84-b181bc09ef44\",\"Name\":\"AQA coverage tag 1787919536141 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3741a72f-c686-4745-8e04-b298fc677d1a\",\"Name\":\"test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9ac24ae3-99d9-4cec-8ad5-b45ead803050\",\"Name\":\"svitlana test 33\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1dd2da84-8d76-4a65-8291-b5d887382576\",\"Name\":\"PostmanTagt903\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5d7afc2e-442f-40cb-b54c-b650bda48969\",\"Name\":\"testOleh2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"551cc0b5-fa87-4318-a512-b6847fc39f9a\",\"Name\":\"aa b c33\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"76cdd625-87aa-488e-be4b-b874a187acee\",\"Name\":\"PostmanTag52wd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1c616168-5299-4dbb-ba08-b974e9bf386c\",\"Name\":\"Legal Dispute\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dbf15618-eab4-4f13-a2de-bec4aaeeb19a\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"835d4a4b-4314-4056-bd07-bf4703ef5a42\",\"Name\":\"svitlana test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4baff791-4dbb-41b9-9ca0-bf64ebfee0b1\",\"Name\":\"Ntag31\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2d1e833d-c37a-48f2-93a8-c0d704242f3f\",\"Name\":\"test1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"12ae8736-f844-4687-8f62-c0f4e030f451\",\"Name\":\"Gorilla MotorsTest\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8c3d13b6-eaf2-4be3-8f5d-c154b2ffb7e1\",\"Name\":\"PostmanTagrg2h\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"92bc9151-136c-4370-9e38-c16b06cc0140\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"38ed8705-5c26-49bc-a842-c1a567e42a3d\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6322672f-368a-4a46-92f1-c5fba203a78c\",\"Name\":\"Great call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e4ac7111-1055-466a-98ec-c68de786b4b3\",\"Name\":\"test234\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7346046c-186b-41f0-bc88-ca4d826b4278\",\"Name\":\"CC Test32135\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"47dd5ede-9889-4050-9229-cb665f14070c\",\"Name\":\"niknew\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"42401ec8-e353-4815-9540-cc2df225b1cd\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"009f6d12-98ce-46fd-bcb8-cccd967b88a6\",\"Name\":\"PostmanTago8rn\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d65b4593-cd77-460c-abdb-cf8e086b7e46\",\"Name\":\"Maksym Karpenko 112\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4b52df49-830a-4302-93e3-d04c1bb3e138\",\"Name\":\"PostmanTagvo8m\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"55e1396d-531a-48d9-bc51-d192cc0a3f4b\",\"Name\":\"zagTest3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"755ccb14-0c24-4cf1-96fe-d2a287458dde\",\"Name\":\"tesettes\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b6eda417-148f-4920-bd70-d2fa8fe47f94\",\"Name\":\"svitlanasTest\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8bcf1a29-5199-45d8-bde5-d58fa11d0b07\",\"Name\":\"testOleh1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"29c1ef47-ef3d-4c29-ba67-da3c701c764a\",\"Name\":\"Account Cancellation\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"efc59cb2-681a-491c-bb34-dae80a22fc37\",\"Name\":\"olehTest334\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e36228ab-f205-4abe-bec8-e174481bdfa2\",\"Name\":\"svitlana test space 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5eaea9dc-148a-486c-b007-e52ed6a3d868\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"c1dc72bf-4557-45c3-a467-eaa712adc319\",\"Name\":\"PostmanTagotas\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0b5f9212-728f-4dec-a0b3-eacb31a3187a\",\"Name\":\"svitlanasTest2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a08cc987-4e1b-431b-a3d1-eb169c16ee40\",\"Name\":\"PostmanTagcplq\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ff868166-57aa-488e-b353-ee214f5f830a\",\"Name\":\"sssss\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a9e7292c-9491-4e95-a51a-ef2ae2f2a37a\",\"Name\":\"AQA coverage tag 1787915431606 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0e2554b7-7302-4959-baea-ef4247dcd3ba\",\"Name\":\"CC Test3213\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7964c703-359d-424b-a8dd-ef57a9a337b8\",\"Name\":\"svitlana test 140426\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"09ed4051-3f20-4202-a240-f0c2529af644\",\"Name\":\"zagtest5\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ac6def83-eb15-4629-ba54-f0deb6ac7312\",\"Name\":\"svitlana test 0408\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"51bccb02-8bda-4de3-87b7-f2556691e346\",\"Name\":\"svitlana test 1504\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"580d801c-2753-4ac2-a95b-f363e3322e4e\",\"Name\":\"PostmanTagnmfk\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"86f8c82f-e813-417b-bd47-f5a2f4b9b2a8\",\"Name\":\"TagTest123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1c009bb2-0cb2-49ab-b612-f8b347b069f7\",\"Name\":\"TestTagUiv2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3eebddc1-a823-40f2-a608-f8e920ab7545\",\"Name\":\"Great Sales Pitch Example\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4a222548-0b71-4249-981b-fd7c6efb3f7d\",\"Name\":\"Test Iteration 7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null}]",
    "userId": "00000000-0000-0000-0000-000000000000",
    "formId": null,
    "qcRando": null,
    "participants": null,
    "participantsStr": "Mykyta, Myroslav",
    "foundationQueryString": "",
    "foundationVideoQueryString": "",
    "showQualityControl": true,
    "showCallTranscription": true,
    "isDemoCall": false,
    "isTranscripted": true,
    "qcPermission": null,
    "showQCProgress": true,
    "showQCOngoingScore": true,
    "hasAnsweredForms": false,
    "hasAvailableForms": true,
    "emailAgent": false,
    "reAssignAgentOnCallsAccess": true,
    "callType": "Teams",
    "hasVideo": false,
    "hasVideoData": false,
    "jSONFormAnswers": null,
    "additionalField1": null,
    "additionalField2": "",
    "additionalField3": null,
    "additionalField4": "",
    "additionalField5": null,
    "isArchived": false,
    "emailSupervisor": 0,
    "shareSettings": {
      "id": 2,
      "customerId": "98f086b0-8d0e-4ba8-8f01-870466740b1c",
      "callDownloadEnabled": true,
      "shareExtensions": false,
      "shareTimeBasedNotes": false,
      "shareScreenshots": false,
      "shareMachineTranscription": false,
      "sharePointInTimeNotes": false,
      "shareDownloadableCall": true,
      "shareMaximumTime": 44640,
      "shareCallWithPermissionToAddNote": false,
      "shareGeneralNotes": false,
      "callEmailingEnabled": true,
      "callSharingEnabled": true,
      "emailManagerOnCompletedQC": true,
      "qCCompletedEmailWithScreenshot": false,
      "loginIdleTimeout": 0,
      "additionalFieldName1": "Delegate Call - 1",
      "additionalFieldName2": "Transfer From - 2",
      "additionalFieldName3": "Hold - 3",
      "additionalFieldName4": "Name bot - 4",
      "additionalFieldName5": "Call Queue (alex test) - 5",
      "exportDateFormat": 0,
      "callPlaybackEnabled": true,
      "callLegalHoldEnabled": true,
      "callNotesEnabled": true,
      "callTagsEnabled": true,
      "callFlagEnabled": true,
      "callDetailsEnabled": false,
      "clientRefName": "ClientRef"
    },
    "isEssential": false
  }
}
```

## Step 5 — List Completed Qas — after 5s

### List Completed Qas — after 5s

```
startedAt:     2026-08-29T10:02:45.072Z
latencyMs:     269
method:        GET
url:           https://developer1.callcabinet.com/api/qc/Quality/GetAnsweredForms/?callId=d71ac345-86a0-f111-9b33-6045bded66d5
pathname:      /api/qc/Quality/GetAnsweredForms/
query:         {"callId":"d71ac345-86a0-f111-9b33-6045bded66d5"}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: []
```

## Step 6 — Get Call Info — hasAnsweredForms (after 5s)

### Get Call Info — hasAnsweredForms (after 5s)

```
startedAt:     2026-08-29T10:02:50.353Z
latencyMs:     821
method:        GET
url:           https://developer1.callcabinet.com/api/calls/details/d71ac345-86a0-f111-9b33-6045bded66d5?qcRando=false
pathname:      /api/calls/details/d71ac345-86a0-f111-9b33-6045bded66d5
query:         {"qcRando":"false"}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {
  "model": {
    "dateFormat": "yyyy/MM/dd H:mm:ss",
    "dontGreyOutQC": true,
    "qCEmailMessage": "Your QA evaluation has been completed.",
    "id": "d71ac345-86a0-f111-9b33-6045bded66d5",
    "startTimestamp": "2026-08-25T13:07:32",
    "durationShort": 154.0,
    "callTypeId": 9,
    "personalCall": false,
    "extensionName": "mykytak@callcabinet.com",
    "groups": "myGroup1,MyGroup2,MyGroup3",
    "agentId": "ef93c7a0-9d7e-4abb-98d3-46173fc5fc68",
    "agentName": "Mykyta Kviatkovskyi",
    "agentWindowsUserName": "",
    "agentMail": "mykytak@callcabinet.com",
    "number": "Myroslav Bora",
    "phoneBook": "biba",
    "directionShort": true,
    "flagged": false,
    "flagType": null,
    "isNotesAvailaible": true,
    "callerId": "Anonymous",
    "customerInternalRef": "",
    "dtmf": null,
    "diD": null,
    "phoneSystemCallId": "f11de236-2253-444f-bbd9-9476041eb3a6",
    "siteName": "UA team recording",
    "siteId": "8cc22cd2-a4b7-46c5-b907-9050e110dac5",
    "callCreated": "2026-08-25T13:10:08",
    "wrapCode": null,
    "foundationURL": "",
    "connectionString": null,
    "originalIdentifier": "63005880-518b-4c49-beee-1fccc0e086b7",
    "partialKey": "9e15e3fe-fe99-4d31-b1de-363bb4065b23",
    "legalHold": false,
    "assignedTags": "[{\"name\": \"hello its me\",\"id\": \"04B6F69F-39E5-4C23-8511-8042F37F9620\", \"tagId\": \"77A27B7E-817D-4474-8106-05762B889099\"}]",
    "sTTStatus": 1,
    "customerTagsJson": "[{\"Id\":\"0d2fe5f7-5dcc-4b23-9da5-0090f9dd7395\",\"Name\":\"Followup required\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"458e4ebd-0ae3-4dd2-9cba-0214a8d4c920\",\"Name\":\"weq3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"77a27b7e-817d-4474-8106-05762b889099\",\"Name\":\"hello its me\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8effff16-7945-491c-a2ae-067addb45d3c\",\"Name\":\"NewTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"57978d3b-8f80-462f-b8a0-0b7497ece630\",\"Name\":\"test 99\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"55eb1795-c893-4d9a-a151-0d946f476b4c\",\"Name\":\"Multilanguage calls 11 August 2025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cf2b6221-ebf6-4ef9-bf6b-0f04b7decf72\",\"Name\":\"test214\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2f74811d-3301-4198-ac03-0f32f39c1171\",\"Name\":\"Test Iterration 7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9adeccbc-d249-4c24-8fbb-10bd6d4046c1\",\"Name\":\"svitlana test 1404\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a8d7c302-d38c-4162-a317-10cb3a099c64\",\"Name\":\"MP Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3a75a908-9833-4d7b-a625-11b617329d47\",\"Name\":\"jjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1dd8cc86-6501-42f5-8958-17a39e70d7e0\",\"Name\":\"PostmanTag3jax\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"95f0c020-3b64-428a-bf19-17aeb8cc1006\",\"Name\":\"cc test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8495ae54-f2ba-45ff-b6b0-18918a26954d\",\"Name\":\"test27\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7b713aca-c52e-4080-870c-1a0f930b3534\",\"Name\":\"aaaa a df  qerqe    11111\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"660c2086-4cad-4a4e-a6ff-1a989346d052\",\"Name\":\"AQA coverage tag 1787937220660 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a70bca98-4a8d-4240-8579-1d4f2abcc1b2\",\"Name\":\"lllllll\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5288e97a-3e27-4d18-b438-1f018232c312\",\"Name\":\"Service Upgrade\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"bf29333a-b4b6-4352-b849-1f5fcf352ddc\",\"Name\":\"zagtest1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9db88d45-a16d-49a0-8860-225afaf1e6aa\",\"Name\":\"General Flag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"940994ad-bf3e-4c96-a883-228b9745d6af\",\"Name\":\"PostmanTaggwlc\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4ed52cfe-5c0f-4e47-82b2-2294e81dedee\",\"Name\":\"jj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e59a82f3-1a9e-4646-8573-22e00b60f0ff\",\"Name\":\"Customer Complaint3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"da04413d-2dd1-4f06-9e43-235cf7e3812b\",\"Name\":\"RomanQATEST\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e5209359-15f8-4057-81ea-23d475eedba4\",\"Name\":\"max test 1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e8b648f2-fb27-4184-85c6-261ac2ebd3da\",\"Name\":\"test Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"473eb278-8e3f-4625-b9d9-27ef92f94535\",\"Name\":\"AQA coverage tag 1787917034865 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2ed99af5-265a-4a2a-be4a-29bdbdcaad23\",\"Name\":\"What is this\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4fba733c-b377-4f13-8fa9-2cce53b7fcd7\",\"Name\":\"PostmanTagmwbc\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ebdfc212-31d5-4b35-870e-3065f97094fa\",\"Name\":\"xzcz\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"62ed747d-4323-4ae4-be27-306b0a04c697\",\"Name\":\"stvasdfa\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cce1e96f-643a-4e5c-931a-3079812f422c\",\"Name\":\"fdfdfdf\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b69b155d-0761-4741-a9da-31fc6613ed8b\",\"Name\":\"Google\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"17d24c81-7f65-4905-962a-322d3ab9ac2c\",\"Name\":\"svitlana test 150425\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b2d5b349-6655-4dd4-ba16-325ef688beee\",\"Name\":\"sport syla 10042025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"15190022-b94c-4de6-9598-344f4062d1a4\",\"Name\":\"PostmanTagpq12 Updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"daaf882b-37ca-4a72-9f37-384bdacd43f9\",\"Name\":\"svitlana test 1007 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"657a366d-d884-46b3-b4a6-392d99e99f7e\",\"Name\":\"new test tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"c754b7a0-00ac-4330-828e-3ab8f62ea874\",\"Name\":\"test ddsa\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ac6b5b6a-0b2b-478e-88ba-41518458378b\",\"Name\":\"Spam call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0849f96e-9401-468e-b0c8-435c314c03fc\",\"Name\":\"Test1802\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3cf23565-74f9-4740-966f-4775ce68cdd2\",\"Name\":\"aaaaajj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1689167c-a6b8-4be1-b45f-48b7d1c0abb6\",\"Name\":\"Product Request\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2c59aa0e-737d-4ab9-b235-4a18c62c1f3d\",\"Name\":\"group tag1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"003b9243-53bf-466c-a970-4b39435fcb08\",\"Name\":\"PostmanTagvmpd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"fc125831-1996-419f-a65d-4e2a6d876068\",\"Name\":\"PostmanTagvrpb\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6c20e043-7d07-4670-b485-507e29c57490\",\"Name\":\"TagName125\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dcab3640-8751-48fa-8a24-51548c4df45e\",\"Name\":\"svitlana test 15042025\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"71dd93e1-a7ad-468b-9a63-560db42401c2\",\"Name\":\"Customer Compla1int\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7f26341f-0370-49e2-a494-5715b08bd6ad\",\"Name\":\"aa b c2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a342ff26-e98a-4723-95c2-5add5ec5ac71\",\"Name\":\"PostmanTagTest123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"90fea830-3bee-4549-8095-5d59da4c7866\",\"Name\":\"svitlana test 1007 3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9bd217f5-2875-436a-85e7-628980220d2e\",\"Name\":\"PostmanTag8cib\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"92851051-8b91-4304-b585-62c5bb0c54ab\",\"Name\":\"dsadasdfdssd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"41619828-885e-4867-af06-69950fd0ef01\",\"Name\":\"Special type\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"123809cf-8018-44bc-b25b-6a37695ec9c5\",\"Name\":\"svitlana test 140425\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"daadfc6d-afa3-4e3a-946a-6ae69c074aba\",\"Name\":\"PostmanTag96ol\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"56e79f74-107e-4d98-bfe7-6ce44b94e291\",\"Name\":\"Urgent followup\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e77be0a1-74da-4036-8a8b-721592a73773\",\"Name\":\"PostmanTag2l8r\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"466a6595-8030-4d8a-9eeb-7365731cd6ff\",\"Name\":\"PostmanTag5h4n\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5112d6d1-15c4-4f7a-ab04-7572d687fc76\",\"Name\":\"AQA coverage tag 1787915719424 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0194503f-f398-46d2-81fb-77c57afcfc1c\",\"Name\":\"test 8\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a2a4baa1-f7da-41d9-846d-7de8fe11c3de\",\"Name\":\"test 9\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8a7d5a15-32e2-4ccb-a12a-7e1f219befe7\",\"Name\":\"Test1231\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7f2e56cf-a014-422a-af3c-806b6fce6fab\",\"Name\":\"TagName130i\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cdafcfa3-7c52-4b8c-ab1a-80cb0f0554e7\",\"Name\":\"test tag nik1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f4fa1bf2-1491-4775-aaf1-815c505fed4e\",\"Name\":\"zagtest2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5dc0f10f-8b46-49cb-9843-81b474ef4e37\",\"Name\":\"svitlana test 210826 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"19c9ac94-4910-492a-b70c-8251f4ef0f35\",\"Name\":\"teeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeestttttttttttttttttttttttt\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d765d9fc-ade8-4521-914d-83ac901545a0\",\"Name\":\"Do NOT Delete Call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"61dedec3-c160-48d1-8022-84fa770ea962\",\"Name\":\"PostmanTagntzi\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f37a4154-39d9-487a-8e35-87ec78bb11cd\",\"Name\":\"uio\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"359bc166-3458-4f21-8502-8a525ec83a6d\",\"Name\":\"j1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6cb446ad-65ab-4c58-9d6c-8abe4c9b067a\",\"Name\":\"PostmanTagw82w\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8642cfa5-02c8-4638-958f-8b2ef4f993e9\",\"Name\":\"PostmanTagnkh1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"607c466a-488e-447f-b3ed-8bf3f051f38b\",\"Name\":\"im so\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d3f915f8-e318-4955-9032-8e832e10303f\",\"Name\":\"test 78\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"81ac6bc6-976b-4730-92d3-8fffba848349\",\"Name\":\"sport syla\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"019dd912-bfab-47bf-b10d-91d262fac930\",\"Name\":\"runda1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"69c2f23a-77f9-4590-9fc9-92a3ef518fbf\",\"Name\":\"aa b c22\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"aa054746-af94-4c56-9411-932f7c09a4d6\",\"Name\":\"jjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"54a1abed-72f2-4867-b0da-937f9a5320c3\",\"Name\":\"aa b c1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"548ce054-ccae-4b93-a5ba-95d30e2b23d0\",\"Name\":\"The Greater Dayton School\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d6965684-91dc-494a-92e3-996bd5ba696a\",\"Name\":\"bad tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"74d96104-c046-4ff4-a92a-9bb83543165e\",\"Name\":\"zagtest7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"64e89bce-6330-4407-bf42-9c421db70805\",\"Name\":\"PostmanTag0726\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2404bb5c-e43e-4590-a833-9dc5e8fb1240\",\"Name\":\"PostmanTagr1aq\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4a11eef3-b595-40b3-955f-9e8544b1bcfb\",\"Name\":\"testTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dd8ba5a2-3bf1-4ae9-9c2f-9ec2084d43ec\",\"Name\":\"Customer Complaint\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"189792e5-a170-4995-b117-9fdeca38f795\",\"Name\":\"Agent Needs Training\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"cb4bbce3-9d21-40bf-96e3-a0e729864e5b\",\"Name\":\"test123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2708d353-7233-4811-935e-a151ff4f3c0c\",\"Name\":\"zagTest234\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f4cca9d3-3964-427e-af62-a2f8fd6e4ba3\",\"Name\":\"testApi asd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2a4752cd-1622-4703-9cd9-a4006a599595\",\"Name\":\"Rayne Tracing Test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d105bd78-6c1a-48f3-892f-a4d5fbf8b1b6\",\"Name\":\"Regression test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b0c15064-82f0-48f3-a79f-a5de43dfbac7\",\"Name\":\"aaaa a df  qerqe\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dbba04f6-8909-40f8-ad24-a60fafdd909d\",\"Name\":\"Return Authorization\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"05ecac62-5bad-4f2b-958e-a7593a96e61e\",\"Name\":\"AQA coverage test tag updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7fd391f2-185c-4c66-b292-a812b03ebf3f\",\"Name\":\"nik test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a54b99d3-e8da-48e4-8cc1-a85502e9860a\",\"Name\":\"qasewkkkxx\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d71306c7-ecb0-4a43-84b6-ac910a11e9d0\",\"Name\":\"Product Damaged In Transit\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e19f838d-b9a0-4aea-8157-ad4d1c1a4236\",\"Name\":\"Bills Tag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"f0af88eb-14a3-4395-aa46-adad50de4487\",\"Name\":\"olehTestTag\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3a8222eb-a0c8-4a8a-abc2-aec4bb6b20a4\",\"Name\":\"testApis asd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"228c95cb-55c2-4bae-8adc-b01c9c10bff3\",\"Name\":\"test23\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"fe5c3b8f-84ec-444c-aa84-b181bc09ef44\",\"Name\":\"AQA coverage tag 1787919536141 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3741a72f-c686-4745-8e04-b298fc677d1a\",\"Name\":\"test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"9ac24ae3-99d9-4cec-8ad5-b45ead803050\",\"Name\":\"svitlana test 33\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1dd2da84-8d76-4a65-8291-b5d887382576\",\"Name\":\"PostmanTagt903\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5d7afc2e-442f-40cb-b54c-b650bda48969\",\"Name\":\"testOleh2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"551cc0b5-fa87-4318-a512-b6847fc39f9a\",\"Name\":\"aa b c33\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"76cdd625-87aa-488e-be4b-b874a187acee\",\"Name\":\"PostmanTag52wd\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1c616168-5299-4dbb-ba08-b974e9bf386c\",\"Name\":\"Legal Dispute\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"dbf15618-eab4-4f13-a2de-bec4aaeeb19a\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"835d4a4b-4314-4056-bd07-bf4703ef5a42\",\"Name\":\"svitlana test\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4baff791-4dbb-41b9-9ca0-bf64ebfee0b1\",\"Name\":\"Ntag31\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"2d1e833d-c37a-48f2-93a8-c0d704242f3f\",\"Name\":\"test1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"12ae8736-f844-4687-8f62-c0f4e030f451\",\"Name\":\"Gorilla MotorsTest\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8c3d13b6-eaf2-4be3-8f5d-c154b2ffb7e1\",\"Name\":\"PostmanTagrg2h\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"92bc9151-136c-4370-9e38-c16b06cc0140\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"38ed8705-5c26-49bc-a842-c1a567e42a3d\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"6322672f-368a-4a46-92f1-c5fba203a78c\",\"Name\":\"Great call\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e4ac7111-1055-466a-98ec-c68de786b4b3\",\"Name\":\"test234\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7346046c-186b-41f0-bc88-ca4d826b4278\",\"Name\":\"CC Test32135\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"47dd5ede-9889-4050-9229-cb665f14070c\",\"Name\":\"niknew\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"42401ec8-e353-4815-9540-cc2df225b1cd\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"009f6d12-98ce-46fd-bcb8-cccd967b88a6\",\"Name\":\"PostmanTago8rn\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"d65b4593-cd77-460c-abdb-cf8e086b7e46\",\"Name\":\"Maksym Karpenko 112\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4b52df49-830a-4302-93e3-d04c1bb3e138\",\"Name\":\"PostmanTagvo8m\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"55e1396d-531a-48d9-bc51-d192cc0a3f4b\",\"Name\":\"zagTest3\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"755ccb14-0c24-4cf1-96fe-d2a287458dde\",\"Name\":\"tesettes\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"b6eda417-148f-4920-bd70-d2fa8fe47f94\",\"Name\":\"svitlanasTest\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"8bcf1a29-5199-45d8-bde5-d58fa11d0b07\",\"Name\":\"testOleh1\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"29c1ef47-ef3d-4c29-ba67-da3c701c764a\",\"Name\":\"Account Cancellation\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"efc59cb2-681a-491c-bb34-dae80a22fc37\",\"Name\":\"olehTest334\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"e36228ab-f205-4abe-bec8-e174481bdfa2\",\"Name\":\"svitlana test space 2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"5eaea9dc-148a-486c-b007-e52ed6a3d868\",\"Name\":\"jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"c1dc72bf-4557-45c3-a467-eaa712adc319\",\"Name\":\"PostmanTagotas\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0b5f9212-728f-4dec-a0b3-eacb31a3187a\",\"Name\":\"svitlanasTest2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a08cc987-4e1b-431b-a3d1-eb169c16ee40\",\"Name\":\"PostmanTagcplq\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ff868166-57aa-488e-b353-ee214f5f830a\",\"Name\":\"sssss\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"a9e7292c-9491-4e95-a51a-ef2ae2f2a37a\",\"Name\":\"AQA coverage tag 1787915431606 updated\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"0e2554b7-7302-4959-baea-ef4247dcd3ba\",\"Name\":\"CC Test3213\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"7964c703-359d-424b-a8dd-ef57a9a337b8\",\"Name\":\"svitlana test 140426\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"09ed4051-3f20-4202-a240-f0c2529af644\",\"Name\":\"zagtest5\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"ac6def83-eb15-4629-ba54-f0deb6ac7312\",\"Name\":\"svitlana test 0408\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"51bccb02-8bda-4de3-87b7-f2556691e346\",\"Name\":\"svitlana test 1504\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"580d801c-2753-4ac2-a95b-f363e3322e4e\",\"Name\":\"PostmanTagnmfk\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"86f8c82f-e813-417b-bd47-f5a2f4b9b2a8\",\"Name\":\"TagTest123\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"1c009bb2-0cb2-49ab-b612-f8b347b069f7\",\"Name\":\"TestTagUiv2\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"3eebddc1-a823-40f2-a608-f8e920ab7545\",\"Name\":\"Great Sales Pitch Example\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null},{\"Id\":\"4a222548-0b71-4249-981b-fd7c6efb3f7d\",\"Name\":\"Test Iteration 7\",\"IsActive\":true,\"CustomerId\":\"98f086b0-8d0e-4ba8-8f01-870466740b1c\",\"CallTags\":[],\"NotificationTags\":null}]",
    "userId": "00000000-0000-0000-0000-000000000000",
    "formId": null,
    "qcRando": null,
    "participants": null,
    "participantsStr": "Mykyta, Myroslav",
    "foundationQueryString": "",
    "foundationVideoQueryString": "",
    "showQualityControl": true,
    "showCallTranscription": true,
    "isDemoCall": false,
    "isTranscripted": true,
    "qcPermission": null,
    "showQCProgress": true,
    "showQCOngoingScore": true,
    "hasAnsweredForms": false,
    "hasAvailableForms": true,
    "emailAgent": false,
    "reAssignAgentOnCallsAccess": true,
    "callType": "Teams",
    "hasVideo": false,
    "hasVideoData": false,
    "jSONFormAnswers": null,
    "additionalField1": null,
    "additionalField2": "",
    "additionalField3": null,
    "additionalField4": "",
    "additionalField5": null,
    "isArchived": false,
    "emailSupervisor": 0,
    "shareSettings": {
      "id": 2,
      "customerId": "98f086b0-8d0e-4ba8-8f01-870466740b1c",
      "callDownloadEnabled": true,
      "shareExtensions": false,
      "shareTimeBasedNotes": false,
      "shareScreenshots": false,
      "shareMachineTranscription": false,
      "sharePointInTimeNotes": false,
      "shareDownloadableCall": true,
      "shareMaximumTime": 44640,
      "shareCallWithPermissionToAddNote": false,
      "shareGeneralNotes": false,
      "callEmailingEnabled": true,
      "callSharingEnabled": true,
      "emailManagerOnCompletedQC": true,
      "qCCompletedEmailWithScreenshot": false,
      "loginIdleTimeout": 0,
      "additionalFieldName1": "Delegate Call - 1",
      "additionalFieldName2": "Transfer From - 2",
      "additionalFieldName3": "Hold - 3",
      "additionalFieldName4": "Name bot - 4",
      "additionalFieldName5": "Call Queue (alex test) - 5",
      "exportDateFormat": 0,
      "callPlaybackEnabled": true,
      "callLegalHoldEnabled": true,
      "callNotesEnabled": true,
      "callTagsEnabled": true,
      "callFlagEnabled": true,
      "callDetailsEnabled": false,
      "clientRefName": "ClientRef"
    },
    "isEssential": false
  }
}
```

## Expected

After a `201 Created`, the completed evaluation is readable via `List Completed Qas` for this call, and `Get Call Info` → `model.hasAnsweredForms` becomes `true`.

## Actual

Save → **201** `{"resultMessage":null,"doesOriginalFormChanged":true,"lastLog":null}`.
List Completed Qas immediately → 200, count = 0 (marker "AQA-EVIDENCE-1787997735831" not found).
Get Call Info `hasAnsweredForms` immediately → **false**.
After 5s: List → 200, count = 0; `hasAnsweredForms` → **false**.
No persistent state change from a successful write.

## Reproducibility

2/2 reads (immediate + delayed) this run; matches 2026-08-28/29 observations.

## Alternative explanations ruled out

- **write actually failed** — ruled out — Save returned 201 (2xx success)
- **read is eventually-consistent / needs a delay** — ruled out — still absent after a 5s wait, both via List Completed Qas and the call's own hasAnsweredForms flag
- **wrong callId / form** — ruled out — form id 776 came from Get Available QAs for this exact callId; callId is the known own-site call
- **List filters it out** — ruled out — hasAnsweredForms (an independent flag on the call) also stays false
- **request never fired** — ruled out — raw capture shows the Save POST fired and returned 201

## Downstream impact

`Suppress QA` is untestable/unusable — it needs a real completed-QA id, and none can ever be produced through this API. Any partner workflow that submits completed evaluations via the API loses them silently.

## Workaround

None via the API. Completed evaluations must be entered through the main app.

## Cleanup performed

Nothing to clean up — nothing was persisted.

## Remaining unknowns

Whether a fully-populated `questions`/`sections` body persists (only the required-fields-only body tested). Whether the main app's own save path works (likely a different route).

## Recommended regression test

`qa-api.spec.ts` › "KNOWN BUG — Save completed QAs returns 201 but never actually persists" already pins this (asserts 201 + hasAnsweredForms:false). Keep.

## Suggested bug-ticket wording

**Title**: `POST qc/Quality/SaveCompletedForm` returns 201 but the completed QA is never persisted

**Env**: staging developer1 gateway, key "Primary: API_test", call d71ac345-86a0-f111-9b33-6045bded66d5 (own site), QA form 776.

**Steps**: 1) `POST qc/Quality/SaveCompletedForm` `{id:<formId>, callId, questions:[], sections:[]}` → **201 Created**. 2) `GET qc/Quality/GetAnsweredForms?callId=<callId>` → empty. 3) `GET calls/details/{callId}` → `model.hasAnsweredForms` = **false**. Repeat after a delay — still absent.

**Expected**: the evaluation is saved and readable. **Actual**: 201 with no state change.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P0-SAVE-COMPLETED-QAS.json`
