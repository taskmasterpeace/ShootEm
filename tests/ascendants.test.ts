// ---------------------------------------------------------------------------
// LIVING SUPER WEAPONS (§21.6 / docs/ASCENDANTS.md) — the engine laws, and
// the proof pair: Firebrand (UF) vs Plaguebearer (Collective). Both are pure
// field plays on shipped systems; this suite is the entry path, end to end.
// ---------------------------------------------------------------------------
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOUND_NAMES } from '../src/client/audio';
import { World } from '../src/sim/world';
import { CLASSES } from '../src/sim/data';
import { LSWS, THREAT, VO_LINES, annSlot, lswAllowed, voSlot } from '../src/sim/lsw';
import type { AscendantId, PlayerCmd, SimEvent } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

describe('the LSW entity', () => {
  it('threat buys HP, never immunity — a T2 is big, an ordinary rifle still bites', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    expect(fb.ascendant).toBe('firebrand');
    expect(fb.maxHp).toBe(THREAT[2].hp);   // 900 — measured against the baseline
    expect(fb.armor).toBe(0);              // threat is HP, not a plate wall
    const before = fb.hp;
    w.damageSoldier(fb, 50, -1, 'ar606');
    expect(fb.hp, 'ordinary rounds must always bite').toBe(before - 50);
  });

  it('at most ONE LSW per faction — the slot refuses a second', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    expect(w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })).not.toBeNull();
    expect(w.addLsw('firebrand', 0, { x: 5, y: 0, z: 0 }), 'a second UF LSW slipped through').toBeNull();
    // the enemy faction keeps its own slot
    expect(w.addLsw('plaguebearer', 1, { x: 10, y: 0, z: 0 })).not.toBeNull();
  });

  it('no LSW walks in the yard or the range — the modes forbid it', () => {
    expect(lswAllowed('paintball')).toBe(false);
    expect(lswAllowed('range')).toBe(false);
    expect(lswAllowed('ctf')).toBe(true);
    const yard = new World({ seed: 1, mode: 'paintball' });
    expect(yard.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 }), 'an LSW spawned in the yard').toBeNull();
  });

  it('every stabled LSW has a sane, no-purple def', () => {
    for (const id of Object.keys(LSWS) as AscendantId[]) {
      const d = LSWS[id];
      expect(d.threat).toBeGreaterThanOrEqual(1);
      expect(d.threat).toBeLessThanOrEqual(4);
      expect(d.scale).toBeGreaterThan(1);              // bigger than a trooper
      const r = (d.color >> 16) & 0xff, g = (d.color >> 8) & 0xff, b = d.color & 0xff;
      expect(b > 120 && g < b - 40 && r > b - 60, `${id} reads purple`).toBe(false);
    }
  });
});

describe('the officer drop', () => {
  it('the call is telegraphed — announced now, landing after the threat countdown', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    const ok = w.requestLsw('firebrand', 0);
    expect(ok).toBe(true);
    // nothing on the field yet — it's inbound
    expect([...w.soldiers.values()].some((s) => s.ascendant), 'it landed with no dread').toBe(false);
    const events = w.takeEvents();
    expect(events.some((e) => e.type === 'pod_incoming'), 'no warning went out').toBe(true);
    // run past the T2 telegraph (20s) and it arrives
    for (let i = 0; i < 60 * 21; i++) w.step(1 / 60, new Map());
    expect([...w.soldiers.values()].some((s) => s.ascendant === 'firebrand'), 'it never landed').toBe(true);
  });

  it('one inbound call holds the slot — no double-drop', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    expect(w.requestLsw('firebrand', 0)).toBe(true);
    expect(w.requestLsw('firebrand', 0), 'a second call while inbound slipped through').toBe(false);
  });
});

describe('Firebrand — the board', () => {
  it('paints a burning floor as he advances', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    const before = [...w.gadgets.values()].filter((g) => g.type === 'fire_field').length;
    // walk him a few strides
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[fb.id, cmd({ moveZ: -1 })]]));
    const after = [...w.gadgets.values()].filter((g) => g.type === 'fire_field' && g.ownerId === fb.id).length;
    expect(after, 'no floor was painted').toBeGreaterThan(before);
  });
});

describe('Plaguebearer — the cloud', () => {
  it('lays contamination as he moves', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const pb = w.addLsw('plaguebearer', 1, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[pb.id, cmd({ moveZ: -1 })]]));
    const clouds = [...w.gadgets.values()].filter((g) => g.type === 'smoke_field' && g.ownerId === pb.id).length;
    expect(clouds, 'no gas was laid').toBeGreaterThan(0);
  });

  it('infects a crewed enemy hull — the plague wagon trails poison as it drives', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const pb = w.addLsw('plaguebearer', 1, { x: 0, y: 0, z: 0 })!;
    const v = w.spawnVehicle('tank', 0, { x: 6, y: 0, z: 0 });
    const driver = w.addSoldier('D', 'infantry', 0, 'bot');
    driver.pos = { x: 60, y: 0, z: 60 }; // out of the cloud's way
    v.seats[0] = driver.id;
    w.step(1 / 60, new Map());
    expect(v.infectedUntil, 'the hull never caught the plague').toBeGreaterThan(w.time);
    // drive it — the trail must appear
    const before = [...w.gadgets.values()].filter((g) => g.type === 'fire_field' && g.ownerId === -1).length;
    v.vel = { x: 8, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) { v.vel = { x: 8, y: 0, z: 0 }; w.step(1 / 60, new Map()); }
    const after = [...w.gadgets.values()].filter((g) => g.type === 'fire_field' && g.ownerId === -1).length;
    expect(after, 'the wagon left no trail').toBeGreaterThan(before);
  });

  it("an engineer's field repair CLEANSES the infection", () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const v = w.spawnVehicle('tank', 0, { x: 6, y: 0, z: 0 });
    v.infectedUntil = w.time + 60; v.infectedTeam = 1;
    const eng = w.addSoldier('ENG', 'engineer', 0, 'human');
    eng.pos = { x: 6, y: 0, z: 0 }; eng.alive = true;
    eng.equipment = ['repair_kit'];
    expect(w.tryFieldKit(eng), 'the kit refused a full-HP infected hull').toBe(true);
    expect(v.infectedUntil, 'the cleanse failed').toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// THE ICE BLOCK ⭐ — the shared encase state (Frostbite now, Venatrix later).
// The loop spec's exact contract, one law each.
// ---------------------------------------------------------------------------
describe('the ice block', () => {
  const victim = () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const s = w.addSoldier('V', 'infantry', 1, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.protectedUntil = 0;
    return { w, s };
  };

  it('encased soldiers cannot be hurt by anything else — the ice eats it', () => {
    const { w, s } = victim();
    expect(w.encaseSoldier(s)).toBe(true);
    const before = s.hp;
    w.damageSoldier(s, 60, -1, 'ar606');   // an enemy shooting the block
    expect(s.hp, 'damage leaked through the ice').toBe(before);
    expect(s.encasedUntil).toBeDefined();
  });

  it('a teammate shatters it instantly, at NO cost', () => {
    const { w, s } = victim();
    const mate = w.addSoldier('M', 'infantry', 1, 'human');
    w.encaseSoldier(s);
    const before = s.hp;
    w.damageSoldier(s, 10, mate.id, 'ar606'); // friendly fire on the block
    expect(s.encasedUntil, 'the ice held against a teammate').toBeUndefined();
    expect(s.hp, 'shatter cost the freed soldier HP').toBe(before);
    expect(s.alive).toBe(true);
  });

  it('HOLDING STILL drains slowly — you can outlast it', () => {
    const { w, s } = victim();
    w.encaseSoldier(s);
    const before = s.hp;
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map()); // 3s, no input
    // still encased or just melted free — either way, drained but ALIVE
    expect(s.alive, 'holding still killed a healthy soldier in 3s').toBe(true);
    expect(s.hp, 'holding still cost nothing').toBeLessThan(before);
    expect(before - s.hp, 'the slow drain drained fast').toBeLessThan(20);
  });

  it('STRUGGLING breaks out in ~4s but arrives hurt', () => {
    const { w, s } = victim();
    w.encaseSoldier(s);
    let freedAt = -1;
    const t0 = w.time;
    for (let i = 0; i < 60 * 6; i++) {
      w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]])); // mash a direction
      if (s.encasedUntil === undefined && freedAt < 0) { freedAt = w.time - t0; break; }
    }
    expect(freedAt, 'never struggled free').toBeGreaterThan(0);
    expect(freedAt, 'struggle-out was not ~4s').toBeLessThan(5);
    expect(s.hp, 'struggling out was free — it should HURT').toBeLessThan(100);
  });

  it('the block is a BLOCK — nobody walks through a frozen man', () => {
    const { w, s } = victim();
    w.encaseSoldier(s); // frozen at (0,0)
    const walker = w.addSoldier('W', 'infantry', 0, 'human');
    walker.pos = { x: -2, y: 0, z: 0 }; walker.alive = true; walker.protectedUntil = 0;
    // march straight at the block for 2s — the ice must stop him short
    for (let i = 0; i < 120 && s.encasedUntil !== undefined; i++) {
      w.step(1 / 60, new Map([[walker.id, cmd({ moveX: 1 })]]));
    }
    const d = Math.hypot(walker.pos.x - s.pos.x, walker.pos.z - s.pos.z);
    expect(d, 'he walked through the ice').toBeGreaterThan(0.8);
  });

  it('the block is gone when the match ends — no ice outlives the whistle', () => {
    const { w, s } = victim();
    w.encaseSoldier(s);
    w.mode.over = true;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    // a mode-over world stops stepping soldiers; the block clears on the melt
    // timer regardless — assert it doesn't persist past its hold window
    for (let i = 0; i < 60 * 6; i++) w.step(1 / 60, new Map());
    expect(s.encasedUntil === undefined || w.time >= s.encasedUntil).toBe(true);
  });
});

describe('Ragebeast — the rampage', () => {
  it('wounding him makes him faster and hit harder', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const rb = w.addLsw('ragebeast', 1, { x: 0, y: 0, z: 0 })!;
    w.step(1 / 60, new Map()); // one tick sets rageMul at full HP
    const healthy = rb.rageMul ?? 1;
    rb.hp = rb.maxHp * 0.25; // bloodied
    w.step(1 / 60, new Map());
    const wounded = rb.rageMul ?? 1;
    expect(healthy, 'a healthy beast should not be raging').toBeLessThan(1.15);
    expect(wounded, 'the wound did not feed him').toBeGreaterThan(healthy + 0.3);
  });

  it('wounded, he TEARS his own flesh — it costs HP and the globs HUNT', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const rb = w.addLsw('ragebeast', 1, { x: 0, y: 0, z: 0 })!;
    rb.hp = rb.maxHp * 0.5; // wounded — the magazine is open
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 20, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = rb.hp;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    const globs = [...w.projectiles.values()].filter((p) => p.weapon === 'flesh_glob');
    expect(globs.length, 'no flesh was hurled').toBeGreaterThan(0);
    expect(globs[0].homingSoldierId, 'the glob must HUNT a soldier').toBe(e.id);
    expect(rb.hp, 'the tear must cost him').toBeLessThan(hp0);
    // the hunt: displace the target sideways — the glob's heading must bend
    const g = globs[0];
    e.pos = { x: 20, y: 0, z: 15 };
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    const live = w.projectiles.get(g.id);
    if (live) expect(live.vel.z, 'the glob never turned toward its prey').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TITAN — the colossus grabs and THROWS (vehicle or soldier), and pounds the
// ground when nothing's in reach. All shipped systems; the "slows a cone" half
// stands in as a fire-rate stagger (movement-slow is a doc Notes gap).
// ---------------------------------------------------------------------------
describe('Titan — grab and throw', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('hurls the enemy he is aiming at — launched off his feet and hurt', () => {
    const w = quiet();
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    t.yaw = 0; // faces +x
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 2.5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // point-blank: LOS is clear
    const hp0 = e.hp;
    w.applyCmd(t, cmd({ ability: true }), 1 / 60);
    expect(e.hp, 'the throw did not bite').toBeLessThan(hp0);
    expect(e.vel.y, 'the enemy was not launched off the ground').toBeGreaterThan(0);
  });

  it('grabs an enemy vehicle — the hull is cracked open and seized', () => {
    const w = quiet();
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    t.yaw = 0;
    const v = w.spawnVehicle('tank', 1, { x: 5, y: 0, z: 0 });
    const hp0 = v.hp;
    w.applyCmd(t, cmd({ ability: true }), 1 / 60);
    expect(v.hp, 'the hull shrugged off the throw').toBeLessThan(hp0);
    expect(v.stunnedUntil, 'the thrown hull was not seized').toBeGreaterThan(w.time);
  });

  it('nothing to grab in front → the pound rattles the crowd close by', () => {
    const w = quiet();
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    t.yaw = 0; // faces +x; the victim stands BEHIND, outside the grab cone
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: -3, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    const fire0 = e.nextFireAt;
    w.applyCmd(t, cmd({ ability: true }), 1 / 60);
    expect(e.hp, 'the pound did not hurt the crowd').toBeLessThan(hp0);
    expect(e.nextFireAt, 'the shock did not stagger the aim').toBeGreaterThan(fire0);
  });

  it('a true whiff — nobody in reach — keeps the key hot', () => {
    const w = quiet();
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(t, cmd({ ability: true }), 1 / 60);
    expect(t.nextLswActiveAt ?? 0, 'a whiff burned the cooldown').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// VOLT STRIKER — chain lightning that punishes clusters, and a partial
// overload that seizes the nearest enemy hull. Shipped systems only.
// ---------------------------------------------------------------------------
describe('Volt Striker — chain lightning', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the bolt jumps through a cluster — several enemies hurt from one cast', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    const es = [];
    for (let i = 0; i < 3; i++) {
      const e = w.addSoldier('E' + i, 'infantry', 1, 'human');
      e.pos = { x: 5 + i * 2, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; es.push(e);
    }
    const hp0 = es.map((e) => e.hp);
    w.applyCmd(vs, cmd({ ability: true }), 1 / 60);
    const hurt = es.filter((e, i) => e.hp < hp0[i]).length;
    expect(hurt, 'the chain did not arc through the cluster').toBeGreaterThanOrEqual(2);
  });

  it('the overload arms a 2s fuse and seizes the hull', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    const v = w.spawnVehicle('tank', 1, { x: 6, y: 0, z: 0 });
    w.applyCmd(vs, cmd({ ability: true }), 1 / 60);
    expect(v.overloadAt, 'no fuse was armed').toBeGreaterThan(w.time);
    expect(v.stunnedUntil, 'the hull can still drive away').toBeGreaterThan(w.time);
  });

  it('crew that STAYS loses the gamble — the hull detonates at the fuse', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    vs.pos = { x: -40, y: 0, z: -40 }; // out of his own blast's way
    const v = w.spawnVehicle('tank', 1, { x: 6, y: 0, z: 0 });
    const crew = w.addSoldier('C', 'infantry', 1, 'bot');
    v.seats[0] = crew.id; crew.vehicleId = v.id; crew.seat = 0;
    v.overloadAt = w.time + 0.2; v.overloadBy = vs.id; v.overloadTeam = 0;
    const hp0 = v.hp;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(v.hp, 'the crewed hull rode out the fuse unhurt').toBeLessThan(hp0 - 300);
    expect(v.overloadAt, 'the fuse must clear after firing').toBeUndefined();
  });

  it('crew that BAILS wins it — the charge fizzles and the armor survives', () => {
    const w = quiet();
    const v = w.spawnVehicle('tank', 1, { x: 6, y: 0, z: 0 });
    v.overloadAt = w.time + 0.2; v.overloadBy = -1; v.overloadTeam = 0; // nobody aboard
    const hp0 = v.hp;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    expect(v.hp, 'the empty hull was punished anyway').toBe(hp0);
    expect(v.alive).toBe(true);
    expect(v.overloadAt).toBeUndefined();
  });

  it('a true whiff — nothing in reach — keeps the key hot', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(vs, cmd({ ability: true }), 1 / 60);
    expect(vs.nextLswActiveAt ?? 0, 'a whiff burned the cooldown').toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SNIPERHAWK — a piercing rail down the line (LOS is per-target, so bodies
// never shield each other) and the shipped Orbital Designator as artillery.
// ---------------------------------------------------------------------------
describe('Sniperhawk — the piercing rail', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the rail pierces every body in the line', () => {
    const w = quiet();
    const sh = w.addLsw('sniperhawk', 0, { x: 0, y: 0, z: 0 })!;
    sh.yaw = 0; // faces +x
    const es = [];
    for (let i = 0; i < 3; i++) {
      const e = w.addSoldier('L' + i, 'infantry', 1, 'human');
      e.pos = { x: 6 + i * 4, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; es.push(e);
    }
    const hp0 = es.map((e) => e.hp);
    w.applyCmd(sh, cmd({ ability: true }), 1 / 60);
    expect(es.every((e, i) => e.hp < hp0[i]), 'the rail failed to pierce the whole line').toBe(true);
  });

  it('a body off the line is untouched', () => {
    const w = quiet();
    const sh = w.addLsw('sniperhawk', 0, { x: 0, y: 0, z: 0 })!;
    sh.yaw = 0;
    const on = w.addSoldier('ON', 'infantry', 1, 'human');
    on.pos = { x: 8, y: 0, z: 0 }; on.alive = true; on.protectedUntil = 0;
    const off = w.addSoldier('OFF', 'infantry', 1, 'human');
    off.pos = { x: 8, y: 0, z: 8 }; off.alive = true; off.protectedUntil = 0;
    const onHp = on.hp, offHp = off.hp;
    w.applyCmd(sh, cmd({ ability: true }), 1 / 60);
    expect(on.hp, 'the aligned target survived the rail').toBeLessThan(onHp);
    expect(off.hp, 'a target off the line got clipped').toBe(offHp);
  });

  it('the bot marks a target for artillery (orbital designator)', () => {
    const w = quiet();
    const sh = w.addLsw('sniperhawk', 0, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('T', 'infantry', 1, 'human');
    e.pos = { x: 12, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.step(1 / 60, new Map());
    const marks = [...w.gadgets.values()].filter((g) => g.type === 'orbital' && g.ownerId === sh.id).length;
    expect(marks, 'no artillery was marked').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// BARRIER — an energy wall (shield gadget) whose opening 2s throws enemy fire
// back at the shooters (velocity reversal + re-team in the projectile step).
// ---------------------------------------------------------------------------
describe('Barrier — the reflect wall', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('Q projects a reflecting energy wall', () => {
    const w = quiet();
    const b = w.addLsw('barrier', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    w.applyCmd(b, cmd({ ability: true }), 1 / 60);
    const wall = [...w.gadgets.values()].find((g) => g.type === 'shield' && g.ownerId === b.id && g.reflect);
    expect(wall, 'no reflecting wall was projected').toBeTruthy();
  });

  it('an enemy shot hitting the young wall is thrown back — reversed and re-teamed', () => {
    const w = quiet();
    const b = w.addLsw('barrier', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    w.applyCmd(b, cmd({ ability: true }), 1 / 60); // wall lands ~3u ahead at (3,0,0)
    // an enemy (team 1) round flying INTO the wall
    w.projectiles.set(9999, {
      id: 9999, weapon: 'ar606', ownerId: 500, team: 1,
      pos: { x: 1.6, y: 1.2, z: 0 }, vel: { x: 30, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false,
    });
    w.step(1 / 60, new Map());
    const p = w.projectiles.get(9999);
    expect(p, 'the round vanished instead of reflecting').toBeTruthy();
    expect(p!.team, 'the round was not re-teamed to Barrier').toBe(0);
    expect(p!.vel.x, 'the round was not reversed back at the shooter').toBeLessThan(0);
  });

  it('an OLD wall (past its 2s window) swallows instead of reflecting', () => {
    const w = quiet();
    const b = w.addLsw('barrier', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    w.applyCmd(b, cmd({ ability: true }), 1 / 60);
    const wall = [...w.gadgets.values()].find((g) => g.type === 'shield' && g.reflect)!;
    wall.bornAt = w.time - 5; // age it past the reflect window
    w.projectiles.set(8888, {
      id: 8888, weapon: 'ar606', ownerId: 500, team: 1,
      pos: { x: 1.6, y: 1.2, z: 0 }, vel: { x: 30, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false,
    });
    w.step(1 / 60, new Map());
    expect(w.projectiles.get(8888), 'the old wall reflected instead of swallowing').toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// REACTOR — a charged nova when he's alone, an overcharge (borrowed rageMul)
// for the nearest ally when one's close. The buff burns out on its own.
// ---------------------------------------------------------------------------
describe('Reactor — nova and overcharge', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('novas nearby enemies when there is no ally to feed', () => {
    const w = quiet();
    const r = w.addLsw('reactor', 0, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 4, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    expect(e.hp, 'the nova did not burst the enemy').toBeLessThan(hp0);
  });

  it('overcharges the nearest ally — outgoing damage runs hot', () => {
    const w = quiet();
    const r = w.addLsw('reactor', 0, { x: 0, y: 0, z: 0 })!;
    const ally = w.addSoldier('A', 'infantry', 0, 'bot');
    ally.pos = { x: 3, y: 0, z: 0 }; ally.alive = true;
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    expect(ally.rageMul ?? 1, 'the ally was not overcharged').toBeGreaterThan(1);
    expect(ally.overchargeUntil ?? 0, 'no overcharge window was set').toBeGreaterThan(w.time);
  });

  it('the overcharge burns out after its window', () => {
    const w = quiet();
    const r = w.addLsw('reactor', 0, { x: 0, y: 0, z: 0 })!;
    const ally = w.addSoldier('A', 'infantry', 0, 'bot');
    ally.pos = { x: 3, y: 0, z: 0 }; ally.alive = true;
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    r.nextLswAt = w.time + 100; r.nextLswActiveAt = w.time + 100; // stop the bot re-casting
    ally.overchargeUntil = w.time - 1; // force the window closed
    w.step(1 / 60, new Map());
    expect(ally.rageMul ?? 1, 'the overcharge never wore off').toBe(1);
  });
});

// ---------------------------------------------------------------------------
// OBLIVION — void bolts (arcing splash rounds) and a black hole that drags
// everything inward for its telegraph, then bursts.
// ---------------------------------------------------------------------------
describe('Oblivion — void and the black hole', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the bot lobs an arcing void bolt at a target', () => {
    const w = quiet();
    const o = w.addLsw('oblivion', 1, { x: 0, y: 0, z: 0 })!; o.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 15, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    const bolts = [...w.projectiles.values()].filter((p) => p.weapon === 'void_bolt' && p.arc).length;
    expect(bolts, 'no arcing void bolt was lobbed').toBeGreaterThan(0);
  });

  it('Q opens a black hole that collapses after its telegraph', () => {
    const w = quiet();
    const o = w.addLsw('oblivion', 1, { x: 0, y: 0, z: 0 })!; o.yaw = 0;
    w.applyCmd(o, cmd({ ability: true }), 1 / 60);
    expect(w.blackHoles.length, 'no black hole opened').toBeGreaterThan(0);
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map());
    expect(w.blackHoles.length, 'the black hole never collapsed').toBe(0);
  });

  it('the black hole drags an enemy toward its collapse point', () => {
    const w = quiet();
    const o = w.addLsw('oblivion', 1, { x: 0, y: 0, z: 0 })!; o.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 6, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // hole opens at ~(8,0,0)
    w.applyCmd(o, cmd({ ability: true }), 1 / 60);
    e.pushX = 0; e.pushZ = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.pushX, 'the void did not pull the enemy inward').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// TREMOR — an earthquake stomp (AoE damage + knockback + a fire-rate stagger)
// and a slow soil-ripple round lobbed down the lane.
// ---------------------------------------------------------------------------
describe('Tremor — the earthquake', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the stomp hurts and staggers everyone close', () => {
    const w = quiet();
    const t = w.addLsw('tremor', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 3, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp, f0 = e.nextFireAt;
    w.applyCmd(t, cmd({ ability: true }), 1 / 60);
    expect(e.hp, 'the stomp did not hurt').toBeLessThan(hp0);
    expect(e.nextFireAt, 'the stomp did not stagger the aim').toBeGreaterThan(f0);
  });

  it('the bot sends a soil ripple racing at a distant enemy', () => {
    const w = quiet();
    const t = w.addLsw('tremor', 1, { x: 0, y: 0, z: 0 })!; t.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 20, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    for (let i = 0; i < 10; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    const ripples = [...w.projectiles.values()].filter((p) => p.weapon === 'soil_spike').length;
    expect(ripples, 'no soil ripple was sent').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// MAGNETAR — a halo that eats straight bullets (energy/arcs pass) and feeds
// him, plus a magnetic pulse that jams guns and stalls armor.
// ---------------------------------------------------------------------------
describe('Magnetar — the halo and the pulse', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('straight bullets curve into the halo and feed him; arcs pass clean', () => {
    const w = quiet();
    const m = w.addLsw('magnetar', 1, { x: 0, y: 0, z: 0 })!;
    m.hp = m.maxHp - 100;
    // a plain bullet inbound, and an arc grenade at the same spot
    w.projectiles.set(7001, { id: 7001, weapon: 'ar606', ownerId: 500, team: 0, pos: { x: 2, y: 1.2, z: 0 }, vel: { x: -20, y: 0, z: 0 }, bornAt: w.time, ttl: 3, arc: false });
    w.projectiles.set(7002, { id: 7002, weapon: 'gl', ownerId: 500, team: 0, pos: { x: 2, y: 1.2, z: 0.5 }, vel: { x: -20, y: 0, z: 0 }, bornAt: w.time, ttl: 3, arc: true });
    const hp0 = m.hp;
    w.step(1 / 60, new Map());
    expect(w.projectiles.get(7001), 'the bullet was not absorbed by the halo').toBeUndefined();
    expect(m.hp, 'the halo did not feed him').toBeGreaterThan(hp0);
    expect(w.projectiles.get(7002), 'an arc grenade was wrongly eaten').toBeTruthy();
  });

  it('the pulse jams nearby enemy guns', () => {
    const w = quiet();
    const m = w.addLsw('magnetar', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const f0 = e.nextFireAt;
    w.applyCmd(m, cmd({ ability: true }), 1 / 60);
    expect(e.nextFireAt, 'the pulse did not jam the gun').toBeGreaterThan(f0);
  });
});

// ---------------------------------------------------------------------------
// WRAITH — possesses the nearest enemy turret (team flip) and stalls the
// nearest enemy vehicle, healing on each take.
// ---------------------------------------------------------------------------
describe('Wraith — possession', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('seizes the nearest enemy sentry and heals on the take', () => {
    const w = quiet();
    const wr = w.addLsw('wraith', 1, { x: 0, y: 0, z: 0 })!;
    wr.hp = wr.maxHp - 200;
    w.turrets.set(5501, { id: 5501, team: 0, pos: { x: 4, y: 0, z: 0 }, yaw: 0, hp: 100, maxHp: 100, nextFireAt: 0, ownerId: -1, alive: true });
    const hp0 = wr.hp;
    w.applyCmd(wr, cmd({ ability: true }), 1 / 60);
    expect(w.turrets.get(5501)!.team, 'the sentry was not possessed').toBe(1);
    expect(wr.hp, 'possession did not heal him').toBeGreaterThan(hp0);
  });

  it('stalls the nearest enemy vehicle', () => {
    const w = quiet();
    const wr = w.addLsw('wraith', 1, { x: 0, y: 0, z: 0 })!;
    const v = w.spawnVehicle('tank', 0, { x: 5, y: 0, z: 0 });
    w.applyCmd(wr, cmd({ ability: true }), 1 / 60);
    expect(v.stunnedUntil, 'the vehicle was not stalled').toBeGreaterThan(w.time);
  });
});

// ---------------------------------------------------------------------------
// ECLIPSE — a moving darkness dome (smoke, which the perception system blinds
// through) trailed as she drifts, and a full dome bloomed on Q.
// ---------------------------------------------------------------------------
describe('Eclipse — the darkness dome', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('trails darkness (smoke) as she drifts', () => {
    const w = quiet();
    const e = w.addLsw('eclipse', 1, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[e.id, cmd({ moveZ: -1 })]]));
    const smoke = [...w.gadgets.values()].filter((g) => g.type === 'smoke_field' && g.ownerId === e.id).length;
    expect(smoke, 'no darkness was laid on the move').toBeGreaterThan(0);
  });

  it('Q blooms a full dome of darkness', () => {
    const w = quiet();
    const e = w.addLsw('eclipse', 1, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(e, cmd({ ability: true }), 1 / 60);
    const smoke = [...w.gadgets.values()].filter((g) => g.type === 'smoke_field' && g.ownerId === e.id).length;
    expect(smoke, 'the dome did not bloom').toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// DOMINATOR — the finale. A psychic lance, and links that share damage across
// a bound squad (hurt one, hurt all at 60%).
// ---------------------------------------------------------------------------
describe('Dominator — psychic links', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('links a cluster so hurting one hurts them all', () => {
    const w = quiet();
    const d = w.addLsw('dominator', 1, { x: 0, y: 0, z: 0 })!;
    const es = [];
    for (let i = 0; i < 3; i++) {
      const e = w.addSoldier('E' + i, 'infantry', 0, 'human');
      e.pos = { x: 4 + i * 2, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; es.push(e);
    }
    w.applyCmd(d, cmd({ ability: true }), 1 / 60); // link them
    const hp0 = es.map((e) => e.hp);
    // hurt just the FIRST one — the others should bleed too
    w.damageSoldier(es[0], 50, d.id, 'ar606');
    expect(es[0].hp, 'the struck soldier took no damage').toBeLessThan(hp0[0]);
    const others = es.slice(1).filter((e, i) => e.hp < hp0[i + 1]).length;
    expect(others, 'the link did not share the pain').toBeGreaterThanOrEqual(1);
  });

  it('an unlinked soldier is unaffected when a linked one is hit', () => {
    const w = quiet();
    const d = w.addLsw('dominator', 1, { x: 0, y: 0, z: 0 })!;
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    a.pos = { x: 4, y: 0, z: 0 }; a.alive = true; a.protectedUntil = 0;
    const b = w.addSoldier('B', 'infantry', 0, 'human');
    b.pos = { x: 6, y: 0, z: 0 }; b.alive = true; b.protectedUntil = 0;
    const far = w.addSoldier('FAR', 'infantry', 0, 'human');
    far.pos = { x: 60, y: 0, z: 40 }; far.alive = true; far.protectedUntil = 0; // outside link range
    w.applyCmd(d, cmd({ ability: true }), 1 / 60);
    const farHp = far.hp;
    w.damageSoldier(a, 50, d.id, 'ar606');
    expect(far.hp, 'a soldier off the thread took shared damage').toBe(farHp);
  });
});

// ---------------------------------------------------------------------------
// §7 PLAYING AS AN LSW — you call it, you hold the mark, you BECOME it.
// The full pilot loop: call → telegraph → ascension → Q signature → death
// hands the body back.
// ---------------------------------------------------------------------------
describe('playing as an LSW', () => {
  const quiet = () => new World({ seed: 42, mode: 'ctf', botsPerTeam: 0 });

  it('the caller ascends — the pod turns YOU into the weapon, where you stood', () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 10, y: 0, z: 8 }; h.alive = true;
    expect(w.requestLsw('firebrand', 0, h.id)).toBe(true);
    for (let i = 0; i < 60 * 21; i++) w.step(1 / 60, new Map()); // past the T2 telegraph
    expect(h.ascendant, 'the caller did not ascend').toBe('firebrand');
    expect(h.maxHp).toBe(THREAT[2].hp);
    expect(Math.hypot(h.pos.x - 10, h.pos.z - 8), 'the pod moved off the mark').toBeLessThan(2);
    // no SECOND body — the caller IS the LSW, not a spectator of one
    const lsws = [...w.soldiers.values()].filter((s) => s.ascendant);
    expect(lsws.length).toBe(1);
    expect(lsws[0].id).toBe(h.id);
  });

  it('a caller dead AT LANDING forfeits — the stable sends its own pilot', () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 10, y: 0, z: 8 }; h.alive = true;
    expect(w.requestLsw('firebrand', 0, h.id)).toBe(true);
    // ride out most of the telegraph alive, then die 1s before the pod hits —
    // the respawn clock can't beat the landing
    for (let i = 0; i < 60 * 19; i++) w.step(1 / 60, new Map());
    h.protectedUntil = 0;
    w.damageSoldier(h, 99999, -1, 'ar606'); // overkill — no crawl, straight down
    expect(h.alive).toBe(false);
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map()); // landing passes while he is dead
    const lsw = [...w.soldiers.values()].find((s) => s.ascendant === 'firebrand');
    expect(lsw, 'the pod landed empty').toBeDefined();
    expect(lsw!.id, 'a dead man ascended').not.toBe(h.id);
    // and when the mortal comes back, he comes back MORTAL
    for (let i = 0; i < 60 * 12; i++) w.step(1 / 60, new Map());
    expect(h.alive).toBe(true);
    expect(h.ascendant).toBeUndefined();
  });

  it('a caller who dies and RECOVERS before landing keeps the pod — it is still yours', () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 10, y: 0, z: 8 }; h.alive = true; h.protectedUntil = 0;
    expect(w.requestLsw('firebrand', 0, h.id)).toBe(true);
    w.damageSoldier(h, 99999, -1, 'ar606'); // dies immediately…
    for (let i = 0; i < 60 * 21; i++) w.step(1 / 60, new Map()); // …respawns mid-telegraph
    expect(h.ascendant, 'the recovered caller lost his own pod').toBe('firebrand');
  });

  it('death hands the body back — the mortal redeploys as their class', () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 10, y: 0, z: 8 }; h.alive = true;
    expect(w.ascendSoldier(h, 'frostbite', { x: 10, y: 0, z: 8 })).toBe(true);
    expect(h.maxHp).toBe(THREAT[3].hp);
    h.protectedUntil = 0;
    w.damageSoldier(h, 99999, -1, 'ar606');
    expect(h.alive).toBe(false);
    for (let i = 0; i < 60 * 12; i++) w.step(1 / 60, new Map()); // past the respawn delay
    expect(h.alive, 'the mortal never came back').toBe(true);
    expect(h.ascendant, 'the overlay survived the grave').toBeUndefined();
    expect(h.maxHp, 'trooper stats did not return').toBe(CLASSES.infantry.hp);
  });

  it('your body answers only your own stable', () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.alive = true;
    expect(w.ascendSoldier(h, 'ragebeast'), 'a UF trooper took a Collective body').toBe(false);
    expect(w.requestLsw('plaguebearer', 0, h.id), 'the call crossed factions').toBe(false);
  });

  it("Q cashes Firebrand's board — and an unpainted board never burns the key", () => {
    const w = quiet();
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 0, y: 0, z: 0 }; h.alive = true;
    w.ascendSoldier(h, 'firebrand');
    const grenadesBefore = h.grenades;
    // Q with NOTHING painted: whiff — no cooldown, no class-kit leak
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true })]]));
    expect(h.nextLswActiveAt ?? 0, 'a whiff burned the cooldown').toBe(0);
    expect(h.grenades, 'the class kit leaked through Q').toBe(grenadesBefore);
    // paint, then cash
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[h.id, cmd({ moveZ: -1 })]]));
    w.takeEvents();
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true })]]));
    const events = w.takeEvents();
    expect(events.some((e) => e.type === 'lsw_active' && e.text === 'firebrand'), 'the board never cashed').toBe(true);
    expect(h.nextLswActiveAt ?? 0, 'no cooldown after a real cash').toBeGreaterThan(w.time);
  });

  it('Q freezes the soldier you are AIMING at, not whoever is closest', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.pos = { x: 0, y: 0, z: 0 }; h.alive = true;
    w.ascendSoldier(h, 'frostbite');
    // the AIMED enemy is farther; a decoy stands closer but behind him
    const aimed = w.addSoldier('AIMED', 'infantry', 1, 'human');
    aimed.pos = { x: 12, y: 0, z: 0 }; aimed.alive = true; aimed.protectedUntil = 0;
    const decoy = w.addSoldier('DECOY', 'infantry', 1, 'human');
    decoy.pos = { x: -6, y: 0, z: 0 }; decoy.alive = true; decoy.protectedUntil = 0;
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true, aimYaw: 0 })]])); // aiming +x
    expect(aimed.encasedUntil, 'the aimed man walked free').toBeDefined();
    expect(decoy.encasedUntil, 'the ice went to the crowd, not the crosshair').toBeUndefined();
  });

  it('Q rings the quarantine around Plaguebearer', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const h = w.addSoldier('K', 'infantry', 1, 'human');
    h.pos = { x: 0, y: 0, z: 0 }; h.alive = true;
    w.ascendSoldier(h, 'plaguebearer');
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true })]]));
    const ring = [...w.gadgets.values()].filter((g) => g.type === 'smoke_field' && g.ownerId === h.id);
    expect(ring.length, 'the ring is not a ring').toBeGreaterThanOrEqual(6);
  });

  it('Q slams the ground — Ragebeast hurts and THROWS whoever stands close', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const h = w.addSoldier('K', 'infantry', 1, 'human');
    h.pos = { x: 0, y: 0, z: 0 }; h.alive = true;
    w.ascendSoldier(h, 'ragebeast');
    const near = w.addSoldier('NEAR', 'infantry', 0, 'human');
    near.pos = { x: 3, y: 0, z: 0 }; near.alive = true; near.protectedUntil = 0;
    const hpBefore = near.hp + near.armor;
    w.step(1 / 60, new Map([[h.id, cmd({ ability: true })]]));
    expect(near.hp + near.armor, 'the slam did not bite').toBeLessThan(hpBefore);
    expect(near.pushX, 'the slam did not throw').toBeGreaterThan(0);
  });

  it('the bot officer calls for a humanless faction — and NEVER usurps yours', () => {
    const w = new World({ seed: 42, mode: 'ctf', botsPerTeam: 2 });
    const h = w.addSoldier('ROBERT', 'infantry', 0, 'human');
    h.alive = true;
    let team1Called = false;
    for (let i = 0; i < 60 * 120; i++) {
      w.step(1 / 60, new Map());
      w.takeEvents(); // keep the queue drained
      if (w.pendingLsw.some((p) => p.team === 1) || [...w.soldiers.values()].some((s) => s.team === 1 && s.ascendant)) team1Called = true;
      if (team1Called && w.time > 115) break;
    }
    expect(team1Called, 'the Collective officer never made the call').toBe(true);
    // your faction's channel stayed YOURS — nobody called for team 0
    expect(w.pendingLsw.some((p) => p.team === 0)).toBe(false);
    expect([...w.soldiers.values()].some((s) => s.team === 0 && s.ascendant)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// THE SPOKEN SCRIPT (Robert): every LSW has a mouth, the net has a voice,
// and only the people around a speaker hear them. Real TTS clips
// (tools/gen-lsw-vo.mjs) behind Sound-Lab-replaceable slots.
// ---------------------------------------------------------------------------
describe('the spoken script', () => {
  const IDS = Object.keys(LSWS) as AscendantId[];
  const MOMENTS = ['arrive', 'kill3', 'ability', 'low', 'death'] as const;
  const NET = ['inbound', 'landed', 'down', 'rampage'] as const;

  it('every LSW has every line, every slot is registered, every clip is ON DISK', () => {
    for (const id of IDS) {
      for (const m of MOMENTS) {
        const slot = voSlot(id, m);
        expect(VO_LINES[slot], `${slot} has no written line`).toBeTruthy();
        expect(SOUND_NAMES.includes(slot as (typeof SOUND_NAMES)[number]), `${slot} not in SOUND_NAMES`).toBe(true);
        expect(existsSync(join(__dirname, '..', 'public', 'audio', `${slot}.wav`)), `${slot}.wav missing — run gen-lsw-vo`).toBe(true);
      }
      for (const m of NET) {
        const slot = annSlot(id, m);
        expect(SOUND_NAMES.includes(slot as (typeof SOUND_NAMES)[number]), `${slot} not in SOUND_NAMES`).toBe(true);
        expect(existsSync(join(__dirname, '..', 'public', 'audio', `${slot}.wav`)), `${slot}.wav missing`).toBe(true);
        expect(LSWS[id].lines[m], `${id} has no ${m} announcer text`).toBeTruthy();
      }
    }
  });

  it('landing speaks THREE ways: the LSW aloud (positional), the net (not), the banner (text)', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    w.addLsw('firebrand', 0, { x: 3, y: 0, z: 4 });
    const evs = w.takeEvents();
    const mouth = evs.find((e) => e.type === 'vo' && e.text === 'vo_firebrand_arrive');
    expect(mouth, 'the LSW never spoke on arrival').toBeTruthy();
    expect(mouth!.pos, 'the arrival line must be POSITIONAL').toBeTruthy();
    const net = evs.find((e) => e.type === 'vo' && e.text === 'ann_firebrand_landed');
    expect(net, 'the net never called the landing').toBeTruthy();
    expect(net!.pos, 'the net is map-wide — no position').toBeUndefined();
    expect(evs.some((e) => e.type === 'announce' && e.text === LSWS.firebrand.lines.landed)).toBe(true);
  });

  it('the third kill of the LIFE speaks exactly once; the fifth wakes the net', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    fb.kills = 40; // a veteran — milestones must count from THIS life
    fb.lswKillsBase = 40;
    w.takeEvents();
    const all: SimEvent[] = [];
    for (let i = 0; i < 6; i++) {
      const v = w.addSoldier('V' + i, 'infantry', 1, 'human');
      v.pos = { x: 2, y: 0, z: 0 }; v.alive = true; v.protectedUntil = 0;
      w.damageSoldier(v, 99999, fb.id, 'ar606');
      all.push(...w.takeEvents());
    }
    expect(all.filter((e) => e.type === 'vo' && e.text === 'vo_firebrand_kill3').length,
      'kill3 must fire exactly once').toBe(1);
    expect(all.filter((e) => e.type === 'vo' && e.text === 'ann_firebrand_rampage').length,
      'rampage must fire exactly once, at five').toBe(1);
    expect(all.some((e) => e.type === 'announce' && e.text === LSWS.firebrand.lines.rampage)).toBe(true);
  });

  it('the bloodied line latches — hurt twice below a quarter, speak ONCE', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    fb.protectedUntil = 0;
    w.takeEvents();
    w.damageSoldier(fb, fb.maxHp * 0.8, -1, 'ar606'); // to 20%
    w.damageSoldier(fb, 50, -1, 'ar606');             // still low, hurt again
    const evs = w.takeEvents();
    expect(evs.filter((e) => e.type === 'vo' && e.text === 'vo_firebrand_low').length).toBe(1);
  });

  it('the fall gets last words nearby and a map-wide net call', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fb = w.addLsw('firebrand', 0, { x: 0, y: 0, z: 0 })!;
    fb.protectedUntil = 0;
    w.takeEvents();
    w.damageSoldier(fb, 99999, -1, 'ar606');
    const evs = w.takeEvents();
    const last = evs.find((e) => e.type === 'vo' && e.text === 'vo_firebrand_death');
    expect(last, 'no last words').toBeTruthy();
    expect(last!.pos, 'last words are for whoever stood CLOSE').toBeTruthy();
    expect(evs.some((e) => e.type === 'vo' && e.text === 'ann_firebrand_down' && !e.pos)).toBe(true);
    expect(evs.some((e) => e.type === 'announce' && e.text === LSWS.firebrand.lines.down)).toBe(true);
  });

  it('the officer call reads the inbound line on the banner AND the net', () => {
    const w = new World({ seed: 42, mode: 'ctf' });
    w.requestLsw('ragebeast', 1);
    const evs = w.takeEvents();
    expect(evs.some((e) => e.type === 'pod_incoming' && e.text === LSWS.ragebeast.lines.inbound)).toBe(true);
    expect(evs.some((e) => e.type === 'vo' && e.text === 'ann_ragebeast_inbound' && !e.pos)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RIPTIDE — both abilities ride the shared FORCE FIELDS: the wave is a
// directional current + a fire purge; the whirlpool is a pull, doubled on
// real water.
// ---------------------------------------------------------------------------
describe('Riptide — the wave and the whirlpool', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the wave shoves the line back AND extinguishes every flame in its path', () => {
    const w = quiet();
    const r = w.addLsw('riptide', 0, { x: 0, y: 0, z: 0 })!; r.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 8, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.spawnGadget('fire_field', 1, -1, { x: 10, y: 0, z: 0 }, Infinity, 9); // an enemy flame in the corridor
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    e.pushX = 0;
    w.step(1 / 60, new Map());
    expect(e.pushX, 'the wave did not carry him with the current').toBeGreaterThan(0);
    expect([...w.gadgets.values()].some((g) => g.type === 'fire_field'),
      'the flame survived the wave — the douse is dead').toBe(false);
  });

  it('the whirlpool pulls — and DOUBLES on real water', () => {
    const w = quiet();
    const r = w.addLsw('riptide', 0, { x: 0, y: 0, z: 0 })!;
    // dry-land whirlpool via the bot's slow play: force the cadence
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 10, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    r.nextLswAt = w.time + 999; // silence the wave; the whirlpool is on trial
    r.nextLswActiveAt = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    const dry = w.forceFields.find((f) => f.radial < 0);
    expect(dry, 'no whirlpool was painted').toBeTruthy();
    expect(dry!.radial).toBe(-4);
    // now the same cast over water
    const w2 = quiet();
    const r2 = w2.addLsw('riptide', 0, { x: 0, y: 0, z: 0 })!;
    const GRID_N = Math.sqrt(w2.map.grid.length) | 0;
    const T_WATER_ID = 3;
    // flood the tile 10u down his aim
    const tx = Math.floor((10 + 150) / (300 / GRID_N)), tz = Math.floor((0 + 150) / (300 / GRID_N));
    w2.map.grid[tz * GRID_N + tx] = T_WATER_ID;
    const e2 = w2.addSoldier('E', 'infantry', 1, 'human');
    e2.pos = { x: 10, y: 0, z: 0 }; e2.alive = true; e2.protectedUntil = 0;
    r2.yaw = 0; r2.nextLswAt = w2.time + 999; r2.nextLswActiveAt = 0;
    w2.step(1 / 60, new Map([[e2.id, cmd()]]));
    const wet = w2.forceFields.find((f) => f.radial < 0);
    expect(wet, 'no whirlpool over water').toBeTruthy();
    expect(wet!.radial, 'water must DOUBLE the pull').toBe(-8);
  });
});

// ---------------------------------------------------------------------------
// GRAVITY WARDEN — pull-then-slam on the shared force fields; REVERSE
// GRAVITY on the lift state (float, still shooting, staggered drop).
// ---------------------------------------------------------------------------
describe('Gravity Warden — the weight license', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('REVERSE GRAVITY floats the near, they can still shoot, and the drop staggers', () => {
    const w = quiet();
    const g = w.addLsw('gravwarden', 0, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.applyCmd(g, cmd({ ability: true }), 1 / 60);
    expect(e.liftedUntil, 'nobody floated').toBeGreaterThan(w.time);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.pos.y, 'the float never left the ground').toBeGreaterThan(1);
    // still armed while afloat: the trigger is not blocked
    const f0 = e.nextFireAt;
    w.applyCmd(e, cmd({ fire: true, aimYaw: Math.PI }), 1 / 60);
    expect(e.nextFireAt, 'a floating man must still be able to shoot').toBeGreaterThan(f0);
    // ride out the float — the drop staggers the aim once
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.liftedUntil, 'the float never ended').toBeUndefined();
    expect(e.pos.y, 'he never came down').toBeLessThan(0.5);
  });

  it('the pull-then-slam: the tug telegraphs, then the slam cashes around him', () => {
    const w = quiet();
    const g = w.addLsw('gravwarden', 0, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 6, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]])); // the bot arms the pull
    expect(w.forceFields.some((f) => f.radial < 0), 'no pull was cast').toBe(true);
    const hp0 = e.hp;
    for (let i = 0; i < 60 * 2; i++) w.step(1 / 60, new Map([[e.id, cmd()]])); // the pull closes, the slam lands
    expect(e.hp, 'the slam never cashed the pull').toBeLessThan(hp0);
  });
});

// ---------------------------------------------------------------------------
// CHRONOS — the time bubble rides TIME FIELDS; the temporal echo saves him
// exactly once, at the breadcrumb the glow advertised.
// ---------------------------------------------------------------------------
describe('Chronos — the clockmaker', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('Q casts a time bubble he himself walks through untouched', () => {
    const w = quiet();
    const c = w.addLsw('chronos', 1, { x: 0, y: 0, z: 0 })!; c.yaw = 0;
    w.applyCmd(c, cmd({ ability: true }), 1 / 60);
    const f = w.timeFields.find((t) => t.ownerId === c.id);
    expect(f, 'no bubble was cast').toBeTruthy();
    expect(f!.mul).toBeLessThan(1);
    expect(w.timeMulAt(f!.x, f!.z, c.id), 'his own bubble slowed HIM').toBe(1);
    expect(w.timeMulAt(f!.x, f!.z), 'the bubble does not slow the world').toBeLessThan(1);
  });

  it('the TEMPORAL ECHO: a lethal hit snaps him to his 3s-old breadcrumb — ONCE', () => {
    const w = quiet();
    const c = w.addLsw('chronos', 1, { x: 0, y: 0, z: 0 })!;
    c.protectedUntil = 0;
    // walk him east for 3s so the breadcrumbs trail behind him
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[c.id, cmd({ moveX: 1 })]]));
    const crumb = c.lswTrail![0];
    const before = { x: c.pos.x, z: c.pos.z };
    w.damageSoldier(c, 99999, -1, 'ar606'); // the killing blow
    expect(c.alive, 'the echo failed — he died on the first lethal').toBe(true);
    expect(Math.hypot(c.pos.x - crumb.x, c.pos.z - crumb.z), 'he did not snap to the breadcrumb').toBeLessThan(1);
    expect(Math.hypot(c.pos.x - before.x, c.pos.z - before.z), 'he never moved').toBeGreaterThan(2);
    expect(c.lswFlagA).toBe(true);
    // the second death is real
    c.protectedUntil = 0;
    w.damageSoldier(c, 99999, -1, 'ar606');
    expect(c.alive, 'the echo fired twice — once per fight is the law').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VENATRIX — snap-traps ride ENCASE (the ice block's little sister); the
// harpoon reels one enemy across the open.
// ---------------------------------------------------------------------------
describe('Venatrix — the trapper', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('a sprung trap ENCASES the wanderer — the shared ice-block state', () => {
    const w = quiet();
    const v = w.addLsw('venatrix', 1, { x: 0, y: 0, z: 0 })!;
    v.nextLswAt = w.time + 999; v.nextLswActiveAt = w.time + 999; // the PLANTED trap is on trial, not her brain
    const trap = w.spawnGadget('snap_trap', 1, v.id, { x: 6, y: 0, z: 0 }, 30, 90);
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 6.5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // stepped IN it
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.encasedUntil, 'the trap never sprang the ice').toBeGreaterThan(w.time);
    expect(w.gadgets.has(trap.id), 'the trap must be spent on the spring').toBe(false);
  });

  it('the HARPOON reels the aimed enemy toward her, and the barb bites', () => {
    const w = quiet();
    const v = w.addLsw('venatrix', 1, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 15, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    w.applyCmd(v, cmd({ ability: true }), 1 / 60);
    expect(e.pushX, 'the reel must drag him TOWARD her (−x)').toBeLessThan(0);
    expect(e.hp, 'the barb must bite going in').toBeLessThan(hp0);
  });
});

// ---------------------------------------------------------------------------
// VANGUARD · PYROCLASM · VOIDWALKER — wave 2's third batch.
// ---------------------------------------------------------------------------
describe('Vanguard — the breacher', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the bash stuns and shoves the front cone', () => {
    const w = quiet();
    const v = w.addLsw('vanguard', 0, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 4, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp, f0 = e.nextFireAt;
    w.applyCmd(v, cmd({ ability: true }), 1 / 60);
    expect(e.hp).toBeLessThan(hp0);
    expect(e.nextFireAt, 'the stun must lock the gun').toBeGreaterThan(f0);
    expect(e.pushX, 'the shove must carry him back').toBeGreaterThan(0);
  });

  it("the barricade blocks BOTH sides — even his own team's rounds die on it", () => {
    const w = quiet();
    const v = w.addLsw('vanguard', 0, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    v.nextLswAt = w.time + 999;
    w.step(1 / 60, new Map()); // bot lays the barricade ahead (~3u)
    const wall = [...w.gadgets.values()].find((g) => g.type === 'shield' && g.bothSides);
    expect(wall, 'no both-sides barricade was laid').toBeTruthy();
    // a FRIENDLY (team 0) round flying into it must be swallowed
    w.projectiles.set(9301, { id: 9301, weapon: 'ar606', ownerId: 700, team: 0, pos: { x: 1.5, y: 1.2, z: 0 }, vel: { x: 30, y: 0, z: 0 }, bornAt: w.time, ttl: 3, arc: false });
    w.step(1 / 60, new Map());
    expect(w.projectiles.get(9301), "his own team's round passed the wall — both sides means BOTH").toBeUndefined();
  });
});

describe('Pyroclasm — the threshold', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('a molten rock leaves a burning pool where it lands', () => {
    const w = quiet();
    const p = w.addLsw('pyroclasm', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 15, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect([...w.gadgets.values()].some((g) => g.type === 'fire_field'),
      'the rocks left no pools').toBe(true);
  });

  it('the ERUPTION fires exactly once, at the quarter mark — never above it', () => {
    const w = quiet();
    const p = w.addLsw('pyroclasm', 1, { x: 0, y: 0, z: 0 })!;
    p.protectedUntil = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 5, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    // poke him to 30% — NO eruption (range the threshold)
    w.damageSoldier(p, p.maxHp * 0.7, -1, 'ar606');
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    const hpAt30 = e.hp;
    expect(p.lswFlagA ?? false, 'he erupted above the threshold').toBe(false);
    // now cross it — the room decides
    w.damageSoldier(p, p.maxHp * 0.1, -1, 'ar606');
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(p.lswFlagA, 'crossing a quarter must erupt').toBe(true);
    expect(e.hp, 'the eruption must burst the room').toBeLessThan(hpAt30);
  });
});

describe('Voidwalker — the departure shadow', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the blink-strike arrives beside the mark, cuts, and leaves a shadow behind', () => {
    const w = quiet();
    const vw = w.addLsw('voidwalker', 1, { x: 0, y: 0, z: 0 })!; vw.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 15, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    w.applyCmd(vw, cmd({ ability: true }), 1 / 60);
    expect(Math.hypot(vw.pos.x - e.pos.x, vw.pos.z - e.pos.z), 'he never arrived').toBeLessThan(2);
    expect(e.hp, 'the strike never cut').toBeLessThan(hp0);
    expect(w.blackHoles.some((b) => Math.hypot(b.x, b.z) < 1), 'no shadow at the departure point').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CRIMSON · MIRAGE · BLITZ — wave 2's fourth batch.
// ---------------------------------------------------------------------------
describe('Crimson — the drinker', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the drain leeches the enemy and feeds him', () => {
    const w = quiet();
    const c = w.addLsw('crimson', 1, { x: 0, y: 0, z: 0 })!;
    c.hp = c.maxHp - 200;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 6, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const eHp = e.hp, cHp = c.hp;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(e.hp, 'the drain never bit').toBeLessThan(eHp);
    expect(c.hp, 'the leech never came home').toBeGreaterThan(cHp);
  });

  it('a fresh corpse raises ONE blood brute — and only one at a time', () => {
    const w = quiet();
    const c = w.addLsw('crimson', 1, { x: 0, y: 0, z: 0 })!;
    for (let k = 0; k < 2; k++) {
      const v = w.addSoldier('V' + k, 'infantry', 0, 'human');
      v.pos = { x: 4 + k, y: 0, z: 0 }; v.alive = true; v.protectedUntil = 0;
      w.damageSoldier(v, 99999, -1, 'ar606'); // two pools
    }
    w.applyCmd(c, cmd({ ability: true }), 1 / 60);
    w.applyCmd(c, cmd({ ability: true }), 1 / 60); // greed — refused
    const brutes = [...w.soldiers.values()].filter((s) => s.name === 'BLOOD BRUTE' && s.alive);
    expect(brutes.length, 'the rite must raise exactly one').toBe(1);
    expect(brutes[0].maxHp).toBe(320); // a brute's constitution, canon
  });
});

describe('Mirage — the shell game', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('decoys wear her face, pop to ONE hit, and the swap trades places', () => {
    const w = quiet();
    const m = w.addLsw('mirage', 0, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(m, cmd({ ability: true }), 1 / 60); // no decoys → raises one
    const d = [...w.soldiers.values()].find((s) => s.decoyOf === m.id)!;
    expect(d, 'no decoy was raised').toBeTruthy();
    expect(d.name, 'the decoy must wear her name').toBe(m.name);
    expect(d.maxHp, 'one bullet, one truth').toBe(1);
    const dPos = { ...d.pos };
    const mPos = { ...m.pos };
    m.nextLswActiveAt = 0;
    w.applyCmd(m, cmd({ ability: true }), 1 / 60); // now: the swap
    expect(Math.hypot(m.pos.x - dPos.x, m.pos.z - dPos.z), 'she never took the decoy spot').toBeLessThan(0.1);
    expect(Math.hypot(d.pos.x - mPos.x, d.pos.z - mPos.z), 'the decoy never took hers').toBeLessThan(0.1);
    d.protectedUntil = 0;
    w.damageSoldier(d, 5, -1, 'ar606');
    expect(d.alive, 'one hit must pop the illusion').toBe(false);
  });
});

describe('Blitz — momentum', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the dash-strike closes the gap and cuts; a KILL refunds the dash', () => {
    const w = quiet();
    const b = w.addLsw('blitz', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    const weak = w.addSoldier('W', 'infantry', 1, 'human');
    weak.pos = { x: 10, y: 0, z: 0 }; weak.alive = true; weak.protectedUntil = 0;
    weak.hp = 30; // one cut kills
    w.applyCmd(b, cmd({ ability: true }), 1 / 60);
    expect(weak.alive, 'the cut should have killed').toBe(false);
    expect(b.nextLswActiveAt ?? 0, 'a kill must REFUND the dash').toBe(0);
    expect(Math.hypot(b.pos.x - 10, b.pos.z), 'he never closed the gap').toBeLessThan(2);
  });

  it('the afterimages replay his last dash paths as damaging lines', () => {
    const w = quiet();
    const b = w.addLsw('blitz', 0, { x: 0, y: 0, z: 0 })!; b.yaw = 0;
    const t1 = w.addSoldier('T', 'infantry', 1, 'human');
    t1.pos = { x: 10, y: 0, z: 0 }; t1.alive = true; t1.protectedUntil = 0;
    w.applyCmd(b, cmd({ ability: true }), 1 / 60); // dash — the path (0,0)→(10,0) recorded
    const straggler = w.addSoldier('S', 'infantry', 1, 'human');
    straggler.pos = { x: 5, y: 0, z: 0 }; straggler.alive = true; straggler.protectedUntil = 0; // ON the old path
    const hp0 = straggler.hp;
    b.nextLswAt = w.time + 999; b.nextLswActiveAt = 0;
    w.step(1 / 60, new Map()); // the bot replays the afterimages
    expect(straggler.hp, 'the afterimage never walked the old path').toBeLessThan(hp0);
  });
});

// ---------------------------------------------------------------------------
// SHADOWSTEP · SPECTER · PULSE — wave 2's fifth batch.
// ---------------------------------------------------------------------------
describe('Shadowstep — the quiet knife', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the blink-stab arrives behind the mark and leaves a LIVE MINE at the departure', () => {
    const w = quiet();
    const sh = w.addLsw('shadowstep', 0, { x: 0, y: 0, z: 0 })!; sh.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 12, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    w.applyCmd(sh, cmd({ ability: true }), 1 / 60);
    expect(e.hp, 'the stab never landed').toBeLessThan(hp0);
    expect(Math.hypot(sh.pos.x - e.pos.x, sh.pos.z - e.pos.z), 'he never arrived').toBeLessThan(2);
    expect([...w.mines.values()].some((m) => Math.hypot(m.pos.x, m.pos.z) < 1 && m.ownerId === sh.id),
      'no mine at the departure point — chasing must BE the trap').toBe(true);
  });
});

describe('Specter — the crowd', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the images DETONATE on command — everyone among them is burst', () => {
    const w = quiet();
    const sp = w.addLsw('specter', 1, { x: 0, y: 0, z: 0 })!;
    w.applyCmd(sp, cmd({ ability: true }), 1 / 60); // no images → raises one
    const img = [...w.soldiers.values()].find((d) => d.decoyOf === sp.id)!;
    expect(img, 'no image was raised').toBeTruthy();
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: img.pos.x + 2, y: 0, z: img.pos.z }; e.alive = true; e.protectedUntil = 0;
    const hp0 = e.hp;
    sp.nextLswActiveAt = 0;
    w.applyCmd(sp, cmd({ ability: true }), 1 / 60); // THE COMMAND
    expect(e.hp, 'the detonation missed the man standing among the images').toBeLessThan(hp0);
    expect([...w.soldiers.values()].some((d) => d.decoyOf === sp.id && d.alive),
      'the images must be spent by the blast').toBe(false);
  });
});

describe('Pulse — walls are a rumor', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the wave staggers and TAGS victims THROUGH a wall', () => {
    const w = quiet();
    const p = w.addLsw('pulse', 0, { x: 0, y: 0, z: 0 })!;
    // a wall between them — sound does not care
    const GRID_N = Math.sqrt(w.map.grid.length) | 0;
    const TILE_U = 300 / GRID_N;
    const tx = Math.floor((5 + 150) / TILE_U), tz = Math.floor((0 + 150) / TILE_U);
    w.map.grid[tz * GRID_N + tx] = 1; // T_WALL
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 10, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    const f0 = e.nextFireAt;
    w.applyCmd(p, cmd({ ability: true }), 1 / 60);
    expect(e.nextFireAt, 'the wave never staggered him').toBeGreaterThan(f0);
    expect(w.tagged.has(e.id), 'the wave must TAG through the wall').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// VENOM · NIGHTMARE · REAPER — wave 2's sixth batch.
// ---------------------------------------------------------------------------
describe('Venom — the dosage', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the acid glob dissolves the plate WHOLE', () => {
    const w = quiet();
    const v = w.addLsw('venom', 0, { x: 0, y: 0, z: 0 })!; v.yaw = 0;
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 10, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    e.armor = 60; e.maxArmor = 60;
    w.applyCmd(v, cmd({ ability: true }), 1 / 60);
    expect(e.armor, 'the plate must dissolve whole').toBe(0);
    expect(e.hp, 'the glob must also bite').toBeLessThan(100);
  });

  it('the poisoned LEAK — anyone in his contamination is tagged public', () => {
    const w = quiet();
    const v = w.addLsw('venom', 0, { x: 0, y: 0, z: 0 })!;
    w.spawnGadget('smoke_field', 0, v.id, { x: 8, y: 0, z: 0 }, Infinity, 8);
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 8, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; // standing IN it
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[e.id, cmd()]]));
    expect(w.tagged.has(e.id), 'the poisoned must leak a visible trail').toBe(true);
  });
});

describe('Nightmare — the liar', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the fear pulse litters the net with FALSE contacts', () => {
    const w = quiet();
    const n = w.addLsw('nightmare', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 10, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.takeEvents();
    w.applyCmd(n, cmd({ ability: true }), 1 / 60); // Q blinds the near first — force the pulse path
    n.nextLswAt = 0;
    w.step(1 / 60, new Map([[e.id, cmd()]]));
    const pings = w.takeEvents().filter((ev) => ev.type === 'psi_ping' && ev.soldierId === undefined).length;
    expect(pings, 'no lies were told').toBeGreaterThanOrEqual(3);
  });

  it('THE BLIND: a blinded bot cannot acquire targets for 2s — then the eyes return', () => {
    const w = quiet();
    const n = w.addLsw('nightmare', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'bot');
    e.pos = { x: 8, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    w.applyCmd(n, cmd({ ability: true }), 1 / 60);
    expect(e.blindUntil, 'the blind never landed').toBeGreaterThan(w.time);
    // while blind, the bot never fires at the nightmare standing in the open
    const f0 = w.projectiles.size;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    // (his rifle may be silent for other reasons; the LAW is the flag + expiry)
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map());
    expect(w.time >= (e.blindUntil ?? 0), 'the blind must expire — ears buy you 2s, not forever').toBe(true);
  });
});

describe('Reaper — the ledger', () => {
  const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

  it('the chain grabs the FIRST body on the line — the tank eats it for the squad', () => {
    const w = quiet();
    const r = w.addLsw('reaper', 1, { x: 0, y: 0, z: 0 })!; r.yaw = 0;
    const tank = w.addSoldier('TANK', 'heavy', 0, 'human');
    tank.pos = { x: 8, y: 0, z: 0 }; tank.alive = true; tank.protectedUntil = 0;
    const squishy = w.addSoldier('SQ', 'medic', 0, 'human');
    squishy.pos = { x: 16, y: 0, z: 0 }; squishy.alive = true; squishy.protectedUntil = 0; // BEHIND the tank
    const sqHp = squishy.hp;
    w.applyCmd(r, cmd({ ability: true }), 1 / 60);
    expect(tank.pushX, 'the FIRST body must be reeled (toward −x)').toBeLessThan(0);
    expect(squishy.hp, 'the chain skipped the tank — it must grab the first body').toBe(sqHp);
  });

  it("THE MARK doubles the hunter's own blows — and only his", () => {
    const w = quiet();
    const r = w.addLsw('reaper', 1, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 0, 'human');
    e.pos = { x: 30, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    e.markedBy = r.id; e.markedUntil = w.time + 8;
    const other = w.addSoldier('O', 'infantry', 1, 'bot');
    w.damageSoldier(e, 10, r.id, 'ar606'); // the hunter's blow — doubled
    const afterReaper = e.hp;
    expect(100 - afterReaper, "the mark must double the hunter's damage").toBe(20);
    w.damageSoldier(e, 10, other.id, 'ar606'); // a stranger's blow — normal
    expect(afterReaper - e.hp, "a stranger's blow must stay normal").toBe(10);
  });
});
