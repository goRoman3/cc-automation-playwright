import type { Page } from '@playwright/test';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { HomePage } from '../../pages/home/HomePage';
import { fireConsole } from './_helpers';

/**
 * Response-contract matrix (item 2) — same declarative shape as the
 * negative / boundary matrices.
 *
 * For each in-scope op: invoke it with its confirmed-VALID request (that
 * invocation IS the control — a contract check needs a real 2xx response to
 * inspect), then run a list of structural / type assertions against the
 * response body.
 *
 * Assertion `expect`:
 *  - `'ok'`      — this holds in a correct response. FAIL → `CONTRACT-VIOLATION`
 *                  (a real, previously-unseen contract break — hard fail).
 *  - `'known-bug'` — the check describes the CORRECT contract, which is
 *                  currently VIOLATED (a CONFIRMED bug). So: check FAILS →
 *                  `OK` (bug still present, as documented); check PASSES →
 *                  `FIXED-FLIP-ME` (bug fixed — flip `expect` to `'ok'`).
 *                  This is how the two confirmed bugs of this class are pinned:
 *                    · Get/List Agent `customerId` = all-zero GUID (CONTRACT-AGENT-CUSTOMERID)
 *                    · Create Agent Group response `id` = 0 (P1-CREATE-AGENT-GROUP-ID-ZERO)
 *  - `'hypothesis'` — structure/type is *likely* but never actually verified.
 *                  FAIL → `HYPOTHESIS-FAIL` (soft).
 *  - `'needs-schema-confirmation'` — genuinely unknown. Logged, never asserted.
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

export type CheckKind =
  | 'present'          // key exists (not undefined)
  | 'string'
  | 'non-empty-string'
  | 'number'
  | 'positive-int'
  | 'boolean'
  | 'array'
  | 'non-empty-array'
  | 'guid'             // any GUID shape, incl. all-zero
  | 'non-zero-guid'    // GUID shape AND not 00000000-0000-0000-0000-000000000000
  | 'iso-date-ish';

export type ContractExpect = 'ok' | 'known-bug' | 'hypothesis' | 'needs-schema-confirmation';

export interface ContractAssertion {
  /**
   * dotted path into the response body. A leading `[].` means "the response
   * is an array — apply to every element". `''` = the whole body (e.g. a bare
   * string / GUID response).
   */
  path: string;
  check: CheckKind;
  expect: ContractExpect;
  note?: string;
}

export interface ContractSpec {
  id: string;
  group: string;
  operation: string;
  match: RegExp;
  resolve?: (portal: DeveloperPortalPage) => Promise<Record<string, string>>;
  body?: (r: Record<string, string>) => unknown;        // omit → plain GET
  params?: (r: Record<string, string>) => [string, string][];
  assertions: ContractAssertion[];
  identify?: (responseBody: unknown, resolved: Record<string, string>) => Record<string, string> | null;
  cleanup?: (portal: DeveloperPortalPage, created: Record<string, string>, resolved: Record<string, string>) => Promise<void>;
  cleanupCaveat?: string;
}

export type ContractVerdict =
  | 'OK'
  | 'CONTRACT-VIOLATION'
  | 'FIXED-FLIP-ME'
  | 'HYPOTHESIS-FAIL'
  | 'RECORDED'
  | 'CONTROL-FAIL'
  | 'ERROR';

export interface ContractRow {
  id: string;
  group: string;
  operation: string;
  assertion: string;          // '(invoke)' for the control row
  expect: ContractExpect | 'control';
  observed: string;
  verdict: ContractVerdict;
  note?: string;
}

export interface ContractResult {
  rows: ContractRow[];
  leftovers: string[];
}

// ── value checks ───────────────────────────────────────────────────────────

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZERO_GUID = '00000000-0000-0000-0000-000000000000';

function checkValue(kind: CheckKind, v: unknown): boolean {
  switch (kind) {
    case 'present': return v !== undefined;
    case 'string': return typeof v === 'string';
    case 'non-empty-string': return typeof v === 'string' && v.length > 0;
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'positive-int': return typeof v === 'number' && Number.isInteger(v) && v > 0;
    case 'boolean': return typeof v === 'boolean';
    case 'array': return Array.isArray(v);
    case 'non-empty-array': return Array.isArray(v) && v.length > 0;
    case 'guid': return typeof v === 'string' && GUID_RE.test(v);
    case 'non-zero-guid': return typeof v === 'string' && GUID_RE.test(v) && v.toLowerCase() !== ZERO_GUID;
    case 'iso-date-ish': return typeof v === 'string' && !Number.isNaN(Date.parse(v));
  }
}

/** Resolve a dotted path; `[].rest` → array of resolved values (one per element). */
function resolvePath(body: unknown, path: string): { values: unknown[]; isArrayPath: boolean } {
  if (path === '') return { values: [body], isArrayPath: false };
  if (path.startsWith('[].')) {
    const rest = path.slice(3);
    const arr = Array.isArray(body) ? body : ((body as { data?: unknown[] })?.data ?? []);
    return { values: (arr as unknown[]).map(el => dotted(el, rest)), isArrayPath: true };
  }
  return { values: [dotted(body, path)], isArrayPath: false };
}
function dotted(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

// ── engine ─────────────────────────────────────────────────────────────────

const is2xx = (s: number): boolean => s >= 200 && s < 300;
const short = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v ?? '')).slice(0, 120);

function assertionVerdict(
  a: ContractAssertion, values: unknown[], isArrayPath: boolean,
): { verdict: ContractVerdict; observed: string; note?: string } {
  if (isArrayPath && values.length === 0) {
    return { verdict: a.expect === 'needs-schema-confirmation' ? 'RECORDED' : 'ERROR', observed: 'array response was empty — nothing to check' };
  }
  const results = values.map(v => ({ v, ok: checkValue(a.check, v) }));
  const allOk = results.every(r => r.ok);
  const sample = results.slice(0, 3).map(r => `${short(r.v)}${r.ok ? '' : ' ✗'}`).join(', ');
  const obs = `${a.path || '(body)'} [${a.check}] → ${sample}${values.length > 3 ? ` …(${values.length})` : ''}`;

  switch (a.expect) {
    case 'ok':
      return allOk ? { verdict: 'OK', observed: obs } : { verdict: 'CONTRACT-VIOLATION', observed: obs, note: 'a documented-correct contract assertion FAILED' };
    case 'known-bug':
      return allOk
        ? { verdict: 'FIXED-FLIP-ME', observed: obs, note: "the check now PASSES — the bug is fixed; change expect to 'ok'" }
        : { verdict: 'OK', observed: obs, note: 'KNOWN BUG still present (the correct contract is still violated)' };
    case 'hypothesis':
      return allOk ? { verdict: 'OK', observed: obs, note: 'HYPOTHESIS held — first verification' } : { verdict: 'HYPOTHESIS-FAIL', observed: obs, note: 'structure/type guess did not hold — first data point' };
    case 'needs-schema-confirmation':
      return { verdict: 'RECORDED', observed: `${obs}  (check ${allOk ? 'passed' : 'failed'} — not asserted)` };
  }
}

export async function runContractMatrix(opts: {
  page: Page;
  homePage: HomePage;
  specs: ContractSpec[];
}): Promise<ContractResult> {
  const { homePage, specs } = opts;
  const rows: ContractRow[] = [];
  const leftovers: string[] = [];
  const portal = await DeveloperPortalPage.openFrom(homePage);

  for (const spec of specs) {
    const created: Record<string, string>[] = [];
    let resolved: Record<string, string> = {};
    try {
      resolved = spec.resolve ? await spec.resolve(portal) : {};
      const body = spec.body ? spec.body(resolved) : undefined;
      const params = spec.params ? spec.params(resolved) : undefined;

      const res = await fireConsole(portal, spec.group, spec.match, { body, params });
      if (!is2xx(res.status)) {
        rows.push({
          id: spec.id, group: spec.group, operation: spec.operation, assertion: '(invoke)',
          expect: 'control', observed: `valid request → ${res.status} ${short(res.body)}`,
          verdict: 'CONTROL-FAIL', note: 'could not get a 2xx response — contract assertions not evaluated',
        });
        for (const a of spec.assertions) {
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation, assertion: `${a.path || '(body)'} [${a.check}]`,
            expect: a.expect, observed: 'not evaluated — invoke failed', verdict: 'ERROR',
          });
        }
        continue;
      }
      rows.push({
        id: spec.id, group: spec.group, operation: spec.operation, assertion: '(invoke)',
        expect: 'control', observed: `valid request → ${res.status}`, verdict: 'OK',
      });
      const cid = spec.identify?.(res.body, resolved) ?? null;
      if (cid) created.push(cid);

      for (const a of spec.assertions) {
        try {
          const { values, isArrayPath } = resolvePath(res.body, a.path);
          const { verdict, observed, note } = assertionVerdict(a, values, isArrayPath);
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation,
            assertion: `${a.path || '(body)'} [${a.check}]`, expect: a.expect, observed, verdict,
            note: [note, a.note].filter(Boolean).join(' | ') || undefined,
          });
        } catch (err) {
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation,
            assertion: `${a.path || '(body)'} [${a.check}]`, expect: a.expect,
            observed: `error: ${String(err)}`, verdict: 'ERROR',
          });
        }
      }
    } catch (err) {
      rows.push({
        id: spec.id, group: spec.group, operation: spec.operation, assertion: '(spec)',
        expect: 'control', observed: `error: ${String(err)}`, verdict: 'ERROR',
      });
    } finally {
      for (const c of created) {
        try {
          if (spec.cleanup) await spec.cleanup(portal, c, resolved);
          else leftovers.push(`${spec.id}: ${JSON.stringify(c)}${spec.cleanupCaveat ? ` (${spec.cleanupCaveat})` : ''}`);
        } catch (err) {
          leftovers.push(`${spec.id}: ${JSON.stringify(c)} — cleanup failed: ${String(err)}`);
        }
      }
    }
  }
  return { rows, leftovers };
}

export function renderContractMatrix(res: ContractResult): string {
  const order: ContractVerdict[] = ['CONTRACT-VIOLATION', 'FIXED-FLIP-ME', 'CONTROL-FAIL', 'HYPOTHESIS-FAIL', 'ERROR', 'RECORDED', 'OK'];
  const sorted = [...res.rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
  const n = (v: ContractVerdict): number => res.rows.filter(r => r.verdict === v).length;
  let out = '\n===== RESPONSE-CONTRACT MATRIX =====\n';
  out += `totals: CONTRACT-VIOLATION=${n('CONTRACT-VIOLATION')} FIXED-FLIP-ME=${n('FIXED-FLIP-ME')} CONTROL-FAIL=${n('CONTROL-FAIL')} `;
  out += `HYPOTHESIS-FAIL=${n('HYPOTHESIS-FAIL')} ERROR=${n('ERROR')} RECORDED=${n('RECORDED')} OK=${n('OK')} (of ${res.rows.length})\n`;
  out += `leftovers (uncleaned): ${res.leftovers.length}\n`;
  for (const l of res.leftovers) out += `  ! ${l}\n`;
  out += '-----------------------------------\n';
  for (const r of sorted) {
    out += `[${r.verdict.padEnd(18)}] ${r.id.padEnd(34)} ${r.assertion.padEnd(34)} ${r.observed}${r.note ? `  {${r.note}}` : ''}\n`;
  }
  out += '===================================\n';
  return out;
}
