import type { Page } from '@playwright/test';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import type { HomePage } from '../../pages/home/HomePage';
import { ApiManagementSettingsPage } from '../../pages/dev-portal/ApiManagementSettingsPage';
import { API_KEY_OPTION, STAGING_APP_URL, currentKeySite, fireConsole } from './_helpers';

/**
 * Cross-tenant (per-site) isolation — shared engine + types.
 *
 * Two canonical patterns, one declarative catalog (`cross-tenant-catalog.ts`),
 * driven by `cross-tenant-matrix.spec.ts`:
 *
 *   A. READ isolation  — key on site 1 → run a read, snapshot a NORMALISED
 *      result → switch key to site 2 → run the same read → diff.
 *      A byte-identical result where the data *should* be site-scoped =
 *      suspected scoping gap. Optional pointed probe: an object found under
 *      site 1, re-fetched by id from site 2.
 *
 *   B. WRITE isolation — pin an object under site 1 (id) → switch key to
 *      site 2 → attempt to change / add / delete THAT object from site 2 →
 *      expect `400 "Configured site does not contain…"` → switch back to
 *      site 1 and confirm the object is untouched → clean up.
 *
 * The site switch (Settings > API Management > edit key > Save) is the slow,
 * environment-poisoning step — so the engine switches **once per pattern**
 * and iterates the whole table inside that A→B→back window, catching per-op
 * errors into the matrix instead of aborting. `_helpers.ts` owns the live
 * site read (`currentKeySite`) and `pages/dev-portal/ApiManagementSettingsPage`
 * owns the switch itself.
 *
 * ⚠️ NOTHING in this system has been run live — see `tests/dev-portal/UNVERIFIED.md`.
 */

/** Where each of the ~127 catalogue operations sits relative to the two patterns. */
export type OpClass =
  /** safe read — Pattern A applies. */
  | 'read'
  /** mutating, has (or can create) a disposable / no-op-safe target — Pattern B applies. */
  | 'write'
  /** mutating, irreversible on real data with no disposable fixture — Pattern B NOT run (skip). */
  | 'destructive'
  /** cannot be driven at all right now (upstream 500, missing id, console stuck) — skip. */
  | 'blocked'
  /** neither pattern applies (customer-level object with no per-site dimension). */
  | 'n/a';

/**
 * What a byte-identical READ result across the site switch means for this op.
 *  - `must-differ`   → identical = FAIL (a real scoping regression).
 *  - `known-global`  → identical is correct (customer-level / reference data); logged only.
 *  - `triage`        → identical is a SUSPECTED gap or a documented-but-unfixed gap;
 *                      logged + flagged for product triage, never asserted either way.
 *  - `hypothesis`    → the expected direction was never actually observed; the
 *                      engine records what happens and soft-asserts the guess so
 *                      the first live run shows it explicitly (see Restricted User).
 */
export type ReadExpectation = 'must-differ' | 'known-global' | 'triage' | 'hypothesis';

/** Site identity as read live from `Get Sites Storage Usage` / `currentKeySite`. */
export interface SiteRef {
  id: string;
  name: string;
}

/** Carried through both phases of a pattern run. */
export interface SwitchContext {
  siteA: SiteRef;
  siteB: SiteRef;
}

/** A resolver runs UNDER SITE A before the read/write leg and yields ids for the body/params builders. */
export type Resolver = (portal: DeveloperPortalPage) => Promise<Record<string, string>>;

export interface ReadPlan {
  /** Run under site A first; its return is passed to `body`/`params`/`byId`. */
  resolve?: Resolver;
  body?: unknown | ((r: Record<string, string>) => unknown);
  params?: (r: Record<string, string>) => [string, string][];
  /** Turn a raw response into a small comparable shape. Default: `{count, ids[]}`. */
  normalize?: (body: unknown) => unknown;
  /** Pointed probe: pull one object id out of the site-A result, re-fetch it from site B. */
  byId?: {
    pick: (siteAResult: unknown) => string | null;
    group?: string;
    operation: RegExp;
    /** query/path param name the id goes into. */
    param: string;
  };
  expectation: ReadExpectation;
}

export interface WritePlan {
  /**
   * Phase A — obtain the target object under site A.
   *  - `discover`: find an existing suitable object (returns its identity fields).
   *  - `create`:   make a disposable one (preferred); `remove` cleans it up in Phase C.
   */
  fixture:
    | { mode: 'discover'; run: (portal: DeveloperPortalPage) => Promise<Record<string, string>> }
    | {
        mode: 'create';
        run: (portal: DeveloperPortalPage, siteAId: string) => Promise<Record<string, string>>;
        remove: (portal: DeveloperPortalPage, f: Record<string, string>) => Promise<void>;
      };
  /** Phase B — the cross-site mutation attempt (from site B, targeting the site-A object). */
  attempt: {
    verb: 'add' | 'update' | 'delete';
    group?: string;
    operation: RegExp;
    body?: (f: Record<string, string>, siteAId: string) => unknown;
    params?: (f: Record<string, string>, siteAId: string) => [string, string][];
  };
  /** Phase C — confirm the site-A object survived the cross-site attempt unchanged. */
  verifyIntact?: (portal: DeveloperPortalPage, f: Record<string, string>) => Promise<{ ok: boolean; detail: string }>;
  /** true when a leak (2xx instead of reject) would have destroyed / moved real data. */
  destructiveIfLeaked?: boolean;
  /**
   *  - `must-reject` (default) — a 2xx cross-site is a LEAK (a real isolation bug).
   *  - `hypothesis`  — the rejection has never actually been observed; record the
   *    status, soft-flag a 2xx as HYPOTHESIS-FAIL, don't hard-fail. (Restricted User.)
   */
  expectation?: 'must-reject' | 'hypothesis';
  /**
   * What a 2xx cross-site means when the object's site-scoping itself is
   * unconfirmed: `leak` (default) or `suspected` (log for triage, don't fail).
   */
  onSuccess?: 'leak' | 'suspected';
}

/** One row of the ~127-operation catalogue. */
export interface CatalogEntry {
  /** stable kebab id used in the matrix + npm grep, e.g. "agent-mgmt/get-agent". */
  id: string;
  group: string;
  /** display name as it appears in the Try-it catalogue. */
  operation: string;
  /** `openOperation()` matcher (what the existing `*-api.spec.ts` use, where one exists). */
  match: RegExp;
  cls: OpClass;
  /** where the object id comes from (human note; also guides `resolve`). */
  idSource?: string;
  /** how a created object is cleaned up (human note; also guides `fixture.remove`). */
  cleanup?: string;
  /** why `blocked` / `destructive` / `n/a`, or any caveat for `read`/`write`. */
  reason?: string;
  /** confirmed source of the payload/steps: ADO case #, evidence report, or existing spec. */
  source?: string;
  /** filled in `cross-tenant-matrix.spec.ts` (batch 3) for `cls: 'read'`. */
  read?: ReadPlan;
  /** filled in `cross-tenant-matrix.spec.ts` (batch 4) for `cls: 'write'`. */
  write?: WritePlan;
}

/** One result row emitted by the engine per attempted operation. */
export interface MatrixRow {
  id: string;
  group: string;
  operation: string;
  pattern: 'read' | 'write' | 'skip';
  /** raw outcome — HTTP status(es), diff result, error text. */
  observed: string;
  /** engine verdict: OK | LEAK | SUSPECTED | HYPOTHESIS-FAIL | ERROR | SKIP. */
  verdict: 'OK' | 'LEAK' | 'SUSPECTED' | 'HYPOTHESIS-FAIL' | 'ERROR' | 'SKIP';
  note?: string;
}

// ── default normalisation ───────────────────────────────────────────────────

/** `{count, ids[]}` from an array response or `{data:[…]}` wrapper — the default READ normaliser. */
export function normDefault(body: unknown): { count: number; ids: string[] } {
  const rows = Array.isArray(body) ? body : ((body as { data?: unknown[] })?.data ?? []);
  const ids = (rows as Array<Record<string, unknown>>)
    .map(r => String(
      r.id ?? r.Id ?? r.ID ?? r.userId ?? r.notificationId ?? r.templateId ?? r.siteId ?? r.siteID
      ?? JSON.stringify(r).slice(0, 60),
    ))
    .sort();
  return { count: ids.length, ids: ids.slice(0, 50) };
}

/** Stable string for the byte-identical check (order-independent for arrays of objects). */
export function bodyFingerprint(body: unknown): string {
  try {
    if (Array.isArray(body)) {
      return JSON.stringify(body.map(x => JSON.stringify(x)).sort());
    }
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/** A 2xx status. Anything else counts as "rejected" for WRITE isolation. */
export function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

/** The canonical cross-site rejection: `400` + the site-scoping message. */
export function isSiteScopedRejection(status: number, body: unknown): boolean {
  if (status !== 400) return false;
  const s = typeof body === 'string' ? body : JSON.stringify(body ?? '');
  return /configured site does not contain/i.test(s);
}

// ── engine ─────────────────────────────────────────────────────────────────

const KEY_NAME = API_KEY_OPTION.split(': ')[1]; // "API_test"

/** Invoke one operation with a plan's body/params (body === undefined → plain GET). */
async function invoke(
  portal: DeveloperPortalPage, group: string, match: RegExp,
  built: { body?: unknown; params?: [string, string][] },
): Promise<{ status: number; body: unknown }> {
  // fireConsole: body === undefined → plain send() (the old fireGet); a defined
  // body → sendJson() with the schema-blind fallback (the old fireJson).
  return fireConsole(portal, group, match, { body: built.body, params: built.params ?? [] });
}

function buildRead(plan: ReadPlan, resolved: Record<string, string>): { body?: unknown; params?: [string, string][] } {
  const body = typeof plan.body === 'function'
    ? (plan.body as (r: Record<string, string>) => unknown)(resolved)
    : plan.body;
  const params = plan.params ? plan.params(resolved) : undefined;
  return { body, params };
}

interface ReadBaseline {
  error?: string;
  status: number;
  norm: unknown;
  fp: string;
  resolved: Record<string, string>;
  byIdPickedId: string | null;
}

interface WriteFixtureState {
  error?: string;
  mode: 'discover' | 'create';
  fixture: Record<string, string>;
}

export interface MatrixResult {
  siteA: SiteRef;
  siteB: SiteRef | null;
  switchFrom: string;
  switchTo: string;
  switchThrew: string | null;
  restoredToSiteA: boolean;
  rows: MatrixRow[];
}

/**
 * Runs BOTH patterns over `entries` inside a single site switch A→B→back-to-A.
 *
 * `entries` should be the catalogue (or a subset). `read`-class entries need
 * `entry.read`; `write`-class need `entry.write`; any entry missing its plan,
 * or of class `blocked`/`destructive`/`n/a`, is emitted as a `SKIP` row (so
 * the matrix always accounts for all 127).
 *
 * Per-operation failures are caught into `ERROR` rows — one bad op never
 * aborts the sweep. The only throw is a precondition failure (can't read
 * site A) or a switch failure that also can't be restored.
 */
export async function runCrossTenantMatrix(opts: {
  page: Page;
  homePage: HomePage;
  entries: CatalogEntry[];
}): Promise<MatrixResult> {
  const { page, homePage, entries } = opts;
  const rows: MatrixRow[] = [];

  const reads = entries.filter(e => e.cls === 'read' && e.read);
  const writes = entries.filter(e => e.cls === 'write' && e.write);

  // Everything the sweep won't drive → explicit SKIP rows.
  for (const e of entries) {
    const driven = (e.cls === 'read' && e.read) || (e.cls === 'write' && e.write);
    if (driven) continue;
    rows.push({
      id: e.id, group: e.group, operation: e.operation, pattern: 'skip',
      observed: e.cls, verdict: 'SKIP',
      note: e.reason ?? (e.cls === 'read' || e.cls === 'write' ? 'no executable plan attached' : e.cls),
    });
  }

  let portal = await DeveloperPortalPage.openFrom(homePage);
  const siteA = await currentKeySite(portal);
  if (!siteA.id || !siteA.name) {
    throw new Error('cross-tenant matrix: could not read the key\'s current site (precondition) — is the key mid-switch?');
  }
  const siteARef: SiteRef = { id: siteA.id, name: siteA.name };

  // ── PHASE A — baselines + fixtures under site A ──────────────────────────
  const readBaselines = new Map<string, ReadBaseline>();
  for (const e of reads) {
    try {
      const resolved = e.read!.resolve ? await e.read!.resolve(portal) : {};
      const built = buildRead(e.read!, resolved);
      const res = await invoke(portal, e.group, e.match, built);
      const norm = (e.read!.normalize ?? normDefault)(res.body);
      const byIdPickedId = e.read!.byId ? e.read!.byId.pick(res.body) : null;
      readBaselines.set(e.id, {
        status: res.status, norm, fp: bodyFingerprint(res.body), resolved, byIdPickedId,
      });
    } catch (err) {
      readBaselines.set(e.id, { error: String(err), status: -1, norm: null, fp: '', resolved: {}, byIdPickedId: null });
    }
  }

  const writeFixtures = new Map<string, WriteFixtureState>();
  for (const e of writes) {
    try {
      const fx = e.write!.fixture;
      const fixture = fx.mode === 'create' ? await fx.run(portal, siteARef.id) : await fx.run(portal);
      writeFixtures.set(e.id, { mode: fx.mode, fixture });
    } catch (err) {
      writeFixtures.set(e.id, { mode: e.write!.fixture.mode, fixture: {}, error: String(err) });
    }
  }

  // ── SWITCH A → B ────────────────────────────────────────────────────────
  let switchThrew: string | null = null;
  let switchFrom = ''; let switchTo = '';
  let siteBRef: SiteRef | null = null;
  try {
    const settings = new ApiManagementSettingsPage(page);
    await settings.goto();
    const r = await settings.switchKeyToRandomDifferentSite(KEY_NAME);
    switchFrom = r.from; switchTo = r.to;
    await page.goto(`${STAGING_APP_URL}Home`);
    portal = await DeveloperPortalPage.openFrom(homePage);
    const b = await currentKeySite(portal);
    if (!b.id || b.id === siteARef.id) {
      throw new Error(`site switch did not take effect (siteB=${JSON.stringify(b)})`);
    }
    siteBRef = { id: b.id, name: b.name ?? '(unnamed)' };
  } catch (err) {
    switchThrew = String(err);
  }

  // ── PHASE B — cross-site legs under site B ──────────────────────────────
  if (!switchThrew && siteBRef) {
    const ctx: SwitchContext = { siteA: siteARef, siteB: siteBRef };

    for (const e of reads) {
      const base = readBaselines.get(e.id)!;
      if (base.error) {
        rows.push(readRow(e, 'ERROR', `site-A leg failed: ${base.error}`));
        continue;
      }
      try {
        const built = buildRead(e.read!, base.resolved);
        const res = await invoke(portal, e.group, e.match, built);
        const changed = bodyFingerprint(res.body) !== base.fp;
        const normB = (e.read!.normalize ?? normDefault)(res.body);

        let byId = '';
        if (e.read!.byId && base.byIdPickedId) {
          try {
            const p = await fireConsole(portal, e.read!.byId.group ?? e.group, e.read!.byId.operation, { params: [[e.read!.byId.param, base.byIdPickedId]] });
            byId = ` | byId(${base.byIdPickedId.slice(0, 8)}…)=${p.status}`;
          } catch (err) {
            byId = ` | byId=ERR:${String(err).slice(0, 60)}`;
          }
        }

        const obs = `A:${base.status}/${JSON.stringify(base.norm)} → B:${res.status}/${JSON.stringify(normB)} | changed=${changed}${byId}`;
        rows.push(verdictForRead(e, changed, res.status, byId, obs));
      } catch (err) {
        rows.push(readRow(e, 'ERROR', `site-B leg failed: ${String(err)}`));
      }
    }

    for (const e of writes) {
      const state = writeFixtures.get(e.id)!;
      if (state.error || Object.keys(state.fixture).length === 0) {
        rows.push(writeRow(e, 'ERROR', `no site-A fixture: ${state.error ?? 'empty'}`));
        continue;
      }
      try {
        const a = e.write!.attempt;
        const body = a.body ? a.body(state.fixture, siteARef.id) : undefined;
        const params = a.params ? a.params(state.fixture, siteARef.id) : undefined;
        const res = await invoke(portal, a.group ?? e.group, a.operation, { body, params });
        rows.push(verdictForWrite(e, res.status, res.body, ctx));
      } catch (err) {
        rows.push(writeRow(e, 'ERROR', `cross-site attempt failed: ${String(err)}`));
      }
    }
  } else {
    for (const e of [...reads, ...writes]) {
      rows.push({
        id: e.id, group: e.group, operation: e.operation,
        pattern: e.cls === 'read' ? 'read' : 'write',
        observed: `switch failed: ${switchThrew}`, verdict: 'ERROR', note: 'site switch never took effect',
      });
    }
  }

  // ── SWITCH BACK B → A + PHASE C (verifyIntact + cleanup) ────────────────
  let switchBackThrew: string | null = null;
  if (!switchThrew) {
    try {
      const settings = new ApiManagementSettingsPage(page);
      await settings.goto();
      await settings.switchKeyToSite(KEY_NAME, siteARef.name);
      await page.goto(`${STAGING_APP_URL}Home`);
      portal = await DeveloperPortalPage.openFrom(homePage);
    } catch (err) {
      switchBackThrew = String(err);
    }
  }

  if (!switchThrew && !switchBackThrew) {
    for (const e of writes) {
      const state = writeFixtures.get(e.id);
      if (!state || state.error || Object.keys(state.fixture).length === 0) continue;
      // verifyIntact
      if (e.write!.verifyIntact) {
        try {
          const v = await e.write!.verifyIntact(portal, state.fixture);
          const row = rows.find(r => r.id === e.id && r.pattern === 'write');
          if (row) row.note = `${row.note ? row.note + ' | ' : ''}intact=${v.ok} (${v.detail})`;
          if (!v.ok) {
            const r = rows.find(rr => rr.id === e.id && rr.pattern === 'write');
            if (r && r.verdict === 'OK') r.verdict = 'LEAK';
          }
        } catch { /* best effort */ }
      }
      // cleanup
      try {
        if (state.mode === 'create' && e.write!.fixture.mode === 'create') {
          await e.write!.fixture.remove(portal, state.fixture);
        }
      } catch { /* best effort — leftover noted in the catalogue's cleanup field */ }
    }
  }

  const final = (!switchThrew && !switchBackThrew) ? await currentKeySite(portal) : { id: null, name: null };
  const restoredToSiteA = final.id === siteARef.id;

  return {
    siteA: siteARef, siteB: siteBRef,
    switchFrom, switchTo,
    switchThrew: switchThrew ?? switchBackThrew,
    restoredToSiteA,
    rows,
  };
}

function readRow(e: CatalogEntry, verdict: MatrixRow['verdict'], observed: string): MatrixRow {
  return { id: e.id, group: e.group, operation: e.operation, pattern: 'read', observed, verdict };
}
function writeRow(e: CatalogEntry, verdict: MatrixRow['verdict'], observed: string, note?: string): MatrixRow {
  return { id: e.id, group: e.group, operation: e.operation, pattern: 'write', observed, verdict, note };
}

function verdictForRead(e: CatalogEntry, changed: boolean, statusB: number, byId: string, observed: string): MatrixRow {
  const exp = e.read!.expectation;
  const byIdLeaked = /byId\([^)]*\)=2\d\d/.test(byId);
  if (exp === 'must-differ') {
    const leak = !changed || byIdLeaked;
    return readRow(e, leak ? 'LEAK' : 'OK',
      observed + (leak ? '  ← byte-identical / by-id readable across the switch where it MUST re-scope' : ''));
  }
  if (exp === 'known-global') {
    return changed
      ? readRow(e, 'SUSPECTED', observed + '  ← expected byte-identical (customer-level) but it DIFFERED — re-check the classification')
      : readRow(e, 'OK', observed);
  }
  if (exp === 'hypothesis') {
    const stillReadable = !changed || statusB === 200 || byIdLeaked;
    return readRow(e, stillReadable ? 'HYPOTHESIS-FAIL' : 'OK',
      observed + (stillReadable ? '  ← still readable cross-site (matches the DOCUMENTED unscoped bug — expected to fail until fixed)' : '  ← now rejected cross-site (bug may be fixed — flip expectation to must-differ)'));
  }
  // triage
  return readRow(e, 'SUSPECTED', observed + '  ← product-triage: is this meant to be site-scoped?');
}

function verdictForWrite(e: CatalogEntry, status: number, body: unknown, _ctx: SwitchContext): MatrixRow {
  const plan = e.write!;
  const canon = isSiteScopedRejection(status, body);
  const success = isSuccess(status);
  const bodyStr = (typeof body === 'string' ? body : JSON.stringify(body ?? '')).slice(0, 160);
  const obs = `cross-site ${plan.attempt.verb} → ${status} ${bodyStr}`;

  if (plan.expectation === 'hypothesis') {
    return writeRow(e, success ? 'HYPOTHESIS-FAIL' : 'OK', obs,
      success ? 'HYPOTHESIS was reject — cross-site mutation SUCCEEDED; first-ever data point'
              : `rejected (${status}) — HYPOTHESIS held, but this is the first run: verify the message`);
  }
  if (success) {
    if (plan.onSuccess === 'suspected') {
      return writeRow(e, 'SUSPECTED', obs, 'object site-scoping unconfirmed — 2xx cross-site needs product triage, not necessarily a bug');
    }
    return writeRow(e, 'LEAK', obs,
      plan.destructiveIfLeaked ? '⚠️ DESTRUCTIVE LEAK — a cross-site mutation on real data SUCCEEDED' : 'cross-site mutation SUCCEEDED');
  }
  if (canon) return writeRow(e, 'OK', obs, 'clean 400 "Configured site does not contain…"');
  return writeRow(e, 'OK', obs, `rejected with ${status} (not the canonical 400 message — worth a look)`);
}

/** Render `MatrixResult.rows` as a console-friendly table + a one-line summary. */
export function renderMatrix(res: MatrixResult): string {
  const order = ['LEAK', 'HYPOTHESIS-FAIL', 'SUSPECTED', 'ERROR', 'OK', 'SKIP'];
  const sorted = [...res.rows].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
  const count = (v: string): number => res.rows.filter(r => r.verdict === v).length;
  let out = '';
  out += `\n===== CROSS-TENANT MATRIX =====\n`;
  out += `siteA=${res.siteA.name}/${res.siteA.id}  siteB=${res.siteB ? `${res.siteB.name}/${res.siteB.id}` : '(switch failed)'}\n`;
  out += `switch: "${res.switchFrom}" → "${res.switchTo}"  threw=${res.switchThrew ?? 'no'}  restoredToSiteA=${res.restoredToSiteA}\n`;
  out += `totals: LEAK=${count('LEAK')} HYPOTHESIS-FAIL=${count('HYPOTHESIS-FAIL')} SUSPECTED=${count('SUSPECTED')} ERROR=${count('ERROR')} OK=${count('OK')} SKIP=${count('SKIP')} (of ${res.rows.length})\n`;
  out += `-------------------------------\n`;
  for (const r of sorted) {
    out += `[${r.verdict.padEnd(15)}] ${r.pattern.padEnd(5)} ${r.id.padEnd(46)} ${r.observed}${r.note ? `  {${r.note}}` : ''}\n`;
  }
  out += `===============================\n`;
  return out;
}

