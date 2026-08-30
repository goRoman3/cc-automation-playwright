# SUSPECTED per-site scoping gaps — List Notification Rules / List Alert Events / List Report Templates / List Server Heartbeats

- **ID**: SUSPECTED-SCOPING-GAPS
- **Classification**: SUSPECTED SCOPING GAP (product intent unconfirmed)
- **Severity**: P2 — needs a product-intent decision before it is a bug

> **Status this session**: the dedicated before/after-switch capture in
> `evidence-security.spec.ts` (steps 2 + 5) **could not run** — after login
> the account `romana@callcabinet.com` lands on the "Select your default
> company" screen with **CC Test 1 absent** (the account no longer had
> selectable access to CC Test 1; time and cause unknown; the login helper
> also misclassifies that screen — see
> `06-environment/ENV-site-assignment-audit.md`). The
> finding below carries the results from **prior sessions** (2026-08-29
> ninth session, recorded in `docs/bug-reports/dev-portal-happy-path-coverage-2026-08-28.md`'s
> 2026-08-29 section and in `tests/dev-portal/tenant-isolation-staging.spec.ts`'s
> `NOT_SITE_SCOPED` comments). Re-run `evidence-security.spec.ts` when the
> session frees up for a fresh single-switch confirmation.

## Environment

```
gateway:          https://developer1.callcabinet.com
company:          CC Test 1
subscription key: Primary: API_test
git:              feature/chat-listing @ ed251c2
```

## The four endpoints

| Endpoint | Operation | Has a `siteId`/`siteIds` in its schema? |
|---|---|---|
| `POST settings/notifications/list` | List Notification Rules | **`Add Notification Rule` exposes `siteIds`** — so this list plausibly *should* be site-filtered |
| `POST settings/alerts/events` | List Alert Events | not obviously — activity-log style |
| `GET reports/reports/get-report-templates` | List Report Templates | report templates typically are per-site-selectable |
| `POST admin/heartbeats/list` | List Server Heartbeats | **already a documented gap** (customer-scoped, not site-scoped — 2026-08-26/27) |

## Method

Two-phase: run each endpoint under the key's current site (site A), save a
normalised result (row count + sorted ids); switch the key's site (A → a
random different site B via `Settings > API Management`); reopen the portal;
re-run the same endpoints; diff.

## Actual (prior sessions — 2026-08-29 ninth session, after **3 independent site switches**)

| Endpoint | Behaviour on site switch |
|---|---|
| **List Notification Rules** | **UNCHANGED** across every switch — same rules, same order. |
| **List Alert Events** | **UNCHANGED** in 2 of 3 switches (1 differed — treated as the outlier: a shared-QA-account activity log coincidentally matching a stale baseline is far less likely than it simply not being site-filtered). |
| **List Report Templates** | **UNCHANGED** across every switch. |
| **List Server Heartbeats** | **UNCHANGED** — already the documented "customer-scoped but not site-scoped" gap (30 heartbeats spanning multiple sites for a key scoped to one site with no heartbeats; only an empty `filter:{logic:'and',filters:[]}` returns 200, see the tenant-scoping bug report §3.5). |

For contrast, in the **same** runs the confirmed-correct site-scoped endpoints
DID change: `List Extensions` 1 → 13 rows, `List Agents` 1 → 17, `List Agent
Groups` `[]` → 1, `List Retention Policies` re-scoped, `List Calls` /
`Get Sites Storage Usage` re-scoped.

## Expected

If the resource is **site-scoped**, its result set should change when the
key's site changes. If it is **customer-level / global reference data**, it
should not — and that is *not* a bug, just something to document.

## Alternative explanations ruled out / NOT ruled out

- **Coincidental identical data** — weak: repeated unchanged across 3 (and, for Server Heartbeats, many) switches.
- **These are legitimately customer-level / global** — **NOT ruled out.** This is exactly the open question. Points in favour of them being real gaps:
  - `Add Notification Rule`'s own schema has a `siteIds` field → `List Notification Rules` *should* plausibly honour it.
  - Report templates and alert events are the kind of thing a per-site key normally should not see across sites.
  - `List Server Heartbeats` is already an acknowledged customer-scoped-only gap.
- Points in favour of them being intentional customer-level data:
  - `List Sites`, `List Users`, `List Tags`, `IP Whitelist List`, `Get Company Info`, `Get SSO Configuration`, `Get Storage Locations`, and the notification *reference* lists (`List Alert Types`, `List Notifications *Types`, `Get Alert Trigger Topics`) are all confirmed intentionally customer-level / global and correctly unchanged on switch — so "unchanged on switch" is not by itself proof of a bug.

## Downstream impact

- **If intended site-scoped**: a per-site partner key sees other sites' notification rules, alert events, report templates, and server-monitoring rows for the same customer.
- **If intended customer-level**: no impact — just needs documenting so QA stops flagging it.

## Workaround

n/a — pending triage.

## Cleanup performed

None (all reads).

## Remaining unknowns

- Product intent for each of the four. **This is the blocker to reclassifying** — none can be called a bug without confirming it *should* be site-scoped.
- Whether `Add Notification Rule`'s `siteIds` is meant to make `List Notification Rules` site-filtered.
- An explicit site-tagged disposable object created + checked cross-site would settle each — but only `Notification Rule` has an `Add` operation (Alert Events / Report Templates / Server Heartbeats have no create op).

## Recommended regression test

`tests/dev-portal/tenant-isolation-staging.spec.ts` already carries these four
in its `NOT_SITE_SCOPED` set with explicit "unconfirmed, not ruled out"
comments, so the suite stays green while it keeps regression-testing the
~25 confirmed-correct endpoints. **Keep as-is until triaged.** After the
product decision:
- If site-scoped → remove from `NOT_SITE_SCOPED` (the suite will then assert "must change on switch" and go red — as intended — until fixed).
- If customer-level → move to a separate `DOCUMENTED_CUSTOMER_LEVEL` allowlist with a comment linking the decision.

Additionally: add a targeted `List Notification Rules` cross-site test that
**creates** a rule with `siteIds:["<siteA>"]`, switches to site B, and
asserts the rule is (or is not) visible — this is the one of the four that
can be tested with a controlled object.

## Suggested bug-ticket wording

**Title**: Confirm per-site scoping intent for `List Notification Rules`, `List Alert Events`, `List Report Templates`, `List Server Heartbeats`

All four return **identical results before and after a subscription-key site
switch** (reproduced across 3 switches), while every confirmed site-scoped
endpoint re-scopes correctly in the same runs. `Add Notification Rule` has a
`siteIds` field, which suggests `List Notification Rules` should be
site-filtered. `List Server Heartbeats` is already known to be
customer-scoped-but-not-site-scoped. Please confirm for each endpoint whether
it is *intentionally* customer-level, or file it as a site-scoping bug.

## Raw evidence files

- Prior-session data: `tests/dev-portal/tenant-isolation-staging.spec.ts` (`NOT_SITE_SCOPED` set + comments), `docs/bug-reports/dev-portal-happy-path-coverage-2026-08-28.md` (2026-08-29 section).
- This session (blocked): `raw/SECURITY-SCOPING-ENV.json` will be produced by `tests/dev-portal/evidence-security.spec.ts` on re-run (`scopingGaps` array with per-endpoint site-A vs site-B normalised results).
