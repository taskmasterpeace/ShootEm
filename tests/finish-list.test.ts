// ---------------------------------------------------------------------------
// THE FINISH LIST (Robert's 18-feature goal) — the laws that pin each item
// as it ships. Rescue behavior (#9), the speed sliders (#13), and whatever
// lands next: every feature gets a law here so "finished" stays finished.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { CLASSES, WEAPONS } from '../src/sim/data';
import { LSWS } from '../src/sim/lsw';
import { objectiveFor } from '../src/sim/bots';
import { isIron } from '../src/sim/types';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe('#9 RESCUE — "if you are behind enemy lines they should come GET you"', () => {
  it('the nearest free bot breaks off toward a cut-off friendly', () => {
    const w = quiet();
    const lost = w.addSoldier('LOST', 'infantry', 0, 'human');
    lost.pos = { x: 80, y: 0, z: 80 }; lost.alive = true; // deep and alone
    for (let i = 0; i < 3; i++) {
      const foe = w.addSoldier('F' + i, 'infantry', 1, 'bot');
      foe.pos = { x: 90 + i * 3, y: 0, z: 80 }; foe.alive = true; // pressing him
    }
    // a JUMP trooper is always a raider (never guardsHome) — a guaranteed
    // rescuer regardless of the id it draws. (Infantry's role keys off id%4,
    // which shifts with entity count — the base compound's armory pickups
    // moved every id, and the old infantry rescuer drew a guard's number.)
    const rescuer = w.addSoldier('R', 'jump', 0, 'bot');
    rescuer.pos = { x: 40, y: 0, z: 40 }; rescuer.alive = true; // inside the 70u answer radius
    const obj = objectiveFor(w, rescuer);
    expect(Math.hypot(obj.x - 80, obj.z - 80), 'the objective must BE the lost man').toBeLessThan(1);
  });

  it('a friendly WITH company gets no rescuer — the war goes on', () => {
    const w = quiet();
    const fine = w.addSoldier('FINE', 'infantry', 0, 'human');
    fine.pos = { x: 80, y: 0, z: 80 }; fine.alive = true;
    const buddy = w.addSoldier('B', 'infantry', 0, 'human');
    buddy.pos = { x: 85, y: 0, z: 80 }; buddy.alive = true; // company
    for (let i = 0; i < 3; i++) {
      const foe = w.addSoldier('F' + i, 'infantry', 1, 'bot');
      foe.pos = { x: 90 + i * 3, y: 0, z: 80 }; foe.alive = true;
    }
    const bot = w.addSoldier('R', 'infantry', 0, 'bot');
    bot.pos = { x: 30, y: 0, z: 30 }; bot.alive = true;
    const obj = objectiveFor(w, bot);
    expect(Math.hypot(obj.x - 80, obj.z - 80), 'nobody breaks off for a man with a buddy').toBeGreaterThan(5);
  });

  it('only the CLOSEST free bot takes the job — no dogpile rescues', () => {
    const w = quiet();
    const lost = w.addSoldier('LOST', 'infantry', 0, 'human');
    lost.pos = { x: 80, y: 0, z: 80 }; lost.alive = true;
    for (let i = 0; i < 2; i++) {
      const foe = w.addSoldier('F' + i, 'infantry', 1, 'bot');
      foe.pos = { x: 92 + i * 3, y: 0, z: 80 }; foe.alive = true;
    }
    const near = w.addSoldier('NEAR', 'infantry', 0, 'bot');
    near.pos = { x: 60, y: 0, z: 60 }; near.alive = true;
    const farBot = w.addSoldier('FAR', 'infantry', 0, 'bot');
    farBot.pos = { x: 10, y: 0, z: 10 }; farBot.alive = true;
    const nearObj = objectiveFor(w, near);
    const farObj = objectiveFor(w, farBot);
    expect(Math.hypot(nearObj.x - 80, nearObj.z - 80), 'the near bot goes').toBeLessThan(1);
    expect(Math.hypot(farObj.x - 80, farObj.z - 80), 'the far bot keeps fighting the war').toBeGreaterThan(5);
  });
});

describe('#13 THE SLIDERS — "make sure they are working"', () => {
  it('moveSpeedMul scales soldier legs — half the knob, half the ground', () => {
    const run = (mul: number) => {
      const w = quiet();
      w.moveSpeedMul = mul;
      const s = w.addSoldier('S', 'infantry', 0, 'human');
      s.pos = { x: 0, y: 0, z: 0 }; s.alive = true;
      const cmd = { moveX: 1, moveZ: 0, aimYaw: 0, fire: false, ability: false, grenade: false } as never;
      for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd]]));
      return s.pos.x;
    };
    const full = run(1), half = run(0.5);
    expect(full, 'legs work at 1x').toBeGreaterThan(3);
    expect(half / full, 'half the knob is half the ground').toBeCloseTo(0.5, 1);
  });

  it('projectileSpeedMul slows the round but PRESERVES its range', () => {
    const w = quiet();
    w.projectileSpeedMul = 0.5;
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.yaw = 0;
    w.throwProjectile(s, 'ar606', 1.4, 120, false);
    const p = [...w.projectiles.values()].pop()!;
    const speed = Math.hypot(p.vel.x, p.vel.z);
    expect(speed, 'the round flies at half pace').toBeCloseTo(60, 0);
    // ttl compensates: reach = speed * ttl stays the weapon's range
    expect(speed * p.ttl, 'the slow round still reaches its range').toBeGreaterThan(40);
  });
});

describe('#4 MATERIEL — the call is priced (§17)', () => {
  it('a call costs its tier, and an empty purse refuses WITHOUT charging', () => {
    const w = quiet();
    expect(w.materiel[0], 'the purse opens at 10').toBe(10);
    expect(w.requestLsw('voltstriker', 0), 'a T1 call goes through').toBe(true);
    expect(w.materiel[0], 'and costs 1').toBe(9);
    w.materiel[1] = 1;
    expect(w.requestLsw('oblivion', 1), 'a T2 against a purse of 1 is refused').toBe(false);
    expect(w.materiel[1], 'a refusal charges nothing').toBe(1);
  });

  it('the drip: war production crawls at +1 per minute', () => {
    const w = quiet();
    w.materiel[0] = 0; w.materiel[1] = 0;
    for (let i = 0; i < 61 * 60; i++) w.step(1 / 60, new Map());
    expect(w.materiel[0], 'sixty seconds buys one').toBe(1);
  });
});

describe('#14 THE SQUAD — the container ships (§15)', () => {
  it('fireteams of four, by roster order — friendly bots ARE your squad', () => {
    const w = quiet();
    const ids: (number | undefined)[] = [];
    for (let i = 0; i < 8; i++) ids.push(w.addSoldier('S' + i, 'infantry', 0, i === 0 ? 'human' : 'bot').squadId);
    expect(ids.slice(0, 4).every((q) => q === ids[0]), 'the first four stand together').toBe(true);
    expect(ids.slice(4).every((q) => q === ids[4]), 'the next four are the second team').toBe(true);
    expect(ids[0], 'two squads, not one').not.toBe(ids[4]);
    const dog = w.addDog(w.soldiers.get(1)! ?? [...w.soldiers.values()][0]);
    expect(dog.squadId, 'K9s stay outside the org chart').toBeUndefined();
  });

  it('SPAWN-ON-SQUADMATE: you rejoin the fight near your people — unless it is hot there', () => {
    const w = quiet();
    const mate = w.addSoldier('MATE', 'infantry', 0, 'bot');
    const dead = w.addSoldier('DEAD', 'infantry', 0, 'bot');
    expect(mate.squadId).toBe(dead.squadId);
    mate.pos = { x: 70, y: 0, z: 70 }; mate.alive = true; mate.downed = false;
    w.spawn(dead);
    expect(Math.hypot(dead.pos.x - 70, dead.pos.z - 70), 'the redeploy lands at the squadmate').toBeLessThan(5);
    // now the mate is in a firefight — the ring takes over
    const foe = w.addSoldier('FOE', 'infantry', 1, 'bot');
    foe.pos = { x: 74, y: 0, z: 70 }; foe.alive = true;
    w.spawn(dead);
    expect(Math.hypot(dead.pos.x - 70, dead.pos.z - 70), 'nobody spawns into a lap — the ring takes over').toBeGreaterThan(10);
  });
});

describe('#18 TALL GRASS + THE DUCK — you are a rumor in the meadow', () => {
  const grassAt = (w: World, x: number, z: number) => {
    const GRID_N = 100, TILE_U = 3;
    w.map.grid[Math.floor((z + 150) / TILE_U) * GRID_N + Math.floor((x + 150) / TILE_U)] = 12; // T_GRASS
  };

  it('standing in the grass the cone loses you at 14u; DUCKED, at the ring', () => {
    const w = quiet();
    const eye = w.addSoldier('EYE', 'infantry', 0, 'human');
    eye.pos = { x: 0, y: 0, z: 0 }; eye.yaw = 0; eye.alive = true;
    const hider = w.addSoldier('HIDE', 'infantry', 1, 'human');
    hider.pos = { x: 20, y: 0, z: 0 }; hider.alive = true;
    grassAt(w, 20, 0);
    for (let i = 0; i < 3; i++) w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(hider.id), 'twenty units of meadow is invisibility').toBeUndefined();
    // walk the eye to 12u: the rumor becomes a silhouette
    eye.pos = { x: 8, y: 0, z: 0 };
    w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(hider.id), 'at 12u the grass gives him up').toBeDefined();
    // now DUCK at 12u: gone again — only the footstep ring finds a croucher
    w.lastSeen[0].delete(hider.id);
    hider.crouching = true;
    w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(hider.id), 'ducked in the grass, 12u is still a rumor').toBeUndefined();
    eye.pos = { x: 13, y: 0, z: 0 };
    w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(hider.id), 'the footstep ring always tells').toBeDefined();
  });

  it('MUZZLE FLASH TELLS THE TRUTH: firing from the grass reveals you', () => {
    const w = quiet();
    const eye = w.addSoldier('EYE', 'infantry', 0, 'human');
    eye.pos = { x: 0, y: 0, z: 0 }; eye.yaw = 0; eye.alive = true;
    const shooter = w.addSoldier('SHOT', 'infantry', 1, 'human');
    shooter.pos = { x: 20, y: 0, z: 0 }; shooter.alive = true;
    grassAt(w, 20, 0);
    shooter.nextFireAt = w.time + 0.1; // just pulled the trigger
    w.step(1 / 60, new Map());
    expect(w.lastSeen[0].get(shooter.id), 'the flash burns through the meadow').toBeDefined();
  });

  it('the duck halves the stride', () => {
    const run = (crouch: boolean) => {
      const w = quiet();
      const s = w.addSoldier('S', 'infantry', 0, 'human');
      s.pos = { x: 0, y: 0, z: 0 }; s.alive = true;
      const cmd = { moveX: 1, moveZ: 0, aimYaw: 0, crouch } as never;
      for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[s.id, cmd]]));
      return s.pos.x;
    };
    expect(run(true) / run(false), 'knees bent, half the ground').toBeCloseTo(0.5, 1);
  });
});

describe('#12 THE IRON EATERS — junk that learned a body plan (DD §20)', () => {
  it('THE MOLT: plated eats the damage, exposed takes DOUBLE and runs hot', () => {
    const w = quiet();
    const rv = w.addIronEater('ravager', { x: 0, y: 0, z: 0 });
    expect(rv.armor, 'born PLATED — the scrap is the health bar').toBeGreaterThan(0);
    const hp0 = rv.hp;
    w.damageSoldier(rv, 100, -1, 'ar606');
    expect(rv.hp, 'while plated the frame is untouched').toBe(hp0);
    rv.armor = 0; // the last plate sheds
    w.damageSoldier(rv, 50, -1, 'ar606');
    expect(hp0 - rv.hp, 'EXPOSED: damage counts double').toBeCloseTo(100, 0);
    expect(rv.rageMul, 'and the beast runs hot — faster, angrier').toBeCloseTo(1.35, 2);
  });

  it('SCRAP-RATS GNAW: a parked hull is food', () => {
    const w = quiet();
    const v = w.spawnVehicle('buggy', 0, { x: 3, y: 0, z: 0 });
    const rat = w.addIronEater('scraprat', { x: 1, y: 0, z: 0 });
    const hp0 = v.hp;
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map());
    expect(v.hp, 'two seconds of rat is real damage').toBeLessThan(hp0);
    void rat;
  });

  it('THE THIRD ACT is an OPT-IN: roster "both" brings scrap from wave 4', () => {
    // Robert's roster law: iron NEVER mixes with zombies unless asked for
    const w = new World({ seed: 42, mode: 'survival', botsPerTeam: 0, hordeRoster: 'both' });
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    h.alive = true;
    w.mode.wave = 3; // the next wave rolled is 4
    w.mode.nextWaveAt = 0;
    w.step(1 / 60, new Map());
    const iron = [...w.soldiers.values()].filter((s) => s.kind === 'scraprat' || s.kind === 'junkhound' || s.kind === 'weaver' || s.kind === 'ravager');
    expect(iron.length, 'a quarter of wave 4 is scrap that stood up').toBeGreaterThan(0);
    expect(iron.every((s) => s.armor > 0), 'every beast arrives PLATED').toBe(true);
  });

  it('THE ROSTER LAW: by default the iron eater is NEVER with the zombies', () => {
    const w = new World({ seed: 42, mode: 'survival', botsPerTeam: 0 }); // default roster
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    h.alive = true;
    for (let wave = 3; wave <= 6; wave++) { // roll waves 4-7 — the old mixing window
      w.mode.wave = wave;
      w.mode.nextWaveAt = 0;
      w.step(1 / 60, new Map());
    }
    const iron = [...w.soldiers.values()].filter((s) => isIron(s.kind));
    expect(iron.length, 'the flesh horde fights alone').toBe(0);
  });

  it('THE ROSTER LAW: "iron" fields ONLY the machine race', () => {
    const w = new World({ seed: 42, mode: 'survival', botsPerTeam: 0, hordeRoster: 'iron' });
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    h.alive = true;
    w.mode.wave = 0; // even wave 1 — no zombies, ever
    w.mode.nextWaveAt = 0;
    w.step(1 / 60, new Map());
    const spawned = [...w.soldiers.values()].filter((s) => s.team === 1 && s.kind !== 'human' && s.kind !== 'bot');
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((s) => isIron(s.kind)), 'all scrap, no flesh').toBe(true);
  });
});

describe('DEATH RE-SELECT — pick your kit between prints (Robert 2026-07-21)', () => {
  it('a dead soldier re-signs; the next print carries the new class', () => {
    const w = quiet();
    const man = w.addSoldier('Flex', 'infantry', 0, 'human');
    w.damageSoldier(man, 9999, -1, 'ar606');
    expect(man.alive).toBe(false);
    expect(w.redeployAs(man, 'medic')).toBe(true);
    w.spawn(man);
    expect(man.classId).toBe('medic');
    expect(man.maxHp).toBe(CLASSES.medic.hp);
    expect(man.weapons[0]).toBe(CLASSES.medic.primary);
  });

  it('the living are refused — kit changes happen at the printer, not mid-fight', () => {
    const w = quiet();
    const man = w.addSoldier('Solid', 'infantry', 0, 'human');
    expect(w.redeployAs(man, 'medic')).toBe(false);
    expect(man.classId).toBe('infantry');
  });
});

describe('THE ARMAMENT DOCTRINE — a god never sounds like infantry', () => {
  it('every LSW carries its SIGNATURE arm — never the recruit rifle, never nothing', () => {
    for (const def of Object.values(LSWS)) {
      const arm = WEAPONS[def.weapon];
      expect(arm, `${def.id} has no weapon def`).toBeTruthy();
      expect(arm.family, `${def.id}'s arm must be family lsw`).toBe('lsw');
      expect(def.weapon, `${def.id} may NEVER carry the AR-606 — the tone law`).not.toBe('ar606');
      const dps = arm.damage * arm.rof * arm.pellets;
      expect(dps, `${def.id}'s ${arm.name} DPS ${dps.toFixed(0)} out of band`).toBeGreaterThan(60);
      expect(dps, `${def.id}'s ${arm.name} DPS ${dps.toFixed(0)} out of band`).toBeLessThan(170);
      expect(arm.clip, 'gods do not fumble magazines').toBe(Infinity);
    }
  });

  it('ascension swaps the arm in; death hands the mortal their own kit back', () => {
    const w = quiet();
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.alive = true;
    expect(w.ascendSoldier(b, 'titan')).toBe(true);
    expect(b.weapons[0], 'the god holds the signature').toBe('lsw_titan');
    expect(b.clip[0]).toBe(Infinity);
    b.alive = false;
    w.spawn(b);
    expect(b.ascendant, 'death hands the body back').toBeUndefined();
    expect(b.weapons[0], 'the mortal gets the CLASS kit, not the god-gun').toBe('ar606');
  });
});

describe('THE MOVEMENT DOCTRINE — every god moves like what it is', () => {
  it('THE LEAP: shadow-telegraphed travel, SOFT mid-air, a shove on landing', () => {
    const w = quiet();
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    t.nextLswAt = 1e9; t.clip = t.clip.map(() => 0);
    const e = w.addSoldier('E', 'infantry', 1, 'human');
    e.pos = { x: 25, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
    for (let i = 0; i < 30 && t.diveAt === undefined; i++) w.step(1 / 60, new Map());
    expect(t.diveAt, 'the leap is telegraphed').toBeDefined();
    const hpA = t.hp;
    w.damageSoldier(t, 100, -1, 'ar606');
    expect(hpA - t.hp, 'mid-leap he is SOFT — the AA window').toBeCloseTo(160, 0);
    for (let i = 0; i < 90; i++) w.step(1 / 60, new Map());
    expect(t.diveAt, 'the landing resolves').toBeUndefined();
    expect(Math.hypot(t.pos.x, t.pos.z), 'thirty units of sky, spent').toBeGreaterThan(15);
  });

  it('THE BLINK-WALK: hops on the beat, statue-still between — you punish the rhythm', () => {
    const w = quiet();
    const v = w.addLsw('voidwalker', 1, { x: 0, y: 0, z: 0 })!;
    v.nextLswAt = 1e9; v.clip = v.clip.map(() => 0);
    v.botGoal = { x: 60, y: 0, z: 0 };
    const marks: number[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      const x0 = v.pos.x;
      w.step(1 / 60, new Map());
      if (Math.abs(v.pos.x - x0) > 3) marks.push(w.time);
    }
    expect(marks.length, 'he hopped on the beat').toBeGreaterThanOrEqual(2);
    expect(Math.hypot(v.pos.x, v.pos.z), 'the hops cover real ground (the brain picks the direction)').toBeGreaterThan(20);
    for (let i = 1; i < marks.length; i++) expect(marks[i] - marks[i - 1], 'on the 1.6s beat').toBeGreaterThan(1.5);
  });

  it('THE STRANGE ONES: the ghost walks through crates, the wraith never lands, the warden falls politely', () => {
    const w = quiet();
    const ph = w.addLsw('phantom', 0, { x: 0, y: 0, z: 0 })!;
    const GRID_N = 100, TILE_U = 3;
    const tz = Math.floor(150 / TILE_U);
    w.map.grid[tz * GRID_N + Math.floor((3 + 150) / TILE_U)] = 2; // a crate in his path
    ph.nextLswAt = 1e9; ph.nextLswActiveAt = 1e9;
    for (let i = 0; i < 60; i++) { ph.vel.x = 8; ph.vel.z = 0; w.step(1 / 60, new Map()); }
    expect(ph.pos.x, 'low cover is AIR to his walk').toBeGreaterThan(4);
    const wr = w.addLsw('wraith', 1, { x: 40, y: 0, z: 40 })!;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(wr.pos.y, 'the wraith floats').toBeGreaterThan(0.4);
  });
});

describe('THE PROJECTILE-SPEED GATE — ALL projectile stuff falls under the knob', () => {
  it('the gate scales a direct round and PRESERVES its range; arcs are exempt', () => {
    const w = quiet();
    const straight = { id: 1, weapon: 'ar606', ownerId: -1, team: 0 as const,
      pos: { x: 0, y: 1, z: 0 }, vel: { x: 100, y: 0, z: 0 }, bornAt: 0, ttl: 2, arc: false } as never;
    w.projectileSpeedMul = 0.5;
    const rangeBefore = 100 * 2;
    w.launch(straight);
    const p = straight as { vel: { x: number }, ttl: number };
    expect(p.vel.x, 'half the knob, half the pace').toBeCloseTo(50, 3);
    expect(p.vel.x * p.ttl, 'the range is untouched — a slow round lives longer').toBeCloseTo(rangeBefore, 1);
    const lob = { id: 2, weapon: 'gl', ownerId: -1, team: 0 as const,
      pos: { x: 0, y: 1, z: 0 }, vel: { x: 40, y: 8, z: 0 }, bornAt: 0, ttl: 3, arc: true } as never;
    w.launch(lob);
    expect((lob as { vel: { x: number } }).vel.x, 'the arc is exempt — it still lands on the cursor').toBe(40);
  });

  it("Robert's case: a round fired FROM A VEHICLE respects the knob", () => {
    const w = quiet();
    w.projectileSpeedMul = 0.5;
    const v = w.spawnVehicle('buggy', 0, { x: 0, y: 0, z: 0 });
    const driver = w.addSoldier('D', 'infantry', 0, 'human');
    driver.alive = true; driver.pos = { x: 0, y: 0, z: 0 };
    v.seats[0] = driver.id; driver.vehicleId = v.id; driver.seat = 0;
    v.nextFireAt = 0;
    const cmd = { moveX: 0, moveZ: 0, aimYaw: 0, fire: true } as never;
    for (let i = 0; i < 3 && w.projectiles.size === 0; i++) w.step(1 / 60, new Map([[driver.id, cmd]]));
    const shot = [...w.projectiles.values()].find((p) => p.weapon === 'buggy_mg');
    expect(shot, 'the buggy fired').toBeTruthy();
    const speed = Math.hypot(shot!.vel.x, shot!.vel.z);
    expect(speed, 'the mounted gun no longer ignores the knob — 110 → 55').toBeCloseTo(55, 0);
  });

  it('a sentry turret round respects the knob too', () => {
    const w = quiet();
    w.projectileSpeedMul = 0.5;
    const owner = w.addSoldier('O', 'infantry', 0, 'bot');
    const t = { id: 90210, team: 0 as const, pos: { x: 0, y: 0, z: 0 }, yaw: 0,
      hp: 180, maxHp: 180, nextFireAt: 0, ownerId: owner.id, alive: true } as never;
    w.turrets.set((t as { id: number }).id, t);
    const foe = w.addSoldier('E', 'infantry', 1, 'human');
    foe.pos = { x: 8, y: 0, z: 0 }; foe.alive = true; foe.protectedUntil = 0;
    for (let i = 0; i < 4 && w.projectiles.size === 0; i++) w.step(1 / 60, new Map());
    const shot = [...w.projectiles.values()].find((p) => p.weapon === 'turret_mg');
    expect(shot, 'the turret fired').toBeTruthy();
    const speed = Math.hypot(shot!.vel.x, shot!.vel.z);
    const base = WEAPONS.turret_mg.speed;
    expect(speed, 'the sentry honors the knob').toBeCloseTo(base * 0.5, 0);
  });
});

describe('THE BLAST: kill circle, falloff, knockback, and the concussion', () => {
  const quietW = () => new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });

  it('the explosion carries its two radii, and the kill circle is a real zone', () => {
    const w = quietW();
    w.takeEvents();
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 1);
    const ev = w.takeEvents().find((e) => e.type === 'explosion');
    expect(ev?.radius, 'the splash reach rides the event').toBeCloseTo(WEAPONS.gl.splash, 3);
    expect(ev?.killRadius, 'so does the kill circle').toBeGreaterThan(1);
    expect(ev!.killRadius!, 'the kill circle is inside the reach').toBeLessThan(ev!.radius!);
  });

  it('closer is deadlier: inside the kill circle you die, at the rim you are only chipped', () => {
    const dmgAt = (dist: number) => {
      const w = quietW();
      const e = w.addSoldier('E', 'infantry', 1, 'human');
      e.pos = { x: dist, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0; e.maxHp = 999; e.hp = 999;
      w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 0);
      return 999 - e.hp;
    };
    const core = dmgAt(1.0), mid = dmgAt(4.0), rim = dmgAt(5.9);
    expect(core, 'the heart is lethal (100+)').toBeGreaterThan(100);
    expect(mid, 'the middle bites less than the heart').toBeLessThan(core);
    expect(rim, 'the rim only chips').toBeLessThan(mid);
    expect(rim, 'but the rim still touches').toBeGreaterThan(0);
  });

  it('knockback scales with proximity too — the close man is thrown hardest', () => {
    const shoveAt = (dist: number) => {
      const w = quietW();
      const e = w.addSoldier('E', 'infantry', 1, 'human');
      e.pos = { x: dist, y: 0, z: 0 }; e.alive = true; e.protectedUntil = 0;
      w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 0);
      return Math.abs(e.pushX);
    };
    expect(shoveAt(1.5), 'close = flung').toBeGreaterThan(shoveAt(4.5));
  });

  it('THE CONCUSSION vs a FRAG: same core spot, the rattle barely bites where the frag kills', () => {
    // detonate each at a stationary dummy 2u off the blast and compare
    const hitBy = (wid: 'conc_nade' | 'gl') => {
      const w = quietW();
      const d = w.addSoldier('D', 'infantry', 1, 'bot');
      d.pos = { x: 2, y: 0, z: 0 }; d.alive = true; d.dummy = true; d.protectedUntil = 0; d.maxHp = 400; d.hp = 400;
      w.explode({ x: 0, y: 0, z: 0 }, WEAPONS[wid], -1, 0);
      return { dmg: 400 - d.hp, shove: Math.abs(d.pushX), fireLock: d.nextFireAt, blind: d.blindUntil ?? 0 };
    };
    const conc = hitBy('conc_nade'), frag = hitBy('gl');
    expect(conc.dmg, 'the rattle barely bites').toBeLessThan(30);
    expect(frag.dmg, 'the frag is lethal at the same spot').toBeGreaterThan(90);
    expect(conc.shove, 'but the rattle SHOVES hard — harder than the frag').toBeGreaterThan(frag.shove);
  });

  it('THE CONCUSSION staggers: thrown at a dummy, it locks the trigger and disorients', () => {
    const w = quietW();
    const thrower = w.addSoldier('T', 'infantry', 0, 'human');
    w.spawn(thrower); // stock the bag — then plant him at the origin
    thrower.pos = { x: 0, y: 0, z: 0 }; thrower.yaw = 0;
    thrower.nadeSel = 3; // concussion in hand
    // a short row of stationary dummies in the lane — the rattle catches some
    const foes = [4, 5, 6, 7].map((x) => {
      const f = w.addSoldier('E' + x, 'infantry', 1, 'bot');
      f.pos = { x, y: 0, z: 0 }; f.alive = true; f.dummy = true; f.protectedUntil = 0;
      return f;
    });
    w.step(1 / 60, new Map([[thrower.id, { moveX: 0, moveZ: 0, aimYaw: 0, grenade: true, aimDist: 6 } as never]]));
    let anyLocked = false, anyBlind = false;
    for (let i = 0; i < 60 * 4; i++) {
      w.step(1 / 60, new Map());
      for (const f of foes) {
        if (f.nextFireAt > w.time + 0.3) anyLocked = true;
        if ((f.blindUntil ?? 0) > w.time) anyBlind = true;
      }
    }
    expect(anyLocked, 'the rattle-nade locked a trigger').toBe(true);
    expect(anyBlind, 'and disoriented a bot').toBe(true);
    expect(Math.max(...foes.map((f) => f.maxHp - f.hp)), 'it rattles, it does not kill').toBeLessThan(40);
  });
});
