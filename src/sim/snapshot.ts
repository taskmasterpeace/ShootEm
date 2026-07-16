import { T_OPEN, losClear } from './map';
import type { Gadget, Mine, ModeId, ModeState, Pickup, Projectile, SimEvent, Soldier, ThemeId, Turret, Vehicle } from './types';
import { World } from './world';

/**
 * A puppet world renders authoritative snapshots without simulating: same
 * seed/mode/theme (identical map), locally-generated entities cleared so
 * applySnapshot is the only source of truth. Used by the multiplayer client
 * and the replay player — one recipe, one home.
 */
export function createPuppetWorld(seed: number, mode: ModeId, theme: ThemeId | undefined): World {
  const w = new World({ seed, mode, theme });
  w.puppet = true;
  w.soldiers.clear();
  w.vehicles.clear();
  w.pickups.clear();
  w.takeEvents();
  return w;
}

/** Wire format: full world snapshot. Fine for LAN play at 15Hz. */
export interface Snapshot {
  time: number;
  mode: ModeState;
  soldiers: Soldier[];
  vehicles: Vehicle[];
  turrets: Turret[];
  projectiles: Projectile[];
  pickups: Pickup[];
  mines: Mine[];
  gadgets: Gadget[];
  pinged: number[];
  /** soldier ids hidden in smoke */
  smoked: number[];
  /** tile indices the tunneler has ground open (cumulative) */
  dug: number[];
  /** door tiles that ever changed, with their CURRENT state packed in:
   *  idx*2 + (open ? 1 : 0) — cheap, cumulative, order-free */
  doors: number[];
  events: SimEvent[];
}

const stripBot = (s: Soldier): Soldier => {
  const { botGoal: _bg, botRepathAt: _br, botTargetId: _bt, botStrafeDir: _bs, ...rest } = s;
  return rest as Soldier;
};

// Infinity doesn't survive JSON — encode as -1 on the wire.
const encNum = (n: number) => (Number.isFinite(n) ? n : -1);
const decNum = (n: number) => (n === -1 ? Infinity : n);

/**
 * Wire quantizer, passed as the JSON.stringify replacer on the snapshot
 * path. Physics floats carry ~17 digits of noise ("x":-59.201316285043134)
 * that nothing downstream can perceive; 3 decimals is 1mm of position and
 * 1ms of time. Quantizing at the stringify boundary — not in takeSnapshot —
 * keeps the whole-object-spread invariant: new fields still replicate free.
 */
export const wireRound = (_k: string, v: unknown): unknown =>
  typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v;

export function takeSnapshot(w: World, events: SimEvent[]): Snapshot {
  return {
    time: w.time,
    mode: { ...w.mode, timeLeft: encNum(w.mode.timeLeft), nextWaveAt: w.mode.nextWaveAt !== undefined ? encNum(w.mode.nextWaveAt) : undefined },
    soldiers: [...w.soldiers.values()].map((s) => ({
      ...stripBot(s),
      clip: s.clip.map(encNum),
      reserve: s.reserve.map(encNum),
    })),
    vehicles: [...w.vehicles.values()],
    turrets: [...w.turrets.values()],
    projectiles: [...w.projectiles.values()],
    pickups: [...w.pickups.values()],
    mines: [...w.mines.values()],
    gadgets: [...w.gadgets.values()].map((g) => ({ ...g, hp: encNum(g.hp), maxHp: encNum(g.maxHp), expiresAt: encNum(g.expiresAt) })),
    pinged: [...w.pinged],
    smoked: [...w.smoked],
    dug: w.dug,
    doors: w.doorChanges.map((idx) => idx * 2 + (w.map.grid[idx] === 6 /* T_DOOR_OPEN */ ? 1 : 0)),
    events,
  };
}

// ---------------------------------------------------------------------------
// 68A — interest-managed snapshots. Sending hidden enemy positions to every
// client is an architecture defect, not a future anti-cheat problem: cull
// each client's snapshot to what that player could plausibly PERCEIVE. The
// perception rules mirror the HUD's minimap (and become §19's light cone).
// No wss:// endpoint goes public without this.
// ---------------------------------------------------------------------------

const PERCEIVE_RANGE = 65;

/** Build the per-viewer variant of a full snapshot. Pure — safe per client. */
export function cullSnapshotFor(w: World, snap: Snapshot, viewerId: number): Snapshot {
  const viewer = w.soldiers.get(viewerId);
  if (!viewer) return snap; // spectators see the war whole (admin surface)
  const team = viewer.team;

  // friendly eyes: every living soldier on the viewer's team
  const eyes = [...w.soldiers.values()].filter((s) => s.alive && s.team === team);
  const seesPoint = (x: number, z: number, y = 1.4) =>
    eyes.some((e) =>
      Math.hypot(x - e.pos.x, z - e.pos.z) < PERCEIVE_RANGE &&
      losClear(w.map.grid, { x: e.pos.x, y: 1.4, z: e.pos.z }, { x, y, z }));

  const soldiers = snap.soldiers.filter((s) => {
    if (s.team === team) return true;
    if (s.cloaked && !w.pinged.has(s.id)) return false;      // cloak is TRUE now
    if (s.carryingFlag !== -1) return true;                   // objective intel is public
    // the SKYLINE rule (§8.4): a soldier up on the second storey is
    // silhouetted against the sky — ground walls don't hide someone
    // standing above them (and their muzzle already clears those walls)
    if (s.pos.y > 3 && eyes.some((e) => Math.hypot(s.pos.x - e.pos.x, s.pos.z - e.pos.z) < PERCEIVE_RANGE)) return true;
    return w.pinged.has(s.id) || seesPoint(s.pos.x, s.pos.z);
  });
  const vehicles = snap.vehicles.filter((v) => {
    if (v.team === team) return true;
    if (v.burrowed) return false;                             // deep is TRULY deep
    const ecmDead = v.systems && v.systems.ecm <= 0;          // dead ECM broadcasts you
    return ecmDead || seesPoint(v.pos.x, v.pos.z, 1.8);
  });
  // enemy mines are invisible without a detector on YOUR kit — now on the wire too
  const hasDetector = viewer.equipment.includes('mine_detector');
  const mines = snap.mines.filter((m) => m.team === team || hasDetector);
  return { ...snap, soldiers, vehicles, mines };
}

/** Overwrite a puppet world's dynamic state from an authoritative snapshot. */
export function applySnapshot(w: World, snap: Snapshot) {
  w.time = snap.time;
  w.mode = {
    ...snap.mode,
    timeLeft: decNum(snap.mode.timeLeft),
    nextWaveAt: snap.mode.nextWaveAt !== undefined ? decNum(snap.mode.nextWaveAt) : undefined,
  };

  const seen = new Set<number>();
  for (const sd of snap.soldiers) {
    seen.add(sd.id);
    const cur = w.soldiers.get(sd.id);
    const next: Soldier = {
      ...(cur ?? ({} as Soldier)),
      ...sd,
      clip: sd.clip.map(decNum),
      reserve: sd.reserve.map(decNum),
    };
    w.soldiers.set(sd.id, next);
  }
  for (const id of [...w.soldiers.keys()]) if (!seen.has(id)) w.soldiers.delete(id);

  syncMap(w.vehicles, snap.vehicles);
  syncMap(w.turrets, snap.turrets);
  syncMap(w.projectiles, snap.projectiles);
  syncMap(w.pickups, snap.pickups);
  syncMap(w.mines, snap.mines);
  syncMap(w.gadgets, snap.gadgets.map((g) => ({ ...g, hp: decNum(g.hp), maxHp: decNum(g.maxHp), expiresAt: decNum(g.expiresAt) })));
  w.pinged = new Set(snap.pinged);
  w.smoked = new Set(snap.smoked ?? []);
  // tunneler damage is cumulative — grind the puppet's grid to match
  if (snap.dug && snap.dug.length !== w.dug.length) {
    for (const idx of snap.dug) w.map.grid[idx] = T_OPEN;
    w.dug = [...snap.dug];
  }
  // doors: set every changed door to its authoritative state
  if (snap.doors) {
    for (const packed of snap.doors) {
      const idx = packed >> 1;
      if (w.map.grid[idx] === 5 || w.map.grid[idx] === 6) {
        w.map.grid[idx] = (packed & 1) ? 6 : 5; // T_DOOR_OPEN : T_DOOR
      }
    }
  }
}

function syncMap<T extends { id: number }>(map: Map<number, T>, arr: T[]) {
  const seen = new Set<number>();
  for (const item of arr) {
    seen.add(item.id);
    const cur = map.get(item.id);
    map.set(item.id, cur ? { ...cur, ...item } : item);
  }
  for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
}
