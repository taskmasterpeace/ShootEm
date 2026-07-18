// ---------------------------------------------------------------------------
// THE FINISH LIST (Robert's 18-feature goal) — the laws that pin each item
// as it ships. Rescue behavior (#9), the speed sliders (#13), and whatever
// lands next: every feature gets a law here so "finished" stays finished.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { LSWS } from '../src/sim/lsw';
import { objectiveFor } from '../src/sim/bots';
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
    const rescuer = w.addSoldier('R', 'infantry', 0, 'bot');
    rescuer.pos = { x: 40, y: 0, z: 40 }; rescuer.alive = true; // inside the 70u answer radius
    // rescuer classes matter: infantry with even id may raid; force a raider shape
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

  it('THE THIRD ACT: from wave 4 the horde brings scrap', () => {
    const w = new World({ seed: 42, mode: 'survival', botsPerTeam: 0 });
    const h = w.addSoldier('H', 'infantry', 0, 'human');
    h.alive = true;
    w.mode.wave = 3; // the next wave rolled is 4
    w.mode.nextWaveAt = 0;
    w.step(1 / 60, new Map());
    const iron = [...w.soldiers.values()].filter((s) => s.kind === 'scraprat' || s.kind === 'junkhound' || s.kind === 'weaver' || s.kind === 'ravager');
    expect(iron.length, 'a quarter of wave 4 is scrap that stood up').toBeGreaterThan(0);
    expect(iron.every((s) => s.armor > 0), 'every beast arrives PLATED').toBe(true);
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
