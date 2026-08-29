# Console / UI race — consolidated report (2026-08-29)

Kept separate from the backend-endpoint bugs. Environment: staging
`developer1-portal.callcabinet.com` / gateway `developer1.callcabinet.com`,
account `romana@callcabinet.com`, company CC Test 1, key "Primary: API_test",
git `feature/chat-listing @ ed251c2`.

> **Evidence note**: the dedicated `evidence-console.spec.ts` run on 2026-08-29
> could not complete — after login the shared account `romana@callcabinet.com`
> landed on the "Select your default company" screen with **CC Test 1 absent**
> (the account lost CC Test 1 access); the login helper additionally
> misclassifies that screen as the "already logged in" modal and hangs in
> `AlreadyLoggedInModal.logOutOtherSession()` (see
> `06-environment/ENV-site-assignment-audit.md` and §6 below). The findings
> below are backed by **the earlier successful runs the same day** (the
> `role-management-api.spec.ts` and `notifications-api.spec.ts` runs, all
> green) plus prior sessions. The one item that still needs a live re-run is
> the **direct-backend contrast for Get Alert Trigger Operators** (§2).

---

## 1. Delete Custom Role — Try-it console never renders a Send button

- **Classification**: CONSOLE/UI BUG — **deterministic**, not the transient schema race.
- **Endpoint**: `DELETE settings/custom-roles/{id}` (ADO 37610).
- **Reproducibility**: **7/7** console-open attempts across 3 separate `role-management-api.spec.ts` runs on 2026-08-29:
  - Run 1 (`Create → Get → Update → Delete` lifecycle): the Delete step's `openConsole` failed all 3 retries — `Send` button never visible within the timeout; test hit the 90 s describe timeout.
  - Run 2 (same, `--grep "full lifecycle"`, per-attempt timeout lowered to 10 s): Delete step failed all 3 retries again — 10 s `toBeVisible` on `getByRole('button', { name: 'Send' })` → `element(s) not found`.
  - Run 3 (isolated `Create → Delete` test, nothing before it): 1/1 — `sendButtonRendered = false`. The `error-context.md` snapshot of the drawer at failure:
    ```yaml
    - article:
      - 'heading "Delete Custom Role (settings/custom-roles/{id})" [level=1]'
      - text: Download definition
      - combobox: Select definition type
      - paragraph: Deletes a specified custom role. It accepts the ID in the URL path. ...
      - progressbar "Loading..."
    ```
    The drawer stays on a `progressbar "Loading…"` — no **Parameters** section, no **Send** button, ever.
- **Contrast**: sibling operations `List Custom Roles` and `Create Custom Role` render their consoles fine and returned 200s in the same runs → this is specific to `Delete Custom Role`, not the whole group. (`Delete Agent Extension`, `Delete Tag`, `Delete Site` — other real `DELETE {id}` ops — render normally.)
- **Retry protocol result** (per the brief): a narrowly-scoped retry of *only the console open* (`_helpers.ts` `openConsole(..., { retries: 3 })` — reopen the operation fresh, re-wait for Send) was tried and **did not help**. The console genuinely never finishes loading this operation's schema. The retry does **not** mask another issue — Create/Get/Update in the same test render and send fine.
- **Recommended regression**: `role-management-api.spec.ts` › *"KNOWN BUG — Delete Custom Role: Try-it console never finishes loading (no Send button)"* asserts `sendButtonRendered === false` and attaches `delete-custom-role-console-stuck`. `Delete Custom Role`'s coverage is otherwise `test.skip`. Keep.
- **Suggested ticket**: *Developer Portal console — the "Delete Custom Role" operation drawer never leaves the "Loading…" state after "Try this operation"; no Parameters section or Send button ever render. Reproduced 7/7 over 3 runs, including an isolated open with nothing before it. Sibling operations (List/Create Custom Role, other Delete-by-id operations) render normally. Likely a failed/never-resolving OpenAPI-schema fetch specific to this operation id.*

---

## 2. Get Alert Trigger Operators — console sends the literal `{id}`; backend contrast

- **Classification**: **CONFIRMED CONSOLE DEFECT / backend behaviour unverified.** The console defect (it sends the literal unsubstituted `?id={id}`) is confirmed live. Whether the backend returns operators correctly when `id` is omitted (the parameter is documented optional) was **not** tested — the direct-backend leg could not run this session.
- **Endpoint**: `GET settings/alerts/trigger-operators/?id={id}` (ADO 37502). `id` is documented **optional**.
- **What the console does** (confirmed live 2026-08-28, pinned by `notifications-api.spec.ts` › *"KNOWN BUG — Get Alert Trigger Operators: console never substitutes the optional {id} query param"*, green earlier today):
  - The operation's rendered "Endpoint:" line and the request URL contain the literal, unsubstituted placeholder `?id={id}`.
  - There is **no fillable field** for `id` in the Parameters section (unlike a real path param such as `{roleId}`, which does get one).
  - Clicking **Add parameter** and filling `id` adds a *separate, additional* query param — it does **not** populate or override the baked `{id}` in the endpoint URL.
  - Every send → **`400`** `{"errors":{"id":["The value '{id}' is not valid."]}}` — the backend receives and rejects the literal string `{id}`.
- **Backend contrast (NOT run this session — evidence gap)**: the intended check was a direct `fetch('https://developer1.callcabinet.com/api/settings/alerts/trigger-operators/')` **without** the `id` (which, being optional, should succeed) from the portal page context. This would confirm the bug is **console-only** (backend fine, console just can't omit/substitute the placeholder) vs. a deeper backend issue. `evidence-console.spec.ts` contains this check; re-run it when the account session frees up.
- **Working hypothesis** (plausible, backend leg unverified): the defect is console-side only — the parameter is documented optional and the only observed failure is the console structurally being unable to produce a request without the literal `{id}` in the query string. Same *class* as `Get Storage Usage` (opposite outcome) where `addParameter('siteId', …)` *does* override the baked placeholder — so the fix is likely per-operation URL-template rendering in the console. **Not asserted as CONSOLE-ONLY** until a direct `GET .../trigger-operators/` without `id` is shown to succeed.
- **Recommended regression**: keep the `notifications-api.spec.ts` KNOWN BUG test (asserts 400 + the `The value {id} is not valid.` message).
- **Suggested ticket**: *Developer Portal console — "Get Alert Trigger Operators" bakes the unfilled `?id={id}` placeholder into the request URL and provides no way to remove or substitute it ("Add parameter" adds a separate param). Every send 400s with `The value {id} is not valid.` The `id` query parameter is documented optional; omitting it should succeed. Needs the console to either render a fillable field for the optional query param or drop the unfilled placeholder.*

---

## 3. Schema-blind "Add body" ships `Content-Type: text/plain` → 415

- **Classification**: CONSOLE/UI BUG — **intermittent**, tied to the schema/render race.
- **Endpoints observed**: `Update Multiple Call Tags` (`PUT calls/calls/tags`), and (per prior sessions) `Update Company Settings`, `Update SSO Settings`, `List Logs`, `Add/Delete IP Whitelist`, `List/Add/Update Tag`.
- **Mechanism** (confirmed 2026-08-26/27, pinned by `tenant-scoping-bugs.spec.ts` › *"Bug 3"*):
  1. When the operation's OpenAPI schema fetch loses the render race, the console shows **no request-body editor and no `Content-Type`** — a "schema-blind" state. "Add body" is present instead.
  2. Click "Add body", type a JSON payload, click Send **without** touching Headers → **`415`**. The outgoing request headers show `Content-Type: text/plain;charset=UTF-8`, not `application/json`.
  3. Manually add a `Content-Type: application/json` header (or reload until the schema loads in time) → the same body → success.
- **Proof it is console-side**: the 415 only occurs in the schema-blind state, and the *only* thing that changes between the failing and passing send is the `Content-Type` header the console constructs — the JSON body is byte-identical. The backend is not involved in the failure.
- **This session**: `evidence-console.spec.ts`'s Content-Type test would record whichever state occurs and, if schema-blind, capture the outgoing `Content-Type` verbatim — blocked by the login issue; re-run when the session frees.
- **Recommended regression**: `tenant-scoping-bugs.spec.ts` › "Bug 3" already adapts to whichever state occurs and asserts the 415 when the schema-blind state is hit. Keep.
- **Suggested ticket**: *Developer Portal console — when the operation schema fails to load in time, "Add body" produces a JSON payload but the request goes out with `Content-Type: text/plain;charset=UTF-8`, causing a spurious 415. The JSON body editor should default the `Content-Type` to `application/json`.*

---

## 4. Delete User — "Send" fires no network request at all

Full write-up: `03-console-ui/BUG-delete-user-send-inert.md` (this session, batch 4 — **completed successfully**). Summary:

- **Classification**: CONSOLE/UI BUG — Send handler is a silent no-op for this one operation.
- **Evidence (this session, raw `P1-DELETE-USER-SEND.json`)**: in the same console session, `Add User` → 200 and `Get User` → 200 (both fire real requests, captured). `Delete User` → click Send → **`deleteFired = [0, 0, 0]`** across 3 fresh attempts: **zero `settings/users/delete` calls, no OPTIONS preflight, nothing.** The client `waitForResponse` just times out at 30 s each time.
- **Ruled out**: params not attached (the request preview reads `POST .../api/settings/users/delete/?userId=...&userRId=...`), Send disabled/duplicate (verified unique + enabled 2026-08-28), dead session (Add/Get work in it), the schema race (the console renders fully — Send is visible, params fillable — the click just does nothing; it is not a hang, it is a no-op).
- **Recommended regression**: `user-management-api.spec.ts` round-trip asserts `expect(deleteOp.send()).rejects.toThrow(/Timeout/)`. Keep.
- **Suggested ticket**: *Developer Portal console — "Send" on the **Delete User** operation fires no request (no OPTIONS, no POST) while Add/Get/Update User fire real requests in the same session.*

---

## 5. Console-race class — where the schema/render race has been observed

Path-param field missing · wrong/stale sibling schema shown · no body editor · wrong `Content-Type` · "Try this operation" never becoming "Send":

**Documented over prior sessions**: Update Legal Hold, Add Call Note, Get Agent Group, Get Restricted User, Update Company/SSO Settings, List Logs, Add/Delete IP Whitelist, List/Add/Update Tag, Get/Delete Alert Configuration, Get Alert Notification (old), Delete Notification Rule.

**This investigation**: **Delete Custom Role** (§1 — new, deterministic, never resolves) · **Save completed QAs / Get Available QAs / most QA + Chats consoles** (needed the `openConsole(..., { retries })` wrapper to drive them at all) · `selectSubscriptionKey` itself races the console re-render (a retry loop was added to `ApiOperationPage.selectSubscriptionKey` this session).

**Mitigation in the test suite**: `_helpers.ts` `openConsole(portal, group, regex, { retries })` re-navigates to the operation fresh and re-waits for Send, up to N times, with a shorter per-attempt timeout. It retries **only console setup**, never the API request — real backend failures still surface on the first `send()`. `ApiOperationPage.openConsole(timeout?)` gained an optional timeout so N retries fit a test budget.

---

## 6. Blocker that interrupted this section

The `evidence-console.spec.ts` and `evidence-security.spec.ts` runs on 2026-08-29 (afternoon) all failed in `stagingLogin` → `LoginPage.completeLogin`. **Root cause**: login succeeds, then the account `romana@callcabinet.com` is shown the "Select your default company" screen and **CC Test 1 is not offered** — the account has lost CC Test 1 access (likely a spam mitigation from the day's write volume). The login helper compounds this by misreading the company-picker as the "already logged in on another computer" modal and hanging in `AlreadyLoggedInModal.logOutOtherSession()` with no timeout. Earlier runs the same day (batches 1–4, role-management, notifications, all `*-api` groups) succeeded under CC Test 1; the access loss happened ~10:24 UTC, after batch 4. **Action needed**: restore `romana@callcabinet.com`'s CC Test 1 access (owner/admin), fix the login helper (timeout + company-picker handling), then re-run `evidence-console.spec.ts` and `evidence-security.spec.ts`.
