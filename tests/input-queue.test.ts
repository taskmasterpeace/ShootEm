// ---------------------------------------------------------------------------
// The input queue (opt #3 / N3) — proves the two failure modes the latest-wins
// slot had are gone: bunched one-shot presses are no longer eaten, and a quiet
// (background-tab-stalled) client stops moving instead of walking forever.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { drainCmd, newCmdQueue, pushCmd, resetCmdQueue, STALE_MS } from '../src/server/input-queue';
import type { PlayerCmd } from '../src/sim/types';

function cmd(over: Partial<PlayerCmd> = {}): PlayerCmd {
  return {
    moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
    use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
  };
}

describe('input queue: no lost one-shot presses', () => {
  it('two cmds bunched into one server tick both survive — reload is not eaten', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ reload: true }), 1000); // first press: reload
    pushCmd(s, cmd({ grenade: true }), 1000); // second, same tick: grenade
    // drain one per tick — both presses come out, neither overwritten
    expect(drainCmd(s, 1000)!.reload).toBe(true);
    expect(drainCmd(s, 1000)!.grenade).toBe(true);
  });

  it('a held input repeats when the queue starves, but a one-shot never does', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ moveZ: 1, fire: true, ability: true }), 1000);
    const first = drainCmd(s, 1000)!;
    expect(first.ability).toBe(true); // the press fires once
    const repeat = drainCmd(s, 1010)!; // starved tick reuses the last cmd
    expect(repeat.moveZ).toBe(1); // held move continues
    expect(repeat.fire).toBe(true); // held fire continues
    expect(repeat.ability).toBe(false); // the press does NOT repeat
    expect(repeat.weaponSlot).toBe(-1); // nor a weapon switch
  });

  it('never repeats a K9 order when the queue starves', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ k9: 'sic' }), 1000);
    expect(drainCmd(s, 1000)!.k9).toBe('sic');
    expect(drainCmd(s, 1010)!.k9).toBeUndefined();
  });

  it('caps at 8 and drops the OLDEST, keeping the newest presses', () => {
    const s = newCmdQueue();
    for (let i = 0; i < 12; i++) pushCmd(s, cmd({ aimYaw: i }), 1000);
    expect(s.queue.length).toBe(8);
    expect(s.queue[0].aimYaw).toBe(4); // 0-3 fell off; 4..11 remain
    expect(s.queue[7].aimYaw).toBe(11);
  });
});

describe('input queue: a stalled client stands still', () => {
  it('zeros movement and fire when the newest cmd is older than STALE_MS', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ moveZ: 1, fire: true, sprint: true }), 1000);
    drainCmd(s, 1000); // consume it, seeding lastLive
    const stalled = drainCmd(s, 1000 + STALE_MS + 1)!; // a long quiet gap
    expect(stalled.moveZ).toBe(0);
    expect(stalled.fire).toBe(false);
    expect(stalled.sprint).toBe(false);
  });

  it('a fresh cmd walks again after the stall', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ moveZ: 1 }), 1000);
    drainCmd(s, 1000);
    expect(drainCmd(s, 1000 + STALE_MS + 1)!.moveZ).toBe(0); // stalled
    pushCmd(s, cmd({ moveZ: 1 }), 2000); // player comes back
    expect(drainCmd(s, 2000)!.moveZ).toBe(1); // and moves
  });
});

describe('input queue: reset on match restart', () => {
  it('clears the queue and the held-repeat', () => {
    const s = newCmdQueue();
    pushCmd(s, cmd({ moveZ: 1 }), 1000);
    drainCmd(s, 1000);
    resetCmdQueue(s);
    expect(s.queue.length).toBe(0);
    expect(drainCmd(s, 1000)).toBeNull();
  });
});
