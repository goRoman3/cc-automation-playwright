import { expect, type Page } from '@playwright/test';
import { getTestUser, type TestUser } from '../../helpers/testUsers';
import type { LoginPage } from '../../pages/login/LoginPage';
import type { CompanySelector } from '../../pages/home/CompanySelector';
import { AiAgentPage } from '../../pages/ai-agent-notification/AiAgentPage';
import { AgentActionCard } from '../../pages/ai-agent-notification/AgentActionCard';

/**
 * Shared setup for the AI Agent -> Create Notification specs.
 *
 * These specs drive a live LLM: every turn costs 60-80 s and the wording of the
 * answer is not reproducible. So the assertions are on structure — which
 * sections the card renders, which values reach the wizard, whether validation
 * fires — never on the agent's prose. Prompts are written to be as directive as
 * possible ("Stage it now without asking me anything else") because the agent
 * asks clarifying questions whenever a topic, site or tag cannot be resolved.
 *
 * This module holds plain helper functions, not Playwright fixtures — the
 * page objects themselves are injected the normal way, via
 * `../../fixtures/fixtures` (`loginPage`, `companySelector`, `aiAgentPage`, …).
 */

/**
 * The super-admin account these specs need, resolved once via
 * `getTestUser('admin')` (see helpers/testUsers.ts). Falls back to an empty,
 * "unconfigured" user when the alias isn't set up, so specs can `test.skip()`
 * in `beforeEach` instead of throwing at collection time — same pattern as
 * qa-scorecards' filtering/sorting specs.
 */
export let adminUser: TestUser;
try {
  adminUser = getTestUser('admin');
} catch {
  adminUser = { alias: 'unconfigured', email: '', password: '', newPassword: null };
}

// SmarshCR Sales is the reference company for this flow: it has the topic, the
// QA form and the sites the prompts below name. See docs/ai-agent-notification-map.md.
export const COMPANY = process.env.ATMOS_COMPANY || 'SmarshCR Sales';
export const SITE = 'Analytics Synthetic Data';
export const EMAIL = 'ops@example.com';

// Rule names carry the spec's purpose so a leftover row on staging is traceable.
export const PROMPTS = {
  sentiment: (name: string) =>
    `Create a notification rule called "${name}" that alerts me when call ` +
    `sentiment drops below -0.5, and email the alert to ${EMAIL}.`,
  topicsNoRecipients: (name: string) =>
    `Create a notification rule named "${name}" using the Topics ` +
    'notification type. Pick any topic that exists in the topic list. Add two triggers: one at ' +
    `warning level and one at critical level. Limit it to the site "${SITE}". Do not add any ` +
    'email or webhook recipients. Stage it now without asking me anything else.',
  qaScores: (name: string) =>
    `Create a notification rule named "${name}" using the QAScores notification ` +
    'type. Pick any QA form that exists and any section inside it. Add one critical trigger. ' +
    `Email the alert to ${EMAIL}. Stage it now without asking me anything else.`,
  incomplete: (name: string) =>
    `Create a notification rule named "${name}" that alerts when a topic is ` +
    'detected on a call. Limit it to one site and add a tag.',
};

/**
 * Log in as super admin, switch company, open the AI Agent page with the
 * toggle on.
 *
 * The source scaffold's `LoginPage` exposed a standalone `dismissAnnouncement()`
 * that had to be called after every navigation that could resurface the
 * one-time "Action Required" modal. This repo's `LoginPage.login()` /
 * `completeLogin()` is the equivalent entry point here — see
 * `pages/login/LoginPage.ts` — so no separate dismiss call is threaded through
 * below; call sites just use `login()` as-is.
 */
export async function openAgent(
  loginPage: LoginPage,
  companySelector: CompanySelector,
  aiAgentPage: AiAgentPage,
): Promise<AiAgentPage> {
  await loginPage.goto();
  await loginPage.login(adminUser.email, adminUser.password);
  await companySelector.select(COMPANY);

  await aiAgentPage.goto();
  await aiAgentPage.setRecommended(true);
  expect(await aiAgentPage.recommendedState()).toBe('On');
  return aiAgentPage;
}

/**
 * Send `prompt` in a fresh conversation and wait until exactly one staged
 * notification card is rendered. Fails loudly when the agent answered without
 * staging, which is the one flake mode worth distinguishing.
 */
export async function stageRule(page: Page, agent: AiAgentPage, prompt: string): Promise<AgentActionCard> {
  await agent.startNewConversation();
  const finished = await agent.askAndWait(prompt);
  expect(finished, 'the agent did not finish the answer in time').toBe(true);

  const staged = await agent.hasRecommendedActions();
  expect(staged, `the agent answered without staging a rule:\n${await agent.answerText()}`).toBe(true);

  const card = new AgentActionCard(page);
  expect(await card.isVisible()).toBe(true);
  expect(await card.kind()).toBe('Notification Rule');
  return card;
}
