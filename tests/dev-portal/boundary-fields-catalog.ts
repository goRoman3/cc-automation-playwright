import type { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, LIST_BODY, LIST_BODY_100, openConsole, sendJson,
} from './_helpers';
import type { BoundarySpec, BoundaryField } from './_negative-fields';
import { NEG_FIELD_SPECS } from './negative-fields-catalog';

/**
 * Boundary-values matrix (item 1) — the SAME declarative shape as the
 * missing-required-fields matrix, one step further: instead of *omitting* a
 * field, send it present-but-degenerate — empty string, whitespace, `null`,
 * malformed GUID, the all-zero GUID, an out-of-range / negative number, a
 * bad-format string, malformed JSON.
 *
 * SCOPE
 *  - The 11 create-from-body ops from `negative-fields-catalog.ts` are reused
 *    verbatim for their `validBody` / `resolve` / `identify` / `cleanup`
 *    (single source of truth — `ext()` below strips `requiredFields` and
 *    attaches `boundaryFields`); only the per-field boundary list is new.
 *  - Plus two READ ops (`List Calls`, `List Agents`) for pagination bounds
 *    (`take` past the server max, `skip` negative, `take` wrong-type) — these
 *    create nothing, so no `identify` / `cleanup`.
 *
 * EXPECTATIONS — CONFIRMED sources only:
 *  - `'400'` is used for exactly ONE row: Add Tag `name` = bad-format
 *    (hyphen / `_` / `.`). CONFIRMED by `CONTRACT-update-tag-name-validation`
 *    (evidence: "Add Tag enforces it too" → 400 "Alphanumeric characters and
 *    spaces allowed only").
 *  - `special` — Create Agent Group `agentJson = "[]"`: CONFIRMED 200 +
 *    silent non-persist (evidence P1-CREATE-AGENT-GROUP-ID-ZERO). Recorded,
 *    not asserted (matches the neg-matrix row for the same field).
 *  - Everything else is `hypothesis-400` / `hypothesis-reject` (a rejection
 *    that is *likely* but was NEVER actually observed — the confirmed facts
 *    are about field *omission*, not degenerate *values*; per the rules these
 *    must not be conflated) or `needs-schema-confirmation` (behaviour
 *    genuinely unknown — recorded, no assert).
 *
 * NOT COVERED
 *  - `bad-date` — no in-scope op has a confirmed valid body containing a date
 *    field (the reports read-plans in `cross-tenant-plans.ts` send no body,
 *    relying on the console's example). A bad-date probe needs a trustworthy
 *    CONTROL first: capture a valid `Get Call Volume Statistics` /
 *    `Get Report By Template` body live, then add it here. Named skip in the
 *    spec.
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

const NEG_BY_ID = new Map(NEG_FIELD_SPECS.map(s => [s.id, s]));

/** Reuse a NEG_FIELD_SPEC's valid-body plumbing; swap in a boundary-field list. */
function ext(id: string, boundaryFields: BoundaryField[]): BoundarySpec {
  const base = NEG_BY_ID.get(id);
  if (!base) throw new Error(`boundary-fields-catalog: no NEG_FIELD_SPEC "${id}" to extend`);
  const { requiredFields: _drop, ...rest } = base;
  return { ...rest, boundaryFields };
}

export const BOUNDARY_SPECS: BoundarySpec[] = [
  // ── Extension Management / Create Extension (name & siteId: omit→400 CONFIRMED) ──
  ext('ext-mgmt/create-extension', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'hypothesis-400', note: 'empty ≠ omitted — never observed' },
    { name: 'name', in: 'body', kind: 'whitespace', expect: 'hypothesis-400' },
    { name: 'name', in: 'body', kind: 'null', expect: 'hypothesis-400' },
    { name: 'siteId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400', note: 'malformed GUID → model-bind 400 is likely, unobserved' },
    { name: 'siteId', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'siteId', in: 'body', kind: 'zero-guid', expect: 'needs-schema-confirmation', note: 'all-zero GUID may route to "no site" → 400 or 500 — unknown' },
  ]),

  // ── Site Management / Add Site (name: omit→400 CONFIRMED; control creates a real site) ──
  ext('site-mgmt/add-site', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'name', in: 'body', kind: 'whitespace', expect: 'hypothesis-400' },
    { name: 'name', in: 'body', kind: 'null', expect: 'hypothesis-400' },
  ]),

  // ── Tag Management / Add Tag — alphanumeric+spaces only is CONFIRMED ──
  ext('tag-mgmt/add-tag', [
    // CONFIRMED (CONTRACT-update-tag-name-validation): 400 "Alphanumeric characters and spaces allowed only"
    { name: 'name', in: 'body', kind: 'bad-format', value: 'AQAneg-1_.', expect: '400', note: 'hyphen/underscore/dot rejected — CONTRACT-update-tag-name-validation (Add Tag enforces it too)' },
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'name', in: 'body', kind: 'null', expect: 'hypothesis-400' },
  ]),

  // ── IP Whitelist / Add IP Whitelist (ipAddress: omit→500 KNOWN BUG) ──
  ext('ip-whitelist/add', [
    { name: 'ipAddress', in: 'body', kind: 'bad-format', value: '999.999.999.999', expect: 'hypothesis-400', note: 'out-of-range octets — an IP validator plausibly 400s; never observed' },
    { name: 'ipAddress', in: 'body', kind: 'bad-format', value: 'not-an-ip', expect: 'hypothesis-400' },
    { name: 'ipAddress', in: 'body', kind: 'empty-string', expect: 'needs-schema-confirmation', note: 'may hit the same NRE path as omission (BUG-negative-missing-field-500) — unknown' },
    { name: 'ipAddress', in: 'body', kind: 'null', expect: 'needs-schema-confirmation', note: 'likely same NRE as omission' },
  ]),

  // ── Role Management / Create Custom Role (name: omit→500 KNOWN BUG; NO cleanup — console broken) ──
  ext('role-mgmt/create-custom-role', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'needs-schema-confirmation', note: 'may hit the same EF save 500 as omission — unknown' },
    { name: 'name', in: 'body', kind: 'null', expect: 'needs-schema-confirmation' },
  ]),

  // ── Group Management / Create Agent Group (name/customerId omit→hypothesis-400; agentJson special) ──
  ext('group-mgmt/create-agent-group', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'customerId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400' },
    { name: 'customerId', in: 'body', kind: 'zero-guid', expect: 'needs-schema-confirmation', note: 'Create already returns id:0 (KNOWN BUG) — a zero customerId may be silently accepted' },
    { name: 'isActive', in: 'body', kind: 'wrong-type', value: 'yes', expect: 'needs-schema-confirmation' },
    { name: 'agentJson', in: 'body', kind: 'bad-json', expect: 'hypothesis-reject', note: 'malformed JSON in a JSON-string field — 400/500 likely, unobserved' },
    // CONFIRMED (evidence P1-CREATE-AGENT-GROUP-ID-ZERO): 200 but the group never appears in List
    { name: 'agentJson', in: 'body', kind: 'empty-json-array', expect: 'special', note: '"[]" → 200 but silent non-persist — KNOWN BUG P1-CREATE-AGENT-GROUP-ID-ZERO' },
  ]),

  // ── Agent Management / Create Agent (reduced required set NEVER established) ──
  ext('agent-mgmt/create-agent', [
    { name: 'firstName', in: 'body', kind: 'empty-string', expect: 'needs-schema-confirmation' },
    { name: 'lastName', in: 'body', kind: 'empty-string', expect: 'needs-schema-confirmation' },
    { name: 'siteId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400', note: 'malformed GUID → model-bind 400 likely regardless of required-ness' },
    { name: 'siteId', in: 'body', kind: 'zero-guid', expect: 'needs-schema-confirmation' },
    { name: 'customerId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400' },
  ]),

  // ── Agent Management / Create Agent Extension Mapping (agentId/extensionId omit→hypothesis-400) ──
  ext('agent-mgmt/create-agent-extension-mapping', [
    { name: 'agentId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400' },
    { name: 'agentId', in: 'body', kind: 'zero-guid', expect: 'needs-schema-confirmation', note: 'zero GUID = "no agent" — may 400 or be silently accepted' },
    { name: 'extensionId', in: 'body', kind: 'bad-guid', expect: 'hypothesis-400' },
    { name: 'extensionId', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
  ]),

  // ── Notifications / Add Notification Rule (name omit→hypothesis-400; rest needs-schema) ──
  ext('notifications/add-notification-rule', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'triggerType', in: 'body', kind: 'out-of-range', expect: 'hypothesis-reject', note: 'enum — a value far past the last member plausibly 400s' },
    { name: 'triggerType', in: 'body', kind: 'negative', expect: 'hypothesis-reject' },
    { name: 'actionType', in: 'body', kind: 'wrong-type', value: 'abc', expect: 'needs-schema-confirmation' },
    { name: 'siteIds', in: 'body', kind: 'wrong-type', value: 'not-an-array', expect: 'hypothesis-reject', note: 'array field given a bare string → 400 likely' },
  ]),

  // ── Notifications / Upsert Alert Configuration (full-object body — reduced set never established) ──
  ext('notifications/upsert-alert-configuration', [
    { name: 'name', in: 'body', kind: 'empty-string', expect: 'needs-schema-confirmation' },
    { name: 'windowType', in: 'body', kind: 'bad-format', value: 'bogus-window', expect: 'hypothesis-reject', note: 'string enum (interaction/…) — a bogus value plausibly 400s' },
    { name: 'windowValue', in: 'body', kind: 'negative', expect: 'needs-schema-confirmation' },
    { name: 'windowValue', in: 'body', kind: 'out-of-range', expect: 'needs-schema-confirmation' },
    { name: 'notificationTypeId', in: 'body', kind: 'out-of-range', expect: 'hypothesis-reject' },
    { name: 'triggers', in: 'body', kind: 'wrong-type', value: 'abc', expect: 'hypothesis-reject', note: 'array field given a bare string' },
  ]),

  // ── Calls / Add Call Note (note: omit→400 CONFIRMED) ──
  ext('calls/add-call-note', [
    { name: 'note', in: 'body', kind: 'empty-string', expect: 'hypothesis-400' },
    { name: 'note', in: 'body', kind: 'whitespace', expect: 'hypothesis-400' },
    { name: 'note', in: 'body', kind: 'null', expect: 'hypothesis-400' },
    { name: 'callId', in: 'body', kind: 'bad-guid', expect: 'needs-schema-confirmation', note: 'callId is also the path param — body/param mismatch behaviour unknown' },
  ]),

  // ── READ ops — pagination bounds (no object created → no cleanup) ──
  {
    id: 'calls/list-calls-pagination', group: 'Calls', operation: 'List Calls',
    match: /^List Calls/,
    validBody: () => ({ ...LIST_BODY }),
    boundaryFields: [
      // evidence new-finding (b): server max take is 500; the console default (10000) already trips validation on chats/list. NEVER observed on List Calls.
      { name: 'take', in: 'body', kind: 'out-of-range', value: 10000, expect: 'hypothesis-400', note: 'server take max is 500 (evidence new-finding b, seen on chats/list) — unobserved here' },
      { name: 'take', in: 'body', kind: 'negative', expect: 'needs-schema-confirmation' },
      { name: 'take', in: 'body', kind: 'wrong-type', value: 'abc', expect: 'hypothesis-reject', note: 'int slot given a string → model-bind 400 likely' },
      { name: 'skip', in: 'body', kind: 'negative', expect: 'needs-schema-confirmation' },
    ],
  },
  {
    id: 'agent-mgmt/list-agents-pagination', group: 'Agent Management', operation: 'List Agents',
    match: /^List Agents/,
    validBody: () => ({ ...LIST_BODY_100 }),
    boundaryFields: [
      { name: 'take', in: 'body', kind: 'out-of-range', value: 10000, expect: 'hypothesis-400', note: 'as calls/list-calls-pagination' },
      { name: 'take', in: 'body', kind: 'wrong-type', value: 'abc', expect: 'hypothesis-reject' },
    ],
  },
];

/** Named skips for the boundary matrix — deferred probe classes. */
export const BOUNDARY_DEFERRED: Array<{ probe: string; reason: string }> = [
  {
    probe: 'bad-date (unparseable date string)',
    reason: 'no in-scope op has a confirmed valid body with a date field — the reports read-plans send no body. Capture a valid Get Call Volume Statistics / Get Report By Template body live first, then add a dated spec here.',
  },
  {
    probe: 'over-limit string length (e.g. 10k-char name)',
    reason: 'no confirmed server-side max-length for any name/note field — would be a pure guess. Add once a 400 "too long" is actually observed.',
  },
];
