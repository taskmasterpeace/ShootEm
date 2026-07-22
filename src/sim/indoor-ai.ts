import { buildingAuthoringLayoutFromMap, deriveBuildingNavigation, type BuildingNavigation } from './building-navigation';
import { isWindowTile, windowIsBroken, type GameMap } from './map';
import { inBounds, tileIndex, tileToWorld, worldToTile, type MapGeometry } from './map-geometry';
import { floorLayer } from './map-layers';
import type { Vec3 } from './types';

export type IndoorIntent = 'post' | 'investigate' | 'search' | 'return' | 'evacuate';

export interface IndoorActorMemory {
  intent: IndoorIntent;
  roomId: number;
  post: Vec3;
  lastKnown?: Vec3;
  searchQueue: number[];
  searchUntil: number;
  portalId?: number;
  portalClaimUntil: number;
  seenAlertAt: number;
  lastProgressPos: Vec3;
  lastProgressAt: number;
  blockedRecoveries: number;
}

export interface IndoorScentNode {
  targetId: number;
  pos: Vec3;
  floor: number;
  at: number;
}

interface IndoorAlert {
  pos: Vec3;
  floor: number;
  at: number;
}

export interface IndoorTacticalState {
  readonly navigation: BuildingNavigation;
  readonly roomCenters: readonly Vec3[];
  readonly origin: { tx: number; tz: number };
  readonly geometry: Readonly<MapGeometry>;
  memories: Map<number, IndoorActorMemory>;
  scents: Map<number, IndoorScentNode[]>;
  claims: Map<number, { actorId: number; until: number }>;
  alert?: IndoorAlert;
  nextBarkAt: Map<number, number>;
}

const FLOOR_HEIGHT = 4;
const SCENT_SECONDS = 8;
const SCENT_NODES = 24;
const DOG_HANDLER_PULL = 32;

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

function freezeNavigation(navigation: BuildingNavigation): BuildingNavigation {
  for (const room of navigation.rooms) {
    Object.freeze(room.tiles);
    Object.freeze(room);
  }
  for (const portal of navigation.portals) Object.freeze(portal);
  Object.freeze(navigation.rooms);
  Object.freeze(navigation.portals);
  for (const floor of navigation.roomByCell) {
    for (const row of floor) Object.freeze(row);
    Object.freeze(floor);
  }
  Object.freeze(navigation.roomByCell);
  return Object.freeze(navigation);
}

export function createIndoorTacticalState(map: GameMap): IndoorTacticalState | null {
  const source = buildingAuthoringLayoutFromMap(map);
  if (!source) return null;
  const navigation = freezeNavigation(deriveBuildingNavigation(source.layout));
  const roomCenters = navigation.rooms.map((room) => {
    const sum = room.tiles.reduce((acc, tile) => ({ x: acc.x + tile.x, z: acc.z + tile.z }), { x: 0, z: 0 });
    const count = Math.max(1, room.tiles.length);
    const center = tileToWorld(map.geometry, source.origin.tx + sum.x / count, source.origin.tz + sum.z / count);
    return Object.freeze({
      x: center.x,
      y: room.floor * FLOOR_HEIGHT,
      z: center.z,
    });
  });
  return {
    navigation,
    roomCenters: Object.freeze(roomCenters),
    origin: Object.freeze({ ...source.origin }),
    geometry: Object.freeze({ ...map.geometry }),
    memories: new Map(), scents: new Map(), claims: new Map(), nextBarkAt: new Map(),
  };
}

function roomAt(state: IndoorTacticalState, pos: Vec3, floor: number): number {
  const [worldTx, worldTz] = worldToTile(state.geometry, pos.x, pos.z);
  const tx = worldTx - state.origin.tx;
  const tz = worldTz - state.origin.tz;
  return state.navigation.roomByCell[floor]?.[tz]?.[tx] ?? -1;
}

function memoryFor(state: IndoorTacticalState, actorId: number, pos: Vec3, floor: number, now: number): IndoorActorMemory {
  let memory = state.memories.get(actorId);
  if (!memory) {
    memory = {
      intent: 'post', roomId: roomAt(state, pos, floor), post: { ...pos }, searchQueue: [],
      searchUntil: 0, portalClaimUntil: 0, seenAlertAt: -Infinity,
      lastProgressPos: { ...pos }, lastProgressAt: now, blockedRecoveries: 0,
    };
    state.memories.set(actorId, memory);
  }
  return memory;
}

export function noteIndoorAlert(state: IndoorTacticalState | undefined, pos: Vec3, floor: number, now: number) {
  if (state) state.alert = { pos: { ...pos }, floor, at: now };
}

export function claimIndoorPortal(state: IndoorTacticalState, actorId: number, candidates: number[], now: number): number | undefined {
  for (const [id, claim] of state.claims) if (claim.until <= now) state.claims.delete(id);
  const selected = candidates.find((id) => {
    const claim = state.claims.get(id);
    return !claim || claim.actorId === actorId;
  });
  if (selected === undefined) return undefined;
  state.claims.set(selected, { actorId, until: now + 0.8 });
  return selected;
}

function adjacentRooms(state: IndoorTacticalState, roomId: number): number[] {
  const result: number[] = [];
  for (const portal of state.navigation.portals) {
    if (!portal.rooms.includes(roomId)) continue;
    for (const id of portal.rooms) if (id !== roomId && !result.includes(id)) result.push(id);
  }
  return result;
}

export function noteIndoorProgress(state: IndoorTacticalState, actorId: number, pos: Vec3, now: number) {
  const memory = state.memories.get(actorId);
  if (!memory) return;
  if (distance(memory.lastProgressPos, pos) > 0.65) {
    memory.lastProgressPos = { ...pos };
    memory.lastProgressAt = now;
    return;
  }
  if (now - memory.lastProgressAt > 1.5) {
    if (memory.portalId !== undefined) state.claims.delete(memory.portalId);
    memory.portalId = undefined;
    memory.portalClaimUntil = 0;
    memory.blockedRecoveries++;
    memory.lastProgressAt = now;
    if (memory.searchQueue.length > 1) memory.searchQueue.push(memory.searchQueue.shift()!);
  }
}

export function indoorGuardWaypoint(
  state: IndoorTacticalState | undefined, actorId: number, pos: Vec3, floor: number, now: number,
): Vec3 | null {
  if (!state) return null;
  const memory = memoryFor(state, actorId, pos, floor, now);
  const alert = state.alert;
  if (alert && alert.at > memory.seenAlertAt) {
    memory.intent = 'investigate';
    memory.lastKnown = { ...alert.pos, y: alert.floor * FLOOR_HEIGHT };
    memory.seenAlertAt = alert.at;
    memory.searchQueue = [];
    const here = roomAt(state, pos, floor);
    const candidates = state.navigation.portals
      .filter((portal) => portal.rooms.includes(here) && portal.floor === floor)
      .map((portal) => portal.id);
    memory.portalId = claimIndoorPortal(state, actorId, candidates, now);
    memory.portalClaimUntil = memory.portalId === undefined ? 0 : now + 0.8;
  }
  if (memory.intent === 'investigate' && memory.lastKnown) {
    if (floor === Math.round(memory.lastKnown.y / FLOOR_HEIGHT) && distance(pos, memory.lastKnown) < 1.7) {
      memory.intent = 'search';
      memory.searchUntil = now + 6;
      const here = roomAt(state, pos, floor);
      memory.roomId = here;
      memory.searchQueue = adjacentRooms(state, here).slice(0, 4);
    } else {
      noteIndoorProgress(state, actorId, pos, now);
      return { ...memory.lastKnown };
    }
  }
  if (memory.intent === 'search') {
    if (now >= memory.searchUntil || memory.searchQueue.length === 0) memory.intent = 'return';
    else {
      const nextRoom = memory.searchQueue[0];
      const target = state.roomCenters[nextRoom];
      if (target && floor === Math.round(target.y / FLOOR_HEIGHT) && distance(pos, target) < 1.5) {
        memory.searchQueue.shift();
        memory.roomId = nextRoom;
      }
      if (target) return { ...target };
    }
  }
  if (memory.intent === 'return') {
    if (floor === Math.round(memory.post.y / FLOOR_HEIGHT) && distance(pos, memory.post) < 1.2) memory.intent = 'post';
    else return { ...memory.post };
  }
  return null;
}

export function indoorCivilianWaypoint(
  state: IndoorTacticalState | undefined, actorId: number, pos: Vec3, floor: number, now: number,
): Vec3 | null {
  if (!state?.alert) return null;
  const memory = memoryFor(state, actorId, pos, floor, now);
  memory.intent = 'evacuate';
  const threat = state.alert.pos;
  const candidates = state.roomCenters.filter((center) => Math.round(center.y / FLOOR_HEIGHT) === floor);
  const safest = candidates.reduce<Vec3 | undefined>((best, center) => !best || distance(center, threat) > distance(best, threat) ? center : best, undefined);
  return safest ? { ...safest } : null;
}

export function recordIndoorScent(state: IndoorTacticalState | undefined, targetId: number, pos: Vec3, now: number) {
  if (!state) return;
  const trail = state.scents.get(targetId) ?? [];
  const latest = trail.at(-1);
  if (latest && now - latest.at < 0.34 && distance(latest.pos, pos) < 0.75) return;
  trail.push({ targetId, pos: { ...pos }, floor: Math.max(0, Math.round(pos.y / FLOOR_HEIGHT)), at: now });
  while (trail.length > SCENT_NODES) trail.shift();
  while (trail.length && now - trail[0].at > SCENT_SECONDS) trail.shift();
  state.scents.set(targetId, trail);
}

function floorsHaveStairs(state: IndoorTacticalState, from: number, to: number): boolean {
  if (from === to) return true;
  const low = Math.min(from, to), high = Math.max(from, to);
  for (let floor = low; floor < high; floor++) {
    if (!state.navigation.portals.some((portal) => portal.kind === 'stairs' && portal.floor === floor && portal.toFloor === floor + 1)) return false;
  }
  return true;
}

export function strongestDogScent(
  state: IndoorTacticalState | undefined, handlerPos: Vec3, handlerFloor: number, now: number,
): IndoorScentNode | null {
  if (!state) return null;
  let best: IndoorScentNode | null = null;
  for (const trail of state.scents.values()) {
    for (let index = trail.length - 1; index >= 0; index--) {
      const node = trail[index];
      if (now - node.at > SCENT_SECONDS || distance(node.pos, handlerPos) > DOG_HANDLER_PULL) continue;
      if (!floorsHaveStairs(state, handlerFloor, node.floor)) continue;
      if (!best || node.at > best.at) best = node;
      break;
    }
  }
  return best ? { ...best, pos: { ...best.pos } } : null;
}

/** Dogs pause at intact glazing instead of understanding it as a human door.
 * Broken panes cease to matter, so a handler can deliberately make an entry. */
export function dogWindowHesitation(map: GameMap, from: Vec3, to: Vec3, floor: number): boolean {
  let layer: Uint8Array;
  try { layer = floorLayer(map, floor); } catch { return false; }
  for (let step = 1; step <= 10; step++) {
    const t = step / 10;
    const [tx, tz] = worldToTile(map.geometry, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
    if (!inBounds(map.geometry, tx, tz)) continue;
    const tile = layer[tileIndex(map.geometry, tx, tz)];
    if (isWindowTile(tile, floor > 0) && !windowIsBroken(tile, floor > 0)) return true;
  }
  return false;
}
