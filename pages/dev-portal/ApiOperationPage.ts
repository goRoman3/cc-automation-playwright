import { type Page, type Locator, expect } from '@playwright/test';

/**
 * A single operation's detail page inside the developer portal
 * (`/api-details#api=<id>&operation=<method>`), including its "Try this
 * operation" console. Constructed via `DeveloperPortalPage.openOperation()`,
 * which navigates the same popup tab there — this wraps that same `Page`.
 *
 * The console's HTTP request/response panes are code-editor widgets, not
 * plain DOM text, so rather than scrape them `send()` reads the actual
 * network response the "Send" click fires against the API Management
 * gateway (`developer.callcabinet.com`, distinct from the portal's own
 * `developer-portal.callcabinet.com` host).
 *
 * **Gateway host is per-company, not fixed** (found 2026-09-04): the
 * `developer1?\.callcabinet\.com` custom domains are what CC Test 1 fronts
 * its gateway with, but they're an alias over the real underlying Azure APIM
 * instance — even a 2026-08-21 diagnostic against CC Test 1 shows the
 * gateway's own `www-authenticate` response header naming its real identity
 * as `smarshcra-apim-staging.azure-api.net` (`recon/output/dev-api-diag-*.json`
 * in the sibling `cloude` project). A live smoke test the same day against a
 * *different* company, **Roman_QA_TEST**, confirmed by request trace that its
 * gateway is reached directly at `smarshcra-apim-staging-eus2.azure-api.net`
 * (a distinct, "-eus2"-suffixed instance) with no `developer1.callcabinet.com`
 * custom domain involved at all — the portal itself is embedded straight off
 * `smarshcra-apim-staging-eus2.developer.azure-api.net` (note the extra
 * `developer.` label — that's the portal's own CMS/management-API traffic,
 * NOT a gateway response, and must stay excluded). `isGatewayResponseUrl()`
 * below accepts both confirmed families; it does NOT generalize to an
 * unverified `*.azure-api.net` wildcard or an unverified `-<suffix>` pattern
 * — only the two host names actually observed. Extend this list only from a
 * new confirmed observation (a live trace or a `www-authenticate` header),
 * never by guessing at the naming convention.
 */
export function isGatewayResponseUrl(url: string): boolean {
  return /(developer1?\.callcabinet\.com|smarshcra-apim-staging(-eus2)?\.azure-api\.net)\//.test(url);
}
export class ApiOperationPage {
  readonly tryThisOperationButton: Locator;
  readonly sendButton: Locator;

  constructor(private readonly page: Page) {
    this.tryThisOperationButton = page.getByRole('button', { name: 'Try this operation' }).first();
    this.sendButton = page.getByRole('button', { name: 'Send' });
  }

  /**
   * Clicks a button by its accessible name, tolerating two distinct
   * console-drawer flakiness classes found 2026-08-28 via trace analysis
   * of recurring "Target page, context or browser has been closed"
   * failures (both are actually the outer test timeout force-closing the
   * page after one of these hung — not a real browser crash):
   * - A forced click can still throw "Element is outside of the viewport"
   *   right after the drawer opens (a CSS transition/reflow still
   *   settling) — even though the same button is clickable a moment later.
   * - Manual interactive sessions separately hit a case where the normal
   *   actionability wait's auto-scroll-into-view step hung 120s+ on a
   *   reachable, clickable button.
   * A raw DOM click via `page.evaluate()` sidesteps both: no actionability
   * geometry check, no scroll wait. Tries the normal forced click first
   * (fast path, works the vast majority of the time) and only falls back
   * to the raw click after a short timeout so a genuinely-missing button
   * still fails promptly instead of hanging.
   */
  private async clickButtonRobustly(name: string): Promise<void> {
    try {
      await this.page.getByRole('button', { name }).first().click({ force: true, timeout: 5_000 });
      return;
    } catch {
      // fall through to the raw-DOM-click workaround below
    }
    await this.page.evaluate((buttonName) => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === buttonName);
      btn?.click();
    }, name);
  }

  /**
   * Fills a resolved locator's value, tolerating the same class of
   * actionability-wait hang as `clickButtonRobustly()` but on `fill()`
   * instead of `click()` — found 2026-08-28 still recurring even with
   * `{ force: true }` on the `fill()` call itself: the trace showed the
   * locator resolving to a real, existing element, then hanging on the
   * fill action for the full test timeout regardless. Falls back to
   * setting the value through React's own native-input value setter +
   * dispatching a real `input` event — the same technique used throughout
   * this suite's manual interactive investigation sessions, which never
   * once hit this hang there (only `page.fill()`/`locator.fill()` do).
   *
   * **Second flakiness layer found 2026-08-28**: `locator.evaluate()` has
   * no default timeout in this project's config (no `actionTimeout` is
   * set), so when the console's async schema fetch re-renders the
   * parameter/header row list out from under a `.last()` locator (the row
   * detaches and a fresh one is re-inserted), the fallback above hung
   * silently for the *entire* 90s test timeout instead of failing fast —
   * confirmed via two isolated reproductions, once on Get User's only
   * `addParameter()` call and once on Delete User's second, ruling out
   * "only the 2nd call in a row is affected". Now bounded to 8s per
   * attempt and retried up to 3 times total (re-running the forced-fill
   * attempt too, since a fresh locator resolution is exactly what a
   * re-rendered row needs) before surfacing a real error.
   */
  private async fillFieldRobustly(locator: Locator, value: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await locator.fill(value, { force: true, timeout: 5_000 });
        return;
      } catch (err) {
        lastError = err;
      }
      try {
        await locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement, v: string) => {
          const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
          setter.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value, { timeout: 8_000 });
        return;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  /**
   * Clicks an "Add x" row-adding button and confirms a new row actually
   * appeared, retrying the click up to 3 times if not. Guards against a
   * silent no-op found 2026-08-28: `clickButtonRobustly()`'s raw-DOM
   * fallback finds the button by matching visible text against every
   * `<button>` on the page, and if none matches at that instant (the same
   * schema-fetch re-render race documented on `fillFieldRobustly()`) it
   * just does nothing — no error, no new row, and the caller's `.last()`
   * locator then targets a stale or nonexistent row instead of the one
   * meant to be filled.
   */
  private async clickAddRowRobustly(buttonName: string, rowLocator: Locator): Promise<void> {
    const before = await rowLocator.count();
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.clickButtonRobustly(buttonName);
      try {
        await expect
          .poll(async () => rowLocator.count(), { timeout: 3_000 })
          .toBeGreaterThan(before);
        return;
      } catch {
        // row didn't appear yet — retry the click
      }
    }
  }

  /**
   * Opens the "Try this operation" console for this operation. `timeout`
   * bounds the wait for the Send button to appear (default 15s) — pass a
   * shorter value when a caller retries the whole open on failure, so
   * several attempts fit inside one test's time budget.
   */
  async openConsole(timeout = 15_000): Promise<void> {
    await this.clickButtonRobustly('Try this operation');
    await expect(this.sendButton).toBeVisible({ timeout });
  }

  /**
   * Clicks "Add body" — needed on operations with no pre-filled example
   * request body (the body editor otherwise isn't present at all for
   * `setRequestBody()` to target).
   *
   * **Root cause of the recurring "browser has been closed" failures**:
   * distinct from the button-click flakiness above, the console's async
   * schema fetch is a *separate* race — on a lucky run it finishes in time
   * and pre-fills the body editor (with "Remove body" shown, no "Add body"
   * button at all); on an unlucky run it doesn't, and "Add body" is what
   * renders instead. Code that called `addBody()` unconditionally hung
   * forever waiting for a button that doesn't exist on the lucky-race
   * runs. Now idempotent: no-ops if the body editor is already present.
   */
  async addBody(): Promise<void> {
    const alreadyPresent = await this.page.getByLabel('Request body', { exact: true }).isVisible().catch(() => false);
    if (alreadyPresent) return;
    await this.clickButtonRobustly('Add body');
  }

  /**
   * Fills the console's path/query parameter inputs, in the order they
   * appear (e.g. the single `{agentId}` field for "Get Agent"). Operations
   * with more than one parameter aren't disambiguated by name here — pass
   * values in the order the console renders them.
   *
   * `force: true` on the fill — same actionability-wait flakiness as
   * `clickButtonRobustly()`, just hitting `fill()`'s wait instead of
   * `click()`'s (confirmed via trace: locator resolved to a real element,
   * then hung on the visible/stable wait until the test timeout killed it).
   */
  async fillParameters(...values: string[]): Promise<void> {
    const fields = this.page.getByPlaceholder('Enter parameter value');
    for (let i = 0; i < values.length; i++) {
      await this.fillFieldRobustly(fields.nth(i), values[i]);
    }
  }

  /**
   * Selects an option from a combobox-style parameter — some parameters
   * (e.g. an enum "period" selector) render as a dropdown instead of the
   * free-text field `fillParameters()` handles, and filling it as text
   * silently does nothing (the field `fillParameters()` looks for doesn't
   * exist there, so it waits out the full test timeout for no reason).
   * `placeholderText` is the combobox's own visible placeholder (e.g.
   * "Select period value", read directly off the console).
   */
  async selectParameterOption(placeholderText: string, optionText: string): Promise<void> {
    await this.page.getByText(placeholderText, { exact: true }).click({ force: true });
    await this.page.getByRole('option', { name: optionText, exact: true }).click({ force: true });
  }

  /** Replaces the console's request-body editor with the given JSON payload. */
  async setRequestBody(body: unknown): Promise<void> {
    // Non-exact match also catches the unrelated "Sample request body"
    // dropdown button, which shares the "request body" substring.
    await this.fillFieldRobustly(this.page.getByLabel('Request body', { exact: true }), JSON.stringify(body));
  }

  /**
   * Replaces the console's request-body editor with raw, unquoted text —
   * for the handful of operations whose real Content-Type is
   * `application/x-www-form-urlencoded` with a plain comma-separated-GUID
   * body rather than JSON (e.g. Batch Apply Legal Hold, Batch Expire
   * Calls — confirmed via each operation's own "Download definition" →
   * OpenAPI JSON export). `setRequestBody()` would wrap this in quotes via
   * `JSON.stringify`, which is wrong for these.
   */
  async setRawRequestBody(text: string): Promise<void> {
    await this.fillFieldRobustly(this.page.getByLabel('Request body', { exact: true }), text);
  }

  /**
   * Selects a subscription key from the "Subscription key" dropdown, e.g.
   * `selectSubscriptionKey('Primary: API_test')`. Needed for any test that
   * uses a non-default key (the default, "Primary: 1", generic-500s on
   * every operation regardless of site — see the tenant-scoping bug report).
   *
   * No-ops if the dropdown already shows this value (safe to call more than
   * once, and avoids re-clicking a combobox that's already collapsed-to-
   * target on a re-opened console).
   */
  async selectSubscriptionKey(optionName: string): Promise<void> {
    const dropdown = this.page.locator('#subscription-key-dropdown');
    if ((await dropdown.textContent().catch(() => ''))?.trim() === optionName) return;
    // The dropdown open + option click race the console's async re-render;
    // retry the whole open→pick a few times before giving up.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        try {
          await dropdown.click({ force: true, timeout: 5_000 });
        } catch {
          await this.page.evaluate(() => {
            (document.querySelector('#subscription-key-dropdown') as HTMLElement | null)?.click();
          }).catch(() => { /* context may be re-rendering — the retry handles it */ });
        }
        await this.page.getByRole('option', { name: optionName, exact: true }).click({ force: true, timeout: 5_000 });
        if ((await dropdown.textContent().catch(() => ''))?.trim() === optionName) return;
      } catch (err) {
        lastError = err;
      }
      await this.page.waitForTimeout(700);
    }
    // Last resort: if the value is right anyway, accept it; else throw.
    if ((await dropdown.textContent().catch(() => ''))?.trim() === optionName) return;
    throw lastError ?? new Error(`Could not select subscription key "${optionName}"`);
  }

  /**
   * Adds a request header via the console's "Add header" control — needed
   * e.g. to set `Content-Type: application/json` on operations whose "Add
   * body" control defaults to `text/plain` (see the tenant-scoping bug
   * report, "Add body defaults to text/plain"). Unlike `addBody()`, the
   * "Add header" button itself always adds one more row regardless of how
   * many headers are already pre-filled, so there's no presence check —
   * but the click is still verified via `clickAddRowRobustly()` in case it
   * silently misses (see that helper's doc).
   */
  async addHeader(name: string, value: string): Promise<void> {
    await this.clickAddRowRobustly('Add header', this.page.getByPlaceholder('Enter header value'));
    await this.fillFieldRobustly(this.page.getByPlaceholder('Enter header name').last(), name);
    await this.fillFieldRobustly(this.page.getByPlaceholder('Enter header value').last(), value);
  }

  /**
   * Manually adds a path/query parameter via the console's "Add parameter"
   * control — needed because several non-GET (and occasionally GET)
   * operations never render their documented path/query params as fillable
   * fields at all (a schema-blind console bug distinct from the "text/plain
   * body" one above; confirmed on Get User, Update Retention Policy, Delete
   * User, Submit Call Redaction Request during the 2026-08-28 happy-path
   * push). `fillParameters()` only works when the console *did* render the
   * fields; use this instead when `hasParameterField()` says it didn't.
   */
  async addParameter(name: string, value: string): Promise<void> {
    await this.clickAddRowRobustly('Add parameter', this.page.getByPlaceholder('Enter parameter value'));
    await this.fillFieldRobustly(this.page.getByPlaceholder('Enter parameter name').last(), name);
    await this.fillFieldRobustly(this.page.getByPlaceholder('Enter parameter value').last(), value);
  }

  /**
   * Whether a fillable Parameters-section field named `paramName` (e.g.
   * `callId`) is present in the console. Used to document the "console
   * doesn't expose the {callId} path parameter for non-GET operations" bug
   * — the field simply doesn't render there, so there's nothing to fill.
   */
  async hasParameterField(paramName: string): Promise<boolean> {
    return this.page.getByText(paramName, { exact: true }).isVisible().catch(() => false);
  }

  /**
   * Clicks Send and returns the actual gateway response: status code plus
   * the parsed JSON body (falls back to raw text for non-JSON responses).
   *
   * Matches on host only, not a `/api/` path prefix — some operations are
   * published on the gateway without it (e.g. "Get Company Info" hits
   * `developer.callcabinet.com/settings/...`; the original recon found the
   * same for "List Calls"), so requiring the prefix here would make
   * `waitForResponse` time out on those instead of seeing the real
   * response.
   *
   * Matches either `developer.callcabinet.com` (prod gateway, reached via
   * `atmossystemstaging.callcabinet.com`) or `developer1.callcabinet.com`
   * (staging gateway, reached via `atmossystemsstaging.callcabinet.com` —
   * note the extra "s") — see the per-site tenant scoping bug report for
   * why these two easily-confused hosts matter — plus the per-company
   * `smarshcra-apim-staging(-eus2)` Azure-native hosts, see
   * `isGatewayResponseUrl()`'s doc above the class for the evidence.
   */
  async send(): Promise<{ status: number; body: unknown }> {
    const responsePromise = this.page.waitForResponse(
      r => isGatewayResponseUrl(r.url()),
      { timeout: 30_000 },
    );
    await this.clickButtonRobustly('Send');
    const response = await responsePromise;
    const body = await response.json().catch(() => response.text());
    return { status: response.status(), body };
  }
}
