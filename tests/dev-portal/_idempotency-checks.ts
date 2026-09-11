import type { Page } from '@playwright/test';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { HomePage } from '../../pages/home/HomePage';
import { fireConsole } from './_helpers';
import type { NegFieldSpec } from './_negative-fields';

/**
 * Idempotency & retries matrix (item 4) — reuses the confirmed create-op
 * plumbing (`NegFieldSpec` base: `resolve` / `validBody` / `params` /
 * `identify` / `cleanup`) and layers three scenarios:
 *
 *  - `doubleCreate`      — send the SAME valid create body twice. Record both
 *    statuses + whether two distinct ids came back.
 *  - `deleteDeleted`     — create → delete → delete AGAIN. Record the 2nd status.
 *  - `updateNonexistent` — Update with a bogus/just-deleted id. Record the
 *    status. If the op is upsert-style and CREATES on the missing id (2xx), the
 *    phantom object is run through `base.identify` and added to cleanup so it
 *    does not leak.
 *
 * NOTHING about idempotency is CONFIRMED for these ops, so every expectation
 * is `hypothesis` — the matrix RECORDS what happens and only soft-flags the
 * shapes that are *likely* bugs:
 *   · a `5xx` on `deleteDeleted` / `updateNonexistent` (an NRE on a missing
 *     entity — the same class as BUG-negative-missing-field-500) → `STALE-5XX`;
 *   · a `2xx` on `updateNonexistent` (phantom write / silent no-op) → `PHANTOM-WRITE`.
 * Both are SOFT (`HYPOTHESIS-FAIL`-level) — first data points, not regressions.
 *
 * A `2xx` `doubleCreate` that yields a second distinct object is `DUP-SILENT`
 * (RECORDED — most REST creates allow duplicates; only flagged loud for the
 * ops declared `expectSecond: 'same-object'`).
 *
 * ⚠️ NOT RUN LIVE — `tests/dev-portal/UNVERIFIED.md`.
 */

export interface IdempScenarios {
  doubleCreate?: { expectSecond: 'new-object' | 'same-object' | 'reject' | 'unknown' };
  deleteDeleted?: { deleteMatch: RegExp; deleteGroup?: string; deleteParams: (created: Record<string, string>) => [string, string][] };
  updateNonexistent?: {
    updateMatch: RegExp; updateGroup?: string;
    /** build an Update body/params for a bogus id (the just-deleted id, or all-zero GUID). */
    body?: (bogusId: string, created: Record<string, string>) => unknown;
    params?: (bogusId: string, created: Record<string, string>) => [string, string][];
  };
}

export interface IdempSpec {
  base: NegFieldSpec;      // reuse its resolve / validBody / params / identify / cleanup
  scenarios: IdempScenarios;
  /** override the "bogus id" for updateNonexistent (default: the just-deleted control id, else all-zero GUID). */
  bogusId?: string;
}

export type IdempVerdict =
  | 'OK'
  | 'DUP-SILENT'
  | 'STALE-5XX'
  | 'PHANTOM-WRITE'
  | 'HYPOTHESIS-FAIL'
  | 'RECORDED'
  | 'CONTROL-FAIL'
  | 'ERROR';

export interface IdempRow {
  id: string;
  operation: string;
  scenario: string;
  observed: string;
  verdict: IdempVerdict;
  note?: string;
}

export interface IdempResult {
  rows: IdempRow[];
  leftovers: string[];
}

const ZERO_GUID = '00000000-0000-0000-0000-000000000000';
const is2xx = (s: number): boolean => s >= 200 && s < 300;
const is5xx = (s: number): boolean => s >= 500;
const is4xx = (s: number): boolean => s >= 400 && s < 500;
const short = (b: unknown): string => (typeof b === 'string' ? b : JSON.stringify(b ?? '')).slice(0, 120);

export async function runIdempotencyMatrix(opts: {
  page: Page;
  homePage: HomePage;
  specs: IdempSpec[];
}): Promise<IdempResult> {
  const { homePage, specs } = opts;
  const rows: IdempRow[] = [];
  const leftovers: string[] = [];
  const portal = await DeveloperPortalPage.openFrom(homePage);

  for (const { base, scenarios, bogusId } of specs) {
    const toClean: Record<string, string>[] = [];
    let resolved: Record<string, string> = {};
    try {
      resolved = base.resolve ? await base.resolve(portal) : {};
      const body = base.validBody(resolved);
      const params = base.params ? base.params(resolved) : undefined;

      // ── control: create #1 ────────────────────────────────────────────
      const c1 = await fireConsole(portal, base.group, base.match, { body, params });
      if (!is2xx(c1.status)) {
        rows.push({ id: base.id, operation: base.operation, scenario: '(control create)', observed: `→ ${c1.status} ${short(c1.body)}`, verdict: 'CONTROL-FAIL', note: 'the valid create did not succeed — scenarios not run' });
        continue;
      }
      const id1rec = base.identify?.(c1.body, resolved) ?? null;
      if (id1rec) toClean.push(id1rec);
      rows.push({ id: base.id, operation: base.operation, scenario: '(control create)', observed: `→ ${c1.status}`, verdict: 'OK' });

      // ── doubleCreate ─────────────────────────────────────────────────
      if (scenarios.doubleCreate) {
        try {
          const c2 = await fireConsole(portal, base.group, base.match, { body, params });
          const id2rec = is2xx(c2.status) ? base.identify?.(c2.body, resolved) ?? null : null;
          if (id2rec && JSON.stringify(id2rec) !== JSON.stringify(id1rec)) toClean.push(id2rec);
          const distinct = !!(id1rec && id2rec && JSON.stringify(id1rec) !== JSON.stringify(id2rec));
          const exp = scenarios.doubleCreate.expectSecond;

          let verdict: IdempVerdict = 'RECORDED';
          let note = `1st→${c1.status}, 2nd→${c2.status}, distinct id=${distinct}`;
          if (is5xx(c2.status)) { verdict = 'HYPOTHESIS-FAIL'; note += ' — 5xx on a repeat create'; }
          else if (is4xx(c2.status)) { verdict = exp === 'reject' ? 'OK' : 'RECORDED'; note += exp === 'reject' ? ' — dedup enforced (expected)' : ' — 2nd create rejected'; }
          else if (distinct) { verdict = exp === 'new-object' ? 'RECORDED' : exp === 'same-object' ? 'HYPOTHESIS-FAIL' : 'DUP-SILENT'; note += exp === 'same-object' ? ' — expected an UPSERT of the same object' : ' — a duplicate object was created'; }
          else { verdict = exp === 'same-object' ? 'OK' : 'RECORDED'; note += ' — 2nd create returned the SAME object'; }

          rows.push({ id: base.id, operation: base.operation, scenario: 'double-create (same body twice)', observed: `2nd → ${c2.status} ${short(c2.body)}`, verdict, note });
        } catch (err) {
          rows.push({ id: base.id, operation: base.operation, scenario: 'double-create', observed: `error: ${String(err)}`, verdict: 'ERROR' });
        }
      }

      // ── deleteDeleted ────────────────────────────────────────────────
      let deletedId: string | undefined;
      if (scenarios.deleteDeleted && id1rec) {
        try {
          const dp = scenarios.deleteDeleted.deleteParams(id1rec);
          const d1 = await fireConsole(portal, scenarios.deleteDeleted.deleteGroup ?? base.group, scenarios.deleteDeleted.deleteMatch, { params: dp });
          const d2 = await fireConsole(portal, scenarios.deleteDeleted.deleteGroup ?? base.group, scenarios.deleteDeleted.deleteMatch, { params: dp });
          deletedId = Object.values(id1rec)[0];
          // control object is now gone — drop it from cleanup
          const idx = toClean.findIndex(c => JSON.stringify(c) === JSON.stringify(id1rec));
          if (is2xx(d1.status) && idx >= 0) toClean.splice(idx, 1);

          let verdict: IdempVerdict = 'RECORDED';
          let note = `1st delete→${d1.status}, 2nd delete→${d2.status}`;
          if (is5xx(d2.status)) { verdict = 'STALE-5XX'; note += ' — 5xx deleting an already-deleted object (likely NRE, same class as BUG-negative-missing-field-500)'; }
          else if (d2.status === 404) { verdict = 'OK'; note += ' — 404 (correct)'; }
          else if (is2xx(d2.status)) { verdict = 'RECORDED'; note += ' — idempotent 2xx (acceptable, but verify it is not falsely reporting success)'; }
          else if (is4xx(d2.status)) { verdict = 'OK'; note += ` — ${d2.status} rejected`; }
          rows.push({ id: base.id, operation: base.operation, scenario: 'delete already-deleted', observed: `2nd delete → ${d2.status} ${short(d2.body)}`, verdict, note });
        } catch (err) {
          rows.push({ id: base.id, operation: base.operation, scenario: 'delete already-deleted', observed: `error: ${String(err)}`, verdict: 'ERROR' });
        }
      }

      // ── updateNonexistent ───────────────────────────────────────────
      if (scenarios.updateNonexistent) {
        try {
          const badId = bogusId ?? deletedId ?? ZERO_GUID;
          const u = scenarios.updateNonexistent;
          const res = await fireConsole(portal, u.updateGroup ?? base.group, u.updateMatch, {
            body: u.body ? u.body(badId, id1rec ?? {}) : undefined,
            params: u.params ? u.params(badId, id1rec ?? {}) : undefined,
          });
          let verdict: IdempVerdict = 'RECORDED';
          let note = `id=${badId} → ${res.status}`;
          if (is5xx(res.status)) { verdict = 'STALE-5XX'; note += ' — 5xx updating a nonexistent id (likely NRE)'; }
          else if (res.status === 404) { verdict = 'OK'; note += ' — 404 (correct)'; }
          else if (is2xx(res.status)) {
            verdict = 'PHANTOM-WRITE'; note += ' — 2xx updating a nonexistent id (phantom write / silent no-op)';
            // Upsert-style ops CREATE on a missing id instead of 404ing (e.g.
            // Upsert Alert Configuration). Capture the phantom object so the
            // `finally` cleanup deletes it instead of leaking it.
            const phantom = base.identify?.(res.body, resolved) ?? null;
            if (phantom && JSON.stringify(phantom) !== JSON.stringify(id1rec)) {
              toClean.push(phantom);
              note += ` — phantom object ${JSON.stringify(phantom)} captured for cleanup`;
            } else {
              note += ' — could NOT identify a phantom object (grep the throwaway name if one was created)';
            }
          }
          else if (is4xx(res.status)) { verdict = 'OK'; note += ` — ${res.status} rejected`; }
          rows.push({ id: base.id, operation: base.operation, scenario: 'update nonexistent id', observed: `→ ${res.status} ${short(res.body)}`, verdict, note });
        } catch (err) {
          rows.push({ id: base.id, operation: base.operation, scenario: 'update nonexistent id', observed: `error: ${String(err)}`, verdict: 'ERROR' });
        }
      }
    } catch (err) {
      rows.push({ id: base.id, operation: base.operation, scenario: '(spec)', observed: `error: ${String(err)}`, verdict: 'ERROR' });
    } finally {
      for (const c of toClean) {
        try {
          if (base.cleanup) await base.cleanup(portal, c, resolved);
          else leftovers.push(`${base.id}: ${JSON.stringify(c)}${base.cleanupCaveat ? ` (${base.cleanupCaveat})` : ''}`);
        } catch (err) {
          leftovers.push(`${base.id}: ${JSON.stringify(c)} — cleanup failed: ${String(err)}`);
        }
      }
    }
  }
  return { rows, leftovers };
}

export function renderIdempotencyMatrix(res: IdempResult): string {
  const order: IdempVerdict[] = ['STALE-5XX', 'PHANTOM-WRITE', 'DUP-SILENT', 'CONTROL-FAIL', 'HYPOTHESIS-FAIL', 'ERROR', 'RECORDED', 'OK'];
  const sorted = [...res.rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
  const n = (v: IdempVerdict): number => res.rows.filter(r => r.verdict === v).length;
  let out = '\n===== IDEMPOTENCY & RETRIES MATRIX =====\n';
  out += `totals: STALE-5XX=${n('STALE-5XX')} PHANTOM-WRITE=${n('PHANTOM-WRITE')} DUP-SILENT=${n('DUP-SILENT')} CONTROL-FAIL=${n('CONTROL-FAIL')} `;
  out += `HYPOTHESIS-FAIL=${n('HYPOTHESIS-FAIL')} ERROR=${n('ERROR')} RECORDED=${n('RECORDED')} OK=${n('OK')} (of ${res.rows.length})\n`;
  out += `leftovers (uncleaned): ${res.leftovers.length}\n`;
  for (const l of res.leftovers) out += `  ! ${l}\n`;
  out += '---------------------------------------\n';
  for (const r of sorted) {
    out += `[${r.verdict.padEnd(15)}] ${r.id.padEnd(38)} ${r.scenario.padEnd(30)} ${r.observed}${r.note ? `  {${r.note}}` : ''}\n`;
  }
  out += '=======================================\n';
  return out;
}
