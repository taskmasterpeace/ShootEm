import { VEHICLES } from './data';
import { T_DEEP, T_WATER, tileAt } from './map';
import { asElevationLevel, type ElevationLevel } from './elevation';
import type { Team, VehicleKind } from './types';
import type { World } from './world';

export const VEHICLE_SAMPLE_EVERY = 2;
export const VEHICLE_SAMPLE_LIMIT = 600;
export const VEHICLE_INCIDENT_LIMIT = 80;

export type VehicleIncidentKind =
  | 'stuck' | 'wrong_surface' | 'non_finite' | 'crash' | 'bailout'
  | 'abandon' | 'boundary_wrap' | 'route_complete' | 'landing';

export interface VehicleSampleEntry {
  id: number;
  kind: VehicleKind;
  team: Team;
  alive: boolean;
  crewed: boolean;
  moving: boolean;
  engaged: boolean;
  elevation: ElevationLevel;
  distance: number;
  routeProgress?: number;
}

export interface VehicleSample { t: number; vehicles: VehicleSampleEntry[] }

export interface VehicleIncident {
  t: number;
  kind: VehicleIncidentKind;
  vehicleId: number;
  vehicleKind: VehicleKind;
  theaterId: string;
  seed: number;
  x: number;
  z: number;
  detail?: string;
}

export interface VehicleAggregate {
  distanceByKind: Partial<Record<VehicleKind, number>>;
  lossesByKind: Partial<Record<VehicleKind, number>>;
  shotsByKind: Partial<Record<VehicleKind, number>>;
  hitsByKind: Partial<Record<VehicleKind, number>>;
  elevationSeconds: Record<ElevationLevel, number>;
  routeCompletions: number;
  objectiveProgress: number;
  firstContact?: number;
}

export interface VehicleTelemetry {
  nextAt: number;
  samples: VehicleSample[];
  incidents: VehicleIncident[];
  summary: VehicleAggregate;
  prev: Map<number, { x: number; z: number }>;
  stuckRuns: Map<number, number>;
  incidentKeys: Set<string>;
}

export interface VehicleTelemetrySnapshot {
  samples: VehicleSample[];
  incidents: VehicleIncident[];
  summary: VehicleAggregate;
}

export type VehicleTelemetryEvent = {
  kind: 'shot' | 'hit' | 'loss' | 'objective' | 'landing' | VehicleIncidentKind;
  t: number;
  vehicleId: number;
  vehicleKind: VehicleKind;
  theaterId: string;
  seed: number;
  x: number;
  z: number;
  detail?: string;
};

const emptyAggregate = (): VehicleAggregate => ({
  distanceByKind: {}, lossesByKind: {}, shotsByKind: {}, hitsByKind: {},
  elevationSeconds: { 0: 0, 1: 0, 2: 0, 3: 0 },
  routeCompletions: 0, objectiveProgress: 0,
});

export function createVehicleTelemetry(): VehicleTelemetry {
  return {
    nextAt: VEHICLE_SAMPLE_EVERY,
    samples: [], incidents: [], summary: emptyAggregate(),
    prev: new Map(), stuckRuns: new Map(), incidentKeys: new Set(),
  };
}

const increment = (record: Partial<Record<VehicleKind, number>>, kind: VehicleKind, amount = 1) => {
  record[kind] = (record[kind] ?? 0) + amount;
};

function fileIncident(telemetry: VehicleTelemetry, event: VehicleTelemetryEvent, dedupe = false): void {
  const key = `${event.kind}:${event.vehicleId}:${event.detail ?? ''}`;
  if (dedupe && telemetry.incidentKeys.has(key)) return;
  if (dedupe) telemetry.incidentKeys.add(key);
  telemetry.incidents.push({
    t: +event.t.toFixed(1), kind: event.kind as VehicleIncidentKind,
    vehicleId: event.vehicleId, vehicleKind: event.vehicleKind,
    theaterId: event.theaterId, seed: event.seed,
    x: +event.x.toFixed(1), z: +event.z.toFixed(1),
    ...(event.detail ? { detail: event.detail } : {}),
  });
  if (telemetry.incidents.length > VEHICLE_INCIDENT_LIMIT) telemetry.incidents.shift();
}

export function recordVehicleEvent(telemetry: VehicleTelemetry, event: VehicleTelemetryEvent): void {
  if ((event.kind === 'shot' || event.kind === 'hit') && telemetry.summary.firstContact === undefined) {
    telemetry.summary.firstContact = +event.t.toFixed(1);
  }
  if (event.kind === 'shot') increment(telemetry.summary.shotsByKind, event.vehicleKind);
  else if (event.kind === 'hit') increment(telemetry.summary.hitsByKind, event.vehicleKind);
  else if (event.kind === 'loss') increment(telemetry.summary.lossesByKind, event.vehicleKind);
  else if (event.kind === 'objective') telemetry.summary.objectiveProgress++;
  else if (event.kind === 'route_complete') {
    telemetry.summary.routeCompletions++;
    fileIncident(telemetry, event, true);
  } else if (event.kind === 'landing') {
    telemetry.summary.objectiveProgress++;
    fileIncident(telemetry, event, true);
  } else {
    fileIncident(telemetry, event);
  }
}

const eventFor = (w: World, vehicleId: number, vehicleKind: VehicleKind, kind: VehicleIncidentKind, x: number, z: number, detail?: string): VehicleTelemetryEvent => ({
  kind, t: w.time, vehicleId, vehicleKind,
  theaterId: w.map.theater?.id ?? 'classic', seed: w.map.seed, x, z, ...(detail ? { detail } : {}),
});

export function stepVehicleTelemetry(w: World): void {
  const telemetry = w.vehicleTelemetry;
  // Fixed-step accumulation can land infinitesimally below an exact sample
  // boundary (7.999999999 instead of 8). Treat that as the boundary so a
  // six-second persistence window is frame-rate stable.
  if (w.time + 1e-9 < telemetry.nextAt) return;
  telemetry.nextAt += VEHICLE_SAMPLE_EVERY;
  const entries: VehicleSampleEntry[] = [];
  const nextPrev = new Map<number, { x: number; z: number }>();
  const vehicles = [...w.vehicles.values()].sort((a, b) => a.id - b.id);
  for (const vehicle of vehicles) {
    const previous = telemetry.prev.get(vehicle.id);
    const distance = previous ? Math.hypot(vehicle.pos.x - previous.x, vehicle.pos.z - previous.z) : 0;
    nextPrev.set(vehicle.id, { x: vehicle.pos.x, z: vehicle.pos.z });
    increment(telemetry.summary.distanceByKind, vehicle.kind, distance);
    const elevation = asElevationLevel(vehicle.band);
    if (vehicle.alive) telemetry.summary.elevationSeconds[elevation] += VEHICLE_SAMPLE_EVERY;
    const routeDriver = w.soldiers.get(vehicle.seats[0]);
    const route = routeDriver?.botVehicleRouteId
      ? w.map.theater?.routes.find((candidate) => candidate.id === routeDriver.botVehicleRouteId)
      : undefined;
    const routeProgress = route && routeDriver?.botVehicleRouteIndex !== undefined
      ? routeDriver.botVehicleRouteIndex / Math.max(1, route.points.length - 1)
      : undefined;
    entries.push({
      id: vehicle.id, kind: vehicle.kind, team: vehicle.team, alive: vehicle.alive,
      crewed: vehicle.seats.some((id) => id >= 0), moving: distance >= 0.5,
      engaged: vehicle.nextFireAt > w.time - VEHICLE_SAMPLE_EVERY,
      elevation, distance: +distance.toFixed(3), ...(routeProgress === undefined ? {} : { routeProgress: +routeProgress.toFixed(3) }),
    });

    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.y, vehicle.vel.z].every(Number.isFinite)) {
      fileIncident(telemetry, eventFor(w, vehicle.id, vehicle.kind, 'non_finite', vehicle.pos.x, vehicle.pos.z), true);
    }
    const terrain = tileAt(w.map.grid, vehicle.pos.x, vehicle.pos.z, w.map.geometry);
    const def = VEHICLES[vehicle.kind];
    const wrongSurface = def.boat ? terrain !== T_WATER && terrain !== T_DEEP : false;
    if (wrongSurface) fileIncident(telemetry, eventFor(w, vehicle.id, vehicle.kind, 'wrong_surface', vehicle.pos.x, vehicle.pos.z, `tile ${terrain}`), true);

    const commanded = w.vehicleCommandedSpeed.get(vehicle.id) ?? 0;
    const stuck = vehicle.alive && vehicle.seats[0] >= 0 && commanded > 3 && previous !== undefined && distance < 1.2;
    const run = stuck ? (telemetry.stuckRuns.get(vehicle.id) ?? 0) + 1 : 0;
    telemetry.stuckRuns.set(vehicle.id, run);
    if (run === 3) fileIncident(telemetry, eventFor(w, vehicle.id, vehicle.kind, 'stuck', vehicle.pos.x, vehicle.pos.z, `commanded ${commanded.toFixed(1)}u/s`), true);
  }
  telemetry.prev = nextPrev;
  telemetry.samples.push({ t: +w.time.toFixed(1), vehicles: entries });
  if (telemetry.samples.length > VEHICLE_SAMPLE_LIMIT) telemetry.samples.shift();
}

function roundedRecord(record: Partial<Record<VehicleKind, number>>): Partial<Record<VehicleKind, number>> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, +(value ?? 0).toFixed(3)]));
}

export function vehicleTelemetrySnapshot(telemetry: VehicleTelemetry): VehicleTelemetrySnapshot {
  return {
    samples: structuredClone(telemetry.samples),
    incidents: structuredClone(telemetry.incidents),
    summary: {
      distanceByKind: roundedRecord(telemetry.summary.distanceByKind),
      lossesByKind: roundedRecord(telemetry.summary.lossesByKind),
      shotsByKind: roundedRecord(telemetry.summary.shotsByKind),
      hitsByKind: roundedRecord(telemetry.summary.hitsByKind),
      elevationSeconds: { ...telemetry.summary.elevationSeconds },
      routeCompletions: telemetry.summary.routeCompletions,
      objectiveProgress: telemetry.summary.objectiveProgress,
      ...(telemetry.summary.firstContact === undefined ? {} : { firstContact: telemetry.summary.firstContact }),
    },
  };
}

export function vehicleTelemetryReport(telemetry: VehicleTelemetry | VehicleTelemetrySnapshot): string {
  const summary = telemetry.summary;
  const losses = Object.entries(summary.lossesByKind).map(([kind, count]) => `${kind} ${count} loss`).join(' · ') || 'no hull losses';
  return [
    `VEHICLES — samples ${telemetry.samples.length} · incidents ${telemetry.incidents.length} · first contact ${summary.firstContact ?? 'none'}s`,
    `  ${losses} · routes ${summary.routeCompletions} · elevation ${Object.entries(summary.elevationSeconds).map(([level, seconds]) => `${level}:${seconds}s`).join(' ')}`,
  ].join('\n');
}
