// ---------------------------------------------------------------------------
// READ THE RING — the boot-camp station (§UI: "one 30-second station in the
// existing paintball flow"). Three dummies at full / two-thirds / a sliver,
// standing in a row on your own side of the yard. Splat the weakest first
// and the ring has taught you everything it will ever teach. One instructor
// line covers every future readout in the game — because it's all one ring.
// ---------------------------------------------------------------------------
import type { SimEvent } from '../sim/types';
import type { World } from '../sim/world';

interface Dummy { id: number; hpFrac: number }

export class RingDrill {
  private dummies: Dummy[] = [];
  private sliverId = -1;
  private done = false;
  private started = false;

  constructor(private say: (text: string, big: boolean) => void) {}

  begin(world: World, localId: number) {
    if (this.started) return;
    this.started = true;
    const me = world.soldiers.get(localId);
    if (!me) return;
    // a row across the spawn: full on the left, two-thirds middle, sliver right
    const spots: { frac: number; dx: number; dz: number }[] = [
      { frac: 1, dx: 4, dz: -6 },
      { frac: 2 / 3, dx: 6, dz: 0 },
      { frac: 0.15, dx: 4, dz: 6 },
    ];
    for (const [i, sp] of spots.entries()) {
      const d = world.addSoldier(`RING-${i + 1}`, 'infantry', 0, 'bot');
      d.dummy = true;
      d.pos.x = me.pos.x + sp.dx;
      d.pos.z = me.pos.z + sp.dz;
      d.pos.y = 0;
      d.hp = d.maxHp * sp.frac;
      if (sp.frac < 0.2) this.sliverId = d.id;
      this.dummies.push({ id: d.id, hpFrac: sp.frac });
    }
    this.say('READ THE RING — three dummies ahead. Splat the WEAKEST first.', true);
  }

  update(world: World, localId: number, events?: SimEvent[]) {
    if (this.done || !this.started) return;
    for (const e of events ?? []) {
      if (e.type !== 'hit' || e.soldierId === undefined || e.ownerId !== localId) continue;
      const hitDummy = this.dummies.find((d) => d.id === e.soldierId);
      if (!hitDummy) continue;
      // the lesson lands on the FIRST dummy the PLAYER bleeds
      this.done = true;
      if (e.soldierId === this.sliverId) {
        this.say("That's the read. Everyone sees the chunks — recon sees the grade, medics and optics see the truth.", true);
      } else {
        this.say('The ring told you which one was weakest. Everyone sees the chunks — recon sees the grade, medics and optics see the truth.', true);
      }
      // the yard resumes its war — the dummies fold
      for (const d of this.dummies) {
        const s = world.soldiers.get(d.id);
        if (s && s.id !== e.soldierId) { s.hp = 0; s.alive = false; }
      }
      return;
    }
  }
}
