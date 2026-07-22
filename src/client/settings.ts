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

/** THE RETICLE (Robert: "I wanna design like 8 or 9 of these… based on the user
 *  and the family of weapons"). A family of aim cursors; the player picks one
 *  (or `auto` lets the weapon family choose). GROUND styles lie flat where you
 *  aim; STANDING styles rise on the vertical plane out in front of you like a
 *  target, with a little ground shadow. `laser` is the personal green sight. */
export type ReticleStyle =
  | 'auto'        // pick by weapon family (shotgun → wide ring, sniper → fine cross…)
  | 'wedge'       // GROUND: the opening spread wedge (the original)
  | 'circle'      // GROUND: a flat spread ring where your shots land
  | 'crosshair'   // STANDING: a classic crosshair on the vertical plane, out in front
  | 'dot'         // STANDING: a single floating dot
  | 'cross'       // STANDING: a thin + with a center gap
  | 'chevron'     // STANDING: a V pointing up (the battle-sight)
  | 'brackets'    // STANDING: four corner brackets around the point
  | 'ringdot';    // STANDING: a ring with a center dot

export interface Settings {
  masterVolume: number;   // 0..1
  reducedMotion: boolean; // caps screen shake + tones the drone whiteout
  /** opt #31: the QUALITY tier — one knob, read once at renderer construction.
   *  low = DPR cap 1.25, sun shadows OFF, flash-light pool 2 (#30). */
  quality: 'high' | 'low';
  /** #89: HUD widget opacity (the vitals/weapon blocks + status strip), 0.4..1 */
  hudOpacity: number;
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
  /** THE RETICLE (Robert). `reticle` picks the cursor style; `reticleColor` is
   *  a hex (0xRRGGBB); `reticleDist` 0..1 slides a STANDING reticle nearer/further
   *  in front (how far away it floats); `reticleScale` 0.5..2 sizes it; `laser`
   *  toggles a personal green sight beam on YOUR gun (only you see it). */
  reticle: ReticleStyle;
  reticleColor: number;
  reticleDist: number;   // 0..1 → near .. far in front (standing reticles)
  reticleScale: number;  // 0.5..2
  /** how a STANDING reticle yaws (Robert tunes this live): 'shooter' = faces
   *  YOU so the shot passes through the circle (his 07-22 law, default);
   *  'screen' = squared to the camera like a flat overlay (the old behavior). */
  reticleFacing: 'shooter' | 'screen';
  laser: boolean;
  /** CONTROLLER (Robert: "controller configuration in the menu"). The gamepad
   *  twin-stick support already ships; these expose its feel. `padEnabled`
   *  gates the poll entirely; `padDeadzone` (0.05..0.4) is the stick dead
   *  centre; `padSensitivity` (0.5..2) scales how far the right stick throws
   *  your aim; `padInvertY` flips the aim stick's vertical axis. */
  padEnabled: boolean;
  padDeadzone: number;
  padSensitivity: number;
  padInvertY: boolean;
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
  masterVolume: 0.5, reducedMotion: false, blood: 'light', darkness: 'subtle', quality: 'high', hudOpacity: 1,
  // ROBERT'S TUNED DEFAULTS (playtest): slow rounds so you can READ the
  // battlefield, boots a touch under shipped pace to match. Vehicles get their
  // OWN knob because the other two knobs created a bug: at 0.35× rounds, a
  // 22u/s buggy simply OUTRUNS the grenade chasing it. Hulls default to the
  // movement figure so the vehicle:infantry ratio stays where it shipped.
  projectileSpeed: 0.35, moveSpeed: 0.8, vehicleSpeed: 0.8,
  // THE RETICLE: default to the STANDING crosshair out in front (Robert's ask),
  // house amber, a mid float distance, unit size, laser off.
  reticle: 'crosshair', reticleColor: 0xe8a33d, reticleDist: 0.6, reticleScale: 1, reticleFacing: 'shooter', laser: false,
  // CONTROLLER: on by default (a plugged pad just works); the hardcoded feel
  // that shipped becomes the defaults here — deadzone 0.18, unit sensitivity.
  padEnabled: true, padDeadzone: 0.18, padSensitivity: 1, padInvertY: false,
};

const RETICLE_STYLES: ReticleStyle[] = ['auto', 'wedge', 'circle', 'crosshair', 'dot', 'cross', 'chevron', 'brackets', 'ringdot'];

const clampSpeed = (v: number) => Math.max(0.25, Math.min(2, v));

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    if (typeof raw.masterVolume === 'number') settings.masterVolume = Math.max(0, Math.min(1, raw.masterVolume));
    if (typeof raw.reducedMotion === 'boolean') settings.reducedMotion = raw.reducedMotion;
    if (raw.quality === 'high' || raw.quality === 'low') settings.quality = raw.quality;
    if (typeof raw.hudOpacity === 'number') settings.hudOpacity = Math.max(0.4, Math.min(1, raw.hudOpacity));
    if (raw.blood === 'off' || raw.blood === 'light' || raw.blood === 'full') settings.blood = raw.blood;
    if (raw.darkness === 'off' || raw.darkness === 'subtle' || raw.darkness === 'full') settings.darkness = raw.darkness;
    if (typeof raw.reticle === 'string' && RETICLE_STYLES.includes(raw.reticle)) settings.reticle = raw.reticle;
    if (typeof raw.reticleColor === 'number') settings.reticleColor = raw.reticleColor & 0xffffff;
    if (typeof raw.reticleDist === 'number') settings.reticleDist = Math.max(0, Math.min(1, raw.reticleDist));
    if (typeof raw.reticleScale === 'number') settings.reticleScale = Math.max(0.5, Math.min(2, raw.reticleScale));
    if (raw.reticleFacing === 'shooter' || raw.reticleFacing === 'screen') settings.reticleFacing = raw.reticleFacing;
    if (typeof raw.laser === 'boolean') settings.laser = raw.laser;
    if (typeof raw.padEnabled === 'boolean') settings.padEnabled = raw.padEnabled;
    if (typeof raw.padDeadzone === 'number') settings.padDeadzone = Math.max(0.05, Math.min(0.4, raw.padDeadzone));
    if (typeof raw.padSensitivity === 'number') settings.padSensitivity = Math.max(0.5, Math.min(2, raw.padSensitivity));
    if (typeof raw.padInvertY === 'boolean') settings.padInvertY = raw.padInvertY;
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
