import { writeFileSync } from 'fs';
import path from 'path';
import { CATALOG, catalogStats } from '../tests/dev-portal/cross-tenant-catalog';

/**
 * Renders `tests/dev-portal/cross-tenant-catalog.md` from the typed catalogue
 * (`tests/dev-portal/cross-tenant-catalog.ts` — the single source of truth).
 *
 * Run: `npx tsx scripts/gen-cross-tenant-catalog.ts`  (Node, not Playwright.)
 */
const esc = (x?: string): string => (x ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const s = catalogStats();
const groups = [...new Set(CATALOG.map(e => e.group))];

let out = '';
out += '# Cross-tenant coverage catalogue — 127 operations, 19 groups\n\n';
out += 'Generated from `tests/dev-portal/cross-tenant-catalog.ts` (the source of truth).\n';
out += 'Do not hand-edit — re-run `npx tsx scripts/gen-cross-tenant-catalog.ts`.\n\n';
out += '**⚠️ NOT RUN LIVE** — see `tests/dev-portal/UNVERIFIED.md`.\n\n';

out += '## Classification\n\n';
out += '| Class | Count | Meaning |\n|---|---:|---|\n';
out += `| read | ${s.byClass.read} | safe read — Pattern A (read-isolation) applies |\n`;
out += `| write | ${s.byClass.write} | mutating with a disposable / no-op-safe target — Pattern B (write-isolation) applies |\n`;
out += `| destructive | ${s.byClass.destructive} | irreversible on real data, no disposable fixture — Pattern B NOT run (test.skip) |\n`;
out += `| blocked | ${s.byClass.blocked} | cannot be driven at all (upstream 500 / missing id / console stuck) — test.skip |\n`;
out += `| n/a | ${s.byClass['n/a']} | customer-level object, no per-site dimension — neither pattern applies |\n`;
out += `| **total** | **${s.total}** | |\n\n`;

out += '## Per group\n\n';
out += '| Group | Ops | read | write | destructive | blocked | n/a |\n|---|---:|---:|---:|---:|---:|---:|\n';
for (const g of groups) {
  const es = CATALOG.filter(e => e.group === g);
  const c = (k: string): number => es.filter(e => e.cls === k).length;
  out += `| ${g} | ${es.length} | ${c('read')} | ${c('write')} | ${c('destructive')} | ${c('blocked')} | ${c('n/a')} |\n`;
}

out += '\n## Full matrix\n\n';
for (const g of groups) {
  out += `### ${g}\n\n`;
  out += '| Operation | Class | id source / cleanup | Reason / caveat | Source |\n|---|---|---|---|---|\n';
  for (const e of CATALOG.filter(x => x.group === g)) {
    const idc = [e.idSource, e.cleanup].filter(Boolean).join(' — cleanup: ');
    out += `| ${esc(e.operation)} | ${e.cls} | ${esc(idc)} | ${esc(e.reason)} | ${esc(e.source)} |\n`;
  }
  out += '\n';
}

const target = path.resolve(__dirname, '../tests/dev-portal/cross-tenant-catalog.md');
writeFileSync(target, out);
console.log(`wrote ${target} (${out.split('\n').length} lines, ${CATALOG.length} operations)`);
