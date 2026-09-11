# Manual migration bundle

These are the files **missing from the git repository** (they are listed in
`.gitignore`, so `git clone` will not bring them). Everything else in the
project — all `*.spec.ts`, page objects, `helpers/`, `fixtures/`,
`playwright.config.ts`, `smoke.spec.ts`, `.github/` — is tracked in git and
comes down with `git clone`. `node_modules/`, `playwright-report/` and
`test-results/` are regenerated and intentionally excluded.

## How to use on the new machine

1. `git clone <repo>` and `cd` into it.
2. Copy the contents of this folder over the clone, preserving paths:
   ```bash
   cp -Rp manual-remote/. <cloned-repo>/
   ```
   (or copy each file to the matching path shown below)
3. `npm install` — regenerates `node_modules/` from `package.json` /
   `package-lock.json`.
4. `npx playwright install` — install browser binaries.
5. Verify: `npm run typecheck` then `npm run test:chrome`.

## What's included and why

| Path | Why it's not in git / why you need it |
|---|---|
| `package.json` | Deps + npm scripts. Ignored in this repo. Required. |
| `package-lock.json` | Locked dependency versions for reproducible installs. |
| `tsconfig.json` | TypeScript config. Required for typecheck/run. |
| `.env` | **Secrets** — BASE_URL, test credentials, Gmail OAuth tokens. |
| `.env.example` | Template / reference for `.env`. |
| `.mcp.json` | Playwright MCP server config used by the sub-agents. |
| `CLAUDE.md` | Project instructions for Claude Code. |
| `README.md`, `README copy.md` | Project docs. |
| `.claude/settings.local.json` | Local Claude Code settings (model pin, perms). |
| `agents/*.md` | Sub-agent definitions (planner / generator / healer). |
| `specs/*.md` | Test plans / design docs (planner output). |

## Security note

`.env` contains live staging credentials and Gmail OAuth refresh tokens.
Transfer it over a secure channel and do not commit it to any repo.
