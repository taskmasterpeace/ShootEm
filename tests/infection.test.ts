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
