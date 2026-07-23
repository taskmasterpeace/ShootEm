// ---------------------------------------------------------------------------
// THE BOARD — the desk under the TV (Robert: "who threw the hardest attack,
// what was the hardest attack, who had the best defense").
//
// The laws:
//   1. A BLOW IS AN ATTACK, NOT A FRAGMENT. One damageSoldier call emits plate
//      and flesh separately; a shotgun emits one per pellet. The hardest blow
//      is the whole trigger pull, folded — anything else under-reports the
//      thing the board exists to name.
//   2. Every superlative NAMES someone. A figure with no name on it is not an
//      answer to "who".
//   3. The book is derived, never authored: the ledger reads events and
//      touches nothing.
//   4. The picture stops where the desk starts — one variable, honoured by the
//      canvas, the HUD and the damage layer alike.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CombatLedger } from '../src/client/ledger';
import { World } from '../src/sim/world';
import type { SimEvent } from '../src/sim/types';

/** The ledger only ever asks the world for the clock and a name. */
function stub(time = 10, names: Array<[number, string, 0 | 1]> = []) {
  const soldiers = new Map(names.map(([id, name, team]) => [id, { id, name, team }]));
  return { time, soldiers } as unknown as World;
}

const dmg = (atk: number, vic: number, amount: number, armorHit = false, weapon = 'rifle_maklov_1'): SimEvent =>
  ({ type: 'damage', amount, armorHit, soldierId: vic, ownerId: atk, weapon } as SimEvent);

describe('the ledger — the combat book', () => {
  it('FOLDS a blow: plate + flesh from one call is ONE attack, at full weight', () => {
    const w = stub(12, [[1, 'RAVEN', 0], [2, 'DUSTOFF', 1]]);
    const led = new CombatLedger();
    // one shot: 40 eaten by plate, 62 through to flesh — a 102 blow
    led.applyEvents([dmg(1, 2, 40, true), dmg(1, 2, 62, false)], w);
    expect(led.hardest?.amount).toBe(102);
    expect(led.hardest?.attacker).toBe('RAVEN');
    expect(led.hardest?.victim).toBe('DUSTOFF');
  });

  it('folds a shotgun spread in one tick, but NOT two separate ticks', () => {
    const w = stub(5, [[1, 'RAVEN', 0], [2, 'DUSTOFF', 1]]);
    const led = new CombatLedger();
    const pellet = () => dmg(1, 2, 12, false, 'shotgun_maklov_1');
    led.applyEvents([pellet(), pellet(), pellet(), pellet()], w); // one blast = 48
    expect(led.hardest?.amount).toBe(48);
    const led2 = new CombatLedger();
    led2.applyEvents([pellet()], w);
    led2.applyEvents([pellet()], w); // two blasts, a tick apart
    expect(led2.hardest?.amount).toBe(12);
  });

  it('keeps attacker and victim books apart: dealt, taken, and plate eaten', () => {
    const w = stub(3, [[1, 'RAVEN', 0], [2, 'DUSTOFF', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 2, 30, true), dmg(1, 2, 20, false)], w);
    const raven = led.fighters.get(1)!;
    const dustoff = led.fighters.get(2)!;
    expect(raven.dealt).toBe(50);
    expect(raven.taken).toBe(0);
    expect(dustoff.taken).toBe(20);   // flesh only
    expect(dustoff.eaten).toBe(30);   // the plate's work
    expect(dustoff.dealt).toBe(0);
  });

  it('names the hardest attack WITH its weapon — "what was it" is half the question', () => {
    const w = stub(8, [[1, 'RAVEN', 0], [2, 'DUSTOFF', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 2, 30, false, 'rifle_maklov_1')], w);
    led.applyEvents([dmg(1, 2, 88, false, 'sniper_kuchler_3')], w);
    expect(led.hardest?.amount).toBe(88);
    expect(led.hardest?.weapon).toBe('sniper_kuchler_3');
    expect(led.fighters.get(1)!.best).toBe(88);
    expect(led.fighters.get(1)!.bestWeapon).toBe('sniper_kuchler_3');
  });

  it('ranks DEFENCE by plate worn down plus strikes turned away', () => {
    const w = stub(4, [[1, 'RAVEN', 0], [2, 'HOLLOW', 1], [3, 'PIKE', 1]]);
    const led = new CombatLedger();
    // HOLLOW eats 200 on plate; PIKE eats 100 but blocks six strikes (=120)
    led.applyEvents([dmg(1, 2, 200, true), dmg(1, 3, 100, true)], w);
    led.applyEvents(Array.from({ length: 6 }, () => ({ type: 'melee_block', soldierId: 3 } as SimEvent)), w);
    expect(CombatLedger.defence(led.fighters.get(2)!)).toBe(200);
    expect(CombatLedger.defence(led.fighters.get(3)!)).toBe(220);
    expect(led.leader(CombatLedger.defence)!.name).toBe('PIKE');
  });

  it('DEFENCE answers even when nobody wears plate — soak per life', () => {
    // the failure this measure was written for: a live battle where no bot
    // carried armour and no melee landed, so "best defence" sat blank while
    // men were plainly surviving punishment
    const w = stub(50, [[1, 'GUN', 0], [2, 'ROCK', 1], [3, 'PAPER', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 2, 600, false), dmg(1, 3, 600, false)], w);
    // ROCK soaked the same 600 but went down five times; PAPER never fell
    for (let i = 0; i < 5; i++) {
      led.applyEvents([{ type: 'death', soldierId: 2, killerId: 1, victimName: 'ROCK' } as SimEvent], w);
    }
    expect(CombatLedger.defence(led.fighters.get(3)!)).toBe(600); // 600 / 1 life
    expect(CombatLedger.defence(led.fighters.get(2)!)).toBe(100); // 600 / 6 lives
    expect(led.leader(CombatLedger.defence)!.name).toBe('PAPER');
  });

  it('takes the longest kill from the death report, range and all', () => {
    const w = stub(60, [[1, 'SANDMAN', 0], [2, 'PIKE', 1], [3, 'DUSTOFF', 1]]);
    const led = new CombatLedger();
    led.applyEvents([{
      type: 'death', soldierId: 2, killerId: 1, victimName: 'PIKE',
      weaponName: 'Kuchler Mk III', dist: 41.5,
    } as SimEvent], w);
    led.applyEvents([{
      type: 'death', soldierId: 3, killerId: 1, victimName: 'DUSTOFF',
      weaponName: 'Kuchler Mk III', dist: 112.4,
    } as SimEvent], w);
    expect(led.longestKill?.amount).toBe(112.4);
    expect(led.longestKill?.attacker).toBe('SANDMAN');
    expect(led.longestKill?.victim).toBe('DUSTOFF');
    expect(led.fighters.get(1)!.kills).toBe(2);
    expect(led.fighters.get(2)!.deaths).toBe(1);
  });

  it('runs streaks and breaks them on death', () => {
    const w = stub(20, [[1, 'RAVEN', 0], [2, 'PIKE', 1]]);
    const led = new CombatLedger();
    const kill = (killer: number, victim: number): SimEvent =>
      ({ type: 'death', soldierId: victim, killerId: killer, victimName: 'X' } as SimEvent);
    led.applyEvents([kill(1, 2), kill(1, 2), kill(1, 2)], w);
    expect(led.fighters.get(1)!.streak).toBe(3);
    expect(led.fighters.get(1)!.bestStreak).toBe(3);
    led.applyEvents([kill(2, 1)], w); // RAVEN goes down
    expect(led.fighters.get(1)!.streak).toBe(0);
    expect(led.fighters.get(1)!.bestStreak).toBe(3); // the record stands
  });

  it('counts accuracy off rounds sent versus rounds that CONNECTED', () => {
    const w = stub(9, [[1, 'RAVEN', 0], [2, 'PIKE', 1]]);
    const led = new CombatLedger();
    // ten rounds across ten ticks; four of them found a body
    for (let i = 0; i < 10; i++) {
      const evts: SimEvent[] = [{ type: 'shot', soldierId: 1 } as SimEvent];
      if (i < 4) evts.push(dmg(1, 2, 15, false));
      led.applyEvents(evts, w);
    }
    const raven = led.fighters.get(1)!;
    expect(raven.shots).toBe(10);
    expect(raven.hits).toBe(4);
  });

  it('a round that eats masonry is never a connection', () => {
    const w = stub(9, [[1, 'RAVEN', 0]]);
    const led = new CombatLedger();
    // the 'hit' event fires for walls too and carries no attacker on most
    // weapons — which is exactly why accuracy is no longer keyed off it
    led.applyEvents([{ type: 'shot', soldierId: 1 } as SimEvent, { type: 'hit', ownerId: 1 } as SimEvent], w);
    expect(led.fighters.get(1)!.shots).toBe(1);
    expect(led.fighters.get(1)!.hits).toBe(0);
  });

  it('one grenade catching three men is ONE connection, not three', () => {
    const w = stub(9, [[1, 'RAVEN', 0], [2, 'A', 1], [3, 'B', 1], [4, 'C', 1]]);
    const led = new CombatLedger();
    led.applyEvents([
      { type: 'shot', soldierId: 1 } as SimEvent,
      dmg(1, 2, 40, false, 'gl'), dmg(1, 3, 40, false, 'gl'), dmg(1, 4, 40, false, 'gl'),
    ], w);
    expect(led.fighters.get(1)!.shots).toBe(1);
    expect(led.fighters.get(1)!.hits).toBe(1); // never over 100%
    expect(led.blows).toBe(3);                 // but three bodies were hit
  });

  it('never credits a man for hurting himself', () => {
    const w = stub(2, [[1, 'RAVEN', 0]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 1, 55, false)], w); // own grenade
    expect(led.hardest).toBeUndefined();
    expect(led.fighters.get(1)!.dealt).toBe(0);
    expect(led.fighters.get(1)!.taken).toBe(55);
  });

  it('remembers a name after the body is gone from the world', () => {
    const w = stub(30, [[1, 'RAVEN', 0], [2, 'GHOST', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 2, 40, false)], w);
    (w.soldiers as Map<number, unknown>).delete(2); // deleted, as the threat room does
    led.applyEvents([dmg(1, 2, 90, false)], w);
    expect(led.hardest?.victim).toBe('GHOST');
  });

  it('ranks the table by whichever column was asked for', () => {
    const w = stub(15, [[1, 'A', 0], [2, 'B', 0], [3, 'C', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 3, 300, false), dmg(2, 3, 100, false)], w);
    led.applyEvents([{ type: 'death', soldierId: 3, killerId: 2, victimName: 'C' } as SimEvent], w);
    expect(led.table('dealt')[0].name).toBe('A');
    expect(led.table('kills')[0].name).toBe('B');
  });

  it('caps the feed so a long match cannot grow without bound', () => {
    const w = stub(100, [[1, 'A', 0], [2, 'B', 1]]);
    const led = new CombatLedger();
    for (let i = 0; i < 200; i++) led.applyEvents([dmg(1, 2, 90, false)], w);
    expect(led.feed.length).toBeLessThanOrEqual(60);
  });

  it('resets clean between matches', () => {
    const w = stub(5, [[1, 'A', 0], [2, 'B', 1]]);
    const led = new CombatLedger();
    led.applyEvents([dmg(1, 2, 70, false)], w);
    led.reset();
    expect(led.fighters.size).toBe(0);
    expect(led.hardest).toBeUndefined();
    expect(led.totalDamage).toBe(0);
  });
});

describe('the sim hands the board what it needs', () => {
  it("a real damage event names the weapon that threw it — the board's 'what'", () => {
    const w = new World({ seed: 11, mode: 'threat', botsPerTeam: 0 });
    const a = w.addSoldier('ATTACKER', 'infantry', 0, 'bot');
    const b = w.addSoldier('VICTIM', 'infantry', 1, 'bot');
    b.armor = 20; b.maxArmor = 20;
    w.takeEvents(); // clear the spawn chatter
    w.damageSoldier(b, 60, a.id, 'sniper_kuchler_3');
    const dmgs = w.takeEvents().filter((e) => e.type === 'damage');
    expect(dmgs.length).toBe(2); // plate, then flesh
    for (const e of dmgs) {
      expect(e.weapon).toBe('sniper_kuchler_3');
      expect(e.ownerId).toBe(a.id);
      expect(e.soldierId).toBe(b.id);
    }
    // and the ledger folds them back into the one 60-point attack
    const led = new CombatLedger();
    led.applyEvents(dmgs, w);
    expect(led.hardest?.amount).toBe(60);
    expect(led.hardest?.weapon).toBe('sniper_kuchler_3');
  });
});

describe('the picture stops where the desk starts', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  it('reserves the band in ONE place, and nowhere else invents a height', () => {
    expect(css).toMatch(/#app\.board-on\s*\{\s*--board-h:\s*clamp\(132px,\s*22vh,\s*280px\)/);
    expect(css).toMatch(/#app\s*\{[^}]*--board-h:\s*0px/);
  });

  it('the canvas, the HUD and the damage layer all honour it', () => {
    // the canvas and HUD stop at the desk — no inset:0 sneaking back in.
    // The canvas states its height OUTRIGHT: `auto` lets the drawing buffer
    // drive layout, which the renderer then re-measures — the ratchet that
    // once inflated it to 26 million pixels.
    expect(css).toMatch(/#game-canvas\s*\{[^}]*height:\s*calc\(100% - var\(--board-h\)\)/);
    expect(css).not.toMatch(/#game-canvas\s*\{[^}]*height:\s*auto/);
    expect(css).toMatch(/#hud\s*\{[^}]*bottom:\s*var\(--board-h\)/);
    const dmg = readFileSync(new URL('../src/client/damagetext.ts', import.meta.url), 'utf8');
    expect(dmg).toContain('bottom:var(--board-h,0px)');
  });

  it('CINEMASCOPE: 22vh of a 1080p panel leaves a 2.2-2.4:1 picture', () => {
    // the aspect decision, in arithmetic rather than prose
    for (const [w, h] of [[1920, 1080], [1366, 768], [2560, 1440], [1600, 900]]) {
      const desk = Math.max(132, Math.min(280, h * 0.22));
      const aspect = w / (h - desk);
      expect(aspect).toBeGreaterThan(2.1);
      expect(aspect).toBeLessThan(2.45);
    }
  });

  it('never lets the desk eat the game on a short screen', () => {
    const desk = Math.max(132, Math.min(280, 4000 * 0.22));
    expect(desk).toBe(280); // capped — the picture is still the point
  });
});
