// ---------------------------------------------------------------------------
// COUNTERPLAY, PROVEN (the 9-point bar, criterion 7): "the telegraph→counter
// loop actually beats it." One law per shipped LSW, each citing the roster
// table's own Counterplay column — the documented answer must MECHANICALLY
// defeat the ability, driven through the real sim.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES, WEAPONS } from '../src/sim/data';
import { LSWS } from '../src/sim/lsw';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('counterplay, proven — the doc column holds for every unit', () => {
  it('FIREBRAND — "don\'t stand in paint": off the board, the cash-out misses you', () => {
    const w = quiet();
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[fb.id, cmd({ moveZ: -1 })]])); // paint a trail
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 60, y: 0, z: 60 }; e.alive = true; e.protectedUntil = 0; // OFF the paint
    const hp0 = e.hp;
    w.applyCmd(fb, cmd({ ability: true }), 1 / 60); // cash the board
    expect(e.hp, 'the board reached a man who never stood on it').toBe(hp0);
  });

  it('PLAGUEBEARER — "park it": a PARKED plague wagon lays no trail', () => {
    const w = quiet();
    const v = w.spawnVehicle('tank', 0, { x: 6, y: 0, z: 0 });
    v.infectedUntil = w.time + 60; v.infectedTeam = 1;
    v.vel = { x: 0, y: 0, z: 0 }; // parked — the crew chose right
    const before = [...w.gadgets.values()].length;
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map());
    expect([...w.gadgets.values()].length, 'a parked wagon trailed poison').toBe(before);
  });

  it('FROSTBITE — "squadmates shatter you free": instant, and at NO cost', () => {
    const w = quiet();
    const s = w.addSoldier('V', 'infantry', 1, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
    const mate = w.addSoldier('M', 'infantry', 1, 'human');
    w.encaseSoldier(s);
    const hp0 = s.hp;
    w.damageSoldier(s, 10, mate.id, 'ar606');
    expect(s.encasedUntil, 'the shatter failed').toBeUndefined();
    expect(s.hp, 'the rescue cost the frozen man').toBe(hp0);
  });

  it('RAGEBEAST — "starve the rage": at full HP there is no flesh to hurl and no fury', () => {
    const w = quiet();
    const rb = w.addLsw('ragebeast', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 20, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'flesh_glob'),
      'a healthy beast hurled flesh — the starve counter is dead').toBe(false);
    expect(rb.rageMul ?? 1, 'a healthy beast was raging').toBeLessThan(1.05);
  });

  it('TITAN — "kite him — he\'s slow": every line class outruns him', () => {
    expect(LSWS.titan.speed, 'Titan outruns the men he grabs — the kite is a lie')
      .toBeLessThan(CLASSES.infantry.speed);
  });

  it('VOLT STRIKER — "spread out": an isolated man eats ONE bolt, never the chain', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    const near = w.addSoldier('N', 'infantry', 1, 'human');
    near.pos = { x: 8, y: 0, z: 0 }; near.alive = true; near.protectedUntil = 0;
    const far = w.addSoldier('F', 'infantry', 1, 'human');
    far.pos = { x: 8, y: 0, z: 30 }; far.alive = true; far.protectedUntil = 0; // beyond arc range
    const farHp = far.hp;
    w.applyCmd(vs, cmd({ ability: true }), 1 / 60);
    expect(near.hp, 'the first bolt must land').toBeLessThan(100);
    expect(far.hp, 'the chain reached a man who spread out').toBe(farHp);
  });

  it('SNIPERHAWK — "off the line": a step of lateral spacing beats the rail', () => {
    const w = quiet();
    const sh = w.addLsw('sniperhawk', 0, { x: 0, y: 0, z: 0 })!;
    sh.yaw = 0;
    const off = w.addSoldier('OFF', 'infantry', 1, 'human');
    off.pos = { x: 12, y: 0, z: 4 }; off.alive = true; off.protectedUntil = 0; // 4u off the line
    const hp0 = off.hp;
    w.applyCmd(sh, cmd({ ability: true }), 1 / 60);
    expect(off.hp, 'the rail bent to find him').toBe(hp0);
  });

  it('BARRIER — "lob over the top": a high arc clears the reflect wall', () => {
    const w = quiet();
    const b = w.addLsw('barrier', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    w.applyCmd(b, cmd({ ability: true }), 1 / 60); // young wall at ~(3,0,0)
    w.projectiles.set(9101, {
      id: 9101, weapon: 'gl', ownerId: 500, team: 1,
      pos: { x: 1.6, y: 5.2, z: 0 }, vel: { x: 30, y: 0, z: 0 }, // OVER the dome
      bornAt: w.time, ttl: 3, arc: true,
    });
    w.step(1 / 60, new Map());
    const p = w.projectiles.get(9101);
    expect(p, 'the lob was eaten').toBeTruthy();
    expect(p!.vel.x, 'the lob was reflected — over-the-top must pass').toBeGreaterThan(0);
    expect(p!.team, 'the lob was re-teamed').toBe(1);
  });

  it('REACTOR — "kill the battery first": the overcharge he hands out EXPIRES', () => {
    const w = quiet();
    const r = w.addLsw('reactor', 0, { x: 0, y: 0, z: 0 })!;
    const ally = w.addSoldier('A', 'infantry', 0, 'bot');
    ally.pos = { x: 3, y: 0, z: 0 }; ally.alive = true;
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    r.nextLswAt = w.time + 999; r.nextLswActiveAt = w.time + 999; // the battery is silenced
    ally.overchargeUntil = w.time - 1;
    w.step(1 / 60, new Map());
    expect(ally.rageMul ?? 1, 'the buff outlived the battery\'s silence').toBe(1);
  });

  it('OBLIVION — "sprint ACROSS the pull": tangential legs beat the hole; standing still does not', () => {
    const runFight = (tangential: boolean) => {
      const w = quiet();
      const o = w.addLsw('oblivion', 1, { x: 0, y: 0, z: 0 })!; o.yaw = 0; // hole at (8,0)
      o.clip = o.clip.map(() => 0); o.reserve = o.reserve.map(() => 0); // the ABILITY is on trial, not his rifle
      const e = w.addSoldier('E', 'infantry', 0, 'human');
      e.pos = { x: 8, y: 0, z: 6 }; e.alive = true; e.protectedUntil = 0;
      w.applyCmd(o, cmd({ ability: true }), 1 / 60);
      o.nextLswAt = w.time + 999; o.nextLswActiveAt = w.time + 999; // just the hole, no bolts
      for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[e.id, tangential ? cmd({ moveX: 1 }) : cmd()]]));
      return e.hp;
    };
    const still = runFight(false);
    const sprint = runFight(true);
    // the doc's exact sentence: "1.5s telegraph: run tangentially OR DIE"
    expect(still, 'standing in the pull must be death').toBe(0);
    expect(sprint, 'the tangential sprinter must LIVE').toBeGreaterThan(0);
  });

  it('TREMOR — "sidestep the ripple": a strafing man is never spiked', () => {
    const w = quiet();
    const t = w.addLsw('tremor', 1, { x: 0, y: 0, z: 0 })!; t.yaw = 0;
    t.clip = t.clip.map(() => 0); t.reserve = t.reserve.map(() => 0); // the RIPPLE is on trial, not his rifle
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 25, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]])); // the bot sends the ripple down the lane
    expect([...w.projectiles.values()].some((p) => p.weapon === 'soil_spike')).toBe(true);
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[e.id, cmd({ moveZ: 1 })]])); // sidestep
    expect(e.hp, 'the ripple tracked a man who sidestepped').toBeGreaterThan(60);
  });

  it('MAGNETAR — "energy passes clean": a rail crosses the halo untouched', () => {
    const w = quiet();
    const m = w.addLsw('magnetar', 1, { x: 0, y: 0, z: 0 })!;
    m.protectedUntil = 0;
    expect(WEAPONS.rg2.tracer).toBe('rail'); // the premise: the counter-pick is energy
    w.projectiles.set(9102, {
      id: 9102, weapon: 'rg2', ownerId: 500, team: 0,
      pos: { x: 3.5, y: 1.2, z: 0 }, vel: { x: -60, y: 0, z: 0 },
      bornAt: w.time, ttl: 2, arc: false,
    });
    const hp0 = m.hp;
    for (let i = 0; i < 10; i++) w.step(1 / 60, new Map());
    expect(m.hp, 'the rail was eaten — the counter-pick is dead').toBeLessThan(hp0);
  });

  it('WRAITH — "EMP evicts him instantly": the machine comes home on the burst', () => {
    const w = quiet();
    const ghost = w.addSoldier('G', 'infantry', 1, 'human');
    const t = { id: 9103, team: 0 as const, pos: { x: 4, y: 0, z: 0 }, yaw: 0, hp: 100, maxHp: 100, nextFireAt: 0, ownerId: -1, alive: true };
    w.turrets.set(t.id, t);
    w.possessMachine(t, ghost, 60);
    w.empBlast({ x: 4, y: 0, z: 0 }, 0, -1);
    expect(t.team, 'the EMP did not evict the ghost').toBe(0);
  });

  it('ECLIPSE — the dark is answerable: an LSW LOOMS through smoke while a trooper hides', () => {
    const w = quiet();
    const ec = w.addLsw('eclipse', 1, { x: 0, y: 0, z: 0 })!;
    const trooper = w.addSoldier('T', 'infantry', 1, 'bot');
    trooper.pos = { x: 1, y: 0, z: 1 }; trooper.alive = true;
    w.applyCmd(ec, cmd({ ability: true }), 1 / 60); // the dome blooms over both
    for (let i = 0; i < 5; i++) w.step(1 / 60, new Map());
    expect(w.smoked.has(trooper.id), 'the trooper should vanish in the dome').toBe(true);
    expect(w.smoked.has(ec.id), 'the monster hid in her own dark — immortality returns').toBe(false);
  });

  it('DOMINATOR — "scatter beyond thread range": two spread men cannot be bound', () => {
    const w = quiet();
    const d = w.addLsw('dominator', 1, { x: 0, y: 0, z: 0 })!;
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { x: 10, y: 0, z: 0 }; a.alive = true; a.protectedUntil = 0;
    const b = w.addSoldier('B', 'infantry', 0, 'human');
    b.pos = { x: 60, y: 0, z: 60 }; b.alive = true; b.protectedUntil = 0; // scattered
    w.applyCmd(d, cmd({ ability: true }), 1 / 60); // Q: no cluster → the lance, never the link
    expect(a.psiLinkId, 'a scattered pair was bound anyway').toBeUndefined();
    expect(b.psiLinkId).toBeUndefined();
  });
});

describe('counterplay — wave 2 rows', () => {
  it('RIPTIDE — "leave the painted circle early": outside the circle, the pull never touches you', () => {
    const w = quiet();
    const r = w.addLsw('riptide', 0, { x: 0, y: 0, z: 0 })!; r.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 30, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // left early — 20u past the eye
    r.nextLswAt = w.time + 999; r.nextLswActiveAt = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    e.pushX = 0; e.pushZ = 0;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(Math.abs(e.pushX) + Math.abs(e.pushZ), 'the whirlpool reached a man who left the circle').toBe(0);
  });
});

describe('counterplay — wave 2, the controllers', () => {
  it('GRAVITY WARDEN — "kill him mid-channel": his death drops nobody else — the float ENDS on schedule regardless', () => {
    const w = quiet();
    const g = w.addLsw('gravwarden', 0, { x: 0, y: 0, z: 0 })!;
    g.protectedUntil = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.applyCmd(g, cmd({ ability: true }), 1 / 60);
    expect(e.liftedUntil).toBeGreaterThan(w.time);
    w.damageSoldier(g, 99999, -1, 'ar606'); // killed mid-channel
    expect(g.alive).toBe(false);
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.liftedUntil, 'the float outlived its window').toBeUndefined();
    expect(e.alive, 'the drop killed him — the counter must END the threat, not trade for it').toBe(true);
  });

  it('CHRONOS — "camp the glow": the echo point is EXACTLY where he returns, and the glow never lies', () => {
    const w = quiet();
    const c = w.addLsw('chronos', 1, { x: 0, y: 0, z: 0 })!;
    c.protectedUntil = 0;
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[c.id, cmd({ moveX: 1 })]]));
    const advertised = { ...c.lswTrail![0] }; // where the glow burns — the camper's spot
    w.damageSoldier(c, 99999, -1, 'ar606');
    expect(c.alive).toBe(true);
    expect(Math.hypot(c.pos.x - advertised.x, c.pos.z - advertised.z),
      'he returned somewhere the glow never advertised — camping would be a lie').toBeLessThan(1);
    // the camper's payoff: he arrives at a sliver — one burst finishes it
    expect(c.hp, 'the echo must return him NEARLY dead').toBeLessThan(c.maxHp * 0.2);
  });
});

describe('counterplay — the trapper', () => {
  it('VENATRIX — "spot the glint": stepping AROUND the trap never springs it', () => {
    const w = quiet();
    const v = w.addLsw('venatrix', 1, { x: 0, y: 0, z: 0 })!;
    v.nextLswAt = w.time + 999; v.nextLswActiveAt = w.time + 999; // no reeling — the TRAP is on trial
    v.clip = v.clip.map(() => 0); v.reserve = v.reserve.map(() => 0);
    w.spawnGadget('snap_trap', 1, v.id, { x: 6, y: 0, z: 0 }, 30, 90);
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 6, y: 0, z: 2.5 }; e.alive = true; e.protectedUntil = 0; // saw the glint, gave it a wide berth
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[e.id, cmd({ moveX: 1 })]]));
    expect(e.encasedUntil, 'the trap reached a man who walked around it').toBeUndefined();
    expect([...w.gadgets.values()].some((g) => g.type === 'snap_trap'), 'the trap must still be armed').toBe(true);
  });
});

describe('counterplay — wave 2, third batch', () => {
  it('VANGUARD — "flanks": a man BEHIND the shield is untouched by the bash', () => {
    const w = quiet();
    const v = w.addLsw('vanguard', 0, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    const flanker = w.addSoldier('F', 'infantry', 1, 'human');
    flanker.pos = { x: -4, y: 0, z: 0 }; flanker.alive = true; flanker.protectedUntil = 0;
    const hp0 = flanker.hp;
    w.applyCmd(v, cmd({ ability: true }), 1 / 60);
    expect(flanker.hp, 'the bash hit a man behind the shield').toBe(hp0);
  });

  it('PYROCLASM — "range the threshold": poking him to 26% never triggers the burst', () => {
    const w = quiet();
    const p = w.addLsw('pyroclasm', 1, { x: 0, y: 0, z: 0 })!;
    p.protectedUntil = 0;
    w.damageSoldier(p, p.maxHp * 0.74, -1, 'ar606'); // 26% — a hair above the line
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(p.lswFlagA ?? false, 'he erupted above the quarter — ranging the threshold is dead').toBe(false);
  });

  it('VOIDWALKER — "hold ground; don\'t follow": the chaser eats the shadow, the holder never does', () => {
    const runFight = (chase: boolean) => {
      const w = quiet();
      const vw = w.addLsw('voidwalker', 1, { x: 0, y: 0, z: 0 })!; vw.yaw = 0;
      vw.clip = vw.clip.map(() => 0); vw.reserve = vw.reserve.map(() => 0); // the SHADOW is on trial
      const e = w.addSoldier('E', 'infantry', 0, 'human');
      e.pos = { x: 15, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
      w.applyCmd(vw, cmd({ ability: true }), 1 / 60); // he blinks; the shadow sits at (0,0)
      vw.nextLswAt = w.time + 999; vw.nextLswActiveAt = w.time + 999;
      const mate = w.addSoldier('M', 'infantry', 0, 'human');
      mate.pos = chase ? { x: 0.5, y: 0, z: 0 } : { x: 20, y: 0, z: 20 }; // AT the shadow, or holding ground
      mate.alive = true; mate.protectedUntil = 0;
      for (let i = 0; i < 90; i++) w.step(1 / 60, new Map([[mate.id, cmd()]])); // the 1s fuse runs
      return mate.hp;
    };
    expect(runFight(true), 'the chaser must eat the shadow').toBeLessThan(100);
    expect(runFight(false), 'the holder must never be touched').toBe(100);
  });
});

describe('counterplay — wave 2, fourth batch', () => {
  it('CRIMSON — "burn the pools": a corpse lying in fire can NEVER be drunk', () => {
    const w = quiet();
    const c = w.addLsw('crimson', 1, { x: 0, y: 0, z: 0 })!;
    const v = w.addSoldier('V', 'infantry', 0, 'human');
    v.pos = { x: 4, y: 0, z: 0 }; v.alive = true; v.protectedUntil = 0;
    w.damageSoldier(v, 99999, -1, 'ar606');
    w.spawnGadget('fire_field', 0, -1, { x: 4, y: 0, z: 0 }, Infinity, 5); // the pool burns
    w.applyCmd(c, cmd({ ability: true }), 1 / 60);
    expect([...w.soldiers.values()].some((s) => s.name === 'BLOOD BRUTE'),
      'he drank a burning pool — fire must deny him').toBe(false);
  });

  it('MIRAGE — the senses tell the truth: a decoy dies to any single round', () => {
    const w = quiet();
    const m = w.addLsw('mirage', 0, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(m, cmd({ ability: true }), 1 / 60);
    const d = [...w.soldiers.values()].find((s) => s.decoyOf === m.id)!;
    d.protectedUntil = 0;
    w.damageSoldier(d, 1, -1, 'ar606'); // ONE grazing round
    expect(d.alive, 'an illusion survived a bullet').toBe(false);
  });

  it('BLITZ — "he is paper between dashes": a whiffed dash leaves the key hot but him exposed', () => {
    const w = quiet();
    const b = w.addLsw('blitz', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    // nobody in reach — the dash whiffs, no teleport, no cut
    const before = { ...b.pos };
    const fired = w.applyCmd(b, cmd({ ability: true }), 1 / 60);
    expect(b.nextLswActiveAt ?? 0, 'a whiff burned the cooldown').toBe(0);
    expect(Math.hypot(b.pos.x - before.x, b.pos.z - before.z), 'a whiff must not blink him around').toBeLessThan(0.1);
  });
});
