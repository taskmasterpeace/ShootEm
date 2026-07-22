import type { BuildingSection, BuildingSocket } from './building-generator';
import {
  F2_BALCONY,
  F2_DOOR_H,
  F2_DOOR_H_OPEN,
  F2_DOOR_V,
  F2_DOOR_V_OPEN,
  F2_RAIL_H,
  F2_RAIL_V,
  F2_SHUTTER,
  F2_SHUTTER_OPEN,
  F2_STAIR_N,
  F2_STAIR_W,
  F2_THIN_WALL_H,
  F2_THIN_WALL_HV,
  F2_THIN_WALL_V,
  F2_WALL,
  F2_WELL,
  F2_VOID,
  T_LADDER,
  T_SECTION_SHUTTER,
  T_SECTION_SHUTTER_OPEN,
  T_STAIRS_N,
  T_STAIRS_W,
  T_THIN_DOOR_H,
  T_THIN_DOOR_H_OPEN,
  T_THIN_DOOR_V,
  T_THIN_DOOR_V_OPEN,
  T_THIN_WALL_H,
  T_THIN_WALL_HV,
  T_THIN_WALL_V,
  T_WALL,
  isWindowTile,
  windowSpansX,
  type GameMap,
} from './map';
import { floorLayer } from './map-layers';

export const BUILDING_LAWS = [
  'STRUCTURE', 'ROOMS', 'CIRCULATION', 'FACADE',
  'GLASS', 'SECTIONS', 'ENCOUNTERS', 'PERFORMANCE',
] as const;
export type BuildingLaw = typeof BUILDING_LAWS[number];

export type BuildingPortalKind = 'door' | 'window' | 'stairs' | 'ladder' | 'shutter';

export interface BuildingRoom {
  id: number;
  floor: number;
  tiles: { x: number; z: number }[];
}

export interface BuildingPortal {
  id: number;
  kind: BuildingPortalKind;
  floor: number;
  x: number;
  z: number;
  rooms: number[];
  toFloor?: number;
}

export interface BuildingNavigation {
  rooms: BuildingRoom[];
  portals: BuildingPortal[];
  roomByCell: number[][][];
}

export interface BuildingLawIssue {
  law: BuildingLaw;
  detail: string;
  floor?: number;
  tiles: { x: number; z: number }[];
}

export interface BuildingMetrics {
  occupiedTiles: number;
  facadeSegments: number;
  encounterSockets: number;
  initialNpcs: number;
}

export interface BuildingLawReport {
  ok: boolean;
  issues: BuildingLawIssue[];
  navigation: BuildingNavigation;
  metrics: BuildingMetrics;
}

export interface BuildingAuthoringLayout {
  floors: number;
  width: number;
  height: number;
  layers: string[][];
  sockets: BuildingSocket[];
  sections: BuildingSection[];
}

export interface MapBuildingLayout {
  layout: BuildingAuthoringLayout;
  origin: { tx: number; tz: number };
}

const ROOM_TILE = new Set(['.', 'A', 'L', 'B', 'P']);
const WALKABLE = new Set([...ROOM_TILE, 'h', 'v']);
const OCCUPIED = (char: string | undefined) => char !== undefined && char !== ' ';
const key = (floor: number, x: number, z: number) => `${floor}:${x},${z}`;

function mapTileChar(tile: number, floor: number): string {
  if (floor === 0) {
    if (tile === T_WALL) return '+';
    if (tile === T_THIN_WALL_H) return '-';
    if (tile === T_THIN_WALL_V) return '|';
    if (tile === T_THIN_WALL_HV) return '+';
    if (tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_H_OPEN) return 'h';
    if (tile === T_THIN_DOOR_V || tile === T_THIN_DOOR_V_OPEN) return 'v';
    if (isWindowTile(tile)) return windowSpansX(tile) ? '=' : '!';
    if (tile >= T_STAIRS_N && tile <= T_STAIRS_W) return 'A';
    if (tile === T_LADDER) return 'L';
    if (tile === T_SECTION_SHUTTER || tile === T_SECTION_SHUTTER_OPEN) return 'X';
    return '.';
  }
  if (tile === F2_VOID) return ' ';
  if (tile === F2_WALL) return '+';
  if (tile === F2_THIN_WALL_H) return '-';
  if (tile === F2_THIN_WALL_V) return '|';
  if (tile === F2_THIN_WALL_HV) return '+';
  if (tile === F2_DOOR_H || tile === F2_DOOR_H_OPEN) return 'h';
  if (tile === F2_DOOR_V || tile === F2_DOOR_V_OPEN) return 'v';
  if (isWindowTile(tile, true)) return windowSpansX(tile, true) ? '=' : '!';
  if (tile >= F2_STAIR_N && tile <= F2_STAIR_W) return 'A';
  if (tile === F2_WELL) return 'L';
  if (tile === F2_BALCONY) return 'B';
  if (tile === F2_RAIL_H || tile === F2_RAIL_V) return 'R';
  if (tile === F2_SHUTTER || tile === F2_SHUTTER_OPEN) return 'X';
  return '.';
}

/** Reconstruct the generator's local authoring layout from stamped map tiles.
 * Only provenance-bearing maps opt in, preserving all legacy law behavior. */
export function buildingAuthoringLayoutFromMap(map: GameMap): MapBuildingLayout | null {
  const meta = map.buildingMeta;
  if (!meta) return null;
  const house = meta.origin
    ? map.houses.find((candidate) => candidate.tx === meta.origin!.tx && candidate.tz === meta.origin!.tz)
    : map.houses[0];
  const origin = meta.origin ?? (house ? { tx: house.tx, tz: house.tz } : undefined);
  const width = meta.width ?? house?.tw;
  const height = meta.height ?? house?.th;
  if (!origin || !width || !height) return null;
  const layers: string[][] = [];
  for (let floor = 0; floor < meta.floors; floor++) {
    let layer: Uint8Array;
    try { layer = floorLayer(map, floor); } catch { return null; }
    const rows: string[] = [];
    for (let z = 0; z < height; z++) {
      let row = '';
      for (let x = 0; x < width; x++) {
        const tx = origin.tx + x, tz = origin.tz + z;
        const inGroundMask = floor > 0 || !house?.maskRows || ((house.maskRows[z] ?? 0) & (1 << x)) !== 0;
        row += tx < 0 || tz < 0 || tx >= map.geometry.cols || tz >= map.geometry.rows || !inGroundMask
          ? ' '
          : mapTileChar(layer[tz * map.geometry.cols + tx], floor);
      }
      rows.push(row);
    }
    layers.push(rows);
  }
  return {
    origin,
    layout: {
      floors: meta.floors,
      width,
      height,
      layers,
      sockets: (meta.sockets ?? []) as BuildingSocket[],
      sections: (meta.sections ?? []) as BuildingSection[],
    },
  };
}

function chars(building: BuildingAuthoringLayout, floor: number): string[][] {
  return (building.layers[floor] ?? []).map((row) => row.padEnd(building.width, ' ').split(''));
}

function adjacentRooms(
  roomByCell: number[][][], floor: number, x: number, z: number,
  orientation?: 'h' | 'v',
): number[] {
  const dirs = orientation === 'h' ? [[0, -1], [0, 1]]
    : orientation === 'v' ? [[-1, 0], [1, 0]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  return [...new Set(dirs.map(([dx, dz]) => roomByCell[floor]?.[z + dz]?.[x + dx] ?? -1).filter((id) => id >= 0))];
}

/** Flood room interiors without crossing door cells, then turn doors/windows
 * and aligned vertical circulation into a compact immutable portal graph. */
export function deriveBuildingNavigation(building: BuildingAuthoringLayout): BuildingNavigation {
  const roomByCell: number[][][] = [];
  const rooms: BuildingRoom[] = [];
  const layers = building.layers.map((_, floor) => chars(building, floor));
  for (let floor = 0; floor < layers.length; floor++) {
    const layer = layers[floor];
    const ids = Array.from({ length: layer.length }, () => Array.from({ length: building.width }, () => -1));
    roomByCell.push(ids);
    for (let z = 0; z < layer.length; z++) for (let x = 0; x < building.width; x++) {
      if (!ROOM_TILE.has(layer[z]?.[x]) || ids[z][x] >= 0) continue;
      const room: BuildingRoom = { id: rooms.length, floor, tiles: [] };
      const queue: [number, number][] = [[x, z]];
      ids[z][x] = room.id;
      while (queue.length) {
        const [cx, cz] = queue.pop()!;
        room.tiles.push({ x: cx, z: cz });
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx, nz = cz + dz;
          if (nz < 0 || nx < 0 || nz >= layer.length || nx >= building.width) continue;
          if (ids[nz][nx] < 0 && ROOM_TILE.has(layer[nz][nx])) {
            ids[nz][nx] = room.id;
            queue.push([nx, nz]);
          }
        }
      }
      rooms.push(room);
    }
  }

  const portals: BuildingPortal[] = [];
  const add = (portal: Omit<BuildingPortal, 'id'>) => portals.push({ id: portals.length, ...portal });
  for (let floor = 0; floor < layers.length; floor++) {
    const layer = layers[floor];
    for (let z = 0; z < layer.length; z++) for (let x = 0; x < building.width; x++) {
      const char = layer[z][x];
      if (char === 'h' || char === 'v') add({ kind: 'door', floor, x, z, rooms: adjacentRooms(roomByCell, floor, x, z, char) });
      else if (char === '=' || char === '!') add({ kind: 'window', floor, x, z, rooms: adjacentRooms(roomByCell, floor, x, z, char === '=' ? 'h' : 'v') });
      else if (char === 'X') add({ kind: 'shutter', floor, x, z, rooms: adjacentRooms(roomByCell, floor, x, z) });
    }
  }
  for (let floor = 0; floor < layers.length - 1; floor++) {
    for (let z = 0; z < layers[floor].length; z++) for (let x = 0; x < building.width; x++) {
      const here = layers[floor][z]?.[x];
      const above = layers[floor + 1]?.[z]?.[x];
      const kind: BuildingPortalKind | null = here === 'A' && above === 'A' ? 'stairs'
        : here === 'L' && above === 'L' ? 'ladder' : null;
      if (!kind) continue;
      const rooms = [roomByCell[floor]?.[z]?.[x], roomByCell[floor + 1]?.[z]?.[x]].filter((id) => id >= 0);
      add({ kind, floor, x, z, rooms, toFloor: floor + 1 });
    }
  }
  return { rooms, portals, roomByCell };
}

function issue(issues: BuildingLawIssue[], law: BuildingLaw, detail: string, tiles: { x: number; z: number }[] = [], floor?: number) {
  issues.push({ law, detail, tiles: tiles.slice(0, 24), ...(floor === undefined ? {} : { floor }) });
}

function socketWalkable(building: BuildingAuthoringLayout, socket: BuildingSocket): boolean {
  return WALKABLE.has(building.layers[socket.floor]?.[socket.z]?.[socket.x] ?? ' ');
}

export function validateWholeBuilding(building: BuildingAuthoringLayout): BuildingLawReport {
  const issues: BuildingLawIssue[] = [];
  const navigation = deriveBuildingNavigation(building);
  const height = building.layers[0]?.length ?? 0;
  const aligned = building.layers.every((layer) => layer.length === height && layer.every((row) => row.length === building.width));
  if (building.layers.length < 1 || building.layers.length > 3 || building.layers.length !== building.floors || !aligned) {
    issue(issues, 'STRUCTURE', `expected 1–3 aligned storeys; found floors=${building.floors}, layers=${building.layers.length}`);
  }

  const tinyRooms = navigation.rooms.filter((room) => room.tiles.length < 2);
  const deadDoors = navigation.portals.filter((portal) => portal.kind === 'door' && portal.rooms.length === 0);
  if (tinyRooms.length || deadDoors.length) {
    issue(issues, 'ROOMS', `${tinyRooms.length} undersized rooms and ${deadDoors.length} doors with no room`,
      tinyRooms.flatMap((room) => room.tiles).slice(0, 24), tinyRooms[0]?.floor);
  }

  const missingCirculation: { x: number; z: number }[] = [];
  for (let floor = 0; floor < building.layers.length - 1; floor++) {
    if (!navigation.portals.some((portal) => portal.kind === 'stairs' && portal.floor === floor)) {
      missingCirculation.push({ x: Math.floor(building.width / 2), z: Math.floor(height / 2) });
    }
  }
  if (missingCirculation.length) issue(issues, 'CIRCULATION', `${missingCirculation.length} storey links are missing or misaligned`, missingCirculation);

  let facadeSegments = 0;
  const facadeBreaches: { x: number; z: number }[] = [];
  const glassFaults: { x: number; z: number }[] = [];
  for (let floor = 0; floor < building.layers.length; floor++) {
    const layer = chars(building, floor);
    for (let z = 0; z < layer.length; z++) for (let x = 0; x < building.width; x++) {
      const char = layer[z][x];
      if (!OCCUPIED(char)) continue;
      const outside = [
        !OCCUPIED(layer[z - 1]?.[x]), !OCCUPIED(layer[z + 1]?.[x]),
        !OCCUPIED(layer[z]?.[x - 1]), !OCCUPIED(layer[z]?.[x + 1]),
      ];
      const exposed = outside.filter(Boolean).length;
      facadeSegments += exposed;
      if (exposed && ROOM_TILE.has(char)) facadeBreaches.push({ x, z });
      const opensWithin = (dx: number, dz: number) => {
        // A facade window may open across a compact balcony deck and its rail
        // before open air. It may not open into another room or corridor.
        for (let distance = 1; distance <= 3; distance++) {
          const next = layer[z + dz * distance]?.[x + dx * distance];
          if (!OCCUPIED(next)) return true;
          if (next !== 'B' && next !== 'R') return false;
        }
        return false;
      };
      if (char === '=' && !(opensWithin(0, -1) || opensWithin(0, 1))) glassFaults.push({ x, z });
      if (char === '!' && !(opensWithin(-1, 0) || opensWithin(1, 0))) glassFaults.push({ x, z });
    }
  }
  const exteriorDoors = navigation.portals.filter((portal) => portal.kind === 'door' && portal.rooms.length === 1);
  if (facadeBreaches.length || exteriorDoors.length === 0) {
    issue(issues, 'FACADE', `${facadeBreaches.length} open facade cells; ${exteriorDoors.length} exterior doors`, facadeBreaches);
  }
  if (glassFaults.length) issue(issues, 'GLASS', `${glassFaults.length} windows do not face outside`, glassFaults);

  const sectionOwner = new Map<string, string>();
  const sectionFaults: { x: number; z: number }[] = [];
  for (const section of building.sections) for (const tile of section.tiles) {
    const id = key(tile.floor, tile.x, tile.z);
    if (sectionOwner.has(id) && sectionOwner.get(id) !== section.id) sectionFaults.push({ x: tile.x, z: tile.z });
    sectionOwner.set(id, section.id);
  }
  const active = new Set(building.sections.filter((section) => section.active).map((section) => section.id));
  for (const socket of building.sockets.filter((entry) => entry.required)) {
    if (building.sections.length && !active.has(socket.sectionId)) sectionFaults.push({ x: socket.x, z: socket.z });
  }
  if (sectionFaults.length) issue(issues, 'SECTIONS', `${sectionFaults.length} overlapping or inactive required section cells`, sectionFaults);

  const badSockets = building.sockets.filter((socket) => !socketWalkable(building, socket));
  const initialNpcs = building.sockets.filter((socket) => socket.required
    && (socket.kind === 'guard' || socket.kind === 'civilian' || socket.kind === 'dog-handler')).length;
  if (badSockets.length || building.sockets.length > 48 || initialNpcs > 16) {
    issue(issues, 'ENCOUNTERS', `${badSockets.length} invalid sockets; ${building.sockets.length}/48 sockets; ${initialNpcs}/16 initial NPCs`,
      badSockets.map(({ x, z }) => ({ x, z })));
  }

  const occupiedTiles = building.layers.reduce((total, layer) => total
    + layer.reduce((n, row) => n + [...row].filter((char) => OCCUPIED(char)).length, 0), 0);
  if (occupiedTiles > 650 || facadeSegments > 220 || building.sockets.length > 48) {
    issue(issues, 'PERFORMANCE', `${occupiedTiles}/650 occupied tiles; ${facadeSegments}/220 facade segments; ${building.sockets.length}/48 sockets`);
  }
  const metrics = { occupiedTiles, facadeSegments, encounterSockets: building.sockets.length, initialNpcs };
  return { ok: issues.length === 0, issues, navigation, metrics };
}
