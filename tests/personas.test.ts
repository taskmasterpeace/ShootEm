// ---------------------------------------------------------------------------
// THE YARD'S PEOPLE + THE GALLERY (COMPETITIVE-ARC §§4,6 — Robert: "going
// against SPECIFIC people… make bots talk trash… words appear over their
// head… yell at me when they're within distance"). Personas are named
// regulars with declared styles and their own scripts; the Gallery is the
// target range with pop-ups and Robert's diagonal runners.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { PAINTBALL_FIELDS } from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import { PB_PERSONAS, personaByName } from '../src/sim/personas';
import { pbBark, pbProximityTaunts, pbStyleOf } from '../src/sim/paintball';
import { GalleryDrill } from '../src/client/gallerydrill';
import { GAUNTLET_MAX } from '../src/client/fieldrecord';

const world = () => {
  const w = new World({ seed: PAINTBALL_FIELDS[0].seed, mode: 'paintball', theme: PAINTBALL_FIELDS[0].theme });
  return w;
};

describe('the yard\'s people', () => {
  it('seven regulars, every one legal: yard marker, real style, full script', () => {
    expect(PB_PERSONAS.length, 'the Gauntlet needs a full crew').toBeGreaterThanOrEqual(GAUNTLET_MAX);
    const names = new Set(PB_PERSONAS.map((p) => p.name));
    expect(names.size, 'no two regulars share a name').toBe(PB_PERSONAS.length);
    for (const p of PB_PERSONAS) {
      expect(WEAPONS[p.marker]?.training, `${p.name} carries a marker, nothing else`).toBe(true);
      expect(['rusher', 'flanker', 'anchor']).toContain(p.style);
      for (const table of ['start', 'splat', 'taunt'] as const) {
        expect(p.lines[table].length, `${p.name} has ${table} lines`).toBeGreaterThan(0);
      }
    }
  });

  it('a persona DECLARES its style — the hash only deals to strangers', () => {
    const w = world();
    const vex = w.addSoldier('Vex', 'infantry', 0, 'bot');
    vex.pbStyle = 'anchor'; // against type on purpose
    expect(pbStyleOf(vex)).toBe('anchor');
  });

  it('a persona speaks its OWN script, as an overhead bark', () => {
    const w = world();
    const marrow = w.addSoldier('Marrow', 'infantry', 0, 'bot');
    w.step(1 / 60, new Map());
    w.takeEvents();
    pbBark(w, marrow, 'splat');
    const barks = w.takeEvents().filter((e) => e.type === 'bark' && e.soldierId === marrow.id);
    expect(barks.length).toBe(1);
    expect(personaByName.get('Marrow')!.lines.splat, 'the line is Marrow\'s, not the stock table')
      .toContain(barks[0].text);
  });

  it('closing on a human draws a YELL — once per mouth per cooldown', () => {
    const w = world();
    const vex = w.addSoldier('Vex', 'infantry', 0, 'bot');
    const me = w.addSoldier('Redline', 'infantry', 1, 'human');
    vex.pos = { x: 5, y: 0, z: 0 };
    me.pos = { x: 12, y: 0, z: 0 }; // 7u — inside yelling distance
    w.step(1 / 60, new Map());
    w.takeEvents();
    // the mode itself taunts during step() — re-arm the mouth so THIS call
    // is the one under test
    vex.pbTauntAt = 0;
    pbProximityTaunts(w);
    const first = w.takeEvents().filter((e) => e.type === 'bark' && e.soldierId === vex.id);
    expect(first.length, 'the mouth runs when it closes').toBe(1);
    expect(personaByName.get('Vex')!.lines.taunt).toContain(first[0].text);
    pbProximityTaunts(w);
    const again = w.takeEvents().filter((e) => e.type === 'bark');
    expect(again.length, 'the cooldown holds the tongue').toBe(0);
  });
});

describe('the Gallery', () => {
  it('counts down, pops a target, and pays for the splat', () => {
    const w = world();
    const me = w.addSoldier('Redline', 'infantry', 0, 'human', { primary: 'marker_blitz' });
    w.step(1 / 60, new Map());
    const lines: string[] = [];
    const drill = new GalleryDrill('Redline', (t) => lines.push(t));
    drill.begin(w, me.id);
    // dummies racked, drill announced
    const dummies = [...w.soldiers.values()].filter((s) => s.dummy);
    expect(dummies.length).toBe(3);
    // through the countdown and into the run
    for (let i = 0; i < 60 * 5; i++) {
      w.step(1 / 60, new Map());
      drill.update(w, me.id, w.takeEvents(), 1 / 60);
    }
    expect(lines.some((l) => l === 'GO!'), 'the countdown fired').toBe(true);
    // exactly one target is LIVE somewhere on the range — splat it
    const live = dummies.find((d) => Math.hypot(d.pos.x - me.pos.x, d.pos.z - me.pos.z) < 45
      && Math.abs(d.pos.z - (me.pos.z - 22)) > 3);
    expect(live, 'a target is up').toBeTruthy();
    w.damageSoldier(live!, 999, me.id, 'marker_blitz');
    for (let i = 0; i < 30; i++) {
      w.step(1 / 60, new Map());
      drill.update(w, me.id, w.takeEvents(), 1 / 60);
    }
    expect(lines.some((l) => l.startsWith('+')), 'the splat paid points').toBe(true);
    // the referee's whistle never interrupts a run — the drill holds the clock
    expect(w.mode.timeLeft).toBeGreaterThan(200);
  });
});
