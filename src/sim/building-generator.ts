import { architectureProfile, cityProfile, type CityArchitectureProfile } from './city-profile';
import { stencilConnected, type BuildingDef } from './buildings';
import { Rng } from './rng';

export const BUILDING_ARCHETYPES = [
  'cottage', 'row-house', 'apartment', 'command-villa',
  'storefront', 'office', 'mall-section', 'hotel',
  'workshop', 'factory', 'depot', 'processing-hall',
  'clinic', 'research-annex', 'government-office',
  'barracks', 'armory', 'command-post', 'secure-archive',
] as const;
export type BuildingArchetype = typeof BUILDING_ARCHETYPES[number];

export const FOOTPRINT_FAMILIES = ['rectangle', 'l-shape', 'courtyard', 'twin-wing', 'arcade'] as const;
export type FootprintFamily = typeof FOOTPRINT_FAMILIES[number];
export type BuildingUse = 'residential' | 'commercial' | 'industrial' | 'civic' | 'military';
export type BuildingSocketKind = 'entry' | 'exit' | 'objective' | 'guard' | 'civilian' | 'dog-handler' | 'reinforcement';

export interface BuildingSocket {
  id: string;
  kind: BuildingSocketKind;
  x: number;
  z: number;
  floor: number;
  sectionId: 'west' | 'east';
  required: boolean;
}

export interface BuildingSection {
  id: 'west' | 'east';
  active: boolean;
  tiles: { x: number; z: number; floor: number }[];
}

export interface GeneratedBuilding {
  archetype: BuildingArchetype;
  use: BuildingUse;
  cityId: string;
  cityName: string;
  seed: number;
  validationSeed: number;
  floors: 1 | 2 | 3;
  footprint: FootprintFamily;
  width: number;
  height: number;
  layers: string[][];
  def: BuildingDef;
  sockets: BuildingSocket[];
  sections: BuildingSection[];
  architecture: CityArchitectureProfile;
  provenance: { cityId: string; archetype: BuildingArchetype; seed: number; grammarVersion: 1 };
}

export interface GenerateCityBuildingOptions {
  cityId: string;
  archetype: BuildingArchetype;
  seed: number;
  floors: 1 | 2 | 3;
  footprint?: FootprintFamily;
  missionSection?: 'west' | 'east' | 'single-choke';
}

interface ArchetypeSpec {
  use: BuildingUse;
  width: [number, number];
  height: [number, number];
  serviceLadder: boolean;
  windowEvery: number;
}

const A = (use: BuildingUse, width: [number, number], height: [number, number], serviceLadder = false, windowEvery = 3): ArchetypeSpec =>
  ({ use, width, height, serviceLadder, windowEvery });

const ARCHETYPE_SPEC: Record<BuildingArchetype, ArchetypeSpec> = {
  cottage: A('residential', [7, 10], [6, 9], false, 2),
  'row-house': A('residential', [10, 14], [8, 11], false, 3),
  apartment: A('residential', [14, 19], [11, 16], true, 3),
  'command-villa': A('residential', [12, 17], [10, 14], true, 3),
  storefront: A('commercial', [10, 14], [8, 11], false, 2),
  office: A('commercial', [14, 20], [11, 16], true, 3),
  'mall-section': A('commercial', [18, 25], [13, 19], true, 2),
  hotel: A('commercial', [15, 21], [12, 17], true, 3),
  workshop: A('industrial', [10, 15], [8, 12], false, 4),
  factory: A('industrial', [18, 24], [13, 18], true, 4),
  depot: A('industrial', [15, 21], [10, 15], true, 4),
  'processing-hall': A('industrial', [18, 25], [13, 19], true, 4),
  clinic: A('civic', [12, 17], [10, 14], false, 3),
  'research-annex': A('civic', [14, 20], [11, 16], true, 3),
  'government-office': A('civic', [15, 21], [12, 17], true, 3),
  barracks: A('military', [14, 19], [10, 14], true, 4),
  armory: A('military', [12, 17], [10, 14], true, 5),
  'command-post': A('military', [14, 20], [11, 16], true, 4),
  'secure-archive': A('military', [13, 18], [11, 16], true, 5),
};

type Grid = string[][];
const key = (x: number, z: number) => `${x},${z}`;
const WALKABLE = new Set(['.', 'h', 'v', 'A', 'L', 'B', 'P']);

function makeMask(width: number, height: number, family: FootprintFamily): boolean[][] {
  const mask = Array.from({ length: height }, () => Array.from({ length: width }, () => true));
  if (family === 'l-shape') {
    const cutX = Math.floor(width * 0.58), cutZ = Math.floor(height * 0.45);
    for (let z = 0; z < cutZ; z++) for (let x = cutX; x < width; x++) mask[z][x] = false;
  } else if (family === 'courtyard') {
    const x0 = Math.max(3, Math.floor(width * 0.34)), x1 = Math.min(width - 3, Math.ceil(width * 0.66));
    const z0 = Math.max(3, Math.floor(height * 0.34)), z1 = Math.min(height - 3, Math.ceil(height * 0.66));
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) mask[z][x] = false;
  } else if (family === 'twin-wing') {
    const gap0 = Math.floor(width * 0.42), gap1 = Math.ceil(width * 0.58);
    for (let z = 0; z < height - 3; z++) for (let x = gap0; x < gap1; x++) mask[z][x] = false;
  } else if (family === 'arcade') {
    const left = Math.floor(width * 0.25), right = Math.ceil(width * 0.75);
    for (let z = height - 3; z < height; z++) {
      for (let x = 1; x < left; x++) mask[z][x] = false;
      for (let x = right; x < width - 1; x++) mask[z][x] = false;
    }
  }
  return mask;
}

const occupied = (mask: boolean[][], x: number, z: number) => !!mask[z]?.[x];

function shell(mask: boolean[][], windowEvery: number): Grid {
  const height = mask.length, width = mask[0].length;
  const grid = Array.from({ length: height }, () => Array.from({ length: width }, () => ' '));
  for (let z = 0; z < height; z++) for (let x = 0; x < width; x++) {
    if (!mask[z][x]) continue;
    const north = !occupied(mask, x, z - 1), south = !occupied(mask, x, z + 1);
    const west = !occupied(mask, x - 1, z), east = !occupied(mask, x + 1, z);
    const boundaryCount = Number(north) + Number(south) + Number(west) + Number(east);
    if (boundaryCount >= 2) grid[z][x] = '+';
    else if (north || south) grid[z][x] = (x + z) % windowEvery === 0 ? '=' : '-';
    else if (west || east) grid[z][x] = (x + z) % windowEvery === 0 ? '!' : '|';
    else grid[z][x] = '.';
  }
  return grid;
}

function exteriorCandidates(grid: Grid, mask: boolean[][], side: 'north' | 'south'): { x: number; z: number }[] {
  const height = grid.length, width = grid[0].length;
  const dz = side === 'south' ? 1 : -1;
  const candidates: { x: number; z: number }[] = [];
  for (let z = 0; z < height; z++) for (let x = 1; x < width - 1; x++) {
    if (!occupied(mask, x, z) || occupied(mask, x, z + dz) || !occupied(mask, x, z - dz)) continue;
    // A courtyard or gap between twin wings is void, but it is not OUTSIDE.
    // The outward ray must stay empty all the way to the document edge.
    let outside = true;
    for (let oz = z + dz; oz >= 0 && oz < height; oz += dz) {
      if (occupied(mask, x, oz)) { outside = false; break; }
    }
    if (!outside) continue;
    if (grid[z][x] === '-' || grid[z][x] === '=') candidates.push({ x, z });
  }
  return candidates.sort((a, b) => Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2));
}

function addGroundExits(grid: Grid, mask: boolean[][]): { entry: { x: number; z: number }; exit: { x: number; z: number } } {
  const south = exteriorCandidates(grid, mask, 'south');
  const north = exteriorCandidates(grid, mask, 'north');
  const entry = south[0] ?? north[0];
  const exit = north.find((point) => point.x !== entry?.x || point.z !== entry?.z) ?? south[1];
  if (!entry || !exit) throw new Error('building grammar could not place two exterior exits');
  grid[entry.z][entry.x] = 'h';
  grid[exit.z][exit.x] = 'h';
  return { entry, exit };
}

function addPartitions(grid: Grid, splitX = Math.floor(grid[0].length / 2)): void {
  const height = grid.length, width = grid[0].length;
  const runs: number[][] = [];
  let run: number[] = [];
  for (let z = 1; z < height - 1; z++) {
    const valid = grid[z][splitX] === '.' && WALKABLE.has(grid[z][splitX - 1]) && WALKABLE.has(grid[z][splitX + 1]);
    if (valid) { grid[z][splitX] = '|'; run.push(z); }
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  for (const segment of runs) {
    if (segment.length < 2) { for (const z of segment) grid[z][splitX] = '.'; continue; }
    grid[segment[Math.floor(segment.length / 2)]][splitX] = 'v';
  }
  // Larger plans get a second, horizontal room division in one wing.
  if (width >= 15 && height >= 11) {
    const splitZ = Math.floor(height / 2);
    const cells: number[] = [];
    for (let x = 2; x < splitX - 1; x++) {
      if (grid[splitZ][x] === '.' && WALKABLE.has(grid[splitZ - 1][x]) && WALKABLE.has(grid[splitZ + 1][x])) {
        grid[splitZ][x] = '-'; cells.push(x);
      }
    }
    if (cells.length >= 2) grid[splitZ][cells[Math.floor(cells.length / 2)]] = 'h';
    else for (const x of cells) grid[splitZ][x] = '.';
  }
}

function interiorCells(grid: Grid, predicate: (x: number, z: number) => boolean = () => true): { x: number; z: number }[] {
  const cells: { x: number; z: number }[] = [];
  for (let z = 1; z < grid.length - 1; z++) for (let x = 1; x < grid[0].length - 1; x++) {
    if (grid[z][x] === '.' && predicate(x, z)) cells.push({ x, z });
  }
  return cells;
}

function chooseNearCenter(cells: { x: number; z: number }[], width: number, height: number, exclude?: { x: number; z: number }): { x: number; z: number } {
  const sorted = cells.filter((cell) => !exclude || cell.x !== exclude.x || cell.z !== exclude.z)
    .sort((a, b) => Math.hypot(a.x - width / 2, a.z - height / 2) - Math.hypot(b.x - width / 2, b.z - height / 2));
  if (!sorted[0]) throw new Error('building grammar has no circulation cell');
  return sorted[0];
}

function cloneGrid(grid: Grid): Grid { return grid.map((row) => row.slice()); }
const toRows = (grid: Grid) => grid.map((row) => row.join(''));

export function buildingLayerConnected(rows: string[]): boolean {
  if (!rows.length) return false;
  const width = rows[0].length;
  const open: { x: number; z: number }[] = [];
  for (let z = 0; z < rows.length; z++) for (let x = 0; x < width; x++) if (WALKABLE.has(rows[z][x])) open.push({ x, z });
  if (!open.length) return false;
  const seen = new Set([key(open[0].x, open[0].z)]), queue = [open[0]];
  while (queue.length) {
    const current = queue.shift()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = current.x + dx, z = current.z + dz;
      if (!WALKABLE.has(rows[z]?.[x] ?? ' ') || seen.has(key(x, z))) continue;
      seen.add(key(x, z)); queue.push({ x, z });
    }
  }
  return seen.size === open.length;
}

function pickFootprint(architecture: CityArchitectureProfile, rng: Rng): FootprintFamily {
  const roll = rng.next();
  if (roll < architecture.courtyardWeight * 0.34) return 'courtyard';
  if (roll < 0.38) return 'l-shape';
  if (roll < 0.58) return 'twin-wing';
  if (roll < 0.76) return 'arcade';
  return 'rectangle';
}

function makeSections(layers: string[][], active?: GenerateCityBuildingOptions['missionSection']): BuildingSection[] {
  const width = layers[0][0].length, middle = Math.floor(width / 2);
  const sections: BuildingSection[] = ['west', 'east'].map((id) => ({
    id: id as 'west' | 'east',
    active: !active || active === 'single-choke' || active === id,
    tiles: [],
  }));
  for (let floor = 0; floor < layers.length; floor++) for (let z = 0; z < layers[floor].length; z++) {
    for (let x = 0; x < width; x++) if (WALKABLE.has(layers[floor][z][x])) {
      sections[x < middle ? 0 : 1].tiles.push({ x, z, floor });
    }
  }
  return sections;
}

function sectionFor(x: number, width: number): 'west' | 'east' { return x < Math.floor(width / 2) ? 'west' : 'east'; }

function buildSockets(layers: string[][], exits: { entry: { x: number; z: number }; exit: { x: number; z: number } }, active?: GenerateCityBuildingOptions['missionSection']): BuildingSocket[] {
  const width = layers[0][0].length;
  const requiredSection: 'west' | 'east' = active === 'east' ? 'east' : 'west';
  const choose = (floor: number, section?: 'west' | 'east') => {
    const cells = interiorCells(layers[floor].map((row) => [...row]), (x) => !section || sectionFor(x, width) === section);
    if (!cells.length) throw new Error(`building grammar has no socket floor ${floor} section ${section ?? 'any'}`);
    return cells[cells.length - 1];
  };
  const sockets: BuildingSocket[] = [
    { id: 'entry', kind: 'entry', ...exits.entry, floor: 0, sectionId: sectionFor(exits.entry.x, width), required: false },
    { id: 'exit', kind: 'exit', ...exits.exit, floor: 0, sectionId: sectionFor(exits.exit.x, width), required: false },
  ];
  const objectiveFloor = layers.length - 1;
  const objective = choose(objectiveFloor, requiredSection);
  sockets.push({ id: 'objective-1', kind: 'objective', ...objective, floor: objectiveFloor, sectionId: requiredSection, required: true });
  for (let floor = 0; floor < layers.length; floor++) {
    const guard = choose(floor, active === 'west' || active === 'east' ? active : undefined);
    sockets.push({ id: `guard-${floor + 1}`, kind: 'guard', ...guard, floor, sectionId: sectionFor(guard.x, width), required: false });
  }
  const civilian = choose(0, requiredSection);
  sockets.push({ id: 'civilian-1', kind: 'civilian', ...civilian, floor: 0, sectionId: requiredSection, required: false });
  const dog = choose(0);
  sockets.push({ id: 'dog-handler-1', kind: 'dog-handler', ...dog, floor: 0, sectionId: sectionFor(dog.x, width), required: false });
  const reserve = choose(0);
  sockets.push({ id: 'reinforcement-1', kind: 'reinforcement', ...reserve, floor: 0, sectionId: sectionFor(reserve.x, width), required: false });
  return sockets;
}

function applySectionShutters(layers: string[][], active?: GenerateCityBuildingOptions['missionSection']): string[][] {
  if (!active || active === 'single-choke') return layers;
  const out = layers.map((rows) => rows.map((row) => [...row]));
  const width = out[0][0].length;
  for (const grid of out) for (let z = 1; z < grid.length - 1; z++) for (let x = 1; x < width - 1; x++) {
    if (grid[z][x] !== 'v' && grid[z][x] !== 'h') continue;
    const crossesSection = WALKABLE.has(grid[z][x - 1]) && WALKABLE.has(grid[z][x + 1])
      && sectionFor(x - 1, width) !== sectionFor(x + 1, width);
    if (crossesSection) grid[z][x] = 'X';
  }
  return out.map(toRows);
}

function validArchetype(value: string): value is BuildingArchetype {
  return (BUILDING_ARCHETYPES as readonly string[]).includes(value);
}

function generateAttempt(options: GenerateCityBuildingOptions, validationSeed: number): GeneratedBuilding {
  const spec = ARCHETYPE_SPEC[options.archetype];
  const city = cityProfile(options.cityId);
  const architecture = architectureProfile(options.cityId, validationSeed);
  const rng = new Rng(validationSeed ^ 0xb17d1a6);
  const width = rng.int(spec.width[0], spec.width[1]);
  const height = rng.int(spec.height[0], spec.height[1]);
  const footprint = options.footprint ?? pickFootprint(architecture, rng);
  const mask = makeMask(width, height, footprint);
  const ground = shell(mask, spec.windowEvery);
  const exits = addGroundExits(ground, mask);
  const exitColumns = new Set([exits.entry.x, exits.exit.x]);
  const middle = Math.floor(width / 2);
  const partitionX = [middle, middle - 1, middle + 1, middle - 2, middle + 2]
    .find((x) => x > 2 && x < width - 3 && !exitColumns.has(x)) ?? middle;
  addPartitions(ground, partitionX);
  const grids = Array.from({ length: options.floors }, (_, floor) => floor === 0 ? ground : (() => {
    const upper = shell(mask, spec.windowEvery);
    addPartitions(upper, partitionX);
    return upper;
  })());
  const disconnectedFloor = grids.findIndex((grid) => !buildingLayerConnected(toRows(grid)));
  if (disconnectedFloor >= 0) {
    throw new Error(`disconnected shell on floor ${disconnectedFloor}:\n${toRows(grids[disconnectedFloor]).join('\n')}`);
  }
  const circulation = chooseNearCenter(interiorCells(grids[0]), width, height);
  for (const grid of grids) grid[circulation.z][circulation.x] = 'A';
  if (spec.serviceLadder && options.floors > 1) {
    const ladder = chooseNearCenter(interiorCells(grids[0]), width, height, circulation);
    for (const grid of grids) grid[ladder.z][ladder.x] = 'L';
  }
  const fullLayers = grids.map(toRows);
  if (!fullLayers.every(buildingLayerConnected)) throw new Error('circulation disconnected a floor');
  const layers = applySectionShutters(fullLayers, options.missionSection);
  const kind: BuildingDef['kind'] = spec.use === 'residential' ? 'house'
    : spec.use === 'industrial' ? 'industrial'
      : spec.use === 'military' ? 'military' : 'commercial';
  const def: BuildingDef = {
    id: `city_${options.archetype}`,
    name: `${city.name} ${options.archetype.replaceAll('-', ' ')}`,
    kind,
    floors: options.floors,
    rows: layers[0],
    ...(layers[1] ? { rows2: layers[1] } : {}),
    layers,
  };
  if (!stencilConnected({ ...def, rows: fullLayers[0] })) throw new Error('ground stencil disconnected');
  const sections = makeSections(layers, options.missionSection);
  return {
    archetype: options.archetype,
    use: spec.use,
    cityId: options.cityId,
    cityName: city.name,
    seed: options.seed,
    validationSeed,
    floors: options.floors,
    footprint,
    width,
    height,
    layers,
    def,
    sockets: buildSockets(fullLayers, exits, options.missionSection),
    sections,
    architecture,
    provenance: { cityId: options.cityId, archetype: options.archetype, seed: options.seed, grammarVersion: 1 },
  };
}

/** Deal a complete building first, then optionally shutter an operation wing. */
export function generateCityBuilding(options: GenerateCityBuildingOptions): GeneratedBuilding {
  if (!validArchetype(options.archetype)) throw new Error(`unknown building archetype '${options.archetype}'`);
  if (!Number.isInteger(options.floors) || options.floors < 1 || options.floors > 3) {
    throw new Error(`invalid building floors '${options.floors}'; expected 1–3`);
  }
  if (options.footprint && !(FOOTPRINT_FAMILIES as readonly string[]).includes(options.footprint)) {
    throw new Error(`unknown footprint '${options.footprint}'`);
  }
  let last: Error | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try { return generateAttempt(options, (options.seed + Math.imul(attempt, 0x9e3779b9)) >>> 0); }
    catch (error) { last = error as Error; }
  }
  // A compact known-valid fallback is preferable to losing a mission window.
  try { return generateAttempt({ ...options, footprint: 'rectangle' }, (options.seed ^ 0x5afe71) >>> 0); }
  catch (error) {
    throw new Error(`city building generation failed after fallback: ${(error as Error).message}; first failure: ${last?.message ?? 'unknown'}`);
  }
}
