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
  // open flats: dust storms and clear skies. Fog would gut a map whose whole
  // point is the long fire lane, so it is not on the menu.
  hardpan:  ['clear', 'clear', 'clear', 'dust', 'dust', 'night'],
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

// Robert's weather pass (§8.8): the sky is a real combat variable now. FOG
// pulls sight to a tight radius — you fight what's near and lean on your
// instruments (pings, the flag marker, muzzle flashes) for the rest. RAIN
// dips the view and slicks the ground a touch; STORM is HEAVY RAIN — a lot
// less sight, real mud, air grounded. `vision` is the perception-budget
// multiplier at intensity 1 (fronts run intensity 0.5–1.0, so even a light
// front is felt); `soldier/wheels/tracks` are the mud tax on each drivetrain.
export const WEATHER_MODS: Record<WeatherKind, WeatherMods> = {
  clear: { vision: 1,    soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: false },
  rain:  { vision: 0.7,  soldier: 0.97, wheels: 0.9,  tracks: 0.97, groundsAir: false },
  storm: { vision: 0.42, soldier: 0.92, wheels: 0.8,  tracks: 0.9,  groundsAir: true, zoomCap: 40 },
  fog:   { vision: 0.3,  soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: true, zoomCap: 34 },
  snow:  { vision: 0.5,  soldier: 0.9,  wheels: 0.82, tracks: 0.88, groundsAir: true, zoomCap: 46 },
  dust:  { vision: 0.55, soldier: 0.96, wheels: 0.78, tracks: 0.93, groundsAir: true, zoomCap: 46 },
  night: { vision: 0.7,  soldier: 1,    wheels: 1,    tracks: 1,    groundsAir: false },
};

/** The tightest a vision budget can be squeezed — even in the thickest murk you
 *  still register a body inside knife range (perception's RING carries the
 *  footsteps-close read). Keeps heavy fog dramatic without going fully blind. */
export const MIN_VISION = 0.16;

/** Perception multiplier at the front's current strength (clear = 1), floored
 *  at MIN_VISION so the thickest murk still leaves a knife-range read. */
export function visionMult(w: WeatherState): number {
  const base = WEATHER_MODS[w.kind].vision;
  return Math.max(MIN_VISION, 1 - (1 - base) * w.intensity);
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

/** The dispatch line the announcer reads when the front arrives — the weather
 *  desk is a payroll clerk: state the fact, regret nothing. */
export function weatherAnnounce(kind: WeatherKind): string {
  switch (kind) {
    case 'rain': return 'WEATHER: RAIN — sight dims. THE WAR CONTINUES REGARDLESS.';
    case 'storm': return 'WEATHER: STORM — sight cut, air grounded. COMPLAINTS MAY BE FILED WITH THE SKY.';
    case 'fog': return 'WEATHER: FOG — TRUST YOUR EARS.';
    case 'snow': return 'WEATHER: SNOWSTORM — AIR ASSETS HAVE ELECTED TO LIVE.';
    case 'dust': return 'WEATHER: DUST STORM — THE WHEELS OBJECT. THE WAR DOES NOT.';
    case 'night': return 'NIGHTFALL — muzzle flashes glow. SO DO MISTAKES.';
    default: return 'SKIES CLEARING. RESUME.';
  }
}
