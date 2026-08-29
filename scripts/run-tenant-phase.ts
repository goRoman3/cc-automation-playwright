import { spawnSync } from 'child_process';
import path from 'path';

/**
 * Runs the tenant-isolation staging spec with `TENANT_PHASE` set in the
 * child process's env directly, rather than via shell-specific `VAR=value`
 * syntax (which PowerShell/cmd.exe don't support) — same cross-platform
 * approach as `scripts/run-two-phase.ts`.
 *
 * Usage: tsx scripts/run-tenant-phase.ts <1|2|switch> [extra playwright args...]
 */
const [, , phase, ...extraArgs] = process.argv;

if (phase !== '1' && phase !== '2' && phase !== 'switch') {
  console.error('Usage: tsx scripts/run-tenant-phase.ts <1|2|switch> [playwright args...]');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const specPath = 'tests/dev-portal/tenant-isolation-staging.spec.ts';

const result = spawnSync('npx', ['playwright', 'test', specPath, '--project=chromium', '--workers=1', ...extraArgs], {
  stdio: 'inherit',
  shell: true,
  cwd: repoRoot,
  env: { ...process.env, TENANT_PHASE: phase },
});

process.exit(result.status ?? 1);
