import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

type Outcome = 'expected' | 'unexpected' | 'flaky' | 'skipped';
type Category = 'elements' | 'scenario';

interface Row {
  testId: string;
  id: string;
  title: string;
  file: string;
  project: string;
  category: Category;
  outcome: Outcome;
  duration: number;
}

const OUTPUT_DIR = path.join(process.cwd(), '.ai-reports');
const STATE_FILE = path.join(OUTPUT_DIR, '.state.json');

const LABEL: Record<Outcome, string> = {
  expected: 'PASS',
  unexpected: 'FAIL',
  flaky: 'FLAKY',
  skipped: 'SKIP',
};

const EMOJI: Record<Outcome, string> = {
  expected: '✅',
  unexpected: '❌',
  flaky: '⚠️',
  skipped: '⚪',
};

const SECTION_TITLE: Record<Category, string> = {
  elements: 'Element Verification',
  scenario: 'Scenario / Test-Case-Based',
};

const SECTION_HINT: Record<Category, string> = {
  elements: 'Static UI presence/state checks — tagged @elements in the spec title.',
  scenario: 'User-flow and business-logic tests, typically mapped to an Azure DevOps test case ID.',
};

/**
 * Writes a pass/fail table to `.ai-reports/` after every run — a markdown
 * file for the repo/IDE and a self-contained HTML page for sharing. Runs
 * alongside the html/list reporters configured in playwright.config.ts.
 *
 * Tests tagged `@elements` in their describe/test title (the project's
 * existing tag convention, e.g. `@email @integration` in
 * password-reset.spec.ts) are grouped into their own "Element Verification"
 * section, separate from scenario/ADO-case tests.
 *
 * scripts/run-two-phase.ts runs a suite as two sequential `playwright test`
 * invocations (@elements first, everything else second) so the two
 * categories execute in that order. Because each invocation is a separate
 * process, this reporter persists its rows to `.ai-reports/.state.json` and,
 * when TEST_REPORT_APPEND=1 is set (the second phase only), merges into the
 * previous phase's rows instead of starting over — so the final report
 * covers both phases. A plain single-invocation run (TEST_REPORT_APPEND
 * unset) always starts fresh.
 */
export default class TableReporter implements Reporter {
  // Keyed by test.id so retries overwrite the earlier attempt instead of
  // appending duplicate rows, while keeping first-seen ordering.
  private rows = new Map<string, Row>();

  onBegin(): void {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (process.env.TEST_REPORT_APPEND === '1') {
      try {
        const saved: Row[] = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        for (const row of saved) this.rows.set(row.testId, row);
      } catch {
        // No state from a prior phase (or it's corrupt) — carry on empty.
      }
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const titlePath = test.titlePath();
    const project = titlePath[1] ?? '';
    const file = titlePath[2] ?? '';
    const rawTitle = titlePath.slice(3).join(' › ');
    const idMatch = rawTitle.match(/\b(\d{3,6})\b/);
    const category: Category = /@elements\b/.test(rawTitle) ? 'elements' : 'scenario';
    const title = rawTitle.replace(/\s*@elements\b/g, '').trim();

    this.rows.set(test.id, {
      testId: test.id,
      id: idMatch ? idMatch[1] : '',
      title,
      file,
      project,
      category,
      outcome: test.outcome(),
      duration: result.duration,
    });
  }

  onEnd(result: FullResult): void {
    const rows = [...this.rows.values()];
    fs.writeFileSync(STATE_FILE, JSON.stringify(rows), 'utf-8');
    this.writeMarkdown(result, rows);
    this.writeHtml(result, rows);
  }

  private summarize(rows: Row[]) {
    const count = (o: Outcome) => rows.filter((r) => r.outcome === o).length;
    return {
      total: rows.length,
      passed: count('expected'),
      failed: count('unexpected'),
      flaky: count('flaky'),
      skipped: count('skipped'),
    };
  }

  private bySection(rows: Row[]): Array<{ category: Category; rows: Row[] }> {
    return (['elements', 'scenario'] as const)
      .map((category) => ({ category, rows: rows.filter((r) => r.category === category) }))
      .filter((section) => section.rows.length > 0);
  }

  private writeMarkdown(result: FullResult, rows: Row[]): void {
    const { total, passed, failed, flaky, skipped } = this.summarize(rows);
    const lines = [
      '# Playwright Test Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Overall: **${result.status.toUpperCase()}**`,
      `Total: ${total} — Passed: ${passed} — Failed: ${failed} — Flaky: ${flaky} — Skipped: ${skipped}`,
    ];

    for (const section of this.bySection(rows)) {
      const s = this.summarize(section.rows);
      lines.push(
        '',
        `## ${SECTION_TITLE[section.category]}`,
        '',
        `${SECTION_HINT[section.category]}`,
        '',
        `${s.total} tests — Passed: ${s.passed} — Failed: ${s.failed} — Flaky: ${s.flaky} — Skipped: ${s.skipped}`,
        '',
        '| ID | Test | File | Project | Status | Duration |',
        '|---|---|---|---|---|---|',
        ...section.rows.map(
          (r) =>
            `| ${r.id} | ${r.title} | ${r.file} | ${r.project} | ${EMOJI[r.outcome]} ${LABEL[r.outcome]} | ${(r.duration / 1000).toFixed(1)}s |`,
        ),
      );
    }

    fs.writeFileSync(path.join(OUTPUT_DIR, 'test-report.md'), lines.join('\n') + '\n', 'utf-8');
  }

  private writeHtml(result: FullResult, rows: Row[]): void {
    const { total, passed, failed, flaky, skipped } = this.summarize(rows);

    const sectionsHtml = this.bySection(rows)
      .map((section) => {
        const s = this.summarize(section.rows);
        const rowsHtml = section.rows
          .map(
            (r) => `
        <tr class="row-${r.outcome}">
          <td>${escapeHtml(r.id)}</td>
          <td>${escapeHtml(r.title)}</td>
          <td class="file">${escapeHtml(r.file)}</td>
          <td>${escapeHtml(r.project)}</td>
          <td><span class="badge badge-${r.outcome}">${EMOJI[r.outcome]} ${LABEL[r.outcome]}</span></td>
          <td>${(r.duration / 1000).toFixed(1)}s</td>
        </tr>`,
          )
          .join('');

        return `
  <section>
    <h2>${SECTION_TITLE[section.category]}</h2>
    <p class="hint">${SECTION_HINT[section.category]} — ${s.total} tests, ${s.passed} passed, ${s.failed} failed, ${s.flaky} flaky, ${s.skipped} skipped.</p>
    <table>
      <thead><tr><th>ID</th><th>Test</th><th>File</th><th>Project</th><th>Status</th><th>Duration</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Playwright Test Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 2rem; background: #fff; color: #1a1a1a; }
  @media (prefers-color-scheme: dark) { body { background: #14161a; color: #e6e6e6; } }
  h1 { font-size: 1.4rem; margin-bottom: .25rem; }
  h2 { font-size: 1.1rem; margin: 0 0 .1rem; }
  .meta { color: #666; font-size: .85rem; margin-bottom: 1.5rem; }
  @media (prefers-color-scheme: dark) { .meta { color: #999; } }
  .hint { color: #666; font-size: .8rem; margin: 0 0 .75rem; }
  @media (prefers-color-scheme: dark) { .hint { color: #999; } }
  section { margin-bottom: 2rem; }
  .stats { display: flex; gap: .75rem; margin-bottom: 2rem; flex-wrap: wrap; }
  .stat { border-radius: 8px; padding: .6rem 1.1rem; font-size: .85rem; font-weight: 600; min-width: 5rem; }
  .stat .num { font-size: 1.5rem; display: block; line-height: 1.2; }
  .stat-total { background: #eef1f5; color: #333; } @media (prefers-color-scheme: dark) { .stat-total { background: #23262c; color: #ddd; } }
  .stat-passed { background: #e3f7e9; color: #146c2e; } @media (prefers-color-scheme: dark) { .stat-passed { background: #133620; color: #6fd694; } }
  .stat-failed { background: #fdeaea; color: #a4231a; } @media (prefers-color-scheme: dark) { .stat-failed { background: #3a1717; color: #f38f86; } }
  .stat-flaky { background: #fef3e2; color: #92620a; } @media (prefers-color-scheme: dark) { .stat-flaky { background: #3a2a10; color: #f0b859; } }
  .stat-skipped { background: #f1f1f1; color: #555; } @media (prefers-color-scheme: dark) { .stat-skipped { background: #2a2a2a; color: #bbb; } }
  table { border-collapse: collapse; width: 100%; font-size: .85rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #e5e5e5; }
  @media (prefers-color-scheme: dark) { th, td { border-bottom: 1px solid #2b2e33; } }
  th { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #666; }
  @media (prefers-color-scheme: dark) { th { color: #999; } }
  td.file { color: #777; font-family: ui-monospace, Consolas, monospace; font-size: .78rem; }
  @media (prefers-color-scheme: dark) { td.file { color: #888; } }
  .badge { display: inline-block; border-radius: 999px; padding: .15rem .6rem; font-size: .72rem; font-weight: 700; white-space: nowrap; }
  .badge-expected { background: #16a34a; color: #fff; }
  .badge-unexpected { background: #dc2626; color: #fff; }
  .badge-flaky { background: #d97706; color: #fff; }
  .badge-skipped { background: #9ca3af; color: #fff; }
  .row-unexpected { background: rgba(220,38,38,.06); }
  .row-flaky { background: rgba(217,119,6,.06); }
</style>
</head>
<body>
  <h1>Playwright Test Report</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} · Overall: ${result.status.toUpperCase()}</div>
  <div class="stats">
    <div class="stat stat-total"><span class="num">${total}</span>Total</div>
    <div class="stat stat-passed"><span class="num">${passed}</span>Passed</div>
    <div class="stat stat-failed"><span class="num">${failed}</span>Failed</div>
    <div class="stat stat-flaky"><span class="num">${flaky}</span>Flaky</div>
    <div class="stat stat-skipped"><span class="num">${skipped}</span>Skipped</div>
  </div>
${sectionsHtml}
</body>
</html>`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'test-report.html'), html, 'utf-8');
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
