# cc-automation-playwright

Playwright E2E automation for the CallCabinet (Smarsh) **staging** environment.
There is no local app to spin up — every test runs against a real staging URL.

## 1. Setup

```bash
npm install
npx playwright install chromium
```

Create a `.env` file in the project root (not committed — see `.gitignore`) with
at least the following:

| Variable | Required for | Notes |
|---|---|---|
| `BASE_URL` | everything | Staging URL, e.g. `https://atmossystemsstaging.callcabinet.com`. The config throws at startup if this is missing. |
| `TEST_EMAIL` / `TEST_PASSWORD` | login, call-listing, chat-listing, smoke | Single-user credentials. Tests that need auth skip gracefully if absent. |
| `TEST_NEW_PASSWORD` | password-reset suite | The password the reset flow sets. |
| `TEST_USERS_JSON` | multi-user scenarios | Alternative to the single-user vars above — a JSON array, each entry `{alias, email, password, newPassword?}`. Overrides `TEST_EMAIL`/`TEST_PASSWORD` when set. |
| `TEST_CC_EMAIL` / `TEST_CC_PASSWORD` | `call-listing-actions.spec.ts` | A second, cross-company test user. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` / `GMAIL_REFRESH_TOKEN` | `@email @integration` tests, password-reset | Gmail OAuth2 for polling test-mailbox emails. See "Gmail setup" below. |
| `user` / `adminpass` | Dev Portal / API Management suite (`tests/dev-portal/`) | Non-standard names on purpose — this account logs straight into company **CC Test 1**. |
| `DEV_PORTAL_SUBSCRIPTION_KEY` | Dev Portal / API Management suite | The exact subscription-key label to select in the portal's "Try this operation" console, e.g. `Primary: API_test`. This is environment-specific and can change — check **Settings → API Management** in the app if dev-portal tests fail immediately on every operation. |
| `TEST_EMAIL_DOMAIN` | Dev Portal suite (optional) | Domain used for disposable test emails the suite creates (e.g. `Add User`). Defaults to the domain of `user` if unset. |
| `AZURE_API_KEY` | ADO integration only (not test runs) | Azure DevOps PAT, used by tooling outside the test suite. |

## 2. Run everything

```bash
npm test               # every spec, all configured browsers
npm run test:ci         # same, chromium only, minus @email/@integration-tagged specs
npm run test:chrome      # every spec, chromium only
npm run test:headed      # every spec, headed (needed wherever reCAPTCHA is involved)
```

Open the HTML report for the last run:

```bash
npm run test:report
```

Debug a test step-by-step:

```bash
npm run test:debug
```

## 3. Run tests for one page / area

The `tests/` tree mirrors the app's pages. Any subfolder can be targeted directly
with `npx playwright test <path>`, or use the pre-defined scripts below where one
exists (some pages need extra flags — headed mode, a single worker — which the
script already bakes in).

| Page / area | Command | Notes |
|---|---|---|
| **Login** (login, logout, forgot-password, links, robots, security, direct-URL-guard) | `npm run test:login` | Runs two-phase (`scripts/run-two-phase.ts`), single worker. |
| **Password reset** | `npm run test:reset` | Headed + chromium only — reCAPTCHA v3 fails headless. Needs the Gmail vars. |
| **Call Listing** | `npm run test:call-listing` | Two-phase, single worker, chromium only. |
| **Chat Listing** | `npx playwright test tests/chat-listing/` | |
| **QA Scorecards / AI Agent scorecard generation** | `npx playwright test tests/qa-scorecards/` | |
| **Smoke** (cross-page sanity) | `npx playwright test tests/smoke.spec.ts` | |
| **Dev Portal / API Management** — full suite (19 endpoint-group specs + matrices) | `npm run test:dev-portal` | Chromium only, single worker — the account only tolerates one active session. Needs `user`/`adminpass`/`DEV_PORTAL_SUBSCRIPTION_KEY`. |
| **Dev Portal — one endpoint group only** | `npx playwright test tests/dev-portal/<group>-api.spec.ts --project=chromium --workers=1` | e.g. `extension-management-api.spec.ts`, `calls-api.spec.ts`, `user-management-api.spec.ts`, … (one file per catalogue group). |

The declarative matrix specs (`*-matrix.spec.ts`) also live under `tests/dev-portal/`,
so `npm run test:dev-portal` already runs them too — these shortcuts are only for
running **one** matrix in isolation (e.g. while debugging just that check), not an
extra step on top of the full suite:

```bash
npm run test:cross-tenant-matrix       # per-site isolation checks
npm run test:negative-fields-matrix    # required-field omission checks
npm run test:boundary-matrix           # boundary-value checks
npm run test:contract-matrix           # response-shape/contract checks
npm run test:auth-matrix               # subscription-key auth checks
npm run test:idempotency-matrix        # repeat-request idempotency checks
```

### Run a single file

```bash
npx playwright test tests/login/login.spec.ts
```

### Run by title (grep)

```bash
npx playwright test --grep "3.1"
```

## 4. Gmail helper scripts (standalone, not part of the suite)

```bash
npm run email:check    # inspect recent emails via the Gmail API
npm run email:wait      # poll for a specific email (see --help for flags)
```

## 5. `local-only/`

If a `local-only/` folder exists at the repo root, it holds investigation
write-ups, filed-bug notes and raw evidence captures from prior QA sessions —
none of it is read by any test, helper, fixture, or page object. It's
gitignored and safe to delete at any time; nothing here depends on it.
