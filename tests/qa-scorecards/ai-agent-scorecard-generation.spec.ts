import { test, expect } from '../../fixtures/fixtures';
import { getRandomPrompts, dailyRandom } from '../../helpers/scorecardPrompts';

/**
 * ADO bug 36210 (P0.3a — Scorecard Save Failure) / case 37571.
 *
 * Repro: ask the AI Agent to generate a QA scorecard, then save it — save
 * intermittently fails. Case 37571 calls for 50 consecutive attempts across
 * varied AI-generated structures; this suite draws a fresh random sample
 * from a 500-prompt pool each run (data-provider pattern — see
 * helpers/scorecardPrompts.ts) so repeated runs exercise different
 * combinations instead of always the same one.
 *
 * SAMPLE_SIZE is 100, per the user's explicit request (2026-08-25) to run
 * the full 100-scorecard batch against SmarshCR Sales in one go, beyond
 * case 37571's original 50-attempt spec.
 *
 * Requires the account (default TEST_EMAIL/TEST_PASSWORD user) to have
 * access to the **SmarshCR Sales** company with full Analytics
 * configuration access (ADO shared step 22282) — this is the only company
 * observed where the AI Agent's scorecard-generation prompt produces a
 * "RECOMMENDED SYSTEM ACTIONS" card with a working action, rather than a
 * text-only "I can't create the scorecard for you from here" reply.
 */
const SAMPLE_SIZE = 100;
const COMPANY = 'SmarshCR Sales';

const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

// Override the project default (video: 'on-first-retry', and this suite
// runs with retries: 0 locally, so no video is ever actually kept). Worker-
// scoped options like `video` must be set at the file's top level, not
// inside a `test.describe` block (Playwright forces a new worker for those
// and refuses it nested) — confirmed live, moved here after that error.
//
// NOTE (2026-08-26): during active SaveNewForm-timeout hunting this was
// temporarily set to `'on'` because one repro (prompt #202) had no video
// retained despite `'retain-on-failure'` being active (cause not root-caused —
// possibly a race between the failure's stack unwind and video finalization).
// Reverted back to `'retain-on-failure'` once that hunt paused.
//
// Back to `'on'` (2026-09-01): per the user's request, actively hunting the
// rare (~5% of runs) ADO-38068 zero-SaveNewForm-request case again — this
// time specifically to see visually whether a loader/spinner appears on the
// Save button during the stall (the button's DOM attributes alone showed
// disabled:false/aria-busy:null on every observed occurrence, which doesn't
// rule out a purely-CSS spinner). `retain-on-failure`'s past gap is reason
// enough not to risk missing this again — flip back to `'retain-on-failure'`
// once this hunt is done.
test.use({ video: 'on' });

test.describe('QA Scorecards — AI Agent generation (ADO 37571)', () => {
  // Shared single-session account: the global config's fullyParallel:true
  // and unbounded local worker count would otherwise spread these tests
  // across concurrent workers, each independently logging into the same
  // TEST_EMAIL account and evicting each other's session. Deliberately NOT
  // using `mode: 'serial'` for this, even though each test already does its
  // own full login/logout (no state dependency between tests) — serial
  // mode's "abort every remaining test after one failure" behavior would
  // turn a single real save rejection (confirmed live 2026-09-01, prompt
  // #406: SaveNewForm 400 "Phrases are required when AI Assisted is
  // disabled" — a fast, deterministic rejection, not a hang) into 99 lost
  // data points. Run this file with `--workers=1` instead to get the same
  // one-login-at-a-time sequencing without that cascade.
  test.describe.configure({ timeout: 360_000 });
  test.skip(
    !VALID_EMAIL || !VALID_PASSWORD,
    'Set TEST_EMAIL and TEST_PASSWORD in .env to run authenticated tests',
  );

  test.beforeEach(async ({ page, loginPage, companySelector }) => {
    await loginPage.goto();
    await loginPage.login(VALID_EMAIL!, VALID_PASSWORD!);
    await page.waitForURL('/Home', { timeout: 20_000 });
    await companySelector.switchTo(COMPANY);
  });

  test.afterEach(async ({ page, homePage }) => {
    try {
      if (!(await homePage.userInfoMenu.isVisible().catch(() => false))) return;
      await homePage.userInfoMenu.hover({ timeout: 5_000 });
      await homePage.logoutButton.click({ timeout: 5_000 });
      await page.waitForURL('/', { timeout: 10_000 });
    } catch {
      /* already logged out — nothing to do */
    }
  });

  // dailyRandom(), not Math.random(): Playwright enumerates this file once
  // to build the test list, then reloads it fresh inside each worker
  // process — a non-deterministic sample here would pick a different set
  // of prompts on each load and every test would fail with "Test not found
  // in the worker process".
  for (const promptCase of getRandomPrompts(SAMPLE_SIZE, dailyRandom())) {
    test(`prompt #${promptCase.index} generates and saves a scorecard (${promptCase.callType} / ${promptCase.scale})`, async ({
      page,
      aiAgentPage,
      scorecardEditorPage,
      qaScorecardsPage,
      companySelector,
    }, testInfo) => {
      // Console + uncaught-exception capture per the user's request
      // (2026-08-26): a save that silently fails client-side (the click
      // firing no network request at all — see every SaveNewForm-timeout
      // failure's save-diagnostics so far) is exactly the kind of failure a
      // JS error would explain and the network tab alone can't. Attached to
      // `page` directly (not a page object) so it's captured once for the
      // whole test regardless of which page object is acting at the time.
      const consoleLog: string[] = [];
      page.on('console', msg => {
        consoleLog.push(`[${new Date().toISOString()}] console.${msg.type()}: ${msg.text()}`);
      });
      page.on('pageerror', err => {
        consoleLog.push(`[${new Date().toISOString()}] uncaught exception: ${err.message}\n${err.stack ?? ''}`);
      });

      // Wide network capture per the user's request (2026-08-26): the
      // SaveNewForm-specific listeners only ever see SaveNewForm itself, but
      // the one real lead caught so far (prompt #139, 2026-08-26) was a 403
      // on some *other* resource immediately followed by an unhandled
      // rejection on /QAScorecards — logged in the console, but its own URL
      // was never captured because nothing was watching non-SaveNewForm
      // traffic. This logs every non-2xx/3xx response site-wide, plus every
      // response to any `/api/` call regardless of status, so a failure's
      // full request context is available, not just the one endpoint this
      // suite happens to assert on.
      const networkLog: string[] = [];
      page.on('response', resp => {
        const url = resp.url();
        const status = resp.status();
        if (status >= 400 || url.includes('/api/')) {
          networkLog.push(`[${new Date().toISOString()}] ${resp.request().method()} ${url} -> ${status}`);
        }
      });
      page.on('requestfailed', req => {
        networkLog.push(
          `[${new Date().toISOString()}] ${req.method()} ${req.url()} -> requestfailed: ${req.failure()?.errorText ?? '(no error text)'}`,
        );
      });

      try {
        await aiAgentPage.goto();
        // Defensive re-check: a full page navigation has been observed to
        // race the company switch from beforeEach and revert to the
        // account's previous company (see CompanySelector.switchTo doc) —
        // fail loudly here rather than silently generating against the
        // wrong company.
        await expect(companySelector.combobox).toContainText(COMPANY);
        await aiAgentPage.startNewConversation();
        await aiAgentPage.sendPrompt(promptCase.prompt);

        await aiAgentPage.waitForRecommendedAction();
        const stagedName = await aiAgentPage.getStagedScorecardName();

        await aiAgentPage.createStagedScorecard();

        // Per the user's request (2026-09-01): pause briefly right after
        // landing on the editor, before doing anything else — a hypothesis
        // for the zero-network-request Save click (ADO 38068) and the
        // "Phrases are required when AI Assisted is disabled" 400 (bug
        // 38385) is that some editor-side state (the Automated Scorecard/
        // AI-Assisted toggle, the click handler wiring) hasn't settled yet
        // immediately after the canvas navigation, and automation reaches
        // Save faster than a human would. Not counted as flakiness
        // mitigation elsewhere in this file — this is a deliberate trial.
        await page.waitForTimeout(2_000);

        // Content check before saving: the generated structure must actually
        // cover what the prompt asked for, not just produce *some* scorecard.
        await scorecardEditorPage.assertCoversFocusAreas(promptCase.focusAreas);

        const savedName = await scorecardEditorPage.saveAndExit();
        expect(savedName).toContain(stagedName);

        await qaScorecardsPage.goto();
        await qaScorecardsPage.assertFormExists(savedName);

        // Cleanup: this creates a real form in a shared, long-lived company on
        // every run — delete it once it's been verified, so the listing
        // doesn't accumulate one entry per run.
        await qaScorecardsPage.deleteForm(savedName);
      } catch (err) {
        // Diagnostics per the user's request (2026-08-26): on any failure in
        // this flow, dump every observed attempt at both the AI Agent's
        // streaming endpoint and the SaveNewForm save endpoint (status,
        // timing, network-level drops) so a "the agent never responded"
        // failure, a save that errored with a status the plain timeout
        // alone would hide, and a save that genuinely never got a response
        // at all can be told apart after the fact — printed to stdout
        // (shows up directly in the run log) and attached to the HTML
        // report, alongside the video (see `test.use({ video: ... })`
        // above) for actually watching what the save button did.
        const streamDiagnostics = aiAgentPage.formatStreamDiagnostics();
        const saveDiagnostics = scorecardEditorPage.formatSaveDiagnostics();
        const consoleDiagnostics = consoleLog.length ? consoleLog.join('\n') : '(no console output or uncaught exceptions captured)';
        const networkDiagnostics = networkLog.length ? networkLog.join('\n') : '(no non-2xx or /api/ traffic captured)';
        console.error(
          `[prompt text] prompt #${promptCase.index}: ${promptCase.prompt}\n\n` +
            `[stream diagnostics] prompt #${promptCase.index}:\n${streamDiagnostics}\n\n` +
            `[save diagnostics] prompt #${promptCase.index}:\n${saveDiagnostics}\n\n` +
            `[console log] prompt #${promptCase.index}:\n${consoleDiagnostics}\n\n` +
            `[network log] prompt #${promptCase.index}:\n${networkDiagnostics}`,
        );
        await testInfo.attach('prompt-text', { body: promptCase.prompt, contentType: 'text/plain' });
        await testInfo.attach('ai-agent-stream-diagnostics', { body: streamDiagnostics, contentType: 'text/plain' });
        await testInfo.attach('save-diagnostics', { body: saveDiagnostics, contentType: 'text/plain' });
        await testInfo.attach('console-log', { body: consoleDiagnostics, contentType: 'text/plain' });
        await testInfo.attach('network-log', { body: networkDiagnostics, contentType: 'text/plain' });
        throw err;
      }
    });
  }
});
