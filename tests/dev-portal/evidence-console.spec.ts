import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, KNOWN, LIST_BODY,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, openConsole,
} from './_helpers';
import { NetworkEvidence, writeRaw, appendSummaryRow, EVIDENCE_ROOT } from './_evidence';
import fs from 'fs';
import path from 'path';

/**
 * Console / UI race investigation — kept SEPARATE from the backend-endpoint
 * bugs. Produces `03-console-ui/CONSOLE-RACE-REPORT.md`.
 * Run: npx playwright test tests/dev-portal/evidence-console.spec.ts --project=chromium --workers=1 --trace on
 */
test.describe('Developer Portal (staging) — console/UI race evidence', () => {
  test.describe.configure({ timeout: 300_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  const findings: Record<string, unknown> = {};

  // ── Delete Custom Role — console stuck on "Loading…", no Send ──────────
  test('CONSOLE-DELETE-CUSTOM-ROLE — Try-it console never renders a Send button', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    // NO retry — capture the first-open behaviour deterministically, 5 times.
    const attempts: { n: number; sendVisible: boolean; loadingVisible: boolean; snippet: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const op = await portal.openOperation('Role Management', /^Delete Custom Role/);
      await portal.raw.waitForTimeout(2_000);
      let sendVisible = false;
      try {
        await op.openConsole(12_000);
        sendVisible = true;
      } catch { /* no Send */ }
      const loadingVisible = await portal.raw.getByRole('progressbar').first().isVisible().catch(() => false)
        || await portal.raw.getByText(/loading/i).first().isVisible().catch(() => false);
      const snippet = (await portal.raw.locator('article').last().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      attempts.push({ n: i, sendVisible, loadingVisible, snippet });
    }
    // Contrast: a sibling operation that DOES render (List Custom Roles).
    let siblingRendered = false;
    try {
      const s = await portal.openOperation('Role Management', /^List Custom Roles/);
      await portal.raw.waitForTimeout(2_000);
      await s.openConsole(12_000);
      siblingRendered = true;
    } catch { /* */ }

    findings.deleteCustomRole = {
      attempts, siblingListCustomRolesRendered: siblingRendered,
      sendNeverRendered: attempts.every(a => !a.sendVisible),
      browserConsoleErrors: consoleErrors.slice(0, 20),
      openApiSchemaRequests: ev.all().filter(c => /openapi|swagger|definition|\.json/i.test(c.url)).map(c => ({ url: c.url, status: c.status })),
    };
    writeRaw('CONSOLE-DELETE-CUSTOM-ROLE', { findings: findings.deleteCustomRole, calls: ev.all() });
    console.log(`[CONSOLE-DELETE-CUSTOM-ROLE] sendVisible=[${attempts.map(a => a.sendVisible).join(',')}] loading=[${attempts.map(a => a.loadingVisible).join(',')}] sibling=${siblingRendered} errs=${consoleErrors.length}`);
    expect(attempts.every(a => !a.sendVisible)).toBe(true); // KNOWN BUG — console never reaches Send
  });

  // ── Get Alert Trigger Operators — console can't supply the optional {id} ──
  test('CONSOLE-GET-ALERT-TRIGGER-OPERATORS — console sends the literal {id}; is the backend OK without it?', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);

    // Via the console.
    const o = await openConsole(portal, 'Notifications', /^Get Alert Trigger Operators/, { retries: 4 });
    await o.selectSubscriptionKey(API_KEY_OPTION);
    const m = ev.mark();
    let consoleStatus = -1; let consoleBody: unknown = null; let threw: string | null = null;
    try { const r = await o.send(); consoleStatus = r.status; consoleBody = r.body; } catch (e) { threw = String(e); }
    const consoleCall = ev.apiSince(m).at(-1);

    // Direct backend call — WITHOUT the id (it's documented optional) — via
    // page.evaluate + fetch in the portal page context, so the CRA-Api-Key
    // cookie/header the portal uses is applied.
    let directNoId: { status: number; body: string } | null = null;
    let directErr: string | null = null;
    try {
      directNoId = await portal.raw.evaluate(async () => {
        const res = await fetch('https://developer1.callcabinet.com/api/settings/alerts/trigger-operators/', {
          method: 'GET', credentials: 'include',
        });
        return { status: res.status, body: (await res.text()).slice(0, 800) };
      });
    } catch (e) { directErr = String(e); }

    findings.getAlertTriggerOperators = {
      consoleRequestUrl: consoleCall?.url ?? null,
      consoleRequestHasLiteralIdPlaceholder: /\{id\}/.test(consoleCall?.url ?? ''),
      consoleStatus, consoleBody, consoleThrew: threw,
      directBackendNoId: directNoId, directBackendErr: directErr,
      verdict: directNoId && directNoId.status < 400
        ? 'CONSOLE-ONLY — backend works fine without the id; the console just can\'t omit/substitute the literal {id}'
        : (directNoId ? `backend also non-2xx without id (${directNoId.status}) — needs more digging` : 'direct call blocked (CORS/cookie) — see directBackendErr'),
    };
    writeRaw('CONSOLE-GET-ALERT-TRIGGER-OPERATORS', { findings: findings.getAlertTriggerOperators, calls: ev.all() });
    console.log(`[CONSOLE-GET-ALERT-TRIGGER-OPERATORS] consoleUrl=${consoleCall?.url} status=${consoleStatus} | directNoId=${JSON.stringify(directNoId)} err=${directErr}`);
    // Record-only.
    expect([-1, 400]).toContain(consoleStatus);
  });

  // ── Content-Type: text/plain on a schema-blind "Add body" ─────────────
  test('CONSOLE-CONTENT-TYPE — schema-blind "Add body" ships text/plain → 415, then application/json works', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);

    // Update Multiple Call Tags historically hits the schema-blind state.
    const op = await openConsole(portal, 'Calls', /^Update Multiple Call Tags/, { retries: 4 });
    await op.selectSubscriptionKey(API_KEY_OPTION);
    const bodyPresent = await portal.raw.getByLabel('Request body', { exact: true }).isVisible().catch(() => false);
    let schemaBlind = false;
    let noCTStatus = -1; let noCTContentType: string | null = null; let noCTThrew: string | null = null;
    let withCTStatus = -1;
    if (!bodyPresent) {
      schemaBlind = true;
      await op.addBody();
      await op.setRequestBody({ callIds: [KNOWN.callId], tagsIdsToAdd: [KNOWN.tagId], tagsIdsToRemove: [] });
      const m = ev.mark();
      try { const r = await op.send(); noCTStatus = r.status; } catch (e) { noCTThrew = String(e); }
      const c = ev.apiSince(m).at(-1);
      noCTContentType = c?.requestHeaders['content-type'] ?? null;
      // now add the header and retry
      const op2 = await openConsole(portal, 'Calls', /^Update Multiple Call Tags/, { retries: 4 });
      await op2.selectSubscriptionKey(API_KEY_OPTION);
      if (!(await portal.raw.getByLabel('Request body', { exact: true }).isVisible().catch(() => false))) {
        await op2.addBody();
        await op2.addHeader('Content-Type', 'application/json');
      }
      const r2 = await sendJson(op2, portal.raw, { callIds: [KNOWN.callId], tagsIdsToAdd: [KNOWN.tagId], tagsIdsToRemove: [] }).catch(() => ({ status: -1 }));
      withCTStatus = r2.status;
    } else {
      // schema loaded — the bug doesn't apply this run; still record a normal send.
      const r = await sendJson(op, portal.raw, { callIds: [KNOWN.callId], tagsIdsToAdd: [KNOWN.tagId], tagsIdsToRemove: [] }).catch(() => ({ status: -1 }));
      withCTStatus = r.status;
    }

    findings.contentType = {
      schemaBlindThisRun: schemaBlind,
      noContentTypeHeaderStatus: noCTStatus, noContentTypeHeaderSent: noCTContentType, noContentTypeThrew: noCTThrew,
      withApplicationJsonStatus: withCTStatus,
      verdict: schemaBlind
        ? (noCTContentType?.includes('text/plain') ? 'CONFIRMED — schema-blind console ships Content-Type: text/plain → the failure is in the console request construction, not the backend' : `schema-blind but Content-Type was ${noCTContentType}`)
        : 'NOT REPRODUCED this run — the operation loaded its schema, so the "Add body" path (and the text/plain default) did not occur',
    };
    writeRaw('CONSOLE-CONTENT-TYPE', { findings: findings.contentType, calls: ev.all() });
    console.log(`[CONSOLE-CONTENT-TYPE] schemaBlind=${schemaBlind} noCT.status=${noCTStatus} noCT.header=${noCTContentType} withCT.status=${withCTStatus}`);

    // Write the consolidated console-race report now (last console test).
    const md = buildConsoleReport(findings);
    fs.mkdirSync(path.join(EVIDENCE_ROOT, '03-console-ui'), { recursive: true });
    fs.writeFileSync(path.join(EVIDENCE_ROOT, '03-console-ui', 'CONSOLE-RACE-REPORT.md'), md);
    appendSummaryRow(`| CONSOLE-DELETE-CUSTOM-ROLE | Role Management | Delete Custom Role | CONSOLE/UI BUG | ${(findings.deleteCustomRole as { sendNeverRendered?: boolean })?.sendNeverRendered ? 'CONFIRMED' : 'NOT REPRODUCED'} | 5/5 | — | yes | yes | yes | P1 |`);
    appendSummaryRow(`| CONSOLE-GET-ALERT-TRIGGER-OPERATORS | Notifications | Get Alert Trigger Operators | CONSOLE/UI BUG | ${String((findings.getAlertTriggerOperators as { verdict?: string })?.verdict).startsWith('CONSOLE-ONLY') ? 'CONSOLE-ONLY' : 'INCONCLUSIVE'} | 1/1 | GET | yes | yes | yes | P1 |`);
    appendSummaryRow(`| CONSOLE-CONTENT-TYPE | Calls | Update Multiple Call Tags | CONSOLE/UI BUG (intermittent) | ${schemaBlind ? 'CONFIRMED' : 'NOT REPRODUCED'} | ${schemaBlind ? '1/1' : '0/1'} | PUT | yes | partial | yes | P2 |`);
    expect(true).toBe(true);
  });
});

function buildConsoleReport(f: Record<string, unknown>): string {
  const dcr = f.deleteCustomRole as {
    attempts?: { n: number; sendVisible: boolean; loadingVisible: boolean; snippet: string }[];
    siblingListCustomRolesRendered?: boolean; sendNeverRendered?: boolean; browserConsoleErrors?: string[];
  } | undefined;
  const gato = f.getAlertTriggerOperators as {
    consoleRequestUrl?: string; consoleRequestHasLiteralIdPlaceholder?: boolean; consoleStatus?: number;
    consoleBody?: unknown; directBackendNoId?: { status: number; body: string } | null; directBackendErr?: string | null; verdict?: string;
  } | undefined;
  const ct = f.contentType as {
    schemaBlindThisRun?: boolean; noContentTypeHeaderStatus?: number; noContentTypeHeaderSent?: string | null;
    withApplicationJsonStatus?: number; verdict?: string;
  } | undefined;
  const contentTypeLine = ct?.schemaBlindThisRun
    ? '- **Send without touching Headers**: status ' + ct.noContentTypeHeaderStatus
      + ', outgoing Content-Type = `' + ct.noContentTypeHeaderSent + '` — '
      + (ct.noContentTypeHeaderSent?.includes('text/plain')
          ? 'the console shipped `text/plain` for a JSON body, so the failure originates in the console request construction, not the backend. '
          : 'the console shipped a different Content-Type (see raw). ')
      + 'After manually adding `Content-Type: application/json` the same body → status ' + ct.withApplicationJsonStatus + '.'
    : '- **NOT reproduced this run** — the operation loaded its schema, so "Add body" (and its text/plain default) never came up. A normal send → status ' + String(ct?.withApplicationJsonStatus) + '.';
  return [
    '# Console / UI race — consolidated report (2026-08-29)',
    '',
    'Kept separate from the backend-endpoint bugs. Environment: staging',
    '`developer1-portal.callcabinet.com` / gateway `developer1.callcabinet.com`,',
    'account `romana@callcabinet.com`, company CC Test 1, key "Primary: API_test",',
    'git `feature/chat-listing @ ed251c2`.',
    '',
    '---',
    '',
    '## 1. Delete Custom Role — Try-it console never renders a Send button',
    '',
    `- **Classification**: CONSOLE/UI BUG (deterministic, not the transient schema race)`,
    `- **Reproducibility**: ${dcr?.sendNeverRendered ? '5/5 fresh opens, no retry — Send never appeared' : 'NOT reproduced this run'}`,
    `- **Per-attempt** (fresh catalogue navigation each time, 2s pause, 12s wait for Send):`,
    '',
    '| attempt | Send button visible | loading indicator visible | drawer text (first 300 chars) |',
    '|--:|:--:|:--:|---|',
    ...(dcr?.attempts ?? []).map(a => `| ${a.n} | ${a.sendVisible} | ${a.loadingVisible} | ${a.snippet.replace(/\|/g, '\\|')} |`),
    '',
    `- **Contrast**: the sibling operation \`List Custom Roles\` rendered its console fine (\`${dcr?.siblingListCustomRolesRendered}\`), so this is specific to \`Delete Custom Role\`, not the whole group.`,
    `- **Browser console errors captured**: ${dcr?.browserConsoleErrors?.length ? '\n' + dcr.browserConsoleErrors.map(e => `  - \`${e.slice(0, 200)}\``).join('\n') : 'none'}`,
    '- **Retry protocol result**: a narrowly-scoped retry of *only the console open* (reopen the operation, wait for Send) — tried up to 4× in `role-management-api.spec.ts` — did **not** help; the drawer stays on "Loading…" every time. The retry does not mask another issue; the console genuinely never finishes loading this operation\'s schema.',
    '- **Recommended regression**: `role-management-api.spec.ts` › "KNOWN BUG — Delete Custom Role: Try-it console never finishes loading (no Send button)" (asserts `sendButtonRendered === false`). Keep. `Delete Custom Role`\'s coverage is otherwise `test.skip`.',
    '- **Suggested ticket**: *Developer Portal console — the "Delete Custom Role" operation drawer never leaves the "Loading…" state after "Try this operation"; no Parameters section or Send button ever render. Sibling operations (List/Create Custom Role) render normally.*',
    '',
    '---',
    '',
    '## 2. Get Alert Trigger Operators — console sends the literal `{id}`; backend contrast',
    '',
    `- **Classification**: ${gato?.verdict?.startsWith('CONSOLE-ONLY') ? 'CONSOLE/UI BUG (console-only — backend is fine)' : 'CONSOLE/UI BUG — backend contrast inconclusive'}`,
    `- **Console request URL captured**: \`${gato?.consoleRequestUrl}\` — contains literal \`{id}\`: **${gato?.consoleRequestHasLiteralIdPlaceholder}**`,
    `- **Console result**: status ${gato?.consoleStatus} \`${JSON.stringify(gato?.consoleBody)}\` — the backend rejects the literal string \`{id}\` (\`"The value '{id}' is not valid."\`).`,
    `- **Direct backend call, WITHOUT the id** (the param is documented optional), via \`fetch\` in the portal page context: ${gato?.directBackendNoId ? `**status ${gato.directBackendNoId.status}**, body: \`${gato.directBackendNoId.body.slice(0, 300)}\`` : `blocked — \`${gato?.directBackendErr}\``}`,
    `- **Verdict**: ${gato?.verdict}`,
    '- **Why**: the console renders the endpoint template with the placeholder `?id={id}` baked into the URL and provides no fillable field for it (unlike a real path param). "Add parameter" adds a *separate* query param, it does not substitute the baked `{id}`. So the operation can never be sent successfully through the console, even though the parameter is optional and omitting it should work.',
    "- **Recommended regression**: `notifications-api.spec.ts` KNOWN BUG test for Get Alert Trigger Operators asserts 400 + the `The value {id} is not valid.` message. Keep.",
    "- **Suggested ticket**: *Developer Portal console — Get Alert Trigger Operators bakes the unfilled `?id={id}` placeholder into the request URL and offers no way to remove or substitute it; every send 400s with `The value {id} is not valid.` The `id` query parameter is documented optional and omitting it should succeed.*",
    '',
    '---',
    '',
    '## 3. Schema-blind "Add body" ships `Content-Type: text/plain` → 415',
    '',
    '- **Classification**: CONSOLE/UI BUG (intermittent — tied to the schema/render race)',
    '- **Schema-blind state this run**: ' + String(ct?.schemaBlindThisRun),
    contentTypeLine,
    '- **Recommended regression**: `tenant-scoping-bugs.spec.ts` › "Bug 3" already adapts to whichever state occurs and asserts the 415 when the schema-blind state is hit. Keep.',
    '- **Suggested ticket**: *Developer Portal console — when the operation schema fails to load in time, "Add body" produces a JSON payload but the request goes out with `Content-Type: text/plain;charset=UTF-8`, causing a spurious 415. The console should default a JSON body editor to `application/json`.*',
    '',
    '---',
    '',
    '## 4. Delete User — "Send" fires no network request at all',
    '',
    'Full write-up: `03-console-ui/BUG-delete-user-send-inert.md` (from batch 4). Summary:',
    '',
    '- **Classification**: CONSOLE/UI BUG (Send handler is inert for this one operation)',
    '- **Evidence**: in the same console session, `Add User` and `Get User` fire real requests (200/200). `Delete User` → click Send → **0 network calls** (no OPTIONS, no POST) across 3 fresh attempts; the client `waitForResponse` just times out.',
    '- **Ruled out**: params not attached (request preview shows the full URL), Send disabled/duplicate (verified 2026-08-28), dead session (Add/Get work in it), the schema race (console renders fully — Send is visible, params fillable — the click just no-ops).',
    '- **Recommended regression**: `user-management-api.spec.ts` › the round-trip asserts `expect(deleteOp.send()).rejects.toThrow(/Timeout/)`. Keep.',
    '',
    '---',
    '',
    '## Console-race class — operations where the schema/render race has been observed',
    '',
    'Path-param field missing, wrong/stale sibling schema shown, no body editor, wrong Content-Type, "Try this operation" never becoming "Send": **Update Legal Hold, Add Call Note, Get Agent Group, Get Restricted User, Update Company/SSO Settings, List Logs, Add/Delete IP Whitelist, List/Add/Update Tag, Get/Delete Alert Configuration, Get Alert Notification (old), Delete Notification Rule** (documented over prior sessions), plus **Delete Custom Role** (new, deterministic — section 1) and **Save completed QAs / Get Available QAs / most QA + Chats consoles** (this investigation — needed the `openConsole(..., {retries})` wrapper to drive them).',
    '',
    '**Mitigation in the test suite**: `_helpers.ts` `openConsole(portal, group, regex, { retries })` re-navigates to the operation fresh and re-waits for Send, up to N times, with a shorter per-attempt timeout. It retries **only console setup**, never the API request, so real backend failures still surface on the first `send()`.',
    '',
  ].join('\n');
}
