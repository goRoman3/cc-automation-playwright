# BUG — Delete User: clicking "Send" in the Try-it console fires NO network request (no OPTIONS, no POST)

- **ID**: P1-DELETE-USER-SEND
- **Classification**: CONSOLE/UI BUG (Send is inert for this operation)
- **Severity**: P1

## Environment

```
timestamp:        2026-08-29T10:24:20.962Z
app:              https://atmossystemsstaging.callcabinet.com (TWO s)
developer portal: https://developer1-portal.callcabinet.com
gateway:          https://developer1.callcabinet.com
company:          CC Test 1
account:          romana@callcabinet.com
subscription key: Primary: API_test
key current site: (unknown) / (unknown)
git:              feature/chat-listing @ ed251c2
```

## Preconditions / Resource IDs

```json
{
  "userId": "545fdb55-040b-422b-980b-e4d13eae39ea",
  "userRId": "ff247171-c780-47b4-b0e5-7b3d925b7131",
  "email": "aqa-evidence-deluser+1787999060962@callcabinet.com"
}
```

## Endpoint chain

## Step 1 — Add User (same console session — fires a real request)

### Add User (same console session — fires a real request)

```
startedAt:     2026-08-29T10:24:27.775Z
latencyMs:     2707
method:        POST
url:           https://developer1.callcabinet.com/api/settings/users/
pathname:      /api/settings/users/
query:         {}
Content-Type:  application/json
sub-key hdr:   <redacted len=32>
request body:  {"userRoleIdCombined":"3","qcRId":0,"email":"aqa-evidence-deluser+1787999060962@callcabinet.com","firstName":"AQA","lastName":"evidence del"}
--
status:        200
response body: {"id":"545fdb55-040b-422b-980b-e4d13eae39ea","userRId":"ff247171-c780-47b4-b0e5-7b3d925b7131","userCRId":null,"userCR":null,"userRoleIdCombined":"3","userRoleNameCombined":"Standard User","userR":"Standard User","qcRId":0,"qcR":null,"email":"aqa-evidence-deluser+1787999060962@callcabinet.com","firstName":"AQA","lastName":"evidence del","phoneNumber":null,"dateFormat":null,"userRLvl":null,"twoFactorEnabled":false,"twoFactorType":null,"notes":null,"domainUsername":null,"isActive":null,"ssoOnly":false,"cuIsActive":null,"customerId":"00000000-0000-0000-0000-000000000000","partnerID":null,"customerName":null,"useExistingData":null}
```

## Step 2 — Get User (same session — fires a real request, returns userRId)

### Get User (same session — fires a real request, returns userRId)

```
startedAt:     2026-08-29T10:24:35.194Z
latencyMs:     392
method:        GET
url:           https://developer1.callcabinet.com/api/settings/get-users/545fdb55-040b-422b-980b-e4d13eae39ea
pathname:      /api/settings/get-users/545fdb55-040b-422b-980b-e4d13eae39ea
query:         {}
Content-Type:  (none)
sub-key hdr:   <redacted len=32>
request body:  (none)
--
status:        200
response body: {"id":"545fdb55-040b-422b-980b-e4d13eae39ea","userRId":"ff247171-c780-47b4-b0e5-7b3d925b7131","userCRId":null,"userCR":null,"userRoleIdCombined":"3","userRoleNameCombined":"Standard User","userR":"Standard User","qcRId":0,"qcR":"None","email":"aqa-evidence-deluser+1787999060962@callcabinet.com","firstName":"AQA","lastName":"evidence del","phoneNumber":"","dateFormat":null,"userRLvl":3,"twoFactorEnabled":false,"twoFactorType":null,"notes":null,"domainUsername":null,"isActive":true,"ssoOnly":false,"cuIsActive":true,"customerId":"00000000-0000-0000-0000-000000000000","partnerID":null,"customerName":null,"useExistingData":null}
```

## Step 3 — Delete User — attempt 1 (Send clicked)

### Delete User — attempt 1 (Send clicked)

**NO NETWORK REQUEST CAPTURED for this step.**

## Step 4 — Delete User — attempt 2 (Send clicked)

### Delete User — attempt 2 (Send clicked)

**NO NETWORK REQUEST CAPTURED for this step.**

## Step 5 — Delete User — attempt 3 (Send clicked)

### Delete User — attempt 3 (Send clicked)

**NO NETWORK REQUEST CAPTURED for this step.**

## Expected

Clicking Send issues `POST settings/users/delete/?userId=...&userRId=...` (preceded by an OPTIONS preflight), like every other operation.

## Actual

Add User → 200 (request fired), Get User → 200 (request fired). Delete User: 3 attempts, `settings/users/delete` API calls fired = [0, 0, 0]; client timed out each time (`waitForResponse` 30s). **No network request was made at all** — not even an OPTIONS preflight.

## Reproducibility

3/3 attempts fired zero requests this run; matches 2026-08-28 sixth session (trace + network-log analysis across 5 reproductions).

## Alternative explanations ruled out

- **params not attached** — ruled out — 2026-08-28 confirmed the live request preview reads `POST .../users/delete/?userId=...&userRId=...`; both params filled here via addParameter
- **Send button disabled / duplicate** — ruled out (2026-08-28) — exactly one Send, verified enabled + visible
- **the console session is dead** — ruled out — Add User and Get User in the SAME session fired real requests (200/200)
- **this is the schema/render race** — distinct — the console renders fully (Send visible, params fillable); the click just does nothing. Not a hang class; a silent no-op.

## Downstream impact

Delete User cannot be invoked through the Try-it console. (The underlying API may be fine — untested here since firing it directly would delete a real user.) Any partner relying on the console to exercise this op is blocked.

## Workaround

Call `POST settings/users/delete/?userId=...&userRId=...` directly (not via the console).

## Cleanup performed

AQA test user "aqa-evidence-deluser+1787999060962@callcabinet.com" (545fdb55-040b-422b-980b-e4d13eae39ea) is left un-deleted — the console can't delete it and this test does not fire the delete directly. Disposable per the ADO tickets.

## Remaining unknowns

Whether the backend `POST settings/users/delete` works when called directly (not tested — would delete a real user). Why the console's Send handler is a no-op only for this one operation.

## Recommended regression test

`user-management-api.spec.ts` › "Add User → Get User → Update User → Delete User" already asserts `expect(deleteOp.send()).rejects.toThrow(/Timeout/)` as a KNOWN BUG. Keep.

## Suggested bug-ticket wording

**Title**: Developer Portal console — "Send" on **Delete User** fires no request (no OPTIONS, no POST)

**Steps**: open Delete User via the catalogue → Try this operation → fill `userId` + `userRId` (request preview shows `POST .../api/settings/users/delete/?userId=...&userRId=...`) → click Send. **No network activity.** Add User / Get User / Update User in the same session fire real requests.

**Expected**: Send issues the DELETE request.

## Raw evidence files

- `C:\Users\Work\Documents\projects\AQA\cc-automation-playwright\artifacts\dev-portal-evidence-2026-08-29\raw\P1-DELETE-USER-SEND.json`
