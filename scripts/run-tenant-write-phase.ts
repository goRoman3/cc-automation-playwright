import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Runs the cross-tenant write-path isolation spec with `TENANT_WRITE_PHASE`
 * set in the child process's env directly — same cross-platform approach as
 * `scripts/run-tenant-phase.ts` (avoids shell-specific `VAR=value` syntax,
 * which PowerShell/cmd.exe don't support).
 *
 * Usage: tsx scripts/run-tenant-write-phase.ts <1|2> [extra playwright args...]
 */
const [, , phase, ...extraArgs] = process.argv;

if (phase !== '1' && phase !== '2') {
  console.error('Usage: tsx scripts/run-tenant-write-phase.ts <1|2> [playwright args...]');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const specPath = 'tests/dev-portal/tenant-isolation-negative-writes-staging.spec.ts';

const result = spawnSync('npx', ['playwright', 'test', specPath, '--project=chromium', '--workers=1', ...extraArgs], {
  stdio: 'inherit',
  shell: true,
  cwd: repoRoot,
  env: { ...process.env, TENANT_WRITE_PHASE: phase },
});

process.exit(result.status ?? 1);
