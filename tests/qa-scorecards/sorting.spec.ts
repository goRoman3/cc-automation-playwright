import { test, expect } from '../../fixtures/fixtures';
import { getTestUser, type TestUser } from '../../helpers/testUsers';

/**
 * QA Scorecards — column sorting.
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-07-31);
 * full element inventory + behaviour notes live in specs/qa-scorecards-map.md.
 *
 * Needs a super admin: the company CC Test 1 holds 156 evaluation forms,
 * enough to tell a sorted list from an unsorted one. A restricted account's
 * own company (e.g. Charl_Test) holds a single form, which cannot demonstrate
 * sorting at all. Configure this account under the "admin" alias in
 * TEST_USERS_JSON — see helpers/testUsers.ts.
 */
let adminUser: TestUser;
try {
  adminUser = getTestUser('admin');
} catch {
  adminUser = { alias: 'unconfigured', email: '', password: '', newPassword: null };
}

const COMPANY = process.env.QA_SCORECARDS_COMPANY || 'CC Test 1';
const NAME_COL = 'Available Evaluation Forms';

const lower = (s: string) => s.toLocaleLowerCase();
const sortedAsc = (values: string[]) => [...values].sort((a, b) => lower(a).localeCompare(lower(b)));

test.describe('QA Scorecards — column sorting', () => {
  // One click cycles through unsorted -> ascending -> descending -> unsorted;
  // the company switch and the app's own slow grid refreshes need headroom.
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.skip(
    !adminUser.email || !adminUser.password,
    'Set a super-admin user under the "admin" alias in TEST_USERS_JSON to run this suite',
  );

  test.beforeEach(async ({ loginPage, companySelector, qaScorecardsPage }) => {
    await loginPage.goto();
    await loginPage.login(adminUser.email, adminUser.password);
    await companySelector.select(COMPANY);
    await qaScorecardsPage.goto();
    expect(await qaScorecardsPage.totalItems()).toBeGreaterThan(1);
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

  test(`sorts by "${NAME_COL}" ascending, descending, then back to default`, async ({
    qaScorecardsPage,
  }) => {
    const original = await qaScorecardsPage.formNames();
    expect(await qaScorecardsPage.sortState(NAME_COL)).toBe('none');

    await qaScorecardsPage.sortBy(NAME_COL);
    expect(await qaScorecardsPage.sortState(NAME_COL)).toBe('asc');
    const asc = await qaScorecardsPage.formNames();
    expect(asc).toEqual(sortedAsc(asc));
    expect(asc).not.toEqual(original);
    // A case-sensitive sort would bunch every capitalised name ahead of the
    // lower-case ones; this one interleaves them.
    expect(asc.some((n) => /^[a-z]/.test(n))).toBe(true);
    expect(asc.some((n) => /^[A-Z]/.test(n))).toBe(true);

    await qaScorecardsPage.sortBy(NAME_COL);
    expect(await qaScorecardsPage.sortState(NAME_COL)).toBe('desc');
    const desc = await qaScorecardsPage.formNames();
    expect(desc).toEqual(sortedAsc(desc).reverse());

    await qaScorecardsPage.sortBy(NAME_COL);
    expect(await qaScorecardsPage.sortState(NAME_COL)).toBe('none');
    expect(await qaScorecardsPage.formNames()).toEqual(original);
  });

  test('sorts by "Form Type" ascending, descending, then back to default', async ({
    qaScorecardsPage,
  }) => {
    const original = await qaScorecardsPage.formNames();
    expect(await qaScorecardsPage.sortState('Form Type')).toBe('none');

    await qaScorecardsPage.sortBy('Form Type');
    expect(await qaScorecardsPage.sortState('Form Type')).toBe('asc');
    const asc = await qaScorecardsPage.formTypes();
    expect(asc[0]).toBe('Auto');
    expect(asc).toEqual([...asc].sort());

    await qaScorecardsPage.sortBy('Form Type');
    expect(await qaScorecardsPage.sortState('Form Type')).toBe('desc');
    expect((await qaScorecardsPage.formTypes())[0]).toBe('Manual');

    await qaScorecardsPage.sortBy('Form Type');
    expect(await qaScorecardsPage.sortState('Form Type')).toBe('none');
    expect(await qaScorecardsPage.formNames()).toEqual(original);
  });
});
