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
import { quakeInterval } from '../src/sim/lsw/cataclysm';
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
    r.clip = r.clip.map(() => 0); r.reserve = r.reserve.map(() => 0); // the WHIRLPOOL is on trial — his Hydro-Lance carries knockback now
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
    w.applyCmd(b, cmd({ ability: true }), 1 / 60);
    expect(b.nextLswActiveAt ?? 0, 'a whiff burned the cooldown').toBe(0);
    expect(Math.hypot(b.pos.x - before.x, b.pos.z - before.z), 'a whiff must not blink him around').toBeLessThan(0.1);
  });
});

describe('counterplay — wave 2, fifth batch', () => {
  it('SHADOWSTEP — "shoot the decoy at range": standing OFF the mine never springs it', () => {
    const w = quiet();
    const sh = w.addLsw('shadowstep', 0, { x: 0, y: 0, z: 0 })!; sh.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 12, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.applyCmd(sh, cmd({ ability: true }), 1 / 60); // the mine sits at (0,0)
    sh.nextLswAt = w.time + 999; sh.nextLswActiveAt = w.time + 999;
    sh.clip = sh.clip.map(() => 0); sh.reserve = sh.reserve.map(() => 0);
    const careful = w.addSoldier('C', 'infantry', 1, 'human');
    careful.pos = { x: 6, y: 0, z: 6 }; careful.alive = true; careful.protectedUntil = 0; // kept his distance
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map([[careful.id, cmd()]]));
    expect(careful.hp, 'the departure mine reached a man who never touched it').toBe(100);
  });

  it('SPECTER — "only the real one": popping an IMAGE with one round never hurts the shooter', () => {
    const w = quiet();
    const sp = w.addLsw('specter', 1, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(sp, cmd({ ability: true }), 1 / 60);
    const img = [...w.soldiers.values()].find((d) => d.decoyOf === sp.id)!;
    img.protectedUntil = 0;
    const shooter = w.addSoldier('S', 'infantry', 0, 'human');
    shooter.pos = { x: 30, y: 0, z: 30 }; shooter.alive = true; shooter.protectedUntil = 0;
    w.damageSoldier(img, 1, shooter.id, 'ar606'); // popped at range
    expect(img.alive, 'one round must pop an image').toBe(false);
    expect(shooter.hp, 'popping an image must never be a blast — only the COMMAND is').toBe(100);
  });

  it('PULSE — "dodge the visible wave": beyond the 16u ring, the wave never touches you', () => {
    const w = quiet();
    const p = w.addLsw('pulse', 0, { x: 0, y: 0, z: 0 })!;
    const far = w.addSoldier('F', 'infantry', 1, 'human');
    far.pos = { x: 20, y: 0, z: 0 }; far.alive = true; far.protectedUntil = 0;
    const f0 = far.nextFireAt;
    w.applyCmd(p, cmd({ ability: true }), 1 / 60);
    expect(far.nextFireAt, 'the wave reached past its ring').toBe(f0);
    expect(w.tagged.has(far.id)).toBe(false);
  });
});

describe('counterplay — wave 2, sixth batch', () => {
  it('VENOM — "medics cleanse": the acid takes the plate, never the man behind cover of distance', () => {
    const w = quiet();
    const v = w.addLsw('venom', 0, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    const far = w.addSoldier('F', 'infantry', 1, 'human');
    far.pos = { x: 30, y: 0, z: 0 }; far.alive = true; far.protectedUntil = 0; // out of glob reach
    far.armor = 60;
    w.applyCmd(v, cmd({ ability: true }), 1 / 60);
    expect(far.armor, 'the glob reached past its 22u').toBe(60);
  });

  it('NIGHTMARE — "fight by ear": the blind EXPIRES — 2 seconds, never forever', () => {
    const w = quiet();
    const n = w.addLsw('nightmare', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'bot');
    e.pos = { x: 8, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.applyCmd(n, cmd({ ability: true }), 1 / 60);
    const until = e.blindUntil!;
    expect(until - w.time, 'the blind must be 2s, not a sentence').toBeLessThanOrEqual(2.1);
  });

  it('REAPER — "bait him into the guns": the mark alone deals NO damage — it only prices the hunt', () => {
    const w = quiet();
    const r = w.addLsw('reaper', 1, { x: 0, y: 0, z: 0 })!;
    r.nextLswAt = w.time + 999; // no chain — the mark is on trial
    r.clip = r.clip.map(() => 0); r.reserve = r.reserve.map(() => 0);
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 30, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]])); // the bot marks
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.hp, 'the mark itself must never hurt — being hunted is information, not damage').toBe(100);
  });
});

describe('counterplay — wave 2, seventh batch', () => {
  it('CRUSHER — "bait the charge into a wall": the wall wins and stuns HIM', () => {
    const w = quiet();
    const c = w.addLsw('crusher', 0, { x: 0, y: 0, z: 0 })!; c.yaw = 0;
    const GRID_N = Math.sqrt(w.map.grid.length) | 0; const TILE_U = 300 / GRID_N;
    const tx = Math.floor((4 + 150) / TILE_U), tz = Math.floor((0 + 150) / TILE_U);
    w.map.grid[tz * GRID_N + tx] = 1; // a STRUCTURAL wall in the lane
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 9, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // the bait, behind the wall
    const f0 = c.nextFireAt;
    w.applyCmd(c, cmd({ ability: true }), 1 / 60);
    expect(w.map.grid[tz * GRID_N + tx], 'a structural wall must SURVIVE the charge').toBe(1);
    expect(c.nextFireAt, 'the wall must stun the charger').toBeGreaterThan(f0);
  });

  it('OVERLOAD — "fight him on dirt": no metal near means no trick at all', () => {
    const w = quiet();
    const o = w.addLsw('overload', 1, { x: 0, y: 0, z: 0 })!;
    const GRID_N = Math.sqrt(w.map.grid.length) | 0;
    // scrub any metal within his 2-tile entry reach
    const TILE_U = 300 / GRID_N;
    const stx = Math.floor((0 + 150) / TILE_U), stz = Math.floor((0 + 150) / TILE_U);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const idx = (stz + dz) * GRID_N + (stx + dx);
      if (w.map.grid[idx] === 7) w.map.grid[idx] = 0;
    }
    const before = { ...o.pos };
    o.nextLswAt = w.time + 999; // the CIRCUIT is on trial, not the burst
    w.applyCmd(o, cmd({ ability: true }), 1 / 60);
    expect(Math.hypot(o.pos.x - before.x, o.pos.z - before.z),
      'he traveled without a circuit — dirt must ground him').toBeLessThan(0.1);
  });

  it('STEEL WEAVER — his defense COSTS the map: the wall he wears is gone for everyone', () => {
    const w = quiet();
    const sw = w.addLsw('steelweaver', 0, { x: 0, y: 0, z: 0 })!;
    const GRID_N = Math.sqrt(w.map.grid.length) | 0; const TILE_U = 300 / GRID_N;
    const tx = Math.floor((3 + 150) / TILE_U), tz = Math.floor((0 + 150) / TILE_U);
    w.map.grid[tz * GRID_N + tx] = 7;
    w.applyCmd(sw, cmd({ ability: true }), 1 / 60);
    // the flank he opened is real: the tile is walkable ground now
    expect(w.map.grid[tz * GRID_N + tx]).toBe(0);
  });

  it('PHANTOM — "K9 noses smell him": a dog near the exit blows the strike AND his cover', () => {
    const dogged = (withDog: boolean) => {
      const w = quiet();
      const ph = w.addLsw('phantom', 0, { x: 0, y: 0, z: 0 })!; ph.yaw = 0;
      const GRID_N = Math.sqrt(w.map.grid.length) | 0; const TILE_U = 300 / GRID_N;
      const tz = Math.floor((0 + 150) / TILE_U);
      for (let x = 1.5; x <= 16; x += TILE_U) w.map.grid[tz * GRID_N + Math.floor((x + 150) / TILE_U)] = 0;
      w.map.grid[tz * GRID_N + Math.floor((3 + 150) / TILE_U)] = 1; // the wall
      const e = w.addSoldier('E', 'infantry', 1, 'human');
      e.pos = { x: 7, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
      if (withDog) {
        const handler = w.addSoldier('H', 'infantry', 1, 'human');
        handler.pos = { x: 9, y: 0, z: 2 }; handler.alive = true;
        const dog = w.addDog(handler);
        dog.pos = { x: 9, y: 0, z: 2 }; dog.alive = true;
      }
      const hp0 = e.hp;
      w.applyCmd(ph, cmd({ ability: true }), 1 / 60);
      return { moved: ph.pos.x > 4, struck: e.hp < hp0, blown: ph.cloaked === false };
    };
    const noNose = dogged(false);
    expect(noNose.struck, 'without a nose the strike lands').toBe(true);
    const nosed = dogged(true);
    expect(nosed.moved, 'the phase itself still happens — the dog makes it expensive').toBe(true);
    expect(nosed.struck, 'the K9 must BLOW the strike').toBe(false);
    expect(nosed.blown, 'and his cover with it').toBe(true);
  });

  it('INFERNO — "SAMs, MANPADS, small arms": aloft the tube owns him, low the rifles do', () => {
    const w = quiet();
    const f = w.addLsw('inferno', 0, { x: 24, y: 0, z: 0 })!;
    f.nextLswAt = 1e9; f.pos.y = 5.2; f.flightAlt = 5.2;
    const aa = w.addSoldier('AA', 'heavy', 1, 'human');
    aa.pos = { x: 0, y: 0, z: 0 }; aa.alive = true; aa.yaw = 0;
    const lock = w.samLockTarget(aa);
    expect(lock, 'MANPADS must lock the flier').toBeTruthy();
    const hp0 = f.hp;
    w.fireSamMissile(aa, lock!);
    for (let i = 0; i < 300 && f.hp === hp0; i++) w.step(1 / 60, new Map());
    expect(f.hp, 'the sky is not sanctuary — AA is the answer').toBeLessThan(hp0);
  });

  it('STORMCALLER — "fight indoors": eaves block bolts, the open sky does not', () => {
    const w = quiet();
    const sc = w.addLsw('stormcaller', 0, { x: 0, y: 0, z: 0 })!;
    sc.nextLswAt = 1e9;
    sc.clip = sc.clip.map(() => 0); sc.reserve = sc.reserve.map(() => 0); // the BOLTS are on trial, not her rifle
    sc.grenades = 0; sc.smokes = 0; sc.firebombs = 0; // and not her frag bag either
    w.forceFields.push({ x: 90, z: 90, r: 7, radial: -26, team: 0, ownerId: sc.id, until: w.time + 60 }); // Q → storm
    const GRID_N = Math.sqrt(w.map.grid.length) | 0; const TILE_U = 300 / GRID_N;
    for (let z = 12; z <= 28; z += TILE_U) for (let x = 12; x <= 28; x += TILE_U) {
      w.map.grid[Math.floor((z + 150) / TILE_U) * GRID_N + Math.floor((x + 150) / TILE_U)] = 0;
    }
    // one wall tile: the eave the smart soldier hugs
    const wtx = Math.floor((24 + 150) / TILE_U), wtz = Math.floor((20 + 150) / TILE_U);
    w.map.grid[wtz * GRID_N + wtx] = 1;
    const open = w.addSoldier('E', 'infantry', 1, 'human');
    open.pos = { x: 20, y: 0, z: 20 }; open.alive = true; open.protectedUntil = 0;
    const hugger = w.addSoldier('H', 'infantry', 1, 'human');
    hugger.pos = { x: 24 - TILE_U, y: 0, z: 20 }; hugger.alive = true; hugger.protectedUntil = 0; // beside the wall
    w.applyCmd(sc, cmd({ ability: true }), 1 / 60);
    let openStruck = false, huggerStruck = false;
    for (let i = 0; i < 60 * 9; i++) {
      const hh = hugger.hp;
      w.step(1 / 60, new Map());
      if (open.hp < open.maxHp) { openStruck = true; open.hp = open.maxHp; open.alive = true; }
      if (hugger.hp < hh) huggerStruck = true;
      hugger.hp = hugger.maxHp; hugger.alive = true;
    }
    expect(openStruck, 'the open sky must strike').toBe(true);
    expect(huggerStruck, 'the eave must shelter — fight indoors is real').toBe(false);
  });

  it('GARGOYLE — "collapse the perch": stone takes half until the tile goes', () => {
    const w = quiet();
    const g = w.addLsw('gargoyle', 1, { x: 0, y: 0, z: 0 })!;
    g.nextLswAt = 1e9;
    const GRID_N = Math.sqrt(w.map.grid.length) | 0; const TILE_U = 300 / GRID_N;
    const ptx = Math.floor((3 + 150) / TILE_U), ptz = Math.floor((0 + 150) / TILE_U);
    w.map.grid[ptz * GRID_N + ptx] = 1; // his masonry
    w.applyCmd(g, cmd({ ability: true }), 1 / 60); // no prey in reach → he PERCHES
    expect(g.perchTile, 'he must take the perch').toBeDefined();
    const hpA = g.hp;
    w.damageSoldier(g, 100, -1, 'ar606');
    expect(hpA - g.hp, 'perched stone takes HALF').toBeCloseTo(50, 0);
    // the counter: bring the masonry down
    w.damageWall(ptx, ptz, 99999, true);
    w.step(1 / 60, new Map());
    expect(g.perchTile, 'tile gone — bird down').toBeUndefined();
    const hpB = g.hp;
    w.damageSoldier(g, 100, -1, 'ar606');
    expect(hpB - g.hp, 'grounded he pays FULL price').toBeCloseTo(100, 0);
  });

  it('LEVIATHAN — "scatter from the shadow": the rim spares whoever MOVED', () => {
    const w = quiet();
    const lv = w.addLsw('leviathan', 1, { x: 0, y: 0, z: 0 })!;
    lv.nextLswAt = 1e9;
    lv.clip = lv.clip.map(() => 0); lv.reserve = lv.reserve.map(() => 0);
    const stander = w.addSoldier('S', 'infantry', 0, 'human');
    stander.pos = { x: 30, y: 0, z: 0 }; stander.alive = true; stander.protectedUntil = 0;
    const runner = w.addSoldier('R', 'infantry', 0, 'human');
    runner.pos = { x: 30, y: 0, z: 2 }; runner.alive = true; runner.protectedUntil = 0;
    w.applyCmd(lv, cmd({ ability: true }), 1 / 60); // the shadow falls on the pair
    runner.pos = { x: 30, y: 0, z: 14 }; // he READ it and scattered
    const s0 = stander.hp, r0 = runner.hp;
    for (let i = 0; i < 100; i++) { runner.pos = { x: 30, y: 0, z: 14 }; w.step(1 / 60, new Map()); }
    expect(stander.hp, 'the stander eats the flop').toBeLessThan(s0);
    expect(runner.hp, 'the scatter is the counter — the shadow gave him the time').toBe(r0);
  });

  it('CATACLYSM — "all-in focus": stalling multiplies the quakes you must survive', () => {
    // the DPS check in numbers: a 20s kill endures ~3 quakes; a 90s stall
    // endures ~19 — the interval law makes stalling the losing play
    let t = 0, fast = 0;
    while (t < 20) { t += quakeInterval(t); fast++; }
    let t2 = 0, slow = 0;
    while (t2 < 90) { t2 += quakeInterval(t2); slow++; }
    expect(fast, 'a focused kill endures a handful').toBeLessThanOrEqual(5);
    expect(slow, 'a stall endures a bombardment').toBeGreaterThanOrEqual(15);
  });
});
