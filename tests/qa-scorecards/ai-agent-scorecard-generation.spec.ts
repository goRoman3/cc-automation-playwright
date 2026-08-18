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
 * SAMPLE_SIZE is 10 for this trial run — bump towards case 37571's 50 once
 * this is stable in CI.
 *
 * Requires the account (default TEST_EMAIL/TEST_PASSWORD user) to have
 * access to the **SmarshCR Sales** company with full Analytics
 * configuration access (ADO shared step 22282) — this is the only company
 * observed where the AI Agent's scorecard-generation prompt produces a
 * "RECOMMENDED SYSTEM ACTIONS" card with a working action, rather than a
 * text-only "I can't create the scorecard for you from here" reply.
 */
const SAMPLE_SIZE = 10;
const COMPANY = 'SmarshCR Sales';

const VALID_EMAIL = process.env.TEST_EMAIL;
const VALID_PASSWORD = process.env.TEST_PASSWORD;

test.describe('QA Scorecards — AI Agent generation (ADO 37571)', () => {
  // Shared single-session account; generation + save + listing round-trip
  // per case can comfortably take a while.
  test.describe.configure({ mode: 'serial', timeout: 360_000 });
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
      aiAgentPage,
      scorecardEditorPage,
      qaScorecardsPage,
      companySelector,
    }) => {
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
    });
  }
});
