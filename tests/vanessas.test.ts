// ---------------------------------------------------------------------------
// VANESSA'S PAINTBALL — the shop stays honest.
// The stock ledger (vanessas-stock.ts) must cover the WHOLE marker shelf:
// a new marker in the arsenal without a booth is a failing test, so the shop
// grows when the arsenal does. Cards read stats live off WEAPONS — never a
// hand-copied number.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { STOCK, boothStats } from '../src/client/vanessas-stock';
import { WEAPONS } from '../src/sim/data';

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
