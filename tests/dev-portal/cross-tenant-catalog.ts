import type { CatalogEntry } from './_cross-tenant';

/**
 * Full catalogue of the Developer Portal / API Management "Try this operation"
 * surface — **127 operations across 19 groups**, each classified relative to
 * the two cross-tenant patterns (see `_cross-tenant.ts`).
 *
 * Sources reconciled 2026-08-30:
 *  - the 19 consolidated `tests/dev-portal/*-api.spec.ts` (operation names,
 *    matchers, confirmed payloads — every one live-verified 2026-08-29);
 *  - `docs/dev-portal-api-management-coverage-2026-08-29.md` (per-op matrix);
 *  - `docs/dev-portal-suite-rework-2026-08-29.md` (ADO 37288 case map, bug list);
 *  - `artifacts/dev-portal-evidence-2026-08-29/` (site-scoping verdicts, bug ids).
 *
 * `read`/`write` executable plans (`entry.read` / `entry.write`) are attached
 * in `cross-tenant-matrix.spec.ts`, not here — this file is the classification
 * source of truth only.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */
export const CATALOG: CatalogEntry[] = [
  // ── Agent Management (11) ────────────────────────────────────────────────
  { id: 'agent-mgmt/list-agents', group: 'Agent Management', operation: 'List Agents', match: /^List Agents/,
    cls: 'read', reason: 'confirmed site-scoped — evidence run saw 1→17 rows on a site switch', source: 'agent-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'agent-mgmt/get-agent', group: 'Agent Management', operation: 'Get Agent', match: /^Preview Agent \(/,
    cls: 'read', idSource: 'agentId from List Agents', reason: 'pointed by-id probe from site B', source: 'ADO 37326; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/get-supervisors', group: 'Agent Management', operation: 'Get Supervisors', match: /^List Supervisors/,
    cls: 'read', reason: 'no params; site-scoping unconfirmed', source: 'ADO 37344; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/get-agent-extensions', group: 'Agent Management', operation: 'Get Agent Extensions', match: /^List Agent Extensions/,
    cls: 'read', idSource: 'agentId + siteId from List Agents; {pattern} body', source: 'ADO 37343; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/create-agent', group: 'Agent Management', operation: 'Create Agent', match: /^Create Agent \(/,
    cls: 'write', idSource: 'disposable — created for site A', cleanup: 'Delete Agent (from site A)',
    reason: 'cross-site create for site A\'s siteId from site B → expect 400', source: 'ADO 37293; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/update-agent', group: 'Agent Management', operation: 'Update Agent', match: /^Update Agent \(/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-update-agent-site-scoping): 400s for an agent on the caller\'s OWN site — a cross-site 400 cannot be distinguished from the bug. Pinned separately in agent-management-api.spec.ts.', source: 'ADO 37298; evidence P0-UPDATE-AGENT' },
  { id: 'agent-mgmt/delete-agent', group: 'Agent Management', operation: 'Delete Agent', match: /^Delete Agent \(/,
    cls: 'write', idSource: 'disposable — created under site A', cleanup: 'Delete Agent (from site A, if the cross-site attempt was correctly rejected)',
    reason: 'destructive-if-leaked', source: 'ADO 37320; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/batch-delete-agents', group: 'Agent Management', operation: 'Batch Delete Agents', match: /^Batch Delete Agents/,
    cls: 'write', idSource: '2 disposable agents created under site A; bare id-string array body', cleanup: 'Batch/Delete from site A',
    reason: 'destructive-if-leaked', source: 'ADO 37324; agent-management-api.spec.ts' },
  { id: 'agent-mgmt/create-agent-extension-mapping', group: 'Agent Management', operation: 'Create Agent Extension Mapping', match: /^Create Agent Extension Mapping/,
    cls: 'write', idSource: 'disposable mapping under site A (agent + extension from site A)', cleanup: 'Delete Agent Extension',
    source: 'agent-management-api.spec.ts (sub-CRUD)' },
  { id: 'agent-mgmt/update-agent-extension', group: 'Agent Management', operation: 'Update Agent Extension', match: /^Update Agent Extension/,
    cls: 'write', idSource: 'the disposable mapping above', cleanup: 'Delete Agent Extension', source: 'agent-management-api.spec.ts' },
  { id: 'agent-mgmt/delete-agent-extension', group: 'Agent Management', operation: 'Delete Agent Extension', match: /^Delete Agent Extension/,
    cls: 'write', idSource: 'the disposable mapping above', cleanup: 'delete from site A if the cross-site attempt was rejected', source: 'agent-management-api.spec.ts' },

  // ── Calls (20) ──────────────────────────────────────────────────────────
  { id: 'calls/list-calls', group: 'Calls', operation: 'List Calls', match: /^List Calls/,
    cls: 'read', reason: 'confirmed site-scoped; NB routes without the /api/ prefix (CHECK-list-calls-route) but returns 200', source: 'calls-api.spec.ts; tenant-isolation-staging' },
  { id: 'calls/get-call-info', group: 'Calls', operation: 'Get Call Info', match: /^Preview Call Info/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed by-id probe', source: 'calls-api.spec.ts' },
  { id: 'calls/get-call-notes', group: 'Calls', operation: 'Get Call Notes', match: /^List Call Notes/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed by-id probe', source: 'calls-api.spec.ts' },
  { id: 'calls/add-call-note', group: 'Calls', operation: 'Add Call Note', match: /^Add Call Note/,
    cls: 'write', idSource: 'site-A callId from List Calls', cleanup: 'Delete Call Note (from site A) if a note leaked through',
    source: 'calls-api.spec.ts; negative-required-fields-staging' },
  { id: 'calls/update-call-note', group: 'Calls', operation: 'Update Call Note', match: /^Update Call Note/,
    cls: 'write', idSource: 'disposable note created under site A', cleanup: 'Delete Call Note from site A', source: 'calls-api.spec.ts' },
  { id: 'calls/delete-call-note', group: 'Calls', operation: 'Delete Call Note', match: /^Delete Call Note/,
    cls: 'write', idSource: 'disposable note created under site A', cleanup: 'delete from site A if the cross-site attempt was rejected', reason: 'destructive-if-leaked', source: 'calls-api.spec.ts' },
  { id: 'calls/edit-call-note-details', group: 'Calls', operation: 'Update Call Note Details', match: /^Update Call Note Details/,
    cls: 'write', idSource: 'disposable note under site A; bare JSON-string body', cleanup: 'Delete Call Note from site A', source: 'calls-api.spec.ts' },
  { id: 'calls/update-call-tags', group: 'Calls', operation: 'Update Call Tags', match: /^Update Call Tags/,
    cls: 'write', idSource: 'site-A call + one of its already-assigned tags (no-op re-apply)', cleanup: 'none (no-op)', source: 'calls-api.spec.ts' },
  { id: 'calls/update-multiple-call-tags', group: 'Calls', operation: 'Update Multiple Call Tags', match: /^Update Multiple Call Tags/,
    cls: 'write', idSource: 'site-A call + its own tag (no-op)', cleanup: 'none', reason: 'also exercises the console text/plain race (CONSOLE-CONTENT-TYPE)', source: 'calls-api.spec.ts' },
  { id: 'calls/update-legal-hold', group: 'Calls', operation: 'Update Legal Hold', match: /^Update Legal Hold/,
    cls: 'write', idSource: 'site-A callId', cleanup: 'toggle back from site A if it leaked (no no-op form — it toggles)', reason: 'verifyIntact restores state', source: 'calls-api.spec.ts' },
  { id: 'calls/batch-apply-legal-hold', group: 'Calls', operation: 'Batch Apply Legal Hold', match: /^Batch Apply Legal Hold/,
    cls: 'write', idSource: 'site-A callId; form-urlencoded comma-separated ids', cleanup: 'Update Legal Hold off from site A if it leaked', source: 'calls-api.spec.ts' },
  { id: 'calls/get-linked-calls', group: 'Calls', operation: 'Get Linked Calls', match: /^List Linked Calls/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed by-id probe', source: 'calls-api.spec.ts' },
  { id: 'calls/get-call-transcription', group: 'Calls', operation: 'Get Call Transcription', match: /^Preview Call Transcription/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed by-id probe', source: 'calls-api.spec.ts' },
  { id: 'calls/download-single-audio-file', group: 'Calls', operation: 'Download Single Audio File', match: /^Download Single Audio File/,
    cls: 'read', idSource: 'callId + timeZoneName', reason: 'pointed probe — a cross-site SAS download link would itself be a leak', source: 'calls-api.spec.ts' },
  { id: 'calls/download-audio-chunk', group: 'Calls', operation: 'Download Audio Chunk', match: /^Download Audio Chunk/,
    cls: 'read', idSource: 'callId + timeZone + timeZoneName', reason: 'pointed probe', source: 'calls-api.spec.ts' },
  { id: 'calls/download-all-media', group: 'Calls', operation: 'Download All Media', match: /^Download All Media/,
    cls: 'read', idSource: 'callId + timeZoneName', reason: 'pointed probe', source: 'calls-api.spec.ts' },
  { id: 'calls/get-call-pci-data', group: 'Calls', operation: 'Get Call PCI Data', match: /^Preview Call PCI Data/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-get-call-pci-data-500): always 500 for a valid own-site call — isolation cannot be assessed', source: 'evidence P1-GET-CALL-PCI-DATA' },
  { id: 'calls/email-call', group: 'Calls', operation: 'Email Call', match: /^Email Call/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-email-call-500): always 500 with a schema-correct body', source: 'evidence P1-EMAIL-CALL' },
  { id: 'calls/batch-expire-calls', group: 'Calls', operation: 'Batch Expire Calls', match: /^Batch Expire Calls/,
    cls: 'destructive', reason: 'permanently deletes real recordings; no API to create a disposable call', source: 'coverage doc; calls-api.spec.ts (skipped)' },
  { id: 'calls/reassign-calls', group: 'Calls', operation: 'Reassign Calls', match: /^Reassign Calls/,
    cls: 'destructive', reason: 'reassigns every call for an extension + time range in one shot; not scopable to a throwaway', source: 'coverage doc; calls-api.spec.ts (skipped)' },

  // ── Chats (10) — whole group blocked by List Chats 500 ──────────────────
  { id: 'chats/list-chats', group: 'Chats', operation: 'List Chats', match: /^List Chats/,
    cls: 'blocked', reason: 'KNOWN BUG (BLOCKER-list-chats-500): backend injects a SiteId filter its own validator rejects → 500 on every body variant. Only source of a chatId, in the API and the app.', source: 'evidence P0-LIST-CHATS' },
  ...(['Add Chat Note', 'Get Chat Notes', 'Update Chat Note', 'Delete Chat Note', 'Download Chat',
      'Get Chat Details', 'Get Chat Message Notes', 'Get Chat Messages', 'Send Chat Email'] as const).map<CatalogEntry>(op => ({
    id: `chats/${op.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`,
    group: 'Chats', operation: op, match: new RegExp(`^${op.replace(/[()]/g, '\\$&')}`),
    cls: 'blocked', reason: 'no chatId obtainable — List Chats 500s (see chats/list-chats)', source: 'coverage doc; chats-api.spec.ts (skipped)',
  })),

  // ── Extension Management (6) ────────────────────────────────────────────
  { id: 'ext-mgmt/list-extensions', group: 'Extension Management', operation: 'List Extensions', match: /^List Extensions/,
    cls: 'read', reason: 'confirmed site-scoped — evidence saw 1→13 rows on a switch', source: 'extension-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'ext-mgmt/get-extension', group: 'Extension Management', operation: 'Get Extension', match: /^Preview Extension/,
    cls: 'read', idSource: 'extensionId from List Extensions', reason: 'pointed by-id probe', source: 'ADO 37417; extension-management-api.spec.ts' },
  { id: 'ext-mgmt/create-extension', group: 'Extension Management', operation: 'Create Extension', match: /^Create Extension/,
    cls: 'write', idSource: 'cross-site create for site A\'s siteId from site B → expect 400', cleanup: 'Delete Extension from site A if it leaked',
    reason: 'cross-site rejection already CONFIRMED (CHECK-create-extension-own-site); own-site 500 is a separate watch item', source: 'extension-management-api.spec.ts; evidence P1-CREATE-EXTENSION-OWN-SITE' },
  { id: 'ext-mgmt/update-extension', group: 'Extension Management', operation: 'Update Extension', match: /^Update Extension/,
    cls: 'write', idSource: 'existing extension on site A (List Extensions)', cleanup: 'none (no-op payload)',
    reason: 'already covered by tenant-isolation-negative-writes-staging — folded in here', source: 'ADO 37438; tenant-isolation-negative-writes-staging.spec.ts' },
  { id: 'ext-mgmt/delete-extension', group: 'Extension Management', operation: 'Delete Extension', match: /^Delete Extension/,
    cls: 'write', idSource: 'disposable extension created under site A', cleanup: 'Delete Extension from site A if the cross-site attempt was rejected', reason: 'destructive-if-leaked', source: 'extension-management-api.spec.ts' },
  { id: 'ext-mgmt/reassign-extension', group: 'Extension Management', operation: 'Reassign Extension', match: /^Reassign Extension/,
    cls: 'write', idSource: '2 disposable extensions under site A', cleanup: 'Delete both from site A', source: 'extension-management-api.spec.ts' },

  // ── General Settings (5) — all customer-level ───────────────────────────
  { id: 'general/get-company-info', group: 'General Settings', operation: 'Get Company Info', match: /^Preview Company Info/,
    cls: 'read', reason: 'customer-level — confirmed unchanged across a site switch (2026-08-28)', source: 'general-settings-api.spec.ts; tenant-isolation-staging NOT_SITE_SCOPED' },
  { id: 'general/get-sso-configuration', group: 'General Settings', operation: 'Get SSO Configuration', match: /^Preview SSO Configuration/,
    cls: 'read', reason: 'customer-level — confirmed unchanged', source: 'general-settings-api.spec.ts; tenant-isolation-staging' },
  { id: 'general/get-storage-locations', group: 'General Settings', operation: 'Get Storage Locations', match: /^List Storage Locations/,
    cls: 'read', reason: 'customer-level — confirmed unchanged', source: 'general-settings-api.spec.ts; tenant-isolation-staging' },
  { id: 'general/update-company-settings', group: 'General Settings', operation: 'Update Company Settings', match: /^Update Company Settings/,
    cls: 'n/a', reason: 'customer-level object — no per-site "site A vs site B" version to attack', source: 'general-settings-api.spec.ts' },
  { id: 'general/update-sso-settings', group: 'General Settings', operation: 'Update SSO Settings', match: /^Update SSO Settings/,
    cls: 'n/a', reason: 'customer-level object — no per-site dimension', source: 'general-settings-api.spec.ts' },

  // ── Group Management (5) ────────────────────────────────────────────────
  { id: 'group-mgmt/list-agent-groups', group: 'Group Management', operation: 'List Agent Groups', match: /^List Agent Groups/,
    cls: 'read', reason: 'confirmed site-scoped — evidence saw []→1 rows on a switch', source: 'group-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'group-mgmt/get-agent-group', group: 'Group Management', operation: 'Get Agent Group', match: /^Preview Agent Group \(/,
    cls: 'read', idSource: 'groupId from List Agent Groups', reason: 'pointed probe — manual §4.5 saw cross-site 204', source: 'ADO 37480; group-management-api.spec.ts' },
  { id: 'group-mgmt/create-agent-group', group: 'Group Management', operation: 'Create Agent Group', match: /^Create Agent Group/,
    cls: 'write', idSource: 'disposable group created under site A (seeded with a real site-A agent)', cleanup: 'Delete Agent Group from site A',
    reason: 'cross-site create for site A from site B → expect reject. NB Create returns id:0 (KNOWN BUG) — read real id back from List.', source: 'ADO 37478; group-management-api.spec.ts; evidence P1-CREATE-AGENT-GROUP-ID-ZERO' },
  { id: 'group-mgmt/update-agent-group', group: 'Group Management', operation: 'Update Agent Group', match: /^Update Agent Group/,
    cls: 'write', idSource: 'disposable group under site A', cleanup: 'Delete Agent Group from site A',
    reason: 'no-op payload (send isActive:true — omitting it is a full-replace deactivate, historical bug). Manual §4.5 saw cross-site 400.', source: 'group-management-api.spec.ts; CONTRACT-update-agent-group-full-replace' },
  { id: 'group-mgmt/delete-agent-group', group: 'Group Management', operation: 'Delete Agent Group', match: /^Delete Agent Group/,
    cls: 'write', idSource: 'disposable group under site A', cleanup: 'delete from site A if the cross-site attempt was rejected', reason: 'destructive-if-leaked; manual §4.5 saw cross-site 400', source: 'ADO 37479; group-management-api.spec.ts' },

  // ── Heartbeats (4) ─────────────────────────────────────────────────────
  { id: 'heartbeats/list-server-heartbeats', group: 'Heartbeats', operation: 'List Server Heartbeats', match: /^List Server Heartbeats/,
    cls: 'read', reason: 'DOCUMENTED GAP — customer-scoped, NOT site-scoped (pre-existing). Byte-identical across a switch is expected here; flag if that changes.', source: 'heartbeats-api.spec.ts; tenant-isolation-staging NOT_SITE_SCOPED' },
  { id: 'heartbeats/list-client-heartbeats', group: 'Heartbeats', operation: 'List Client Heartbeats', match: /^List Client Heartbeats/,
    cls: 'blocked', reason: 'KNOWN BUG (tenant-scoping-bugs Bug 5): broken default body, several 500 causes — cannot get a clean read to diff', source: 'tenant-scoping-bugs.spec.ts' },
  { id: 'heartbeats/delete-client-heartbeat', group: 'Heartbeats', operation: 'Delete Client Heartbeat', match: /^Delete Client Heartbeat/,
    cls: 'destructive', reason: 'operates on real monitoring records; no disposable fixture', source: 'heartbeats-api.spec.ts (skipped)' },
  { id: 'heartbeats/delete-server-heartbeat', group: 'Heartbeats', operation: 'Delete Server Heartbeat', match: /^Delete Server Heartbeat/,
    cls: 'destructive', reason: 'operates on real monitoring records; no disposable fixture', source: 'heartbeats-api.spec.ts (skipped)' },

  // ── IP Whitelist (3) — customer-level ──────────────────────────────────
  { id: 'ip-whitelist/list', group: 'IP Whitelist', operation: 'List IP Whitelist', match: /^List IP Whitelist/,
    cls: 'read', reason: 'customer-level — confirmed unchanged across a switch', source: 'ip-whitelist-api.spec.ts; tenant-isolation-staging' },
  { id: 'ip-whitelist/add', group: 'IP Whitelist', operation: 'Add IP Whitelist', match: /^Add IP Whitelist/,
    cls: 'n/a', reason: 'customer-level entry — no per-site dimension (also: 500-not-400 on missing field, BUG-negative-missing-field-500)', source: 'ip-whitelist-api.spec.ts' },
  { id: 'ip-whitelist/delete', group: 'IP Whitelist', operation: 'Delete IP Whitelist', match: /^Delete IP Whitelist/,
    cls: 'n/a', reason: 'customer-level entry — no per-site dimension', source: 'ip-whitelist-api.spec.ts' },

  // ── Logs (1) ──────────────────────────────────────────────────────────
  { id: 'logs/list-logs', group: 'Logs', operation: 'List Logs', match: /^List Logs/,
    cls: 'read', reason: 'customer-level audit log — confirmed unchanged across a switch', source: 'logs-api.spec.ts; tenant-isolation-staging' },

  // ── Manual Redaction (2) ──────────────────────────────────────────────
  { id: 'manual-redaction/list-call-redaction-requests', group: 'Manual Redaction', operation: 'List Call Redaction Requests', match: /^List Call Redaction Requests/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed probe — manual §5 confirmed a clean cross-site pair, never automated', source: 'manual-redaction-api.spec.ts' },
  { id: 'manual-redaction/submit-call-redaction-request', group: 'Manual Redaction', operation: 'Submit Call Redaction Request', match: /^Submit Call Redaction Request/,
    cls: 'blocked', reason: 'standing "do not fire Manual Redaction requests" hold + endpoint currently hangs with no response (MASTER §12) — the matrix never fires it (named skip)', source: 'evidence P1-MANUAL-REDACTION-HANG' },

  // ── Notifications (16) ────────────────────────────────────────────────
  { id: 'notifications/list-alert-types', group: 'Notifications', operation: 'List Alert Types', match: /^List Alert Types/,
    cls: 'read', reason: 'global reference list — same for every customer/site', source: 'notifications-api.spec.ts; tenant-isolation-staging' },
  { id: 'notifications/list-notification-rules', group: 'Notifications', operation: 'List Notification Rules', match: /^List Notification Rules/,
    cls: 'read', reason: 'SUSPECTED SCOPING GAP — unchanged across 3 switches, but Add Notification Rule has a siteIds field so it plausibly SHOULD be site-filtered. Triage.', source: 'SCOPING-suspected-gaps.md' },
  { id: 'notifications/list-notifications-action-types', group: 'Notifications', operation: 'List Notifications Action Types', match: /^List Notifications Action Types/,
    cls: 'read', reason: 'global reference list', source: 'notifications-api.spec.ts' },
  { id: 'notifications/list-notifications-participant-types', group: 'Notifications', operation: 'List Notifications Participant Types', match: /^List Notifications Participant Types/,
    cls: 'read', reason: 'global reference list', source: 'notifications-api.spec.ts' },
  { id: 'notifications/list-notifications-trigger-types', group: 'Notifications', operation: 'List Notifications Trigger Types', match: /^List Notifications Trigger Types/,
    cls: 'read', reason: 'global reference list', source: 'notifications-api.spec.ts' },
  { id: 'notifications/get-alert-trigger-topics', group: 'Notifications', operation: 'Get Alert Trigger Topics', match: /^List Alert Trigger Topics/,
    cls: 'read', reason: 'global reference list', source: 'notifications-api.spec.ts' },
  { id: 'notifications/list-alert-events', group: 'Notifications', operation: 'List Alert Events', match: /^List Alert Events/,
    cls: 'read', reason: 'SUSPECTED SCOPING GAP — unchanged across switches; intent unclear. Triage.', source: 'SCOPING-suspected-gaps.md' },
  { id: 'notifications/upsert-alert-configuration', group: 'Notifications', operation: 'Upsert Alert Configuration', match: /^Upsert Alert Configuration/,
    cls: 'write', idSource: 'disposable alert config created under site A', cleanup: 'Delete Alert Configuration from site A',
    reason: 'alert-config site-scoping UNCONFIRMED — if the cross-site upsert succeeds, log as triage rather than LEAK', source: 'notifications-api.spec.ts' },
  { id: 'notifications/get-alert-configuration', group: 'Notifications', operation: 'Get Alert Configuration', match: /^Preview Alert Configuration/,
    cls: 'read', idSource: 'alertId from a disposable created under site A', reason: 'pointed probe; site-scoping unconfirmed → triage', source: 'notifications-api.spec.ts' },
  { id: 'notifications/delete-alert-configuration', group: 'Notifications', operation: 'Delete Alert Configuration', match: /^Delete Alert Configuration/,
    cls: 'write', idSource: 'disposable alert config under site A', cleanup: 'delete from site A if the cross-site attempt was rejected', reason: 'destructive-if-leaked; scoping unconfirmed', source: 'notifications-api.spec.ts' },
  { id: 'notifications/add-notification-rule', group: 'Notifications', operation: 'Create Notification Rule', match: /^Create Notification Rule/,
    cls: 'write', idSource: 'rule body carries siteIds:[siteA] — cross-site create for site A from site B', cleanup: 'Delete Notification Rule from site A',
    reason: 'the rule DTO has an explicit siteIds field, so this is the clearest write-isolation case in the group', source: 'notifications-api.spec.ts' },
  { id: 'notifications/update-notification-rule', group: 'Notifications', operation: 'Update Notification Rule', match: /^Update Notification Rule/,
    cls: 'write', idSource: 'disposable rule under site A', cleanup: 'Delete Notification Rule from site A', reason: 'no-op payload', source: 'notifications-api.spec.ts' },
  { id: 'notifications/delete-notification-rule', group: 'Notifications', operation: 'Delete Notification Rule', match: /^Delete Notification Rule/,
    cls: 'write', idSource: 'disposable rule under site A', cleanup: 'delete from site A if the cross-site attempt was rejected', reason: 'destructive-if-leaked', source: 'notifications-api.spec.ts' },
  { id: 'notifications/get-alert-trigger-operators', group: 'Notifications', operation: 'Get Alert Trigger Operators', match: /^List Alert Trigger Operators/,
    cls: 'blocked', reason: 'CONSOLE BUG (CONSOLE-GET-ALERT-TRIGGER-OPERATORS): the console bakes the literal ?id={id} and every send 400s — cannot drive it', source: 'evidence CONSOLE-GET-ALERT-TRIGGER-OPERATORS' },
  { id: 'notifications/preview-alert-log', group: 'Notifications', operation: 'Preview Alert Log', match: /^Preview Alert Log/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-preview-alert-log-500): always 500', source: 'evidence P1-PREVIEW-ALERT-LOG' },
  { id: 'notifications/get-alert-notification-old', group: 'Notifications', operation: 'Get Alert Notification (old)', match: /^Preview\s+Alert Notification/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-get-alert-notification-old-500): always 500 (NRE) even for a real id', source: 'evidence P1-GET-ALERT-NOTIFICATION-OLD' },

  // ── QA (10) ──────────────────────────────────────────────────────────
  { id: 'qa/get-available-qas', group: 'QA', operation: 'Get Available QAs', match: /^List Available QAs/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed probe — forms available for a site-A call, requested from site B', source: 'qa-api.spec.ts' },
  { id: 'qa/get-qa', group: 'QA', operation: 'Get QA', match: /^Preview QA/,
    cls: 'read', idSource: 'formId from Get Available QAs', reason: 'pointed probe', source: 'qa-api.spec.ts' },
  { id: 'qa/get-all-qas', group: 'QA', operation: 'Get All QAs', match: /^List All QAs/,
    cls: 'read', reason: 'confirmed site-scoped — evidence saw it re-scope on a switch', source: 'qa-api.spec.ts; tenant-isolation-staging' },
  { id: 'qa/list-completed-qas', group: 'QA', operation: 'List Completed Qas', match: /^List Completed Qas/,
    cls: 'read', idSource: 'callId from List Calls', reason: 'pointed probe', source: 'qa-api.spec.ts' },
  { id: 'qa/get-aqa-phrases', group: 'QA', operation: 'Get AQA Phrases', match: /^Preview AQA Phrases/,
    cls: 'read', idSource: 'callId + formId', reason: 'pointed probe', source: 'qa-api.spec.ts' },
  { id: 'qa/save-completed-qas', group: 'QA', operation: 'Save completed QAs', match: /^Save completed QAs/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-save-completed-qas-not-persisted): 201 but never persists — cannot verify a cross-site write took / did not take', source: 'evidence P0-SAVE-COMPLETED-QAS' },
  { id: 'qa/email-qa', group: 'QA', operation: 'Email QA', match: /^Email QA/,
    cls: 'blocked', reason: 'KNOWN BUG: 400 "Configured site does not contain selected call" for the key\'s OWN in-site call — cross-site 400 is indistinguishable', source: 'qa-api.spec.ts' },
  { id: 'qa/suppress-qa', group: 'QA', operation: 'Suppress QA', match: /^Suppress QA/,
    cls: 'blocked', reason: 'no real completed-QA id obtainable (Save completed QAs never persists one)', source: 'qa-api.spec.ts (skipped)' },
  { id: 'qa/generate-qa-pdf', group: 'QA', operation: 'Export QA PDF', match: /^Export QA PDF/,
    cls: 'blocked', reason: 'multipart/form-data body — the Try-it console only offers Raw/Binary', source: 'qa-api.spec.ts (skipped)' },
  { id: 'qa/generate-qa-excel', group: 'QA', operation: 'Export QA Excel', match: /^Export QA Excel/,
    cls: 'blocked', reason: 'same multipart-only body as Generate QA PDF', source: 'qa-api.spec.ts (skipped)' },

  // ── Reports (10) ────────────────────────────────────────────────────
  { id: 'reports/list-report-templates', group: 'Reports', operation: 'List Report Templates', match: /^List Report Templates/,
    cls: 'read', reason: 'SUSPECTED SCOPING GAP — unchanged across switches; intent unclear. Triage.', source: 'SCOPING-suspected-gaps.md' },
  { id: 'reports/get-call-volume-statistics', group: 'Reports', operation: 'Get Call Volume Statistics', match: /^Preview Call Volume Statistics/,
    cls: 'read', reason: 'confirmed site-scoped', source: 'reports-api.spec.ts; tenant-isolation-staging' },
  { id: 'reports/get-calls-counter', group: 'Reports', operation: 'Get Calls Counter', match: /^Preview Calls Counter/,
    cls: 'read', reason: 'confirmed site-scoped', source: 'reports-api.spec.ts; tenant-isolation-staging' },
  { id: 'reports/get-site-usage-statistics', group: 'Reports', operation: 'Get Site Usage Statistics', match: /^Preview Site Usage Statistics/,
    cls: 'read', idSource: 'siteId query param = site A\'s id, sent from site B', reason: 'pointed cross-site read — a per-site key pulling another site\'s usage figures', source: 'reports-api.spec.ts' },
  { id: 'reports/get-sites-storage-usage', group: 'Reports', operation: 'Get Sites Storage Usage', match: /^List Sites Storage Usage/,
    cls: 'read', reason: 'confirmed site-scoped — this IS the live site probe (`currentKeySite`); returns exactly the calling key\'s site', source: 'reports-api.spec.ts; _helpers.currentKeySite' },
  { id: 'reports/get-six-month-call-volume', group: 'Reports', operation: 'Get Six Month Call Volume', match: /^Preview Six Month Call Volume/,
    cls: 'read', reason: 'confirmed site-scoped', source: 'reports-api.spec.ts; tenant-isolation-staging' },
  { id: 'reports/get-storage-usage', group: 'Reports', operation: 'Get Storage Usage', match: /^Preview Storage Usage/,
    cls: 'read', idSource: 'siteId query param = site A\'s id, sent from site B', reason: 'pointed cross-site read (like Get Site Usage Statistics)', source: 'reports-api.spec.ts' },
  { id: 'reports/get-user-activity-summary', group: 'Reports', operation: 'Get User Activity Summary', match: /^Preview User Activity Summary/,
    cls: 'read', idSource: 'period enum (0/1/2) required', reason: 'users are customer-level — site-scoping unconfirmed. Triage.', source: 'reports-api.spec.ts' },
  { id: 'reports/delete-report-template', group: 'Reports', operation: 'Delete Report Template', match: /^Delete Report Template/,
    cls: 'n/a', reason: 'report templates are customer-level (no siteId in the DTO); no create counterpart to make a disposable. Read-side scoping is covered by reports/list-report-templates (triage).', source: 'reports-api.spec.ts' },
  { id: 'reports/get-report-by-template', group: 'Reports', operation: 'Get Report By Template', match: /^Preview Report By Template/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-get-report-by-template-500): always 500 (NRE) with a schema-correct body', source: 'evidence P1-GET-REPORT-BY-TEMPLATE' },

  // ── Restricted User Management (3) — security-relevant ──────────────
  { id: 'restricted-user/list-restricted-accesses', group: 'Restricted User Management', operation: 'List Restricted Accesses', match: /^List Restricted Accesses/,
    cls: 'read', reason: 'DOCUMENTED: currently NOT site-scoped at all (BUG-restricted-user-no-site-scoping, 2026-08-27 controlled run). A byte-identical result across the switch IS the known bug — the check documents it until fixed. Expectation: hypothesis.', source: 'evidence P0-RESTRICTED-USER-SCOPING' },
  { id: 'restricted-user/get-restricted-user', group: 'Restricted User Management', operation: 'Get Restricted User', match: /^Preview Restricted User/,
    cls: 'read', idSource: 'userId from List Restricted Accesses; bound to site A first via Update Restricted User Access', reason: 'pointed probe — 2026-08-27 saw the full record returned cross-site. Expectation: hypothesis.', source: 'evidence P0-RESTRICTED-USER-SCOPING' },
  { id: 'restricted-user/update-restricted-user-access', group: 'Restricted User Management', operation: 'Update Restricted User Access', match: /^Update Restricted User Access/,
    cls: 'write', idSource: 'a restricted user bound to site A by the test', cleanup: 'restore the user\'s original siteIds from site A',
    reason: 'cross-site Update has NEVER been executed — the "expect 400" is a pure hypothesis. Record the observed status; soft-assert only.', source: 'evidence P0-RESTRICTED-USER-SCOPING; ADO 37600' },

  // ── Retention Management (2) ──────────────────────────────────────
  { id: 'retention/list-retention-policies', group: 'Retention Management', operation: 'List Retention Policies', match: /^List Retention Policies/,
    cls: 'read', reason: 'confirmed site-scoped — always exactly one row, for the calling key\'s site. NB the SiteID filter is a separate 500 (BUG-list-retention-siteid-filter-500) — not used here.', source: 'retention-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'retention/update-retention-policy', group: 'Retention Management', operation: 'Update Retention Policy', match: /^Update Retention Policy/,
    cls: 'write', idSource: 'siteId query param = site A\'s id, sent from site B', cleanup: 'none (Update is idempotent; restore expirationDays from site A if it leaked)',
    reason: 'cross-site rejection already CONFIRMED (tenant-isolation-negative-writes-staging → not 200) — folded in here', source: 'tenant-isolation-negative-writes-staging.spec.ts' },

  // ── Role Management (6) ──────────────────────────────────────────
  { id: 'role-mgmt/list-custom-roles', group: 'Role Management', operation: 'List Custom Roles', match: /^List Custom Roles/,
    cls: 'read', reason: 'coverage doc lists this as correctly site-scoped (re-scopes on a switch)', source: 'role-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'role-mgmt/list-custom-role-restrictions', group: 'Role Management', operation: 'List Custom Role Restrictions', match: /^List Custom Role Restrictions/,
    cls: 'read', reason: 'no params; site-scoping unconfirmed. Triage.', source: 'ADO 37612; role-management-api.spec.ts' },
  { id: 'role-mgmt/create-custom-role', group: 'Role Management', operation: 'Create Custom Role', match: /^Create Custom Role/,
    cls: 'write', idSource: 'disposable role created under site A', cleanup: 'no Delete Custom Role available (console stuck) — role is left, uniquely named. Track leftover roles.',
    reason: 'role site-scoping is ambiguous (Create returns customerId 00000000). If cross-site create succeeds, log as triage. NB no cleanup path (see role-mgmt/delete-custom-role).', source: 'role-management-api.spec.ts; BUG-negative-missing-field-500' },
  { id: 'role-mgmt/update-custom-role', group: 'Role Management', operation: 'Update Custom Role', match: /^Update Custom Role/,
    cls: 'write', idSource: 'disposable role under site A; settings/custom-roles/permissions, access:"[]" JSON string', cleanup: 'no Delete available — leftover role, uniquely named',
    reason: 'no-op permissions payload', source: 'ADO 37614; role-management-api.spec.ts' },
  { id: 'role-mgmt/delete-custom-role', group: 'Role Management', operation: 'Delete Custom Role', match: /^Delete Custom Role/,
    cls: 'blocked', reason: 'CONSOLE BUG (CONSOLE-DELETE-CUSTOM-ROLE): the Try-it console never renders a Send button (7/7 attempts) — cannot drive it', source: 'evidence CONSOLE-DELETE-CUSTOM-ROLE' },
  { id: 'role-mgmt/get-custom-role', group: 'Role Management', operation: 'Get Custom Role', match: /^Preview Custom Role \(/,
    cls: 'blocked', reason: 'KNOWN BUG (BUG-get-custom-role-ignores-roleid): returns a locked system role for ANY id, real or bogus — a pointed by-id probe is meaningless until fixed', source: 'evidence P0-GET-CUSTOM-ROLE' },

  // ── Site Management (4) ────────────────────────────────────────
  { id: 'site-mgmt/list-sites', group: 'Site Management', operation: 'List Sites', match: /^List Sites/,
    cls: 'read', reason: 'INTENTIONALLY account-wide (an admin manages every site) — byte-identical across a switch is correct, not a gap', source: 'site-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'site-mgmt/add-site', group: 'Site Management', operation: 'Create Site', match: /^Create Site/,
    cls: 'n/a', reason: 'creating a site is an account-level operation — not "site A vs site B" scoped', source: 'site-management-api.spec.ts' },
  { id: 'site-mgmt/update-site', group: 'Site Management', operation: 'Update Site', match: /^Update Site/,
    cls: 'write', idSource: 'site A itself (siteId), updated from a key scoped to site B', cleanup: 'none (no-op payload — write the site\'s own current values back)',
    reason: 'the site IS the scoping dimension — a key on B changing site A\'s config should be rejected', source: 'site-management-api.spec.ts' },
  { id: 'site-mgmt/delete-site', group: 'Site Management', operation: 'Delete Site', match: /^Delete Site/,
    cls: 'destructive', reason: 'deleting a site may cascade (recordings, extensions, retention); blast radius not worth a cross-site probe even though a disposable-site lifecycle exists in site-management-api', source: 'site-management-api.spec.ts' },

  // ── Tag Management (4) — customer-level ────────────────────────
  { id: 'tag-mgmt/list-tags', group: 'Tag Management', operation: 'List Tags', match: /^List Tags/,
    cls: 'read', reason: 'customer-level — confirmed unchanged across a switch', source: 'tag-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'tag-mgmt/add-tag', group: 'Tag Management', operation: 'Create Tag', match: /^Create Tag/,
    cls: 'n/a', reason: 'tags are customer-level — no per-site dimension (also: alphanumeric-only name validation, CONTRACT-update-tag-name-validation)', source: 'tag-management-api.spec.ts' },
  { id: 'tag-mgmt/update-tag', group: 'Tag Management', operation: 'Update Tag', match: /^Update Tag/,
    cls: 'n/a', reason: 'tags are customer-level', source: 'tag-management-api.spec.ts' },
  { id: 'tag-mgmt/delete-tag', group: 'Tag Management', operation: 'Delete Tag', match: /^Delete Tag/,
    cls: 'n/a', reason: 'tags are customer-level', source: 'tag-management-api.spec.ts' },

  // ── User Management (5) — customer-level ──────────────────────
  { id: 'user-mgmt/list-users', group: 'User Management', operation: 'List Users', match: /^List Users/,
    cls: 'read', reason: 'customer-level — confirmed unchanged across a switch', source: 'user-management-api.spec.ts; tenant-isolation-staging' },
  { id: 'user-mgmt/get-user', group: 'User Management', operation: 'Get User', match: /^Preview User/,
    cls: 'read', idSource: 'userId from List Users', reason: 'pointed probe — users are customer-level, so cross-site visibility is expected (known-global)', source: 'user-management-api.spec.ts' },
  { id: 'user-mgmt/add-user', group: 'User Management', operation: 'Create User', match: /^Create User/,
    cls: 'n/a', reason: 'users are customer-level — no per-site dimension', source: 'user-management-api.spec.ts' },
  { id: 'user-mgmt/update-user', group: 'User Management', operation: 'Update User', match: /^Update User/,
    cls: 'n/a', reason: 'users are customer-level', source: 'user-management-api.spec.ts' },
  { id: 'user-mgmt/delete-user', group: 'User Management', operation: 'Delete User', match: /^Delete User/,
    cls: 'blocked', reason: 'CONSOLE BUG (BUG-delete-user-send-inert): the Send button fires no network request at all — cannot drive it', source: 'evidence P1-DELETE-USER-SEND' },
];

// ── integrity checks (throw at import time if the catalogue drifts) ─────────

/** Per-class + per-group counts, for the matrix report header and a sanity gate. */
export function catalogStats() {
  const byClass: Record<string, number> = {};
  const byGroup: Record<string, number> = {};
  for (const e of CATALOG) {
    byClass[e.cls] = (byClass[e.cls] ?? 0) + 1;
    byGroup[e.group] = (byGroup[e.group] ?? 0) + 1;
  }
  return { total: CATALOG.length, byClass, byGroup, groups: Object.keys(byGroup).length };
}

const _ids = new Set(CATALOG.map(e => e.id));
if (_ids.size !== CATALOG.length) {
  throw new Error('cross-tenant-catalog: duplicate entry id');
}
if (CATALOG.length !== 127) {
  throw new Error(`cross-tenant-catalog: expected 127 operations, have ${CATALOG.length}`);
}
