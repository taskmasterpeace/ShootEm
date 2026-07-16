// ---------------------------------------------------------------------------
// Biome soundscape designation — every theme has a surface, a footstep slot,
// and an ambience bed, and every referenced slot actually exists in the sound
// roster (so the Sound Lab lists it and the generator specs can fill it).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/sim/data';
import { SOUND_NAMES } from '../src/client/audio';
import { BIOME_AUDIO } from '../src/client/soundscape';
import type { ThemeId } from '../src/sim/types';

describe('biome soundscape designation', () => {
  const themes = Object.keys(THEMES) as ThemeId[];

  it('every theme is designated', () => {
    for (const t of themes) {
      const b = BIOME_AUDIO[t];
      expect(b, `theme ${t} missing from BIOME_AUDIO`).toBeDefined();
      expect(b.surface.length).toBeGreaterThan(0);
      expect(b.ambVol).toBeGreaterThan(0);
      expect(b.ambVol).toBeLessThanOrEqual(0.4); // beds are felt, not heard
    }
  });

  it('every designated slot exists in the sound roster', () => {
    const names = new Set<string>(SOUND_NAMES);
    for (const t of themes) {
      expect(names.has(BIOME_AUDIO[t].footstep), `${BIOME_AUDIO[t].footstep} not in SOUND_NAMES`).toBe(true);
      expect(names.has(BIOME_AUDIO[t].ambience), `${BIOME_AUDIO[t].ambience} not in SOUND_NAMES`).toBe(true);
    }
    expect(names.has('footstep')).toBe(true); // the universal fallback stays
  });

  it('ambience beds are per-theme (no accidental sharing)', () => {
    const beds = themes.map((t) => BIOME_AUDIO[t].ambience);
    expect(new Set(beds).size).toBe(beds.length);
  });
});
