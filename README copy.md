# callcabinet-automation-playwright

Playwright E2E automation for the Smarsh (CallCabinet) staging environment.

---

## Quick start

```bash
npm install
cp .env.example .env   # fill in credentials
npx playwright install chromium
npm test               # run all tests
```

---

## Login tests

```bash
npm run test:login                          # all login tests, all browsers
npm run test:chrome                         # chromium only
npx playwright test e2e/login/ --headed     # headed mode
```

---

## Password reset test (Gmail API required)

### 1 — Enable Gmail API and create OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or use an existing one).
3. Enable **Gmail API** under *APIs & Services → Library*.
4. Go to *APIs & Services → Credentials → Create Credentials → OAuth client ID*.
5. Application type: **Desktop app**.
6. Download the JSON — you need `client_id` and `client_secret`.

### 2 — Obtain a refresh token

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Click the gear icon → check **Use your own OAuth credentials** → paste `client_id` and `client_secret`.
3. In the left panel, find **Gmail API v1** and select `https://www.googleapis.com/auth/gmail.readonly`.
4. Click **Authorize APIs** → sign in with the **dedicated test Gmail account**.
5. Click **Exchange authorization code for tokens**.
6. Copy the **Refresh token**.

> Use a **dedicated test mailbox** (e.g. `qa.reset@gmail.com`), never a personal account.

### 3 — Set environment variables

In `.env`:

```env
GMAIL_CLIENT_ID=<your client id>
GMAIL_CLIENT_SECRET=<your client secret>
GMAIL_REFRESH_TOKEN=<your refresh token>
GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground
GMAIL_DEFAULT_USER_ID=me

TEST_EMAIL=qa.reset@gmail.com
TEST_PASSWORD=OldPassword123!
TEST_NEW_PASSWORD=NewPassword456!
```

Or use the multi-user format for multiple test accounts:

```env
TEST_USERS_JSON=[{"alias":"resetUser","email":"qa.reset@gmail.com","password":"OldPass1!","newPassword":"NewPass1!"}]
```

### 4 — Verify Gmail API works

```bash
npm run email:check
# or with a custom query:
npm run email:check -- --query 'newer_than:1d' --max 10
```

### 5 — Run the password reset test

> ⚠ **reCAPTCHA note**: The forgot-password form is protected by an invisible
> reCAPTCHA. In headless mode this returns "Captcha validation failed".
> The test must be run with `--headed`, or ask staging to whitelist the test
> IP / test account from CAPTCHA.

```bash
npm run test:reset
# which runs: playwright test e2e/password-reset/ --headed --project=chromium
```

---

## Gmail helper — standalone scripts

### Check connectivity

```bash
npm run email:check
npm run email:check -- --query 'newer_than:1h' --max 10
```

### Wait for a specific email

```bash
# Wait for a password reset email and print the reset link
npm run email:wait -- \
  --query 'to:qa.reset@gmail.com subject:("reset password") newer_than:10m' \
  --extract-link \
  --link-pattern 'reset|password|token'

# Wait for a confirmation/verification email
npm run email:wait -- \
  --query 'to:qa.reset@gmail.com ("confirm your email" OR verification) newer_than:10m' \
  --extract-link \
  --link-pattern 'confirm|verify|token'

# Custom timeout (seconds × 1000)
npm run email:wait -- --query '...' --timeout 120000
```

---

## Gmail helper API (`helpers/gmailAgent.ts`)

All functions are async and throw on error.

| Function | Description |
|---|---|
| `createGmailClient()` | Returns an authorized Gmail API client |
| `searchEmails({ query, maxResults })` | Returns matching message stubs |
| `getEmailById(id)` | Returns full message with payload |
| `extractEmailBody(message)` | Returns `{ text, html, parts }` |
| `extractLinksFromEmail(body)` | Returns deduplicated array of http/https links |
| `waitForEmail({ query, timeoutMs, intervalMs })` | Polls until email arrives |
| `waitForEmailLink({ query, linkPattern, ... })` | Waits + returns matched link |
| `waitForPasswordResetLink({ email, appName, timeoutMs })` | High-level password-reset helper |
| `waitForConfirmationLink({ email, appName, timeoutMs })` | High-level confirmation helper |
| `waitForMagicLink({ email, timeoutMs })` | High-level magic-link helper |
| `waitForInvitationLink({ email, timeoutMs })` | High-level invitation helper |
| `safeMetadata(message)` | Returns `{ subject, from, date, snippet }` — no secrets |

### Usage in any test or script

```ts
import { waitForPasswordResetLink } from './helpers/gmailAgent';

const resetLink = await waitForPasswordResetLink({
  email: 'qa.reset@gmail.com',
  appName: 'Smarsh',
  timeoutMs: 90_000,
});

await page.goto(resetLink);
```

---

## Security rules

- **Never commit `.env`** — it is gitignored.
- **Never log passwords, tokens, or full email bodies** in test output.
- Use a **dedicated test mailbox only** — never a personal or shared business account.
- Refresh tokens are long-lived credentials — rotate them if compromised.
- The `safeMetadata()` helper is provided specifically to allow safe printing of email metadata in scripts without leaking body content.
