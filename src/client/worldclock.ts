// ---------------------------------------------------------------------------
// THE ONE CLOCK (#123). Robert: "we need to know the time of day at all
// times… consistent time across the game. When it's daytime someplace, it's
// gonna be daytime all over the world."
//
// And (2026-07-23): *"at a time of day in the game, battlefield or not, we
// should see a clock that we will control later."*
//
// Two halves, and they used to disagree:
//
//   THE WORLD CLOCK  — derived from real UTC at a fixed ratio (one game day
//                      every two real hours). Every client everywhere computes
//                      the same answer from its own wall clock: no server sync.
//   THE FIELD CLOCK  — a match advances its own day from `world.time`, so a
//                      replay stays pure and the sim never reads Date.now.
//
// The corner chip used to read the WORLD clock even while you were standing in
// a match, which is the one place it could be wrong: a paused match freezes the
// sky and not the chip, and paintball/shop/threat carry no clock at all. The
// chip now reads THE WORLD YOU ARE STANDING IN — see clockForField().
//
// THE CONTROL (the "later" made ready now). One TimeControl drives both halves:
//   scrub   — drag the clock to an hour
//   rate    — how fast the day runs (0 = stopped)
//   freeze  — pin the whole clock at a moment
// The admin room turns these knobs today; the government turns them later.
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
  // THE EPSILON IS NOT COSMETIC. A phase is a fraction, and an exact hour is
  // rarely exact in binary: 11:00 arrives as 0.4583333333333333, which times
  // 1440 is 659.9999999999999 — and a bare floor renders that as 10:59. Every
  // whole hour the clock could read one minute short of itself. 1e-6 of a
  // minute is 60 microseconds; it cannot move a real reading.
  const minutes = Math.floor(p * 24 * 60 + 1e-6);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { day, h, m, phase01: p, night: h >= 21 || h < 6 };
}

/** Split total game-milliseconds since the epoch into a clock. */
export function clockFromElapsed(elapsedMs: number): GameClock {
  const e = Math.max(0, elapsedMs);
  return clockFromPhase(Math.floor(e / GAME_DAY_MS), (e % GAME_DAY_MS) / GAME_DAY_MS);
}

// ── THE CONTROL ────────────────────────────────────────────────────────────

/**
 * Every knob on the clock, in one object.
 *
 * `anchor*` is what keeps a RATE change continuous: when the speed of the day
 * changes, the clock records where it was and when, then carries on from
 * there. Without the anchor, doubling the rate would teleport the world
 * forward by however long the session had been running.
 */
export interface TimeControl {
  /** the scrub, in real ms — drag the whole clock forward or back */
  offsetMs: number;
  /** how fast the day runs. 1 = one game day per two real hours. 0 = stopped. */
  rate: number;
  /** when set, the clock is STOPPED here (total game-ms since the epoch) */
  frozenElapsedMs: number | null;
  /** real time at the last rate change */
  anchorRealMs: number;
  /** game-ms elapsed at that same moment */
  anchorElapsedMs: number;
}

const KEY = 'ww_time_control';
/** Legacy key (#90's admin scrub) — folded into offsetMs on first load. */
const LEGACY_OFFSET_KEY = 'ww_admin_clock_offset';

export function defaultTimeControl(): TimeControl {
  return {
    offsetMs: 0, rate: 1, frozenElapsedMs: null,
    anchorRealMs: CLOCK_EPOCH_MS, anchorElapsedMs: 0,
  };
}

export function loadTimeControl(): TimeControl {
  if (typeof localStorage === 'undefined') return defaultTimeControl();
  const base = defaultTimeControl();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<TimeControl>;
      const rate = Number(p.rate);
      return {
        offsetMs: Number.isFinite(Number(p.offsetMs)) ? Number(p.offsetMs) : 0,
        // a negative or absurd rate would run the world backwards forever
        rate: Number.isFinite(rate) ? Math.max(0, Math.min(60, rate)) : 1,
        frozenElapsedMs: typeof p.frozenElapsedMs === 'number' && Number.isFinite(p.frozenElapsedMs)
          ? p.frozenElapsedMs : null,
        anchorRealMs: Number.isFinite(Number(p.anchorRealMs)) ? Number(p.anchorRealMs) : CLOCK_EPOCH_MS,
        anchorElapsedMs: Number.isFinite(Number(p.anchorElapsedMs)) ? Number(p.anchorElapsedMs) : 0,
      };
    }
    // migrate #90's bare offset
    const legacy = Number(localStorage.getItem(LEGACY_OFFSET_KEY) ?? 0);
    if (Number.isFinite(legacy) && legacy !== 0) base.offsetMs = legacy;
  } catch { /* private mode */ }
  return base;
}

export function saveTimeControl(tc: TimeControl): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(tc)); } catch { /* private mode */ }
}

/** Total game-ms since the epoch, honouring every knob. */
export function elapsedGameMs(tc: TimeControl, realMs: number): number {
  if (tc.frozenElapsedMs !== null) return tc.frozenElapsedMs;
  return Math.max(0, tc.anchorElapsedMs + (realMs + tc.offsetMs - tc.anchorRealMs) * tc.rate);
}

/** Change the rate WITHOUT moving the world — re-anchor at the current moment. */
export function setRate(tc: TimeControl, rate: number, realMs = Date.now()): TimeControl {
  const at = elapsedGameMs(tc, realMs);
  return { ...tc, anchorElapsedMs: at, anchorRealMs: realMs + tc.offsetMs, rate: Math.max(0, Math.min(60, rate)) };
}

/** Stop the clock where it stands. */
export function freeze(tc: TimeControl, realMs = Date.now()): TimeControl {
  return { ...tc, frozenElapsedMs: elapsedGameMs(tc, realMs) };
}

/** Start it again from where it was stopped. */
export function unfreeze(tc: TimeControl, realMs = Date.now()): TimeControl {
  if (tc.frozenElapsedMs === null) return tc;
  return {
    ...tc, frozenElapsedMs: null,
    anchorElapsedMs: tc.frozenElapsedMs, anchorRealMs: realMs + tc.offsetMs,
  };
}

/** Drag the clock so the current moment reads as `hour` (0..24), today. */
export function scrubToHour(tc: TimeControl, hour: number, realMs = Date.now()): TimeControl {
  const now = elapsedGameMs(tc, realMs);
  const dayStart = Math.floor(now / GAME_DAY_MS) * GAME_DAY_MS;
  const want = dayStart + (((hour % 24) + 24) % 24) / 24 * GAME_DAY_MS;
  let delta = want - now;
  // always move to the NEXT occurrence rather than jumping a day backwards
  if (delta < 0) delta += GAME_DAY_MS;
  return nudge(tc, delta, realMs);
}

/** Push the clock by `deltaGameMs`, frozen or running. */
export function nudge(tc: TimeControl, deltaGameMs: number, realMs = Date.now()): TimeControl {
  if (tc.frozenElapsedMs !== null) {
    return { ...tc, frozenElapsedMs: Math.max(0, tc.frozenElapsedMs + deltaGameMs) };
  }
  const at = elapsedGameMs(tc, realMs);
  return { ...tc, anchorElapsedMs: Math.max(0, at + deltaGameMs), anchorRealMs: realMs + tc.offsetMs };
}

/** Back to the world's own time. */
export const resetControl = (): TimeControl => defaultTimeControl();

/** True when the clock is not simply following the wall. */
export const isControlled = (tc: TimeControl): boolean =>
  tc.frozenElapsedMs !== null || tc.rate !== 1 || tc.offsetMs !== 0
  || tc.anchorElapsedMs !== 0 || tc.anchorRealMs !== CLOCK_EPOCH_MS;

// ── READING THE CLOCK ──────────────────────────────────────────────────────

/** #90 compatibility: the bare scrub the admin room already speaks. */
export function adminClockOffsetMs(): number { return loadTimeControl().offsetMs; }
export function setAdminClockOffsetMs(ms: number) {
  const tc = loadTimeControl();
  saveTimeControl({ ...tc, offsetMs: Math.round(ms) });
}

/** The one answer, from any wall clock (plus every knob on the control). */
export function gameNow(realMs = Date.now()): GameClock {
  return clockFromElapsed(elapsedGameMs(loadTimeControl(), realMs));
}

/**
 * THE CLOCK WHERE YOU ARE STANDING.
 *
 * In a match the world runs its OWN day off `world.time` — that is what the
 * sky obeys, and it is the only honest thing to show a player on the
 * battlefield. Outside a match, the world clock. A match that carries no clock
 * at all (paintball, the pro shop, the threat room) says so rather than
 * inventing an hour.
 */
export function clockForField(field: { phase01: number; dayOffset: number } | null, realMs = Date.now()): GameClock & { field: boolean } {
  if (!field) return { ...gameNow(realMs), field: false };
  const world = gameNow(realMs);
  return { ...clockFromPhase(world.day + field.dayOffset, field.phase01), field: true };
}

/** The chip's text — "D206 · 14:32". The dot beside it wears day or night. */
export function clockLabel(c: GameClock): string {
  return `D${c.day} · ${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`;
}

/**
 * The time of day in words. Digits tell you the time; this tells you what kind
 * of light you are fighting in, which is the thing a player actually reads.
 */
export function phaseName(c: GameClock): string {
  const h = c.h;
  if (h < 4) return 'DEAD OF NIGHT';
  if (h < 6) return 'BEFORE DAWN';
  if (h < 8) return 'DAWN';
  if (h < 11) return 'MORNING';
  if (h < 14) return 'MIDDAY';
  if (h < 17) return 'AFTERNOON';
  if (h < 19) return 'EVENING';
  if (h < 21) return 'DUSK';
  return 'NIGHT';
}
