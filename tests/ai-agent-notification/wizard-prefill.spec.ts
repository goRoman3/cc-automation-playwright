import { test, expect } from '../../fixtures/fixtures';
import { AgentActionCard } from '../../pages/ai-agent-notification/AgentActionCard';
import { adminUser, openAgent, stageRule, PROMPTS, EMAIL } from './fixtures';

/**
 * Feature 31979 — confirming a staged proposal: the prefilled wizard, saving,
 * and what happens to the card afterwards.
 * ADO: 37157, 37158, 37159, 37160.
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-08-10);
 * full element inventory + behaviour notes live in docs/ai-agent-notification-map.md.
 * Needs a super-admin account under the "admin" alias in TEST_USERS_JSON — see
 * helpers/testUsers.ts.
 *
 * The saving specs create a real notification rule on staging and delete it in
 * afterEach, so a failed run does not leave rows behind.
 */
test.describe('AI Agent — confirming a staged notification rule', () => {
  test.skip(
    !adminUser.email || !adminUser.password,
    'Set a super-admin user under the "admin" alias in TEST_USERS_JSON to run this suite',
  );

  const created: string[] = [];

  test.beforeEach(async ({ loginPage, companySelector, aiAgentPage }, testInfo) => {
    testInfo.setTimeout(420000);
    await openAgent(loginPage, companySelector, aiAgentPage);
  });

  test.afterEach(async ({ notificationsPage }) => {
    while (created.length) {
      const name = created.pop()!;
      await notificationsPage.goto().catch(() => {});
      await notificationsPage.deleteRule(name).catch(() => {});
    }
  });

  // ADO 37157
  test('"Create Notification Rule" opens the wizard prefilled with the staged values', async ({
    page,
    aiAgentPage,
    notificationWizard,
  }) => {
    const name = 'AI Agent Prefill Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));
    const cfg = await card.config();

    await card.createNotificationRule();
    expect(await notificationWizard.isOpen()).toBe(true);
    expect(page.url()).toContain('/Alerting');
    expect(await notificationWizard.currentStep()).toBe('Notification');

    expect(await notificationWizard.name()).toBe(name);
    expect(await notificationWizard.type()).toBe(cfg!.type);

    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Window');
    expect(await notificationWizard.numericValue()).toBe(cfg!.numberOfCalls);

    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Triggers');
    const blocks = await notificationWizard.triggerBlocks();
    expect(blocks).toHaveLength(cfg!.triggers.length);
    expect(blocks[0].level).toBe(cfg!.triggers[0].level);
    expect(cfg!.triggers[0].condition).toContain(blocks[0].value);

    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Cooldown');
    expect(`${await notificationWizard.numericValue()} min`).toBe(cfg!.cooldown);

    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Actions');
    expect(await notificationWizard.isEmailEnabled()).toBe(true);
    expect(await notificationWizard.emailRecipients()).toBe(EMAIL);

    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Filters');
    // the staged rule had no filters
    expect(await notificationWizard.selectedFilter()).toMatch(/Select Filter/i);
  });

  // ADO 37158
  test('saves a rule staged by the agent and lists it in Notifications', async ({
    page,
    aiAgentPage,
    notificationWizard,
    notificationsPage,
  }) => {
    const name = 'AI Agent Saved Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));
    const cfg = await card.config();

    await card.createNotificationRule();
    await notificationWizard.skipToReview();
    expect(await notificationWizard.isReview()).toBe(true);
    expect(await notificationWizard.name()).toBe(name);

    const modal = await notificationWizard.save();
    expect(modal).toContain('Save changes?');
    expect(modal).toContain('Are you sure you want to save the changes?');

    await notificationWizard.confirmSave();
    created.push(name);

    await notificationsPage.waitForGrid();
    const row = await notificationsPage.firstRule();
    expect(Object.values(row!)).toContain(name);
    expect(Object.values(row!)).toContain('Analytics');
    expect(Object.values(row!)).toContain(cfg!.type);
  });

  // ADO 37159
  test('the staged card disappears from the conversation once the rule is saved', async ({
    page,
    aiAgentPage,
    notificationWizard,
    notificationsPage,
  }) => {
    const name = 'AI Agent Consumed Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));

    await card.createNotificationRule();
    await notificationWizard.skipToReview();
    await notificationWizard.saveAndConfirm();
    created.push(name);

    await aiAgentPage.goto();
    await aiAgentPage.openLatestConversation();
    expect(await aiAgentPage.hasRecommendedActions()).toBe(false);
    expect(await AgentActionCard.count(page)).toBe(0);

    // and it stays gone after a reload, while the rule remains saved
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await aiAgentPage.openLatestConversation();
    expect(await AgentActionCard.count(page)).toBe(0);

    await notificationsPage.goto();
    expect(await notificationsPage.hasRule(name)).toBe(true);
  });

  // ADO 37160
  test('"Back to Assistant" returns to the card without creating a rule', async ({
    page,
    aiAgentPage,
    notificationWizard,
    notificationsPage,
  }) => {
    const name = 'AI Agent Back To Assistant Alert';
    const card = await stageRule(page, aiAgentPage, PROMPTS.sentiment(name));
    const before = await card.config();

    await card.createNotificationRule();
    expect(await notificationWizard.isOpen()).toBe(true);

    await notificationWizard.goBackToAssistant();
    expect(page.url()).toContain('/AiAgent');

    const same = new AgentActionCard(page);
    expect(await same.isVisible()).toBe(true);
    expect(await same.name()).toBe(name);
    expect(await same.config()).toEqual(before);

    await notificationsPage.goto();
    expect(await notificationsPage.hasRule(name)).toBe(false);
  });
});
