import type { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, KNOWN, LIST_BODY, LIST_BODY_100, openConsole, sendJson,
  currentSiteId, firstOwnSiteCall, agentDto, ruleDto, alertDto,
} from './_helpers';
import type { NegFieldSpec } from './_negative-fields';

/**
 * Negative-required-fields matrix — the in-scope operations and their
 * classified required fields.
 *
 * SCOPE = create-from-body operations only, where:
 *  - a confirmed VALID body exists (from `*-api.spec.ts` / ADO / evidence);
 *  - omitting a field cannot corrupt existing data (worst case: a partial
 *    object is created → cleaned up in `finally`);
 *  - the created object can be deleted (or the broken-cleanup caveat is
 *    explicit).
 *
 * EXCLUDED (see `EXCLUDED_FROM_NEG_MATRIX` + the spec's named skips):
 *  - every Update / Delete op — omitting a field from an update risks a
 *    partial wipe (the Update Agent Group full-replace bug is exactly this);
 *  - Manual Redaction (standing "do not fire" hold + the endpoint hangs);
 *  - Add User (control creates a real user + invitation email, and Delete
 *    User's console is broken — can't clean up; covered by the older
 *    `negative-required-fields-staging.spec.ts` instead);
 *  - Update Retention Policy (omitting `expirationDays` could null retention);
 *  - anything `blocked` / `destructive` / `n/a` in `cross-tenant-catalog.ts`.
 *
 * Field expectation classification — CONFIRMED sources only:
 *  - `negative-required-fields-staging.spec.ts` (asserts, run 2026-08-29);
 *  - evidence `artifacts/dev-portal-evidence-2026-08-29/raw/P1-NEGATIVE-500S.json`;
 *  - `docs/dev-portal-suite-rework-2026-08-29.md` (which reduced sets were established).
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

async function fire(
  portal: DeveloperPortalPage, group: string, match: RegExp,
  opts: { body?: unknown; params?: [string, string][] } = {},
): Promise<{ status: number; body: unknown }> {
  const op = await openConsole(portal, group, match, { retries: 3 });
  await op.selectSubscriptionKey(API_KEY_OPTION);
  for (const [n, v] of opts.params ?? []) await op.addParameter(n, v);
  return opts.body === undefined ? op.send() : sendJson(op, portal.raw, opts.body);
}
const rowsOf = (b: unknown): Array<Record<string, unknown>> =>
  (Array.isArray(b) ? b : ((b as { data?: unknown[] })?.data ?? [])) as Array<Record<string, unknown>>;
const stamp = () => Date.now().toString(36);

export const NEG_FIELD_SPECS: NegFieldSpec[] = [
  // ── Extension Management / Create Extension ──────────────────────────────
  {
    id: 'ext-mgmt/create-extension', group: 'Extension Management', operation: 'Create Extension',
    match: /^Create Extension/,
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    validBody: r => ({ name: `AQAnegext${stamp()}`, siteId: r.siteId }),
    requiredFields: [
      { name: 'name', in: 'body', expect: '400' },   // CONFIRMED (negative-required-fields-staging)
      { name: 'siteId', in: 'body', expect: '400' },  // CONFIRMED
    ],
    identify: b => {
      const id = typeof b === 'string' ? b : String((b as { id?: string })?.id ?? '');
      return id ? { extensionId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Extension Management', /^Delete Extension/, { params: [['extensionId', c.extensionId], ['isArchive', 'false']] }); },
  },

  // ── Site Management / Add Site ──────────────────────────────────────────
  {
    id: 'site-mgmt/add-site', group: 'Site Management', operation: 'Add Site',
    match: /^Add Site/,
    validBody: () => ({ name: `AQAnegsite${stamp()}` }),
    requiredFields: [{ name: 'name', in: 'body', expect: '400' }],  // CONFIRMED
    identify: b => {
      const s = Array.isArray(b) ? b[0] : b;  // Add Site returns a single-element array of SiteDto (PascalCase Id)
      const id = String((s as { Id?: string; id?: string })?.Id ?? (s as { id?: string })?.id ?? '');
      return id ? { siteId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Site Management', /^Delete Site/, { params: [['siteId', c.siteId]] }); },
    cleanupCaveat: 'Delete Site path-param name assumed "siteId" — if wrong, the disposable site is left (CC Test 1 has hundreds; harmless)',
  },

  // ── Tag Management / Add Tag ───────────────────────────────────────────
  {
    id: 'tag-mgmt/add-tag', group: 'Tag Management', operation: 'Add Tag',
    match: /^Add Tag/,
    // alphanumeric + spaces only (CONTRACT-update-tag-name-validation) — no hyphens
    validBody: () => ({ name: `AQAnegtag${stamp()}` }),
    requiredFields: [{ name: 'name', in: 'body', expect: '400' }],  // CONFIRMED
    identify: b => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { tagId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Tag Management', /^Delete Tag/, { params: [['tagId', c.tagId]] }); },
    cleanupCaveat: 'Delete Tag path-param name assumed "tagId"',
  },

  // ── IP Whitelist / Add IP Whitelist ──────────────────────────────────
  {
    id: 'ip-whitelist/add', group: 'IP Whitelist', operation: 'Add IP Whitelist',
    match: /^Add IP Whitelist/,
    // 203.0.113.0/24 = RFC 5737 TEST-NET-3, reserved & non-routable
    validBody: () => ({ ipAddress: '203.0.113.49' }),
    requiredFields: [
      // CONFIRMED (evidence P1-NEGATIVE-500S + negative-required-fields-staging): 500 NRE, not 400
      { name: 'ipAddress', in: 'body', expect: 'known-bug-500', note: 'BUG-negative-missing-field-500 — NullReferenceException instead of a 400 validation error' },
    ],
    identify: b => {
      const id = String((b as { id?: number | string })?.id ?? '');
      return id ? { id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'IP Whitelist', /^Delete IP Whitelist/, { body: { id: Number(c.id), ipAddress: '203.0.113.49' } }); },
  },

  // ── Role Management / Create Custom Role ─────────────────────────────
  {
    id: 'role-mgmt/create-custom-role', group: 'Role Management', operation: 'Create Custom Role',
    match: /^Create Custom Role/,
    validBody: () => ({ name: `AQA neg role ${stamp()}` }),
    requiredFields: [
      // CONFIRMED (evidence P1-NEGATIVE-500S + negative-required-fields-staging): 500 EF save error, not 400
      { name: 'name', in: 'body', expect: 'known-bug-500', note: 'BUG-negative-missing-field-500 — "An error occurred while saving the entity changes" (EF) instead of a 400' },
    ],
    identify: b => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { roleId: id } : null;
    },
    // no cleanup — Delete Custom Role console never renders Send (CONSOLE-DELETE-CUSTOM-ROLE)
    cleanupCaveat: 'Delete Custom Role console is broken — the disposable role is LEFT (uniquely named "AQA neg role *"). Grep + delete manually.',
  },

  // ── Group Management / Create Agent Group ───────────────────────────
  {
    id: 'group-mgmt/create-agent-group', group: 'Group Management', operation: 'Create Agent Group',
    match: /^Create Agent Group/,
    resolve: async portal => {
      const agents = await fire(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
      return { agentId: String(rowsOf(agents.body)[0]?.id ?? ''), name: `AQA neg grp ${stamp()}` };
    },
    validBody: r => ({ customerId: KNOWN.customerId, name: r.name, isActive: true, agentJson: JSON.stringify([r.agentId]) }),
    requiredFields: [
      { name: 'name', in: 'body', expect: 'hypothesis-400' },
      { name: 'customerId', in: 'body', expect: 'hypothesis-400' },
      { name: 'isActive', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'agentJson', in: 'body', expect: 'special', note: 'empty "[]" is accepted (200) but the group silently does NOT persist — KNOWN BUG P1-CREATE-AGENT-GROUP-ID-ZERO. Omitting agentJson entirely: never observed.' },
    ],
    // Create Agent Group's response id is always 0 (KNOWN BUG) — cleanup by name via List
    identify: (b, resolved) => {
      const name = String((b as { name?: string })?.name ?? resolved.name ?? '');
      return name ? { name } : null;
    },
    cleanup: async (portal, c) => {
      const list = await fire(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
      const hit = rowsOf(list.body).find(g => String(g.name) === c.name);
      if (hit) await fire(portal, 'Group Management', /^Delete Agent Group/, { params: [['agentGroupId', String(hit.id)]] });
    },
  },

  // ── Agent Management / Create Agent ────────────────────────────────
  {
    id: 'agent-mgmt/create-agent', group: 'Agent Management', operation: 'Create Agent',
    match: /^Create Agent \(/,
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    validBody: r => agentDto('AQA', `neg ${stamp()}`, r.siteId),
    requiredFields: [
      // suite-rework doc: the reduced required set was NEVER established for the full agent DTO.
      { name: 'firstName', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'lastName', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'siteId', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'customerId', in: 'body', expect: 'needs-schema-confirmation' },
    ],
    identify: b => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { agentId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Agent Management', /^Delete Agent \(/, { params: [['agentId', c.agentId]] }); },
  },

  // ── Agent Management / Create Agent Extension Mapping ──────────────
  {
    id: 'agent-mgmt/create-agent-extension-mapping', group: 'Agent Management', operation: 'Create Agent Extension Mapping',
    match: /^Create Agent Extension Mapping/,
    resolve: async portal => {
      const agents = await fire(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
      const freeAgent = rowsOf(agents.body).find(a => !a.assignedExtension);
      const exts = await fire(portal, 'Extension Management', /^List Extensions/, { body: LIST_BODY_100 });
      const freeExt = rowsOf(exts.body).find(e => String(e.agentId) === '00000000-0000-0000-0000-000000000000');
      return { agentId: String(freeAgent?.id ?? ''), extensionId: String(freeExt?.id ?? '') };
    },
    validBody: r => ({ agentId: r.agentId, extensionId: r.extensionId }),
    requiredFields: [
      { name: 'agentId', in: 'body', expect: 'hypothesis-400' },
      { name: 'extensionId', in: 'body', expect: 'hypothesis-400' },
    ],
    identify: b => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { mappingId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Agent Management', /^Delete Agent Extension/, { params: [['id', c.mappingId]] }); },
  },

  // ── Notifications / Add Notification Rule ─────────────────────────
  {
    id: 'notifications/add-notification-rule', group: 'Notifications', operation: 'Add Notification Rule',
    match: /^Add Notification Rule/,
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    validBody: r => ruleDto(`AQA neg rule ${stamp()}`, [r.siteId]),
    requiredFields: [
      { name: 'name', in: 'body', expect: 'hypothesis-400' },
      { name: 'triggerType', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'actionType', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'siteIds', in: 'body', expect: 'needs-schema-confirmation' },
    ],
    identify: b => {
      const id = String(b ?? '');  // Add Notification Rule returns the id as a bare string
      return id && id !== '[object Object]' ? { ruleId: id } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Notifications', /^Delete Notification Rule/, { params: [['id', c.ruleId]] }); },
  },

  // ── Notifications / Upsert Alert Configuration ────────────────────
  {
    id: 'notifications/upsert-alert-configuration', group: 'Notifications', operation: 'Upsert Alert Configuration',
    match: /^Upsert Alert Configuration/,
    validBody: () => alertDto(`AQA neg alert ${stamp()}`, null),
    requiredFields: [
      // full-object body — reduced required set never established (suite-rework doc)
      { name: 'name', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'notificationTypeId', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'windowType', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'windowValue', in: 'body', expect: 'needs-schema-confirmation' },
      { name: 'triggers', in: 'body', expect: 'needs-schema-confirmation' },
    ],
    identify: b => {
      const m = /Notification Config '(\d+)'/.exec(String((b as { configResult?: string })?.configResult ?? ''));
      return m ? { alertId: m[1] } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Notifications', /^Delete Alert Configuration/, { params: [['notificationId', c.alertId]] }); },
  },

  // ── Calls / Add Call Note ────────────────────────────────────────
  {
    id: 'calls/add-call-note', group: 'Calls', operation: 'Add Call Note',
    match: /^Add Call Note/,
    resolve: async portal => ({ callId: (await firstOwnSiteCall(portal)).id }),
    validBody: r => ({ callId: r.callId, note: `AQA neg note ${stamp()}` }),
    params: r => [['callId', r.callId]],
    requiredFields: [
      { name: 'note', in: 'body', expect: '400' },  // CONFIRMED (negative-required-fields-staging)
      // `callId` is also the path param — omitting it from the body alone doesn't
      // test "no callId at all"; left out here, same as the older spec.
    ],
    identify: (b, resolved) => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { noteId: id, callId: resolved.callId } : null;
    },
    cleanup: async (portal, c) => { await fire(portal, 'Calls', /^Delete Call Note/, { params: [['callId', c.callId], ['noteId', c.noteId]] }); },
  },
];

/** Ops deliberately NOT in the negative-field matrix — named skips in the spec. */
export const EXCLUDED_FROM_NEG_MATRIX: Array<{ group: string; operation: string; reason: string }> = [
  { group: 'User Management', operation: 'Add User', reason: 'control case creates a real user + sends a real invitation email, and Delete User\'s console is broken (BUG-delete-user-send-inert) — can\'t clean up. Covered by negative-required-fields-staging.spec.ts.' },
  { group: 'Manual Redaction', operation: 'Submit Call Redaction Request', reason: 'standing "do not fire Manual Redaction" hold + the endpoint hangs with no response (MASTER §12). Never fired.' },
  { group: 'Retention Management', operation: 'Update Retention Policy', reason: 'omitting expirationDays from an update could null the site\'s retention — too dangerous for a negative probe.' },
  { group: 'General Settings', operation: 'Update Company Settings', reason: 'customer-level settings update — omitting a field could reset real config; no disposable form.' },
  { group: 'General Settings', operation: 'Update SSO Settings', reason: 'same — customer-level settings update.' },
  { group: '(all)', operation: 'every Update / Delete op', reason: 'omitting a field from an update risks a partial wipe (Update Agent Group full-replace bug is exactly this). Negative-field probing is limited to create-from-body ops.' },
  { group: '(all)', operation: 'every blocked / destructive / n/a op', reason: 'see cross-tenant-catalog.ts — can\'t be driven / irreversible / no per-object body.' },
];
