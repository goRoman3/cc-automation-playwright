import type { Page } from '@playwright/test';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { HomePage } from '../../pages/home/HomePage';
import { fireConsole } from './_helpers';

/**
 * Shared **field-probe engine** for the request-body validation matrices,
 * mirroring `_cross-tenant.ts`.
 *
 * A *probe* mutates the confirmed-valid request in one way (omit a required
 * field; replace a field with a boundary value; …) and asserts the response.
 * Every matrix is: for each in-scope create-from-body op —
 *   0. CONTROL — send the full valid body → must succeed (without it a 400
 *      proves nothing).
 *   1. run each probe → verdict per the probe's declared `expect`.
 *   2. CLEANUP — the control (and any probe that unexpectedly created an
 *      object) is deleted in a per-spec `finally`.
 *
 * `runNegativeFieldMatrix` (missing-required-field) and `runBoundaryMatrix`
 * (empty / null / bad GUID / out-of-range / bad date) are thin wrappers that
 * generate probe lists and delegate to `runFieldProbeMatrix`.
 *
 * Expectations — CONFIRMED sources only; unknowns stay `hypothesis-*` /
 * `needs-schema-confirmation` and are recorded, never asserted.
 *
 * ⚠️ NOTHING here has been run live — `tests/dev-portal/UNVERIFIED.md`.
 */

export type FieldExpectation =
  | '400'                        // confirmed: probe → 400
  | 'known-bug-500'              // confirmed: probe → 500 instead of 400 (BUG-negative-missing-field-500). RED if it starts 400ing.
  | 'not-enforced'              // confirmed: probe → still succeeds (documented gap). RED if it becomes 400.
  | 'hypothesis-400'            // plausibly rejected, NEVER observed. Soft-flag a non-400; never hard-fail.
  | 'hypothesis-reject'        // as above but "any 4xx is fine" (message/status not pinned).
  | 'needs-schema-confirmation' // behaviour genuinely unknown. Recorded, NOT asserted.
  | 'special';                 // see probe.note

export type ParamPair = [string, string];

export interface FieldProbe {
  /** short label, e.g. "omit body:name", "boundary body:take=10000". */
  label: string;
  expect: FieldExpectation;
  note?: string;
  /** produce the mutated request from the valid body + params. */
  build: (full: Record<string, unknown>, params: ParamPair[] | undefined) => { body: unknown; params?: ParamPair[] };
}

export interface ProbeSpec {
  id: string;
  group: string;
  operation: string;
  match: RegExp;
  resolve?: (portal: DeveloperPortalPage) => Promise<Record<string, string>>;
  validBody: (r: Record<string, string>) => unknown;
  params?: (r: Record<string, string>) => ParamPair[];
  probes: FieldProbe[];
  identify?: (responseBody: unknown, resolved: Record<string, string>) => Record<string, string> | null;
  cleanup?: (portal: DeveloperPortalPage, created: Record<string, string>, resolved: Record<string, string>) => Promise<void>;
  cleanupCaveat?: string;
}

export type NegVerdict =
  | 'OK'
  | 'LEAK'
  | 'REGRESSION'
  | 'FIXED-FLIP-ME'
  | 'HYPOTHESIS-FAIL'
  | 'RECORDED'
  | 'CONTROL-FAIL'
  | 'ERROR'
  | 'SKIP';

export interface NegRow {
  id: string;
  group: string;
  operation: string;
  probe: string;                 // '(control)' for the control row
  expectation: FieldExpectation | 'control';
  observed: string;
  verdict: NegVerdict;
  note?: string;
}

export interface NegResult {
  rows: NegRow[];
  leftovers: string[];
}

// ── back-compat / catalog authoring types (missing-field matrix) ───────────

export interface RequiredField {
  name: string;
  in: 'body' | 'param';
  expect: FieldExpectation;
  note?: string;
}

/** `RequiredField[]` → omission probes. */
export function omissionProbes(fields: RequiredField[]): FieldProbe[] {
  return fields.map<FieldProbe>(f => ({
    label: `omit ${f.in}:${f.name}`,
    expect: f.expect,
    note: f.note,
    build: (full, params) => {
      if (f.in === 'body') {
        const p = { ...full };
        delete p[f.name];
        return { body: p, params };
      }
      return { body: full, params: (params ?? []).filter(([n]) => n !== f.name) };
    },
  }));
}

// ── engine ─────────────────────────────────────────────────────────────────

const is2xx = (s: number): boolean => s >= 200 && s < 300;
const is4xx = (s: number): boolean => s >= 400 && s < 500;
const short = (b: unknown): string => (typeof b === 'string' ? b : JSON.stringify(b ?? '')).slice(0, 160);

function probeVerdict(expect: FieldExpectation, note: string | undefined, status: number): { verdict: NegVerdict; note?: string } {
  switch (expect) {
    case '400':
      if (status === 400) return { verdict: 'OK' };
      if (is2xx(status)) return { verdict: 'LEAK', note: 'probe value was silently accepted — not validated' };
      return { verdict: 'REGRESSION', note: `expected 400, got ${status}` };
    case 'known-bug-500':
      if (status === 500) return { verdict: 'OK', note: 'KNOWN BUG still present (should be 400) — BUG-negative-missing-field-500' };
      if (status === 400) return { verdict: 'FIXED-FLIP-ME', note: "now 400 — bug fixed; change expect to '400'" };
      return { verdict: 'REGRESSION', note: `known-bug-500 probe now returns ${status}` };
    case 'not-enforced':
      if (is2xx(status)) return { verdict: 'OK', note: 'documented gap — still not enforced' };
      if (status === 400) return { verdict: 'FIXED-FLIP-ME', note: "now 400 — enforced; change expect to '400'" };
      return { verdict: 'RECORDED', note: `not-enforced probe returned ${status}` };
    case 'hypothesis-400':
      return status === 400
        ? { verdict: 'OK', note: 'HYPOTHESIS held (400) — first observation' }
        : { verdict: 'HYPOTHESIS-FAIL', note: `HYPOTHESIS was 400; got ${status} — first data point` };
    case 'hypothesis-reject':
      return is4xx(status)
        ? { verdict: 'OK', note: `HYPOTHESIS held (${status} rejected) — first observation` }
        : { verdict: 'HYPOTHESIS-FAIL', note: `HYPOTHESIS was a 4xx reject; got ${status} — first data point` };
    case 'needs-schema-confirmation':
      return { verdict: 'RECORDED', note: `behaviour unknown — probe returned ${status}` };
    case 'special':
      return { verdict: 'RECORDED', note };
  }
}

/**
 * Shared driver: per spec — control → probes → cleanup. One bad spec is
 * caught into `ERROR` rows and never aborts the rest. No site switching.
 */
export async function runFieldProbeMatrix(opts: {
  page: Page;
  homePage: HomePage;
  specs: ProbeSpec[];
}): Promise<NegResult> {
  const { homePage, specs } = opts;
  const rows: NegRow[] = [];
  const leftovers: string[] = [];
  const portal = await DeveloperPortalPage.openFrom(homePage);

  for (const spec of specs) {
    const created: Record<string, string>[] = [];
    let resolved: Record<string, string> = {};
    try {
      resolved = spec.resolve ? await spec.resolve(portal) : {};
      const full = spec.validBody(resolved) as Record<string, unknown>;
      const params = spec.params ? spec.params(resolved) : undefined;

      // 0. CONTROL
      const control = await fireConsole(portal, spec.group, spec.match, { body: full, params });
      if (!is2xx(control.status)) {
        rows.push({
          id: spec.id, group: spec.group, operation: spec.operation, probe: '(control)',
          expectation: 'control', observed: `full valid body → ${control.status} ${short(control.body)}`,
          verdict: 'CONTROL-FAIL', note: 'valid body did not succeed — probe rows below are not meaningful this run',
        });
        for (const p of spec.probes) {
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation, probe: p.label,
            expectation: p.expect, observed: 'not attempted — control failed', verdict: 'SKIP',
          });
        }
        continue;
      }
      rows.push({
        id: spec.id, group: spec.group, operation: spec.operation, probe: '(control)',
        expectation: 'control', observed: `full valid body → ${control.status}`, verdict: 'OK',
      });
      const ctlId = spec.identify?.(control.body, resolved) ?? null;
      if (ctlId) created.push(ctlId);

      // 1. probes
      for (const p of spec.probes) {
        try {
          const built = p.build(full, params);
          const res = await fireConsole(portal, spec.group, spec.match, { body: built.body, params: built.params ?? params });
          const { verdict, note } = probeVerdict(p.expect, p.note, res.status);
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation, probe: p.label,
            expectation: p.expect, observed: `${p.label} → ${res.status} ${short(res.body)}`, verdict,
            note: [note, p.note && p.note !== note ? p.note : ''].filter(Boolean).join(' | ') || undefined,
          });
          if (is2xx(res.status)) {
            const oid = spec.identify?.(res.body, resolved);
            if (oid) created.push(oid);
          }
        } catch (err) {
          rows.push({
            id: spec.id, group: spec.group, operation: spec.operation, probe: p.label,
            expectation: p.expect, observed: `error: ${String(err)}`, verdict: 'ERROR',
          });
        }
      }
    } catch (err) {
      rows.push({
        id: spec.id, group: spec.group, operation: spec.operation, probe: '(spec)',
        expectation: 'control', observed: `error: ${String(err)}`, verdict: 'ERROR',
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

export function renderProbeMatrix(res: NegResult, title: string): string {
  const order: NegVerdict[] = ['LEAK', 'REGRESSION', 'FIXED-FLIP-ME', 'CONTROL-FAIL', 'HYPOTHESIS-FAIL', 'ERROR', 'RECORDED', 'OK', 'SKIP'];
  const sorted = [...res.rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
  const n = (v: NegVerdict): number => res.rows.filter(r => r.verdict === v).length;
  let out = `\n===== ${title} =====\n`;
  out += `totals: LEAK=${n('LEAK')} REGRESSION=${n('REGRESSION')} FIXED-FLIP-ME=${n('FIXED-FLIP-ME')} CONTROL-FAIL=${n('CONTROL-FAIL')} `;
  out += `HYPOTHESIS-FAIL=${n('HYPOTHESIS-FAIL')} ERROR=${n('ERROR')} RECORDED=${n('RECORDED')} OK=${n('OK')} SKIP=${n('SKIP')} (of ${res.rows.length})\n`;
  out += `leftovers (uncleaned): ${res.leftovers.length}\n`;
  for (const l of res.leftovers) out += `  ! ${l}\n`;
  out += '------------------------------------------\n';
  for (const r of sorted) {
    out += `[${r.verdict.padEnd(15)}] ${r.id.padEnd(38)} ${r.probe.padEnd(28)} ${r.observed}${r.note ? `  {${r.note}}` : ''}\n`;
  }
  out += '==========================================\n';
  return out;
}

// ── back-compat wrappers ───────────────────────────────────────────────────

export interface NegFieldSpec extends Omit<ProbeSpec, 'probes'> {
  requiredFields: RequiredField[];
}

/** Missing-required-field matrix — omission probes over each spec's `requiredFields`. */
export async function runNegativeFieldMatrix(opts: {
  page: Page;
  homePage: HomePage;
  specs: NegFieldSpec[];
}): Promise<NegResult> {
  const probeSpecs: ProbeSpec[] = opts.specs.map(s => ({ ...s, probes: omissionProbes(s.requiredFields) }));
  return runFieldProbeMatrix({ page: opts.page, homePage: opts.homePage, specs: probeSpecs });
}

/** kept for the existing negative spec import. */
export const renderNegMatrix = (res: NegResult): string => renderProbeMatrix(res, 'NEGATIVE-REQUIRED-FIELDS MATRIX');

// ── boundary-values matrix (item 1) ───────────────────────────────────────────

/**
 * Boundary mutations applied to a single field of the confirmed-valid body.
 * The *value* is derived from `kind` (see `BOUNDARY_VALUE`) unless `value` is
 * given explicitly — e.g. a specific malformed IP or a longer over-limit
 * string.
 */
export type BoundaryKind =
  | 'empty-string'      // ''            — present but blank
  | 'whitespace'        // '   '         — blank after trim
  | 'null'              // null          — JSON null in a non-nullable slot
  | 'bad-guid'          // 'not-a-guid'  — malformed GUID string
  | 'zero-guid'         // 00000000-…    — the all-zero GUID ("no object")
  | 'out-of-range'      // 999999        — past a plausible server max
  | 'negative'          // -1            — negative where >=0 is expected
  | 'wrong-type'        // 'not-a-number'/string for an int/array/bool slot
  | 'bad-format'        // 'AQA-neg_1.'  — chars a name validator rejects
  | 'bad-date'          // '2026-13-45T99:99:99Z' — unparseable date
  | 'bad-json'          // 'not json'    — malformed JSON in a JSON-string slot
  | 'empty-json-array'; // '[]'          — structurally valid, semantically empty

export interface BoundaryField {
  name: string;
  in: 'body' | 'param';
  kind: BoundaryKind;
  /** override the derived value (e.g. a specific malformed IP). */
  value?: unknown;
  expect: FieldExpectation;
  note?: string;
}

const BOUNDARY_VALUE: Record<BoundaryKind, unknown> = {
  'empty-string': '',
  whitespace: '   ',
  null: null,
  'bad-guid': 'not-a-guid',
  'zero-guid': '00000000-0000-0000-0000-000000000000',
  'out-of-range': 999999,
  negative: -1,
  'wrong-type': 'not-a-number',
  'bad-format': 'AQA-neg_1.',
  'bad-date': '2026-13-45T99:99:99Z',
  'bad-json': 'not json',
  'empty-json-array': '[]',
};

/** `BoundaryField[]` → one probe per field: swap that field for the boundary value. */
export function boundaryProbes(fields: BoundaryField[]): FieldProbe[] {
  return fields.map<FieldProbe>(f => {
    const v = f.value !== undefined ? f.value : BOUNDARY_VALUE[f.kind];
    return {
      label: `${f.in}:${f.name}=${f.kind}`,
      expect: f.expect,
      note: f.note,
      build: (full, params) => {
        if (f.in === 'body') {
          return { body: { ...full, [f.name]: v }, params };
        }
        return {
          body: full,
          params: (params ?? []).map(([n, val]): ParamPair => (n === f.name ? [n, String(v)] : [n, val])),
        };
      },
    };
  });
}

export interface BoundarySpec extends Omit<ProbeSpec, 'probes'> {
  boundaryFields: BoundaryField[];
}

/** Boundary-values matrix — `empty / null / bad GUID / out-of-range / bad format` probes per spec. */
export async function runBoundaryMatrix(opts: {
  page: Page;
  homePage: HomePage;
  specs: BoundarySpec[];
}): Promise<NegResult> {
  const probeSpecs: ProbeSpec[] = opts.specs.map(s => ({ ...s, probes: boundaryProbes(s.boundaryFields) }));
  return runFieldProbeMatrix({ page: opts.page, homePage: opts.homePage, specs: probeSpecs });
}

export const renderBoundaryMatrix = (res: NegResult): string => renderProbeMatrix(res, 'BOUNDARY-VALUES MATRIX');
