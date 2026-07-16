// ---------------------------------------------------------------------------
// §8.8 WEATHER — the sky is a combat variable. Themes only roll skies they're
// allowed (no snow in the desert, nothing at all inside a starship), fronts
// replicate to puppets, and a storm genuinely taxes the perception budget.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN } from '../src/sim/map';
import { PERCEIVE_RANGE } from '../src/sim/perception';
import { THEME_WEATHER, airGrounded, moveMult, visionMult } from '../src/sim/weather';
import { applySnapshot, createPuppetWorld, cullSnapshotFor, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';
import type { ThemeId } from '../src/sim/types';

const at = (t: number) => (t + 0.5) * 3 - 150;

describe('the sky obeys its theme', () => {
  it('every front starts clear — the first front arrives on its own clock', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    expect(w.weather.kind).toBe('clear');
    expect(w.weather.until).toBeGreaterThan(0);
  });

  it('rolls only from the theme menu — the desert NEVER sees snow or rain', () => {
    for (const theme of Object.keys(THEME_WEATHER) as ThemeId[]) {
      const w = new World({ seed: 11, mode: 'tdm', theme });
      const seen = new Set<string>();
      for (let i = 0; i < 60; i++) {
        w.weather.until = w.time; // force the next front
        w.step(1 / 60, new Map());
        seen.add(w.weather.kind);
      }
      for (const k of seen) expect(THEME_WEATHER[theme]).toContain(k);
    }
    // the two named laws, asserted by name
    expect(THEME_WEATHER.titan).not.toContain('snow');
    expect(THEME_WEATHER.titan).not.toContain('rain');
    expect(THEME_WEATHER.starship).toEqual(['clear']);
  });
});

describe('weather modifiers', () => {
  it('intensity scales the tax; clear taxes nothing', () => {
    expect(visionMult({ kind: 'clear', intensity: 0, until: 0 })).toBe(1);
    expect(visionMult({ kind: 'fog', intensity: 1, until: 0 })).toBeCloseTo(0.5);
    expect(visionMult({ kind: 'fog', intensity: 0.5, until: 0 })).toBeCloseTo(0.75);
    expect(moveMult({ kind: 'dust', intensity: 1, until: 0 }, 'wheels')).toBeCloseTo(0.8);
    expect(moveMult({ kind: 'dust', intensity: 1, until: 0 }, 'tracks')).toBeCloseTo(0.95);
  });

  it('a drizzle does not ground a gunship; a real storm does', () => {
    expect(airGrounded({ kind: 'storm', intensity: 0.2, until: 0 })).toBe(false);
    expect(airGrounded({ kind: 'storm', intensity: 0.8, until: 0 })).toBe(true);
    expect(airGrounded({ kind: 'rain', intensity: 1, until: 0 })).toBe(false);
  });
});

describe('the storm reaches every screen', () => {
  it('weather replicates through the snapshot to puppet worlds', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    w.weather = { kind: 'storm', intensity: 0.9, until: 500 };
    const puppet = createPuppetWorld(7, 'tdm', w.map.theme);
    applySnapshot(puppet, takeSnapshot(w, []));
    expect(puppet.weather.kind).toBe('storm');
    expect(puppet.weather.intensity).toBeCloseTo(0.9);
  });

  it('a whiteout shrinks the wire: the 55u enemy you saw in clear air is gone', () => {
    const build = () => {
      const w = new World({ seed: 21, mode: 'tdm' });
      for (let tz = 46; tz <= 54; tz++)
        for (let tx = 44; tx <= 70; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
      const me = w.addSoldier('Viewer', 'infantry', 0, 'human');
      me.pos = { x: at(48), y: 0, z: at(50) };
      const foe = w.addSoldier('Foe', 'infantry', 1, 'human');
      foe.pos = { x: at(66), y: 0, z: at(50) }; // 54u out — inside 65, outside 65×0.7
      return { w, me, foe };
    };
    const clear = build();
    expect(Math.hypot(clear.foe.pos.x - clear.me.pos.x, clear.foe.pos.z - clear.me.pos.z)).toBeLessThan(PERCEIVE_RANGE);
    clear.w.step(1 / 60, new Map());
    expect(cullSnapshotFor(clear.w, takeSnapshot(clear.w, []), clear.me.id).soldiers.map((s) => s.id)).toContain(clear.foe.id);

    const storm = build();
    storm.w.weather = { kind: 'storm', intensity: 1, until: 1e9 };
    storm.w.step(1 / 60, new Map());
    expect(storm.w.perceiveRange()).toBeCloseTo(PERCEIVE_RANGE * 0.7);
    expect(cullSnapshotFor(storm.w, takeSnapshot(storm.w, []), storm.me.id).soldiers.map((s) => s.id)).not.toContain(storm.foe.id);
  });
});
