import { test, expect } from '@playwright/test';
import { isGatewayResponseUrl } from '../../pages/dev-portal/ApiOperationPage';

/**
 * Static regression coverage for `isGatewayResponseUrl()` — pure string
 * matching, no fixtures requested (no `page`/`homePage`), so this runs with
 * zero browser/network activity and zero staging-account cost. Run any time
 * with `npx playwright test tests/dev-portal/gateway-host-matcher.spec.ts`.
 *
 * Table entries are either a URL actually observed in a real trace/response
 * (see `isGatewayResponseUrl`'s doc comment in `ApiOperationPage.ts` for the
 * source of each), or a host that must be EXCLUDED (the portal's own
 * CMS/management-API traffic, which shares most of the hostname with a real
 * gateway host and must not be mistaken for one — `send()` would otherwise
 * resolve early on the wrong response and return the console's own metadata
 * instead of the API result).
 */
const CASES: Array<{ url: string; expected: boolean; why: string }> = [
  // ── confirmed gateway hosts — MUST match ──────────────────────────────
  { url: 'https://developer1.callcabinet.com/api/settings/sites/list/', expected: true, why: 'CC Test 1 staging gateway (custom domain)' },
  { url: 'https://developer.callcabinet.com/settings/general/company-settings', expected: true, why: 'prod gateway, no /api/ prefix (Get Company Info-style operation)' },
  { url: 'https://smarshcra-apim-staging.azure-api.net/api/settings/agents/supervisors', expected: true, why: "CC Test 1's real underlying APIM identity per its own www-authenticate header, 2026-08-21" },
  { url: 'https://smarshcra-apim-staging-eus2.azure-api.net/api/settings/sites/list/', expected: true, why: 'Roman_QA_TEST gateway, confirmed via live response trace 2026-09-04' },
  // ── must NOT match — the portal's own CMS/management-API traffic ──────
  { url: 'https://smarshcra-apim-staging-eus2.developer.azure-api.net/mapi/apis/settings-sites-list/operations', expected: false, why: 'portal management API (note the extra "developer." label) — not a gateway response' },
  { url: 'https://smarshcra-apim-staging-eus2.developer.azure-api.net/developer/users/7765ca28-9efe-4bb2-b07d-cede889ca2d3/subscriptions', expected: false, why: 'portal identity/subscriptions call — not a gateway response' },
  // ── must NOT match — unrelated hosts ───────────────────────────────────
  { url: 'https://atmossystemsstaging.callcabinet.com/api/settings/agents', expected: false, why: 'the main app host — real product traffic, not the dev-portal gateway' },
  { url: 'https://example.azure-api.net/api/foo', expected: false, why: 'an unrelated Azure APIM tenant — must not match on the bare *.azure-api.net suffix alone' },
  { url: 'https://smarshcra-apim-staging-other.azure-api.net/api/foo', expected: false, why: 'an unconfirmed "-other" suffix — only the two actually-observed instances are accepted, not a general suffix pattern' },
];

test.describe('ApiOperationPage.isGatewayResponseUrl — gateway host-matcher regression (no browser, no live network)', () => {
  for (const c of CASES) {
    test(`${c.expected ? 'MATCHES' : 'excludes'}: ${c.url} — ${c.why}`, () => {
      expect(isGatewayResponseUrl(c.url)).toBe(c.expected);
    });
  }
});
