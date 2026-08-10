import { test, expect } from '../../fixtures/fixtures';
import { AgentActionCard } from '../../pages/ai-agent-notification/AgentActionCard';
import { adminUser, openAgent, stageRule, PROMPTS, EMAIL } from './fixtures';

/**
 * Feature 31979 — the staged notification_rule action card.
 * ADO: 37155, 37156, 37161, 37162, 37163, 37164.
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-08-10);
 * full element inventory + behaviour notes live in docs/ai-agent-notification-map.md.
 *
 * One agent turn costs 60-80 s, so every spec sets its own generous timeout.
 * Needs a super-admin account under the "admin" alias in TEST_USERS_JSON — see
 * helpers/testUsers.ts.
 */
test.describe('AI Agent — staged notification rule card', () => {
  test.skip(
    !adminUser.email || !adminUser.password,
    'Set a super-admin user under the "admin" alias in TEST_USERS_JSON to run this suite',
  );

  test.beforeEach(async ({ loginPage, companySelector, aiAgentPage }, testInfo) => {
    testInfo.setTimeout(420000);
    await openAgent(loginPage, companySelector, aiAgentPage);
  });

  // ADO 37155
  test('stages a notification rule and renders the action card', async ({ page, aiAgentPage }) => {
    const name = 'AI Agent Sentiment Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));

    expect(await card.name()).toBe(name);

    const summary = await card.summaryParts();
    expect(summary!.triggers).toBe(1);
    expect(summary!.levels).toEqual(['critical']);
    expect(summary!.filters).toBe(0);
    expect(summary!.channels).toEqual(expect.arrayContaining(['UI', 'Email']));

    const cfg = await card.config();
    expect(cfg!.type).toBe('CallSentiment');
    expect(cfg!.numberOfCalls).toBeTruthy();
    expect(cfg!.cooldown).toMatch(/^\d+ min$/);
    expect(cfg!.recipients).toContain(EMAIL);

    expect(cfg!.triggers).toHaveLength(1);
    expect(cfg!.triggers[0].level).toBe('critical');
    expect(cfg!.triggers[0].condition).toContain('-0.5');
    expect(cfg!.triggers[0].threshold).toMatch(/%$/);

    await expect(card.createButton).toBeVisible();
    await expect(card.dismissButton).toBeVisible();
  });

  // ADO 37156
  test('expands and collapses the reasoning on the card', async ({ page, aiAgentPage }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment('AI Agent Reasoning Alert'));

    expect(await card.reasoningToggleLabel()).toBe('Show reasoning');
    expect(await card.reasoning()).toBeNull();

    await card.toggleReasoning();
    expect(await card.reasoningToggleLabel()).toBe('Hide reasoning');
    const reasoning = await card.reasoning();
    expect(reasoning, 'the reasoning must not be empty once expanded').toBeTruthy();
    expect(reasoning!.length).toBeGreaterThan(30);

    // the reasoning explains the configuration the same card shows
    const cfg = await card.config();
    expect(reasoning!.toLowerCase()).toContain(cfg!.type!.toLowerCase());

    await card.toggleReasoning();
    expect(await card.reasoningToggleLabel()).toBe('Show reasoning');
    expect(await card.reasoning()).toBeNull();
  });

  // ADO 37161
  test('Dismiss removes the card for good and creates no rule', async ({ page, aiAgentPage, notificationsPage }) => {
    const name = 'AI Agent Dismissed Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));
    const answerBefore = await aiAgentPage.answerText();

    await card.dismiss();
    expect(await AgentActionCard.count(page)).toBe(0);
    expect(await aiAgentPage.hasRecommendedActions()).toBe(false);
    // the answer itself stays in the conversation
    expect(await aiAgentPage.answerText()).toContain(answerBefore.split('\n')[0]);

    // and the dismissal survives leaving the conversation
    await aiAgentPage.startNewConversation();
    await aiAgentPage.goto();
    await aiAgentPage.openLatestConversation();
    expect(await AgentActionCard.count(page)).toBe(0);

    await notificationsPage.goto();
    expect(await notificationsPage.hasRule(name)).toBe(false);
  });

  // ADO 37162
  test('stages nothing while "Recommended System Actions" is off', async ({ page, aiAgentPage }) => {
    const payloads: (string | null)[] = [];
    page.on('request', (r) => {
      if (/ai-agent\/query/.test(r.url()) && r.method() === 'POST') payloads.push(r.postData());
    });

    await aiAgentPage.setRecommended(false);
    expect(await aiAgentPage.recommendedState()).toBe('Off');

    await aiAgentPage.startNewConversation();
    expect(await aiAgentPage.askAndWait(PROMPTS.sentiment('AI Agent Toggle Off Alert'))).toBe(true);

    expect(payloads.length).toBeGreaterThan(0);
    expect(JSON.parse(payloads[payloads.length - 1]!).internalActions).toBe(false);
    expect(await aiAgentPage.hasRecommendedActions()).toBe(false);
    expect(await AgentActionCard.count(page)).toBe(0);

    // and back on, the same prompt does stage a card
    await aiAgentPage.setRecommended(true);
    await aiAgentPage.startNewConversation();
    expect(await aiAgentPage.askAndWait(PROMPTS.sentiment('AI Agent Toggle On Alert'))).toBe(true);
    expect(JSON.parse(payloads[payloads.length - 1]!).internalActions).toBe(true);
    expect(await AgentActionCard.count(page)).toBe(1);
  });

  // ADO 37163
  test('asks for the missing details instead of staging an incomplete rule', async ({ page, aiAgentPage }) => {
    const name = 'AI Agent Incomplete Rule';
    await aiAgentPage.startNewConversation();
    expect(await aiAgentPage.askAndWait(PROMPTS.incomplete(name))).toBe(true);

    // no card, and the answer names what it is missing
    expect(await aiAgentPage.hasRecommendedActions()).toBe(false);
    expect(await AgentActionCard.count(page)).toBe(0);
    const answer = (await aiAgentPage.answerText()).toLowerCase();
    expect(answer).toMatch(/topic/);
    expect(answer).toMatch(/site/);

    // supplying them stages the rule in the same conversation
    expect(
      await aiAgentPage.askAndWait(
        'Use any existing topic and the site "Analytics Synthetic Data", ' +
          'and proceed without a tag. Stage the rule now.',
      ),
    ).toBe(true);
    expect(await AgentActionCard.count(page)).toBe(1);
    const cfg = await new AgentActionCard(page).config();
    expect(cfg!.filters.some((f) => /Analytics Synthetic Data/.test(f.value))).toBe(true);
  });

  // ADO 37164
  test('a modified proposal replaces the same card and bumps the version', async ({ page, aiAgentPage }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment('AI Agent Modified Alert'));

    const before = await card.config();
    expect(before!.triggers[0].condition).toContain('-0.5');
    expect(before!.cooldown).toBe('60 min');
    expect(await card.version()).toBeNull();

    expect(
      await aiAgentPage.askAndWait(
        'Change that staged rule: set the cooldown to 120 minutes and ' +
          'lower the sentiment threshold to -0.8. Keep everything else the same.',
      ),
    ).toBe(true);

    // one card, not two
    expect(await AgentActionCard.count(page)).toBe(1);
    const updated = new AgentActionCard(page);
    const after = await updated.config();
    expect(after!.triggers[0].condition).toContain('-0.8');
    expect(after!.cooldown).toBe('120 min');
    expect(after!.type).toBe(before!.type);
    expect(await updated.version()).toBe('v2');
  });
});
