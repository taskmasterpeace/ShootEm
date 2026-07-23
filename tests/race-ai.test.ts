// ---------------------------------------------------------------------------
// THE GRID DRIVES (high-code #4). The race brain was gated on isBoard, so the
// moment cars joined the grid every AI driver reverted to fighting a war
// nobody was having — they sat on the start line looking for targets. Any
// ground machine races now, and the pack is drawn from YOUR class so a car
// race is a car race.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

function grid(kind: VehicleKind) {
  const w = new World({ seed: 7, mode: 'race', botsPerTeam: 0 });
  const track = w.map.raceTrack!;
  const bot = w.addSoldier('AI', 'infantry', 1, 'bot');
  const v = w.spawnVehicle(kind, 1, track.grid[1]);
  v.yaw = track.startYaw;
  bot.pos = { ...track.grid[1] };
  w.forceBoard(bot, v);
  w.mode.countdown = 0;
  return { w, v };
}
const drive = (kind: VehicleKind, secs = 8) => {
  const { w, v } = grid(kind);
  let travelled = 0;
  let last = { x: v.pos.x, z: v.pos.z };
  for (let i = 0; i < 60 * secs; i++) {
    w.step(1 / 60, new Map());
    travelled += Math.hypot(v.pos.x - last.x, v.pos.z - last.z);
    last = { x: v.pos.x, z: v.pos.z };
  }
  return { travelled, speed: Math.hypot(v.vel.x, v.vel.z) };
};

describe('the grid drives', () => {
  it('an AI in a CAR races the circuit', () => {
    const r = drive('musclecar');
    expect(r.travelled, 'the car never left the line').toBeGreaterThan(60);
    expect(r.speed, 'and it is still driving at the end').toBeGreaterThan(6);
  });

  it('an AI in a TRUCK and on a BIKE race too', () => {
    for (const kind of ['racetruck', 'bike'] as VehicleKind[]) {
      const r = drive(kind);
      expect(r.travelled, `${kind} never raced`).toBeGreaterThan(50);
    }
  });

  it('the board still races — the old behaviour is intact', () => {
    const r = drive('vector');
    expect(r.travelled).toBeGreaterThan(60);
  });

  it('a race is deterministic — same seed, same lap', () => {
    const a = drive('musclecar', 5);
    const b = drive('musclecar', 5);
    expect(a.travelled).toBeCloseTo(b.travelled, 6);
  });
});
