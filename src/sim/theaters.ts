import { addLandingZone, carveRoute, createTheaterBase, finalizeTheater, routePoints } from './theater-builder';
import type { GameMap } from './map';
import type { TheaterDef, TheaterId } from './theater-types';
import { generateCityTheater, generateCountrysideTheater, generateDesertTheater } from './theaters/land';

export const THEATER_DEFS: Record<TheaterId, TheaterDef> = {
  city: { id: 'city', name: 'Iron Meridian', geometry: { cols: 200, rows: 200, tile: 3 }, theme: 'starship', domains: ['foot', 'ground', 'air'], freeDogfight: false, defaultPads: ['tank', 'apc', 'flyer'] },
  desert: { id: 'desert', name: 'Sirocco Reach', geometry: { cols: 300, rows: 300, tile: 3 }, theme: 'hardpan', domains: ['foot', 'ground', 'air'], freeDogfight: true, defaultPads: ['tank', 'buggy', 'strikejet'] },
  countryside: { id: 'countryside', name: 'Green March', geometry: { cols: 300, rows: 300, tile: 3 }, theme: 'savanna', domains: ['foot', 'ground', 'air'], freeDogfight: true, defaultPads: ['tank', 'apc', 'transport'] },
  mountain: { id: 'mountain', name: 'Crown Divide', geometry: { cols: 200, rows: 300, tile: 3 }, theme: 'europa', domains: ['foot', 'ground', 'air'], freeDogfight: false, defaultPads: ['buggy', 'flyer', 'transport'] },
  coastal: { id: 'coastal', name: 'Breaker Coast', geometry: { cols: 300, rows: 200, tile: 3 }, theme: 'triton', domains: ['foot', 'ground', 'air', 'surface', 'deep'], freeDogfight: true, defaultPads: ['tank', 'boat', 'strikejet'] },
  ocean: { id: 'ocean', name: 'Pelagic Expanse', geometry: { cols: 300, rows: 300, tile: 3 }, theme: 'triton', domains: ['air', 'surface', 'deep'], freeDogfight: true, defaultPads: ['boat', 'strikejet', 'interceptor'] },
};

function generateCatalogBase(id: TheaterId, seed: number): GameMap {
  const map = createTheaterBase(THEATER_DEFS[id], seed);
  carveRoute(map, {
    id: 'primary-ground', domain: id === 'ocean' ? 'surface' : 'ground', width: id === 'city' ? 18 : 30,
    points: routePoints(map, [[0.04, 0.5], [0.33, 0.48], [0.67, 0.52], [0.96, 0.5]]),
  });
  carveRoute(map, {
    id: 'air-corridor-alpha', domain: 'air', width: 90,
    points: routePoints(map, [[0.03, 0.2], [0.32, 0.35], [0.68, 0.65], [0.97, 0.8]]),
  });
  addLandingZone(map, { id: 'west-lz', pos: routePoints(map, [[0.2, 0.3]])[0], radius: 18, slope: 0, side: 0 });
  addLandingZone(map, { id: 'east-lz', pos: routePoints(map, [[0.8, 0.7]])[0], radius: 18, slope: 0, side: 1 });
  return finalizeTheater(map);
}

export function generateTheater(id: TheaterId, seed: number): GameMap {
  if (id === 'city') return generateCityTheater(THEATER_DEFS.city, seed);
  if (id === 'desert') return generateDesertTheater(THEATER_DEFS.desert, seed);
  if (id === 'countryside') return generateCountrysideTheater(THEATER_DEFS.countryside, seed);
  return generateCatalogBase(id, seed);
}

export type { LandingZone, TheaterDef, TheaterDomain, TheaterId, TheaterMetadata, TheaterRoute } from './theater-types';
