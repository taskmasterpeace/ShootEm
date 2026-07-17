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

export interface Settings {
  masterVolume: number;   // 0..1
  reducedMotion: boolean; // caps screen shake + tones the drone whiteout
  blood: BloodLevel;
}

const KEY = 'ww_settings';

export const settings: Settings = { masterVolume: 0.5, reducedMotion: false, blood: 'light' };

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    if (typeof raw.masterVolume === 'number') settings.masterVolume = Math.max(0, Math.min(1, raw.masterVolume));
    if (typeof raw.reducedMotion === 'boolean') settings.reducedMotion = raw.reducedMotion;
    if (raw.blood === 'off' || raw.blood === 'light' || raw.blood === 'full') settings.blood = raw.blood;
  } catch { /* defaults stand */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* fine */ }
}
