// ---------------------------------------------------------------------------
// Player settings (§18/§10.3 table stakes): master volume and reduced motion,
// persisted locally. Team SHAPE-coding is not a setting — the second channel
// (§18: never hue alone) is on for everyone, always.
// ---------------------------------------------------------------------------

/** BLOOD (Robert: "add a setting for blood… when shooting someone when
 *  armor is gone we should see light blood splatter"). Three honest levels,
 *  because gore is taste, not a difficulty:
 *    off   — plate sparks only; the game reads as paint and steel
 *    light — the DEFAULT and Robert's ask: a small mist when a round meets
 *            flesh (armor gone), and the ground remembers it
 *    full  — heavier mist, bigger pools, deaths splash
 *  Note the yard is exempt at every level: paintball is PAINT (§14). */
export type BloodLevel = 'off' | 'light' | 'full';

/** READING THE DARK (STATUS §1 / plan A2 step 5): how dark the unseen world
 *  outside your vision cone gets. `off` = the classic even light; `subtle`
 *  (default) = readable murk; `full` = the night-ops look. Accessibility is
 *  the point of the knob — some players want the information without the
 *  murk, and that stays one click away. */
export type DarknessLevel = 'off' | 'subtle' | 'full';

export interface Settings {
  masterVolume: number;   // 0..1
  reducedMotion: boolean; // caps screen shake + tones the drone whiteout
  blood: BloodLevel;
  darkness: DarknessLevel;
  /** FEEL KNOBS (Robert's global speed control) — 1 = shipped feel. Live,
   *  offline tuning: projectileSpeed slows/quickens direct-fire rounds
   *  without moving where they land; moveSpeed scales soldier legs. */
  projectileSpeed: number; // 0.25..2
  vehicleSpeed: number;    // 0.25..2 — hulls get their own knob (see below)
  moveSpeed: number;       // 0.25..2
  /** Which generation of the tuned speed defaults this profile has seen.
   *  Bumping it re-seeds the three speed knobs ONCE — see loadSettings. */
  speedGen?: number;
}

const KEY = 'ww_settings';

/** THE TUNING GENERATION. A saved profile beats a new default — which is
 *  correct for a preference and WRONG for a retune: Robert asked for 0.35 /
 *  0.80 while his own browser held 0.30 / 0.75 from an earlier session, so he
 *  would have launched the game, seen his stale numbers, and reasonably
 *  concluded the change never shipped. Bump this when the house tuning moves;
 *  each profile re-seeds exactly once and anything the player dials AFTER
 *  that is theirs and survives. */
const SPEED_GEN = 1;

export const settings: Settings = {
  masterVolume: 0.5, reducedMotion: false, blood: 'light', darkness: 'subtle',
  // ROBERT'S TUNED DEFAULTS (playtest): slow rounds so you can READ the
  // battlefield, boots a touch under shipped pace to match. Vehicles get their
  // OWN knob because the other two knobs created a bug: at 0.35× rounds, a
  // 22u/s buggy simply OUTRUNS the grenade chasing it. Hulls default to the
  // movement figure so the vehicle:infantry ratio stays where it shipped.
  projectileSpeed: 0.35, moveSpeed: 0.8, vehicleSpeed: 0.8,
};

const clampSpeed = (v: number) => Math.max(0.25, Math.min(2, v));

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    if (typeof raw.masterVolume === 'number') settings.masterVolume = Math.max(0, Math.min(1, raw.masterVolume));
    if (typeof raw.reducedMotion === 'boolean') settings.reducedMotion = raw.reducedMotion;
    if (raw.blood === 'off' || raw.blood === 'light' || raw.blood === 'full') settings.blood = raw.blood;
    if (raw.darkness === 'off' || raw.darkness === 'subtle' || raw.darkness === 'full') settings.darkness = raw.darkness;
    // a profile from before this generation keeps every OTHER preference but
    // takes the new speed tuning once, then is stamped so it never happens again
    if ((raw.speedGen ?? 0) >= SPEED_GEN) {
      if (typeof raw.projectileSpeed === 'number') settings.projectileSpeed = clampSpeed(raw.projectileSpeed);
      if (typeof raw.vehicleSpeed === 'number') settings.vehicleSpeed = clampSpeed(raw.vehicleSpeed);
      if (typeof raw.moveSpeed === 'number') settings.moveSpeed = clampSpeed(raw.moveSpeed);
    }
    settings.speedGen = SPEED_GEN;
    saveSettings();
  } catch { /* defaults stand */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* fine */ }
}
