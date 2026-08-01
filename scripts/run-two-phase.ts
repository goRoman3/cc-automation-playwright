import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Runs a suite as two ordered `playwright test` invocations so @elements
 * tests (page-level presence/state checks) always finish before scenario /
 * ADO-case-based tests — a single `playwright test` run can't express "these
 * first, then those" since --grep only filters, it doesn't sequence.
 *
 * The custom reporter (reporters/table-reporter.ts) persists rows between
 * the two invocations via TEST_REPORT_APPEND, so the final .ai-reports/
 * table still covers both phases in one file.
 *
 * Usage: tsx scripts/run-two-phase.ts <suite-path> [extra playwright args...]
 */
const [, , suitePath, ...extraArgs] = process.argv;

if (!suitePath) {
  console.error('Usage: tsx scripts/run-two-phase.ts <suite-path> [playwright args...]');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');

function runPhase(label: string, grepArgs: string[], append: boolean): number {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync('npx', ['playwright', 'test', suitePath, ...extraArgs, ...grepArgs], {
    stdio: 'inherit',
    shell: true,
    cwd: repoRoot,
    env: { ...process.env, TEST_REPORT_APPEND: append ? '1' : '' },
  });
  return result.status ?? 1;
}

const elementsExit = runPhase('Phase 1/2 — element verification (@elements)', ['--grep', '@elements'], false);
const scenarioExit = runPhase('Phase 2/2 — scenario / test-case-based', ['--grep-invert', '@elements'], true);

process.exit(elementsExit !== 0 ? elementsExit : scenarioExit);
