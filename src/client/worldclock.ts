// ---------------------------------------------------------------------------
// THE ONE CLOCK (#123). Robert: "we need to know the time of day at all
// times… consistent time across the game. When it's daytime someplace, it's
// gonna be daytime all over the world."
//
// The design: game time DERIVES from real UTC at a fixed ratio — one game
// day every two real hours. Every client everywhere computes the same
// answer from its own wall clock: consistent across matches, sessions, and
// (later) multiplayer, with zero server sync. The sim never reads Date.now —
// the client passes the phase at LAUNCH (WorldOptions.clockPhase) and the
// match advances it deterministically by world.time. Replays stay pure.
// ---------------------------------------------------------------------------

/** The war began July 1, 2026 UTC — day numbers count from here. */
export const CLOCK_EPOCH_MS = Date.UTC(2026, 6, 1);

/** One game day every two real hours. */
export const GAME_DAY_MS = 2 * 60 * 60 * 1000;

/** In-match: world.time is real seconds, so a game day is 7200 of them. */
export const GAME_DAY_SIM_SECONDS = GAME_DAY_MS / 1000;

export interface GameClock {
  day: number;      // whole days since the epoch
  h: number;        // 0..23
  m: number;        // 0..59
  phase01: number;  // fraction of the day, 0 = midnight
  night: boolean;   // the world agrees: 21:00–06:00 is night
}

export function clockFromPhase(day: number, phase01: number): GameClock {
  const p = ((phase01 % 1) + 1) % 1;
  const minutes = Math.floor(p * 24 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { day, h, m, phase01: p, night: h >= 21 || h < 6 };
}

/** #90 THE ADMIN SCRUB: a stored offset (real ms) the admin room sets to
 *  drag the whole client's clock — the chip, every launch, every sky.
 *  Browser-only storage; node (tests) always reads 0. */
const ADMIN_OFFSET_KEY = 'ww_admin_clock_offset';
export function adminClockOffsetMs(): number {
  if (typeof localStorage === 'undefined') return 0;
  const v = Number(localStorage.getItem(ADMIN_OFFSET_KEY) ?? 0);
  return Number.isFinite(v) ? v : 0;
}
export function setAdminClockOffsetMs(ms: number) {
  if (typeof localStorage === 'undefined') return;
  if (ms === 0) localStorage.removeItem(ADMIN_OFFSET_KEY);
  else localStorage.setItem(ADMIN_OFFSET_KEY, String(Math.round(ms)));
}

/** The one answer, from any wall clock (plus the admin's thumb, if set). */
export function gameNow(realMs = Date.now() + adminClockOffsetMs()): GameClock {
  const elapsed = Math.max(0, realMs - CLOCK_EPOCH_MS);
  const day = Math.floor(elapsed / GAME_DAY_MS);
  return clockFromPhase(day, (elapsed % GAME_DAY_MS) / GAME_DAY_MS);
}

/** The chip's text — "D206 · 14:32". The dot beside it wears day or night. */
export function clockLabel(c: GameClock): string {
  return `D${c.day} · ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`;
}
