import dotenv from 'dotenv';
import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

dotenv.config();

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface EmailPart {
  mimeType: string;
  content: string;
}

export interface EmailBody {
  text: string;
  html: string;
  parts: EmailPart[];
}

export interface SafeMetadata {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface SearchEmailsOptions {
  query: string;
  maxResults?: number;
}

export interface WaitForEmailOptions {
  query: string;
  timeoutMs?: number;
  intervalMs?: number;
  /** Only return emails with internalDate >= this timestamp (ms). Prevents stale emails from a prior run satisfying the query. */
  sentAfterMs?: number;
}

export interface WaitForEmailLinkOptions extends WaitForEmailOptions {
  linkPattern?: string | RegExp;
}

export interface WaitForPasswordResetLinkOptions {
  email: string;
  appName?: string;
  timeoutMs?: number;
  /** Only match emails sent after this timestamp (ms). Defaults to time of call. */
  sentAfterMs?: number;
}

export interface WaitForConfirmationLinkOptions {
  email: string;
  appName?: string;
  timeoutMs?: number;
  sentAfterMs?: number;
}

// ─────────────────────────────────────────────
// Client (cached singleton — one auth round-trip per process)
// ─────────────────────────────────────────────

let _client: gmail_v1.Gmail | null = null;

export function createGmailClient(): gmail_v1.Gmail {
  if (_client) return _client;

  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    throw new Error(
      'Gmail API credentials missing. Required env vars: ' +
        'GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN',
    );
  }

  const auth = new google.auth.OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground',
  );

  auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  _client = google.gmail({ version: 'v1', auth });
  return _client;
}

// ─────────────────────────────────────────────
// Search & Fetch
// ─────────────────────────────────────────────

export async function searchEmails({
  query,
  maxResults = 10,
}: SearchEmailsOptions): Promise<gmail_v1.Schema$Message[]> {
  const gmail = createGmailClient();
  const userId = process.env.GMAIL_DEFAULT_USER_ID || 'me';

  const res = await gmail.users.messages.list({ userId, q: query, maxResults });
  return res.data.messages ?? [];
}

export async function getEmailById(messageId: string): Promise<gmail_v1.Schema$Message> {
  const gmail = createGmailClient();
  const userId = process.env.GMAIL_DEFAULT_USER_ID || 'me';

  const res = await gmail.users.messages.get({ userId, id: messageId, format: 'full' });
  return res.data;
}

// ─────────────────────────────────────────────
// Body extraction
// ─────────────────────────────────────────────

export function extractEmailBody(message: gmail_v1.Schema$Message): EmailBody {
  const collected: EmailPart[] = [];

  function walk(payload: gmail_v1.Schema$MessagePart | null | undefined): void {
    if (!payload) return;

    if (payload.parts?.length) {
      for (const part of payload.parts) walk(part);
      return;
    }

    // C5 fix: removed the redundant pre-walk guard that double-pushed single-part bodies.
    // walk() already handles single-part messages (no parts → check body.data directly).
    if (payload.body?.data) {
      collected.push({
        mimeType: payload.mimeType ?? 'text/plain',
        content: Buffer.from(payload.body.data, 'base64url').toString('utf-8'),
      });
    }
  }

  walk(message.payload ?? null);

  const plain = collected.find(p => p.mimeType === 'text/plain');
  const html = collected.find(p => p.mimeType === 'text/html');

  return {
    text: plain?.content ?? '',
    html: html?.content ?? '',
    parts: collected,
  };
}

// ─────────────────────────────────────────────
// Link extraction
// ─────────────────────────────────────────────

export function extractLinksFromEmail(emailBody: EmailBody): string[] {
  const raw = emailBody.text + '\n' + emailBody.html;

  const decoded = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/=\r?\n/g, ''); // unfold quoted-printable line continuations

  const links = decoded.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];

  return [...new Set(links.map(l => l.replace(/[.,;:!?)]+$/, '')))];
}

// ─────────────────────────────────────────────
// Polling helpers
// ─────────────────────────────────────────────

export async function waitForEmail({
  query,
  timeoutMs = 60_000,
  intervalMs = 5_000,
  sentAfterMs,
}: WaitForEmailOptions): Promise<gmail_v1.Schema$Message> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const messages = await searchEmails({ query, maxResults: 1 });

    if (messages.length > 0) {
      const full = await getEmailById(messages[0].id!);
      // C7 fix: skip emails older than sentAfterMs to prevent stale matches from a prior run
      const emailTs = full.internalDate ? parseInt(full.internalDate, 10) : 0;
      if (sentAfterMs === undefined || emailTs >= sentAfterMs) {
        return full;
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await new Promise<void>(r => setTimeout(r, Math.min(intervalMs, remaining)));
  }

  throw new Error(`Timed out after ${timeoutMs / 1000}s waiting for email.\nQuery: ${query}`);
}

export async function waitForEmailLink({
  query,
  linkPattern,
  timeoutMs = 60_000,
  intervalMs = 5_000,
  sentAfterMs,
}: WaitForEmailLinkOptions): Promise<string> {
  const message = await waitForEmail({ query, timeoutMs, intervalMs, sentAfterMs });
  const body = extractEmailBody(message);
  const links = extractLinksFromEmail(body);

  if (!linkPattern) {
    const first = links[0];
    if (!first) throw new Error('No links found in email body.');
    return first;
  }

  const re = linkPattern instanceof RegExp ? linkPattern : new RegExp(linkPattern, 'i');
  const match = links.find(l => re.test(l));

  if (!match) {
    throw new Error(
      `No link matching "${linkPattern}" found.\nAvailable links:\n${links.join('\n')}`,
    );
  }

  return match;
}

// ─────────────────────────────────────────────
// High-level flow helpers
// ─────────────────────────────────────────────

export async function waitForPasswordResetLink({
  email,
  appName,
  timeoutMs = 90_000,
  sentAfterMs = Date.now(),
}: WaitForPasswordResetLinkOptions): Promise<string> {
  const app = appName ? ` "${appName}"` : '';
  const query = `to:${email} subject:(reset password${app}) newer_than:10m`;

  return waitForEmailLink({ query, linkPattern: /reset|password|token/i, timeoutMs, sentAfterMs });
}

export async function waitForConfirmationLink({
  email,
  appName,
  timeoutMs = 90_000,
  sentAfterMs = Date.now(),
}: WaitForConfirmationLinkOptions): Promise<string> {
  const app = appName ? ` "${appName}"` : '';
  const query = `to:${email} (subject:("confirm your email") OR subject:(verification)${app}) newer_than:10m`;

  return waitForEmailLink({
    query,
    linkPattern: /confirm|verify|token|activate/i,
    timeoutMs,
    sentAfterMs,
  });
}

export async function waitForMagicLink({
  email,
  timeoutMs = 90_000,
}: {
  email: string;
  timeoutMs?: number;
}): Promise<string> {
  const query = `to:${email} subject:(magic link OR sign in OR login link) newer_than:10m`;
  return waitForEmailLink({ query, linkPattern: /magic|token|login|auth/i, timeoutMs });
}

export async function waitForInvitationLink({
  email,
  timeoutMs = 90_000,
}: {
  email: string;
  timeoutMs?: number;
}): Promise<string> {
  const query = `to:${email} subject:(invite OR invitation OR you've been invited) newer_than:10m`;
  return waitForEmailLink({ query, linkPattern: /invite|invitation|accept/i, timeoutMs });
}

// ─────────────────────────────────────────────
// Safe email metadata (for scripts, no secrets)
// ─────────────────────────────────────────────

export function safeMetadata(message: gmail_v1.Schema$Message): SafeMetadata {
  const headers = Object.fromEntries(
    (message.payload?.headers ?? []).map(h => [h.name?.toLowerCase() ?? '', h.value ?? '']),
  );

  return {
    id: message.id ?? '',
    subject: headers['subject'] ?? '(no subject)',
    from: headers['from'] ?? '(unknown)',
    date: headers['date'] ?? '(unknown)',
    snippet: message.snippet ?? '',
  };
}
