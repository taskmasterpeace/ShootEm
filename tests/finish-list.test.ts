// ---------------------------------------------------------------------------
// THE FINISH LIST (Robert's 18-feature goal) — the laws that pin each item
// as it ships. Rescue behavior (#9), the speed sliders (#13), and whatever
// lands next: every feature gets a law here so "finished" stays finished.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
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
