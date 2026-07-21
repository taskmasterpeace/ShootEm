// ---------------------------------------------------------------------------
// §16.3 THE ICON LANGUAGE — one vocabulary, eleven glyphs, NO emoji. The HUD
// speaks mono glyphs and these inline SVGs (stroke = currentColor so every
// icon inherits its line's tone). This pins the contract: every spec concept
// exists, renders as SVG, and the set stays emoji-free.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, icon } from '../src/client/icons';

describe('§16.3 — the icon language', () => {
  it('all eleven spec concepts exist', () => {
    for (const name of ['strike', 'guard', 'grapple', 'impact', 'rear', 'escape',
      'infection', 'incendiary', 'ap', 'corpse', 'rising'] as const) {
      expect(ICON_NAMES).toContain(name);
    }
    expect(ICON_NAMES.length).toBe(11);
  });

  it('every icon is an inline SVG that inherits color', () => {
    for (const name of ICON_NAMES) {
      const svg = icon(name);
      expect(svg.startsWith('<svg class="ww-ico"')).toBe(true);
      expect(svg).toContain('viewBox="0 0 14 14"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });

  it('the glyphs are distinct — eleven concepts, eleven drawings', () => {
    const bodies = new Set(ICON_NAMES.map((n) => icon(n)));
    expect(bodies.size).toBe(11);
  });

  it('NO emoji — the vocabulary is pure markup', () => {
    // anything outside basic latin/punctuation would be an emoji sneaking in
    for (const name of ICON_NAMES) {
      expect(/^[\x20-\x7e]+$/.test(icon(name)), `${name} stays ASCII`).toBe(true);
    }
  });

  it('a class rider lands on the root element', () => {
    expect(icon('guard', 'warn')).toContain('class="ww-ico warn"');
  });
});
