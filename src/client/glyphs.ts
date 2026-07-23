// ---------------------------------------------------------------------------
// THE MENU GLYPH VOCABULARY (coach-ui iteration 2): every deploy card icon in
// ONE ink. The emoji zoo broke the two hardest laws on the most-trafficked
// surface — full-color Twemoji carried banned magenta (the Conquest rings
// pixel-sampled at rgb(224,64,128)) and out-shouted the amber selection
// channel. These are flat currentColor silhouettes: steel at rest, amber
// when the card is chosen (styles.css .select-card .icon). Helldivers-class
// pictograms, house-drawn.
// ---------------------------------------------------------------------------
import type { ClassId, ModeId, ThemeId } from '../sim/types';

const svg = (inner: string, stroke = false) =>
  `<svg viewBox="0 0 24 24" width="28" height="28" ${stroke
    ? 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"'
    : 'fill="currentColor"'}>${inner}</svg>`;

export const MODE_GLYPHS: Partial<Record<ModeId, string>> = {
  // WAR — the classics
  tdm: svg('<path d="M4 4l16 16M20 4L4 20"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>', true),
  ctf: svg('<path d="M6 21V3"/><path d="M6 4h11l-3 3.5L17 11H6" fill="currentColor" stroke="none"/>', true),
  koth: svg('<path d="M3 20L12 6l9 14z"/><circle cx="12" cy="16" r="2.4" fill="#00000000" stroke="currentColor" stroke-width="1.6"/>'),
  conquest: svg('<circle cx="5" cy="18" r="2.6"/><circle cx="12" cy="6" r="2.6"/><circle cx="19" cy="18" r="2.6"/><path d="M6.5 16L10.5 8M13.5 8l4 8M8 18h8" stroke="currentColor" stroke-width="1.4"/>'),
  // OUTBREAK
  survival: svg('<path d="M12 3v18M7 8h10M9 21h6" />', true),
  horde: svg('<circle cx="5" cy="17" r="1.7"/><circle cx="10" cy="18" r="1.7"/><circle cx="15" cy="17" r="1.7"/><circle cx="20" cy="18" r="1.7"/><circle cx="7" cy="12" r="1.5"/><circle cx="12" cy="13" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="9" cy="7" r="1.3"/><circle cx="14" cy="7.5" r="1.3"/>'),
  tide: svg('<path d="M2 8q3-3 6 0t6 0 6 0M2 13q3-3 6 0t6 0 6 0M2 18q3-3 6 0t6 0 6 0"/>', true),
  safehouse: svg('<path d="M3 11L12 4l9 7"/><path d="M6 10v9h12v-9"/><path d="M12 12v4M10 14h4"/>', true),
  // MISSIONS
  science: svg('<path d="M10 3v6L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18L14 9V3"/><path d="M8 3h8"/>', true),
  range: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>', true),
  // TRAINING & TRIALS + the yard
  paintball: svg('<circle cx="12" cy="12" r="4.2"/><circle cx="19" cy="8" r="1.6"/><circle cx="6" cy="7" r="1.3"/><circle cx="17" cy="17.5" r="1.2"/><circle cx="5.5" cy="16" r="1"/>'),
  race: svg('<path d="M5 21V4h13l-2.5 3.5L18 11H7"/><path d="M7 4h3v3H7zM13 4h3v3h-3zM10 7h3v3h-3z" fill="currentColor" stroke="none"/>', true),
  timetrial: svg('<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3.4 2"/><path d="M9 2h6"/>', true),
};

export const CLASS_GLYPHS: Record<ClassId, string> = {
  infantry: svg('<path d="M4 8l8 5 8-5M4 13l8 5 8-5"/>', true),
  heavy: svg('<rect x="8" y="3" width="8" height="12" rx="3.5"/><path d="M9.5 15v5M14.5 15v5M12 15v6" stroke="currentColor" stroke-width="1.6"/>'),
  jump: svg('<path d="M12 3l5 7h-3v6h-4v-6H7z"/><path d="M9 19q3 3 6 0" stroke="currentColor" stroke-width="1.6" fill="none"/>'),
  engineer: svg('<path d="M12 3l7 4v10l-7 4-7-4V7z"/><circle cx="12" cy="12" r="3" fill="#0000" stroke="currentColor" stroke-width="1.8"/>', true),
  medic: svg('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'),
  infiltrator: svg('<path d="M2 12q10-9 20 0-10 9-20 0z"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/>', true),
  pathfinder: svg('<path d="M12 2l3 8 7 2-7 2-3 8-3-8-7-2 7-2z"/>'),
  ghost: svg('<path d="M4 9q8-7 16 0M7 13q5-4.5 10 0"/><circle cx="12" cy="17.5" r="2" fill="currentColor" stroke="none"/>', true),
};

export const THEME_GLYPHS: Partial<Record<ThemeId, string>> = {
  savanna: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5q4.5 8.5 0 17M12 3.5q-4.5 8.5 0 17"/>', true),
  starship: svg('<path d="M4 15L15 4l5 5-11 11H4z"/><path d="M13 6l5 5" stroke="currentColor" stroke-width="1.4"/>'),
  asteroid: svg('<path d="M8 3l8 1 5 7-3 8-9 2-6-6 1-9z"/><circle cx="10" cy="10" r="1.8" fill="#0000" stroke="currentColor" stroke-width="1.4"/>', true),
  europa: svg('<circle cx="12" cy="12" r="8.5"/><path d="M4 10q4 3 8 0t8 0M5 15q4 3 7 0t7 0"/>', true),
  titan: svg('<circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="10" ry="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  triton: svg('<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/>', true),
  hardpan: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>', true),
  winter: svg('<path d="M2 20L9 7l4 6 3-4 6 11z"/><path d="M9 7l1.5 2.5L12 8" stroke="currentColor" stroke-width="1.2"/>'),
};

/** One door for the cards: SVG when the vocabulary has it, emoji fallback
 *  until every world grows its silhouette. */
export function cardGlyph(table: Record<string, string | undefined>, id: string, fallback: string): string {
  return table[id] ?? fallback;
}
