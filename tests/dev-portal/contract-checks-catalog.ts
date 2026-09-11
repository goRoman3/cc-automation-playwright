import {
  KNOWN, LIST_BODY, LIST_BODY_100, fireConsole, currentSiteId, agentDto,
} from './_helpers';
import type { ContractSpec } from './_contract-checks';

/**
 * Response-contract matrix — the in-scope operations and their response
 * assertions.
 *
 * MUST catch the two CONFIRMED contract bugs of this class (both pinned as
 * `expect: 'known-bug'` — the row shows `OK` while the bug is present and
 * flips to `FIXED-FLIP-ME` when it's fixed):
 *  1. `Get Agent` + `List Agents` response `customerId` is the all-zero GUID,
 *     not the real customer id — `CONTRACT-AGENT-CUSTOMERID`.
 *  2. `Create Agent Group` response `id` is always `0`, not the real id —
 *     `P1-CREATE-AGENT-GROUP-ID-ZERO`.
 *
 * The `Create Agent` rows below are the deliberate CONTRAST: its response
 * DOES carry the real `customerId` (confirmed in evidence), so bug #1 is
 * specific to the read endpoints, not universal.
 *
 * Everything not backed by an evidence capture is `hypothesis` (structure
 * likely, never verified) or `needs-schema-confirmation` (unknown) — recorded,
 * not asserted.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

const rowsOf = (b: unknown): Array<Record<string, unknown>> =>
  (Array.isArray(b) ? b : ((b as { data?: unknown[] })?.data ?? [])) as Array<Record<string, unknown>>;
const stamp = () => Date.now().toString(36);

export const CONTRACT_SPECS: ContractSpec[] = [
  // ── Get Agent — MUST catch customerId = zero GUID ──────────────────────
  {
    id: 'contract/get-agent', group: 'Agent Management', operation: 'Get Agent',
    match: /^Get Agent \(/,
    resolve: async portal => {
      const l = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
      return { agentId: String(rowsOf(l.body)[0]?.id ?? '') };
    },
    params: r => [['agentId', r.agentId]],
    assertions: [
      { path: 'id', check: 'non-zero-guid', expect: 'ok' },
      { path: 'siteId', check: 'non-zero-guid', expect: 'ok' },
      { path: 'site', check: 'string', expect: 'hypothesis', note: 'Get Agent response carries a `site` name string (lowercase)' },
      // CONFIRMED (CONTRACT-AGENT-CUSTOMERID): GET returns 00000000-0000-0000-0000-000000000000
      { path: 'customerId', check: 'non-zero-guid', expect: 'known-bug', note: 'CONTRACT-AGENT-CUSTOMERID — GET settings/agents/{id} returns the all-zero customerId; row flips to FIXED-FLIP-ME when the real id comes back' },
    ],
  },

  // ── List Agents — MUST catch [].customerId = zero GUID ─────────────────
  {
    id: 'contract/list-agents', group: 'Agent Management', operation: 'List Agents',
    match: /^List Agents/,
    body: () => LIST_BODY_100,
    assertions: [
      { path: '[].id', check: 'non-zero-guid', expect: 'ok' },
      { path: '[].siteId', check: 'non-zero-guid', expect: 'ok' },
      // CONFIRMED (CONTRACT-AGENT-CUSTOMERID): POST settings/agents/list returns 00000000-... per row
      { path: '[].customerId', check: 'non-zero-guid', expect: 'known-bug', note: 'CONTRACT-AGENT-CUSTOMERID — every List Agents row has the all-zero customerId' },
    ],
  },

  // ── Create Agent — CONTRAST: its response DOES carry the real customerId ──
  {
    id: 'contract/create-agent', group: 'Agent Management', operation: 'Create Agent',
    match: /^Create Agent \(/,
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    body: r => agentDto('AQA', `contract ${stamp()}`, r.siteId),
    assertions: [
      { path: 'id', check: 'non-zero-guid', expect: 'ok' },
      { path: 'siteId', check: 'non-zero-guid', expect: 'ok' },
      // CONFIRMED (suite-rework / CONTRACT-AGENT-CUSTOMERID): Create's response returns the REAL customerId
      { path: 'customerId', check: 'non-zero-guid', expect: 'ok', note: 'Create Agent response carries the real customerId — CONTRAST with Get/List Agent (bug is read-side only)' },
    ],
    identify: b => {
      const id = String((b as { id?: string })?.id ?? '');
      return id ? { agentId: id } : null;
    },
    cleanup: async (portal, c) => { await fireConsole(portal, 'Agent Management', /^Delete Agent \(/, { params: [['agentId', c.agentId]] }); },
  },

  // ── Create Agent Group — MUST catch response id = 0 ────────────────────
  {
    id: 'contract/create-agent-group', group: 'Group Management', operation: 'Create Agent Group',
    match: /^Create Agent Group/,
    resolve: async portal => {
      const l = await fireConsole(portal, 'Agent Management', /^List Agents/, { body: LIST_BODY_100 });
      return { agentId: String(rowsOf(l.body)[0]?.id ?? ''), name: `AQA contract grp ${stamp()}` };
    },
    body: r => ({ customerId: KNOWN.customerId, name: r.name, isActive: true, agentJson: JSON.stringify([r.agentId]) }),
    assertions: [
      // CONFIRMED (P1-CREATE-AGENT-GROUP-ID-ZERO): response id is always 0
      { path: 'id', check: 'positive-int', expect: 'known-bug', note: 'P1-CREATE-AGENT-GROUP-ID-ZERO — Create response id is always 0 (real id only readable via List); flips to FIXED-FLIP-ME when a real id is returned' },
      { path: 'name', check: 'non-empty-string', expect: 'ok' },
      { path: 'agents', check: 'array', expect: 'hypothesis', note: 'response echoes an `agents` array' },
    ],
    // Create returns id:0 — clean up by name via List
    identify: (b, resolved) => {
      const name = String((b as { name?: string })?.name ?? resolved.name ?? '');
      return name ? { name } : null;
    },
    cleanup: async (portal, c) => {
      const list = await fireConsole(portal, 'Group Management', /^List Agent Groups/, { body: LIST_BODY_100 });
      const hit = rowsOf(list.body).find(g => String(g.name) === c.name);
      if (hit) await fireConsole(portal, 'Group Management', /^Delete Agent Group/, { params: [['agentGroupId', String(hit.id)]] });
    },
  },

  // ── List Agent Groups — customerId here IS real (contrast) ─────────────
  {
    id: 'contract/list-agent-groups', group: 'Group Management', operation: 'List Agent Groups',
    match: /^List Agent Groups/,
    body: () => LIST_BODY_100,
    assertions: [
      { path: '[].id', check: 'positive-int', expect: 'ok' },
      { path: '[].isActive', check: 'boolean', expect: 'ok' },
      { path: '[].agentJson', check: 'string', expect: 'ok', note: 'agentJson is a JSON *string* (uppercased GUIDs on read — CONTRACT/diagnostic note in P1-CREATE-AGENT-GROUP-ID-ZERO)' },
      { path: '[].customerId', check: 'non-zero-guid', expect: 'ok', note: 'List Agent Groups DOES carry the real customerId (evidence P1-UPDATE-AGENT-GROUP-FULLREPLACE raw) — contrast with List Agents' },
    ],
  },

  // ── Create Extension — bare GUID string response ──────────────────────
  {
    id: 'contract/create-extension', group: 'Extension Management', operation: 'Create Extension',
    match: /^Create Extension/,
    resolve: async portal => ({ siteId: await currentSiteId(portal) }),
    body: r => ({ name: `AQAcontractext${stamp()}`, siteId: r.siteId }),
    assertions: [
      // CONFIRMED (extension-management-api.spec.ts): Create Extension returns a bare GUID *string*, not an object
      { path: '', check: 'non-zero-guid', expect: 'ok', note: 'Create Extension returns a bare GUID string (not {id})' },
    ],
    identify: b => {
      const id = typeof b === 'string' ? b : String((b as { id?: string })?.id ?? '');
      return id ? { extensionId: id } : null;
    },
    cleanup: async (portal, c) => { await fireConsole(portal, 'Extension Management', /^Delete Extension/, { params: [['extensionId', c.extensionId], ['isArchive', 'false']] }); },
  },

  // ── Upsert Alert Configuration — string configResult ──────────────────
  {
    id: 'contract/upsert-alert-configuration', group: 'Notifications', operation: 'Upsert Alert Configuration',
    match: /^Upsert Alert Configuration/,
    body: () => ({
      id: null, name: `AQA contract alert ${stamp()}`, notificationTypeId: 7, windowType: 'interaction', windowValue: 1,
      triggers: [{ notificationLevel: 'warning', shouldNotify: true, triggerOperatorId: 13, triggerValue: ['test'], triggerThreshold: 50, anomalyDetection: false }],
      filters: [], notificationCooldown: 0.5, emailAddresses: [], webhooks: [], tags: [],
    }),
    assertions: [
      // CONFIRMED (notifications-api.spec.ts): response is { configResult: "Successfully inserted Notification Config '<id>'" }
      { path: 'configResult', check: 'non-empty-string', expect: 'ok', note: "response.configResult names the new alert id: \"...Notification Config '<id>'\"" },
    ],
    identify: b => {
      const m = /Notification Config '(\d+)'/.exec(String((b as { configResult?: string })?.configResult ?? ''));
      return m ? { alertId: m[1] } : null;
    },
    cleanup: async (portal, c) => { await fireConsole(portal, 'Notifications', /^Delete Alert Configuration/, { params: [['notificationId', c.alertId]] }); },
  },

  // ── Get Call Info — model shape (widely used downstream) ──────────────
  {
    id: 'contract/get-call-info', group: 'Calls', operation: 'Get Call Info',
    match: /^Get Call Info/,
    resolve: async portal => {
      const l = await fireConsole(portal, 'Calls', /^List Calls/, { body: LIST_BODY });
      return { callId: String((rowsOf(l.body)[0] as { Id?: string })?.Id ?? '') };
    },
    params: r => [['callId', r.callId]],
    assertions: [
      { path: 'model.id', check: 'non-zero-guid', expect: 'ok', note: 'Get Call Info wraps the payload in `model`' },
      { path: 'model.siteId', check: 'non-zero-guid', expect: 'hypothesis' },
      { path: 'model.hasAnsweredForms', check: 'boolean', expect: 'hypothesis' },
      // diagnostic: evidence CHECK-list-calls-route raw shows model.userId = 00000000-... and model.customerInternalRef = ""
      { path: 'model.userId', check: 'non-zero-guid', expect: 'needs-schema-confirmation', note: 'raw capture showed model.userId = all-zero GUID — intent unknown (may be legitimately "no user")' },
    ],
  },
];

/**
 * Ops deliberately NOT in the contract matrix — surfaced as named `test.skip`s
 * in `contract-checks-matrix.spec.ts` so the omission is explicit, matching the
 * negative / boundary / auth matrices.
 */
export const CONTRACT_EXCLUDED: Array<{ group: string; operation: string; reason: string }> = [
  {
    group: 'Role Management', operation: 'Get Custom Role',
    reason:
      'DRIVABLE, but its bug (BUG-get-custom-role-ignores-roleid — GET settings/get-custom-roles/{roleId} returns a fixed *locked system* role for ANY id, real or bogus; returned `id` ≠ requested `id`, and differs between identical requests) is a request/response-correlation defect, not a response-*shape* one. This engine only checks field shapes/types (`guid`, `positive-int`, …), not "returned id == requested id". Already pinned in role-management-api.spec.ts. Move here once the engine gains an `equals-requested-param` check.',
  },
  {
    group: 'Agent Management', operation: 'Update Agent',
    reason:
      'BUG-update-agent-site-scoping — 400s for ANY agent on the caller\'s own site, so there is no 2xx response body to assert a contract against. Pinned in agent-management-api.spec.ts.',
  },
  {
    group: 'Chats', operation: 'List Chats (+ the 9 chat sub-ops)',
    reason: 'BLOCKER-list-chats-500 — 500s on every body variant; no response body to check, and no chatId source for the sub-ops.',
  },
  {
    group: '(all)', operation: 'blocked / destructive / n/a ops',
    reason:
      'see cross-tenant-catalog.ts — cannot obtain a clean 2xx response body to assert against (upstream 500 / missing id / console broken), or the op mutates real data with no disposable fixture.',
  },
  {
    group: '(all)', operation: 'Update / Delete ops generally',
    reason:
      'contract checks target response *bodies*; Update/Delete ops mostly return 204 or a bare status with no shape worth asserting. Their structural behaviour is covered by the cross-tenant and idempotency matrices.',
  },
];
