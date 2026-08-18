import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';
import { dismissAnnouncementModal } from '../shared/dismissAnnouncementModal';

/**
 * Page object for the QA Scorecard flow-chart editor (`/QAScorecards`,
 * question-node graph view) — reached either via "Create New Evaluation
 * Form" or via the AI Agent's "Create QA Scorecard" action
 * (`AiAgentPage.createStagedScorecard()`), which lands here with the
 * AI-generated structure already loaded but unsaved.
 *
 * Verified live on staging (2026-08-18), company SmarshCR Sales.
 *
 * Saving is a two-step flow:
 *   1. "Save and Exit" opens a dialog with Form Name / Archive / Passing
 *      Percentage / Description. Form Name and Description arrive
 *      pre-filled from the AI-generated content; Passing Percentage is
 *      empty and is NOT required (confirmed by a successful save with it
 *      left blank).
 *   2. "Save" in that dialog commits the form and returns to the QA
 *      Scorecards listing.
 */
export class ScorecardEditorPage extends BasePage {
  readonly saveAndExitButton: Locator;
  readonly formNameInput: Locator;
  readonly passingPercentageInput: Locator;
  readonly descriptionInput: Locator;
  readonly saveDialogSaveButton: Locator;
  readonly saveDialogCancelButton: Locator;
  readonly previewButton: Locator;
  /** Each question's flow-chart node. Its accessible name is the full
   *  question text; a disabled textbox inside holds just the section name. */
  readonly questionNodes: Locator;
  /** React Flow's "fit view" control — zooms/pans so every node is within
   *  the viewport. Nodes outside it have been observed not fully rendered
   *  right after navigating in, so `getSectionsAndQuestions()` clicks this
   *  first rather than trusting whatever the canvas happened to load at. */
  readonly fitViewButton: Locator;

  constructor(page: Page) {
    super(page);
    this.saveAndExitButton = page.getByRole('button', { name: 'Save and Exit' });
    this.formNameInput = page.getByRole('textbox', { name: 'Enter Name' });
    this.passingPercentageInput = page.getByRole('textbox', { name: 'Passing Percentage' });
    this.descriptionInput = page.getByRole('textbox', { name: 'Enter Description' });
    this.saveDialogSaveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.saveDialogCancelButton = page.getByRole('button', { name: 'Cancel' });
    this.previewButton = page.getByRole('button', { name: 'Preview' });
    this.questionNodes = page.getByRole('button', { name: /^Question / });
    this.fitViewButton = page.getByRole('button', { name: 'fit view' });
  }

  /**
   * Reads every question node's text and section name directly from the
   * editor — each node has 3 stacked textboxes: question text, an empty
   * spacer, then the section name. Preview (the step-by-step Yes/No quiz
   * view) shows the same data one question at a time, but paging through it
   * to verify content needs one "Move Right" click per question; reading the
   * editor nodes gets the same information from a single snapshot.
   *
   * Clicks "fit view" and waits for the first node before reading: right
   * after navigating in from the AI Agent, the canvas can still be laying
   * out (confirmed live — an immediate read found zero nodes even though
   * the same canvas was fully visible moments later).
   */
  async getSectionsAndQuestions(): Promise<{ section: string; question: string }[]> {
    // The announcement modal (see dismissAnnouncementModal doc) has been
    // observed reappearing here too, its overlay blocking the canvas.
    await dismissAnnouncementModal(this.page);
    await this.fitViewButton.click().catch(() => {});
    await this.questionNodes.first().waitFor({ state: 'visible', timeout: 15_000 });

    const count = await this.questionNodes.count();
    const rows: { section: string; question: string }[] = [];

    for (let i = 0; i < count; i++) {
      const textboxes = this.questionNodes.nth(i).getByRole('textbox');
      rows.push({
        question: await textboxes.nth(0).inputValue(),
        section: await textboxes.nth(2).inputValue(),
      });
    }

    return rows;
  }

  /**
   * Asserts the generated scorecard actually covers every requested focus
   * area — a scorecard that saves but has the wrong content is still a
   * failure for this suite's purpose. Matches on substring OR shared
   * significant word (>3 letters) rather than requiring an exact phrase:
   * confirmed live that the agent paraphrases requested areas into its own
   * section names (asked for "resolution time", got a section named
   * "Resolution Efficiency" — same concept, different wording), so an exact
   * substring match is stricter than what "covers this focus area"
   * actually means here.
   */
  async assertCoversFocusAreas(focusAreas: readonly string[]): Promise<void> {
    const rows = await this.getSectionsAndQuestions();
    const sections = [...new Set(rows.map(r => r.section.toLowerCase()))];

    for (const area of focusAreas) {
      const needle = area.toLowerCase();
      const areaWords = needle.split(/\s+/).filter(w => w.length > 3);
      const covered = sections.some(
        s => s.includes(needle) || needle.includes(s) || areaWords.some(w => s.includes(w)),
      );
      if (!covered) {
        throw new Error(
          `Generated scorecard has no section covering "${area}". ` +
            `Sections present: ${sections.join(', ') || '(none)'}`,
        );
      }
    }
  }

  /** Appends a sortable, collision-free suffix, e.g. "Customer Service Core
   *  QA (2026-08-18T20-40-05-123Z)" — repeated runs against the same
   *  long-lived company must not collide on name. */
  static uniqueName(baseName: string): string {
    return `${baseName} (${new Date().toISOString().replace(/[:.]/g, '-')})`;
  }

  /**
   * Opens the Save dialog, rewrites Form Name to a unique value (based on
   * whatever name arrived pre-filled, e.g. from the AI Agent), and confirms.
   * Returns the exact name saved, for the caller to verify/clean up by.
   *
   * Waits for the dialog itself to close before checking the URL — matching
   * the URL alone was observed to be unreliable: `waitForURL` was seen to
   * be satisfied (the pattern matched at least once) even on a run where
   * the app then bounced back into the editor, dialog gone, save presumably
   * not actually committed. The dialog closing is a more direct signal that
   * the click was actually processed rather than just briefly reflected in
   * history.
   */
  async saveAndExit(): Promise<string> {
    await dismissAnnouncementModal(this.page);
    await this.saveAndExitButton.click();
    await this.formNameInput.waitFor({ state: 'visible' });

    const prefilledName = await this.formNameInput.inputValue();
    const uniqueName = ScorecardEditorPage.uniqueName(prefilledName);
    await this.formNameInput.fill(uniqueName);

    // Re-check right before this second click too — the modal has been
    // observed popping up mid-flow, later than its usual on-load timing,
    // specifically because automation moves through steps faster than a
    // human would, so a dismiss earlier in the method isn't enough on its
    // own; every click in this file re-checks immediately before it fires.
    await dismissAnnouncementModal(this.page);
    await this.saveDialogSaveButton.click();
    await this.saveDialogSaveButton.waitFor({ state: 'hidden', timeout: 20_000 });
    await this.page.waitForURL(/\/QAScorecards$/, { timeout: 15_000 });

    return uniqueName;
  }
}
