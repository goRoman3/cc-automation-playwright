import { test, expect } from '@playwright/test';

/**
 * Azure Login case 6876 — Verify the Login form does not reveal security
 * information via the page source.
 *
 * We scan the served HTML for a denylist of patterns that should never appear in
 * a public login page (private keys, cloud credentials, connection strings,
 * config secrets). This is intentionally conservative; extend the denylist as new
 * leak classes are identified.
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'RSA/PEM private key', re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'DB connection string', re: /(?:Data Source|Server)=.*(?:Password|Pwd)=/i },
  { name: 'Bearer/secret assignment', re: /(?:client_secret|api[_-]?key|secret)\s*[:=]\s*["'][A-Za-z0-9._\-]{16,}["']/i },
  { name: 'Private connection host', re: /(?:Password|Pwd)\s*=\s*[^"'\s;]{6,}/i },
];

test.describe('6876 Login page source does not leak secrets', () => {
  test('served HTML contains no security information', async ({ page }) => {
    await page.goto('/');
    const html = await page.content();

    for (const { name, re } of SECRET_PATTERNS) {
      expect(html, `page source should not contain ${name}`).not.toMatch(re);
    }
  });
});
