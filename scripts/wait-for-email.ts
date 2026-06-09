#!/usr/bin/env tsx

/**
 * CLI utility — waits for an email matching a Gmail query and prints metadata.
 * Optionally extracts and prints a matching link from the email body.
 *
 * Usage:
 *   npx tsx scripts/wait-for-email.ts --query '<gmail query>'
 *   npx tsx scripts/wait-for-email.ts --query '...' --extract-link
 *   npx tsx scripts/wait-for-email.ts --query '...' --extract-link --link-pattern 'reset|token'
 *   npx tsx scripts/wait-for-email.ts --query '...' --timeout 120000
 *
 * Examples:
 *   npx tsx scripts/wait-for-email.ts \
 *     --query 'to:qa.reset.001@example.com subject:("reset password") newer_than:10m' \
 *     --extract-link --link-pattern 'reset|password|token'
 */

import 'dotenv/config';
import {
  waitForEmail,
  extractEmailBody,
  extractLinksFromEmail,
  safeMetadata,
} from '../helpers/gmailAgent';

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const query = getArg('--query');
  const timeoutMs = parseInt(getArg('--timeout') ?? '60000', 10);
  const intervalMs = parseInt(getArg('--interval') ?? '5000', 10);
  const extractLink = hasFlag('--extract-link');
  const linkPattern = getArg('--link-pattern');

  if (!query) {
    console.error(
      'Usage: npx tsx scripts/wait-for-email.ts --query "<gmail query>" [options]',
    );
    process.exit(1);
  }

  console.log('\nWaiting for email...');
  console.log(`Query   : ${query}`);
  console.log(`Timeout : ${timeoutMs / 1000}s`);
  console.log('');

  const message = await waitForEmail({ query, timeoutMs, intervalMs });
  const meta = safeMetadata(message);

  console.log('✓ Email received:\n');
  console.log(`  Subject : ${meta.subject}`);
  console.log(`  From    : ${meta.from}`);
  console.log(`  Date    : ${meta.date}`);
  console.log(`  Snippet : ${meta.snippet.substring(0, 180)}`);

  if (extractLink) {
    const body = extractEmailBody(message);
    const links = extractLinksFromEmail(body);

    if (links.length === 0) {
      console.log('\n  No links found in email body.');
    } else if (linkPattern) {
      const re = new RegExp(linkPattern, 'i');
      const match = links.find(l => re.test(l));

      if (match) {
        console.log(`\n  Matching link (pattern: "${linkPattern}"):\n  ${match}`);
      } else {
        console.log(`\n  No link matching pattern "${linkPattern}". All links:`);
        links.forEach(l => console.log(`    ${l}`));
      }
    } else {
      console.log(`\n  First link found:\n  ${links[0]}`);
      if (links.length > 1) {
        console.log(`  (${links.length - 1} more link(s) found)`);
      }
    }
  }
}

main().catch(err => {
  console.error('\n✗ Error:', (err as Error).message);
  process.exit(1);
});
