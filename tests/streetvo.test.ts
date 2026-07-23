// ---------------------------------------------------------------------------
// STREET VO — the pedestrians and the vigilante, per culture code.
//
// Robert: *"do vigilante and pedestrian audio. Different cities sound like the
// culture code. Use the culture codes."*
//
// The laws:
//   1. THE CODE DRIVES THE VOICE — a code-2 street and a code-13 street draw
//      from different mouths, and the slot they resolve names the culture.
//   2. NOWHERE IS MUTE — a code with no lines (or no code at all) still speaks,
//      via a defined fallback.
//   3. DETERMINISTIC — the same (code, event, seed) always picks the same line,
//      so a bark never perturbs the match stream.
//   4. THE GENERATOR AND THE CATALOGUE AGREE — the TTS tool's mirrored lines
//      must match the source of truth, or a slot voices the wrong words.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CULTURES, CULTURE_CODES, NEUTRAL_CULTURE, cultureFor, cultureSlug,
} from '../src/sim/culture';
import {
  canonicalLine, pickStreetLine, streetManifest, type StreetEvent,
} from '../src/client/streetvo';

describe('the culture legend', () => {
  it('is reverse-engineered from real country groupings', () => {
    // spot-check the anchors match the reverse-engineering
    expect(CULTURES[2].region).toBe('West Africa');
    expect(CULTURES[2].anchors).toContain('Nigeria');
    expect(CULTURES[13].region).toBe('Jamaica');
    expect(CULTURES[6].anchors).toContain('Japan');
  });

  it('every culture names a region, tongues and a demeanour', () => {
    for (const code of CULTURE_CODES) {
      const c = CULTURES[code];
      expect(c.region.length).toBeGreaterThan(2);
      expect(c.tongues.length).toBeGreaterThan(0);
      expect(c.demeanour.length).toBeGreaterThan(10);
    }
  });

  it('resolves an unknown or null code to the neutral culture, never a crash', () => {
    expect(cultureFor(999)).toBe(NEUTRAL_CULTURE);
    expect(cultureFor(null)).toBe(NEUTRAL_CULTURE);
    expect(cultureFor(undefined)).toBe(NEUTRAL_CULTURE);
  });

  it('slugs are filename-safe and distinct per culture', () => {
    const slugs = CULTURE_CODES.map((c) => cultureSlug(c));
    expect(new Set(slugs).size).toBe(slugs.length); // all distinct
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9_]+$/);
    expect(cultureSlug(2)).toBe('west_africa');
    expect(cultureSlug(null)).toBe('neutral');
  });
});

describe('the street picker', () => {
  it('THE CODE DRIVES THE VOICE — the slot names the culture', () => {
    expect(pickStreetLine(2, 'gunfire', 1).slot).toMatch(/^street_west_africa_gunfire_/);
    expect(pickStreetLine(13, 'gunfire', 1).slot).toMatch(/^street_jamaica_gunfire_/);
    expect(pickStreetLine(6, 'god', 1).slot).toMatch(/^street_east_asia_god_/);
  });

  it('a code-2 and a code-13 street say the same event in different words', () => {
    const west = pickStreetLine(2, 'gunfire', 5).text;
    const yard = pickStreetLine(13, 'gunfire', 5).text;
    expect(west).not.toBe(yard);
  });

  it('NOWHERE IS MUTE — a null code still speaks', () => {
    const line = pickStreetLine(null, 'flee', 3);
    expect(line.text.length).toBeGreaterThan(0);
    expect(line.text).not.toBe('...');
    expect(line.slot).toMatch(/^street_neutral_/);
  });

  it('DETERMINISTIC — the same inputs always pick the same line', () => {
    for (const seed of [0, 7, 42, 1000]) {
      expect(pickStreetLine(8, 'reckless', seed)).toEqual(pickStreetLine(8, 'reckless', seed));
    }
  });

  it('every culture has a pedestrian AND a vigilante voice', () => {
    const ped: StreetEvent[] = ['idle', 'gunfire', 'flee', 'god', 'reckless'];
    const vig: StreetEvent[] = ['challenge', 'warn', 'engage', 'triumph'];
    for (const code of CULTURE_CODES) {
      for (const e of [...ped, ...vig]) {
        const line = pickStreetLine(code, e, 1);
        expect(line.text.length, `${code}/${e} was mute`).toBeGreaterThan(0);
        expect(line.text).not.toBe('...');
      }
    }
  });
});

describe('the manifest', () => {
  it('covers every culture with both speakers', () => {
    const m = streetManifest();
    expect(m.length).toBeGreaterThan(150);
    expect(m.some((x) => x.speaker === 'pedestrian')).toBe(true);
    expect(m.some((x) => x.speaker === 'vigilante')).toBe(true);
    // 12 voiced cultures
    expect(new Set(m.map((x) => x.slug)).size).toBe(12);
  });

  it('THE GENERATOR MIRRORS THE CATALOGUE — no drifted line voices wrong words', () => {
    // the TTS tool carries a mirrored LINES map; every line it names must exist
    // in the source catalogue at the same slot, or a clip says the wrong thing
    const gen = readFileSync(new URL('../tools/gen-street-vo.mjs', import.meta.url), 'utf8');
    const m = streetManifest();
    // pull the first line of each (code,event) the generator declares and
    // confirm the catalogue's slot-1 text matches
    for (const code of [2, 6, 8, 10, 13, 14]) {
      for (const event of ['gunfire', 'god', 'challenge'] as StreetEvent[]) {
        const text = canonicalLine(code, event); // the slot _1 line the tool voices
        expect(gen.includes(text),
          `generator missing ${code}/${event}: "${text}"`).toBe(true);
      }
    }
    void m;
  });
});
