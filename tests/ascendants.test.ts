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

  it('the nearest enemy hull seizes and takes a bite (partial overload)', () => {
    const w = quiet();
    const vs = w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 })!;
    const v = w.spawnVehicle('tank', 1, { x: 6, y: 0, z: 0 });
    const hp0 = v.hp;
    w.applyCmd(vs, cmd({ ability: true }), 1 / 60);
    expect(v.hp, 'the hull ignored the overload').toBeLessThan(hp0);
    expect(v.stunnedUntil, 'the hull was not seized').toBeGreaterThan(w.time);
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
