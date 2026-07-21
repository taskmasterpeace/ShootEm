// ---------------------------------------------------------------------------
// THE ICON LANGUAGE (OUTBREAK-SPEC §16.3) — one vocabulary, eleven glyphs.
// Inline SVG in the tactical-terminal grammar: stroke = currentColor so every
// icon inherits its line's tone (amber hint, red warn, sickly viral green),
// hard butt caps, no rounded corners, legible at 12px. NO emoji — the HUD
// speaks mono glyphs and these.
//
// Mounted today: guard / impact / rear (ability-hint), escape (bite struggle),
// infection (viral chip + biohazard obj-chips), ap + incendiary (ammo
// readout). Defined-and-waiting: strike & grapple (the §16.2 melee stance
// line), corpse & rising (a §6 HUD proximity chip — the world-space corpse
// warning already ships in the renderer).
// ---------------------------------------------------------------------------

export type IconName =
  | 'strike'     // impact burst
  | 'guard'      // angled brace
  | 'grapple'    // gripping hand
  | 'impact'     // filling impact ring
  | 'rear'       // hand behind a silhouette
  | 'escape'     // broken chain
  | 'infection'  // biohazard trefoil
  | 'incendiary' // flame
  | 'ap'         // pointed round through a plate
  | 'corpse'     // body silhouette with timer
  | 'rising';    // rising silhouette

/** Each glyph is the INNER markup of a 14×14 viewBox. Strokes only (plus the
 *  rare solid core), so currentColor carries the whole vocabulary. */
const GLYPHS: Record<IconName, string> = {
  strike: '<path d="M7 2v3M11.5 3.5l-2 2M12 8h-3M2.5 3.5l2 2M2 8h3M7 8l3 4M7 8l-3 4" stroke-width="1.4"/>',
  guard: '<path d="M3 2h8v5l-4 5-4-5z" stroke-width="1.5"/><path d="M7 4v4" stroke-width="1.2"/>',
  grapple: '<path d="M3 8V5M6 8V3.5M9 8V3.5M12 8V5" stroke-width="1.5"/><path d="M3 8c0 3 2 4.5 4.5 4.5S12 11 12 8" stroke-width="1.5"/>',
  impact: '<circle cx="7" cy="7" r="5.2" stroke-width="1.4"/><path d="M7 7m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0" fill="currentColor" stroke="none"/>',
  rear: '<circle cx="8.5" cy="4" r="2" stroke-width="1.4"/><path d="M8.5 6v4.5M8.5 12.5v-2" stroke-width="1.4"/><path d="M3 4v6M3 7h3" stroke-width="1.6"/>',
  escape: '<path d="M4.5 9.5 2.5 11.5a1.8 1.8 0 0 0 2.5 2.5l2-2" stroke-width="1.4"/><path d="M9.5 4.5l2-2a1.8 1.8 0 0 1 2.5 2.5l-2 2" stroke-width="1.4" transform="translate(-1.5 -1.5)"/><path d="M5.5 5.5l1 1M8.5 8.5l1 1" stroke-width="1.2"/>',
  infection: '<circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none"/><circle cx="7" cy="3.2" r="1.9" stroke-width="1.3"/><circle cx="3.7" cy="9" r="1.9" stroke-width="1.3"/><circle cx="10.3" cy="9" r="1.9" stroke-width="1.3"/>',
  incendiary: '<path d="M7 1.5c1 2-2 3-1.5 5.5.3 1.4 1.5 2 1.5 2s-.3-1.5.8-2.3C9.5 5.8 11 7.5 11 9.5A4 4 0 0 1 3 9.5C3 6 6.5 4.5 7 1.5z" stroke-width="1.3"/>',
  ap: '<path d="M8 2v10" stroke-width="1.5"/><path d="M2 7h6l3 0-3 0" stroke-width="1.5"/><path d="M8 4.5 12.5 7 8 9.5" stroke-width="1.4" fill="currentColor"/>',
  corpse: '<path d="M2 11h10" stroke-width="1.5"/><ellipse cx="4" cy="9.7" rx="1.3" ry="1.1" stroke-width="1.3"/><path d="M5.5 10.2h5" stroke-width="1.8"/><circle cx="10.5" cy="4" r="2.4" stroke-width="1.2"/><path d="M10.5 2.8V4l.9.6" stroke-width="1.1"/>',
  rising: '<circle cx="7" cy="5.5" r="1.8" stroke-width="1.4"/><path d="M7 7.5V12M4.5 9.5h5" stroke-width="1.5"/><path d="M2.5 5 2.5 2m0 0L1 3.5M2.5 2 4 3.5" stroke-width="1.2"/>',
};

/** Render an icon inline. 1em square, baseline-tucked, inherits color. */
export function icon(name: IconName, cls = ''): string {
  return `<svg class="ww-ico${cls ? ` ${cls}` : ''}" viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden="true">${GLYPHS[name]}</svg>`;
}

export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
