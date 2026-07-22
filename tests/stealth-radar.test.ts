// ---------------------------------------------------------------------------
// STEALTH RADAR SUPPRESSION (mountain warfare) — the Reaper "avoids the radar":
// a low-signature airframe stays off enemy radar tracks past visual range until
// it fires. Robert: "not on the radar until the ground erupts."
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { STEALTH_VISUAL_RANGE } from '../src/sim/data';
import type { Vehicle, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

function quiet(): World {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  w.soldiers.clear(); w.vehicles.clear();
  return w;
}
function crew(w: World, kind: VehicleKind, team: 0 | 1, x = 0, z = 0): Vehicle {
  const pilot = w.addSoldier(`${kind} pilot`, 'infantry', team, 'human');
  pilot.alive = true;
  const v = w.spawnVehicle(kind, team, { x, y: 0, z });
  v.seats[0] = pilot.id; pilot.vehicleId = v.id; pilot.seat = 0; pilot.enteredVehicleAt = -10; v.spoolUntil = 0;
  v.band = 3; v.systems.ecm = 0;
  return v;
}

describe('stealth radar suppression', () => {
  it('the Reaper is INVISIBLE to radar past visual range — a normal jet is not', () => {
    const w = quiet();
    crew(w, 'interceptor', 0); // team-0 fixed-wing radar (range 500)
    const normal = crew(w, 'strikejet', 1, 200, 0);
    const reaper = crew(w, 'stealthbomber', 1, 200, 40);
    w.stepRadar();
    expect(w.radarTracksFor(0).has(`v:${normal.id}`), 'the normal jet paints').toBe(true);
    expect(w.radarTracksFor(0).has(`v:${reaper.id}`), 'the Reaper is cloaked').toBe(false);
  });

  it('a picket inside visual range DOES paint the Reaper', () => {
    const w = quiet();
    crew(w, 'interceptor', 0);
    const reaper = crew(w, 'stealthbomber', 1, STEALTH_VISUAL_RANGE - 12, 0);
    w.stepRadar();
    expect(w.radarTracksFor(0).has(`v:${reaper.id}`), 'close enough to see').toBe(true);
  });

  it('once it fires (revealed) it paints at full range — the ground erupted', () => {
    const w = quiet();
    crew(w, 'interceptor', 0);
    const reaper = crew(w, 'stealthbomber', 1, 200, 0);
    w.stepRadar();
    expect(w.radarTracksFor(0).has(`v:${reaper.id}`), 'cloaked before the drop').toBe(false);
    w.time = 2; // past the fixed-wing cadence so the next sweep runs
    reaper.revealedUntil = w.time + 4; // the strike lights it up (set on fire in world.ts)
    w.stepRadar();
    expect(w.radarTracksFor(0).has(`v:${reaper.id}`), 'now it paints').toBe(true);
  });
});
