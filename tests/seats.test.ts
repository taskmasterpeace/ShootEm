// ---------------------------------------------------------------------------
// W5.6 — SEAT-YIELD + PER-HATCH ENTRY. A full hull makes room for a HUMAN
// (the rear-most bot steps out; the wheel yields last), and a human's seat
// follows the hatch they walked to: the NOSE takes the wheel, the TAIL takes
// a bench. Bots keep the classic first-free pick — a convoy needs drivers.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

function hull(w: World, kind = 'buggy' as const) {
  const v = w.spawnVehicle(kind, 0, { x: 0, y: 0, z: 0 });
  v.alive = true; v.yaw = 0; // nose faces +x
  return v;
}
const walker = (w: World, kind: 'human' | 'bot', x: number, z = 0) => {
  const s = w.addSoldier(kind === 'human' ? 'H' : 'B', 'infantry', 0, kind);
  s.alive = true; s.pos = { x, y: 0, z };
  return s;
};

describe('W5.6 — seats: the hatch you walked to, the bot that yields', () => {
  it('a human at the NOSE takes the wheel; at the TAIL takes the bench', () => {
    const w1 = quiet(); const v1 = hull(w1);
    const nose = walker(w1, 'human', 2.5);       // ahead of the hull (+x)
    w1.tryEnterVehicle(nose);
    expect(nose.seat, 'nose hatch = the wheel').toBe(0);

    const w2 = quiet(); const v2 = hull(w2);
    const tail = walker(w2, 'human', -2.5);      // behind the hull
    w2.tryEnterVehicle(tail);
    expect(tail.seat, 'tail hatch = the bench').toBe(1);
    expect(v2.seats[0], 'the wheel stays open').toBe(-1);
    expect(v1.seats[0]).toBe(nose.id);
  });

  it('a FULL hull yields: the rear-most bot steps out for a human', () => {
    const w = quiet(); const v = hull(w);
    const b0 = walker(w, 'bot', 2); w.tryEnterVehicle(b0);
    const b1 = walker(w, 'bot', 2); w.tryEnterVehicle(b1);
    expect(v.seats.indexOf(-1), 'hull is full of bots').toBe(-1);
    const h = walker(w, 'human', -2.5);
    w.tryEnterVehicle(h);
    expect(h.vehicleId, 'the human is aboard').toBe(v.id);
    expect(b1.vehicleId, 'the bench bot stepped out').toBe(-1);
    expect(b0.vehicleId, 'the bot driver kept the wheel').toBe(v.id);
  });

  it('the wheel yields LAST — a lone bot driver gives it up', () => {
    const w = quiet(); const v = hull(w);
    const b = walker(w, 'bot', 2); w.tryEnterVehicle(b);
    const h1 = walker(w, 'human', -2.5); w.tryEnterVehicle(h1); // bench, no yield needed
    expect(v.seats.indexOf(-1), 'now full: bot wheel + human bench').toBe(-1);
    const h2 = walker(w, 'human', 2.5);
    w.tryEnterVehicle(h2);
    expect(b.vehicleId, 'the bot driver yielded the wheel').toBe(-1);
    expect(h2.vehicleId).toBe(v.id);
    expect(h1.vehicleId, 'the seated human was never touched').toBe(v.id);
  });

  it('bots keep the classic pick — a tail approach still takes the wheel', () => {
    const w = quiet(); const v = hull(w);
    const b = walker(w, 'bot', -2.5); // behind the hull
    w.tryEnterVehicle(b);
    expect(b.seat, 'a convoy needs drivers').toBe(0);
    expect(v.seats[0]).toBe(b.id);
  });
});
