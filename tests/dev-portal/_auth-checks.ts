import type { Page } from '@playwright/test';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { HomePage } from '../../pages/home/HomePage';
import { fireConsole } from './_helpers';

/**
 * Authorization matrix (item 3) — how each op behaves with a degraded
 * subscription key. Currently ZERO coverage of this class.
 *
 * Modes driven through the Try-it console's key dropdown / headers:
 *  - `valid`            — the site-scoped `Primary: API_test` key (control → 2xx).
 *  - `unscoped-own-key` — the account's own default `Primary: 1` key, which is
 *                         NOT scoped to a site. CONFIRMED to blanket-500 every
 *                         operation regardless of shape/host
 *                         (`pages/dev-portal/ApiOperationPage.ts` doc,
 *                         `_helpers.ts` doc, the tenant-scoping bug reports).
 *                         `expect: 'known-bug'` — a correct implementation
 *                         would 200 a customer-level read and 401/403 a
 *                         site-scoped one, not 500 everything.
 *  - `garbage-key-header` — a real key selected, then
 *                         `Ocp-Apim-Subscription-Key` overridden with a junk
 *                         value via "Add header". APIM's documented behaviour
 *                         is `401` "invalid subscription key"; NEVER observed
 *                         here, and whether the console lets a manual header
 *                         win over the dropdown is itself unverified →
 *                         `expect: 'hypothesis-reject'`. A `2xx` here is an
 *                         `AUTH-BYPASS` (hard fail).
 *
 * DEFERRED (no fixture — named skips in the spec): true `no-key` (the console
 * dropdown always has a value), `foreign-tenant-key` (no 2nd customer's key),
 * `expired-key` (none exists; can't safely expire one).
 *
 * Read-only ops only — an auth-failure path must never touch a mutation.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

export type AuthMode = 'valid' | 'unscoped-own-key' | 'garbage-key-header';
export type AuthExpect = 'ok' | 'known-bug' | 'hypothesis-reject';

const VALID_KEY = 'Primary: API_test';
const UNSCOPED_KEY = 'Primary: 1';
const GARBAGE_KEY = '00000000000000000000000000000000';

export interface AuthOp {
  id: string;
  group: string;
  operation: string;
  match: RegExp;
  /** request body (omit → plain GET). */
  body?: unknown;
  params?: [string, string][];
  /** one-line note on what a correct response to a degraded key would look like. */
  correctBehaviourNote: string;
}

export interface AuthRow {
  id: string;
  group: string;
  operation: string;
  mode: AuthMode | 'deferred';
  expect: AuthExpect | 'control';
  observed: string;
  verdict: 'OK' | 'AUTH-BYPASS' | 'FIXED-FLIP-ME' | 'HYPOTHESIS-FAIL' | 'CONTROL-FAIL' | 'ERROR' | 'SKIP';
  note?: string;
}

export interface AuthResult {
  rows: AuthRow[];
}

const is2xx = (s: number): boolean => s >= 200 && s < 300;
const isAuthReject = (s: number): boolean => s === 401 || s === 403;
const short = (b: unknown): string => (typeof b === 'string' ? b : JSON.stringify(b ?? '')).slice(0, 140);

async function invoke(
  portal: DeveloperPortalPage, op: AuthOp, mode: AuthMode,
): Promise<{ status: number; body: unknown }> {
  // Only the key + one injected header vary by mode; the open→select→params→send
  // sequence (and the schema-blind body fallback, which `invoke` used to inline
  // byte-for-byte) is the shared `fireConsole` primitive. `garbage-key-header`
  // keeps the real key selected AND adds a junk `Ocp-Apim-Subscription-Key` —
  // headers are applied after the key, before params, exactly as before.
  const key = mode === 'unscoped-own-key' ? UNSCOPED_KEY : VALID_KEY;
  const headers: Array<[string, string]> =
    mode === 'garbage-key-header' ? [['Ocp-Apim-Subscription-Key', GARBAGE_KEY]] : [];
  return fireConsole(portal, op.group, op.match, { body: op.body, params: op.params, key, headers });
}

function verdictFor(mode: AuthMode, status: number): { verdict: AuthRow['verdict']; note?: string } {
  if (mode === 'valid') {
    return is2xx(status) ? { verdict: 'OK' } : { verdict: 'CONTROL-FAIL', note: `valid key → ${status}` };
  }
  if (mode === 'unscoped-own-key') {
    if (status === 500) return { verdict: 'OK', note: 'KNOWN BUG still present — unscoped key blanket-500s (should 200 customer-level / 401-403 site-scoped)' };
    if (is2xx(status) || isAuthReject(status)) return { verdict: 'FIXED-FLIP-ME', note: `now ${status} — the blanket-500 bug is fixed; re-classify this row` };
    return { verdict: 'HYPOTHESIS-FAIL', note: `unscoped key → ${status} (neither 500 nor a clean 2xx/401/403)` };
  }
  // garbage-key-header
  if (isAuthReject(status)) return { verdict: 'OK', note: `HYPOTHESIS held — garbage key rejected (${status})` };
  if (is2xx(status)) return { verdict: 'AUTH-BYPASS', note: '⚠️ a request with a GARBAGE subscription key returned 2xx' };
  return { verdict: 'HYPOTHESIS-FAIL', note: `garbage key → ${status} (expected 401/403; a 500 may just mean the console kept the real key)` };
}

export async function runAuthMatrix(opts: {
  page: Page;
  homePage: HomePage;
  ops: AuthOp[];
  deferred: Array<{ mode: string; reason: string }>;
}): Promise<AuthResult> {
  const { homePage, ops, deferred } = opts;
  const rows: AuthRow[] = [];
  const portal = await DeveloperPortalPage.openFrom(homePage);

  for (const op of ops) {
    for (const mode of ['valid', 'unscoped-own-key', 'garbage-key-header'] as const) {
      try {
        const res = await invoke(portal, op, mode);
        const { verdict, note } = verdictFor(mode, res.status);
        rows.push({
          id: op.id, group: op.group, operation: op.operation, mode,
          expect: mode === 'valid' ? 'control' : mode === 'unscoped-own-key' ? 'known-bug' : 'hypothesis-reject',
          observed: `${mode} → ${res.status} ${short(res.body)}`, verdict,
          note: [note, mode !== 'valid' ? `correct: ${op.correctBehaviourNote}` : ''].filter(Boolean).join(' | ') || undefined,
        });
      } catch (err) {
        rows.push({
          id: op.id, group: op.group, operation: op.operation, mode,
          expect: mode === 'valid' ? 'control' : mode === 'unscoped-own-key' ? 'known-bug' : 'hypothesis-reject',
          observed: `error: ${String(err)}`, verdict: 'ERROR',
        });
      }
    }
  }
  for (const d of deferred) {
    rows.push({
      id: `(deferred)/${d.mode}`, group: '(all)', operation: d.mode, mode: 'deferred',
      expect: 'hypothesis-reject', observed: 'not runnable — no fixture', verdict: 'SKIP', note: d.reason,
    });
  }
  return { rows };
}

export function renderAuthMatrix(res: AuthResult): string {
  const order: AuthRow['verdict'][] = ['AUTH-BYPASS', 'FIXED-FLIP-ME', 'CONTROL-FAIL', 'HYPOTHESIS-FAIL', 'ERROR', 'OK', 'SKIP'];
  const sorted = [...res.rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
  const n = (v: AuthRow['verdict']): number => res.rows.filter(r => r.verdict === v).length;
  let out = '\n===== AUTHORIZATION MATRIX =====\n';
  out += `totals: AUTH-BYPASS=${n('AUTH-BYPASS')} FIXED-FLIP-ME=${n('FIXED-FLIP-ME')} CONTROL-FAIL=${n('CONTROL-FAIL')} `;
  out += `HYPOTHESIS-FAIL=${n('HYPOTHESIS-FAIL')} ERROR=${n('ERROR')} OK=${n('OK')} SKIP=${n('SKIP')} (of ${res.rows.length})\n`;
  out += '-------------------------------\n';
  for (const r of sorted) {
    out += `[${r.verdict.padEnd(15)}] ${r.id.padEnd(34)} ${r.mode.padEnd(20)} ${r.observed}${r.note ? `  {${r.note}}` : ''}\n`;
  }
  out += '===============================\n';
  return out;
}
