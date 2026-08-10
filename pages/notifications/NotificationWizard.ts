import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * NotificationWizard — the "Create New Notification" wizard, as opened from a
 * staged AI Agent action card. Verified 2026-08-10.
 *
 * It lives on /Alerting?tab=management, the same URL as the notifications grid,
 * so the URL cannot tell you which of the two is on screen — use isOpen().
 *
 * Steps: Notification -> Window -> Triggers -> Cooldown -> Actions -> Filters -> Review
 *
 * Quirks:
 *  1. Every numeric field of every step shares the id `daysCountInput`. Read
 *     them per step, never by a global id lookup.
 *  2. currentStep() is derived from the "Next: X" button, which names the step
 *     that follows — the step bar itself has no stable hook.
 *  3. Save opens a "Save changes?" modal that has its own Confirm, while the
 *     wizard's own Save button stays on the page behind it. Scope the confirm
 *     click to the modal or you press Save a second time.
 *  4. When the agent staged no recipients, the Actions step renders its error
 *     immediately and refuses to advance — that is the User Story 36816 fix,
 *     not a flake.
 */
const STEPS = ['Notification', 'Window', 'Triggers', 'Cooldown', 'Actions', 'Filters', 'Review'] as const;
export type WizardStep = (typeof STEPS)[number];

const RECIPIENTS_REQUIRED = 'Please enable at least one notification method (webhook or email).';

/**
 * One entry per trigger on the Triggers step.
 *  - CallSentiment: value = -0.5,                  scope = null
 *  - Topics:        value = 'Customer Escalation'  (the topic), condition 'IS (IS)'
 *  - QAScores:      scope = 'Section', value = 'Discovery', score = 60
 */
export interface TriggerBlock {
  level: string | null;
  condition: string | null;
  scope: string | null;
  value: string | null;
  score: string | null;
  threshold: string | null;
}

export class NotificationWizard extends BasePage {
  readonly heading: Locator;
  readonly backToAssistant: Locator;
  readonly cancelButton: Locator;
  readonly previousButton: Locator;
  readonly skipToReviewButton: Locator;
  readonly reviewButton: Locator;
  readonly saveButton: Locator;
  readonly updateChartButton: Locator;
  readonly addTriggerButton: Locator;

  readonly nameInput: Locator;
  readonly typeCombo: Locator;
  readonly windowTypeCombo: Locator;
  readonly emailInput: Locator;
  readonly emailCheckbox: Locator;
  readonly webhookCheckbox: Locator;
  readonly tagsCheckbox: Locator;
  readonly filterCombo: Locator;
  readonly errorMessages: Locator;

  static get STEPS(): readonly WizardStep[] {
    return STEPS;
  }

  static get RECIPIENTS_REQUIRED(): string {
    return RECIPIENTS_REQUIRED;
  }

  constructor(page: Page) {
    super(page);

    this.heading = page.locator('text=Create New Notification');
    this.backToAssistant = page.locator('button:has-text("Back to Assistant")');
    this.cancelButton = page.locator('button:has-text("Cancel")').first();
    this.previousButton = page.locator('button:has-text("< Previous")');
    this.skipToReviewButton = page.locator('button:has-text("Skip To Review")');
    this.reviewButton = page.locator('button', { hasText: /^Review$/ });
    this.saveButton = page.locator('button', { hasText: /^Save$/ });
    this.updateChartButton = page.locator('button:has-text("Update Chart")');
    this.addTriggerButton = page.locator('button:has-text("+ Add Trigger")');

    this.nameInput = page.locator('#alertName');
    this.typeCombo = page.locator('[aria-label="alertType"]');
    this.windowTypeCombo = page.locator('[aria-label="windowType"]');
    this.emailInput = page.locator('#emailRecipients');
    this.emailCheckbox = page.locator('input[name="emailRecipients_enabled"]');
    this.webhookCheckbox = page.locator('input[name="webhooks"]');
    this.tagsCheckbox = page.locator('input[name="tags_enabled"]');
    this.filterCombo = page.locator('[aria-label="lookupFilter"]');
    this.errorMessages = page.locator('[class*="step_errorMessage"]');
  }

  async isOpen(): Promise<boolean> {
    const t = await this.page.evaluate(() => document.body.innerText);
    return /Create New Notification/.test(t);
  }

  async isReview(): Promise<boolean> {
    const t = await this.page.evaluate(() => document.body.innerText);
    return /Create New Notification - Review/.test(t);
  }

  /** Derived from the "Next: X" button; "Filters" shows Review, Review shows Save. */
  async currentStep(): Promise<WizardStep | null> {
    if (await this.isReview()) return 'Review';
    const next = await this.page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .filter((x) => {
          const r = x.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .find((x) => /^Next:/.test(((x as HTMLElement).innerText || '').trim()));
      return b ? (b as HTMLElement).innerText.trim().replace(/^Next:\s*/, '') : null;
    });
    if (next) return STEPS[STEPS.indexOf(next as WizardStep) - 1] || null;
    const hasReview = (await this.reviewButton.count()) > 0;
    return hasReview ? 'Filters' : null;
  }

  // ── navigation ─────────────────────────────────────────────
  async next(): Promise<void> {
    const b = this.page.locator('button', { hasText: /^Next:/ }).first();
    await b.click();
    await this.page.waitForTimeout(3500);
  }

  async previous(): Promise<void> {
    await this.previousButton.click();
    await this.page.waitForTimeout(3000);
  }

  /** Walk forward until `step` is on screen; stops early if a step blocks. */
  async goToStep(step: WizardStep): Promise<boolean> {
    for (let i = 0; i < STEPS.length; i++) {
      const at = await this.currentStep();
      if (at === step) return true;
      if (at === 'Filters' && step === 'Review') {
        await this.review();
        continue;
      }
      await this.next();
      if ((await this.currentStep()) === at) return false; // validation blocked us
    }
    return (await this.currentStep()) === step;
  }

  async skipToReview(): Promise<void> {
    await this.skipToReviewButton.click();
    await this.page.waitForTimeout(5000);
  }

  async review(): Promise<void> {
    await this.reviewButton.first().click();
    await this.page.waitForTimeout(5000);
  }

  async goBackToAssistant(): Promise<void> {
    await this.backToAssistant.click();
    await this.page.waitForTimeout(7000);
  }

  // ── saving ─────────────────────────────────────────────────
  /** Click Save and return the confirmation modal's text. */
  async save(): Promise<string | null> {
    await this.saveButton.first().click();
    await this.page.waitForTimeout(2500);
    return await this.modalText();
  }

  async modalText(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const md = Array.from(document.querySelectorAll('[class*="modal" i],[role="dialog"],[class*="dialog" i]')).filter(
        (e) => {
          const r = e.getBoundingClientRect();
          return r.width > 100 && r.height > 60;
        },
      );
      return md.length ? (md[md.length - 1] as HTMLElement).innerText : null;
    });
  }

  /** Confirm inside the modal — scoped, so the wizard's own Save is not hit. */
  async confirmSave(): Promise<void> {
    await this.page.evaluate(() => {
      const md = Array.from(document.querySelectorAll('[class*="modal" i],[role="dialog"],[class*="dialog" i]')).filter(
        (e) => {
          const r = e.getBoundingClientRect();
          return r.width > 100 && r.height > 60;
        },
      );
      if (!md.length) return;
      const b = Array.from(md[md.length - 1].querySelectorAll('button')).find((x) =>
        /^confirm$/i.test(((x as HTMLElement).innerText || '').trim()),
      );
      if (b) (b as HTMLElement).click();
    });
    await this.page.waitForTimeout(8000);
  }

  async saveAndConfirm(): Promise<string | null> {
    const modal = await this.save();
    await this.confirmSave();
    return modal;
  }

  // ── validation ─────────────────────────────────────────────
  async errors(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(document.querySelectorAll('[class*="step_errorMessage"]'))
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((e) => ((e as HTMLElement).innerText || '').trim())
        .filter(Boolean),
    );
  }

  async hasRecipientsError(): Promise<boolean> {
    return (await this.errors()).some((e) => e.includes(RECIPIENTS_REQUIRED));
  }

  // ── field values ───────────────────────────────────────────
  async name(): Promise<string> {
    return await this.nameInput.inputValue();
  }

  async type(): Promise<string> {
    return (await this.typeCombo.innerText()).trim();
  }

  async windowType(): Promise<string> {
    return (await this.windowTypeCombo.innerText()).trim();
  }

  /** The single numeric field of the Window / Cooldown steps. */
  async numericValue(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const i = Array.from(document.querySelectorAll('#daysCountInput')).filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.x < 600;
      });
      return i.length ? (i[0] as HTMLInputElement).value : null;
    });
  }

  async emailRecipients(): Promise<string | null> {
    return (await this.emailInput.count()) ? await this.emailInput.inputValue() : null;
  }

  async isEmailEnabled(): Promise<boolean> {
    return (await this.emailCheckbox.count()) ? await this.emailCheckbox.isChecked() : false;
  }

  async isWebhookEnabled(): Promise<boolean> {
    return (await this.webhookCheckbox.count()) ? await this.webhookCheckbox.isChecked() : false;
  }

  async enableEmail(address: string): Promise<void> {
    await this.emailCheckbox.click();
    await this.page.waitForTimeout(800);
    await this.emailInput.fill(address);
    await this.page.waitForTimeout(800);
  }

  async selectedFilter(): Promise<string | null> {
    return (await this.filterCombo.count()) ? (await this.filterCombo.innerText()).trim() : null;
  }

  /**
   * The Triggers step, split into one entry per trigger. Every control on the
   * step is collected with its y position and cut at each "alertLevel" combo,
   * because the trigger blocks share ids and have no wrapper hook.
   */
  async triggerBlocks(): Promise<TriggerBlock[]> {
    return await this.page.evaluate(() => {
      const vis = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const nodes: { y: number; kind: string; value: string }[] = [];
      document.querySelectorAll('span[role="combobox"], .k-dropdownlist').forEach((e) => {
        if (!vis(e)) return;
        const aria = e.getAttribute('aria-label') || '';
        if (!['alertLevel', 'triggerOperator', 'triggerValue'].includes(aria)) return;
        nodes.push({ y: e.getBoundingClientRect().y, kind: aria, value: ((e as HTMLElement).innerText || '').trim() });
      });
      document.querySelectorAll('input').forEach((e) => {
        if (!vis(e) || (e as HTMLInputElement).type === 'checkbox') return;
        const r = e.getBoundingClientRect();
        if (r.y < 350) return; // above the first trigger block
        nodes.push({ y: r.y, kind: e.id === 'daysCountInput' ? 'number' : 'text', value: (e as HTMLInputElement).value });
      });
      nodes.sort((a, b) => a.y - b.y);

      const out: {
        level: string | null;
        condition: string | null;
        scope: string | null;
        value: string | null;
        score: string | null;
        threshold: string | null;
      }[] = [];
      let cur: (typeof out)[number] | null = null;
      for (const n of nodes) {
        if (n.kind === 'alertLevel') {
          cur = { level: n.value, condition: null, scope: null, value: null, score: null, threshold: null };
          out.push(cur);
          continue;
        }
        if (!cur) continue;
        if (n.kind === 'triggerOperator') cur.condition = n.value;
        else if (n.kind === 'triggerValue') cur.scope = n.value;
        else if (n.kind === 'text') cur.value = n.value;
        else if (n.kind === 'number') {
          // QAScores has two numbers per trigger: the score, then the threshold
          if (cur.scope && cur.score === null) cur.score = n.value;
          else cur.threshold = n.value;
        }
      }
      return out;
    });
  }
}
