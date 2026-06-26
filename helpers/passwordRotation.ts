import { promises as fs } from 'fs';
import path from 'path';

/**
 * Password rotation utilities for the reset-password suite.
 *
 * The CallCabinet/Smarsh password policy (from Azure case 23262) requires:
 *   - length 12–64
 *   - at least one letter and one number
 *   - no 3+ sequential characters (e.g. "123", "abc")
 *   - no 3+ repeated characters (e.g. "aaa", "888")
 *   - must differ from the previous ten passwords
 *
 * To keep the reset flow re-runnable we generate a FRESH valid password every run
 * (so it never collides with the previous-ten history) and, after a confirmed
 * reset, persist it back to .env as TEST_PASSWORD so subsequent runs log in with
 * the rotated value.
 */

const ENV_PATH = path.resolve(__dirname, '..', '.env');

const LETTERS_LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l/o to avoid confusing look-alikes
const LETTERS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O
const DIGITS = '23456789'; // no 0/1
const SPECIALS = '_+-=.';

function pick(pool: string): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** True if any run of 3+ identical chars exists. */
function hasRepetitive(s: string): boolean {
  return /(.)\1\1/.test(s);
}

/** True if any 3+ ascending or descending sequence exists (e.g. 234, cba). */
function hasSequential(s: string): boolean {
  for (let i = 0; i + 2 < s.length; i++) {
    const a = s.charCodeAt(i);
    const b = s.charCodeAt(i + 1);
    const c = s.charCodeAt(i + 2);
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a policy-compliant password. Builds a random 16-char string from a
 * mixed pool, guarantees at least one letter/number/special, and retries until it
 * passes the sequential/repetitive checks.
 */
export function generateValidPassword(): string {
  const pool = LETTERS_LOWER + LETTERS_UPPER + DIGITS + SPECIALS;
  for (let attempt = 0; attempt < 200; attempt++) {
    const chars = [pick(LETTERS_LOWER), pick(LETTERS_UPPER), pick(DIGITS), pick(SPECIALS)];
    while (chars.length < 16) chars.push(pick(pool));
    // Shuffle so the guaranteed chars are not always in front.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const candidate = chars.join('');
    if (
      /[a-z]/i.test(candidate) &&
      /[0-9]/.test(candidate) &&
      !hasRepetitive(candidate) &&
      !hasSequential(candidate)
    ) {
      return candidate;
    }
  }
  throw new Error('Failed to generate a valid password after 200 attempts');
}

/**
 * Rewrites a single KEY=value line in .env (adds it if absent), preserving all
 * other lines and comments, and updates process.env in-memory for the current run.
 */
export async function persistEnvVar(key: string, value: string): Promise<void> {
  let content = '';
  try {
    content = await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    content = '';
  }

  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.replace(/\n*$/, '\n') + line + '\n';
  }

  await fs.writeFile(ENV_PATH, content, 'utf8');
  process.env[key] = value;
}
