import { test, expect } from '../../fixtures/fixtures';
import { DeveloperPortalPage } from '../../pages/dev-portal/DeveloperPortalPage';
import {
  MISSING_CREDS_REASON, missingStagingCreds, stagingLogin, closeExtraTabs,
} from './_helpers';

/**
 * Staging Developer Portal catalogue smoke test — reaching the portal via
 * the app shell's "Development" top-nav button (SSO redirect, new tab) and
 * confirming the API catalogue renders. This is the entry-point check the
 * per-group `*-api.spec.ts` files all depend on.
 *
 * Host / account: `atmossystemsstaging.callcabinet.com` (two "s"es) →
 * `developer1-portal.callcabinet.com`, account `user` / `adminpass` (lands
 * on company CC Test 1). See `_helpers.ts`.
 */
test.describe('Developer Portal (staging) — API Management catalogue', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(missingStagingCreds, MISSING_CREDS_REASON);

  test.beforeEach(async ({ page, loginPage }) => { await stagingLogin(page, loginPage); });
  test.afterEach(async ({ page }) => { await closeExtraTabs(page); });

  test('Development button opens the API Management portal with the API catalogue', async ({ homePage }) => {
    await expect(homePage.developmentButton).toBeVisible();

    const portal = await DeveloperPortalPage.openFrom(homePage);

    await expect(portal.apisHeading).toBeVisible();
    const groups = await portal.groupNames();
    expect(groups).toContain('Calls');
    expect(groups).toContain('Agent Management');
    expect(groups.length).toBeGreaterThan(10);
  });
});
