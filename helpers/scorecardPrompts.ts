/**
 * Data provider for QA Scorecard generation prompts (bug 36210 / ADO case 37571).
 *
 * `SCORECARD_PROMPTS` is a fixed pool of 500 prompts, built from every
 * combination of call type x focus-area set x scoring scale (10 x 10 x 5).
 * Fixed and enumerable so a failing prompt can be reproduced by index; picking
 * a random subset per run is left to `getRandomPrompts`.
 */

const CALL_TYPES = [
  'customer service',
  'technical support',
  'sales',
  'collections',
  'new-customer onboarding',
  'billing inquiry',
  'insurance claims',
  'healthcare appointment scheduling',
  'retail return and exchange',
  'IT helpdesk',
] as const;

/**
 * Each entry is the list of individual focus areas for one prompt variant.
 * Kept as arrays (not a pre-joined sentence) so a test can assert the
 * AI-generated scorecard's sections/questions actually mention each one,
 * rather than only checking that *a* scorecard got created.
 */
const FOCUS_AREA_SETS: readonly string[][] = [
  ['greeting', 'active listening', 'issue resolution'],
  ['compliance disclosures', 'empathy', 'call closing'],
  ['product knowledge', 'upselling', 'objection handling'],
  ['identity verification', 'data privacy', 'tone'],
  ['de-escalation', 'active listening', 'resolution time'],
  ['script adherence', 'courtesy', 'accuracy'],
  ['hold time management', 'follow-up commitment', 'satisfaction check'],
  ['security compliance', 'professionalism', 'clarity'],
  ['needs assessment', 'cross-selling', 'closing technique'],
  ['empathy', 'clarity', 'next-steps confirmation'],
];

/** Joins a focus-area list into the "a, b, and c" phrasing used in prompts. */
function joinFocusAreas(areas: readonly string[]): string {
  if (areas.length === 1) return areas[0];
  return `${areas.slice(0, -1).join(', ')}, and ${areas[areas.length - 1]}`;
}

const SCORING_SCALES = [
  'a 1-5 scale',
  'a pass/fail scale per question',
  'a 0-2 scale',
  'weighted percentage scoring',
  'a yes/no checklist',
] as const;

export interface ScorecardPromptCase {
  /** Stable index into the 500-prompt pool, for reproducing a specific failure. */
  index: number;
  callType: string;
  /** Individual focus areas requested, e.g. ['greeting', 'active listening', 'issue resolution'] — assert the generated scorecard actually covers each. */
  focusAreas: string[];
  scale: string;
  prompt: string;
}

function buildPromptPool(): ScorecardPromptCase[] {
  const pool: ScorecardPromptCase[] = [];

  for (const callType of CALL_TYPES) {
    for (const focusAreas of FOCUS_AREA_SETS) {
      for (const scale of SCORING_SCALES) {
        pool.push({
          index: pool.length,
          callType,
          focusAreas,
          scale,
          prompt:
            `Create a QA scorecard for evaluating ${callType} calls, ` +
            `focusing on ${joinFocusAreas(focusAreas)}, scored using ${scale}.`,
        });
      }
    }
  }

  return pool;
}

/** Fixed pool of 500 scorecard-generation prompts (10 call types x 10 focus-area sets x 5 scales). */
export const SCORECARD_PROMPTS: readonly ScorecardPromptCase[] = buildPromptPool();

/**
 * Picks `count` distinct prompts at random from the 500-prompt pool.
 *
 * Uses `Math.random` (Fisher-Yates partial shuffle) by default. Pass a
 * `random` function (e.g. a seeded PRNG) to reproduce a specific selection —
 * this matters for Playwright specs in particular: the test list is
 * enumerated once by the runner process and the spec file is then reloaded
 * fresh in each worker process, so a non-deterministic `random` picks a
 * *different* sample on each load and every test fails with "Test not found
 * in the worker process". Use `getRandomPrompts(count, dailyRandom())` in
 * spec files instead (same pool all day, still rotates day to day).
 */
export function getRandomPrompts(
  count: number,
  random: () => number = Math.random,
): ScorecardPromptCase[] {
  if (count < 0 || count > SCORECARD_PROMPTS.length) {
    throw new Error(
      `count must be between 0 and ${SCORECARD_PROMPTS.length}, got ${count}.`,
    );
  }

  const pool = [...SCORECARD_PROMPTS];
  for (let i = pool.length - 1; i > pool.length - 1 - count; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(pool.length - count);
}

/**
 * A small deterministic PRNG (Park-Miller LCG) seeded from a plain number —
 * same seed always produces the same sequence, including across separate
 * Node processes (unlike `Math.random`).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Deterministic per-calendar-day seed (UTC date), so re-running a suite
 *  within the same day — including across separate processes/workers —
 *  reproduces the same random sample, while different days rotate it. */
export function dailyRandom(): () => number {
  const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return createSeededRandom(hash || 1);
}
