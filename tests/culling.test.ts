// ---------------------------------------------------------------------------
// 68A — interest-managed snapshots: nobody's wire carries an enemy they
// couldn't perceive. Concealment stops being a rendering hint.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { cullSnapshotFor, takeSnapshot } from '../src/sim/snapshot';
import { World } from '../src/sim/world';

describe('interest-managed snapshots (68A)', () => {
  function staged() {
    const w = new World({ seed: 21, mode: 'tdm' });
    const me = w.addSoldier('Viewer', 'infantry', 0, 'human');
    me.pos = { ...w.map.hillPos };
    return { w, me };
  }

  it('a distant unseen enemy never reaches the wire; a near one does', () => {
    const { w, me } = staged();
    const far = w.addSoldier('Far', 'infantry', 1, 'human');
    far.pos = { x: me.pos.x + 80, y: 0, z: me.pos.z + 40 };
    const near = w.addSoldier('Near', 'infantry', 1, 'human');
    near.pos = { x: me.pos.x + 10, y: 0, z: me.pos.z };
    const snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    const ids = snap.soldiers.map((s) => s.id);
    expect(ids).toContain(me.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(far.id);
  });

  it('teammates are always on the wire, wherever they fight', () => {
    const { w, me } = staged();
    const mate = w.addSoldier('Mate', 'infantry', 0, 'human');
    mate.pos = { x: me.pos.x + 90, y: 0, z: me.pos.z };
    const snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.soldiers.map((s) => s.id)).toContain(mate.id);
  });

  it('cloak is TRUE: a cloaked enemy at ten paces is not on the wire unless pinged', () => {
    const { w, me } = staged();
    const spook = w.addSoldier('Spook', 'infiltrator', 1, 'human');
    spook.pos = { x: me.pos.x + 8, y: 0, z: me.pos.z };
    spook.cloaked = true;
    let snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.soldiers.map((s) => s.id)).not.toContain(spook.id);
    w.pinged.add(spook.id); // a beacon found them
    snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.soldiers.map((s) => s.id)).toContain(spook.id);
  });

  it('a burrowed breacher is TRULY deep; enemy mines need a detector', () => {
    const { w, me } = staged();
    const tun = [...w.vehicles.values()].find((v) => v.kind === 'tunneler' && v.team === 1)!;
    tun.pos = { x: me.pos.x + 10, y: 0, z: me.pos.z };
    tun.burrowed = true;
    w.mines.set(999, { id: 999, team: 1, pos: { x: me.pos.x + 5, y: 0, z: me.pos.z }, ownerId: -1, armed: true } as never);
    let snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.vehicles.map((v) => v.id)).not.toContain(tun.id);
    expect(snap.mines.map((m) => m.id)).not.toContain(999);
    me.equipment = ['mine_detector'];
    snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.mines.map((m) => m.id)).toContain(999);
  });

  it('objective intel is public: the flag carrier is always visible', () => {
    const { w, me } = staged();
    const runner = w.addSoldier('Runner', 'infantry', 1, 'human');
    runner.pos = { x: me.pos.x + 85, y: 0, z: me.pos.z };
    runner.carryingFlag = 0; // they have OUR flag
    const snap = cullSnapshotFor(w, takeSnapshot(w, []), me.id);
    expect(snap.soldiers.map((s) => s.id)).toContain(runner.id);
  });
});
