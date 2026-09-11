# Cross-tenant coverage catalogue — 127 operations, 19 groups

Generated from `tests/dev-portal/cross-tenant-catalog.ts` (the source of truth).
Do not hand-edit — re-run `npx tsx scripts/gen-cross-tenant-catalog.ts`.

**⚠️ NOT RUN LIVE** — see `tests/dev-portal/UNVERIFIED.md`.

## Classification

| Class | Count | Meaning |
|---|---:|---|
| read | 53 | safe read — Pattern A (read-isolation) applies |
| write | 31 | mutating with a disposable / no-op-safe target — Pattern B (write-isolation) applies |
| destructive | 5 | irreversible on real data, no disposable fixture — Pattern B NOT run (test.skip) |
| blocked | 27 | cannot be driven at all (upstream 500 / missing id / console stuck) — test.skip |
| n/a | 11 | customer-level object, no per-site dimension — neither pattern applies |
| **total** | **127** | |

## Per group

| Group | Ops | read | write | destructive | blocked | n/a |
|---|---:|---:|---:|---:|---:|---:|
| Agent Management | 11 | 4 | 6 | 0 | 1 | 0 |
| Calls | 20 | 8 | 8 | 2 | 2 | 0 |
| Chats | 10 | 0 | 0 | 0 | 10 | 0 |
| Extension Management | 6 | 2 | 4 | 0 | 0 | 0 |
| General Settings | 5 | 3 | 0 | 0 | 0 | 2 |
| Group Management | 5 | 2 | 3 | 0 | 0 | 0 |
| Heartbeats | 4 | 1 | 0 | 2 | 1 | 0 |
| IP Whitelist | 3 | 1 | 0 | 0 | 0 | 2 |
| Logs | 1 | 1 | 0 | 0 | 0 | 0 |
| Manual Redaction | 2 | 1 | 0 | 0 | 1 | 0 |
| Notifications | 16 | 8 | 5 | 0 | 3 | 0 |
| QA | 10 | 5 | 0 | 0 | 5 | 0 |
| Reports | 10 | 8 | 0 | 0 | 1 | 1 |
| Restricted User Management | 3 | 2 | 1 | 0 | 0 | 0 |
| Retention Management | 2 | 1 | 1 | 0 | 0 | 0 |
| Role Management | 6 | 2 | 2 | 0 | 2 | 0 |
| Site Management | 4 | 1 | 1 | 1 | 0 | 1 |
| Tag Management | 4 | 1 | 0 | 0 | 0 | 3 |
| User Management | 5 | 2 | 0 | 0 | 1 | 2 |

## Full matrix

### Agent Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Agents | read |  | confirmed site-scoped — evidence run saw 1→17 rows on a site switch | agent-management-api.spec.ts; tenant-isolation-staging |
| Get Agent | read | agentId from List Agents | pointed by-id probe from site B | ADO 37326; agent-management-api.spec.ts |
| Get Supervisors | read |  | no params; site-scoping unconfirmed | ADO 37344; agent-management-api.spec.ts |
| Get Agent Extensions | read | agentId + siteId from List Agents; {pattern} body |  | ADO 37343; agent-management-api.spec.ts |
| Create Agent | write | disposable — created for site A — cleanup: Delete Agent (from site A) | cross-site create for site A's siteId from site B → expect 400 | ADO 37293; agent-management-api.spec.ts |
| Update Agent | blocked |  | KNOWN BUG (BUG-update-agent-site-scoping): 400s for an agent on the caller's OWN site — a cross-site 400 cannot be distinguished from the bug. Pinned separately in agent-management-api.spec.ts. | ADO 37298; evidence P0-UPDATE-AGENT |
| Delete Agent | write | disposable — created under site A — cleanup: Delete Agent (from site A, if the cross-site attempt was correctly rejected) | destructive-if-leaked | ADO 37320; agent-management-api.spec.ts |
| Batch Delete Agents | write | 2 disposable agents created under site A; bare id-string array body — cleanup: Batch/Delete from site A | destructive-if-leaked | ADO 37324; agent-management-api.spec.ts |
| Create Agent Extension Mapping | write | disposable mapping under site A (agent + extension from site A) — cleanup: Delete Agent Extension |  | agent-management-api.spec.ts (sub-CRUD) |
| Update Agent Extension | write | the disposable mapping above — cleanup: Delete Agent Extension |  | agent-management-api.spec.ts |
| Delete Agent Extension | write | the disposable mapping above — cleanup: delete from site A if the cross-site attempt was rejected |  | agent-management-api.spec.ts |

### Calls

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Calls | read |  | confirmed site-scoped; NB routes without the /api/ prefix (CHECK-list-calls-route) but returns 200 | calls-api.spec.ts; tenant-isolation-staging |
| Get Call Info | read | callId from List Calls | pointed by-id probe | calls-api.spec.ts |
| Get Call Notes | read | callId from List Calls | pointed by-id probe | calls-api.spec.ts |
| Add Call Note | write | site-A callId from List Calls — cleanup: Delete Call Note (from site A) if a note leaked through |  | calls-api.spec.ts; negative-required-fields-staging |
| Update Call Note | write | disposable note created under site A — cleanup: Delete Call Note from site A |  | calls-api.spec.ts |
| Delete Call Note | write | disposable note created under site A — cleanup: delete from site A if the cross-site attempt was rejected | destructive-if-leaked | calls-api.spec.ts |
| Edit Call Note Details | write | disposable note under site A; bare JSON-string body — cleanup: Delete Call Note from site A |  | calls-api.spec.ts |
| Update Call Tags | write | site-A call + one of its already-assigned tags (no-op re-apply) — cleanup: none (no-op) |  | calls-api.spec.ts |
| Update Multiple Call Tags | write | site-A call + its own tag (no-op) — cleanup: none | also exercises the console text/plain race (CONSOLE-CONTENT-TYPE) | calls-api.spec.ts |
| Update Legal Hold | write | site-A callId — cleanup: toggle back from site A if it leaked (no no-op form — it toggles) | verifyIntact restores state | calls-api.spec.ts |
| Batch Apply Legal Hold | write | site-A callId; form-urlencoded comma-separated ids — cleanup: Update Legal Hold off from site A if it leaked |  | calls-api.spec.ts |
| Get Linked Calls | read | callId from List Calls | pointed by-id probe | calls-api.spec.ts |
| Get Call Transcription | read | callId from List Calls | pointed by-id probe | calls-api.spec.ts |
| Download Single Audio File | read | callId + timeZoneName | pointed probe — a cross-site SAS download link would itself be a leak | calls-api.spec.ts |
| Download Audio Chunk | read | callId + timeZone + timeZoneName | pointed probe | calls-api.spec.ts |
| Download All Media | read | callId + timeZoneName | pointed probe | calls-api.spec.ts |
| Get Call PCI Data | blocked |  | KNOWN BUG (BUG-get-call-pci-data-500): always 500 for a valid own-site call — isolation cannot be assessed | evidence P1-GET-CALL-PCI-DATA |
| Email Call | blocked |  | KNOWN BUG (BUG-email-call-500): always 500 with a schema-correct body | evidence P1-EMAIL-CALL |
| Batch Expire Calls | destructive |  | permanently deletes real recordings; no API to create a disposable call | coverage doc; calls-api.spec.ts (skipped) |
| Reassign Calls | destructive |  | reassigns every call for an extension + time range in one shot; not scopable to a throwaway | coverage doc; calls-api.spec.ts (skipped) |

### Chats

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Chats | blocked |  | KNOWN BUG (BLOCKER-list-chats-500): backend injects a SiteId filter its own validator rejects → 500 on every body variant. Only source of a chatId, in the API and the app. | evidence P0-LIST-CHATS |
| Add Chat Note | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Get Chat Notes | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Update Chat Note | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Delete Chat Note | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Download Chat | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Get Chat Details | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Get Chat Message Notes | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Get Chat Messages | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |
| Send Chat Email | blocked |  | no chatId obtainable — List Chats 500s (see chats/list-chats) | coverage doc; chats-api.spec.ts (skipped) |

### Extension Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Extensions | read |  | confirmed site-scoped — evidence saw 1→13 rows on a switch | extension-management-api.spec.ts; tenant-isolation-staging |
| Get Extension | read | extensionId from List Extensions | pointed by-id probe | ADO 37417; extension-management-api.spec.ts |
| Create Extension | write | cross-site create for site A's siteId from site B → expect 400 — cleanup: Delete Extension from site A if it leaked | cross-site rejection already CONFIRMED (CHECK-create-extension-own-site); own-site 500 is a separate watch item | extension-management-api.spec.ts; evidence P1-CREATE-EXTENSION-OWN-SITE |
| Update Extension | write | existing extension on site A (List Extensions) — cleanup: none (no-op payload) | already covered by tenant-isolation-negative-writes-staging — folded in here | ADO 37438; tenant-isolation-negative-writes-staging.spec.ts |
| Delete Extension | write | disposable extension created under site A — cleanup: Delete Extension from site A if the cross-site attempt was rejected | destructive-if-leaked | extension-management-api.spec.ts |
| Reassign Extension | write | 2 disposable extensions under site A — cleanup: Delete both from site A |  | extension-management-api.spec.ts |

### General Settings

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| Get Company Info | read |  | customer-level — confirmed unchanged across a site switch (2026-08-28) | general-settings-api.spec.ts; tenant-isolation-staging NOT_SITE_SCOPED |
| Get SSO Configuration | read |  | customer-level — confirmed unchanged | general-settings-api.spec.ts; tenant-isolation-staging |
| Get Storage Locations | read |  | customer-level — confirmed unchanged | general-settings-api.spec.ts; tenant-isolation-staging |
| Update Company Settings | n/a |  | customer-level object — no per-site "site A vs site B" version to attack | general-settings-api.spec.ts |
| Update SSO Settings | n/a |  | customer-level object — no per-site dimension | general-settings-api.spec.ts |

### Group Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Agent Groups | read |  | confirmed site-scoped — evidence saw []→1 rows on a switch | group-management-api.spec.ts; tenant-isolation-staging |
| Get Agent Group | read | groupId from List Agent Groups | pointed probe — manual §4.5 saw cross-site 204 | ADO 37480; group-management-api.spec.ts |
| Create Agent Group | write | disposable group created under site A (seeded with a real site-A agent) — cleanup: Delete Agent Group from site A | cross-site create for site A from site B → expect reject. NB Create returns id:0 (KNOWN BUG) — read real id back from List. | ADO 37478; group-management-api.spec.ts; evidence P1-CREATE-AGENT-GROUP-ID-ZERO |
| Update Agent Group | write | disposable group under site A — cleanup: Delete Agent Group from site A | no-op payload (send isActive:true — omitting it is a full-replace deactivate, historical bug). Manual §4.5 saw cross-site 400. | group-management-api.spec.ts; CONTRACT-update-agent-group-full-replace |
| Delete Agent Group | write | disposable group under site A — cleanup: delete from site A if the cross-site attempt was rejected | destructive-if-leaked; manual §4.5 saw cross-site 400 | ADO 37479; group-management-api.spec.ts |

### Heartbeats

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Server Heartbeats | read |  | DOCUMENTED GAP — customer-scoped, NOT site-scoped (pre-existing). Byte-identical across a switch is expected here; flag if that changes. | heartbeats-api.spec.ts; tenant-isolation-staging NOT_SITE_SCOPED |
| List Client Heartbeats | blocked |  | KNOWN BUG (tenant-scoping-bugs Bug 5): broken default body, several 500 causes — cannot get a clean read to diff | tenant-scoping-bugs.spec.ts |
| Delete Client Heartbeat | destructive |  | operates on real monitoring records; no disposable fixture | heartbeats-api.spec.ts (skipped) |
| Delete Server Heartbeat | destructive |  | operates on real monitoring records; no disposable fixture | heartbeats-api.spec.ts (skipped) |

### IP Whitelist

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| IP Whitelist List | read |  | customer-level — confirmed unchanged across a switch | ip-whitelist-api.spec.ts; tenant-isolation-staging |
| Add IP Whitelist | n/a |  | customer-level entry — no per-site dimension (also: 500-not-400 on missing field, BUG-negative-missing-field-500) | ip-whitelist-api.spec.ts |
| Delete IP Whitelist | n/a |  | customer-level entry — no per-site dimension | ip-whitelist-api.spec.ts |

### Logs

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Logs | read |  | customer-level audit log — confirmed unchanged across a switch | logs-api.spec.ts; tenant-isolation-staging |

### Manual Redaction

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Call Redaction Requests | read | callId from List Calls | pointed probe — manual §5 confirmed a clean cross-site pair, never automated | manual-redaction-api.spec.ts |
| Submit Call Redaction Request | blocked |  | standing "do not fire Manual Redaction requests" hold + endpoint currently hangs with no response (MASTER §12) — the matrix never fires it (named skip) | evidence P1-MANUAL-REDACTION-HANG |

### Notifications

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Alert Types | read |  | global reference list — same for every customer/site | notifications-api.spec.ts; tenant-isolation-staging |
| List Notification Rules | read |  | SUSPECTED SCOPING GAP — unchanged across 3 switches, but Add Notification Rule has a siteIds field so it plausibly SHOULD be site-filtered. Triage. | SCOPING-suspected-gaps.md |
| List Notifications Action Types | read |  | global reference list | notifications-api.spec.ts |
| List Notifications Participant Types | read |  | global reference list | notifications-api.spec.ts |
| List Notifications Trigger Types | read |  | global reference list | notifications-api.spec.ts |
| Get Alert Trigger Topics | read |  | global reference list | notifications-api.spec.ts |
| List Alert Events | read |  | SUSPECTED SCOPING GAP — unchanged across switches; intent unclear. Triage. | SCOPING-suspected-gaps.md |
| Upsert Alert Configuration | write | disposable alert config created under site A — cleanup: Delete Alert Configuration from site A | alert-config site-scoping UNCONFIRMED — if the cross-site upsert succeeds, log as triage rather than LEAK | notifications-api.spec.ts |
| Get Alert Configuration | read | alertId from a disposable created under site A | pointed probe; site-scoping unconfirmed → triage | notifications-api.spec.ts |
| Delete Alert Configuration | write | disposable alert config under site A — cleanup: delete from site A if the cross-site attempt was rejected | destructive-if-leaked; scoping unconfirmed | notifications-api.spec.ts |
| Add Notification Rule | write | rule body carries siteIds:[siteA] — cross-site create for site A from site B — cleanup: Delete Notification Rule from site A | the rule DTO has an explicit siteIds field, so this is the clearest write-isolation case in the group | notifications-api.spec.ts |
| Update Notification Rule | write | disposable rule under site A — cleanup: Delete Notification Rule from site A | no-op payload | notifications-api.spec.ts |
| Delete Notification Rule | write | disposable rule under site A — cleanup: delete from site A if the cross-site attempt was rejected | destructive-if-leaked | notifications-api.spec.ts |
| Get Alert Trigger Operators | blocked |  | CONSOLE BUG (CONSOLE-GET-ALERT-TRIGGER-OPERATORS): the console bakes the literal ?id={id} and every send 400s — cannot drive it | evidence CONSOLE-GET-ALERT-TRIGGER-OPERATORS |
| Preview Alert Log | blocked |  | KNOWN BUG (BUG-preview-alert-log-500): always 500 | evidence P1-PREVIEW-ALERT-LOG |
| Get Alert Notification (old) | blocked |  | KNOWN BUG (BUG-get-alert-notification-old-500): always 500 (NRE) even for a real id | evidence P1-GET-ALERT-NOTIFICATION-OLD |

### QA

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| Get Available QAs | read | callId from List Calls | pointed probe — forms available for a site-A call, requested from site B | qa-api.spec.ts |
| Get QA | read | formId from Get Available QAs | pointed probe | qa-api.spec.ts |
| Get All QAs | read |  | confirmed site-scoped — evidence saw it re-scope on a switch | qa-api.spec.ts; tenant-isolation-staging |
| List Completed Qas | read | callId from List Calls | pointed probe | qa-api.spec.ts |
| Get AQA Phrases | read | callId + formId | pointed probe | qa-api.spec.ts |
| Save completed QAs | blocked |  | KNOWN BUG (BUG-save-completed-qas-not-persisted): 201 but never persists — cannot verify a cross-site write took / did not take | evidence P0-SAVE-COMPLETED-QAS |
| Email QA | blocked |  | KNOWN BUG: 400 "Configured site does not contain selected call" for the key's OWN in-site call — cross-site 400 is indistinguishable | qa-api.spec.ts |
| Suppress QA | blocked |  | no real completed-QA id obtainable (Save completed QAs never persists one) | qa-api.spec.ts (skipped) |
| Generate QA PDF | blocked |  | multipart/form-data body — the Try-it console only offers Raw/Binary | qa-api.spec.ts (skipped) |
| Generate QA Excel | blocked |  | same multipart-only body as Generate QA PDF | qa-api.spec.ts (skipped) |

### Reports

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Report Templates | read |  | SUSPECTED SCOPING GAP — unchanged across switches; intent unclear. Triage. | SCOPING-suspected-gaps.md |
| Get Call Volume Statistics | read |  | confirmed site-scoped | reports-api.spec.ts; tenant-isolation-staging |
| Get Calls Counter | read |  | confirmed site-scoped | reports-api.spec.ts; tenant-isolation-staging |
| Get Site Usage Statistics | read | siteId query param = site A's id, sent from site B | pointed cross-site read — a per-site key pulling another site's usage figures | reports-api.spec.ts |
| Get Sites Storage Usage | read |  | confirmed site-scoped — this IS the live site probe (`currentKeySite`); returns exactly the calling key's site | reports-api.spec.ts; _helpers.currentKeySite |
| Get Six Month Call Volume | read |  | confirmed site-scoped | reports-api.spec.ts; tenant-isolation-staging |
| Get Storage Usage | read | siteId query param = site A's id, sent from site B | pointed cross-site read (like Get Site Usage Statistics) | reports-api.spec.ts |
| Get User Activity Summary | read | period enum (0/1/2) required | users are customer-level — site-scoping unconfirmed. Triage. | reports-api.spec.ts |
| Delete Report Template | n/a |  | report templates are customer-level (no siteId in the DTO); no create counterpart to make a disposable. Read-side scoping is covered by reports/list-report-templates (triage). | reports-api.spec.ts |
| Get Report By Template | blocked |  | KNOWN BUG (BUG-get-report-by-template-500): always 500 (NRE) with a schema-correct body | evidence P1-GET-REPORT-BY-TEMPLATE |

### Restricted User Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Restricted Accesses | read |  | DOCUMENTED: currently NOT site-scoped at all (BUG-restricted-user-no-site-scoping, 2026-08-27 controlled run). A byte-identical result across the switch IS the known bug — the check documents it until fixed. Expectation: hypothesis. | evidence P0-RESTRICTED-USER-SCOPING |
| Get Restricted User | read | userId from List Restricted Accesses; bound to site A first via Update Restricted User Access | pointed probe — 2026-08-27 saw the full record returned cross-site. Expectation: hypothesis. | evidence P0-RESTRICTED-USER-SCOPING |
| Update Restricted User Access | write | a restricted user bound to site A by the test — cleanup: restore the user's original siteIds from site A | cross-site Update has NEVER been executed — the "expect 400" is a pure hypothesis. Record the observed status; soft-assert only. | evidence P0-RESTRICTED-USER-SCOPING; ADO 37600 |

### Retention Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Retention Policies | read |  | confirmed site-scoped — always exactly one row, for the calling key's site. NB the SiteID filter is a separate 500 (BUG-list-retention-siteid-filter-500) — not used here. | retention-management-api.spec.ts; tenant-isolation-staging |
| Update Retention Policy | write | siteId query param = site A's id, sent from site B — cleanup: none (Update is idempotent; restore expirationDays from site A if it leaked) | cross-site rejection already CONFIRMED (tenant-isolation-negative-writes-staging → not 200) — folded in here | tenant-isolation-negative-writes-staging.spec.ts |

### Role Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Custom Roles | read |  | coverage doc lists this as correctly site-scoped (re-scopes on a switch) | role-management-api.spec.ts; tenant-isolation-staging |
| List Custom Role Restrictions | read |  | no params; site-scoping unconfirmed. Triage. | ADO 37612; role-management-api.spec.ts |
| Create Custom Role | write | disposable role created under site A — cleanup: no Delete Custom Role available (console stuck) — role is left, uniquely named. Track leftover roles. | role site-scoping is ambiguous (Create returns customerId 00000000). If cross-site create succeeds, log as triage. NB no cleanup path (see role-mgmt/delete-custom-role). | role-management-api.spec.ts; BUG-negative-missing-field-500 |
| Update Custom Role | write | disposable role under site A; settings/custom-roles/permissions, access:"[]" JSON string — cleanup: no Delete available — leftover role, uniquely named | no-op permissions payload | ADO 37614; role-management-api.spec.ts |
| Delete Custom Role | blocked |  | CONSOLE BUG (CONSOLE-DELETE-CUSTOM-ROLE): the Try-it console never renders a Send button (7/7 attempts) — cannot drive it | evidence CONSOLE-DELETE-CUSTOM-ROLE |
| Get Custom Role | blocked |  | KNOWN BUG (BUG-get-custom-role-ignores-roleid): returns a locked system role for ANY id, real or bogus — a pointed by-id probe is meaningless until fixed | evidence P0-GET-CUSTOM-ROLE |

### Site Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Sites | read |  | INTENTIONALLY account-wide (an admin manages every site) — byte-identical across a switch is correct, not a gap | site-management-api.spec.ts; tenant-isolation-staging |
| Add Site | n/a |  | creating a site is an account-level operation — not "site A vs site B" scoped | site-management-api.spec.ts |
| Update Site | write | site A itself (siteId), updated from a key scoped to site B — cleanup: none (no-op payload — write the site's own current values back) | the site IS the scoping dimension — a key on B changing site A's config should be rejected | site-management-api.spec.ts |
| Delete Site | destructive |  | deleting a site may cascade (recordings, extensions, retention); blast radius not worth a cross-site probe even though a disposable-site lifecycle exists in site-management-api | site-management-api.spec.ts |

### Tag Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Tags | read |  | customer-level — confirmed unchanged across a switch | tag-management-api.spec.ts; tenant-isolation-staging |
| Add Tag | n/a |  | tags are customer-level — no per-site dimension (also: alphanumeric-only name validation, CONTRACT-update-tag-name-validation) | tag-management-api.spec.ts |
| Update Tag | n/a |  | tags are customer-level | tag-management-api.spec.ts |
| Delete Tag | n/a |  | tags are customer-level | tag-management-api.spec.ts |

### User Management

| Operation | Class | id source / cleanup | Reason / caveat | Source |
|---|---|---|---|---|
| List Users | read |  | customer-level — confirmed unchanged across a switch | user-management-api.spec.ts; tenant-isolation-staging |
| Get User | read | userId from List Users | pointed probe — users are customer-level, so cross-site visibility is expected (known-global) | user-management-api.spec.ts |
| Add User | n/a |  | users are customer-level — no per-site dimension | user-management-api.spec.ts |
| Update User | n/a |  | users are customer-level | user-management-api.spec.ts |
| Delete User | blocked |  | CONSOLE BUG (BUG-delete-user-send-inert): the Send button fires no network request at all — cannot drive it | evidence P1-DELETE-USER-SEND |

