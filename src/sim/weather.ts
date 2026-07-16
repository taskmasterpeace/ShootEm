// ---------------------------------------------------------------------------
// §8.8 WEATHER — the sky is a combat variable. A weather front is a MODIFIER
// SET, not a mode: it taxes the vision budget (§19 / perception.ts), drags
// locomotion (§8.6), and grounds aircraft (the honest counter-air the MANPADS
// duel wants sometimes). Every front rolls its own sky from a per-theme menu —
// no snow in the desert, no rain inside a starship.
// ---------------------------------------------------------------------------
import type { ThemeId } from './types';

export type WeatherKind = 'clear' | 'rain' | 'storm' | 'fog' | 'snow' | 'dust' | 'night';

export interface WeatherState {
  kind: WeatherKind;
  /** 0..1 — how hard the sky is trying. Scales every modifier. */
  intensity: number;
  /** sim time the next front rolls in */
  until: number;
}

/** What each sky is ALLOWED to do. Duplicate entries are weighting —
 *  clear stays the most common sky everywhere. */
export const THEME_WEATHER: Record<ThemeId, WeatherKind[]> = {
  savanna:  ['clear', 'clear', 'rain', 'storm', 'fog', 'night'],
  starship: ['clear'],                                       // vacuum has no opinions
  asteroid: ['clear', 'clear', 'dust', 'night'],             // gallery rock-dust
  europa:   ['clear', 'clear', 'fog', 'night'],              // dome mist
  titan:    ['clear', 'clear', 'dust', 'dust', 'night'],     // the desert: NEVER snow, never rain
  triton:   ['clear', 'snow', 'snow', 'fog', 'night'],       // the snow home
};

export interface WeatherMods {
  /** × the perception budget (PERCEIVE_RANGE) at intensity 1 */
  vision: number;
  soldier: number;
  wheels: number;
  tracks: number;
  /** storms do what missiles can't — flyers lose the sky */
  groundsAir: boolean;
  /** client camera ceiling — heavy weather closes the long view */
  zoomCap?: number;
}

export const WEATHER_MODS: Record<WeatherKind, WeatherMods> = {
  clear: { vision: 1,    soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: false },
  rain:  { vision: 0.85, soldier: 1,    wheels: 0.95, tracks: 1,    groundsAir: false },
  storm: { vision: 0.7,  soldier: 0.97, wheels: 0.9,  tracks: 0.95, groundsAir: true, zoomCap: 44 },
  fog:   { vision: 0.5,  soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: true, zoomCap: 40 },
  snow:  { vision: 0.6,  soldier: 0.93, wheels: 0.85, tracks: 0.9,  groundsAir: true, zoomCap: 48 },
  dust:  { vision: 0.7,  soldier: 0.97, wheels: 0.8,  tracks: 0.95, groundsAir: true, zoomCap: 48 },
  night: { vision: 0.75, soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: false },
};

/** Perception multiplier at the front's current strength (clear = 1). */
export function visionMult(w: WeatherState): number {
  const base = WEATHER_MODS[w.kind].vision;
  return 1 - (1 - base) * w.intensity;
}

/** Locomotion multiplier for one drivetrain at current strength. */
export function moveMult(w: WeatherState, drive: 'soldier' | 'wheels' | 'tracks'): number {
  const base = WEATHER_MODS[w.kind][drive];
  return 1 - (1 - base) * w.intensity;
}

/** A half-hearted drizzle doesn't ground a gunship — a real front does. */
export function airGrounded(w: WeatherState): boolean {
  return WEATHER_MODS[w.kind].groundsAir && w.intensity > 0.25;
}

/** The dispatch line the announcer reads when the front arrives. */
export function weatherAnnounce(kind: WeatherKind): string {
  switch (kind) {
    case 'rain': return 'WEATHER: RAIN — infiltrator weather';
    case 'storm': return 'WEATHER: STORM — air is GROUNDED';
    case 'fog': return 'WEATHER: FOG — you hear what you cannot see';
    case 'snow': return 'WEATHER: SNOWSTORM — air grounded, tracks fade';
    case 'dust': return 'WEATHER: DUST STORM — wheels choke, air grounded';
    case 'night': return 'NIGHTFALL — muzzle flashes glow';
    default: return 'Skies clearing';
  }
}
