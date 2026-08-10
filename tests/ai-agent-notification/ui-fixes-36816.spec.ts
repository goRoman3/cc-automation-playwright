import { test, expect } from '../../fixtures/fixtures';
import { AgentActionCard } from '../../pages/ai-agent-notification/AgentActionCard';
import { NotificationWizard } from '../../pages/notifications/NotificationWizard';
import { adminUser, openAgent, stageRule, PROMPTS, SITE, EMAIL } from './fixtures';

/**
 * User Story 36816 — "Additional UI fixes for AI agent Create Notification flow".
 * ADO: 37165, 37166, 37167, 37168, 37169, 37170. One spec per fix.
 *
 *   1 validation of unpopulated mandatory fields fires on open  -> 37165
 *   2 trigger values render for every notification type         -> 37166 (Topics), 37167 (QAScores)
 *   3 names resolved instead of raw identifiers                 -> 37168
 *   4 several triggers do not break the layout                  -> 37169
 *   5 values survive reopening the conversation                 -> 37170
 *
 * Ported from the exploration scaffold (DOM verified on staging 2026-08-10);
 * full element inventory + behaviour notes live in docs/ai-agent-notification-map.md.
 * Needs a super-admin account under the "admin" alias in TEST_USERS_JSON — see
 * helpers/testUsers.ts.
 */

// A raw identifier leaking into the UI: a GUID, or a bare number where a name
// is expected. Thresholds and scores are numeric on purpose, so this is only
// applied to topic / section / site / tag values.
const looksLikeId = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(v) || /^\d+$/.test(v);

test.describe('AI Agent notification card — User Story 36816 UI fixes', () => {
  test.skip(
    !adminUser.email || !adminUser.password,
    'Set a super-admin user under the "admin" alias in TEST_USERS_JSON to run this suite',
  );

  test.beforeEach(async ({ loginPage, companySelector, aiAgentPage }, testInfo) => {
    testInfo.setTimeout(420000);
    await openAgent(loginPage, companySelector, aiAgentPage);
  });

  // ADO 37165 — fix 1
  test('flags the missing recipients as soon as the Actions step opens', async ({
    page,
    aiAgentPage,
    notificationWizard,
  }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.topicsNoRecipients('AI Agent No Recipients Alert'));

    // nothing was staged for email or webhook
    expect((await card.summaryParts())!.channels).toEqual(['UI']);
    expect((await card.config())!.recipients).toEqual([]);

    await card.createNotificationRule();
    for (const step of ['Window', 'Triggers', 'Cooldown', 'Actions'] as const) {
      await notificationWizard.next();
      expect(await notificationWizard.currentStep()).toBe(step);
    }

    // the error is there on arrival — no Save, no Next needed
    expect(await notificationWizard.hasRecipientsError()).toBe(true);
    expect(await notificationWizard.errors()).toContain(NotificationWizard.RECIPIENTS_REQUIRED);
    expect(await notificationWizard.isEmailEnabled()).toBe(false);
    expect(await notificationWizard.isWebhookEnabled()).toBe(false);

    // and it blocks the step
    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Actions');
    expect(await notificationWizard.hasRecipientsError()).toBe(true);

    await notificationWizard.enableEmail(EMAIL);
    expect(await notificationWizard.hasRecipientsError()).toBe(false);
    await notificationWizard.next();
    expect(await notificationWizard.currentStep()).toBe('Filters');
  });

  // ADO 37166 — fix 2, Topics
  test('renders the trigger values of a Topics rule', async ({ page, aiAgentPage, notificationWizard }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.topicsNoRecipients('AI Agent Topic Trigger Alert'));

    const cfg = await card.config();
    expect(cfg!.type).toBe('Topics');
    expect(cfg!.triggers.length).toBeGreaterThanOrEqual(1);

    for (const t of cfg!.triggers) {
      // "warning: is Customer Escalation" — condition and topic, never blank
      expect(t.condition).toMatch(/^is\s+\S/i);
      const topic = t.condition.replace(/^is\s+/i, '').trim();
      expect(topic.length).toBeGreaterThan(0);
      expect(looksLikeId(topic)).toBe(false);
      expect(t.threshold).toMatch(/^\d+(\.\d+)?%$/);
    }

    await card.createNotificationRule();
    await notificationWizard.goToStep('Triggers');
    const blocks = await notificationWizard.triggerBlocks();
    expect(blocks).toHaveLength(cfg!.triggers.length);
    for (const b of blocks) {
      expect(b.condition).toMatch(/^IS/i);
      expect(b.value, 'the Trigger Value (Topic) field must be filled in').toBeTruthy();
    }
  });

  // ADO 37167 — fix 2, QA Scores
  test('renders the trigger values of a QAScores rule', async ({ page, aiAgentPage, notificationWizard }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.qaScores('AI Agent QA Trigger Alert'));

    const cfg = await card.config();
    expect(cfg!.type).toBe('QAScores');
    expect(cfg!.triggers).toHaveLength(1);

    const t = cfg!.triggers[0];
    expect(t.level).toBe('critical');
    // "critical: <= 60" — operator and score
    expect(t.condition).toMatch(/[<>]=?\s*\d/);
    // "Section: Discovery" — the QA section by name
    expect(t.scope, 'the trigger must name the QA scope it applies to').not.toBeNull();
    expect(t.scope!.value.length).toBeGreaterThan(0);
    expect(looksLikeId(t.scope!.value)).toBe(false);
    expect(t.threshold).toMatch(/%$/);

    await card.createNotificationRule();
    await notificationWizard.goToStep('Triggers');
    const [block] = await notificationWizard.triggerBlocks();
    expect(block.scope).toBe(t.scope!.label);
    expect(block.value).toBe(t.scope!.value);
    expect(t.condition).toContain(block.score);
  });

  // ADO 37168 — fix 3
  test('shows resolved names instead of raw identifiers', async ({ page, aiAgentPage, notificationWizard }) => {
    const topicCard = await stageRule(page, aiAgentPage, PROMPTS.topicsNoRecipients('AI Agent Names Topic Alert'));
    const topicCfg = await topicCard.config();

    // the site filter is a name, not an id
    expect(topicCfg!.filters.length).toBe(1);
    expect(topicCfg!.filters[0].label).toBe('SiteName');
    expect(topicCfg!.filters[0].value).toBe(SITE);

    // so is the topic inside every trigger
    for (const t of topicCfg!.triggers) {
      expect(looksLikeId(t.condition.replace(/^is\s+/i, '').trim())).toBe(false);
    }

    await topicCard.createNotificationRule();
    await notificationWizard.goToStep('Triggers');
    const blocks = await notificationWizard.triggerBlocks();
    expect(looksLikeId(blocks[0].value!)).toBe(false);
    await notificationWizard.goToStep('Filters');
    expect(await notificationWizard.selectedFilter()).toContain(SITE);
    await notificationWizard.goBackToAssistant();

    // and the QA section resolves to its name as well
    const qaCard = await stageRule(page, aiAgentPage, PROMPTS.qaScores('AI Agent Names QA Alert'));
    const qaCfg = await qaCard.config();
    expect(qaCfg!.triggers[0].scope).not.toBeNull();
    expect(looksLikeId(qaCfg!.triggers[0].scope!.value)).toBe(false);

    // nothing anywhere on either card is blank
    for (const cfg of [topicCfg, qaCfg]) {
      expect(cfg!.type).toBeTruthy();
      expect(cfg!.cooldown).toBeTruthy();
      for (const t of cfg!.triggers) {
        expect(t.condition.trim().length).toBeGreaterThan(0);
        expect(t.threshold).toBeTruthy();
      }
    }
  });

  // ADO 37169 — fix 4
  test('keeps the layout with several triggers, grouped per trigger', async ({ page, aiAgentPage, notificationWizard }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.topicsNoRecipients('AI Agent Multi Trigger Alert'));

    const summary = await card.summaryParts();
    expect(summary!.triggers).toBe(2);

    const cfg = await card.config();
    expect(cfg!.triggers).toHaveLength(2);
    // each trigger owns its threshold — the chips are grouped, so a threshold
    // is never left dangling on a row of its own
    for (const t of cfg!.triggers) {
      expect(t.threshold, `trigger "${t.level}" lost its threshold`).toMatch(/%$/);
      expect(t.raw[0]).toMatch(new RegExp(`^${t.level}:`, 'i'));
      expect(t.raw.some((l) => /^Trigger Threshold:/i.test(l))).toBe(true);
    }
    expect(cfg!.triggers[0].level).not.toBe(cfg!.triggers[1].level);

    // the card must not overflow its own container, at full width and narrow
    const overflows = async () =>
      await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        if (!c) return null;
        return c.scrollWidth > c.clientWidth + 2;
      }, AgentActionCard.rootSelector());
    expect(await overflows()).toBe(false);

    await page.setViewportSize({ width: 1100, height: 900 });
    await page.waitForTimeout(1500);
    expect(await overflows()).toBe(false);
    const narrow = await card.config();
    expect(narrow!.triggers).toHaveLength(2);
    await page.setViewportSize({ width: 1600, height: 950 });

    await card.createNotificationRule();
    await notificationWizard.goToStep('Triggers');
    const blocks = await notificationWizard.triggerBlocks();
    expect(blocks).toHaveLength(2);
    expect(blocks.map((b) => b.level).sort()).toEqual(cfg!.triggers.map((t) => t.level).sort());
  });

  // ADO 37170 — fix 5
  test('keeps the staged values when the conversation is reopened', async ({ page, aiAgentPage, notificationWizard }) => {
    const card = await stageRule(page, aiAgentPage, PROMPTS.topicsNoRecipients('AI Agent Persisted Alert'));
    const before = await card.config();
    const name = await card.name();
    expect(before!.triggers).toHaveLength(2);

    // leave the conversation and come back
    await aiAgentPage.startNewConversation();
    expect(await AgentActionCard.count(page)).toBe(0);
    await aiAgentPage.openLatestConversation();

    const reopened = new AgentActionCard(page);
    expect(await reopened.isVisible()).toBe(true);
    expect(await reopened.name()).toBe(name);
    expect(await reopened.config()).toEqual(before);

    // and survive a reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(7000);
    await aiAgentPage.openLatestConversation();
    const afterReload = new AgentActionCard(page);
    expect(await afterReload.config()).toEqual(before);

    // the restored values are the ones the wizard is prefilled with
    await afterReload.createNotificationRule();
    expect(await notificationWizard.name()).toBe(name);
    expect(await notificationWizard.type()).toBe(before!.type);
  });
});
