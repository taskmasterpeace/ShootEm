// ---------------------------------------------------------------------------
// THE SANCTUARY LAW (VERTICAL-WAR, B2 — Robert: "I want to be away from the
// projectiles… that's the root problem with flight"). Altitude is REAL now:
// bands 2-3 can only be touched by air-scaled ordnance (SAMs, MANPADS, guns
// fired from aircraft). A ground rifle cannot clip a high bomber, and a
// street frag doesn't wound the sky. Band ≤1 stays fair game for everything.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import type { Vehicle } from '../src/sim/types';
import { World } from '../src/sim/world';

/** A PILOTED jet holding the given band, dead ahead of the shooter. (A
 *  pilotless hull correctly drops to band 0 — world.ts's parked rule — so the
 *  rig seats a pilot and freezes drive speed to keep the geometry still.) */
function rig(band: number) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
  w.vehicleSpeedMul = 0; // hold position — this law is about ALTITUDE, not aim
  const jet = w.spawnVehicle('strikejet', 1, { x: 16, y: 0, z: 0 });
  const pilot = w.addSoldier('Pilot', 'infantry', 1, 'human');
  pilot.vehicleId = jet.id; pilot.seat = 0; jet.seats[0] = pilot.id;
  jet.band = band;
  jet.spoolUntil = 0;
  const man = w.addSoldier('AA', 'infantry', 0, 'human');
  man.pos = { x: 0, y: 0, z: 0 };
  man.yaw = 0; // aiming straight down the +X line at the hull
  return { w, jet, man };
}

function fireAt(w: World, man: ReturnType<World['addSoldier']>, jet: Vehicle) {
  const hp0 = jet.hp;
  for (let i = 0; i < 90 && jet.hp === hp0; i++) {
    w.step(1 / 60, new Map([[man.id, {
      moveX: 0, moveZ: 0, aimYaw: 0, aimDist: 16, fire: true, altFire: false,
      jump: false, use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
    }]]));
    w.takeEvents();
  }
  return hp0 - jet.hp;
}

describe('THE SANCTUARY LAW — the high sky is out of small-arms reach', () => {
  it('a rifle cannot touch a band-3 aircraft', () => {
    const { w, jet, man } = rig(3);
    expect(fireAt(w, man, jet)).toBe(0); // every round passes under the sanctuary
  });

  it('a rifle still shreds a band-1 skimmer (low traffic stays fair game)', () => {
    const { w, jet, man } = rig(1);
    expect(fireAt(w, man, jet)).toBeGreaterThan(0);
  });

  it('air-scaled ordnance reaches the sanctuary — the SAM answer stands', () => {
    const { w, jet, man } = rig(3);
    const hp0 = jet.hp;
    // an air-scaled round placed ON the hull: the ONLY difference from a ground
    // rifle is the airScaled flag — so a hit here proves the sanctuary lets
    // SAM-class ordnance through while (test 1) it stops small arms.
    w.launch({
      id: w.id(), weapon: 'sam_missile', ownerId: man.id, team: 0,
      pos: { x: jet.pos.x, y: 1, z: jet.pos.z },
      vel: { x: 4, y: 0, z: 0 },
      bornAt: w.time, ttl: 2, arc: false, airScaled: true,
    });
    w.step(1 / 60, new Map()); w.takeEvents();
    expect(jet.hp).toBeLessThan(hp0);
  });

  it('a street frag does not wound the sky — splash stops at band 1', () => {
    const { w, jet } = rig(2);
    const hp0 = jet.hp;
    w.explode({ x: jet.pos.x, y: 0, z: jet.pos.z }, WEAPONS.gl, -1, 0);
    expect(jet.hp).toBe(hp0); // the blast went off in the street below it
  });
});
