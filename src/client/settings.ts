// ---------------------------------------------------------------------------
// Player settings (§18/§10.3 table stakes): master volume and reduced motion,
// persisted locally. Team SHAPE-coding is not a setting — the second channel
// (§18: never hue alone) is on for everyone, always.
// ---------------------------------------------------------------------------

export interface Settings {
  masterVolume: number;   // 0..1
  reducedMotion: boolean; // caps screen shake + tones the drone whiteout
}

const KEY = 'ww_settings';

export const settings: Settings = { masterVolume: 0.5, reducedMotion: false };

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    if (typeof raw.masterVolume === 'number') settings.masterVolume = Math.max(0, Math.min(1, raw.masterVolume));
    if (typeof raw.reducedMotion === 'boolean') settings.reducedMotion = raw.reducedMotion;
  } catch { /* defaults stand */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* fine */ }
}
