import { LIST_BODY, LIST_BODY_100 } from './_helpers';
import type { AuthOp } from './_auth-checks';

/**
 * Read-only ops for the authorization matrix (item 3). Deliberately NO
 * mutating ops — an auth-failure path must never touch a write.
 *
 * Mix of scoping levels so the `unscoped-own-key` blanket-500 is visible
 * against ops that *should* behave differently:
 *  - customer-level reads (`Get Company Info`, `List Sites`) — a valid
 *    unscoped key should still 200 these;
 *  - site-scoped reads (`List Agents`, `Get Sites Storage Usage`) — should
 *    401/403 an unscoped key, not 500.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */
export const AUTH_OPS: AuthOp[] = [
  {
    id: 'auth/get-company-info', group: 'General Settings', operation: 'Get Company Info',
    match: /^Preview Company Info/,
    correctBehaviourNote: 'customer-level read — a valid unscoped key should 200; a bad key should 401',
  },
  {
    id: 'auth/list-sites', group: 'Site Management', operation: 'List Sites',
    match: /^List Sites/, body: LIST_BODY,
    correctBehaviourNote: 'account-wide read — a valid unscoped key should 200; a bad key should 401',
  },
  {
    id: 'auth/list-agents', group: 'Agent Management', operation: 'List Agents',
    match: /^List Agents/, body: LIST_BODY_100,
    correctBehaviourNote: 'site-scoped read — an unscoped key should 401/403, not 500; a bad key should 401',
  },
  {
    id: 'auth/get-sites-storage-usage', group: 'Reports', operation: 'Get Sites Storage Usage',
    match: /^List Sites Storage Usage/,
    correctBehaviourNote: 'site-scoped read (the live site probe) — an unscoped key should 401/403; a bad key should 401',
  },
];

export const AUTH_DEFERRED: Array<{ mode: string; reason: string }> = [
  {
    mode: 'no-key',
    reason: 'the Try-it console\'s subscription-key dropdown always has a value selected — there is no console affordance to send with the Ocp-Apim-Subscription-Key header absent. Needs a raw page.request outside the console.',
  },
  {
    mode: 'foreign-tenant-key',
    reason: 'no second customer\'s subscription key is available. A real cross-tenant auth check needs a key issued to a different CallCabinet customer.',
  },
  {
    mode: 'expired-key',
    reason: 'no expired subscription key exists and one cannot be safely created/expired on the shared account.',
  },
];
