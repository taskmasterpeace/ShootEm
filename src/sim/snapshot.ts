import { GRID, T_OPEN, T_RUBBLE, breakWindowTile, isWindowTile } from './map';
import { floorLayer } from './map-layers';
import { SEEN_LINGER, SEEN_LINGER_GEARED, eyesSeePoint, perceivesNow, seenRecently } from './perception';
import type { WeatherState } from './weather';
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
  /** DESTRUCTION: tile indices breached to rubble (cumulative, monotonic) */
  breached: number[];
  /** door tiles that ever changed, with their CURRENT state packed in:
   *  idx*2 + (open ? 1 : 0) — cheap, cumulative, order-free */
  doors: number[];
  /** cumulative broken panes packed as floor*GRID²+idx */
  glass: number[];
  /** §8.8 the sky — every client renders the same storm */
  weather: WeatherState;
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
    breached: w.breached,
    doors: w.doorChanges.map((idx) => idx * 2 + (w.map.grid[idx] === 6 /* T_DOOR_OPEN */ ? 1 : 0)),
    glass: [...w.glassChanges],
    weather: { ...w.weather },
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

/** Build the per-viewer variant of a full snapshot. Pure — safe per client. */
export function cullSnapshotFor(w: World, snap: Snapshot, viewerId: number): Snapshot {
  const viewer = w.soldiers.get(viewerId);
  if (!viewer) return snap; // spectators see the war whole (admin surface)
  const team = viewer.team;

  // friendly eyes: still needed for corpses and vehicles. LIVE enemy soldiers
  // ride the per-tick lastSeen trail the sim stamps (perception.ts): perceived
  // now — cloak, flag, skyline, ping, window LOS — or within the linger of
  // breaking line of sight, so a target never blinks out at the window's edge.
  // Weather (§8.8) taxes the range; tracking optics (§19.2) stretch the linger.
  const range = w.perceiveRange();
  const linger = viewer.equipment.includes('tracking_optics') ? SEEN_LINGER_GEARED : SEEN_LINGER;
  const eyes = [...w.soldiers.values()].filter((s) => s.alive && s.team === team);
  const seesPoint = (x: number, z: number, y = 1.4) => eyesSeePoint(w.map.grid, eyes, x, z, range, y);

  const soldiers = snap.soldiers.flatMap((s) => {
    if (s.team === team) return [s];
    if (s.cloaked && !w.pinged.has(s.id)) return []; // cloak is TRUE — even mid-linger
    if (!s.alive) return seesPoint(s.pos.x, s.pos.z) ? [s] : []; // corpses: where eyes rest
    // seen RIGHT NOW → live position on the wire. "Now" means THIS tick's
    // stamp exactly — a one-tick-old mark is already a ghost, or a mover
    // would leak live coordinates through the linger window.
    const mark = w.lastSeen[team].get(s.id);
    const freshNow = (mark !== undefined && snap.time - mark.t < 0.001)
      || perceivesNow(w.map.grid, eyes, w.pinged, s, range, [], undefined, w.map.grid2, w.map.upperLayers);
    if (freshNow) return [s];
    // §19.1 GHOSTS: within the linger you get the spot you LOST them —
    // frozen — never their live path behind the wall. Re-acquired = live.
    if (seenRecently(w.lastSeen, w.pinged, team, s, snap.time, linger) && mark) {
      return [{ ...s, pos: { ...s.pos, x: mark.x, z: mark.z } }];
    }
    return [];
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
  if (snap.weather) w.weather = snap.weather;
  // DESTRUCTION is cumulative too — breach the puppet's masonry to match.
  // Rubble first, then dug: a pile that was later ground away ends OPEN.
  if (snap.breached && snap.breached.length !== w.breached.length) {
    for (const idx of snap.breached) if (w.map.grid[idx] !== T_OPEN) w.map.grid[idx] = T_RUBBLE;
    w.breached = [...snap.breached];
  }
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
  if (snap.glass) {
    for (const packed of snap.glass) {
      const floor = Math.floor(packed / (GRID * GRID));
      const idx = packed % (GRID * GRID);
      try {
        const layer = floorLayer(w.map, floor);
        if (isWindowTile(layer[idx], floor > 0)) layer[idx] = breakWindowTile(layer[idx], floor > 0);
      } catch { /* snapshot references a floor this legacy puppet did not allocate */ }
    }
    w.glassChanges = [...snap.glass];
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
