# Blocked operations & destructive operations — dependency graphs and fixture requirements

Environment: staging `developer1-portal.callcabinet.com` / gateway `developer1.callcabinet.com`,
account `romana@callcabinet.com`, company CC Test 1, key "Primary: API_test".

---

## A. Blocked by an upstream bug

### A.1 Chats — 9 operations unreachable

```
POST calls/chats/list  (List Chats)  ── always 500, server-injected SiteId filter ──┐
                                                                                     │  full write-up:
   the ONLY source of a chatId, in the API AND in the main app                       │  05-blockers/BLOCKER-list-chats-500.md
                                                                                     ▼
   ┌───────────────────────────── no chatId obtainable ─────────────────────────────┐
   │ Add Chat Note        POST calls/chats/{chatId}/notes           needs chatId     │
   │ Get Chat Notes       GET  calls/chats/{chatId}/notes           needs chatId     │
   │ Update Chat Note     POST calls/chats/{chatId}/notes/{noteId}  needs chatId+id  │
   │ Delete Chat Note     DEL  calls/chats/{chatId}/notes/{noteId}  needs chatId+id  │
   │ Download Chat        GET  calls/chats/{chatId}/download         needs chatId     │
   │ Get Chat Details     POST calls/chats/{chatId}                 needs chatId     │
   │ Get Chat Message Notes GET calls/chats/messages/{messageId}/notes  needs msgId  │
   │ Get Chat Messages    GET  calls/chats/{chatId}/messages        needs chatId     │
   │ Send Chat Email      POST calls/chats/email                    needs chatId(s)  │
   └───────────────────────────────────────────────────────────────────────────────┘
```

**Unblock condition**: fix `POST calls/chats/list` (remove/repair the injected `SiteId` filter). Then all 9 become testable with a `chatId` read from the list.

### A.2 QA — Suppress QA unreachable

```
POST qc/Quality/SaveCompletedForm (Save completed QAs) ── returns 201 but NEVER persists ──┐
                                                          (01-backend-bugs/BUG-save-completed-qas-not-persisted.md)
                                                                                            ▼
   no real completed-QA id is ever produced through the API
                                                                                            ▼
   POST qc/Quality/SuppressForm (Suppress QA)  ── needs a real completed-QA id ──  UNTESTABLE
```

**Unblock condition**: fix `Save completed QAs` persistence. Then `List Completed Qas` yields a real id for `Suppress QA`.

---

## B. Blocked by a console limitation (the request shape can't be built)

### B.1 QA — Generate QA PDF / Generate QA Excel

| Operation | Endpoint | Required body |
|---|---|---|
| Generate QA PDF | `POST qc/Quality/GetPdf` | **`multipart/form-data`** — fields `data`, `callId`, `timeZone` |
| Generate QA Excel | `POST qc/Quality/GetExcel` | **`multipart/form-data`** (same class) |

The Try-it console's Body section only offers **Raw** / **Binary** radio modes — there is no UI to build named `multipart/form-data` fields. So the request the operation requires **cannot be constructed through the console at all**, with any input. Same *class* of limitation as `Get Alert Trigger Operators`'s baked `{id}` (a request shape the console structurally cannot produce), on a different operation.

**Coverage status**: `test.skip("Generate QA PDF — multipart/form-data body cannot be built in the Try-it console")` and the same for Excel, in `qa-api.spec.ts`.

**To automate later**: drive it outside the console — `page.evaluate` + `FormData` + `fetch` against `qc/Quality/GetPdf` with the CRA-Api-Key, OR a direct Playwright `request.post` with a `multipart` body. Needs: a real `callId` (own site), a valid `data` payload (the completed-form JSON — but see A.2, that can't be persisted, so `data` would have to be a synthetic form), and `timeZone`.

---

## C. Destructive operations — NOT executed (investigation is documentation-only)

Per the task guardrail: not run without an explicitly-approved disposable-data strategy.

| Operation | Endpoint | What it mutates | Why the shared env is unsafe | Fixture / env needed to automate |
|---|---|---|---|---|
| **Batch Expire Calls** | `DELETE calls/calls` (`x-www-form-urlencoded`, comma-separated call-id GUIDs) | Marks the listed call records for deletion → triggers backend cleanup (**permanent**). | CC Test 1 has only real, shared QA-account recordings; no disposable call fixture. An accidental wrong id deletes a real recording. | A dedicated customer/site whose calls are all synthetic + regenerated, OR an "Add Demo Call"–style API to create a throwaway call, then expire only that id. Verify via `Get Call Info` → 404 after. |
| **Reassign Calls** | `POST settings/agents/reassign-calls` | Reassigns **every** call for a given extension + time range to a different agent — not scoped to one call id. | Not scopable to a single throwaway record — it moves real customer call/agent metadata for a whole extension+window. | Two disposable agents + one disposable extension with only synthetic calls in a bounded window; reassign that window; verify via `List Calls` agent field. |
| **Delete Client Heartbeat** | `POST qc/ClientHeartbeats/DeleteHeartbeat` (query param `heartbeatId`) | Deletes a QA recording-client heartbeat/status entry. | Heartbeats are real client/server monitoring records; this suite has no way to create one disposably. Deleting one loses genuine monitoring history. | A test recording client whose heartbeats are disposable, OR a backend fixture to insert a synthetic heartbeat, then delete it; verify via `List Client Heartbeats`. |
| **Delete Server Heartbeat** | `POST admin/heartbeats/delete` (query param) | Deletes a recording-server heartbeat entry. | Same as above — real infra-monitoring data. | Same as above for server heartbeats. |

**Coverage status**: `test.skip(...)` with these reasons in `calls-api.spec.ts` (Batch Expire Calls, Reassign Calls) and `heartbeats-api.spec.ts` (Delete Client/Server Heartbeat).

---

## D. Summary — why each of the ~16 skipped operations is skipped

| # | Operation | Reason | Category |
|--:|---|---|---|
| 1–9 | Chats: Add/Get/Update/Delete Chat Note, Download Chat, Get Chat Details, Get Chat Message Notes, Get Chat Messages, Send Chat Email | no `chatId` (List Chats 500) | Blocked by upstream bug |
| 10 | QA: Suppress QA | no completed-QA id (Save completed QAs doesn't persist) | Blocked by upstream bug |
| 11 | QA: Generate QA PDF | `multipart/form-data` not buildable in the console | Console limitation |
| 12 | QA: Generate QA Excel | `multipart/form-data` not buildable in the console | Console limitation |
| 13 | Calls: Batch Expire Calls | permanent delete, no disposable call fixture | Destructive |
| 14 | Calls: Reassign Calls | moves a whole extension's call history | Destructive |
| 15 | Heartbeats: Delete Client Heartbeat | real monitoring record, no disposable fixture | Destructive |
| 16 | Heartbeats: Delete Server Heartbeat | real monitoring record, no disposable fixture | Destructive |
