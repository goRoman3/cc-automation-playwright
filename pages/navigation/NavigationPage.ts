import { type Page, type Locator } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page object for the global header, left menu and top-right dropdowns of
 * the authenticated app shell.
 *
 * Verified by DOM inspection on 2026-07-21 against a System Admin account
 * (full navigation). Navigation is ROLE / LICENSE dependent — a limited role
 * sees fewer top tabs and fewer Settings pages. See NAV_MAP below and
 * specs/navigation-map.md for the role notes.
 *
 * Gotchas:
 *  - The "Action Required: API Platform Update" modal re-appears after most
 *    route changes and its overlay intercepts every click. closeModal() is
 *    called after each navigation before interacting with the header.
 *  - The "Development" top tab opens an EXTERNAL developer portal in a new
 *    tab and is only present when "view API" is granted in
 *    Settings > API Management.
 *  - Top tabs / left items are <a>/<span>; overlays sit above them, so tab
 *    clicks are dispatched in-DOM (see clickTab()).
 *
 * No spec exists for this page yet — ported as scaffolding only.
 */

interface NavChild {
  text: string;
  href: string;
}

interface NavItem extends NavChild {
  children?: NavChild[];
}

/** Authoritative, verified menu inventory (System Admin, 2026-07-21). */
export const NAV_MAP = {
  topTabs: ['Recording', 'Analytics', 'Partner', 'CRA Management', 'Development'],

  recordingLeft: [
    'Home',
    'Call Listing',
    'Chat Listing',
    'Reporting',
    'Client Heartbeats',
    'QA Dashboard',
    'QA Scorecards',
    'Security Log',
    'Settings',
  ],

  analyticsLeft: ['Dashboards', 'AI Agent', 'Notifications', 'Topic Mining', 'Analytics Settings'],

  // Recording > Settings sub-pages (18). "Ip Whitelist" is hidden for some roles.
  settings: [
    { text: 'General', href: '/Settings/General' },
    { text: 'User Management', href: '/Settings/UserManagement' },
    { text: 'Custom User Roles', href: '/Settings/CustomUserRoles' },
    { text: 'Restricted User Roles', href: '/Settings/RestrictedUserRoles' },
    { text: 'Site Management', href: '/Settings/SiteManagement' },
    { text: 'Agent Management', href: '/Settings/AgentManagement' },
    { text: 'Assign Agents', href: '/Settings/AssignAgents' },
    { text: 'Agent Groups', href: '/Settings/AgentGroups' },
    { text: 'Extension Management', href: '/Settings/ExtensionManagement' },
    { text: 'Call Tags', href: '/Settings/CallTags' },
    { text: 'QA Randomizer', href: '/Settings/QARandomizer' },
    { text: 'SSO Management', href: '/Settings/SsoManagement' },
    { text: 'Notifications', href: '/Settings/Notifications' },
    { text: 'Retention Policy', href: '/Settings/RetentionPolicy' },
    { text: 'Grid Management', href: '/Settings/GridManagement' },
    { text: 'Ip Whitelist', href: '/Settings/IpWhitelist' },
    { text: 'Phonebook', href: '/Settings/Phonebook' },
    { text: 'Keyword Accuracy Boosting', href: '/Settings/KeywordAccuracyBoosting' },
    { text: 'API Management', href: '/Settings/ApiManagement' },
  ] satisfies NavChild[],

  // CRA Management (formerly "CC Management"). Monitoring & Diagnostics are groups.
  craManagement: [
    { text: 'Admin Report', href: '/AdminReport' },
    {
      text: 'Monitoring',
      href: '/SiteMonitoring',
      children: [
        { text: 'Site Monitoring', href: '/SiteMonitoring' },
        { text: 'Customer Monitoring', href: '/CustomerMonitoring' },
        { text: 'Heartbeats', href: '/Heartbeats' },
        { text: 'Last Call Report', href: '/LastCallReport' },
      ],
    },
    {
      text: 'Diagnostics',
      href: '/PendingLogs',
      children: [
        { text: 'Pending Logs', href: '/PendingLogs' },
        { text: 'Received Logs', href: '/ReceivedLogs' },
        { text: 'Remote Diagnostics', href: '/RemoteDiagnostics' },
      ],
    },
    { text: 'Partner', href: '/Partner' },
    { text: 'Billing Report', href: '/BillingReport' },
    { text: 'Billing Report Old', href: '/BillingReportOld' },
    { text: 'Plans', href: '/Plans' },
    { text: 'Update', href: '/Update' },
    { text: 'Audit Log', href: '/AuditLogs' },
    { text: 'System Admin Management', href: '/SystemAdminManagement' },
    { text: 'Marketplace Subscription', href: '/MarketplaceSubscription' },
  ] satisfies NavItem[],

  partner: [
    { text: 'Partner View', href: '/PartnerView' },
    { text: 'Manage Users', href: '/ManageUsers' },
    { text: 'Branding', href: '/Branding' },
    { text: 'Partner Logs', href: '/PartnerLogs' },
    { text: 'API Management', href: '/APIManagement' },
    { text: 'Partner Settings', href: '/PartnerSettings' },
  ] satisfies NavChild[],

  // Top-right "user info" dropdown.
  profile: [
    'Company name',
    'First + Last name',
    'Email',
    'Language selector (English, ...)',
    'Select MFA Option',
    'Reset Password',
    'Set Default Company',
    'Logout',
    // "Add Demo Call" — only for @callcabinet accounts.
  ],

  mfaOptions: ['No MFA', 'Email MFA', 'App MFA'],

  // "support" dropdown (top-right). "Product Guides" opens a submenu of guides.
  support: ['Support Portal', 'Product Guides'],

  languages: [
    'English',
    'Ukrainian',
    'Chinese',
    'Hebrew',
    'Spanish',
    'Afrikaans',
    'Indonesian',
    'Portuguese',
    'German',
    'French',
    'Greek',
    'Hindi',
    'Polish',
    'Japanese',
    'Dutch',
    'Korean',
    'Swedish',
    'Russian',
  ],
} as const;

export class NavigationPage extends BasePage {
  readonly topTabs: Locator;
  readonly activeTab: Locator;
  readonly leftLinks: Locator;
  readonly themeBtn: Locator;
  readonly aiAgentBtn: Locator;
  readonly supportBtn: Locator;
  readonly userInfoBtn: Locator;
  readonly fontDecrease: Locator;
  readonly fontIncrease: Locator;
  /** Company selector (top-left label). */
  readonly companySelector: Locator;
  /** Blocking announcement modal. */
  readonly modalClose: Locator;

  constructor(page: Page) {
    super(page);
    this.topTabs = page.locator(
      '[class*="navigation-menu-top-side_link"], [class*="navigation-menu-top-side_linkButton"]',
    );
    this.activeTab = page.locator('[class*="navigation-menu-top-side_activeLink"]');
    this.leftLinks = page.locator('a[class*="navigation-menu-left-side_link"]');
    this.themeBtn = page.locator('[aria-label="Theme changes"]');
    this.aiAgentBtn = page.locator('[aria-label="AI agent"]');
    this.supportBtn = page.locator('[aria-label="support"]');
    this.userInfoBtn = page.locator('[aria-label="user info"]');
    this.fontDecrease = page.locator('[aria-label="Decrease text size"]');
    this.fontIncrease = page.locator('[aria-label="Increase text size"]');
    this.companySelector = page
      .locator('[class*="company-selector" i], [class*="companySelect" i]')
      .first();
    this.modalClose = page.locator('[aria-label="Close modal"]');
  }

  async goto(path = '/Home'): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await super.goto(path);
        break;
      } catch {
        await this.page.waitForTimeout(3000);
      }
    }
    await this.page.waitForTimeout(3000);
    await this.closeModal();
  }

  /** Dismisses the "API Platform Update" modal; it re-appears after route changes. */
  async closeModal(): Promise<void> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const present = await this.page.evaluate(
        () => !!document.querySelector('[class*="modal_fullScreen" i]'),
      );
      if (!present) return;
      await this.page.evaluate(() => {
        const closeBtn = document.querySelector('[aria-label="Close modal"]') as HTMLElement | null;
        closeBtn?.click();
      });
      await this.page.waitForTimeout(500);
    }
  }

  /** Clicks a top tab by exact label (DOM dispatch — overlays block real clicks). */
  async clickTab(name: string): Promise<boolean> {
    await this.closeModal();
    const ok = await this.page.evaluate((tabName) => {
      const el = Array.from(
        document.querySelectorAll('[class*="top-side"] a, [class*="top-side"] span, [class*="top-side"] button'),
      ).find((e) => (e as HTMLElement).innerText.trim() === tabName) as HTMLElement | undefined;
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, name);
    await this.page.waitForTimeout(2500);
    await this.closeModal();
    return ok;
  }

  /** Visible left-menu items in order (top→bottom). */
  async leftMenuItems(): Promise<{ text: string; href: string | null; x: number; y: number }[]> {
    return await this.page.evaluate(() => {
      const isVisible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const seen = new Set<string>();
      const res: { text: string; href: string | null; x: number; y: number }[] = [];
      Array.from(document.querySelectorAll('a[class*="navigation-menu-left-side_link"]'))
        .filter(isVisible)
        .map((a) => {
          const r = a.getBoundingClientRect();
          return {
            text: ((a as HTMLElement).innerText || '').trim().replace(/\s+/g, ' '),
            href: a.getAttribute('href'),
            x: Math.round(r.x),
            y: Math.round(r.y),
          };
        })
        .sort((a, b) => a.x - b.x || a.y - b.y)
        .forEach((item) => {
          if (item.text && !seen.has(item.text)) {
            seen.add(item.text);
            res.push(item);
          }
        });
      return res;
    });
  }

  /** Top tab labels in order. */
  async tabLabels(): Promise<string[]> {
    return await this.page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          '[class*="top-side_link"], [class*="top-side_linkButton"], [class*="top-side_notActiveLink"], [class*="top-side_activeLink"]',
        ),
      )
        .map((a) => (a as HTMLElement).innerText.trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i),
    );
  }

  async openSupport(): Promise<void> {
    await this.closeModal();
    await this.supportBtn.click({ force: true });
    await this.page.waitForTimeout(800);
  }

  async openProfile(): Promise<void> {
    await this.closeModal();
    await this.userInfoBtn.click({ force: true });
    await this.page.waitForTimeout(800);
  }

  /** Settings sub-pages (navigate to /Settings/General first). */
  async settingsPages(): Promise<{ text: string; href: string | null }[]> {
    return await this.page.evaluate(() => {
      const isVisible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const seen = new Set<string>();
      const res: { text: string; href: string | null }[] = [];
      Array.from(document.querySelectorAll('a[href^="/Settings/"]'))
        .filter(isVisible)
        .forEach((a) => {
          const text = ((a as HTMLElement).innerText || '').trim();
          if (text && !seen.has(text)) {
            seen.add(text);
            res.push({ text, href: a.getAttribute('href') });
          }
        });
      return res;
    });
  }
}
