// ---------------------------------------------------------------------------
// THE ADMIN ROOM (#90) — dev knobs behind a login, before going online.
// Robert's ruling (2026-07-22): "I'm the admin… it could just be admin and
// Galactic for right now. We don't have to harden the security." So: a
// plaintext door by DESIGN, session-scoped, replaced wholesale when accounts
// (#83) arrive. First knob: THE CLOCK SCRUB — drag the one clock (#123) and
// the whole client follows: chip, launches, skies.
// ---------------------------------------------------------------------------
import { GAME_DAY_MS, adminClockOffsetMs, clockLabel, gameNow, setAdminClockOffsetMs } from './worldclock';

const $ = (id: string) => document.getElementById(id)!;

// ---- the door (ruling: admin / Galactic, no hardening until #83) -----------
const SESSION_KEY = 'ww_admin_session';
const inSession = () => sessionStorage.getItem(SESSION_KEY) === '1';

function paintDoor() {
  $('door').classList.toggle('hidden', inSession());
  $('knobs').classList.toggle('hidden', !inSession());
  if (inSession()) { paintClock(); paintIdentity(); }
}

$('adm-enter').onclick = () => {
  const u = ($('adm-user') as HTMLInputElement).value.trim();
  const p = ($('adm-pass') as HTMLInputElement).value;
  if (u === 'admin' && p === 'Galactic') {
    sessionStorage.setItem(SESSION_KEY, '1');
    paintDoor();
  } else {
    ($('adm-err') as HTMLElement).style.display = 'block';
  }
};
($('adm-pass') as HTMLInputElement).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ($('adm-enter') as HTMLButtonElement).click();
});
$('adm-logout').onclick = () => { sessionStorage.removeItem(SESSION_KEY); paintDoor(); };

// ---- the clock scrub -------------------------------------------------------
function paintClock() {
  const c = gameNow();
  $('adm-clock').textContent = clockLabel(c) + (c.night ? '  ☾' : '  ☀');
  const off = adminClockOffsetMs();
  $('adm-phase').textContent = off === 0
    ? 'TRUE TIME'
    : `SCRUBBED ${off > 0 ? '+' : ''}${(off / (GAME_DAY_MS / 24)).toFixed(1)} game hours`;
}
setInterval(() => { if (inSession()) paintClock(); }, 2000);

/** Jump the clock so the CURRENT moment reads as the target hour today. */
function jumpTo(hour: number, minute = 0) {
  const now = gameNow(Date.now() + adminClockOffsetMs());
  const wantPhase = (hour * 60 + minute) / (24 * 60);
  const deltaDayFrac = wantPhase - now.phase01;
  setAdminClockOffsetMs(adminClockOffsetMs() + deltaDayFrac * GAME_DAY_MS);
  paintClock();
}
const JUMPS: Record<string, [number, number]> = {
  noon: [12, 0], midnight: [0, 0], dusk: [20, 55], dawn: [5, 55],
};
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-jump]'))) {
  b.onclick = () => { const [h, m] = JUMPS[b.dataset.jump!]; jumpTo(h, m); };
}
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nudge]'))) {
  b.onclick = () => {
    setAdminClockOffsetMs(adminClockOffsetMs() + Number(b.dataset.nudge) * (GAME_DAY_MS / 24 / 60));
    paintClock();
  };
}
$('adm-clock-clear').onclick = () => { setAdminClockOffsetMs(0); paintClock(); };

// ---- identity (read-only until #83) ----------------------------------------
function paintIdentity() {
  try {
    const raw = localStorage.getItem('ww_enlist') ?? localStorage.getItem('ww_identity');
    if (!raw) { $('adm-identity').textContent = 'No enlistment on this client yet — the front door makes one.'; return; }
    const e = JSON.parse(raw) as Record<string, unknown>;
    $('adm-identity').textContent = Object.entries(e)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => `${k}: ${v}`)
      .join('  ·  ');
  } catch {
    $('adm-identity').textContent = 'Enlistment store unreadable.';
  }
}

paintDoor();
