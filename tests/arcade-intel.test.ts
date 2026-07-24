// ───────────────────────────────────────────────────────────────────────────
// THE ARCADE IS IN THIS SECTOR — the deploy intel line.
//
// Cabinets went from usable → visible → in the city → marked on the minimap.
// But you still had to OPEN THE MAP to know a machine was there, and a walk-up
// console you only find through a menu is not really walk-up. One intel line at
// deploy names the machines waiting in the city, so a player goes looking.
//
// This suite guards the string that line is built from — the part with real
// logic (dedup, capping) — and confirms a real city actually produces one.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { arcadeIntelLine } from '../src/client/arcade';
import { generateFront } from '../src/sim/fronts';

const cab = (name: string) => ({ name });

describe('the intel line only fires when there is something to find', () => {
  it('an empty sector says nothing — no banner about no arcade', () => {
    expect(arcadeIntelLine([])).toBeNull();
  });

  it('one machine names it', () => {
    const line = arcadeIntelLine([cab('ORBIT RUN')]);
    expect(line).toContain('ORBIT RUN');
    expect(line).toMatch(/press E/i);
  });

  it('two machines are joined, not capped', () => {
    const line = arcadeIntelLine([cab('ORBIT RUN'), cab('DEEP SHAFT')])!;
    expect(line).toContain('ORBIT RUN');
    expect(line).toContain('DEEP SHAFT');
    expect(line).not.toContain('+');
  });

  it('a big row is capped so it never runs off the banner', () => {
    const line = arcadeIntelLine(
      ['ORBIT RUN', 'DEEP SHAFT', 'HARVEST 88', 'SIEGE TOWER', 'NIGHTWATCH'].map(cab),
    )!;
    expect(line).toContain('+3');
    // only the first two are named in full
    expect(line).toContain('ORBIT RUN');
    expect(line).toContain('DEEP SHAFT');
    expect(line).not.toContain('HARVEST 88');
  });

  it('two of the same machine is still one title — the sector has AN orbit run', () => {
    const line = arcadeIntelLine([cab('ORBIT RUN'), cab('ORBIT RUN')])!;
    expect(line).not.toContain('+');
    expect(line.match(/ORBIT RUN/g)?.length).toBe(1);
  });
});

describe('a real city produces a real line', () => {
  it('deploying into a city announces the machine in it', () => {
    // the city always has at least one cabinet (arcade-in-the-world cycle)
    for (const seed of [1, 2, 3, 4, 5]) {
      const m = generateFront('the_city', seed)!;
      const line = arcadeIntelLine(m.arcades ?? []);
      expect(line, `city seed ${seed} has cabinets but no intel line`).toBeTruthy();
      // and it names a machine that is actually standing there
      const name = m.arcades![0].name;
      expect(line).toContain(name.split(' ')[0]);
    }
  });

  it('a bare battlefield with no shops announces nothing', () => {
    const m = generateFront('highland_pass', 3)!;
    expect(arcadeIntelLine(m.arcades ?? [])).toBeNull();
  });
});
