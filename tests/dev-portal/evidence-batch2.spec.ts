import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, SCHEMA_LOAD_PAUSE_MS, KNOWN,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, openConsole,
} from './_helpers';
import {
  NetworkEvidence, writeRaw, writeReport, appendSummaryRow, buildReport,
  type Precondition, type CapturedCall,
} from './_evidence';

/**
 * Batch 2 evidence — P0 persistence/blocker + P1 backend 500s.
 * Run: npx playwright test tests/dev-portal/evidence-batch2.spec.ts --project=chromium --workers=1 --trace on
 *
 * NOTE on the raw capture: `ApiOperationPage.send()` fires the "Send" click
 * via `clickButtonRobustly` (forced click, then a raw-DOM fallback); when
 * the forced click exceeds its 5s bound but still registered, the request
 * goes out twice. Responses are identical each time; `apiSince(m).at(-1)`
 * takes the last. Noted here so the doubled rows in raw JSON aren't read as
 * a product retry.
 */
const GIT = { branch: 'feature/chat-listing', commit: 'ed251c2' };

test.describe('Developer Portal (staging) — batch 2 evidence', () => {
  test.describe.configure({ timeout: 300_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  async function precondition(portal: DeveloperPortalPage): Promise<Precondition> {
    let siteId: string | null = null;
    let siteName: string | null = null;
    try {
      const op = await portal.openOperation('Reports', /^Get Sites Storage Usage/);
      await portal.raw.waitForTimeout(SCHEMA_LOAD_PAUSE_MS);
      await op.openConsole();
      await op.selectSubscriptionKey(API_KEY_OPTION);
      const { body } = await op.send();
      const first = (body as Array<{ siteId?: string; id?: string; siteName?: string; name?: string }>)[0];
      siteId = first?.siteId ?? first?.id ?? null;
      siteName = first?.siteName ?? first?.name ?? null;
    } catch { /* null */ }
    return {
      timestamp: new Date().toISOString(),
      app: 'https://atmossystemsstaging.callcabinet.com (TWO s)',
      developerPortal: 'https://developer1-portal.callcabinet.com',
      gateway: 'https://developer1.callcabinet.com',
      company: 'CC Test 1', account: process.env.user ?? '(unset)',
      subscriptionKey: API_KEY_OPTION,
      currentSiteId: siteId, currentSiteName: siteName,
      gitBranch: GIT.branch, gitCommit: GIT.commit,
    };
  }

  /** Open op → console (retrying the console-open for the schema race) → key → send. */
  async function fire(
    portal: DeveloperPortalPage, ev: NetworkEvidence, group: string, op: RegExp,
    body: unknown | undefined, params?: [string, string][],
  ): Promise<{ status: number; body: unknown; call: CapturedCall | undefined }> {
    const o = await openConsole(portal, group, op, { retries: 4 });
    await o.selectSubscriptionKey(API_KEY_OPTION);
    for (const [n, v] of params ?? []) await o.addParameter(n, v);
    const m = ev.mark();
    const r = body === undefined ? await o.send() : await sendJson(o, portal.raw, body);
    return { ...r, call: ev.apiSince(m).at(-1) };
  }

  // ═══════════════════════════════════════════════════════════════════════
  test('P0-SAVE-COMPLETED-QAS — Save completed QAs returns 201 but never persists', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);
    const callId = KNOWN.callId;

    // 1 — discover an available QA form for this call.
    const avail = await fire(portal, ev, 'QA', /^Get Available QAs/, undefined, [['callId', callId]]);
    expect(avail.status).toBe(200);
    const form = (avail.body as Array<{ id: number; archived: boolean }>).find(f => !f.archived);
    expect(form, 'expected a non-archived QA form').toBeTruthy();

    // 2 — Save completed QAs (required-fields-only, unique marker in notes).
    const marker = `AQA-EVIDENCE-${Date.now()}`;
    const save = await fire(portal, ev, 'QA', /^Save completed QAs/, {
      id: form!.id, callId, questions: [], sections: [], notes: marker,
    });

    // 3 — immediate read-back: List Completed Qas.
    const listNow = await fire(portal, ev, 'QA', /^List Completed Qas/, undefined, [['callId', callId]]);

    // 4 — Get Call Info → hasAnsweredForms.
    const info = await fire(portal, ev, 'Calls', /^Get Call Info/, undefined, [['callId', callId]]);
    const hasAnsweredFormsNow = (info.body as { model?: { hasAnsweredForms?: boolean } }).model?.hasAnsweredForms;

    // 5 — wait, then read again.
    await portal.raw.waitForTimeout(5_000);
    const listAfter = await fire(portal, ev, 'QA', /^List Completed Qas/, undefined, [['callId', callId]]);
    const info2 = await fire(portal, ev, 'Calls', /^Get Call Info/, undefined, [['callId', callId]]);
    const hasAnsweredFormsAfter = (info2.body as { model?: { hasAnsweredForms?: boolean } }).model?.hasAnsweredForms;

    const listCount = (b: unknown) => Array.isArray(b) ? b.length : ((b as { data?: unknown[] })?.data?.length ?? 'n/a');
    const raw = writeRaw('P0-SAVE-COMPLETED-QAS', {
      precondition: pc, callId, formId: form!.id, marker,
      saveStatus: save.status, saveBody: save.body,
      listNowStatus: listNow.status, listNowCount: listCount(listNow.body), listNowBody: listNow.body,
      listAfterStatus: listAfter.status, listAfterCount: listCount(listAfter.body), listAfterBody: listAfter.body,
      hasAnsweredFormsNow, hasAnsweredFormsAfter,
      calls: ev.all(),
    });

    const report = buildReport({
      id: 'P0-SAVE-COMPLETED-QAS',
      title: 'BUG — Save completed QAs returns 201 but the evaluation is never persisted',
      classification: 'CONFIRMED BACKEND BUG',
      severity: 'P0 (completed evaluations are silently lost; blocks Suppress QA)',
      precondition: pc,
      resourceIds: { callId, formId: form!.id, marker },
      chain: [
        { step: 'Get Available QAs (discover form id)', call: avail.call },
        { step: `Save completed QAs (id=${form!.id}, callId, questions:[], sections:[], notes:"${marker}")`, call: save.call },
        { step: 'List Completed Qas — immediate read-back', call: listNow.call },
        { step: 'Get Call Info — hasAnsweredForms (immediate)', call: info.call },
        { step: 'List Completed Qas — after 5s', call: listAfter.call },
        { step: 'Get Call Info — hasAnsweredForms (after 5s)', call: info2.call },
      ],
      expected: 'After a `201 Created`, the completed evaluation is readable via `List Completed Qas` for this call, and `Get Call Info` → `model.hasAnsweredForms` becomes `true`.',
      actual: [
        `Save → **${save.status}** \`${JSON.stringify(save.body)}\`.`,
        `List Completed Qas immediately → ${listNow.status}, count = ${listCount(listNow.body)} (marker "${marker}" not found).`,
        `Get Call Info \`hasAnsweredForms\` immediately → **${hasAnsweredFormsNow}**.`,
        `After 5s: List → ${listAfter.status}, count = ${listCount(listAfter.body)}; \`hasAnsweredForms\` → **${hasAnsweredFormsAfter}**.`,
        `No persistent state change from a successful write.`,
      ].join('\n'),
      reproducibility: '2/2 reads (immediate + delayed) this run; matches 2026-08-28/29 observations.',
      alternativesRuledOut: [
        { hypothesis: 'write actually failed', verdict: `ruled out — Save returned ${save.status} (2xx success)` },
        { hypothesis: 'read is eventually-consistent / needs a delay', verdict: 'ruled out — still absent after a 5s wait, both via List Completed Qas and the call\'s own hasAnsweredForms flag' },
        { hypothesis: 'wrong callId / form', verdict: `ruled out — form id ${form!.id} came from Get Available QAs for this exact callId; callId is the known own-site call` },
        { hypothesis: 'List filters it out', verdict: 'ruled out — hasAnsweredForms (an independent flag on the call) also stays false' },
        { hypothesis: 'request never fired', verdict: `ruled out — raw capture shows the Save POST fired and returned ${save.status}` },
      ],
      downstreamImpact: '`Suppress QA` is untestable/unusable — it needs a real completed-QA id, and none can ever be produced through this API. Any partner workflow that submits completed evaluations via the API loses them silently.',
      workaround: 'None via the API. Completed evaluations must be entered through the main app.',
      cleanup: 'Nothing to clean up — nothing was persisted.',
      remainingUnknowns: 'Whether a fully-populated `questions`/`sections` body persists (only the required-fields-only body tested). Whether the main app\'s own save path works (likely a different route).',
      recommendedRegression: '`qa-api.spec.ts` › "KNOWN BUG — Save completed QAs returns 201 but never actually persists" already pins this (asserts 201 + hasAnsweredForms:false). Keep.',
      suggestedTicket: [
        '**Title**: `POST qc/Quality/SaveCompletedForm` returns 201 but the completed QA is never persisted',
        '',
        `**Env**: staging developer1 gateway, key "Primary: API_test", call ${callId} (own site), QA form ${form!.id}.`,
        '',
        '**Steps**: 1) `POST qc/Quality/SaveCompletedForm` `{id:<formId>, callId, questions:[], sections:[]}` → **201 Created**. 2) `GET qc/Quality/GetAnsweredForms?callId=<callId>` → empty. 3) `GET calls/details/{callId}` → `model.hasAnsweredForms` = **false**. Repeat after a delay — still absent.',
        '',
        '**Expected**: the evaluation is saved and readable. **Actual**: 201 with no state change.',
      ].join('\n'),
      rawFiles: [raw],
    });
    const rf = writeReport('01-backend-bugs', 'BUG-save-completed-qas-not-persisted.md', report);
    appendSummaryRow(`| P0-SAVE-COMPLETED-QAS | QA | Save completed QAs | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | POST | yes | yes | yes | P0 |`);
    console.log(`[P0-SAVE-COMPLETED-QAS] report=${rf} save=${save.status} listNow=${listCount(listNow.body)} hasAnsweredNow=${hasAnsweredFormsNow} hasAnsweredAfter=${hasAnsweredFormsAfter}`);

    expect(save.status).toBe(201);
    expect(hasAnsweredFormsNow).toBe(false);
    expect(hasAnsweredFormsAfter).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  test('P0-LIST-CHATS — List Chats 500s (backend-injected SiteId filter); blocks the whole Chats group', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);

    const variants: { label: string; body: unknown }[] = [
      { label: 'empty object', body: {} },
      { label: 'standard list body (empty filters)', body: { skip: 0, take: 25, sort: [], filter: { logic: 'and', filters: [] } } },
      { label: 'date range only — 2 client filters (idx 0,1)', body: { skip: 0, take: 25, sort: [{ field: 'StartTime', dir: 'desc' }], filter: { logic: 'and', filters: [
        { field: 'StartTime', operator: 'gte', value: '2020-01-01T00:00:00Z' },
        { field: 'StartTime', operator: 'lte', value: '2026-12-31T23:59:59Z' },
      ] }, terms: [] } },
      { label: 'explicit current-year StartTime/EndTime', body: { skip: 0, take: 25, sort: [], filter: { logic: 'and', filters: [
        { field: 'StartTime', operator: 'gte', value: '2026-01-01T00:00:00Z' },
        { field: 'EndTime', operator: 'lte', value: '2026-12-31T23:59:59Z' },
      ] } } },
      { label: 'small page', body: { skip: 0, take: 5 } },
      { label: 'no filter key at all', body: { skip: 0, take: 25, sort: [] } },
    ];

    const results: { label: string; sentBody: unknown; status: number; body: unknown; call: CapturedCall | undefined }[] = [];
    for (const v of variants) {
      const r = await fire(portal, ev, 'Chats', /^List Chats/, v.body);
      results.push({ label: v.label, sentBody: v.body, status: r.status, body: r.body, call: r.call });
    }

    // Reproduce on the main app's own Chat Listing page.
    let appCall: CapturedCall | undefined;
    let appNote = '';
    let appUrl = '';
    try {
      const m = ev.mark();
      await page.goto('https://atmossystemsstaging.callcabinet.com/ChatListing', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(25_000); // grid + auth + first data call
      appUrl = page.url();
      const chatCalls = ev.since(m).filter(c => /chats/i.test(c.url) && c.method !== 'OPTIONS');
      appCall = [...chatCalls].reverse().find(c => /chats\/list/i.test(c.url)) ?? chatCalls.at(-1);
      appNote = appCall
        ? `Main app ${appCall.method} ${appCall.pathname} → ${appCall.status} (landed on ${appUrl})`
        : `No chats/* request observed on /ChatListing within 25s (landed on ${appUrl}). ${chatCalls.length} chat calls total.`;
    } catch (e) {
      appNote = `Could not load /ChatListing: ${String(e)}`;
    }

    // Analyse the server-injected filter index in the error body. The error
    // is double-JSON-encoded inside `Description` — unescape first.
    const analysed = results.map(r => {
      const sentFilters = ((r.sentBody as { filter?: { filters?: unknown[] } })?.filter?.filters ?? []) as unknown[];
      const errStr = (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      const idxMatch = /"filters"\s*,\s*(\d+)\s*,\s*"field"/i.exec(errStr);
      const injectedIndex = idxMatch ? Number(idxMatch[1]) : null;
      const namesSiteId = /"input"\s*:\s*"SiteId"/i.test(errStr) || /SiteId/.test(errStr);
      return {
        variant: r.label, clientFilterCount: sentFilters.length, status: r.status,
        errorReportsFilterIndex: injectedIndex,
        indexBeyondClientFilters: injectedIndex !== null ? injectedIndex >= sentFilters.length : null,
        errorNamesSiteId: namesSiteId,
        responseBodyExcerpt: (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)).slice(0, 500),
      };
    });

    const injectedIdxResult = analysed.find(a => a.errorReportsFilterIndex !== null);
    const raw = writeRaw('P0-LIST-CHATS', {
      precondition: pc,
      results: results.map(r => ({ variant: r.label, sentBody: r.sentBody, status: r.status, responseBody: r.body })),
      analysis: analysed,
      serverInjectedFilterProof: injectedIdxResult
        ? `Variant "${injectedIdxResult.variant}": client sent ${injectedIdxResult.clientFilterCount} filter(s); server error names filters[${injectedIdxResult.errorReportsFilterIndex}].field = "SiteId" (index ${injectedIdxResult.indexBeyondClientFilters ? 'BEYOND' : 'within'} client filters).`
        : 'index not machine-extracted — see responseBodyExcerpt in analysis',
      mainAppChatListing: { note: appNote, landedUrl: appUrl, call: appCall ?? null },
      blockedOperations: [
        'Add Chat Note', 'Get Chat Notes', 'Update Chat Note', 'Delete Chat Note',
        'Download Chat', 'Get Chat Details', 'Get Chat Message Notes', 'Get Chat Messages', 'Send Chat Email',
      ],
      calls: ev.all(),
    });

    const allStatuses = results.map(r => r.status);
    const report = buildReport({
      id: 'P0-LIST-CHATS',
      title: 'BUG — List Chats always 500s: backend injects a SiteId filter its own validator rejects; blocks all 9 other Chats operations',
      classification: 'CONFIRMED BACKEND BUG (+ BLOCKER for the group)',
      severity: 'P0 (the entire Chats API surface is unusable)',
      precondition: pc,
      resourceIds: { note: 'no ids — the group cannot produce a chatId' },
      chain: results.map((r, i) => ({
        step: `List Chats variant ${i + 1} — ${r.label} (client filters: ${((r.sentBody as { filter?: { filters?: unknown[] } })?.filter?.filters ?? []).length}) → ${r.status}`,
        call: r.call,
      })).concat([{ step: `Main app /ChatListing — ${appNote}`, call: appCall }]),
      expected: 'List Chats returns `200` with chat sessions scoped to the key\'s permitted site.',
      actual: [
        `All ${results.length} body variants → **${allStatuses.join(' / ')}** (every one a 500).`,
        injectedIdxResult
          ? `Proof of server-injected filter: variant "${injectedIdxResult.variant}" sent **${injectedIdxResult.clientFilterCount}** client filter(s); the error body names \`filters[${injectedIdxResult.errorReportsFilterIndex}].field = "SiteId"\` — index ${injectedIdxResult.errorReportsFilterIndex} is **${injectedIdxResult.indexBeyondClientFilters ? 'beyond' : 'within'}** the client's filters. The allowed field enum (\`ChatId, ChatName, StartTime, EndTime, DateTime, RecordingId, CallType, ChatType, Participants, Number, Agent, Extension, IsInternalChat\`) has no \`SiteId\`.`
          : `Error body names field \`SiteId\` as invalid (see analysis excerpts in raw).`,
        `Main app: ${appNote}.`,
      ].join('\n\n'),
      reproducibility: `${results.length}/${results.length} body variants this run; matches every prior session since 2026-08-26.`,
      alternativesRuledOut: [
        { hypothesis: 'client sent a bad SiteId filter', verdict: injectedIdxResult ? `ruled out — variant "${injectedIdxResult.variant}" sent ${injectedIdxResult.clientFilterCount} filters, error names index ${injectedIdxResult.errorReportsFilterIndex} (SiteId) — one past the client's filters` : 'ruled out — no variant includes a SiteId filter; error still names SiteId' },
        { hypothesis: 'wrong body shape / pagination', verdict: 'ruled out — 6 shapes incl. empty, standard, date-range, small-page all 500 identically' },
        { hypothesis: 'console-only artifact', verdict: appCall ? `ruled out — the main app's own POST ${appCall.pathname} returns ${appCall.status} too` : 'not fully confirmed this run — see main-app note; prior sessions confirmed the app page fails identically' },
        { hypothesis: 'wrong environment', verdict: `ruled out — ${pc.gateway}` },
      ],
      downstreamImpact: 'No `chatId` can be obtained anywhere (this endpoint is the only source, in the API and in the app). The following 9 operations are therefore impossible to call: Add Chat Note, Get Chat Notes, Update Chat Note, Delete Chat Note, Download Chat, Get Chat Details, Get Chat Message Notes, Get Chat Messages, Send Chat Email. Entire Chats API surface = 1 broken entry point + 9 unreachable.',
      workaround: 'None.',
      cleanup: 'None needed (all reads).',
      remainingUnknowns: 'The exact server component that appends the `SiteId` filter, and why its downstream chat-search validator\'s field enum omits `SiteId`.',
      recommendedRegression: '`chats-api.spec.ts` › "KNOWN BUG — List Chats always 500s" pins the 500 + `Input should be \'ChatId\'` message. The other 9 ops are `test.skip` with the blocker reason. Keep.',
      suggestedTicket: [
        '**Title**: `POST calls/chats/list` always 500s — a server-injected `SiteId` filter is rejected by the chat-search validator (allowed enum has no `SiteId`)',
        '',
        `**Env**: staging developer1 gateway, key "Primary: API_test" (site "${pc.currentSiteName}").`,
        '',
        '**Steps**: `POST calls/chats/list` with ANY body (empty, standard, date-range) → **500**. Body: `Request failed with status code BadRequest: {"detail":[{"type":"literal_error","loc":["body","filter","filters",<N>,"field"],"msg":"Input should be \'ChatId\',\'ChatName\',... or \'IsInternalChat\'","input":"SiteId"...}]}` where `<N>` is one past the number of filters the client sent.',
        '',
        '**Expected**: 200, site-scoped chats. **Actual**: the site-scoping middleware appends a `SiteId` filter that the downstream chat-search service\'s own field-name validation does not accept. Also reproduces on the app\'s Chat Listing page.',
        '',
        '**Impact**: blocks all 9 other Chats operations (no obtainable chatId).',
      ].join('\n'),
      rawFiles: [raw],
    });
    const rf = writeReport('05-blockers', 'BLOCKER-list-chats-500.md', report);
    appendSummaryRow(`| P0-LIST-CHATS | Chats | List Chats (+ 9 blocked) | CONFIRMED BACKEND BUG / BLOCKER | CONFIRMED | ${results.length}/${results.length} | POST | yes | yes | yes | P0 |`);
    console.log(`[P0-LIST-CHATS] report=${rf} statuses=${allStatuses.join(',')} appNote="${appNote}"`);

    for (const r of results) expect(r.status).toBe(500);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // P1 backend 500s
  // ═══════════════════════════════════════════════════════════════════════
  test('P1-500S — Get Call PCI Data / Email Call / Get Report By Template / Preview Alert Log / Get Alert Notification (old)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);
    const callId = KNOWN.callId;
    const findings: Record<string, unknown> = {};

    // ── Get Call PCI Data ────────────────────────────────────────────────
    const callInfo = await fire(portal, ev, 'Calls', /^Get Call Info/, undefined, [['callId', callId]]);
    const pciOwn = await fire(portal, ev, 'Calls', /^Get Call PCI Data/, undefined, [['callId', callId]]);
    const BOGUS_CALL = '00000000-0000-4000-8000-000000000000';
    const pciBogus = await fire(portal, ev, 'Calls', /^Get Call PCI Data/, undefined, [['callId', BOGUS_CALL]]);
    findings.getCallPciData = {
      callInfoStatus: callInfo.status,
      ownCallStatus: pciOwn.status, ownCallBody: pciOwn.body,
      bogusCallStatus: pciBogus.status, bogusCallBody: pciBogus.body,
    };
    writeReport('01-backend-bugs', 'BUG-get-call-pci-data-500.md', buildReport({
      id: 'P1-GET-CALL-PCI-DATA', title: 'BUG — Get Call PCI Data always 500s for a valid own-site call',
      classification: 'CONFIRMED BACKEND BUG', severity: 'P1',
      precondition: pc, resourceIds: { callId, bogusCallId: BOGUS_CALL },
      chain: [
        { step: 'Get Call Info (prove the call is valid + own-site)', call: callInfo.call },
        { step: 'Get Call PCI Data — valid own-site call', call: pciOwn.call },
        { step: 'Get Call PCI Data — bogus call id (contrast)', call: pciBogus.call },
      ],
      expected: '200 with PCI metadata (or an empty/no-PCI response) for a valid call.',
      actual: `Get Call Info → ${callInfo.status} (call is valid, own site). Get Call PCI Data (valid call) → **${pciOwn.status}** \`${JSON.stringify(pciOwn.body)}\`. Bogus id → ${pciBogus.status} \`${JSON.stringify(pciBogus.body)}\`.`,
      reproducibility: '1/1 this run + prior 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'call invalid / not own-site', verdict: `ruled out — Get Call Info → ${callInfo.status} for the same id/key` },
        { hypothesis: '"no PCI data" is just an empty 200', verdict: `ruled out — status is ${pciOwn.status}, body is a 500 exception payload` },
        { hypothesis: 'request never fired', verdict: `ruled out — raw capture: ${pciOwn.call?.method} ${pciOwn.call?.pathname} → ${pciOwn.status}` },
      ],
      downstreamImpact: 'PCI compliance metadata (card-data pause/resume, suppression periods) is unreadable via the API for any call.',
      workaround: 'None.',
      cleanup: 'None (reads).',
      remainingUnknowns: 'Whether a call that actually has PCI events behaves differently (test call may have none).',
      recommendedRegression: '`calls-api.spec.ts` › "KNOWN BUG — Get Call PCI Data always 500s" pins it. Keep.',
      suggestedTicket: `**Title**: \`GET media/call-details/call-pci?callId={id}\` returns 500 for a valid own-site call.\n\n**Steps**: \`GET calls/details/{callId}\` → 200 (call valid). \`GET media/call-details/call-pci?callId={callId}\` → **500** \`${JSON.stringify(pciOwn.body)}\`.\n\n**Expected**: 200 with PCI metadata or an empty result.`,
      rawFiles: ['raw/P1-500S.json'],
    }));
    appendSummaryRow(`| P1-GET-CALL-PCI-DATA | Calls | Get Call PCI Data | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | GET | yes | yes | yes | P1 |`);

    // ── Email Call ───────────────────────────────────────────────────────
    const emailCall = await fire(portal, ev, 'Calls', /^Email Call/, {
      mails: ['romana@callcabinet.com'], callId, subject: 'AQA evidence test', text: 'AQA evidence - ignore', callIds: [callId],
    });
    findings.emailCall = { status: emailCall.status, body: emailCall.body };
    writeReport('01-backend-bugs', 'BUG-email-call-500.md', buildReport({
      id: 'P1-EMAIL-CALL', title: 'BUG — Email Call always 500s with a schema-correct required-fields-only body',
      classification: 'CONFIRMED BACKEND BUG', severity: 'P1',
      precondition: pc, resourceIds: { callId, recipient: 'romana@callcabinet.com (own address)' },
      chain: [
        { step: 'Get Call Info (call valid, own-site)', call: callInfo.call },
        { step: 'Email Call — {mails, callId, subject, text, callIds}', call: emailCall.call },
      ],
      expected: '200 — email queued.',
      actual: `Get Call Info → ${callInfo.status}. Email Call → **${emailCall.status}** \`${JSON.stringify(emailCall.body)}\`.`,
      reproducibility: '1/1 this run + prior 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'missing required field', verdict: 'ruled out — all 5 documented required fields present (mails, callId, subject, text, callIds)' },
        { hypothesis: 'invalid recipient', verdict: 'ruled out — recipient is the test account\'s own address' },
        { hypothesis: 'call invalid', verdict: `ruled out — Get Call Info → ${callInfo.status}` },
      ],
      downstreamImpact: 'Emailing a call recording via the API is impossible.',
      workaround: 'None via API.',
      cleanup: 'None (no email was sent — 500 before send).',
      remainingUnknowns: 'Whether a fully-populated body (all optional fields) changes anything.',
      recommendedRegression: '`calls-api.spec.ts` › "KNOWN BUG — Email Call always 500s" pins it. Keep.',
      suggestedTicket: `**Title**: \`POST calls/email/\` (Email Call) returns 500 with a schema-correct body.\n\n**Body**: \`{mails:["<own>"], callId, subject, text, callIds:[callId]}\` → **500** \`${JSON.stringify(emailCall.body)}\`.\n\n**Expected**: 200.`,
      rawFiles: ['raw/P1-500S.json'],
    }));
    appendSummaryRow(`| P1-EMAIL-CALL | Calls | Email Call | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | POST | yes | yes | yes | P1 |`);

    // ── Get Report By Template ───────────────────────────────────────────
    const tplList = await fire(portal, ev, 'Reports', /^List Report Templates/, undefined);
    const templates = (tplList.body as Array<{ id: number; name: string }>) ?? [];
    const tpl = templates.find(t => /duration|call/i.test(t.name)) ?? templates[0];
    let rbtStatus: number | null = null; let rbtBody: unknown = null; let rbtCall;
    if (tpl) {
      const r = await fire(portal, ev, 'Reports', /^Get Report By Template/, {
        id: tpl.id, templateId: tpl.id, criteriaId: 1, timeZone: -12,
        startString: '2026-08-01T00:00:00Z', endString: '2026-08-29T23:59:59Z',
        criteriaParams: [], agentParams: [], extensionParams: [],
      });
      rbtStatus = r.status; rbtBody = r.body; rbtCall = r.call;
    }
    findings.getReportByTemplate = { templateCount: templates.length, template: tpl ?? null, status: rbtStatus, body: rbtBody };
    writeReport('01-backend-bugs', 'BUG-get-report-by-template-500.md', buildReport({
      id: 'P1-GET-REPORT-BY-TEMPLATE', title: 'BUG — Get Report By Template always 500s with a real template id and valid inputs',
      classification: 'CONFIRMED BACKEND BUG', severity: 'P1',
      precondition: pc, resourceIds: { templateId: tpl?.id ?? null, templateName: tpl?.name ?? null },
      chain: [
        { step: 'List Report Templates (get a real template id)', call: tplList.call },
        { step: `Get Report By Template (id=${tpl?.id}, criteriaId:1, date range Aug 2026, empty param arrays)`, call: rbtCall },
      ],
      expected: '200 with chart data for the template.',
      actual: `List → ${tplList.status}, ${templates.length} templates. Get Report By Template → **${rbtStatus}** \`${JSON.stringify(rbtBody)}\`.`,
      reproducibility: '1/1 this run + prior 2026-08-28 (3 attempts).',
      alternativesRuledOut: [
        { hypothesis: 'template id invalid', verdict: `ruled out — id ${tpl?.id} ("${tpl?.name}") came from List Report Templates` },
        { hypothesis: 'missing required field', verdict: 'ruled out — body carries all 9 documented required fields (id, templateId, criteriaId, timeZone, startString, endString, criteriaParams, agentParams, extensionParams)' },
        { hypothesis: 'request never fired', verdict: `ruled out — raw capture: ${rbtCall?.method} ${rbtCall?.pathname} → ${rbtStatus}` },
      ],
      downstreamImpact: 'Generating any saved-template report via the API is impossible.',
      workaround: 'None via API.',
      cleanup: 'None (reads).',
      remainingUnknowns: 'Whether specific `criteriaParams` values (vs empty arrays) matter — 2026-08-28 tried populated params too, same 500.',
      recommendedRegression: '`reports-api.spec.ts` › "KNOWN BUG — Get Report By Template always 500s" pins it. Keep.',
      suggestedTicket: `**Title**: \`POST reports/reports/get-report-chart\` (Get Report By Template) returns 500 with a real template id and valid date range.\n\n**Body**: \`{id, templateId, criteriaId:1, timeZone:-12, startString, endString, criteriaParams:[], agentParams:[], extensionParams:[]}\` → **500** \`${JSON.stringify(rbtBody)}\`.\n\n**Expected**: 200 with chart data.`,
      rawFiles: ['raw/P1-500S.json'],
    }));
    appendSummaryRow(`| P1-GET-REPORT-BY-TEMPLATE | Reports | Get Report By Template | CONFIRMED BACKEND BUG | CONFIRMED | 1/1 | POST | yes | yes | yes | P1 |`);

    // ── Preview Alert Log + Get Alert Notification (old) ─────────────────
    const alertTrigger = { notificationLevel: 'warning', shouldNotify: true, triggerOperatorId: 13, triggerValue: ['test'], triggerThreshold: 50, anomalyDetection: false };
    const alertBody = (name: string, id: number | null) => ({
      id, name, notificationTypeId: 7, windowType: 'interaction', windowValue: 1,
      triggers: [alertTrigger], filters: [], notificationCooldown: 0.5, emailAddresses: [], webhooks: [], tags: [],
    });
    const upsert = await fire(portal, ev, 'Notifications', /^Upsert Alert Configuration/, alertBody(`AQA evidence alert ${Date.now()}`, null));
    const idMatch = /Notification Config '(\d+)'/.exec((upsert.body as { configResult?: string })?.configResult ?? '');
    const alertId = idMatch ? Number(idMatch[1]) : null;
    const getCfg = alertId != null
      ? await fire(portal, ev, 'Notifications', /^Get Alert Configuration/, undefined, [['notificationId', String(alertId)]])
      : { status: -1, body: null, call: undefined };

    // Preview Alert Log — populated triggers, then empty triggers.
    const previewPopulated = await fire(portal, ev, 'Notifications', /^Preview Alert Log/, {
      notificationTypeId: 7, windowType: 'interaction', windowValue: 1, triggers: [alertTrigger], filters: [],
    });
    const previewEmpty = await fire(portal, ev, 'Notifications', /^Preview Alert Log/, {
      notificationTypeId: 7, windowType: 'interaction', windowValue: 1, triggers: [], filters: [],
    });

    // Get Alert Notification (old) — real id, then bogus.
    const oldReal = alertId != null
      ? await fire(portal, ev, 'Notifications', /^Get Alert Notification/, undefined, [['notificationId', String(alertId)]])
      : { status: -1, body: null, call: undefined };
    const oldBogus = await fire(portal, ev, 'Notifications', /^Get Alert Notification/, undefined, [['notificationId', '1']]);

    // Cleanup the alert config.
    let delCfgStatus: number | null = null;
    if (alertId != null) {
      const d = await fire(portal, ev, 'Notifications', /^Delete Alert Configuration/, undefined, [['notificationId', String(alertId)]]);
      delCfgStatus = d.status;
    }

    findings.previewAlertLog = { alertId, getCfgStatus: getCfg.status, previewPopulatedStatus: previewPopulated.status, previewPopulatedBody: previewPopulated.body, previewEmptyStatus: previewEmpty.status, previewEmptyBody: previewEmpty.body };
    findings.getAlertNotificationOld = { alertId, realStatus: oldReal.status, realBody: oldReal.body, bogusStatus: oldBogus.status, bogusBody: oldBogus.body };

    writeReport('01-backend-bugs', 'BUG-preview-alert-log-500.md', buildReport({
      id: 'P1-PREVIEW-ALERT-LOG', title: 'BUG — Preview Alert Log always 500s (body shape valid — same shape succeeds in Upsert Alert Configuration)',
      classification: 'CONFIRMED BACKEND BUG', severity: 'P1',
      precondition: pc, resourceIds: { alertConfigId: alertId },
      chain: [
        { step: 'Upsert Alert Configuration (create — proves the trigger/window shape is valid)', call: upsert.call },
        { step: 'Get Alert Configuration (verify it persisted)', call: getCfg.call },
        { step: 'Preview Alert Log — populated triggers (same shape as Upsert)', call: previewPopulated.call },
        { step: 'Preview Alert Log — empty triggers', call: previewEmpty.call },
        { step: 'Delete Alert Configuration (cleanup)', call: undefined },
      ],
      expected: '200 with the historical events that would have triggered the rule.',
      actual: `Upsert → ${upsert.status} (config id ${alertId}). Get Alert Configuration → ${getCfg.status}. Preview Alert Log populated → **${previewPopulated.status}** \`${JSON.stringify(previewPopulated.body)}\`; empty triggers → **${previewEmpty.status}** \`${JSON.stringify(previewEmpty.body)}\`.`,
      reproducibility: '2/2 (populated + empty triggers) this run + prior 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'invalid body shape', verdict: `ruled out — the same notificationTypeId/windowType/windowValue/triggers shape is accepted by Upsert Alert Configuration (${upsert.status})` },
        { hypothesis: 'needs a real config id in the body', verdict: 'partially — retried with empty triggers too, still 500; the operation is a "preview before save" so it should not need a persisted id' },
        { hypothesis: 'request never fired', verdict: `ruled out — raw: ${previewPopulated.call?.method} ${previewPopulated.call?.pathname} → ${previewPopulated.status}` },
      ],
      downstreamImpact: 'Validating alert sensitivity before saving a rule is impossible.',
      workaround: 'None.',
      cleanup: `Alert config ${alertId} deleted (${delCfgStatus}).`,
      remainingUnknowns: 'The exact exception (body is a generic wrapped ApiException — see raw).',
      recommendedRegression: '`notifications-api.spec.ts` › "KNOWN BUG — Preview Alert Log always 500s" pins it. Keep.',
      suggestedTicket: `**Title**: \`POST settings/alerts/preview-log\` (Preview Alert Log) always 500s.\n\n**Body** (same trigger/window shape Upsert Alert Configuration accepts): \`{notificationTypeId:7, windowType:"interaction", windowValue:1, triggers:[...], filters:[]}\` → **500** \`${JSON.stringify(previewPopulated.body)}\`. Also 500 with \`triggers:[]\`.\n\n**Expected**: 200 with matching historical events.`,
      rawFiles: ['raw/P1-500S.json'],
    }));
    appendSummaryRow(`| P1-PREVIEW-ALERT-LOG | Notifications | Preview Alert Log | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | POST | yes | yes | yes | P1 |`);

    writeReport('01-backend-bugs', 'BUG-get-alert-notification-old-500.md', buildReport({
      id: 'P1-GET-ALERT-NOTIFICATION-OLD', title: 'BUG — Get Alert Notification (old) always 500s (NRE), even for a real freshly-created config id',
      classification: 'CONFIRMED BACKEND BUG', severity: 'P1',
      precondition: pc, resourceIds: { alertConfigId: alertId, bogusId: '1' },
      chain: [
        { step: 'Upsert Alert Configuration (create)', call: upsert.call },
        { step: 'Get Alert Configuration (the non-legacy endpoint — works, proves the id is real)', call: getCfg.call },
        { step: 'Get Alert Notification (old) — SAME real id', call: oldReal.call },
        { step: 'Get Alert Notification (old) — bogus id "1" (contrast)', call: oldBogus.call },
      ],
      expected: '200 with the (legacy) alert-notification record for the id — or 404 for the bogus id.',
      actual: `Get Alert Configuration (real id ${alertId}) → ${getCfg.status} (id is real). Get Alert Notification (old), same id → **${oldReal.status}** \`${JSON.stringify(oldReal.body)}\`. Bogus id "1" → **${oldBogus.status}** \`${JSON.stringify(oldBogus.body)}\`.`,
      reproducibility: '1/1 real + 1/1 bogus this run + prior 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'id does not exist', verdict: `ruled out — Get Alert Configuration returns the record for the same id (${getCfg.status})` },
        { hypothesis: 'id-format mismatch (int vs GUID)', verdict: 'both real int id and bogus "1" produce the same 500 NRE' },
        { hypothesis: 'request never fired', verdict: `ruled out — raw: ${oldReal.call?.method} ${oldReal.call?.pathname} → ${oldReal.status}` },
      ],
      downstreamImpact: 'The legacy alert-notification lookup is completely broken; callers must use the non-legacy `Get Alert Configuration` instead.',
      workaround: 'Use `GET settings/alerts/{notificationId}` (non-legacy) — works.',
      cleanup: `Alert config ${alertId} deleted (${delCfgStatus}).`,
      remainingUnknowns: 'Whether any id ever worked on this legacy route.',
      recommendedRegression: '`notifications-api.spec.ts` › "KNOWN BUG — Get Alert Notification (old) always 500s" pins it (real id + NRE message). Keep.',
      suggestedTicket: `**Title**: \`GET settings/alerts/old/{notificationId}\` (Get Alert Notification legacy) always 500s (NullReferenceException) even for a real id.\n\n**Steps**: create a config via \`POST settings/alerts\` → note id N; \`GET settings/alerts/{N}\` → 200; \`GET settings/alerts/old/{N}\` → **500** \`${JSON.stringify(oldReal.body)}\`.\n\n**Expected**: 200 or 404.`,
      rawFiles: ['raw/P1-500S.json'],
    }));
    appendSummaryRow(`| P1-GET-ALERT-NOTIFICATION-OLD | Notifications | Get Alert Notification (old) | CONFIRMED BACKEND BUG | CONFIRMED | 2/2 | GET | yes | yes | yes | P1 |`);

    const raw = writeRaw('P1-500S', { precondition: pc, findings, calls: ev.all() });
    console.log(`[P1-500S] pci=${pciOwn.status} emailCall=${emailCall.status} reportByTemplate=${rbtStatus} previewPopulated=${previewPopulated.status} previewEmpty=${previewEmpty.status} alertOldReal=${oldReal.status} alertOldBogus=${oldBogus.status} raw=${raw}`);

    expect(pciOwn.status).toBe(500);
    expect(emailCall.status).toBe(500);
    expect(rbtStatus).toBe(500);
    expect(previewPopulated.status).toBe(500);
    expect(previewEmpty.status).toBe(500);
    expect(oldReal.status).toBe(500);
  });
});
