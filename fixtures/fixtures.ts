import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login/LoginPage';
import { ForgotPasswordPage } from '../pages/login/ForgotPasswordPage';
import { HomePage } from '../pages/home/HomePage';
import { ResetPasswordPage } from '../pages/password-reset/ResetPasswordPage';
import { CallListingPage } from '../pages/call-listing/CallListingPage';
import { ChatListingPage } from '../pages/chat-listing/ChatListingPage';
import { ChatViewModal } from '../pages/chat-listing/ChatViewModal';
import { EditColumnsPanel } from '../pages/chat-listing/EditColumnsPanel';

/**
 * Page Object fixtures.
 *
 * Import `test` and `expect` from here instead of `@playwright/test`, then
 * destructure the page object you need straight from the test arguments —
 * e.g. `test('...', async ({ loginPage }) => { ... })` — and skip the manual
 * `new LoginPage(page)` wiring. Each fixture is constructed lazily, so a test
 * only pays for the page objects it actually uses.
 *
 * Tests that drive a second browser context (e.g. the active-session modal
 * scenarios) still construct page objects by hand for that extra context — the
 * fixtures only cover the default `page`.
 */
type PageObjects = {
  loginPage: LoginPage;
  forgotPasswordPage: ForgotPasswordPage;
  homePage: HomePage;
  resetPasswordPage: ResetPasswordPage;
  callListingPage: CallListingPage;
  chatListingPage: ChatListingPage;
  chatViewModal: ChatViewModal;
  editColumnsPanel: EditColumnsPanel;
};

export const test = base.extend<PageObjects>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  resetPasswordPage: async ({ page }, use) => {
    await use(new ResetPasswordPage(page));
  },
  callListingPage: async ({ page }, use) => {
    await use(new CallListingPage(page));
  },
  chatListingPage: async ({ page }, use) => {
    await use(new ChatListingPage(page));
  },
  chatViewModal: async ({ page }, use) => {
    await use(new ChatViewModal(page));
  },
  editColumnsPanel: async ({ page }, use) => {
    await use(new EditColumnsPanel(page));
  },
});

export { expect } from '@playwright/test';
