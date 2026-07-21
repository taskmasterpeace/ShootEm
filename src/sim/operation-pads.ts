import { T_DEEP, T_WATER, tileAt, type GameMap } from './map';
import { tileIndex, tileToWorld } from './map-geometry';
import type { Team, VehicleKind } from './types';

export interface OperationPadHull {
  id: string;
  kind: VehicleKind;
}

function key(pos: { x: number; z: number }) {
  return `${pos.x.toFixed(3)}:${pos.z.toFixed(3)}`;
}

export function operationWaterSpawns(map: GameMap, team: Team = 0): Array<{ x: number; y: number; z: number }> {
  const home = map.basePos[team];
  const candidates: Array<{ x: number; y: number; z: number }> = [];
  const seen = new Set<string>();
  const add = (pos: { x: number; y: number; z: number }) => {
    const id = key(pos);
    if (seen.has(id)) return;
    seen.add(id);
    candidates.push({ ...pos });
  };

  for (const pad of map.vehiclePads) {
    if (pad.team === team && pad.kind === 'boat' && [T_WATER, T_DEEP].includes(tileAt(map.grid, pad.pos.x, pad.pos.z, map.geometry))) add(pad.pos);
  }
  const tiles: Array<{ x: number; y: number; z: number }> = [];
  for (let z = 0; z < map.geometry.rows; z++) for (let x = 0; x < map.geometry.cols; x++) {
    const tile = map.grid[tileIndex(map.geometry, x, z)];
    if (tile !== T_WATER && tile !== T_DEEP) continue;
    tiles.push(tileToWorld(map.geometry, x, z));
  }
  tiles.sort((a, b) => ((a.x - home.x) ** 2 + (a.z - home.z) ** 2) - ((b.x - home.x) ** 2 + (b.z - home.z) ** 2));
  for (const pos of tiles) add(pos);
  return candidates;
}

/** Replace generic friendly pads with the exact named hulls committed to an Operation. */
export function dressOperationPads(map: GameMap, hulls: readonly OperationPadHull[]) {
  if (hulls.length === 0) return;
  const safe = map.vehiclePads.filter((pad) => pad.team === 0);
  if (safe.length === 0) throw new Error('Operation ground has no friendly vehicle deployment pads.');
  const unused = new Set(safe.map((_, index) => index));
  const wet = operationWaterSpawns(map);
  let wetIndex = 0;
  const takePosition = (kind: VehicleKind) => {
    if (kind === 'boat') {
      const pos = wet[wetIndex++];
      if (!pos) throw new Error('Operation ground has no navigable deployment lane for a boat hull.');
      return pos;
    }
    const exact = [...unused].find((index) => safe[index].kind === kind);
    const index = exact ?? unused.values().next().value as number | undefined;
    if (index === undefined) return safe[0].pos;
    unused.delete(index);
    return safe[index].pos;
  };
  map.vehiclePads = [
    ...hulls.map((hull) => ({
      kind: hull.kind,
      team: 0 as const,
      pos: { ...takePosition(hull.kind) },
      operationHullId: hull.id,
    })),
    ...map.vehiclePads.filter((pad) => pad.team === 1),
  ];
}
