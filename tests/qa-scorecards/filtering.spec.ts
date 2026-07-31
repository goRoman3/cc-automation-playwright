import { test, expect } from '../../fixtures/fixtures';
import { getTestUser, type TestUser } from '../../helpers/testUsers';

/**
 * QA Scorecards — column filtering.
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-07-31);
 * full element inventory + behaviour notes live in specs/qa-scorecards-map.md.
 *
 * One spec per filter parameter: apply the filter with a full form name,
 * check the result, then re-apply with a fragment and check again. The
 * filter pop-up's own controls (operator list, disabled Filter button, Clear
 * on its own) are not re-verified here — see specs/qa-scorecards-map.md for
 * why that is deliberately out of scope.
 *
 * Needs a super admin — see sorting.spec.ts for why. Configure this account
 * under the "admin" alias in TEST_USERS_JSON (helpers/testUsers.ts).
 */
let adminUser: TestUser;
try {
  adminUser = getTestUser('admin');
} catch {
  adminUser = { alias: 'unconfigured', email: '', password: '', newPassword: null };
}

const COMPANY = process.env.QA_SCORECARDS_COMPANY || 'CC Test 1';
const NAME_COL = 'Available Evaluation Forms';
// A form that exists on CC Test 1, plus a fragment of its name.
const FULL_NAME = 'Eval 1';
const PARTIAL_NAME = 'val';
const NO_MATCH = 'zzzzqqqq';

test.describe('QA Scorecards — column filtering', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(
    !adminUser.email || !adminUser.password,
    'Set a super-admin user under the "admin" alias in TEST_USERS_JSON to run this suite',
  );

  let baseline: number;

  test.beforeEach(async ({ loginPage, companySelector, qaScorecardsPage }) => {
    await loginPage.goto();
    await loginPage.login(adminUser.email, adminUser.password);
    await companySelector.select(COMPANY);
    await qaScorecardsPage.goto();
    baseline = await qaScorecardsPage.totalItems();
    expect(baseline).toBeGreaterThan(1);
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

  test('Starts with', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Starts with');
    const byFull = await qaScorecardsPage.formNames();
    expect(byFull.length).toBeGreaterThan(0);
    for (const name of byFull) expect(name.toLowerCase().startsWith(FULL_NAME.toLowerCase())).toBe(true);

    await qaScorecardsPage.filterByName('Eval', 'Starts with');
    const byPart = await qaScorecardsPage.formNames();
    for (const name of byPart) expect(name.toLowerCase().startsWith('eval')).toBe(true);
    // The fragment is a prefix of the full name, so it can only widen the match.
    expect(byPart.length).toBeGreaterThanOrEqual(byFull.length);
  });

  test('Contains', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Contains');
    const byFull = await qaScorecardsPage.formNames();
    expect(byFull.length).toBeGreaterThan(0);
    for (const name of byFull) expect(name.toLowerCase()).toContain(FULL_NAME.toLowerCase());

    await qaScorecardsPage.filterByName(PARTIAL_NAME, 'Contains');
    const byPart = await qaScorecardsPage.formNames();
    for (const name of byPart) expect(name.toLowerCase()).toContain(PARTIAL_NAME);
    expect(await qaScorecardsPage.totalItems()).toBeGreaterThanOrEqual(byFull.length);
  });

  test('Does not contain', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Does not contain');
    for (const name of await qaScorecardsPage.formNames()) {
      expect(name.toLowerCase()).not.toContain(FULL_NAME.toLowerCase());
    }

    await qaScorecardsPage.filterByName(PARTIAL_NAME, 'Contains');
    const containing = await qaScorecardsPage.totalItems();
    await qaScorecardsPage.filterByName(PARTIAL_NAME, 'Does not contain');
    for (const name of await qaScorecardsPage.formNames()) {
      expect(name.toLowerCase()).not.toContain(PARTIAL_NAME);
    }
    // The two operators partition the list exactly.
    expect(await qaScorecardsPage.totalItems()).toBe(baseline - containing);
  });

  test('Ends with', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Ends with');
    const byFull = await qaScorecardsPage.formNames();
    expect(byFull.length).toBeGreaterThan(0);
    for (const name of byFull) expect(name.toLowerCase().endsWith(FULL_NAME.toLowerCase())).toBe(true);

    await qaScorecardsPage.filterByName('1', 'Ends with');
    const byPart = await qaScorecardsPage.formNames();
    for (const name of byPart) expect(name.endsWith('1')).toBe(true);
    expect(await qaScorecardsPage.totalItems()).toBeGreaterThanOrEqual(byFull.length);
  });

  test('Is exactly', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Is exactly');
    const byFull = await qaScorecardsPage.formNames();
    expect(byFull.length).toBeGreaterThan(0);
    for (const name of byFull) expect(name.toLowerCase()).toBe(FULL_NAME.toLowerCase());

    // The operator matches whole names only, so a fragment finds nothing.
    await qaScorecardsPage.filterByName('Eval', 'Is exactly');
    expect(await qaScorecardsPage.isEmpty()).toBe(true);
    expect(await qaScorecardsPage.rowCount()).toBe(0);
  });

  test('Is exactly not', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(FULL_NAME, 'Is exactly');
    const exact = await qaScorecardsPage.totalItems();
    await qaScorecardsPage.filterByName(FULL_NAME, 'Is exactly not');
    for (const name of await qaScorecardsPage.formNames()) {
      expect(name.toLowerCase()).not.toBe(FULL_NAME.toLowerCase());
    }
    expect(await qaScorecardsPage.totalItems()).toBe(baseline - exact);

    // No form is named exactly like the fragment, so nothing is excluded.
    await qaScorecardsPage.filterByName('Eval', 'Is exactly not');
    expect(await qaScorecardsPage.totalItems()).toBe(baseline);
  });

  test('Form Type — Manual', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByFormType('Manual');
    expect(new Set(await qaScorecardsPage.formTypes())).toEqual(new Set(['Manual']));
    expect(await qaScorecardsPage.totalItems()).toBeLessThan(baseline);
    await qaScorecardsPage.clearFilter('Form Type');
    expect(await qaScorecardsPage.totalItems()).toBe(baseline);
  });

  test('Form Type — Auto', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByFormType('Auto');
    expect(new Set(await qaScorecardsPage.formTypes())).toEqual(new Set(['Auto']));
    expect(await qaScorecardsPage.totalItems()).toBeLessThan(baseline);
    await qaScorecardsPage.clearFilter('Form Type');
    expect(await qaScorecardsPage.totalItems()).toBe(baseline);
  });

  test('Archived — Yes', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByArchived('Yes');
    const archived = await qaScorecardsPage.totalItems();
    expect(archived).toBeGreaterThan(0);
    expect(archived).toBeLessThan(baseline);
    await qaScorecardsPage.clearFilter('Archived');
    expect(await qaScorecardsPage.totalItems()).toBe(baseline);
  });

  test('Archived — No', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByArchived('Yes');
    const yes = await qaScorecardsPage.totalItems();
    await qaScorecardsPage.clearFilter('Archived');
    await qaScorecardsPage.filterByArchived('No');
    const no = await qaScorecardsPage.totalItems();
    expect(no).toBeGreaterThan(0);
    // Every form is either archived or not — the two add up to the whole list.
    expect(yes + no).toBe(baseline);
  });

  test('a value matching nothing shows No Results Found', async ({ qaScorecardsPage }) => {
    await qaScorecardsPage.filterByName(NO_MATCH, 'Contains');
    expect(await qaScorecardsPage.isEmpty()).toBe(true);
    expect(await qaScorecardsPage.rowCount()).toBe(0);
    expect(await qaScorecardsPage.pagerText()).toBe('');

    await qaScorecardsPage.clearFilter(NAME_COL);
    expect(await qaScorecardsPage.isEmpty()).toBe(false);
    expect(await qaScorecardsPage.totalItems()).toBe(baseline);
  });
});
