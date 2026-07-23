// ───────────────────────────────────────────────────────────────────────────
// PRESS E TO TAKE IT.
//
// Robert: *"it's hard to know what things are when you walk up to them to pick
// them up. We should press E for pickup and then we can see the name, or you
// show up the image of it that will be in the inventory or on the weapon wheel
// or inventory bar."*
//
// Two halves that have to stay welded together:
//   the PROMPT  — pickupInReach() tells the HUD what is at your feet
//   the TAKE    — the E chain hands over exactly the thing the prompt named
//
// If those two ever disagree, the HUD offers you one thing and the game gives
// you another. Most of this file exists to keep them honest.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { CLASSES, WEAPONS, pickupLabel } from '../src/sim/data';
import type { ClassId, PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

/** drop a fresh pickup of `type` right under `s` */
function underfoot(w: World, s: { pos: { x: number; y: number; z: number } }, type: string, weaponId?: string) {
  const id = (w as unknown as { nextId: number }).nextId++;
  const pk = { id, type, pos: { ...s.pos }, respawnAt: 0, weaponId } as never;
  w.pickups.set(id, pk);
  return w.pickups.get(id)!;
}

const player = (w: World, cls: ClassId = 'infantry') => {
  const p = w.addSoldier('P', cls, 0, 'human');
  p.alive = true; p.pos = { x: 20, y: 0, z: 20 };
  return p;
};

describe('the prompt names what is at your feet', () => {
  it('offers a medkit only while it would actually heal you', () => {
    const w = quiet(); const p = player(w);
    underfoot(w, p, 'medkit');
    expect(w.pickupInReach(p), 'at full health there is nothing to offer').toBeUndefined();
    p.hp = 10;
    expect(w.pickupInReach(p)?.type).toBe('medkit');
  });

  it('goes quiet the moment the thing stops being worth taking', () => {
    const w = quiet(); const p = player(w);
    p.hp = 10;
    underfoot(w, p, 'medkit');
    expect(w.pickupInReach(p)).toBeDefined();
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    expect(p.hp, 'the medkit did its job').toBe(60);
    expect(w.pickupInReach(p), 'and stops advertising itself').toBeUndefined();
  });

  it('is out of reach from across the room', () => {
    const w = quiet(); const p = player(w);
    p.hp = 10;
    const pk = underfoot(w, p, 'medkit');
    pk.pos.x += World.PICKUP_REACH + 0.5;
    expect(w.pickupInReach(p)).toBeUndefined();
  });

  it('never offers anything to a man who is down, or riding', () => {
    const w = quiet(); const p = player(w);
    p.hp = 10;
    underfoot(w, p, 'medkit');
    p.downed = true;
    expect(w.pickupInReach(p), 'bleeding out, hands full').toBeUndefined();
    p.downed = false; p.vehicleId = 3;
    expect(w.pickupInReach(p), 'you cannot loot from the driver seat').toBeUndefined();
  });

  it('names a dropped gun by its own name, and the rest in plain words', () => {
    const w = quiet(); const p = player(w);
    const gun = CLASSES.heavy.primary;
    expect(pickupLabel({ type: 'weapon', weaponId: gun })).toBe(WEAPONS[gun].name);
    expect(pickupLabel({ type: 'medkit' })).toBe('MEDKIT');
    expect(pickupLabel({ type: 'ammo' })).toBe('AMMO CRATE');
    expect(p.alive).toBe(true); // (the world stood up fine)
  });
});

describe('E takes exactly what the prompt offered', () => {
  it('hands over the gun the prompt named, and says so in the event', () => {
    const w = quiet(); const p = player(w);
    const gun = CLASSES.heavy.primary;
    underfoot(w, p, 'weapon', gun);
    const offered = w.pickupInReach(p);
    expect(offered?.weaponId).toBe(gun);
    w.events.length = 0;
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    expect(p.weapons.includes(gun)).toBe(true);
    const ev = w.events.find((e) => e.type === 'pickup');
    expect(ev?.text, 'the card can name it').toBe(WEAPONS[gun].name);
    expect(ev?.weapon, 'and draw its portrait').toBe(gun);
  });

  it('a medkit take carries no weapon id — the card shows a mark, not a gun', () => {
    const w = quiet(); const p = player(w);
    p.hp = 10;
    underfoot(w, p, 'medkit');
    w.events.length = 0;
    w.step(1 / 60, new Map([[p.id, cmd({ use: true })]]));
    const ev = w.events.find((e) => e.type === 'pickup');
    expect(ev?.text).toBe('MEDKIT');
    expect(ev?.weapon).toBeUndefined();
  });

  it('does not eat the keypress meant for something else', () => {
    // full health, standing on a medkit: the prompt is silent, so E is free
    // to fall through to the door/ladder/vehicle behind it
    const w = quiet(); const p = player(w);
    underfoot(w, p, 'medkit');
    expect(w.tryPickup(p), 'nothing useful → E is not consumed').toBe(false);
  });
});

describe('bots keep walking things up', () => {
  it('a bot has no E key, so the crate still works on contact', () => {
    const w = quiet();
    const b = w.addSoldier('B', 'infantry', 0, 'bot');
    b.alive = true; b.pos = { x: 40, y: 0, z: 40 }; b.hp = 10;
    underfoot(w, b, 'medkit');
    w.step(1 / 60, new Map());
    expect(b.hp, 'walk-over is still theirs').toBe(60);
  });

  it('but the player is never healed by accident', () => {
    const w = quiet(); const p = player(w);
    p.hp = 10;
    underfoot(w, p, 'medkit');
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[p.id, cmd()]]));
    expect(p.hp, 'half a second of standing on it changes nothing').toBe(10);
  });
});
