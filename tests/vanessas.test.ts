// ---------------------------------------------------------------------------
// VANESSA'S PAINTBALL — the shop stays honest.
// The stock ledger (vanessas-stock.ts) must cover the WHOLE marker shelf:
// a new marker in the arsenal without a booth is a failing test, so the shop
// grows when the arsenal does. Cards read stats live off WEAPONS — never a
// hand-copied number.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { STOCK, boothStats } from '../src/client/vanessas-stock';
import { SHOP_ENTRANCE, SHOP_STATIONS, buildVanessasMap, spawnVanessa } from '../src/client/vanessas-place';
import { WEAPONS } from '../src/sim/data';
import { T_OPEN } from '../src/sim/map';
import { worldToTile } from '../src/sim/map-geometry';
import { World } from '../src/sim/world';

const markerIds = Object.values(WEAPONS)
  .filter((d) => d.family === 'marker')
  .map((d) => d.id);

describe("Vanessa's Paintball — the stock ledger", () => {
  it('every marker the arsenal ships has a booth — no more, no less', () => {
    const stocked = STOCK.map((s) => s.id).sort();
    expect(stocked).toEqual([...markerIds].sort());
  });

  it('every booth has a tag, a pitch, and a word from Vanessa', () => {
    for (const s of STOCK) {
      expect(s.tag.length, s.id).toBeGreaterThan(3);
      expect(s.pitch.length, s.id).toBeGreaterThan(20);
      expect(s.vanessa.length, s.id).toBeGreaterThan(10);
    }
  });

  it('booth paint obeys the house law — NO PURPLE', () => {
    for (const s of STOCK) {
      const r = (s.paint >> 16) & 0xff, g = (s.paint >> 8) & 0xff, b = s.paint & 0xff;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let hue = 0;
      if (max !== min) {
        if (max === r) hue = ((g - b) / (max - min)) % 6;
        else if (max === g) hue = (b - r) / (max - min) + 2;
        else hue = (r - g) / (max - min) + 4;
        hue = (hue * 60 + 360) % 360;
      }
      expect(hue < 260 || hue > 330 || max === min, `${s.id} paint #${s.paint.toString(16)} hue ${hue.toFixed(0)}`).toBe(true);
    }
  });

  it('the card reads the arsenal live — real name, real hopper, real belt', () => {
    for (const s of STOCK) {
      const card = boothStats(s.id);
      const def = WEAPONS[s.id];
      expect(card.name).toBe(def.name);
      expect(card.hopper).toContain(String(def.clip));
      expect(card.reach).toContain(String(def.range));
      // pods = ceil(reserve/clip) — the same arithmetic the yard HUD uses
      expect(card.pods).toContain(String(Math.ceil((def.reserve ?? 0) / Math.max(1, def.clip))));
    }
  });
});

describe("Vanessa's — THE PLACE (#122)", () => {
  it('the room is sealed: a walk from the entrance can never leave the shop', () => {
    const map = buildVanessasMap();
    const { cols, rows } = map.geometry;
    const [sx, sz] = worldToTile(map.geometry, SHOP_ENTRANCE.x, SHOP_ENTRANCE.z);
    // BFS the open tiles from the entrance — the flood must never touch the rim
    const seen = new Set<number>([sz * cols + sx]);
    const queue: [number, number][] = [[sx, sz]];
    let touchedRim = false;
    while (queue.length) {
      const [tx, tz] = queue.pop()!;
      if (tx === 0 || tz === 0 || tx === cols - 1 || tz === rows - 1) { touchedRim = true; break; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + dx, nz = tz + dz, idx = nz * cols + nx;
        if (seen.has(idx) || map.grid[idx] !== T_OPEN) continue;
        seen.add(idx);
        queue.push([nx, nz]);
      }
    }
    expect(touchedRim).toBe(false);
    // and the room is a real room, not a closet
    expect(seen.size).toBeGreaterThan(80);
  });

  it('every station is REACHABLE: open floor beside it, flooded from the entrance', () => {
    const map = buildVanessasMap();
    const { cols, rows } = map.geometry;
    // flood the walkable floor from the entrance
    const [sx, sz] = worldToTile(map.geometry, SHOP_ENTRANCE.x, SHOP_ENTRANCE.z);
    const flood = new Set<number>([sz * cols + sx]);
    const q: [number, number][] = [[sx, sz]];
    while (q.length) {
      const [tx, tz] = q.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = tx + dx, nz = tz + dz, idx = nz * cols + nx;
        if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
        if (flood.has(idx) || map.grid[idx] !== T_OPEN) continue;
        flood.add(idx);
        q.push([nx, nz]);
      }
    }
    // a station may BE furniture (booth stands are sim-solid) — but a
    // customer tile must touch it: itself or a neighbor, in the flood
    for (const st of SHOP_STATIONS) {
      const [tx, tz] = worldToTile(map.geometry, st.pos.x, st.pos.z);
      const spots = [[tx, tz], [tx + 1, tz], [tx - 1, tz], [tx, tz + 1], [tx, tz - 1]];
      expect(spots.some(([ax, az]) => flood.has(az * cols + ax)), st.id).toBe(true);
    }
  });

  it('the place boots quiet: 20 sim-seconds, nobody hostile, Vanessa keeps her counter', () => {
    const w = new World({ seed: 7, mode: 'shop', map: buildVanessasMap(), botsPerTeam: 0 });
    const me = w.addSoldier('Customer', 'infantry', 0, 'human');
    me.pos = { ...SHOP_ENTRANCE };
    const v = spawnVanessa(w);
    for (let i = 0; i < 20 * 30; i++) w.step(1 / 30, new Map());
    expect(v.alive).toBe(true);
    expect(w.mode.over).toBe(false);
    const hostiles = [...w.soldiers.values()].filter((s) => s.alive && s.team !== 0);
    expect(hostiles.length).toBe(0);
  });
});
