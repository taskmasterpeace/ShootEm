import type { ThemeId } from '../sim/types';
import type { SoundName } from './audio';

// ---------------------------------------------------------------------------
// The biome soundscape designation — which surface each theme walks on, which
// footstep slot that surface fires, and which ambience bed hums under the
// match. This is the single table a sound designer fills: drop a wav into a
// slot (public/audio/<name>.wav, or replace it live in the Sound Lab) and the
// game uses it; until then the universal 'footstep' covers the step and the
// ambience stays silent. tools' sound-specs.json carries generation specs for
// every slot here. Guarded by tests/soundscape.test.ts.
// ---------------------------------------------------------------------------

export interface BiomeAudio {
  /** what the ground IS there — the label a designer reasons about */
  surface: string;
  /** per-surface footstep slot; falls back to 'footstep' while unfilled */
  footstep: SoundName;
  /** looped ambience bed for the theme, ducked low under the fight */
  ambience: SoundName;
  /** bed loudness — ambience is felt, not heard */
  ambVol: number;
}

export const BIOME_AUDIO: Record<ThemeId, BiomeAudio> = {
  savanna:  { surface: 'dry grass & dirt',   footstep: 'footstep_grass', ambience: 'amb_savanna',  ambVol: 0.22 },
  starship: { surface: 'deck plate',         footstep: 'footstep_metal', ambience: 'amb_starship', ambVol: 0.26 },
  asteroid: { surface: 'mine rubble',        footstep: 'footstep_rock',  ambience: 'amb_asteroid', ambVol: 0.22 },
  europa:   { surface: 'wet dome floor',     footstep: 'footstep_ice',   ambience: 'amb_europa',   ambVol: 0.24 },
  titan:    { surface: 'gritty colony road', footstep: 'footstep_grit',  ambience: 'amb_titan',    ambVol: 0.22 },
  triton:   { surface: 'hard ice',           footstep: 'footstep_ice',   ambience: 'amb_triton',   ambVol: 0.24 },
};
