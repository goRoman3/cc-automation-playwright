/**
 * Non-destructive stability probe for the full chat-notes flow, per the
 * user's explicit request: creates/edits/deletes NOTHING. Runs the read
 * path (login -> switch company -> This Year -> open chat -> hover message
 * -> open message-note popup -> wait for load -> close popup -> close chat
 * -> open chat-level notes -> close) three times in a row in a single
 * session, logging overlay/menu state at every checkpoint so a "stuck
 * profile menu" or similar transient UI state can be caught and localized
 * without writing any test data.
 *
 * Does NOT call ChatNotesPopup.add()/type()/save()/delete() anywhere.
 *
 * Run: npx tsx scripts/diagnostics/chat-notes-readonly-cycle.ts
 */
import { chromium, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { LoginPage } from '../../pages/login/LoginPage';
import { ChatListingPage } from '../../pages/chat-listing/ChatListingPage';
import { ChatViewModal } from '../../pages/chat-listing/ChatViewModal';
import { ChatNotesPopup } from '../../pages/chat-listing/ChatNotesPopup';
import { CompanySelector } from '../../pages/shared/CompanySelector';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const BASE_URL = process.env.BASE_URL;
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
if (!BASE_URL || !EMAIL || !PASSWORD) throw new Error('BASE_URL / TEST_EMAIL / TEST_PASSWORD must be set.');

const OUT_DIR = path.resolve(__dirname, '../../local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07');
fs.mkdirSync(OUT_DIR, { recursive: true });

interface OverlayState {
  profileMenuVisible: boolean;
  loaderVisible: boolean;
  announcementVisible: boolean;
  notesPopupVisible: boolean;
  sideModalVisible: boolean;
  visiblePopupLikeElements: Array<{ className: string; role: string | null; ariaLabel: string | null }>;
  bodyPointerBlocked: boolean;
}

async function overlayState(page: Page): Promise<OverlayState> {
  return page.evaluate(() => {
    // No named helper anywhere in here: tsx/esbuild wraps any function value
    // bound to a name (declarations, or arrows assigned to a const) with an
    // `__name(...)` call that doesn't exist once Playwright serializes this
    // callback into the browser ("ReferenceError: __name is not defined").
    // Arrow functions passed directly as inline callback arguments (never
    // assigned to a variable) are fine — that's the pattern used throughout.
    const targets = [
      document.querySelector('[class*="usersInfoPopup"]'),
      document.querySelector('[class*="loader_loaderPageContainer"]'),
      document.querySelector('[class*="modal_fullScreen"], [class*="modal_background"]'),
      document.querySelector('[class*="notesPopup"], [class*="dynamic-popup_popup"]'),
      document.querySelector('[class*="side-modal_shadowContainer"]'),
    ];
    const visFlags = targets.map((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el as HTMLElement);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    });
    const [profileMenuVisible, loaderVisible, announcementVisible, notesPopupVisible, sideModalVisible] = visFlags;

    const popupLike = Array.from(
      document.querySelectorAll(
        '[class*="popup" i], [class*="menu" i], [class*="overlay" i], [role="dialog"], [role="menu"]',
      ),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el as HTMLElement);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    });

    // Sample a point at the very top-right corner of the viewport (where the
    // profile avatar / close icons cluster) and see what's really on top there.
    const topRight = document.elementFromPoint(window.innerWidth - 20, 25);

    return {
      profileMenuVisible,
      loaderVisible,
      announcementVisible,
      notesPopupVisible,
      sideModalVisible,
      visiblePopupLikeElements: popupLike.slice(0, 8).map((el) => ({
        className: typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className : '',
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
      })),
      bodyPointerBlocked: !!topRight && topRight !== document.body && topRight.tagName !== 'HTML',
    };
  });
}

const log: Array<{ cycle: number; step: string; state: OverlayState }> = [];

async function record(page: Page, cycle: number, step: string) {
  const state = await overlayState(page);
  log.push({ cycle, step, state });
  const flags = [
    state.profileMenuVisible && 'PROFILE_MENU_OPEN',
    state.loaderVisible && 'LOADER_VISIBLE',
    state.announcementVisible && 'ANNOUNCEMENT_VISIBLE',
  ].filter(Boolean);
  console.log(
    `[cycle ${cycle}] ${step.padEnd(28)} notesPopup=${state.notesPopupVisible} sideModal=${state.sideModalVisible}${flags.length ? '  ⚠ ' + flags.join(',') : ''}`,
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  const login = new LoginPage(page);
  const chat = new ChatListingPage(page);
  const chatView = new ChatViewModal(page);
  const notes = new ChatNotesPopup(page);

  await login.goto();
  await login.login(EMAIL!, PASSWORD!);
  await page.waitForURL('/Home', { timeout: 20_000 });
  await record(page, 0, 'after login');

  await new CompanySelector(page).switchTo('SmarshCR Sales');
  await record(page, 0, 'after company switch');

  await chat.goto();
  await chat.dismissAnnouncement();
  await chat.setDateRange('This Year');
  await record(page, 0, 'after This Year filter');

  for (let cycle = 1; cycle <= 3; cycle++) {
    console.log(`\n--- cycle ${cycle} ---`);

    await chat.openChat(0);
    await record(page, cycle, 'chat opened');

    await notes.openForMessage(0);
    await record(page, cycle, 'message-note popup opened');

    // Read-only: just look at the notes, never type/save/delete.
    const existing = await notes.notes();
    console.log(`  existing notes read (read-only): ${existing.length}`);

    await notes.close();
    await record(page, cycle, 'message-note popup closed');

    await chatView.close();
    await record(page, cycle, 'chat view closed');

    await notes.openForRow(0);
    await record(page, cycle, 'chat-level notes opened');

    await notes.close();
    await record(page, cycle, 'chat-level notes closed');
  }

  const anyOverlayStuck = log.some(
    (l) => l.state.profileMenuVisible || (l.step !== 'message-note popup opened' && l.step !== 'chat-level notes opened' && l.state.notesPopupVisible),
  );

  fs.writeFileSync(path.join(OUT_DIR, 'chat-notes-readonly-cycle.json'), JSON.stringify({ when: new Date().toISOString(), log }, null, 2));
  console.log(`\n${anyOverlayStuck ? '⚠ some overlay/menu state looked stuck at an unexpected step — see JSON for detail' : 'no stuck overlay/menu observed across 3 read-only cycles'}`);
  console.log('raw evidence -> local-only/artifacts/chat-listing-nav-diagnostic-2026-09-07/chat-notes-readonly-cycle.json');

  await context.close();
  await browser.close();
})();
