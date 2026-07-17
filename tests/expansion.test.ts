// ---------------------------------------------------------------------------
// The Infantry expansion: arsenal, multi-crew vehicles, equipment, recon,
// environments.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// THE SIDEGRADE LAW (Robert, 2026-07-16): no mark is strictly better. Higher
// marks buy damage and precision by PAYING in magazine and reload — a rookie's
// Mk I loses nothing to a veteran's Mk III but taste. This suite is the law.
// ---------------------------------------------------------------------------
import { FAMILIES } from '../src/sim/arsenal';
import { WEAPONS as ALL_W } from '../src/sim/data';

describe('marks are sidegrades, never upgrades', () => {
  it('every family, every brand: Mk III hits harder but feeds worse than Mk I', () => {
    for (const f of FAMILIES) {
      const marks = Object.values(ALL_W).filter((w) => w.family === f.family && w.tier);
      const byBrand = new Map<string, typeof marks>();
      for (const w of marks) {
        const brand = w.id.split('_').slice(0, -1).join('_');
        if (!byBrand.has(brand)) byBrand.set(brand, []);
        byBrand.get(brand)!.push(w);
      }
      for (const [brand, line] of byBrand) {
        const mk1 = line.find((w) => w.tier === 1);
        const mk3 = line.find((w) => w.tier === 3);
        if (!mk1 || !mk3) continue;
        expect(mk3.damage, `${brand} mk3 must out-hit mk1`).toBeGreaterThan(mk1.damage);
        // single-shell weapons (AT rockets) can't shrink below one round —
        // their sidegrade price is paid entirely at the reload
        if (mk1.clip > 1) expect(mk3.clip, `${brand} mk3 must carry a smaller magazine`).toBeLessThan(mk1.clip);
        expect(mk3.reloadTime, `${brand} mk3 must reload slower`).toBeGreaterThanOrEqual(mk1.reloadTime);
      }
    }
  });
});
import { buildArsenal, CLASS_ARMORY, familyWeapons } from '../src/sim/arsenal';
import { CLASSES, EQUIPMENT, THEMES, VEHICLES, WEAPONS } from '../src/sim/data';
import { T_OPEN, T_WATER, TILE, WORLD, generateMap, losClear } from '../src/sim/map';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import { SYSTEM_IDS, type ClassId, type PlayerCmd, type WeaponFamily } from '../src/sim/types';
import { World } from '../src/sim/world';
import { KILLCAM_S, REPLAY_KEEP_S, ReplayPlayer, ReplayRecorder } from '../src/client/replay';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) w.step(1 / 60, cmds);
};

describe('the arsenal', () => {
  it('fields 200+ weapons, every entry integrity-checked', () => {
    const ids = Object.keys(WEAPONS);
    expect(ids.length).toBeGreaterThanOrEqual(200);
    for (const id of ids) {
      const w = WEAPONS[id];
      expect(w.id).toBe(id);
      expect(w.name.length).toBeGreaterThan(2);
      expect(w.rof).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(0);
      expect(w.clip).toBeGreaterThan(0);
      if (!w.payload && !w.heals) expect(w.damage).toBeGreaterThanOrEqual(0);
    }
  });

  it('covers every classic family: lasers to artillery to sonic', () => {
    const families: WeaponFamily[] = [
      'pistol', 'rifle', 'carbine', 'smg', 'shotgun', 'slugger', 'laser', 'lmg', 'hmg',
      'at_rocket', 'ap_rocket', 'mortar', 'artillery', 'scatter', 'sonic', 'flamethrower', 'grenade',
    ];
    for (const f of families) {
      expect(familyWeapons(WEAPONS, f).length, `family ${f}`).toBeGreaterThanOrEqual(3);
    }
    // smoke + phosphorus grenade variants exist and carry field payloads
    expect(WEAPONS.grenade_smoke_2.payload).toBe('smoke');
    expect(WEAPONS.grenade_wp_2.payload).toBe('fire');
    expect(WEAPONS.demo_charge.splash).toBeGreaterThan(5);
    expect(WEAPONS.emplacement_gun.range).toBeGreaterThan(80);
  });

  it('generated weapons respect balance ceilings', () => {
    for (const w of Object.values(buildArsenal())) {
      const dps = w.damage * w.pellets * w.rof;
      expect(dps, `${w.id} dps ${dps}`).toBeLessThanOrEqual(260);
      expect(w.range, w.id).toBeLessThanOrEqual(130);
      expect(w.reloadTime, w.id).toBeLessThanOrEqual(5);
      expect(w.spread, w.id).toBeLessThan(0.5);
    }
  });

  it('every class armory family has draws, and bots use them', () => {
    for (const cls of Object.keys(CLASS_ARMORY) as ClassId[]) {
      for (const fam of CLASS_ARMORY[cls]) {
        expect(familyWeapons(WEAPONS, fam).length, `${cls}/${fam}`).toBeGreaterThan(0);
      }
    }
    // a big enough bot sample draws at least one non-issue primary
    const w = new World({ seed: 9, mode: 'tdm' });
    let varied = 0;
    for (let i = 0; i < 20; i++) {
      const b = w.addSoldier(`B${i}`, 'infantry', 0, 'bot');
      if (b.weapons[0] !== CLASSES.infantry.primary) varied++;
    }
    expect(varied).toBeGreaterThan(0);
  });

  it('humans deploy with their chosen armory loadout and keep it across respawns', () => {
    const w = new World({ seed: 9, mode: 'tdm' });
    const s = w.addSoldier('A', 'infantry', 0, 'human', { primary: 'laser_maklov_2', secondary: 'pistol_kuchler_1' });
    expect(s.weapons[0]).toBe('laser_maklov_2');
    w.damageSoldier(s, 9999, s.id, 'ar606');
    run(w, new Map(), 5);
    expect(s.alive).toBe(true);
    expect(s.weapons[0]).toBe('laser_maklov_2');
    expect(s.weapons[1]).toBe('pistol_kuchler_1');
  });
});

describe('multi-crew vehicles', () => {
  it('the tank carries crew stations plus four passengers, each system with its own hit points', () => {
    expect(VEHICLES.tank.seats).toBe(8);
    expect(VEHICLES.tank.crew).toEqual(['sensors', 'ecm', 'comms']);
    const w = new World({ seed: 42, mode: 'tdm' });
    const tank = [...w.vehicles.values()].find((v) => v.kind === 'tank')!;
    for (const sys of SYSTEM_IDS) expect(tank.systems[sys]).toBeGreaterThan(0);
  });

  it('hits chew into subsystems; a dead engine slows the vehicle', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const tank = [...w.vehicles.values()].find((v) => v.kind === 'tank' && v.team === 0)!;
    const d = w.addSoldier('D', 'infantry', 0, 'human');
    d.pos = { ...tank.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    expect(d.vehicleId).toBe(tank.id);

    // pound the hull until some subsystem dies
    let sysDead = false;
    for (let i = 0; i < 60 && !sysDead; i++) {
      w.damageVehicle(tank, 30, -1, 'ar606');
      sysDead = SYSTEM_IDS.some((id) => tank.systems[id] <= 0);
    }
    expect(sysDead).toBe(true);
    expect(tank.alive).toBe(true); // damaged in all sorts of ways, still rolling

    // now measure crippled vs healthy engine top speed on open ground
    const topSpeed = (engineHp: number) => {
      tank.pos = { ...w.map.hillPos };
      tank.vel = { x: 0, y: 0, z: 0 };
      tank.yaw = 0;
      tank.systems.engine = engineHp;
      let top = 0;
      for (let i = 0; i < 90; i++) {
        w.step(1 / 60, new Map([[d.id, cmd({ moveZ: -1 })]]));
        top = Math.max(top, Math.hypot(tank.vel.x, tank.vel.z));
      }
      return top;
    };
    const crippled = topSpeed(0);
    const healthy = topSpeed(100);
    expect(crippled).toBeLessThan(healthy * 0.6);
  });

  it('transport: gunner station fires, passengers ride and disembark', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const tr = [...w.vehicles.values()].find((v) => v.kind === 'transport' && v.team === 0)!;
    // stage the fight on the hill clearing — guaranteed open ground
    tr.pos = { ...w.map.hillPos };
    // driver + a bot gunner + a passenger
    const driver = w.addSoldier('Drv', 'infantry', 0, 'human');
    const gunner = w.addSoldier('Gun', 'infantry', 0, 'bot');
    const pax = w.addSoldier('Pax', 'infantry', 0, 'human');
    for (const s of [driver, gunner, pax]) s.pos = { ...tr.pos };
    w.step(1 / 60, new Map([[driver.id, cmd({ use: true })]]));
    // manually seat the bot at the gunner station and the passenger behind
    const gunnerSeat = 1 + VEHICLES.transport.crew!.indexOf('gunner');
    tr.seats[gunnerSeat] = gunner.id; gunner.vehicleId = tr.id; gunner.seat = gunnerSeat;
    tr.seats[5] = pax.id; pax.vehicleId = tr.id; pax.seat = 5;

    // an enemy strolls into range — the manned gun opens up on its own
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: tr.pos.x + 10, y: 0, z: tr.pos.z };
    let fired = false;
    for (let i = 0; i < 120 && !fired; i++) {
      w.step(1 / 60, new Map([[foe.id, cmd()]]));
      fired = [...w.projectiles.values()].some((p) => p.weapon === 'transport_mg');
    }
    expect(fired).toBe(true);

    // passenger bails out (after the same-keypress guard window passes)
    run(w, new Map(), 0.5);
    w.step(1 / 60, new Map([[pax.id, cmd({ use: true })]]));
    expect(pax.vehicleId).toBe(-1);
    expect(tr.seats[5]).toBe(-1);
  });

  it('a comms-dead transport stops acting as a mobile spawn', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const tr = [...w.vehicles.values()].find((v) => v.kind === 'transport' && v.team === 0)!;
    const d = w.addSoldier('D', 'infantry', 0, 'human');
    d.pos = { ...tr.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    tr.pos = { x: 50, y: 0, z: 50 };
    tr.systems.comms = 0; // comms destroyed
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    // 40 respawns: none should ever appear at the dead-comms transport
    for (let i = 0; i < 40; i++) {
      w.spawn(s);
      expect(Math.hypot(s.pos.x - 50, s.pos.z - 50)).toBeGreaterThan(8);
    }
  });
});

describe('the new machines', () => {
  it('the tunneler grinds walls into open ground and replicates the digs', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const tun = [...w.vehicles.values()].find((v) => v.kind === 'tunneler' && v.team === 0)!;
    const d = w.addSoldier('D', 'engineer', 0, 'human');
    d.pos = { ...tun.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    expect(d.vehicleId).toBe(tun.id);
    // park the machine just east of a known INTERIOR wall tile, facing it
    const GRID_N = 100;
    let wallTx = -1, wallTz = -1;
    outer: for (let tz = 20; tz < GRID_N - 20; tz++) {
      for (let tx = 8; tx < GRID_N - 20; tx++) {
        // interior wall with 4 open tiles east of it to stand on
        if (w.map.grid[tz * GRID_N + tx] === 1 &&
            w.map.grid[tz * GRID_N + tx + 1] === T_OPEN &&
            w.map.grid[tz * GRID_N + tx + 2] === T_OPEN &&
            w.map.grid[tz * GRID_N + tx + 3] === T_OPEN &&
            w.map.grid[tz * GRID_N + tx + 4] === T_OPEN) {
          wallTx = tx; wallTz = tz;
          break outer;
        }
      }
    }
    expect(wallTx).toBeGreaterThan(0);
    tun.pos = { x: (wallTx + 3.5) * TILE - WORLD / 2, y: 0, z: (wallTz + 0.5) * TILE - WORLD / 2 };
    tun.yaw = Math.PI; // face -X, straight at the wall
    let dug = false;
    for (let i = 0; i < 60 * 20 && !dug; i++) {
      w.step(1 / 60, new Map([[d.id, cmd({ moveZ: -1 })]]));
      dug = w.dug.length > 0;
    }
    expect(dug).toBe(true);

    // the dug tile is now open ground, and a puppet applying the snapshot agrees
    const idx = w.dug[0];
    expect(w.map.grid[idx]).toBe(T_OPEN);
    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = new World({ seed: 42, mode: 'tdm' });
    w2.puppet = true;
    expect(w2.map.grid[idx]).not.toBe(T_OPEN); // same seed still has the wall
    applySnapshot(w2, snap);
    expect(w2.map.grid[idx]).toBe(T_OPEN);
  });

  it('the ambulance heals wounded soldiers around it', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const amb = [...w.vehicles.values()].find((v) => v.kind === 'ambulance' && v.team === 0)!;
    const s = w.addSoldier('Hurt', 'infantry', 0, 'human');
    s.pos = { x: amb.pos.x + 3, y: 0, z: amb.pos.z };
    s.hp = 30;
    // hold still next to the ambulance (idle cmd keeps him from wandering off)
    run(w, new Map([[s.id, cmd()]]), 4);
    expect(s.hp).toBeGreaterThan(30);
  });

  it('the flyer spools its rotors before liftoff, then soars over walls', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const fly = [...w.vehicles.values()].find((v) => v.kind === 'flyer' && v.team === 0)!;
    const d = w.addSoldier('D', 'infantry', 0, 'human');
    d.pos = { ...fly.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    expect(d.vehicleId).toBe(fly.id);
    // boarding starts the spool — the bird is pinned to the pad until it ends
    expect(fly.spoolUntil).toBeGreaterThan(w.time);
    fly.yaw = 0;
    const startX = fly.pos.x;
    run(w, new Map([[d.id, cmd({ moveZ: -1 })]]), 2); // still spooling (2.5s)
    expect(Math.abs(fly.pos.x - startX)).toBeLessThan(0.01);
    run(w, new Map([[d.id, cmd({ moveZ: -1 })]]), 5); // airborne now
    expect(fly.pos.x).toBeGreaterThan(startX + 30); // nothing stopped it
  });

  it('the emplacement gun holds its ground and thunders', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const emp = [...w.vehicles.values()].find((v) => v.kind === 'emplacement' && v.team === 0)!;
    const d = w.addSoldier('D', 'heavy', 0, 'human');
    d.pos = { ...emp.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    expect(d.vehicleId).toBe(emp.id);
    const at = { ...emp.pos };
    run(w, new Map([[d.id, cmd({ moveZ: -1, fire: true, aimYaw: 0 })]]), 1.5);
    expect(Math.hypot(emp.pos.x - at.x, emp.pos.z - at.z)).toBeLessThan(0.01); // never moves
    expect([...w.projectiles.values()].some((p) => p.weapon === 'emplacement_gun')).toBe(true);
  });

  it('hoverboards are unarmed hover decks; bikes outrun buggies', () => {
    expect(VEHICLES.hoverboard.weapon).toBe('');
    expect(VEHICLES.hoverboard.hover).toBe(true);
    expect(VEHICLES.bike.speed).toBeGreaterThan(VEHICLES.buggy.speed);
    expect(VEHICLES.tunneler.digs).toBe(true);
    expect(VEHICLES.flyer.flies).toBe(true);
    expect(VEHICLES.ambulance.healRadius).toBeGreaterThan(0);
  });
});

describe('equipment', () => {
  const world = () => new World({ seed: 21, mode: 'tdm' });

  it('armor equipment issues plate — a separate pool, hp stays class base', () => {
    const w = world();
    const vest = w.addSoldier('V', 'infantry', 0, 'human', { equipment: ['armor_vest'] });
    expect(vest.maxHp).toBe(CLASSES.infantry.hp);
    expect(vest.maxArmor).toBe(25);
    const tank = w.addSoldier('P', 'infantry', 0, 'human', { equipment: ['power_armor'] });
    expect(tank.maxHp).toBe(CLASSES.infantry.hp);
    expect(tank.maxArmor).toBe(60);
    expect(Object.keys(EQUIPMENT).length).toBeGreaterThanOrEqual(12);
  });

  it('the combat medikit auto-triggers once per life below 25%', () => {
    const w = world();
    const s = w.addSoldier('M', 'infantry', 0, 'human', { equipment: ['medikit'] });
    w.damageSoldier(s, s.maxHp * 0.8, -1, 'ar606'); // drops below 25%
    expect(s.alive).toBe(true);
    expect(s.hp).toBeGreaterThan(s.maxHp * 0.25); // stim kicked in
    expect(s.medikitReady).toBe(false); // once per life
  });

  it('the stealth suit defeats targeting beacons', () => {
    const w = world();
    const sneak = w.addSoldier('S', 'infantry', 1, 'human', { equipment: ['stealth_suit'] });
    const loud = w.addSoldier('L', 'infantry', 1, 'human');
    sneak.pos = { x: 0, y: 0, z: 0 };
    loud.pos = { x: 2, y: 0, z: 0 };
    w.spawnGadget('target_beacon', 0, -1, { x: 0, y: 0, z: 0 }, 60, 15);
    run(w, new Map([[sneak.id, cmd()], [loud.id, cmd()]]), 0.5);
    expect(w.pinged.has(loud.id)).toBe(true);
    expect(w.pinged.has(sneak.id)).toBe(false);
  });

  it('demolition kit plants DX-9 charges on G', () => {
    const w = world();
    const s = w.addSoldier('D', 'infantry', 0, 'human', { equipment: ['demo_kit'] });
    expect(s.grenades).toBe(3);
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true })]]));
    expect([...w.projectiles.values()].some((p) => p.weapon === 'demo_charge')).toBe(true);
  });

  it('the hacking kit flips enemy sentries', () => {
    const w = world();
    const hacker = w.addSoldier('H', 'infantry', 0, 'human', { equipment: ['hacking_kit'] });
    w.turrets.set(999, { id: 999, team: 1, pos: { ...hacker.pos }, yaw: 0, hp: 180, maxHp: 180, nextFireAt: 0, ownerId: -1, alive: true });
    w.step(1 / 60, new Map([[hacker.id, cmd({ use: true })]]));
    expect(w.turrets.get(999)!.team).toBe(0);
  });

  it('the mechanic kit patches a mangled vehicle', () => {
    const w = world();
    const fixer = w.addSoldier('F', 'engineer', 0, 'human', { equipment: ['repair_kit'] });
    const v = [...w.vehicles.values()].find((x) => x.team === 0 && x.kind === 'buggy')!;
    v.hp = 50;
    fixer.pos = { x: v.pos.x + 2, y: 0, z: v.pos.z };
    w.step(1 / 60, new Map([[fixer.id, cmd({ use: true })]]));
    expect(v.hp).toBeGreaterThanOrEqual(170);
  });

  it('the spy camera deploys and feeds enemy positions', () => {
    const w = world();
    const spy = w.addSoldier('S', 'ghost', 0, 'human', { equipment: ['spy_camera'] });
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    spy.pos = { x: 0, y: 0, z: 0 };
    foe.pos = { x: 8, y: 0, z: 0 };
    w.step(1 / 60, new Map([[spy.id, cmd({ grenade: true })], [foe.id, cmd()]]));
    expect([...w.gadgets.values()].some((g) => g.type === 'camera')).toBe(true);
    run(w, new Map([[foe.id, cmd()]]), 0.5);
    expect(w.pinged.has(foe.id) || !losClear(w.map.grid, { x: 0, y: 1.6, z: 0 }, { x: 8, y: 1.2, z: 0 })).toBe(true);
  });
});

describe('recon and battlefield fields', () => {
  it('smoke hides soldiers from pings; phosphorus burns them', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const s = w.addSoldier('T', 'infantry', 1, 'human');
    s.pos = { x: 0, y: 0, z: 0 };
    w.spawnGadget('target_beacon', 0, -1, { x: 2, y: 0, z: 0 }, 60, 15);
    run(w, new Map([[s.id, cmd()]]), 0.2);
    expect(w.pinged.has(s.id)).toBe(true);
    // pop smoke on his position — the ping dies
    w.spawnGadget('smoke_field', 1, -1, { x: 0, y: 0, z: 0 }, Infinity, 12);
    run(w, new Map([[s.id, cmd()]]), 0.2);
    expect(w.smoked.has(s.id)).toBe(true);
    expect(w.pinged.has(s.id)).toBe(false);
    // phosphorus burns
    const hp = s.hp;
    w.spawnGadget('fire_field', 0, -1, { x: 0, y: 0, z: 0 }, Infinity, 10);
    run(w, new Map([[s.id, cmd()]]), 1);
    expect(s.hp).toBeLessThan(hp);
  });

  it('a crewed sensor station is a rolling radar; a crewed ECM station jams it', () => {
    const w = new World({ seed: 42, mode: 'tdm' });
    const tank0 = [...w.vehicles.values()].find((v) => v.kind === 'tank' && v.team === 0)!;
    const op = w.addSoldier('Op', 'infantry', 0, 'bot');
    const sensorsSeat = 1 + VEHICLES.tank.crew!.indexOf('sensors');
    tank0.seats[sensorsSeat] = op.id; op.vehicleId = tank0.id; op.seat = sensorsSeat;
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: tank0.pos.x + 15, y: 0, z: tank0.pos.z };
    run(w, new Map([[foe.id, cmd()]]), 0.2);
    expect(w.pinged.has(foe.id)).toBe(true);

    // crew the ENEMY tank's ECM station and park it beside the foe — jammed
    const tank1 = [...w.vehicles.values()].find((v) => v.kind === 'tank' && v.team === 1)!;
    tank1.pos = { x: foe.pos.x + 2, y: 0, z: foe.pos.z };
    const jammer = w.addSoldier('J', 'infantry', 1, 'bot');
    const ecmSeat = 1 + VEHICLES.tank.crew!.indexOf('ecm');
    tank1.seats[ecmSeat] = jammer.id; jammer.vehicleId = tank1.id; jammer.seat = ecmSeat;
    run(w, new Map([[foe.id, cmd()]]), 0.2);
    expect(w.pinged.has(foe.id)).toBe(false);
  });
});

describe('trophies — the post-match honors ledger', () => {
  it('tracks the longest kill shot distance', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const sniper = w.addSoldier('S', 'infiltrator', 0, 'human');
    const far = w.addSoldier('F', 'infantry', 1, 'human');
    sniper.pos = { x: 0, y: 0, z: 0 };
    far.pos = { x: 72, y: 0, z: 0 };
    w.damageSoldier(far, 9999, sniper.id, 'rg2');
    expect(sniper.longestKill).toBeCloseTo(72, 0);
    // a closer kill doesn't shrink the record
    const near = w.addSoldier('N', 'infantry', 1, 'human');
    near.pos = { x: 5, y: 0, z: 0 };
    w.damageSoldier(near, 9999, sniper.id, 'rg2');
    expect(sniper.longestKill).toBeCloseTo(72, 0);
  });

  it('tracks vehicle kills and healing given', () => {
    const w = new World({ seed: 21, mode: 'tdm' });
    const ace = w.addSoldier('A', 'heavy', 0, 'human');
    const v = [...w.vehicles.values()].find((x) => x.team === 1)!;
    w.damageVehicle(v, 99999, ace.id, 'mml');
    expect(ace.vehicleKills).toBe(1);

    // medic beams a wounded ally back up — healGiven accumulates what landed
    const medic = w.addSoldier('M', 'medic', 0, 'human');
    const hurt = w.addSoldier('H', 'infantry', 0, 'human');
    medic.pos = { x: 0, y: 0, z: 0 };
    hurt.pos = { x: 5, y: 0, z: 0 };
    hurt.hp = 40;
    medic.weaponIdx = 1; // medibeam
    let ticks = 0;
    while (medic.healGiven === 0 && ticks++ < 300) {
      w.step(1 / 60, new Map([[medic.id, cmd({ fire: true, aimYaw: 0 })], [hurt.id, cmd()]]));
    }
    expect(medic.healGiven).toBeGreaterThan(0);
  });
});

describe('replays — killcam and match highlights', () => {
  it('the recorder keeps a bounded ring and clips the last N seconds', () => {
    const w = new World({ seed: 8, mode: 'tdm' });
    w.addSoldier('A', 'infantry', 0, 'human');
    const rec = new ReplayRecorder();
    for (let i = 0; i < 60 * 20; i++) { // 20 sim-seconds
      w.step(1 / 60, new Map());
      rec.record(w);
    }
    expect(rec.depth).toBeLessThanOrEqual(REPLAY_KEEP_S + 0.2); // ring bounded
    const clip = rec.clip(5);
    expect(clip.length).toBeGreaterThanOrEqual(40); // ~10Hz × 5s
    expect(clip.length).toBeLessThanOrEqual(55);
    // frames carry their recording timestamps for honest pacing
    expect(clip[clip.length - 1].t - clip[0].t).toBeGreaterThan(4);
  });

  it('playback reproduces recorded positions and paces on recorded time', () => {
    const w = new World({ seed: 8, mode: 'tdm' });
    const s = w.addSoldier('A', 'infantry', 0, 'human');
    s.pos = { ...w.map.hillPos }; // open ground — nothing to march into
    const rec = new ReplayRecorder();
    // march east for 4 seconds, recording
    for (let i = 0; i < 60 * 4; i++) {
      w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
      rec.record(w);
    }
    const liveEndX = s.pos.x;
    const clip = rec.clip(4);
    const clipSpan = clip[clip.length - 1].t - clip[0].t;
    const player = new ReplayPlayer(8, 'tdm', undefined);
    player.start(clip, 'test');
    expect(player.active).toBe(true);
    // early in playback the soldier is WEST of where he ended up
    player.tick(0.2);
    const early = player.world.soldiers.get(s.id)!.pos.x;
    expect(early).toBeLessThan(liveEndX - 5);
    // playback honors recorded time: after span seconds it ends, not before
    let played = 0.2;
    let guard = 0;
    while (player.tick(0.1) && guard++ < 200) played += 0.1;
    expect(played).toBeGreaterThan(clipSpan * 0.8); // no fast-forwarding
    const finalX = player.world.soldiers.get(s.id)!.pos.x;
    expect(Math.abs(finalX - liveEndX)).toBeLessThan(2.5);
    expect(player.active).toBe(false); // non-looping clip ends
  });

  it('looping highlights wrap around without corrupting the recorded clip', () => {
    const w = new World({ seed: 8, mode: 'tdm' });
    const s = w.addSoldier('A', 'infantry', 0, 'human');
    s.pos = { ...w.map.hillPos };
    const rec = new ReplayRecorder();
    for (let i = 0; i < 60 * 3; i++) {
      w.step(1 / 60, new Map([[s.id, cmd({ moveX: 1 })]]));
      rec.record(w);
    }
    const clip = rec.clip(3);
    const frame0X = clip[0].snap.soldiers.find((x) => x.id === s.id)!.pos.x;
    const player = new ReplayPlayer(8, 'tdm', undefined);
    player.start(clip, 'loop', true);
    for (let i = 0; i < 100; i++) player.tick(0.1); // ~3 passes through the clip
    expect(player.active).toBe(true); // still rolling
    // the ring frames must be byte-identical after playback — the puppet's
    // dead-reckoning must never write back into the recording
    const frame0XAfter = clip[0].snap.soldiers.find((x) => x.id === s.id)!.pos.x;
    expect(frame0XAfter).toBe(frame0X);
  });

  it('the killcam clip fits inside the respawn window', () => {
    // RESPAWN_DELAY is 4s — a longer clip would be cut before the kill shows
    expect(KILLCAM_S).toBeLessThan(4);
  });
});

describe('performance and boundaries', () => {
  it('a full 30-combatant battle sims well under the frame budget', () => {
    const w = new World({ seed: 77, mode: 'tdm', botsPerTeam: 15 });
    const pool: ClassId[] = ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
    for (let i = 0; i < 15; i++) w.addSoldier(`A${i}`, pool[i % pool.length], 0, 'bot');
    for (let i = 0; i < 15; i++) w.addSoldier(`B${i}`, pool[i % pool.length], 1, 'bot');
    run(w, new Map(), 2); // warm up — bots path, fights start
    const t0 = performance.now();
    const TICKS = 600; // 10 sim-seconds
    for (let i = 0; i < TICKS; i++) w.step(1 / 60, new Map());
    const msPerTick = (performance.now() - t0) / TICKS;
    // 60Hz gives 16.6ms/frame for sim + render; the sim alone must stay tiny
    expect(msPerTick, `${msPerTick.toFixed(2)}ms/tick`).toBeLessThan(8);
  });

  it('nothing escapes the world: soldiers and vehicles stay in bounds under force', () => {
    const w = new World({ seed: 77, mode: 'tdm' });
    const s = w.addSoldier('Runner', 'pathfinder', 0, 'human');
    s.pos = { x: -95, y: 0, z: -95 };
    s.pushX = -500; s.pushZ = -500; // absurd knockback toward the corner
    run(w, new Map([[s.id, cmd({ moveX: -1, moveZ: -1 })]]), 3);
    expect(Math.abs(s.pos.x)).toBeLessThanOrEqual(WORLD / 2);
    expect(Math.abs(s.pos.z)).toBeLessThanOrEqual(WORLD / 2);
    const v = [...w.vehicles.values()].find((x) => x.kind === 'flyer' && x.team === 0)!;
    const d = w.addSoldier('Pilot', 'infantry', 0, 'human');
    d.pos = { ...v.pos };
    w.step(1 / 60, new Map([[d.id, cmd({ use: true })]]));
    v.spoolUntil = 0; // skip the spool for the boundary check
    v.yaw = Math.PI; // fly at the west border
    run(w, new Map([[d.id, cmd({ moveZ: -1 })]]), 12);
    expect(Math.abs(v.pos.x)).toBeLessThanOrEqual(WORLD / 2 - 2.9);
    expect(Math.abs(v.pos.z)).toBeLessThanOrEqual(WORLD / 2 - 2.9);
  });

  it('projectiles expire instead of leaking (ttl or terrain, never forever)', () => {
    const w = new World({ seed: 77, mode: 'tdm' });
    const s = w.addSoldier('Gunner', 'infiltrator', 0, 'human');
    s.pos = { ...w.map.hillPos };
    // rail shots at nothing, toward the border — some may hit buildings
    // early (the map grows structures now), so track the high-water mark
    let seen = 0;
    for (let i = 0; i < 10; i++) {
      w.step(1 / 60, new Map([[s.id, cmd({ fire: true, aimYaw: 0 })]]));
      seen = Math.max(seen, w.projectiles.size);
    }
    expect(seen).toBeGreaterThan(0);
    run(w, new Map(), 4); // far beyond any weapon ttl
    expect(w.projectiles.size).toBe(0);
  });
});

describe('environments — the war scales the solar system', () => {
  // (per-theme determinism lives in tests/visual.test.ts — one home)
  it('starship corridors are sealed: no open water on a spaceship', () => {
    const ship = generateMap(777, 'tdm', 'starship');
    expect([...ship.grid].filter((t) => t === T_WATER).length).toBe(0);
  });

  it('low gravity floats: a hop on Europa rises higher than on Terra', () => {
    const peak = (theme: 'savanna' | 'europa') => {
      const w = new World({ seed: 5, mode: 'tdm', theme });
      const s = w.addSoldier('J', 'infantry', 0, 'human');
      s.pos = { x: 0, y: 0, z: 0 };
      let top = 0;
      w.step(1 / 60, new Map([[s.id, cmd({ jump: true })]]));
      for (let i = 0; i < 240; i++) {
        w.step(1 / 60, new Map([[s.id, cmd()]]));
        top = Math.max(top, s.pos.y);
      }
      return top;
    };
    expect(THEMES.europa.gravity).toBeLessThan(THEMES.savanna.gravity);
    expect(peak('europa')).toBeGreaterThan(peak('savanna') * 1.5);
  });

  it('co-op zombie modes field only squad support vehicles', () => {
    const w = new World({ seed: 3, mode: 'survival' });
    const kinds = new Set([...w.vehicles.values()].map((v) => v.kind));
    expect(kinds.has('tank')).toBe(false);
    expect(kinds.has('ambulance')).toBe(true);
    expect(kinds.has('emplacement')).toBe(true);
  });
});
