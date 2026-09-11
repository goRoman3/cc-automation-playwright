import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  API_KEY_OPTION, KNOWN, LIST_BODY, LIST_BODY_100,
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs, sendJson, openConsole,
} from './_helpers';
import {
  NetworkEvidence, writeRaw, writeReport, appendSummaryRow, buildReport,
  type Precondition, type CapturedCall,
} from './_evidence';

const GIT = { branch: 'feature/chat-listing', commit: 'ed251c2' };

test.describe('Developer Portal (staging) — batch 4 evidence', () => {
  test.describe.configure({ timeout: 300_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);
  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  async function precondition(portal: DeveloperPortalPage): Promise<Precondition> {
    let siteId: string | null = null; let siteName: string | null = null;
    try {
      const o = await openConsole(portal, 'Reports', /^List Sites Storage Usage/, { retries: 3 });
      await o.selectSubscriptionKey(API_KEY_OPTION);
      const { body } = await o.send();
      const f = (body as Array<{ siteId?: string; id?: string; siteName?: string; name?: string }>)[0];
      siteId = f?.siteId ?? f?.id ?? null; siteName = f?.siteName ?? f?.name ?? null;
    } catch { /* null */ }
    return {
      timestamp: new Date().toISOString(),
      app: 'https://atmossystemsstaging.callcabinet.com (TWO s)',
      developerPortal: 'https://developer1-portal.callcabinet.com',
      gateway: 'https://developer1.callcabinet.com',
      company: 'CC Test 1', account: process.env.user ?? '(unset)',
      subscriptionKey: API_KEY_OPTION, currentSiteId: siteId, currentSiteName: siteName,
      gitBranch: GIT.branch, gitCommit: GIT.commit,
    };
  }

  async function fire(
    portal: DeveloperPortalPage, ev: NetworkEvidence, group: string, op: RegExp,
    body: unknown | undefined, params?: [string, string][],
  ): Promise<{ status: number; body: unknown; call: CapturedCall | undefined; threw: string | null }> {
    const o = await openConsole(portal, group, op, { retries: 4 });
    await o.selectSubscriptionKey(API_KEY_OPTION);
    for (const [n, v] of params ?? []) await o.addParameter(n, v);
    const m = ev.mark();
    try {
      const r = body === undefined ? await o.send() : await sendJson(o, portal.raw, body);
      return { ...r, call: ev.apiSince(m).at(-1), threw: null };
    } catch (e) {
      return { status: -1, body: null, call: ev.apiSince(m).at(-1), threw: String(e) };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  test('P1-LIST-CALLS-ROUTE — List Calls: documented vs actual outgoing URL (/api/ prefix)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);

    // A known-working Calls endpoint for contrast.
    const info = await fire(portal, ev, 'Calls', /^Preview Call Info/, undefined, [['callId', KNOWN.callId]]);
    // List Calls itself.
    const list = await fire(portal, ev, 'Calls', /^List Calls/, LIST_BODY);

    const infoUrl = info.call?.url ?? '(not captured)';
    const listUrl = list.call?.url ?? '(not captured)';
    const listHasApi = /\/api\/calls\/calls\/search/i.test(listUrl);
    const infoHasApi = /\/api\/calls\//i.test(infoUrl);
    const status = listHasApi && list.status === 200 ? 'NOT REPRODUCED (List Calls routes via /api/ and returns 200)'
      : (!listHasApi ? 'CONFIRMED (missing /api/ prefix)' : `PARTIAL (has /api/ but status ${list.status})`);

    const raw = writeRaw('P1-LIST-CALLS-ROUTE', {
      precondition: pc,
      getCallInfo: { url: infoUrl, status: info.status, hasApiPrefix: infoHasApi },
      listCalls: { url: listUrl, status: list.status, hasApiPrefix: listHasApi, body: list.body },
      calls: ev.all(),
    });
    writeReport('01-backend-bugs', 'CHECK-list-calls-route.md', buildReport({
      id: 'P1-LIST-CALLS-ROUTE', title: 'List Calls — documented vs actual outgoing URL / missing `/api/` prefix (re-investigation)',
      classification: status, severity: 'P1',
      precondition: pc, resourceIds: { callId: KNOWN.callId },
      chain: [
        { step: 'Get Call Info (known-working Calls endpoint, for URL contrast)', call: info.call },
        { step: 'List Calls (calls/calls/search)', call: list.call },
      ],
      expected: 'List Calls routes to `https://developer1.callcabinet.com/api/calls/calls/search/` (like every other working Calls endpoint) and returns 200.',
      actual: `Get Call Info outgoing URL: \`${infoUrl}\` → ${info.status} (has /api/: ${infoHasApi}). List Calls outgoing URL: \`${listUrl}\` → **${list.status}** (has /api/: **${listHasApi}**).`,
      reproducibility: '1/1 this run.',
      alternativesRuledOut: [
        { hypothesis: 'wrong environment', verdict: `ruled out — ${pc.gateway}` },
        { hypothesis: 'body shape', verdict: `standard list body; contrast endpoint (Get Call Info) works with /api/ (${info.status})` },
      ],
      downstreamImpact: listHasApi && list.status === 200 ? 'None currently — List Calls works on staging this run.' : 'List Calls is unusable (500, misrouted).',
      workaround: listHasApi ? 'n/a' : 'None (route is server-side misconfigured per its own docs).',
      cleanup: 'None (reads).',
      remainingUnknowns: 'Whether the operation\'s catalogue "Endpoint:" doc line still shows the `/api/`-less URL even if the request now routes correctly (docs vs behaviour).',
      recommendedRegression: listHasApi && list.status === 200
        ? '`calls-api.spec.ts` › "List Calls — 200 baseline" already covers the working path. `tenant-scoping-bugs.spec.ts` › "Bug 1 — List Calls 500s ..." should be re-checked and either updated or removed if the route is fixed.'
        : 'Keep `tenant-scoping-bugs.spec.ts` Bug 1.',
      suggestedTicket: listHasApi && list.status === 200
        ? '(No ticket — List Calls routes via `/api/` and returns 200 this run. If the catalogue doc line still shows the prefix-less URL, file a docs-only fix.)'
        : `**Title**: List Calls (\`calls/calls/search\`) routes without the \`/api/\` prefix → 500.\n\n**Actual outgoing URL**: \`${listUrl}\` → ${list.status}. **Working endpoints** use \`.../api/calls/...\` (e.g. Get Call Info → \`${infoUrl}\`).`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-LIST-CALLS-ROUTE | Calls | List Calls | ${listHasApi && list.status === 200 ? 'NOT REPRODUCED' : 'CONFIRMED'} | ${listHasApi && list.status === 200 ? 'NOT REPRODUCED' : 'CONFIRMED'} | 1/1 | POST | yes | yes | partial | P1 |`);
    console.log(`[P1-LIST-CALLS-ROUTE] listUrl=${listUrl} status=${list.status} hasApi=${listHasApi} | infoUrl=${infoUrl} status=${info.status}`);
    expect(info.status).toBe(200); // sanity: the contrast endpoint works
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SKIPPED 2026-09-03: this was a one-time investigation (filed to ADO
  // #38119, filing complete — docs/ado-bug-filing-progress.md) probing the
  // same "equals" operator on TWO fields (Name + SiteName) to determine
  // field-specificity. That question is already answered (operator-wide,
  // not field-specific) and doesn't need re-deriving on every suite run —
  // one field is enough to regression-check the confirmed bug going
  // forward, which now lives as a permanent, lean test in
  // `extension-management-api.spec.ts` ("KNOWN BUG (ADO #38119)"). Kept
  // here `skip`ped rather than deleted so the original 6-probe evidence
  // trail (raw capture + report already on disk) stays reproducible.
  test.skip('P1-LIST-EXTENSIONS-EQUALS-FILTER — "equals" operator 500s (operator-wide or field-specific?)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);

    const baseline = await fire(portal, ev, 'Extension Management', /^List Extensions/, LIST_BODY_100);
    const rows = (baseline.body as Array<{ name: string; siteName: string }>) ?? [];
    const realName = rows[0]?.name ?? 'x';
    const realSiteName = rows[0]?.siteName ?? pc.currentSiteName ?? 'x';

    const mk = (field: string, operator: string, value: string) => ({
      skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field, operator, value }] },
    });
    const matrix: { label: string; body: unknown }[] = [
      { label: 'Name eq <real>', body: mk('Name', 'eq', realName) },
      { label: 'Name contains <real>', body: mk('Name', 'contains', realName.slice(0, 3)) },
      { label: 'Name equals <real>', body: mk('Name', 'equals', realName) },
      { label: 'SiteName eq <real>', body: mk('SiteName', 'eq', realSiteName) },
      { label: 'SiteName equals <real>', body: mk('SiteName', 'equals', realSiteName) },
      { label: 'SiteName contains <real>', body: mk('SiteName', 'contains', realSiteName.slice(0, 3)) },
    ];
    const results: { label: string; body: unknown; status: number; resp: unknown; call?: CapturedCall }[] = [];
    for (const t of matrix) {
      const r = await fire(portal, ev, 'Extension Management', /^List Extensions/, t.body);
      results.push({ label: t.label, body: t.body, status: r.status, resp: r.body, call: r.call });
    }
    const equalsRows = results.filter(r => / equals /.test(r.label));
    const nonEqualsRows = results.filter(r => !/ equals /.test(r.label));
    const equalsAll500 = equalsRows.every(r => r.status === 500);
    const nonEqualsAllOk = nonEqualsRows.every(r => r.status === 200);
    const operatorWide = equalsAll500 && nonEqualsAllOk;

    const raw = writeRaw('P1-LIST-EXTENSIONS-EQUALS-FILTER', {
      precondition: pc, baselineStatus: baseline.status, baselineCount: rows.length, realName, realSiteName,
      matrix: results.map(r => ({ label: r.label, body: r.body, status: r.status, response: r.resp })),
      verdict: operatorWide ? 'operator-wide: "equals" 500s on ANY field; "eq"/"contains" work' : 'not clean — see matrix',
      calls: ev.all(),
    });
    writeReport('01-backend-bugs', 'BUG-list-extensions-equals-operator-500.md', buildReport({
      id: 'P1-LIST-EXTENSIONS-EQUALS-FILTER', title: 'BUG — List Extensions: the `equals` filter operator 500s on any field (only `eq`/`contains` are valid)',
      classification: operatorWide ? 'CONFIRMED BACKEND BUG' : 'INCONCLUSIVE', severity: 'P1',
      precondition: pc, resourceIds: { realName, realSiteName },
      chain: [
        { step: `List Extensions baseline (unfiltered) → ${baseline.status}, ${rows.length} rows`, call: baseline.call },
        ...results.map(r => ({ step: `filter { ${r.label} } → ${r.status}`, call: r.call })),
      ],
      expected: 'Either `equals` works (as an alias for `eq`), or it returns a `400` "unsupported operator". Never a bare 500.',
      actual: `\`equals\` on Name → ${results.find(r => r.label.includes('Name equals'))?.status}; on SiteName → ${results.find(r => r.label.includes('SiteName equals'))?.status}. \`eq\` → ${results.find(r => r.label.includes('Name eq'))?.status}/${results.find(r => r.label.includes('SiteName eq'))?.status}; \`contains\` → ${results.find(r => r.label.includes('contains'))?.status}. Verdict: ${operatorWide ? '**operator-wide — `equals` 500s regardless of field**' : 'see matrix'}.`,
      reproducibility: `${equalsRows.filter(r => r.status === 500).length}/${equalsRows.length} equals-variants 500; ${nonEqualsRows.filter(r => r.status === 200).length}/${nonEqualsRows.length} eq/contains-variants 200.`,
      alternativesRuledOut: [
        { hypothesis: 'SiteName-field-specific', verdict: operatorWide ? 'ruled out — `Name equals` 500s too; `SiteName eq` and `SiteName contains` both 200' : 'not confirmed — see matrix' },
        { hypothesis: 'bad filter value', verdict: 'ruled out — the same value works with `eq` on the same field' },
        { hypothesis: 'request never fired', verdict: 'ruled out — raw capture shows each filtered POST fired and returned its status' },
      ],
      downstreamImpact: 'The console\'s own canned example for List Extensions uses `operator:"equals"` — a caller copying it gets an opaque 500 with no error detail (empty `{}` body). Exact-match filtering must use `eq`.',
      workaround: 'Use `operator:"eq"` (or `contains`).',
      cleanup: 'None (reads).',
      remainingUnknowns: 'Whether other list endpoints (Agents, Users, ...) reject `equals` the same way.',
      recommendedRegression: 'Add a `KNOWN BUG` test to `extension-management-api.spec.ts` (or the negative suite): `List Extensions` with `{field:"Name",operator:"equals",...}` → 500; with `operator:"eq"` → 200.',
      suggestedTicket: `**Title**: \`POST settings/extensions/list\` returns a bare 500 (empty body) for \`filter.operator:"equals"\` on any field.\n\n**Steps**: \`{filter:{filters:[{field:"Name",operator:"equals",value:"<real>"}]}}\` → **500** \`{}\`. Same body with \`operator:"eq"\` → 200. The operation's own console example uses \`"equals"\`.\n\n**Expected**: 400 "unsupported operator", or treat \`equals\` as \`eq\`.`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-LIST-EXTENSIONS-EQUALS-FILTER | Extension Management | List Extensions | ${operatorWide ? 'CONFIRMED BACKEND BUG' : 'INCONCLUSIVE'} | ${operatorWide ? 'CONFIRMED' : 'INCONCLUSIVE'} | ${equalsRows.filter(r => r.status === 500).length}/${equalsRows.length} | POST | yes | yes | partial | P1 |`);
    console.log(`[P1-LIST-EXTENSIONS-EQUALS] ${results.map(r => `${r.label}=${r.status}`).join(' | ')}`);
    expect(baseline.status).toBe(200);
  });

  // ═══════════════════════════════════════════════════════════════════════
  test('P1-LIST-RETENTION-SITEID-FILTER — filtering by SiteID 500s (casing/value independent?)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);
    const ownSite = pc.currentSiteId ?? KNOWN.siteId;
    const OTHER = '39e0cb7f-68a8-431c-8754-6941a2f6a547';

    const baseline = await fire(portal, ev, 'Retention Management', /^List Retention Policies/, {});
    const mk = (field: string, value: string) => ({ skip: 0, take: 100, sort: [], filter: { logic: 'and', filters: [{ field, operator: 'eq', value }] } });
    const matrix: { label: string; body: unknown }[] = [
      { label: 'SiteID = own', body: mk('SiteID', ownSite) },
      { label: 'siteID = own', body: mk('siteID', ownSite) },
      { label: 'SiteId = own', body: mk('SiteId', ownSite) },
      { label: 'siteId = own', body: mk('siteId', ownSite) },
      { label: 'SiteID = other', body: mk('SiteID', OTHER) },
    ];
    const results: { label: string; body: unknown; status: number; resp: unknown; call?: CapturedCall }[] = [];
    for (const t of matrix) {
      const r = await fire(portal, ev, 'Retention Management', /^List Retention Policies/, t.body);
      results.push({ label: t.label, body: t.body, status: r.status, resp: r.body, call: r.call });
    }
    const all500 = results.every(r => r.status === 500);

    const raw = writeRaw('P1-LIST-RETENTION-SITEID-FILTER', {
      precondition: pc, ownSite, otherSite: OTHER,
      baselineStatus: baseline.status, baselineBody: baseline.body,
      matrix: results.map(r => ({ label: r.label, body: r.body, status: r.status, response: r.resp })),
      verdict: all500 ? 'casing/value-independent: every SiteID/siteId filter 500s' : 'mixed — see matrix',
      calls: ev.all(),
    });
    writeReport('01-backend-bugs', 'BUG-list-retention-siteid-filter-500.md', buildReport({
      id: 'P1-LIST-RETENTION-SITEID-FILTER', title: 'BUG — List Retention Policies: any SiteID/siteId filter → 500 (casing- and value-independent)',
      classification: all500 ? 'CONFIRMED BACKEND BUG' : 'INCONCLUSIVE', severity: 'P1',
      precondition: pc, resourceIds: { ownSiteId: ownSite, otherSiteId: OTHER },
      chain: [
        { step: `List Retention Policies unfiltered → ${baseline.status}`, call: baseline.call },
        ...results.map(r => ({ step: `filter { ${r.label} } → ${r.status}`, call: r.call })),
      ],
      expected: 'A `SiteID` filter either filters the result or returns a `400`. Never a bare 500 — least of all filtering by the caller\'s own site id.',
      actual: `Unfiltered → ${baseline.status}. Filtered: ${results.map(r => `${r.label}→${r.status}`).join(', ')}. ${all500 ? 'Every casing and both own/other site values → 500.' : 'see matrix'}`,
      reproducibility: `${results.filter(r => r.status === 500).length}/${results.length} filter variants 500 this run; matches 2026-08-25/27.`,
      alternativesRuledOut: [
        { hypothesis: 'wrong field casing', verdict: all500 ? 'ruled out — SiteID / siteID / SiteId / siteId all 500' : 'partial' },
        { hypothesis: 'bad site id value', verdict: all500 ? 'ruled out — own site id and another site id both 500' : 'partial' },
        { hypothesis: 'unfiltered list is also broken', verdict: `ruled out — unfiltered → ${baseline.status}` },
      ],
      downstreamImpact: 'Retention policies cannot be filtered by site via the API — callers must fetch all and filter client-side.',
      workaround: 'Fetch unfiltered; filter by `siteID` in the response client-side.',
      cleanup: 'None (reads).',
      remainingUnknowns: 'The exact server exception (2026-08-27 saw a bare 500).',
      recommendedRegression: 'Add a `KNOWN BUG` test to `retention-management-api.spec.ts`: `List Retention Policies` with a `SiteID` eq filter → 500; unfiltered → 200.',
      suggestedTicket: `**Title**: \`POST settings/retention/list\` 500s when \`filter\` contains a \`SiteID\`/\`siteId\` entry (any casing, any value).\n\n**Steps**: unfiltered → 200. \`{filter:{filters:[{field:"SiteID",operator:"eq",value:"<own site id>"}]}}\` → **500**. Same for \`siteID\`/\`SiteId\`/\`siteId\` and for another site's id.\n\n**Expected**: filtered result or 400.`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-LIST-RETENTION-SITEID-FILTER | Retention Management | List Retention Policies | ${all500 ? 'CONFIRMED BACKEND BUG' : 'INCONCLUSIVE'} | ${all500 ? 'CONFIRMED' : 'INCONCLUSIVE'} | ${results.filter(r => r.status === 500).length}/${results.length} | POST | yes | yes | partial | P1 |`);
    console.log(`[P1-LIST-RETENTION-SITEID] baseline=${baseline.status} ${results.map(r => `${r.label}=${r.status}`).join(' | ')}`);
    expect(baseline.status).toBe(200);
  });

  // ═══════════════════════════════════════════════════════════════════════
  test('P1-UPDATE-AGENT-GROUP-FULLREPLACE — omitting isActive silently deactivates the group (contract)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);

    // Use a disposable group we create (so nothing real is deactivated).
    const agents = await fire(portal, ev, 'Agent Management', /^List Agents/, LIST_BODY_100);
    const agentId = (agents.body as Array<{ id: string }>)[0]?.id;
    const name = `AQA evidence grp fullreplace ${Date.now()}`;
    await fire(portal, ev, 'Group Management', /^Create Agent Group/, {
      customerId: KNOWN.customerId, name, isActive: true, agentJson: JSON.stringify([agentId]),
    });
    const list1 = await fire(portal, ev, 'Group Management', /^List Agent Groups/, LIST_BODY_100);
    const row = (list1.body as Array<{ id: number; name: string; customerId: string; agentJson: string; isActive: boolean }>).find(g => g.name === name);
    const isActiveBefore = row?.isActive;

    // Update OMITTING isActive.
    const update = await fire(portal, ev, 'Group Management', /^Update Agent Group/, {
      id: row!.id, customerId: row!.customerId, name: row!.name, agentJson: row!.agentJson,
    });
    const list2 = await fire(portal, ev, 'Group Management', /^List Agent Groups/, LIST_BODY_100);
    const rowAfter = (list2.body as Array<{ id: number; name: string; isActive: boolean }>).find(g => g.id === row!.id);
    const isActiveAfter = rowAfter?.isActive;

    // Restore + cleanup.
    await fire(portal, ev, 'Group Management', /^Update Agent Group/, {
      id: row!.id, customerId: row!.customerId, name: row!.name, agentJson: row!.agentJson, isActive: true,
    });
    const del = await fire(portal, ev, 'Group Management', /^Delete Agent Group/, undefined, [['agentGroupId', String(row!.id)]]);

    const deactivated = isActiveBefore === true && isActiveAfter === false;
    const raw = writeRaw('P1-UPDATE-AGENT-GROUP-FULLREPLACE', {
      precondition: pc, groupId: row?.id, name,
      isActiveBefore, updateStatus: update.status, updateBody: update.body, isActiveAfter,
      deletedStatus: del.status, calls: ev.all(),
    });
    writeReport('01-backend-bugs', 'CONTRACT-update-agent-group-full-replace.md', buildReport({
      id: 'P1-UPDATE-AGENT-GROUP-FULLREPLACE', title: 'CONTRACT — Update Agent Group is a full-record replace: omitting `isActive` silently deactivates the group',
      classification: deactivated ? 'CONTRACT/DOCUMENTATION BUG (undocumented full-replace trap)' : 'NOT REPRODUCED',
      severity: 'P1 (data-affecting, easy to hit)',
      precondition: pc, resourceIds: { groupId: row?.id ?? null, name },
      chain: [
        { step: 'Create Agent Group (isActive:true)', call: undefined },
        { step: `List Agent Groups → isActive before = ${isActiveBefore}`, call: list1.call },
        { step: 'Update Agent Group OMITTING isActive (id, customerId, name, agentJson only)', call: update.call },
        { step: `List Agent Groups → isActive after = ${isActiveAfter}`, call: list2.call },
      ],
      expected: 'Either `isActive` is preserved when omitted (partial patch), or the schema marks it required so the caller must send it.',
      actual: `isActive before = **${isActiveBefore}**. Update omitting isActive → ${update.status} \`${JSON.stringify(update.body)}\`. isActive after = **${isActiveAfter}**. ${deactivated ? '→ the group was silently **deactivated** by an update that never mentioned `isActive`.' : '→ not reproduced this run.'}`,
      reproducibility: '1/1 this run; matches 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'the group was already inactive', verdict: `ruled out — isActive before = ${isActiveBefore}` },
        { hypothesis: 'wrong group matched', verdict: 'ruled out — matched by unique AQA name then by id' },
        { hypothesis: 'update failed', verdict: `ruled out — update → ${update.status}` },
      ],
      downstreamImpact: 'Any caller doing a "change the name" style partial update, following the docs\' minimal required set (`id, customerId, name, agentJson`), silently deactivates the group — its agents stop being grouped for reporting/recording rules.',
      workaround: 'Always send every field you want preserved, especially `isActive:true`.',
      cleanup: `Group restored to isActive:true then deleted (${del.status}).`,
      remainingUnknowns: 'Whether other fields (agentJson, name) also full-replace to null/empty when omitted. Whether the OpenAPI marks isActive required.',
      recommendedRegression: '`group-management-api.spec.ts` › "Update Agent Group" already sends `isActive:true` explicitly and asserts the response `isActive === true` — with a comment about the full-replace trap. Keep. Consider a dedicated test that omits it and asserts the deactivation (KNOWN BUG) so a fix is noticed.',
      suggestedTicket: `**Title**: \`POST settings/agent-groups/update\` is a full-record replace — omitting \`isActive\` deactivates the group\n\n**Steps**: create an active group. \`POST settings/agent-groups/update\` with \`{id, customerId, name, agentJson}\` (no \`isActive\`) → 200; the group's \`isActive\` becomes **false**.\n\n**Expected**: preserve \`isActive\` when omitted, or make it required in the schema and document the full-replace semantics.`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-UPDATE-AGENT-GROUP-FULLREPLACE | Group Management | Update Agent Group | ${deactivated ? 'CONTRACT ISSUE' : 'NOT REPRODUCED'} | ${deactivated ? 'CONFIRMED' : 'NOT REPRODUCED'} | 1/1 | POST | yes | yes | yes | P1 |`);
    console.log(`[P1-UPDATE-AGENT-GROUP-FULLREPLACE] before=${isActiveBefore} update=${update.status} after=${isActiveAfter} deactivated=${deactivated}`);
    expect(isActiveBefore).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════
  test('P1-UPDATE-TAG-VALIDATION — undocumented name validation (alphanumeric + spaces only)', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);
    const stamp = Date.now();

    const add = await fire(portal, ev, 'Tag Management', /^Create Tag/, { name: `AQA evidence tag ${stamp}` });
    const tagId = (add.body as { id?: string })?.id;

    const tries = [
      { label: 'alphanumeric + spaces', name: `AQA tag ${stamp} ok` },
      { label: 'parentheses', name: `AQA tag ${stamp} (x)` },
      { label: 'hyphen', name: `AQA-tag-${stamp}` },
      { label: 'underscore', name: `AQA_tag_${stamp}` },
      { label: 'period', name: `AQA tag ${stamp}.v2` },
    ];
    const updateResults: { label: string; name: string; status: number; body: unknown; call?: CapturedCall }[] = [];
    for (const t of tries) {
      const r = await fire(portal, ev, 'Tag Management', /^Update Tag/, { id: tagId, name: t.name });
      updateResults.push({ label: t.label, name: t.name, status: r.status, body: r.body, call: r.call });
    }
    // Add Tag with the same special names (does the create path enforce it too?).
    const addSpecial = await fire(portal, ev, 'Tag Management', /^Create Tag/, { name: `AQA add (paren) ${stamp}` });
    // Cleanup.
    const cleanup: Record<string, number> = {};
    for (const [k, id] of Object.entries({ main: tagId, special: (addSpecial.body as { id?: string })?.id })) {
      if (id) {
        const d = await fire(portal, ev, 'Tag Management', /^Delete Tag/, undefined, [['tagId', id]]);
        cleanup[k] = d.status;
      }
    }

    const raw = writeRaw('P1-UPDATE-TAG-VALIDATION', {
      precondition: pc, tagId,
      updateResults: updateResults.map(r => ({ label: r.label, name: r.name, status: r.status, body: r.body })),
      addTagWithParentheses: { status: addSpecial.status, body: addSpecial.body },
      cleanup, calls: ev.all(),
    });
    const parenRejected = updateResults.find(r => r.label === 'parentheses')?.status === 400;
    writeReport('01-backend-bugs', 'CONTRACT-update-tag-name-validation.md', buildReport({
      id: 'P1-UPDATE-TAG-VALIDATION', title: 'CONTRACT — Update Tag `name` is validated to "alphanumeric + spaces only" — undocumented',
      classification: 'CONTRACT/DOCUMENTATION BUG', severity: 'P2',
      precondition: pc, resourceIds: { tagId: tagId ?? null },
      chain: [
        { step: 'Add Tag (baseline)', call: add.call },
        ...updateResults.map(r => ({ step: `Update Tag name = "${r.name}" (${r.label}) → ${r.status}`, call: r.call })),
        { step: `Add Tag with parentheses in name → ${addSpecial.status}`, call: addSpecial.call },
      ],
      expected: 'The allowed character set for a tag name is documented in the OpenAPI schema / operation description.',
      actual: updateResults.map(r => `${r.label}: **${r.status}** ${typeof r.body === 'string' ? '' : JSON.stringify(r.body)}`).join('; ') + `. Add Tag w/ parentheses → ${addSpecial.status}.`,
      reproducibility: '1/1 each variant this run; the parentheses rejection matches 2026-08-28.',
      alternativesRuledOut: [
        { hypothesis: 'the tag id is wrong', verdict: `ruled out — the alphanumeric variant → ${updateResults[0].status}` },
        { hypothesis: 'request never fired', verdict: 'ruled out — raw shows each Update Tag POST fired' },
      ],
      downstreamImpact: 'Callers hit a 400 for perfectly normal tag names (hyphens, parentheses) with no hint from the docs that the rule exists.',
      workaround: 'Restrict tag names to alphanumerics + spaces.',
      cleanup: `Tags deleted: ${JSON.stringify(cleanup)}.`,
      remainingUnknowns: 'Whether the rule is documented anywhere; whether Add Tag enforces the identical rule (this run: Add w/ parentheses → ' + addSpecial.status + ').',
      recommendedRegression: 'Add a `negative-required-fields-staging.spec.ts` (or a validation suite) case: Update Tag with a parenthesised name → 400 "Alphanumeric characters and spaces allowed only".',
      suggestedTicket: `**Title**: \`POST settings/tags/update\` — undocumented \`name\` validation (alphanumeric + spaces only)\n\n**Steps**: Update Tag with \`name:"AQA tag (x)"\` → **400** "Alphanumeric characters and spaces allowed only". Hyphen/underscore/period: ${updateResults.filter(r => r.label !== 'parentheses' && r.label !== 'alphanumeric + spaces').map(r => `${r.label}→${r.status}`).join(', ')}.\n\n**Expected**: document the rule in the operation's schema/description (and align Add Tag).`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-UPDATE-TAG-VALIDATION | Tag Management | Update Tag | CONTRACT/DOC BUG | ${parenRejected ? 'CONFIRMED' : 'INCONCLUSIVE'} | 1/1 | POST | yes | yes | no | P2 |`);
    console.log(`[P1-UPDATE-TAG-VALIDATION] ${updateResults.map(r => `${r.label}=${r.status}`).join(' | ')} | addParen=${addSpecial.status}`);
    expect(add.status).toBe(200);
  });

  // ═══════════════════════════════════════════════════════════════════════
  test('P1-DELETE-USER-SEND — Delete User: clicking Send fires no network request', async ({ page, homePage }) => {
    const ev = new NetworkEvidence();
    ev.attach(page.context());
    const portal = await DeveloperPortalPage.openFrom(homePage);
    const pc = await precondition(portal);
    const email = `aqa-evidence-deluser+${Date.now()}@callcabinet.com`;

    // Create a disposable user so we have a real userId/userRId to target.
    const add = await fire(portal, ev, 'User Management', /^Create User/, {
      userRoleIdCombined: '3', qcRId: 0, email, firstName: 'AQA', lastName: 'evidence del',
    });
    const addUser = add.body as { id?: string; userRId?: string };
    const getU = addUser.id
      ? await fire(portal, ev, 'User Management', /^Preview User/, undefined, [['userId', addUser.id]])
      : { status: -1, body: null, call: undefined, threw: 'no user id' };
    const userRId = (getU.body as { userRId?: string })?.userRId ?? addUser.userRId;

    // A working DELETE-through-console for contrast: Delete Custom Role is
    // itself broken; use Delete Agent Extension-style? Simpler: contrast is
    // "Add User / Get User / Update User all fire real 200s in the same
    // console session" — captured above.

    // Now Delete User: 3 attempts, each a fresh console, capturing whether
    // ANY request fires.
    const attempts: { n: number; threw: string | null; status: number; firedApiCalls: number }[] = [];
    for (let i = 1; i <= 3; i++) {
      const o = await openConsole(portal, 'User Management', /^Delete User/, { retries: 4 });
      await o.selectSubscriptionKey(API_KEY_OPTION);
      if (addUser.id) await o.addParameter('userId', addUser.id);
      if (userRId) await o.addParameter('userRId', userRId);
      const m = ev.mark();
      let threw: string | null = null;
      try { await o.send(); } catch (e) { threw = String(e); }
      const fired = ev.since(m).filter(c => /settings\/users\/delete/i.test(c.url) && c.method !== 'OPTIONS');
      attempts.push({ n: i, threw, status: -1, firedApiCalls: fired.length });
    }

    const anyFired = attempts.some(a => a.firedApiCalls > 0);
    const raw = writeRaw('P1-DELETE-USER-SEND', {
      precondition: pc, email, userId: addUser.id, userRId,
      addUserStatus: add.status, getUserStatus: getU.status,
      deleteAttempts: attempts,
      note: 'Add/Get User in the same session fired real requests; only Delete User\'s Send is inert.',
      calls: ev.all(),
    });
    writeReport('03-console-ui', 'BUG-delete-user-send-inert.md', buildReport({
      id: 'P1-DELETE-USER-SEND', title: 'BUG — Delete User: clicking "Send" in the Try-it console fires NO network request (no OPTIONS, no POST)',
      classification: anyFired ? 'NOT REPRODUCED' : 'CONSOLE/UI BUG (Send is inert for this operation)',
      severity: 'P1',
      precondition: pc, resourceIds: { userId: addUser.id ?? null, userRId: userRId ?? null, email },
      chain: [
        { step: 'Add User (same console session — fires a real request)', call: add.call },
        { step: 'Get User (same session — fires a real request, returns userRId)', call: getU.call },
        { step: 'Delete User — attempt 1 (Send clicked)', call: undefined },
        { step: 'Delete User — attempt 2 (Send clicked)', call: undefined },
        { step: 'Delete User — attempt 3 (Send clicked)', call: undefined },
      ],
      expected: 'Clicking Send issues `POST settings/users/delete/?userId=...&userRId=...` (preceded by an OPTIONS preflight), like every other operation.',
      actual: `Add User → ${add.status} (request fired), Get User → ${getU.status} (request fired). Delete User: 3 attempts, \`settings/users/delete\` API calls fired = [${attempts.map(a => a.firedApiCalls).join(', ')}]; client ${attempts.every(a => a.threw) ? 'timed out each time (`waitForResponse` 30s)' : 'result: ' + JSON.stringify(attempts.map(a => a.threw))}. ${anyFired ? '' : '**No network request was made at all** — not even an OPTIONS preflight.'}`,
      reproducibility: `${attempts.filter(a => a.firedApiCalls === 0).length}/3 attempts fired zero requests this run; matches 2026-08-28 sixth session (trace + network-log analysis across 5 reproductions).`,
      alternativesRuledOut: [
        { hypothesis: 'params not attached', verdict: 'ruled out — 2026-08-28 confirmed the live request preview reads `POST .../users/delete/?userId=...&userRId=...`; both params filled here via addParameter' },
        { hypothesis: 'Send button disabled / duplicate', verdict: 'ruled out (2026-08-28) — exactly one Send, verified enabled + visible' },
        { hypothesis: 'the console session is dead', verdict: `ruled out — Add User and Get User in the SAME session fired real requests (${add.status}/${getU.status})` },
        { hypothesis: 'this is the schema/render race', verdict: 'distinct — the console renders fully (Send visible, params fillable); the click just does nothing. Not a hang class; a silent no-op.' },
      ],
      downstreamImpact: 'Delete User cannot be invoked through the Try-it console. (The underlying API may be fine — untested here since firing it directly would delete a real user.) Any partner relying on the console to exercise this op is blocked.',
      workaround: 'Call `POST settings/users/delete/?userId=...&userRId=...` directly (not via the console).',
      cleanup: `AQA test user "${email}" (${addUser.id}) is left un-deleted — the console can't delete it and this test does not fire the delete directly. Disposable per the ADO tickets.`,
      remainingUnknowns: 'Whether the backend `POST settings/users/delete` works when called directly (not tested — would delete a real user). Why the console\'s Send handler is a no-op only for this one operation.',
      recommendedRegression: '`user-management-api.spec.ts` › "Add User → Get User → Update User → Delete User" already asserts `expect(deleteOp.send()).rejects.toThrow(/Timeout/)` as a KNOWN BUG. Keep.',
      suggestedTicket: `**Title**: Developer Portal console — "Send" on **Delete User** fires no request (no OPTIONS, no POST)\n\n**Steps**: open Delete User via the catalogue → Try this operation → fill \`userId\` + \`userRId\` (request preview shows \`POST .../api/settings/users/delete/?userId=...&userRId=...\`) → click Send. **No network activity.** Add User / Get User / Update User in the same session fire real requests.\n\n**Expected**: Send issues the DELETE request.`,
      rawFiles: [raw],
    }));
    appendSummaryRow(`| P1-DELETE-USER-SEND | User Management | Delete User | ${anyFired ? 'NOT REPRODUCED' : 'CONSOLE/UI BUG'} | ${anyFired ? 'NOT REPRODUCED' : 'CONFIRMED'} | ${attempts.filter(a => a.firedApiCalls === 0).length}/3 | POST | yes | yes | yes | P1 |`);
    console.log(`[P1-DELETE-USER-SEND] add=${add.status} get=${getU.status} deleteFired=[${attempts.map(a => a.firedApiCalls).join(',')}]`);
    expect(add.status).toBe(200);
    expect(getU.status).toBe(200);
  });
});
