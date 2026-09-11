import type { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import { CATALOG } from './cross-tenant-catalog';
import type { CatalogEntry, ReadPlan, WritePlan } from './_cross-tenant';
import {
  KNOWN, LIST_BODY, LIST_BODY_100, fireConsole,
  firstOwnSiteCall, currentSiteId, assignedTagId, agentDto, ruleDto, alertDto,
} from './_helpers';

/**
 * Executable READ / WRITE plans for the cross-tenant matrix, keyed by
 * `CatalogEntry.id`. Kept separate from `cross-tenant-catalog.ts` (which is
 * the classification source of truth) so the catalogue stays readable.
 *
 * Payloads/params/steps are lifted from the confirmed sources — never
 * invented:
 *  - the consolidated `tests/dev-portal/*-api.spec.ts` (live-verified 2026-08-29);
 *  - ADO suite 37288 test cases;
 *  - `artifacts/dev-portal-evidence-2026-08-29/` raw captures.
 *
 * `mergedCatalog()` attaches these to the catalogue and is what
 * `cross-tenant-matrix.spec.ts` consumes.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

// ── shared resolvers (run UNDER SITE A in Phase A) ─────────────────────────

/** List an operation and return the first row's id under a set of candidate keys. */
async function listFirstId(
  portal: DeveloperPortalPage, group: string, match: RegExp,
  { body, keys = ['id', 'Id', 'ID'] }: { body?: unknown; keys?: string[] } = {},
): Promise<string | null> {
  const res = await fireConsole(portal, group, match, { body });
  if (res.status !== 200) return null;
  const rows = Array.isArray(res.body) ? res.body : ((res.body as { data?: unknown[] })?.data ?? []);
  const first = (rows as Array<Record<string, unknown>>)[0];
  if (!first) return null;
  for (const k of keys) if (first[k] != null) return String(first[k]);
  return null;
}

/** `resolve` that stashes a real own-site callId under `{ callId }`. */
const resolveCallId = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const { id } = await firstOwnSiteCall(portal);
  return { callId: id };
};

/** `resolve` for a real own-site agentId (+ siteId) from List Agents. */
const resolveAgent = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const res = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
  const a = (res.body as Array<{ id?: string; siteId?: string }>)[0] ?? {};
  return { agentId: String(a.id ?? ''), siteId: String(a.siteId ?? '') };
};

/** `resolve` for the first extensionId from List Extensions. */
const resolveExtensionId = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const id = await listFirstId(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
  return { extensionId: id ?? '' };
};

/** `resolve` for the first groupId from List Agent Groups. */
const resolveGroupId = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const id = await listFirstId(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
  return { groupId: id ?? '' };
};

/** `resolve` for a callId + the first available (non-archived) QA form id for it. */
const resolveCallAndForm = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const { id: callId } = await firstOwnSiteCall(portal);
  const res = await fireConsole(portal, 'QA', /^Get Available QAs/, { params: [['callId', callId]] });
  const form = (res.body as Array<{ id: number; archived: boolean }>)?.find(f => !f.archived);
  return { callId, formId: form ? String(form.id) : '' };
};

/** `resolve` for the first userId from List Users. */
const resolveUserId = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const id = await listFirstId(portal, 'User Management', /^List Users/, { body: LIST_BODY, keys: ['id', 'userId', 'Id'] });
  return { userId: id ?? '' };
};

/** `resolve` for the first restricted-user id from List Restricted Accesses. */
const resolveRestrictedUserId = async (portal: DeveloperPortalPage): Promise<Record<string, string>> => {
  const id = await listFirstId(portal, 'Restricted User Management', /^List Restricted Accesses/, { body: LIST_BODY_100, keys: ['id', 'userId'] });
  return { userId: id ?? '' };
};

const pickFirstId = (body: unknown): string | null => {
  const rows = Array.isArray(body) ? body : ((body as { data?: unknown[] })?.data ?? []);
  const r = (rows as Array<Record<string, unknown>>)[0];
  if (!r) return null;
  return String(r.id ?? r.Id ?? r.userId ?? r.NoteID ?? '') || null;
};

// ── READ_PLANS ────────────────────────────────────────────────────────────

const listMustDiffer = (body?: unknown): ReadPlan => ({ body, expectation: 'must-differ' });
const listGlobal = (body?: unknown): ReadPlan => ({ body, expectation: 'known-global' });
const listTriage = (body?: unknown): ReadPlan => ({ body, expectation: 'triage' });

export const READ_PLANS: Record<string, ReadPlan> = {
  // Agent Management
  'agent-mgmt/list-agents': listMustDiffer(LIST_BODY_100),
  'agent-mgmt/get-agent': {
    resolve: resolveAgent,
    params: r => [['agentId', r.agentId]],
    expectation: 'must-differ',
    byId: { pick: b => String((b as { id?: string })?.id ?? '') || null, operation: /^Get Agent \(/, param: 'agentId' },
  },
  'agent-mgmt/get-supervisors': listTriage(),
  'agent-mgmt/get-agent-extensions': {
    resolve: resolveAgent,
    body: () => ({ pattern: '' }),
    params: r => [['agentId', r.agentId], ['siteId', r.siteId]],
    expectation: 'triage',
  },

  // Calls
  'calls/list-calls': listMustDiffer(LIST_BODY),
  'calls/get-call-info': {
    resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'must-differ',
    byId: { pick: b => String((b as { model?: { id?: string } })?.model?.id ?? '') || null, operation: /^Get Call Info/, param: 'callId' },
  },
  'calls/get-call-notes': { resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage' },
  'calls/get-linked-calls': { resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage' },
  'calls/get-call-transcription': { resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage' },
  'calls/download-single-audio-file': {
    resolve: resolveCallId, params: r => [['callId', r.callId], ['timeZoneName', 'UTC']], expectation: 'must-differ',
  },
  'calls/download-audio-chunk': {
    resolve: resolveCallId, params: r => [['callId', r.callId], ['timeZone', '0'], ['timeZoneName', 'UTC']], expectation: 'must-differ',
  },
  'calls/download-all-media': {
    resolve: resolveCallId, params: r => [['callId', r.callId], ['timeZoneName', 'UTC']], expectation: 'must-differ',
  },

  // Extension Management
  'ext-mgmt/list-extensions': listMustDiffer(LIST_BODY_100),
  'ext-mgmt/get-extension': {
    resolve: resolveExtensionId, params: r => [['extensionId', r.extensionId]], expectation: 'must-differ',
    byId: { pick: pickFirstId, operation: /^Get Extension/, param: 'extensionId' },
  },

  // General Settings — customer-level
  'general/get-company-info': listGlobal(),
  'general/get-sso-configuration': listGlobal(),
  'general/get-storage-locations': listGlobal(),

  // Group Management
  'group-mgmt/list-agent-groups': listMustDiffer(LIST_BODY_100),
  'group-mgmt/get-agent-group': {
    resolve: resolveGroupId, params: r => [['groupId', r.groupId]], expectation: 'must-differ',
    byId: { pick: pickFirstId, operation: /^Get Agent Group \(/, param: 'groupId' },
  },

  // Heartbeats
  'heartbeats/list-server-heartbeats': listTriage(LIST_BODY),

  // IP Whitelist / Logs — customer-level
  'ip-whitelist/list': listGlobal(LIST_BODY),
  'logs/list-logs': listGlobal(LIST_BODY),

  // Manual Redaction
  'manual-redaction/list-call-redaction-requests': {
    resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage',
  },

  // Notifications — reference lists + suspected gaps
  'notifications/list-alert-types': listGlobal(),
  'notifications/list-notifications-action-types': listGlobal(),
  'notifications/list-notifications-participant-types': listGlobal(),
  'notifications/list-notifications-trigger-types': listGlobal(),
  'notifications/get-alert-trigger-topics': listGlobal(),
  'notifications/list-notification-rules': listTriage(LIST_BODY),
  'notifications/list-alert-events': listTriage(LIST_BODY),
  'notifications/get-alert-configuration': {
    // best-effort: needs a real alertId; without one this leg records ERROR,
    // which is fine — the write-side (Upsert/Delete Alert Configuration) is
    // where the real signal is.
    resolve: async () => ({}),
    params: () => [['notificationId', '0']],
    expectation: 'triage',
  },

  // QA
  'qa/get-available-qas': { resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage' },
  'qa/get-qa': {
    resolve: resolveCallAndForm, params: r => [['id', r.formId]], expectation: 'triage',
  },
  'qa/get-all-qas': listMustDiffer(),
  'qa/list-completed-qas': { resolve: resolveCallId, params: r => [['callId', r.callId]], expectation: 'triage' },
  'qa/get-aqa-phrases': {
    resolve: resolveCallAndForm, params: r => [['callId', r.callId], ['formId', r.formId]], expectation: 'triage',
  },

  // Reports
  'reports/list-report-templates': listTriage(),
  'reports/get-call-volume-statistics': listMustDiffer(),
  'reports/get-calls-counter': listMustDiffer(),
  'reports/get-sites-storage-usage': listMustDiffer(),
  'reports/get-six-month-call-volume': listMustDiffer(),
  'reports/get-site-usage-statistics': {
    // pointed cross-site read: `resolve` runs under site A and captures its
    // siteId; Phase B replays the same resolved map, so the site-B leg asks
    // for site A's usage figures.
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    params: r => [['siteId', r.siteId]],
    expectation: 'must-differ',
  },
  'reports/get-storage-usage': {
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    params: r => [['siteId', r.siteId]],
    expectation: 'must-differ',
  },
  'reports/get-user-activity-summary': {
    resolve: async () => ({}), params: () => [['period', '0']], expectation: 'triage',
  },

  // Restricted User Management — DOCUMENTED unscoped (hypothesis)
  'restricted-user/list-restricted-accesses': { body: LIST_BODY_100, expectation: 'hypothesis' },
  'restricted-user/get-restricted-user': {
    resolve: resolveRestrictedUserId, params: r => [['userId', r.userId]], expectation: 'hypothesis',
    byId: { pick: b => String((b as { id?: string })?.id ?? '') || null, operation: /^Get Restricted User/, param: 'userId' },
  },

  // Retention Management
  'retention/list-retention-policies': listMustDiffer({}),

  // Role Management
  'role-mgmt/list-custom-roles': listMustDiffer(LIST_BODY),
  'role-mgmt/list-custom-role-restrictions': listTriage(),

  // Site / Tag / User — account-wide or customer-level
  'site-mgmt/list-sites': listGlobal(LIST_BODY),
  'tag-mgmt/list-tags': listGlobal(LIST_BODY),
  'user-mgmt/list-users': listGlobal(LIST_BODY),
  'user-mgmt/get-user': {
    resolve: resolveUserId, params: r => [['userId', r.userId]], expectation: 'known-global',
    byId: { pick: pickFirstId, operation: /^Get User/, param: 'userId' },
  },
};

// ── WRITE helpers ────────────────────────────────────────────────────────

function rowsOf(body: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(body) ? body : ((body as { data?: unknown[] })?.data ?? []);
  return rows as Array<Record<string, unknown>>;
}

// Create-op DTOs (`agentDto` / `ruleDto` / `alertDto`) are imported from
// `_helpers.ts` — one source of truth, shared with the negative-field matrix.

// ── WRITE_PLANS (31 write-class ops) ─────────────────────────────────────

export const WRITE_PLANS: Record<string, WritePlan> = {
  // ── Agent Management ──────────────────────────────────────────────────
  'agent-mgmt/create-agent': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => ({ siteAId, marker: `xt-create-${Date.now()}` }),
      remove: async (portal, f) => {
        const res = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const hit = rowsOf(res.body).find(r => String(r.lastName ?? '') === f.marker);
        if (hit) await fireConsole(portal, 'Agent Management', /^Delete Agent \(/, { params: [['agentId', String(hit.id)]] });
      },
    },
    attempt: { verb: 'add', operation: /^Create Agent \(/, body: f => agentDto('AQA', f.marker, f.siteAId) },
  },
  'agent-mgmt/delete-agent': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const res = await fireConsole(portal, 'Agent Management', /^Create Agent \(/, { body: agentDto('AQA', `xt-del-${Date.now()}`, siteAId) });
        return { agentId: String((res.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.agentId) await fireConsole(portal, 'Agent Management', /^Delete Agent \(/, { params: [['agentId', f.agentId]] }); },
    },
    attempt: { verb: 'delete', operation: /^Delete Agent \(/, params: f => [['agentId', f.agentId]] },
    verifyIntact: async (portal, f) => {
      const res = await fireConsole(portal, 'Agent Management', /^Get Agent \(/, { params: [['agentId', f.agentId]] });
      return { ok: res.status === 200, detail: `Get Agent → ${res.status}` };
    },
    destructiveIfLeaked: true,
  },
  'agent-mgmt/batch-delete-agents': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const ids: string[] = [];
        for (const s of ['a', 'b']) {
          const r = await fireConsole(portal, 'Agent Management', /^Create Agent \(/, { body: agentDto('AQA', `xt-batch-${Date.now()}-${s}`, siteAId) });
          ids.push(String((r.body as { id?: string })?.id ?? ''));
        }
        return { ids: ids.join(',') };
      },
      remove: async (portal, f) => { if (f.ids) await fireConsole(portal, 'Agent Management', /^Batch Delete Agents/, { body: f.ids.split(',') }); },
    },
    attempt: { verb: 'delete', operation: /^Batch Delete Agents/, body: f => f.ids.split(',') },
    verifyIntact: async (portal, f) => {
      const res = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
      const present = f.ids.split(',').filter(id => rowsOf(res.body).some(r => String(r.id) === id));
      return { ok: present.length === f.ids.split(',').length, detail: `${present.length}/${f.ids.split(',').length} still present` };
    },
    destructiveIfLeaked: true,
  },
  'agent-mgmt/create-agent-extension-mapping': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const freeAgent = rowsOf(agents.body).find(a => !a.assignedExtension);
        const exts = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
        const freeExt = rowsOf(exts.body).find(e => String(e.agentId) === '00000000-0000-0000-0000-000000000000');
        return { agentId: String(freeAgent?.id ?? ''), extensionId: String(freeExt?.id ?? ''), mappingId: '' };
      },
      remove: async () => { /* nothing created in Phase A — the cross-site attempt is the create */ },
    },
    attempt: { verb: 'add', operation: /^Create Agent Extension Mapping/, body: f => ({ agentId: f.agentId, extensionId: f.extensionId }) },
    // If it LEAKs, a mapping is created cross-site — flagged; manual cleanup via Delete Agent Extension.
    destructiveIfLeaked: true,
  },
  'agent-mgmt/update-agent-extension': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const freeAgent = rowsOf(agents.body).find(a => !a.assignedExtension);
        const exts = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
        const freeExt = rowsOf(exts.body).find(e => String(e.agentId) === '00000000-0000-0000-0000-000000000000');
        const created = await fireConsole(portal, 'Agent Management', /^Create Agent Extension Mapping/, { body: { agentId: String(freeAgent?.id), extensionId: String(freeExt?.id) } });
        return {
          mappingId: String((created.body as { id?: string })?.id ?? ''),
          agentId: String(freeAgent?.id ?? ''), extensionId: String(freeExt?.id ?? ''),
        };
      },
      remove: async (portal, f) => { if (f.mappingId) await fireConsole(portal, 'Agent Management', /^Delete Agent Extension/, { params: [['id', f.mappingId]] }); },
    },
    attempt: { verb: 'update', operation: /^Update Agent Extension/, body: f => ({ id: f.mappingId, agentId: f.agentId, extensionId: f.extensionId }) },
  },
  'agent-mgmt/delete-agent-extension': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const freeAgent = rowsOf(agents.body).find(a => !a.assignedExtension);
        const exts = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
        const freeExt = rowsOf(exts.body).find(e => String(e.agentId) === '00000000-0000-0000-0000-000000000000');
        const created = await fireConsole(portal, 'Agent Management', /^Create Agent Extension Mapping/, { body: { agentId: String(freeAgent?.id), extensionId: String(freeExt?.id) } });
        return { mappingId: String((created.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.mappingId) await fireConsole(portal, 'Agent Management', /^Delete Agent Extension/, { params: [['id', f.mappingId]] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Agent Extension/, params: f => [['id', f.mappingId]] },
    destructiveIfLeaked: true,
  },

  // ── Calls ────────────────────────────────────────────────────────────
  'calls/add-call-note': {
    fixture: {
      mode: 'create',
      run: async portal => ({ callId: (await firstOwnSiteCall(portal)).id, marker: `xt-add-${Date.now()}` }),
      remove: async (portal, f) => {
        const notes = await fireConsole(portal, 'Calls', /^Get Call Notes/, { params: [['callId', f.callId]] });
        const hit = rowsOf(notes.body).find(n => String(n.Note ?? n.note ?? '').includes(f.marker));
        if (hit) await fireConsole(portal, 'Calls', /^Delete Call Note/, { params: [['callId', f.callId], ['noteId', String(hit.NoteID ?? hit.id)]] });
      },
    },
    attempt: { verb: 'add', operation: /^Add Call Note/, body: f => ({ callId: f.callId, note: f.marker }), params: f => [['callId', f.callId]] },
  },
  'calls/update-call-note': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const callId = (await firstOwnSiteCall(portal)).id;
        const added = await fireConsole(portal, 'Calls', /^Add Call Note/, { body: { callId, note: `xt-upd-${Date.now()}` }, params: [['callId', callId]] });
        return { callId, noteId: String((added.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.noteId) await fireConsole(portal, 'Calls', /^Delete Call Note/, { params: [['callId', f.callId], ['noteId', f.noteId]] }); },
    },
    attempt: { verb: 'update', operation: /^Update Call Note/, body: f => ({ noteId: f.noteId, note: `xt-upd-${Date.now()} B` }), params: f => [['callId', f.callId], ['noteId', f.noteId]] },
  },
  'calls/delete-call-note': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const callId = (await firstOwnSiteCall(portal)).id;
        const added = await fireConsole(portal, 'Calls', /^Add Call Note/, { body: { callId, note: `xt-del-${Date.now()}` }, params: [['callId', callId]] });
        return { callId, noteId: String((added.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.noteId) await fireConsole(portal, 'Calls', /^Delete Call Note/, { params: [['callId', f.callId], ['noteId', f.noteId]] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Call Note/, params: f => [['callId', f.callId], ['noteId', f.noteId]] },
    verifyIntact: async (portal, f) => {
      const notes = await fireConsole(portal, 'Calls', /^Get Call Notes/, { params: [['callId', f.callId]] });
      return { ok: rowsOf(notes.body).some(n => String(n.NoteID ?? n.id) === f.noteId), detail: 'note present in Get Call Notes' };
    },
    destructiveIfLeaked: true,
  },
  'calls/edit-call-note-details': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const callId = (await firstOwnSiteCall(portal)).id;
        const added = await fireConsole(portal, 'Calls', /^Add Call Note/, { body: { callId, note: `xt-details-${Date.now()}` }, params: [['callId', callId]] });
        return { callId, noteId: String((added.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.noteId) await fireConsole(portal, 'Calls', /^Delete Call Note/, { params: [['callId', f.callId], ['noteId', f.noteId]] }); },
    },
    // bare JSON-string body, per calls-api.spec.ts
    attempt: { verb: 'update', operation: /^Edit Call Note Details/, body: () => `xt-details ${Date.now()} B`, params: f => [['callId', f.callId], ['noteId', f.noteId]] },
  },
  'calls/update-call-tags': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const call = await firstOwnSiteCall(portal, { withTags: true });
        const tagId = call.hasTags ? await assignedTagId(portal, call.id) : null;
        return { callId: call.id, tagId: tagId ?? '' };
      },
      remove: async () => { /* no-op re-apply of the call's own tag */ },
    },
    attempt: { verb: 'update', operation: /^Update Call Tags/, body: f => ({ callId: f.callId, tagsIds: f.tagId ? [f.tagId] : [] }), params: f => [['callId', f.callId]] },
  },
  'calls/update-multiple-call-tags': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const call = await firstOwnSiteCall(portal, { withTags: true });
        const tagId = call.hasTags ? await assignedTagId(portal, call.id) : null;
        return { callId: call.id, tagId: tagId ?? '' };
      },
      remove: async () => {},
    },
    attempt: { verb: 'update', operation: /^Update Multiple Call Tags/, body: f => ({ callIds: [f.callId], tagsIdsToAdd: f.tagId ? [f.tagId] : [], tagsIdsToRemove: [] }) },
  },
  'calls/update-legal-hold': {
    fixture: {
      mode: 'create',
      run: async portal => ({ callId: (await firstOwnSiteCall(portal)).id }),
      remove: async () => { /* verifyIntact restores if it leaked */ },
    },
    attempt: { verb: 'update', operation: /^Update Legal Hold/, params: f => [['callId', f.callId]] },
    verifyIntact: async (portal, f) => {
      // Update Legal Hold toggles + returns the new state. If the cross-site
      // call leaked it flipped once — call Get Call Info; if legalHold is now
      // true, toggle it back from site A.
      const info = await fireConsole(portal, 'Calls', /^Get Call Info/, { params: [['callId', f.callId]] });
      const held = Boolean((info.body as { model?: { legalHold?: boolean } })?.model?.legalHold);
      if (held) await fireConsole(portal, 'Calls', /^Update Legal Hold/, { params: [['callId', f.callId]] });
      return { ok: !held, detail: held ? 'legalHold was ON — toggled back from site A' : 'legalHold unchanged' };
    },
    destructiveIfLeaked: true,
  },
  'calls/batch-apply-legal-hold': {
    fixture: {
      mode: 'create',
      run: async portal => ({ callId: (await firstOwnSiteCall(portal)).id }),
      remove: async () => {},
    },
    // form-urlencoded comma-separated call ids — bare string body
    attempt: { verb: 'update', operation: /^Batch Apply Legal Hold/, body: f => f.callId },
    verifyIntact: async (portal, f) => {
      const info = await fireConsole(portal, 'Calls', /^Get Call Info/, { params: [['callId', f.callId]] });
      const held = Boolean((info.body as { model?: { legalHold?: boolean } })?.model?.legalHold);
      if (held) await fireConsole(portal, 'Calls', /^Update Legal Hold/, { params: [['callId', f.callId]] });
      return { ok: !held, detail: held ? 'legalHold was ON — toggled back from site A' : 'legalHold unchanged' };
    },
    destructiveIfLeaked: true,
  },

  // ── Extension Management ─────────────────────────────────────────────
  'ext-mgmt/create-extension': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => ({ siteAId, marker: `xt-ext-${Date.now()}` }),
      remove: async (portal, f) => {
        const res = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
        const hit = rowsOf(res.body).find(e => String(e.name ?? '') === f.marker);
        if (hit) await fireConsole(portal, 'Extension Management', /^Delete Extension/, { params: [['extensionId', String(hit.id)], ['isArchive', 'false']] });
      },
    },
    attempt: { verb: 'add', operation: /^Create Extension/, body: f => ({ name: f.marker, siteId: f.siteAId }) },
  },
  'ext-mgmt/update-extension': {
    fixture: {
      mode: 'discover',
      run: async portal => {
        const res = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
        const e = rowsOf(res.body)[0] ?? {};
        return { extensionId: String(e.id ?? ''), name: String(e.name ?? ''), siteId: String(e.siteId ?? e.SiteId ?? '') };
      },
    },
    // no-op PascalCase DTO — identical name/siteId to what it already has (per tenant-isolation-negative-writes)
    attempt: { verb: 'update', operation: /^Update Extension/, body: f => ({ id: f.extensionId, name: f.name, siteId: f.siteId }) },
  },
  'ext-mgmt/delete-extension': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const r = await fireConsole(portal, 'Extension Management', /^Create Extension/, { body: { name: `xt-extdel-${Date.now()}`, siteId: siteAId } });
        return { extensionId: String(typeof r.body === 'string' ? r.body : (r.body as { id?: string })?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.extensionId) await fireConsole(portal, 'Extension Management', /^Delete Extension/, { params: [['extensionId', f.extensionId], ['isArchive', 'false']] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Extension/, params: f => [['extensionId', f.extensionId], ['isArchive', 'false']] },
    verifyIntact: async (portal, f) => {
      const res = await fireConsole(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
      return { ok: rowsOf(res.body).some(e => String(e.id) === f.extensionId), detail: 'extension present in List Extensions' };
    },
    destructiveIfLeaked: true,
  },
  'ext-mgmt/reassign-extension': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const a = await fireConsole(portal, 'Extension Management', /^Create Extension/, { body: { name: `xt-ra-from-${Date.now()}`, siteId: siteAId } });
        const b = await fireConsole(portal, 'Extension Management', /^Create Extension/, { body: { name: `xt-ra-to-${Date.now()}`, siteId: siteAId } });
        const idOf = (r: { body: unknown }) => String(typeof r.body === 'string' ? r.body : (r.body as { id?: string })?.id ?? '');
        return { fromId: idOf(a), toId: idOf(b) };
      },
      remove: async (portal, f) => {
        for (const id of [f.fromId, f.toId]) if (id) await fireConsole(portal, 'Extension Management', /^Delete Extension/, { params: [['extensionId', id], ['isArchive', 'false']] }).catch(() => {});
      },
    },
    attempt: { verb: 'update', operation: /^Reassign Extension/, params: f => [['selectedId', f.fromId], ['newId', f.toId]] },
    destructiveIfLeaked: true,
  },

  // ── Group Management ────────────────────────────────────────────────
  'group-mgmt/create-agent-group': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        return { agentId: String(rowsOf(agents.body)[0]?.id ?? ''), marker: `xt-grp-${Date.now()}` };
      },
      remove: async (portal, f) => {
        const res = await fireConsole(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
        const hit = rowsOf(res.body).find(g => String(g.name ?? '') === f.marker);
        if (hit) await fireConsole(portal, 'Group Management', /^Delete Agent Group/, { params: [['agentGroupId', String(hit.id)]] });
      },
    },
    attempt: { verb: 'add', operation: /^Create Agent Group/, body: f => ({ customerId: KNOWN.customerId, name: f.marker, isActive: true, agentJson: JSON.stringify([f.agentId]) }) },
  },
  'group-mgmt/update-agent-group': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const name = `xt-grpupd-${Date.now()}`;
        await fireConsole(portal, 'Group Management', /^Create Agent Group/, { body: { customerId: KNOWN.customerId, name, isActive: true, agentJson: JSON.stringify([String(rowsOf(agents.body)[0]?.id ?? '')]) } });
        const list = await fireConsole(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
        const g = rowsOf(list.body).find(x => String(x.name) === name) ?? {};
        return { groupId: String(g.id ?? ''), name, customerId: String(g.customerId ?? KNOWN.customerId), agentJson: String(g.agentJson ?? '[]') };
      },
      remove: async (portal, f) => { if (f.groupId) await fireConsole(portal, 'Group Management', /^Delete Agent Group/, { params: [['agentGroupId', f.groupId]] }); },
    },
    // send isActive:true explicitly — omitting it is a full-record-replace deactivate (historical bug)
    attempt: { verb: 'update', operation: /^Update Agent Group/, body: f => ({ id: Number(f.groupId), customerId: f.customerId, name: f.name, isActive: true, agentJson: f.agentJson }) },
  },
  'group-mgmt/delete-agent-group': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const agents = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
        const name = `xt-grpdel-${Date.now()}`;
        await fireConsole(portal, 'Group Management', /^Create Agent Group/, { body: { customerId: KNOWN.customerId, name, isActive: true, agentJson: JSON.stringify([String(rowsOf(agents.body)[0]?.id ?? '')]) } });
        const list = await fireConsole(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
        return { groupId: String(rowsOf(list.body).find(x => String(x.name) === name)?.id ?? '') };
      },
      remove: async (portal, f) => { if (f.groupId) await fireConsole(portal, 'Group Management', /^Delete Agent Group/, { params: [['agentGroupId', f.groupId]] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Agent Group/, params: f => [['agentGroupId', f.groupId]] },
    verifyIntact: async (portal, f) => {
      const res = await fireConsole(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
      return { ok: rowsOf(res.body).some(g => String(g.id) === f.groupId), detail: 'group present in List Agent Groups' };
    },
    destructiveIfLeaked: true,
  },

  // ── Notifications ──────────────────────────────────────────────────
  'notifications/upsert-alert-configuration': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const created = await fireConsole(portal, 'Notifications', /^Upsert Alert Configuration/, { body: alertDto(`xt-alert-${Date.now()}`, null) });
        const m = /Notification Config '(\d+)'/.exec(String((created.body as { configResult?: string })?.configResult ?? ''));
        return { alertId: m ? m[1] : '', name: `xt-alert-${Date.now()}` };
      },
      remove: async (portal, f) => { if (f.alertId) await fireConsole(portal, 'Notifications', /^Delete Alert Configuration/, { params: [['notificationId', f.alertId]] }); },
    },
    attempt: { verb: 'update', operation: /^Upsert Alert Configuration/, body: f => alertDto(`${f.name} B`, f.alertId ? Number(f.alertId) : null) },
    onSuccess: 'suspected', // alert-config site-scoping unconfirmed
  },
  'notifications/delete-alert-configuration': {
    fixture: {
      mode: 'create',
      run: async portal => {
        const created = await fireConsole(portal, 'Notifications', /^Upsert Alert Configuration/, { body: alertDto(`xt-alertdel-${Date.now()}`, null) });
        const m = /Notification Config '(\d+)'/.exec(String((created.body as { configResult?: string })?.configResult ?? ''));
        return { alertId: m ? m[1] : '' };
      },
      remove: async (portal, f) => { if (f.alertId) await fireConsole(portal, 'Notifications', /^Delete Alert Configuration/, { params: [['notificationId', f.alertId]] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Alert Configuration/, params: f => [['notificationId', f.alertId]] },
    onSuccess: 'suspected',
    destructiveIfLeaked: true,
  },
  'notifications/add-notification-rule': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => ({ siteAId, marker: `xt-rule-${Date.now()}` }),
      remove: async (portal, f) => {
        const res = await fireConsole(portal, 'Notifications', /^List Notification Rules/, { body: LIST_BODY });
        const hit = rowsOf(res.body).find(r => String(r.name ?? '') === f.marker);
        if (hit) await fireConsole(portal, 'Notifications', /^Delete Notification Rule/, { params: [['id', String(hit.id)]] });
      },
    },
    attempt: { verb: 'add', operation: /^Add Notification Rule/, body: f => ruleDto(f.marker, [f.siteAId]) },
  },
  'notifications/update-notification-rule': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const name = `xt-ruleupd-${Date.now()}`;
        const created = await fireConsole(portal, 'Notifications', /^Add Notification Rule/, { body: ruleDto(name, [siteAId]) });
        return { ruleId: String(created.body ?? ''), name, siteAId };
      },
      remove: async (portal, f) => { if (f.ruleId) await fireConsole(portal, 'Notifications', /^Delete Notification Rule/, { params: [['id', f.ruleId]] }); },
    },
    attempt: { verb: 'update', operation: /^Update Notification Rule/, body: f => ruleDto(`${f.name} B`, [f.siteAId], f.ruleId) },
  },
  'notifications/delete-notification-rule': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const name = `xt-ruledel-${Date.now()}`;
        const created = await fireConsole(portal, 'Notifications', /^Add Notification Rule/, { body: ruleDto(name, [siteAId]) });
        return { ruleId: String(created.body ?? '') };
      },
      remove: async (portal, f) => { if (f.ruleId) await fireConsole(portal, 'Notifications', /^Delete Notification Rule/, { params: [['id', f.ruleId]] }).catch(() => {}); },
    },
    attempt: { verb: 'delete', operation: /^Delete Notification Rule/, params: f => [['id', f.ruleId]] },
    verifyIntact: async (portal, f) => {
      const res = await fireConsole(portal, 'Notifications', /^List Notification Rules/, { body: LIST_BODY });
      return { ok: rowsOf(res.body).some(r => String(r.id) === f.ruleId), detail: 'rule present in List Notification Rules' };
    },
    destructiveIfLeaked: true,
  },

  // ── Restricted User Management ─────────────────────────────────────
  'restricted-user/update-restricted-user-access': {
    fixture: {
      mode: 'create',
      run: async (portal, siteAId) => {
        const list = await fireConsole(portal, 'Restricted User Management', /^List Restricted Accesses/, { body: LIST_BODY_100 });
        const target = rowsOf(list.body).find(r => /test|apiscoping|aqa|automation/i.test(String(r.email ?? r.name ?? ''))) ?? rowsOf(list.body)[0];
        const userId = String(target?.id ?? target?.userId ?? '');
        const originalSiteIds = JSON.stringify(Array.isArray(target?.siteIds) ? target!.siteIds : []);
        if (userId) await fireConsole(portal, 'Restricted User Management', /^Update Restricted User Access/, { body: { userId, agentIds: [], siteIds: [siteAId], groupIds: [] } });
        return { userId, siteAId, originalSiteIds };
      },
      remove: async (portal, f) => {
        if (f.userId) await fireConsole(portal, 'Restricted User Management', /^Update Restricted User Access/, { body: { userId: f.userId, agentIds: [], siteIds: JSON.parse(f.originalSiteIds || '[]'), groupIds: [] } }).catch(() => {});
      },
    },
    attempt: { verb: 'update', operation: /^Update Restricted User Access/, body: f => ({ userId: f.userId, agentIds: [], siteIds: [f.siteAId], groupIds: [] }) },
    expectation: 'hypothesis', // cross-site Update Restricted User Access has NEVER been executed
  },

  // ── Retention Management ──────────────────────────────────────────
  'retention/update-retention-policy': {
    fixture: {
      mode: 'discover',
      run: async portal => ({ siteAId: await currentSiteId(portal) }),
    },
    attempt: { verb: 'update', operation: /^Update Retention Policy/, params: f => [['siteId', f.siteAId], ['expirationDays', '365']] },
  },

  // ── Role Management ───────────────────────────────────────────────
  'role-mgmt/create-custom-role': {
    fixture: {
      mode: 'create',
      run: async () => ({ marker: `xt-role-${Date.now()}` }),
      // Delete Custom Role console is broken (CONSOLE-DELETE-CUSTOM-ROLE) — a
      // leaked cross-site role cannot be cleaned via the console. Left,
      // uniquely named. Tracked in UNVERIFIED.md.
      remove: async () => {},
    },
    attempt: { verb: 'add', operation: /^Create Custom Role/, body: f => ({ name: f.marker }) },
    onSuccess: 'suspected', // custom-role site-scoping is ambiguous
  },
  'role-mgmt/update-custom-role': {
    fixture: {
      mode: 'create',
      run: async portal => {
        // createRole from role-management-api.spec.ts — catalogue name is "Create", not "Add"
        const name = `xt-roleupd-${Date.now()}`;
        const created = await fireConsole(portal, 'Role Management', /^Create Custom Role/, { body: { name } });
        return { roleId: String((created.body as { id?: string })?.id ?? ''), name };
      },
      // Delete Custom Role console is broken (CONSOLE-DELETE-CUSTOM-ROLE) — a
      // leaked cross-site role cannot be cleaned via the console. Left,
      // uniquely named. Tracked in UNVERIFIED.md.
      remove: async () => {},
    },
    // ADO 37614 — settings/custom-roles/permissions; `access` is a JSON string
    attempt: { verb: 'update', operation: /^Update Custom Role/, body: f => ({ id: f.roleId, name: `${f.name} B`, access: '[]', locked: false, customerId: KNOWN.customerId }) },
    onSuccess: 'suspected',
  },

  // ── Site Management ──────────────────────────────────────────────
  'site-mgmt/update-site': {
    fixture: {
      mode: 'discover',
      run: async portal => {
        // site A itself — its own current row from List Sites
        const res = await fireConsole(portal, 'Site Management', /^List Sites/, { body: LIST_BODY });
        const siteAId = await currentSiteId(portal);
        const row = rowsOf(res.body).find(s => String(s.id ?? s.Id) === siteAId) ?? {};
        return { siteId: siteAId, name: String(row.name ?? row.Name ?? '') };
      },
    },
    // no-op — write site A's own current name back, from a key scoped to site B
    attempt: { verb: 'update', operation: /^Update Site/, body: f => ({ id: f.siteId, name: f.name }) },
  },
};

// ── merge ────────────────────────────────────────────────────────────────

/**
 * The catalogue with `read` / `write` plans attached. A `read`/`write`-class
 * entry with no plan keeps `cls` but has no `.read`/`.write`, so the engine
 * emits it as a `SKIP` row ("no executable plan attached") — visible, never
 * silent.
 */
export function mergedCatalog(): CatalogEntry[] {
  return CATALOG.map(e => ({
    ...e,
    read: e.cls === 'read' ? READ_PLANS[e.id] : undefined,
    write: e.cls === 'write' ? WRITE_PLANS[e.id] : undefined,
  }));
}

/** ids of `read`/`write` entries still missing a plan — for the UNVERIFIED tracker. */
export function planGaps(): { reads: string[]; writes: string[] } {
  return {
    reads: CATALOG.filter(e => e.cls === 'read' && !READ_PLANS[e.id]).map(e => e.id),
    writes: CATALOG.filter(e => e.cls === 'write' && !WRITE_PLANS[e.id]).map(e => e.id),
  };
}
