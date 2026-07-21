// ---------------------------------------------------------------------------
// §14.2 REAR CONTROL — NO MINIGAME (Robert: "eliminate the minigame. If you
// win that grab, they don't get loose. You use them as a human shield until
// they break. And when they break it should knock me back — to stop me
// spamming the grab."). A rear grab that LANDS is immediate control: the whole
// outcome menu (shield/disarm/choke/throw/takedown) unlocks at once. There is
// NO needle contest. The victim's only out is to STRUGGLE (mash MOVE) free —
// harder than a front clinch — and breaking free SHOVES the grabber back.
// The needle-vs-zone game and its surge/shear are gone.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

/** attacker at the victim's BACK: both face +x, attacker approaches from -x */
function rearStaged() {
  const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
  const a = w.addSoldier('Att', 'infantry', 0, 'human');
  a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0;
  const v = w.addSoldier('Vic', 'infantry', 1, 'human');
  v.pos = { x: 1.4, y: 0, z: 0 }; v.yaw = 0; v.protectedUntil = 0; // facing AWAY — rear grab
  w.step(1 / 60, new Map());
  return { w, a, v };
}

describe('§14.2 rear control — no minigame', () => {
  it('a rear grab LANDS as immediate control — locked, no contest', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.grabbedBy).toBe(a.id);
    expect(v.ctrlStruggle?.locked, 'control is TAKEN on the grab — you won it').toBe(true);
    // no needle rounds ran: the attacker already has both wins
    expect(v.ctrlStruggle!.attWins).toBe(2);
    expect(v.ctrlStruggle!.zoneW, 'no contest zone — there is no minigame').toBe(0);
  });

  it('the finisher lands right after the grab-recover — no rounds to win first', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    for (let i = 0; i < 34; i++) w.step(1 / 60, new Map()); // idle past GRAB_RECOVER; victim does NOT mash
    expect(v.alive).toBe(true);
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]])); // the takedown
    expect(v.alive, 'controlled → the finisher is immediately available').toBe(false);
    expect(v.downed).toBe(false);
  });

  it('MASH breaks a rear control free — and SHOVES the grabber back (anti-spam)', () => {
    const { w, a, v } = rearStaged();
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.ctrlStruggle?.locked).toBe(true);
    let freed = false;
    for (let i = 0; i < 60 * 4 && !freed; i++) {
      w.step(1 / 60, new Map([[v.id, cmd({ moveX: 1, jump: true })]])); // mash
      if (v.grabbedBy === undefined) freed = true;
    }
    expect(freed, 'the needle is gone — you mash your way out').toBe(true);
    expect(a.pushX, 'breaking the rear hold shoved the grabber away (-x, behind the victim)').toBeLessThan(-3);
    expect(a.nextFireAt, 'and staggered him so he cannot instantly re-grab').toBeGreaterThan(w.time);
    expect(v.grabImmuneUntil, 'the escapee gets brief re-grab immunity').toBeGreaterThan(w.time);
  });

  it('a rear control is HARDER to break than a front clinch (the grabber owns your back)', () => {
    // rear: mash and count ticks to free
    const rear = rearStaged();
    rear.w.step(1 / 60, new Map([[rear.a.id, cmd({ grapple: true })]]));
    let rearTicks = 0;
    for (let i = 0; i < 60 * 5 && rear.v.grabbedBy !== undefined; i++) { rear.w.step(1 / 60, new Map([[rear.v.id, cmd({ moveX: 1 })]])); rearTicks++; }
    // front: same, but the victim FACES the attacker
    const front = rearStaged();
    front.v.yaw = Math.PI; // facing the attacker → front clinch, no rear control
    front.w.step(1 / 60, new Map([[front.a.id, cmd({ grapple: true })]]));
    expect(front.v.ctrlStruggle, 'a front grab is the classic clinch — no rear control marker').toBeUndefined();
    let frontTicks = 0;
    for (let i = 0; i < 60 * 5 && front.v.grabbedBy !== undefined; i++) { front.w.step(1 / 60, new Map([[front.v.id, cmd({ moveX: 1 })]])); frontTicks++; }
    expect(rearTicks, 'the rear hold takes longer to shrug').toBeGreaterThan(frontTicks);
  });

  it('same-team never grabs; a mid-STRIKE victim stuffs the grab (the triangle still rules)', () => {
    const { w, a, v } = rearStaged();
    v.meleeStrikeAt = w.time + 0.2; v.meleeWeapon = 'knife'; // caught mid-swing
    w.step(1 / 60, new Map([[a.id, cmd({ grapple: true })]]));
    expect(v.grabbedBy, 'STRIKE beats GRAPPLE — no hold, no control').toBeUndefined();
  });
});

describe('the pulse-ring tell (grab_reach)', () => {
  const c = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
    moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
    use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
  });
  it('every grapple press by a HUMAN emits grab_reach — land OR whiff', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const a = w.addSoldier('Att', 'infantry', 0, 'human');
    a.pos = { x: 0, y: 0, z: 0 }; a.yaw = 0; a.protectedUntil = 0;
    w.step(1 / 60, new Map());
    // WHIFF — nobody in reach
    w.step(1 / 60, new Map([[a.id, c({ grapple: true })]]));
    expect(w.takeEvents().some((e) => e.type === 'grab_reach' && e.soldierId === a.id), 'a whiff still reaches').toBe(true);
  });
});
