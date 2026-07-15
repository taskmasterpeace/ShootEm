// ---------------------------------------------------------------------------
// Weapon range: `range` is the literal max reach a shot travels. Direct-fire
// projectiles are culled by ttl at exactly `range`; arc projectiles are
// launched at an angle that lands them at `range` (not a fixed short ballistic
// — the bug this suite locks). Role bands keep CQC weapons short and snipers
// long.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { familyWeapons } from '../src/sim/arsenal';
import { GRID } from '../src/sim/map';
import type { PlayerCmd, WeaponFamily, WeaponId } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** Fire one shot down a fully-cleared lane and return how far it travels. */
function reach(wid: WeaponId): number {
  const w = new World({ seed: 1, mode: 'tdm' });
  for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  s.pos = { x: -95, y: 0, z: 0 };
  s.yaw = 0; // +X
  s.weapons = [wid, 'pistol'];
  s.weaponIdx = 0;
  s.clip = [999, 12];
  s.reserve = [999, 96];
  const def = WEAPONS[wid];
  if (def.range <= 2.5) return def.range;
  w.fireSoldierWeapon(s, wid, def);
  let max = 0;
  for (let i = 0; i < 60 * 8; i++) {
    for (const p of w.projectiles.values()) if (p.ownerId === s.id) max = Math.max(max, p.pos.x + 95);
    if (i > 2 && ![...w.projectiles.values()].some((p) => p.ownerId === s.id)) break;
    w.step(1 / 60, new Map());
  }
  return max;
}

const famRep = (f: WeaponFamily): WeaponId => familyWeapons(WEAPONS, f).find((w) => w.tier === 2)!.id;

describe('range: a shot travels its nominal reach', () => {
  const direct: WeaponId[] = ['pistol', 'ar606', 'kuchler', 'caw', 'rg2', 'ac_mk2', 'plasma', 'tank_cannon', 'emplacement_gun'];
  it.each(direct)('%s direct-fire reaches its range (±10%%)', (wid) => {
    const r = reach(wid);
    const nominal = WEAPONS[wid].range;
    expect(r, `${wid} reached ${r.toFixed(1)} vs range ${nominal}`).toBeGreaterThan(nominal * 0.9);
    expect(r).toBeLessThan(nominal * 1.1 + 2);
  });

  // the fix: arc weapons must LAND at their range, not ~35u
  const arc: WeaponId[] = ['gl', 'emp', 'target_beacon', 'orbital_beacon'];
  it.each(arc)('%s arc weapon lands at its range (was stuck ~35u)', (wid) => {
    const r = reach(wid);
    const nominal = WEAPONS[wid].range;
    expect(r, `${wid} landed ${r.toFixed(1)} vs range ${nominal}`).toBeGreaterThan(nominal * 0.85);
    expect(r).toBeLessThan(nominal * 1.15 + 2);
  });

  it('generated mortars and artillery reach far (the worst old mismatch: 110→40)', () => {
    const artillery = famRep('artillery');
    const mortar = famRep('mortar');
    expect(reach(artillery)).toBeGreaterThan(WEAPONS[artillery].range * 0.85);
    expect(reach(mortar)).toBeGreaterThan(WEAPONS[mortar].range * 0.85);
    expect(reach(artillery)).toBeGreaterThan(90); // genuinely long-range now
  });
});

describe('range: role bands are sane', () => {
  const familyRange = (f: WeaponFamily) => Math.max(...familyWeapons(WEAPONS, f).map((w) => w.range));

  it('CQC weapons stay short, snipers reach across the map', () => {
    // close-quarters
    for (const f of ['flamethrower', 'scatter', 'shotgun'] as WeaponFamily[]) {
      expect(familyRange(f), f).toBeLessThanOrEqual(30);
    }
    // short (sidearm / SMG)
    expect(familyRange('smg')).toBeLessThanOrEqual(48);
    expect(familyRange('pistol')).toBeLessThanOrEqual(52);
    // mid mainline
    expect(familyRange('rifle')).toBeGreaterThan(60);
    expect(familyRange('rifle')).toBeLessThan(80);
    // long / sniper
    expect(familyRange('laser')).toBeGreaterThan(90);
    expect(WEAPONS.rg2.range).toBeGreaterThanOrEqual(120); // the railgun snipes
  });

  it('the range ordering is monotonic by role: sidearm < rifle < laser < railgun', () => {
    expect(WEAPONS.pistol.range).toBeLessThan(WEAPONS.ar606.range);
    expect(WEAPONS.ar606.range).toBeLessThan(familyRange('laser'));
    expect(familyRange('laser')).toBeLessThan(WEAPONS.rg2.range);
  });

  it('the hand-thrown frag stays a short panic toss, not the full GL-40 lob', () => {
    const w = new World({ seed: 2, mode: 'tdm' });
    for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
    const s = w.addSoldier('S', 'infantry', 0, 'human'); // infantry: 4 frags
    s.pos = { x: 0, y: 0, z: 0 };
    s.yaw = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true })]]));
    let max = 0;
    for (let i = 0; i < 60 * 4; i++) {
      for (const p of w.projectiles.values()) if (p.weapon === 'gl') max = Math.max(max, p.pos.x);
      w.step(1 / 60, new Map());
    }
    expect(max, `hand frag flew ${max.toFixed(1)}`).toBeLessThan(30); // short toss, not 46
    expect(max).toBeGreaterThan(12);
  });
});

describe('grenade: cursor-targeted throw (cmd.aimDist)', () => {
  /** Throw one frag with the given aimDist and return how far it flew (+X lane). */
  function fragLanding(aimDist?: number): number {
    const w = new World({ seed: 5, mode: 'tdm' });
    for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 };
    s.yaw = 0;
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true, aimDist })]]));
    let max = 0;
    for (let i = 0; i < 60 * 4; i++) {
      for (const p of w.projectiles.values()) if (p.weapon === 'gl') max = Math.max(max, p.pos.x);
      w.step(1 / 60, new Map());
    }
    return max;
  }

  it('lands the frag at the commanded distance', () => {
    const at10 = fragLanding(10);
    const at18 = fragLanding(18);
    expect(Math.abs(at10 - 10), `aimed 10, landed ${at10.toFixed(1)}`).toBeLessThan(3);
    expect(Math.abs(at18 - 18), `aimed 18, landed ${at18.toFixed(1)}`).toBeLessThan(3);
    expect(at18).toBeGreaterThan(at10 + 4); // distance control is real
  });

  it('clamps a far cursor to the max hand-frag reach', () => {
    const far = fragLanding(60);
    expect(far, `aimed 60, landed ${far.toFixed(1)}`).toBeLessThan(27);
    expect(far).toBeGreaterThan(17);
  });

  it('never lands at your own feet — short throws floor at ~4u', () => {
    const point = fragLanding(0.5);
    expect(point, `aimed 0.5, landed ${point.toFixed(1)}`).toBeGreaterThan(2.5);
    expect(point).toBeLessThan(9);
  });
});

describe('range: low-gravity worlds still land arcs at range', () => {
  it('a mortar on Europa (9 m/s²) reaches its range, not double', () => {
    const wid = famRep('mortar');
    const w = new World({ seed: 3, mode: 'tdm', theme: 'europa' });
    for (let z = 1; z < GRID - 1; z++) for (let x = 1; x < GRID - 1; x++) w.map.grid[z * GRID + x] = 0;
    const s = w.addSoldier('S', 'heavy', 0, 'human');
    s.pos = { x: -95, y: 0, z: 0 };
    s.yaw = 0;
    s.weapons = [wid, 'pistol'];
    s.clip = [999, 12];
    w.fireSoldierWeapon(s, wid, WEAPONS[wid]);
    let max = 0;
    for (let i = 0; i < 60 * 10; i++) {
      for (const p of w.projectiles.values()) if (p.ownerId === s.id) max = Math.max(max, p.pos.x + 95);
      if (i > 2 && ![...w.projectiles.values()].some((p) => p.ownerId === s.id)) break;
      w.step(1 / 60, new Map());
    }
    const nominal = WEAPONS[wid].range;
    // derived launch vy uses the live gravity, so reach matches range on any world
    expect(Math.abs(max - nominal), `Europa mortar ${max.toFixed(1)} vs ${nominal}`).toBeLessThan(nominal * 0.2);
  });
});
