// ---------------------------------------------------------------------------
// THE OUTBREAK, slice 1 (OUTBREAK-SPEC §4/§6): infection is separate from
// damage, exposed corpses rise on an authoritative clock, blasts deny them,
// and the machinery is INERT until outbreakEnabled — every pre-outbreak match
// must be byte-identical to before this system existed.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';

function makeWorld(outbreak: boolean) {
  const w = new World({ seed: 777, mode: 'tdm', matchMinutes: 10 });
  w.outbreakEnabled = outbreak;
  return w;
}

describe('outbreak: infection is separate from damage', () => {
  it('a claw delivers Viral Load; a bullet never does', () => {
    const w = makeWorld(true);
    const man = w.addSoldier('Mark', 'infantry', 0, 'bot');
    w.damageSoldier(man, 5, -1, 'zombie_claw');
    expect(man.viralLoad).toBeGreaterThan(0);
    const clean = w.addSoldier('Clean', 'infantry', 0, 'bot');
    w.damageSoldier(clean, 30, -1, 'ar606');
    expect(clean.viralLoad ?? 0).toBe(0);
  });

  it('armor does not stop contamination (damage ≠ infection)', () => {
    const w = makeWorld(true);
    const man = w.addSoldier('Plated', 'heavy', 0, 'bot');
    man.armor = 100; man.maxArmor = 100;
    w.damageSoldier(man, 5, -1, 'zombie_claw');
    expect(man.viralLoad).toBeGreaterThan(0); // the plate was bitten too
  });

  it('with the outbreak OFF the claw is just a claw', () => {
    const w = makeWorld(false);
    const man = w.addSoldier('Calm', 'infantry', 0, 'bot');
    w.damageSoldier(man, 5, -1, 'zombie_claw');
    expect(man.viralLoad ?? 0).toBe(0);
    expect(w.corpses.length).toBe(0);
  });
});

describe('outbreak: the corpse clock', () => {
  function infectAndKill(w: World) {
    const man = w.addSoldier('Victim', 'infantry', 0, 'bot');
    man.pos = { x: 0, y: 0, z: 0 };
    // bite him hot (≥40), then finish him with a rifle
    w.damageSoldier(man, 1, -1, 'zombie_claw');
    w.damageSoldier(man, 1, -1, 'zombie_claw');
    expect((man.viralLoad ?? 0)).toBeGreaterThanOrEqual(40);
    w.damageSoldier(man, 9999, -1, 'ar606');
    expect(man.alive).toBe(false);
    return man;
  }

  it('a hot death books a corpse; time raises it as a named shambler', () => {
    const w = makeWorld(true);
    infectAndKill(w);
    expect(w.corpses.length).toBe(1);
    // watch for the reanimation event — the unambiguous proof the clock fired
    // (the lone risen shambler may then be gunned down by a respawned bot and
    // culled, so a soldier-count assertion is flaky; the EVENT never lies)
    let rose: { name?: string } | null = null;
    for (let i = 0; i < 60 * 15 && !rose; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) {
        if (e.type === 'reanimated') {
          const z = w.soldiers.get(e.soldierId ?? -1);
          rose = { name: z?.name };
        }
      }
    }
    expect(rose).not.toBeNull();
    expect(rose!.name).toContain('Victim');
    expect(w.corpses.length).toBe(0); // off the books once risen
  });

  it('fires a CRITICAL warning in the final window before it rises (§6)', () => {
    const w = makeWorld(true);
    infectAndKill(w);
    let criticalAt = -1, roseAt = -1;
    for (let i = 0; i < 60 * 15 && roseAt < 0; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) {
        if (e.type === 'corpse_critical' && criticalAt < 0) criticalAt = w.time;
        if (e.type === 'reanimated') roseAt = w.time;
      }
    }
    expect(criticalAt).toBeGreaterThan(0);
    expect(roseAt).toBeGreaterThan(0);
    expect(criticalAt).toBeLessThan(roseAt);            // the last-chance alert came first
    expect(roseAt - criticalAt).toBeLessThanOrEqual(2.1); // ...inside the final ~2s window
  });

  it('a cold death (viral < 40) books nothing', () => {
    const w = makeWorld(true);
    const man = w.addSoldier('Cold', 'infantry', 0, 'bot');
    w.damageSoldier(man, 1, -1, 'zombie_claw'); // one bite: 22, under threshold
    w.damageSoldier(man, 9999, -1, 'ar606');
    expect(w.corpses.length).toBe(0);
  });

  it('a blast neutralizes the body — it never rises', () => {
    const w = makeWorld(true);
    infectAndKill(w);
    expect(w.corpses.length).toBe(1);
    w.explode({ x: 0, y: 0, z: 0 }, WEAPONS.gl, -1, 1); // the frag yardstick burns the body
    for (let i = 0; i < 60 * 15; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    const zeds = [...w.soldiers.values()].filter((s) => s.kind === 'zombie' && s.alive);
    expect(zeds.length).toBe(0);
  });

  it('the next print is clean — death zeroes the strain', () => {
    const w = makeWorld(true);
    const man = infectAndKill(w);
    expect(man.viralLoad ?? 0).toBe(0);
  });
});

describe('outbreak: incubation and the turn (§4)', () => {
  it('an exposed soldier untreated creeps toward conversion and TURNS', () => {
    const w = makeWorld(true);
    const man = w.addSoldier('Carrier', 'infantry', 0, 'bot');
    man.pos = { x: 0, y: 0, z: 0 };
    man.viralLoad = 70; // heavily exposed, unattended
    let turned = false;
    for (let i = 0; i < 60 * 40 && !turned; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) {
        if (e.type === 'reanimated') { const z = w.soldiers.get(e.soldierId ?? -1); if (z?.name.includes('Carrier') && z.name.includes('turned')) turned = true; }
      }
    }
    expect(turned).toBe(true);
  });

  it('a medic self-stim walks the strain back down (§3.1 treatment)', () => {
    const w = makeWorld(true);
    const medic = w.addSoldier('Doc', 'medic', 0, 'human');
    medic.viralLoad = 50; medic.energy = 100; medic.hp = medic.maxHp;
    const cmd = new Map([[medic.id, { moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false, use: false, ability: true, reload: false, grenade: false, weaponSlot: -1 }]]);
    w.step(1 / 60, cmd);
    expect(medic.viralLoad!).toBeLessThan(50);
  });

  it('the creep is INERT with the outbreak off', () => {
    const w = makeWorld(false);
    const man = w.addSoldier('Frozen', 'infantry', 0, 'bot');
    man.viralLoad = 90;
    for (let i = 0; i < 60 * 20; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(man.viralLoad).toBe(90); // untouched
    expect(man.alive).toBe(true);
  });
});

describe('outbreak: emergent variants from the body (§7)', () => {
  function riseFrom(classId: 'heavy' | 'infiltrator' | 'infantry') {
    const w = makeWorld(true);
    const man = w.addSoldier('Body', classId, 0, 'bot');
    man.pos = { x: 0, y: 0, z: 0 };
    w.damageSoldier(man, 1, -1, 'zombie_claw');
    w.damageSoldier(man, 1, -1, 'zombie_claw'); // ≥40 hot
    w.damageSoldier(man, 9999, -1, 'ar606');
    let kind = '';
    for (let i = 0; i < 60 * 15 && !kind; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) {
        if (e.type === 'reanimated') kind = w.soldiers.get(e.soldierId ?? -1)?.kind ?? '';
      }
    }
    return kind;
  }
  it('a plated heavy rises as a BRUTE', () => { expect(riseFrom('heavy')).toBe('brute'); });
  it('a scout rises as a SPRINTER (the lean infected)', () => { expect(riseFrom('infiltrator')).toBe('sprinter'); });
  it('a line trooper rises as a base shambler', () => { expect(riseFrom('infantry')).toBe('zombie'); });
});

describe('outbreak: pressure and levels (§3)', () => {
  it('a growing horde escalates the level; clearing it de-escalates', () => {
    const w = makeWorld(true);
    const sp = w.map.zombieSpawns[0] ?? { x: 0, y: 0, z: 0 };
    expect(w.outbreakLevel).toBe(0);
    const zeds = [];
    for (let i = 0; i < 30; i++) zeds.push(w.addZombie('zombie', { x: sp.x + (i % 6), y: 0, z: sp.z + Math.floor(i / 6) }));
    for (let i = 0; i < 60 * 10; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(w.outbreakLevel).toBeGreaterThanOrEqual(3); // 30 infected = high pressure
    // wipe them and let it settle
    for (const z of zeds) { z.alive = false; }
    for (let i = 0; i < 60 * 15; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(w.outbreakLevel).toBeLessThan(3); // pressure drained
  });

  it('the level stays 0 with the outbreak off, no matter the horde', () => {
    const w = makeWorld(false);
    const sp = w.map.zombieSpawns[0] ?? { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 20; i++) w.addZombie('zombie', { x: sp.x, y: 0, z: sp.z });
    for (let i = 0; i < 60 * 8; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(w.outbreakLevel).toBe(0);
    expect(w.outbreakPressure).toBe(0);
  });
});

describe('outbreak: mutation fields from corpse nests (§8)', () => {
  function pile(w: World, n: number, reanimatesAt: number, at = { x: 0, z: 0 }) {
    for (let i = 0; i < n; i++) {
      w.corpses.push({ pos: { x: at.x + i * 0.5, y: 0, z: at.z }, reanimatesAt, neutralized: false, name: `Body${i}`, classId: 'infantry' });
    }
  }

  it('a dense corpse pile curdles into a contamination nest', () => {
    const w = makeWorld(true);
    pile(w, 5, w.time + 60); // five bodies rotting shoulder to shoulder
    let contaminated = false;
    for (let i = 0; i < 60 * 3 && !contaminated; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) if (e.type === 'contamination') contaminated = true;
    }
    expect(contaminated).toBe(true);
    expect(w.nests.length).toBeGreaterThan(0);
    expect(w.inNest(0, 0)).toBe(true);
    expect(w.inNest(40, 40)).toBe(false); // the field is local
  });

  it('a body rising inside the nest rises MUTATED — tougher than a plain shambler', () => {
    const w = makeWorld(true);
    pile(w, 4, w.time + 60);                    // four sustain the field
    w.corpses.push({ pos: { x: 0.5, y: 0, z: 0.5 }, reanimatesAt: w.time + 3, neutralized: false, name: 'Riser', classId: 'infantry' });
    let risenHp = -1;
    for (let i = 0; i < 60 * 6 && risenHp < 0; i++) {
      w.step(1 / 60, new Map());
      for (const e of w.takeEvents()) {
        if (e.type === 'reanimated') {
          const z = w.soldiers.get(e.soldierId ?? -1);
          if (z?.name.includes('Riser')) risenHp = z.maxHp;
        }
      }
    }
    expect(risenHp).toBeGreaterThan(60); // base shambler is 60hp; a mutated one is ×1.4
  });

  it('with the outbreak OFF no nest ever forms, however the bodies fall', () => {
    const w = makeWorld(false);
    pile(w, 6, w.time + 60);
    for (let i = 0; i < 60 * 4; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(w.nests.length).toBe(0);
  });
});

describe('outbreak: inert by default (the byte-identical law)', () => {
  it('two full matches, outbreak off — no corpses, no viral, ever', () => {
    const w = makeWorld(false);
    for (const team of [0, 1] as const) {
      for (let i = 0; i < 6; i++) w.addSoldier(`B${team}${i}`, 'infantry', team, 'bot');
    }
    for (let i = 0; i < 60 * 20; i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
    expect(w.corpses.length).toBe(0);
    for (const s of w.soldiers.values()) expect(s.viralLoad ?? 0).toBe(0);
  });
});
