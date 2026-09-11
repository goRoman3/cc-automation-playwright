import fs from 'fs';
import path from 'path';
import type { BrowserContext, Request, Response } from '@playwright/test';

/**
 * Network-capture + artifact-writing harness for the Developer Portal
 * evidence investigation. Records every request the portal makes to the
 * staging gateway (`developer1.callcabinet.com`) / portal
 * (`developer1-portal.callcabinet.com`) with full raw detail, redacting
 * only the subscription-key secret.
 *
 * Artifacts land under `artifacts/dev-portal-evidence-<date>/`.
 */
export const EVIDENCE_ROOT = path.resolve(
  __dirname, '../../artifacts/dev-portal-evidence-2026-08-29',
);

const SECRET_HEADERS = new Set([
  'cra-api-key', 'ocp-apim-subscription-key', 'subscription-key', 'authorization', 'cookie',
]);

export interface CapturedCall {
  seq: number;
  startedAt: string;
  method: string;
  url: string;
  pathname: string;
  query: Record<string, string>;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  status: number | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  latencyMs: number | null;
  fired: true;
  failure: string | null;
}

function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? `<redacted len=${v.length}>` : v;
  }
  return out;
}

/** Matches the staging gateway + portal hosts (never the prod one-"s" hosts). */
export function isGatewayUrl(url: string): boolean {
  return /https:\/\/developer1(-portal)?\.callcabinet\.com\//.test(url);
}

export class NetworkEvidence {
  private calls: CapturedCall[] = [];
  private seq = 0;
  private starts = new Map<Request, number>();

  attach(context: BrowserContext): void {
    // Context-level events already fire for every page in the context —
    // wiring pages too would double/triple-count each request.
    context.on('request', (req: Request) => {
      if (!isGatewayUrl(req.url())) return;
      this.starts.set(req, Date.now());
    });
    context.on('requestfailed', (req: Request) => {
      if (!isGatewayUrl(req.url())) return;
      this.record(req, null, Date.now() - (this.starts.get(req) ?? Date.now()), req.failure()?.errorText ?? 'requestfailed');
    });
    context.on('response', async (res: Response) => {
      const req = res.request();
      if (!isGatewayUrl(req.url())) return;
      const latency = Date.now() - (this.starts.get(req) ?? Date.now());
      let body: string | null = null;
      try { body = await res.text(); } catch { body = '<unreadable>'; }
      this.record(req, res, latency, null, body);
    });
  }

  private record(req: Request, res: Response | null, latencyMs: number, failure: string | null, body?: string): void {
    const u = new URL(req.url());
    this.calls.push({
      seq: ++this.seq,
      startedAt: new Date(Date.now() - latencyMs).toISOString(),
      method: req.method(),
      url: req.url(),
      pathname: u.pathname,
      query: Object.fromEntries(u.searchParams.entries()),
      requestHeaders: redactHeaders(req.headers()),
      requestBody: req.postData() ?? null,
      status: res ? res.status() : null,
      responseHeaders: res ? redactHeaders(res.headers()) : null,
      responseBody: body ?? null,
      latencyMs,
      fired: true,
      failure,
    });
  }

  /** All captured calls so far. */
  all(): CapturedCall[] { return [...this.calls]; }

  /** A marker; pass to `since()` to get everything captured after it. */
  mark(): number { return this.calls.length; }
  since(marker: number): CapturedCall[] { return this.calls.slice(marker); }

  /** The last call whose pathname contains `fragment` (case-insensitive). */
  lastMatching(fragment: string): CapturedCall | undefined {
    return [...this.calls].reverse().find(c => c.pathname.toLowerCase().includes(fragment.toLowerCase()));
  }

  /** Non-OPTIONS API calls captured after `marker` (drops CORS preflights). */
  apiSince(marker: number): CapturedCall[] {
    return this.since(marker).filter(c => c.method !== 'OPTIONS');
  }
}

/**
 * Keep only real gateway API traffic (`developer1.callcabinet.com/…`,
 * NOT the `-portal` SPA host) — that's where every finding's evidence is.
 */
function isApiCall(c: CapturedCall): boolean {
  return /^https:\/\/developer1\.callcabinet\.com\//.test(c.url);
}
const BODY_CAP = 8000;
function slimCall(c: CapturedCall): CapturedCall {
  const cap = (s: string | null) => (s && s.length > BODY_CAP ? s.slice(0, BODY_CAP) + `…[+${s.length - BODY_CAP} chars]` : s);
  return { ...c, requestBody: cap(c.requestBody), responseBody: cap(c.responseBody) };
}

/**
 * Writes `data` to `raw/<name>.json`. If `data.calls` is a CapturedCall[],
 * it is slimmed: console-metadata/static-asset noise dropped, request/
 * response bodies capped. Keeps the file auditably small.
 */
export function writeRaw(name: string, data: Record<string, unknown>): string {
  const dir = path.join(EVIDENCE_ROOT, 'raw');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  const out = { ...data };
  if (Array.isArray(out.calls)) {
    const calls = out.calls as CapturedCall[];
    // Keep gateway API calls; collapse the Send double-fire (consecutive
    // identical method+url+body+status).
    const kept: CapturedCall[] = [];
    for (const c of calls.filter(isApiCall).map(slimCall)) {
      const prev = kept[kept.length - 1];
      if (prev && prev.method === c.method && prev.url === c.url
        && prev.requestBody === c.requestBody && prev.status === c.status) continue;
      kept.push(c);
    }
    out.calls = kept;
    out.callsDropped = calls.length - kept.length;
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  return file;
}

export function writeReport(subdir: string, filename: string, markdown: string): string {
  const dir = path.join(EVIDENCE_ROOT, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, filename);
  fs.writeFileSync(file, markdown);
  return file;
}

export function appendSummaryRow(row: string): void {
  const file = path.join(EVIDENCE_ROOT, '00-summary-rows.md');
  fs.appendFileSync(file, row.trimEnd() + '\n');
}

/** Renders one CapturedCall as a fenced evidence block. */
export function renderCall(label: string, c: CapturedCall | undefined): string {
  if (!c) return `### ${label}\n\n**NO NETWORK REQUEST CAPTURED for this step.**\n`;
  return [
    `### ${label}`,
    '',
    '```',
    `startedAt:     ${c.startedAt}`,
    `latencyMs:     ${c.latencyMs}`,
    `method:        ${c.method}`,
    `url:           ${c.url}`,
    `pathname:      ${c.pathname}`,
    `query:         ${JSON.stringify(c.query)}`,
    `Content-Type:  ${c.requestHeaders['content-type'] ?? '(none)'}`,
    `sub-key hdr:   ${c.requestHeaders['cra-api-key'] ?? c.requestHeaders['ocp-apim-subscription-key'] ?? '(none)'}`,
    `request body:  ${c.requestBody ?? '(none)'}`,
    `--`,
    `status:        ${c.status ?? `(no response — ${c.failure ?? 'unknown'})`}`,
    `response body: ${c.responseBody ?? '(none)'}`,
    '```',
    '',
  ].join('\n');
}

export interface Precondition {
  timestamp: string;
  app: string;
  developerPortal: string;
  gateway: string;
  company: string;
  account: string;
  subscriptionKey: string;
  currentSiteId: string | null;
  currentSiteName: string | null;
  gitBranch: string;
  gitCommit: string;
}

export interface FindingReport {
  id: string;
  title: string;
  classification: string;
  severity: string;
  precondition: Precondition;
  resourceIds: Record<string, string | number | boolean | null>;
  chain: { step: string; note?: string; call?: CapturedCall }[];
  expected: string;
  actual: string;
  reproducibility: string;
  alternativesRuledOut: { hypothesis: string; verdict: string }[];
  downstreamImpact: string;
  workaround: string;
  cleanup: string;
  remainingUnknowns: string;
  recommendedRegression: string;
  suggestedTicket: string;
  rawFiles: string[];
}

export function buildReport(r: FindingReport): string {
  const pc = r.precondition;
  const lines: string[] = [
    `# ${r.title}`,
    '',
    `- **ID**: ${r.id}`,
    `- **Classification**: ${r.classification}`,
    `- **Severity**: ${r.severity}`,
    '',
    '## Environment',
    '',
    '```',
    `timestamp:        ${pc.timestamp}`,
    `app:              ${pc.app}`,
    `developer portal: ${pc.developerPortal}`,
    `gateway:          ${pc.gateway}`,
    `company:          ${pc.company}`,
    `account:          ${pc.account}`,
    `subscription key: ${pc.subscriptionKey}`,
    `key current site: ${pc.currentSiteName ?? '(unknown)'} / ${pc.currentSiteId ?? '(unknown)'}`,
    `git:              ${pc.gitBranch} @ ${pc.gitCommit}`,
    '```',
    '',
    '## Preconditions / Resource IDs',
    '',
    '```json',
    JSON.stringify(r.resourceIds, null, 2),
    '```',
    '',
    '## Endpoint chain',
    '',
  ];
  r.chain.forEach((s, i) => {
    lines.push(`## Step ${i + 1} — ${s.step}`, '');
    if (s.note) lines.push(s.note, '');
    lines.push(renderCall(s.step, s.call));
  });
  lines.push(
    '## Expected', '', r.expected, '',
    '## Actual', '', r.actual, '',
    '## Reproducibility', '', r.reproducibility, '',
    '## Alternative explanations ruled out', '',
    ...r.alternativesRuledOut.map(a => `- **${a.hypothesis}** — ${a.verdict}`),
    '',
    '## Downstream impact', '', r.downstreamImpact, '',
    '## Workaround', '', r.workaround, '',
    '## Cleanup performed', '', r.cleanup, '',
    '## Remaining unknowns', '', r.remainingUnknowns, '',
    '## Recommended regression test', '', r.recommendedRegression, '',
    '## Suggested bug-ticket wording', '', r.suggestedTicket, '',
    '## Raw evidence files', '',
    ...r.rawFiles.map(f => `- \`${f}\``),
    '',
  );
  return lines.join('\n');
}
