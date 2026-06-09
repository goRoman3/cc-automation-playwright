#!/usr/bin/env tsx

/**
 * Verifies that Gmail API credentials work and lists recent emails.
 *
 * Usage:
 *   npx tsx scripts/check-email-agent.ts
 *   npx tsx scripts/check-email-agent.ts --query 'newer_than:1d'
 *   npx tsx scripts/check-email-agent.ts --query 'to:qa@example.com' --max 10
 *
 * Never prints tokens, passwords, or full email bodies.
 */

import 'dotenv/config';
import { searchEmails, getEmailById, safeMetadata } from '../helpers/gmailAgent';

// C4 fix: proper named-arg lookup — args[indexOf+1] with indexOf=-1 would silently
// return the first element of the args array and use it as the query value.
function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const query = getArg('--query') ?? 'newer_than:1d';
const maxStr = getArg('--max');
const max = maxStr ? parseInt(maxStr, 10) : 5;

async function main(): Promise<void> {
  console.log('\n=== Gmail API connection check ===');
  console.log(`Query   : ${query}`);
  console.log(`Max     : ${max}`);
  console.log('');

  const messages = await searchEmails({ query, maxResults: max });

  if (messages.length === 0) {
    console.log('No emails found matching the query.');
    return;
  }

  console.log(`Found ${messages.length} email(s):\n`);

  for (const msg of messages) {
    const full = await getEmailById(msg.id!);
    const meta = safeMetadata(full);

    console.log(`  [${meta.id}]`);
    console.log(`  Subject : ${meta.subject}`);
    console.log(`  From    : ${meta.from}`);
    console.log(`  Date    : ${meta.date}`);
    console.log(`  Snippet : ${meta.snippet.substring(0, 120)}`);
    console.log('');
  }

  console.log('✓ Gmail API is working.');
}

main().catch(err => {
  console.error('\n✗ Gmail API check failed:', (err as Error).message);
  process.exit(1);
});
