// ---------------------------------------------------------------------------
// TOUCH CONTROLS (the tablet goal) — the pure half's laws. The DOM half is
// exercised live in the browser; these pin the contract the sim relies on:
// stick math clamps, the right stick fires past the threshold, aim persists
// after the thumb lifts (the pad law), and one-shots drain exactly once.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { FIRE_THRESHOLD, TouchControls, stickFrom } from '../src/client/touch';
import type { PlayerCmd, Soldier } from '../src/sim/types';

const cmd = (): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
});
const local = { weaponIdx: 0, weapons: ['ar606', 'pistol'] } as unknown as Soldier;

/** poke the private stick state the way the DOM handlers do */
const setStick = (t: TouchControls, which: 'move' | 'aim', v: { x: number; y: number; mag: number }) => {
  (t as unknown as Record<string, unknown>)[which] = v;
};
const setLatch = (t: TouchControls, key: string) => {
  ((t as unknown as { latch: Record<string, boolean> }).latch)[key] = true;
};

describe('touch controls — the pure half', () => {
  it('stickFrom clamps to the unit disc and keeps direction', () => {
    const inside = stickFrom(0, 0, 30, 0, 64);
    expect(inside.mag).toBeCloseTo(30 / 64);
    const outside = stickFrom(0, 0, 640, 0, 64);
    expect(outside.mag).toBe(1);
    expect(outside.x).toBeCloseTo(1);
    expect(outside.y).toBeCloseTo(0);
  });

  it('a deflected aim stick fires; a gentle one only aims', () => {
    const t = new TouchControls();
    const c1 = cmd();
    setStick(t, 'aim', { x: 0.3, y: 0, mag: 0.3 });
    t.apply(c1, local);
    expect(c1.fire, 'gentle deflection aims without firing').toBe(false);
    expect(c1.aimYaw).toBeCloseTo(0);
    const c2 = cmd();
    setStick(t, 'aim', { x: FIRE_THRESHOLD + 0.1, y: 0, mag: FIRE_THRESHOLD + 0.1 });
    t.apply(c2, local);
    expect(c2.fire, 'past the threshold the stick is the trigger').toBe(true);
  });

  it('aim persists after the thumb lifts — the pad law', () => {
    const t = new TouchControls();
    setStick(t, 'aim', { x: 0, y: 1, mag: 1 });
    t.apply(cmd(), local);
    setStick(t, 'aim', { x: 0, y: 0, mag: 0 }); // thumb up
    const after = cmd();
    t.apply(after, local);
    expect(after.aimYaw, 'facing survives the release').toBeCloseTo(Math.PI / 2);
    expect(after.fire).toBe(false);
  });

  it('one-shots drain exactly once', () => {
    const t = new TouchControls();
    setLatch(t, 'jump');
    setLatch(t, 'swap');
    const first = cmd();
    t.apply(first, local);
    expect(first.jump).toBe(true);
    expect(first.weaponSlot, 'swap cycles off the carried index').toBe(1);
    const second = cmd();
    t.apply(second, local);
    expect(second.jump, 'a latch never double-fires').toBe(false);
    expect(second.weaponSlot).toBe(-1);
  });

  it('move intent rides analogDrive — a gentle push is a crawl, not a sprint', () => {
    const t = new TouchControls();
    setStick(t, 'move', { x: 0.5, y: 0, mag: 0.5 });
    const c = cmd();
    t.apply(c, local);
    expect(c.moveX).toBeGreaterThan(0);
    expect(c.moveX).toBeLessThan(0.6);
    expect(c.sprint ?? false).toBe(false);
    setStick(t, 'move', { x: 1, y: 0, mag: 1 });
    const full = cmd();
    t.apply(full, local);
    expect(full.sprint, 'full deflection is the SHIFT run').toBe(true);
  });
});
