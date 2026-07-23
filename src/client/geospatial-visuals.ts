import * as THREE from 'three';
import {
  GEO_CLASS_BUILDING,
  GEO_CLASS_GREEN,
  GEO_CLASS_ROAD,
} from '../sim/geospatial/compiler';
import type { GameMap, GeospatialMapMeta } from '../sim/map';
import type { MapGeometry } from '../sim/map-geometry';
import { rasterPolygon } from '../sim/geospatial/geometry';
import type { SemanticBuilding, SemanticFacade, SemanticRoof } from '../sim/geospatial/types';

const MIAMI_WALLS = [0xd8cbb4, 0xb8c8c2, 0xd7b9a3, 0xc8c1ae, 0xaebfba, 0xe0d7c5];
const MANHATTAN_WALLS = [0x8f8170, 0xa69a87, 0x72695f, 0xb0a18c, 0x81776d, 0x9c8d78];
const TARBORO_WALLS = [0xd6c19f, 0xb56f54, 0xd8d0bb, 0x9eaa91, 0xc89b72, 0xe0d4bd];

const wallsFor = (style: GeospatialMapMeta['style']): readonly number[] =>
  style === 'lower-manhattan' ? MANHATTAN_WALLS
    : style === 'tarboro' ? TARBORO_WALLS
      : MIAMI_WALLS;

export function paletteKeyForMap(map: Pick<GameMap, 'theme' | 'geospatial'>): string {
  const style = map.geospatial?.style;
  return style && style !== 'default' ? style : map.theme;
}

/** Ground paint only; classification never changes collision or navigation. */
export function geospatialGroundColor(
  meta: GeospatialMapMeta | undefined,
  index: number,
  noise: number,
): string | undefined {
  if (!meta || meta.style === 'default') return undefined;
  const jitter = Math.round(noise * 10);
  if (meta.classification[index] === GEO_CLASS_ROAD) {
    const base = meta.style === 'tarboro' ? [46, 45, 42] : [31, 34, 35];
    return `rgb(${base[0] + jitter}, ${base[1] + jitter}, ${base[2] + jitter})`;
  }
  if (meta.classification[index] === GEO_CLASS_GREEN) {
    const base = meta.style === 'lower-manhattan' ? [50, 67, 53] : [48, 76, 52];
    return `rgb(${base[0] + jitter}, ${base[1] + jitter}, ${base[2] + jitter})`;
  }
  const base = meta.style === 'lower-manhattan' ? [76, 72, 67]
    : meta.style === 'tarboro' ? [91, 79, 62]
      : [88, 84, 72];
  return `rgb(${base[0] + jitter}, ${base[1] + jitter}, ${base[2] + jitter})`;
}

export function backgroundWallStyle(
  meta: GeospatialMapMeta | undefined,
  index: number,
): { color: number; storeys: number } | undefined {
  if (!meta || meta.classification[index] !== GEO_CLASS_BUILDING) return undefined;
  const sourceStoreys = meta.buildingHeight[index] || 1;
  return {
    color: wallsFor(meta.style)[Math.abs(index - 1) % wallsFor(meta.style).length],
    storeys: Math.max(1, sourceStoreys),
  };
}

export interface SemanticBuildingVisualSpec {
  id: string;
  footprint: SemanticBuilding['footprint'];
  height: number;
  floors: number;
  roof: SemanticRoof;
  facade: SemanticFacade;
  color: number;
  windowModules: number;
  entrance?: SemanticBuilding['entrances'][number];
}

function boundsOf(footprint: readonly { x: number; z: number }[]) {
  return {
    minX: Math.min(...footprint.map((point) => point.x)),
    maxX: Math.max(...footprint.map((point) => point.x)),
    minZ: Math.min(...footprint.map((point) => point.z)),
    maxZ: Math.max(...footprint.map((point) => point.z)),
  };
}

function visualHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function semanticBuildingVisualSpecs(meta: GeospatialMapMeta | undefined): SemanticBuildingVisualSpec[] {
  const district = meta?.district;
  if (!meta || !district) return [];
  const palette = wallsFor(meta.style);
  return district.buildings
    .filter((building) => building.interiorPolicy !== 'embedded' && building.footprint.length >= 3)
    .map((building) => {
      const bounds = boundsOf(building.footprint);
      const perimeter = Math.max(1, (bounds.maxX - bounds.minX + bounds.maxZ - bounds.minZ) * 2);
      const floors = Math.max(1, Math.round(building.floors.value));
      return {
        id: building.id,
        footprint: building.footprint.map((point) => ({ ...point })),
        height: Math.max(3, building.height.value),
        floors,
        roof: building.roof,
        facade: building.facade,
        color: palette[visualHash(building.id) % palette.length],
        windowModules: Math.max(2, Math.floor(perimeter / 3) * Math.min(30, floors)),
        entrance: building.entrances[0],
      };
    });
}

/** Collision remains the tile grid; this set only suppresses duplicate raw cubes. */
export function semanticShellCellSet(
  meta: GeospatialMapMeta | undefined,
  geometry: MapGeometry,
): Set<number> {
  const cells = new Set<number>();
  for (const spec of semanticBuildingVisualSpecs(meta)) {
    for (const cell of rasterPolygon(spec.footprint, geometry)) cells.add(cell);
  }
  return cells;
}

function roofMesh(spec: SemanticBuildingVisualSpec): THREE.Mesh {
  const bounds = boundsOf(spec.footprint);
  const width = Math.max(2, bounds.maxX - bounds.minX);
  const depth = Math.max(2, bounds.maxZ - bounds.minZ);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const material = new THREE.MeshStandardMaterial({
    color: spec.roof === 'flat' ? 0x45484a : spec.roof === 'mansard' ? 0x3c4248 : 0x654638,
    roughness: 0.9,
  });
  let mesh: THREE.Mesh;
  if (spec.roof === 'flat') {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.5, depth + 0.4), material);
    mesh.position.set(centerX, spec.height + 0.25, centerZ);
  } else {
    const roofHeight = Math.max(1.5, Math.min(5, Math.min(width, depth) * 0.28));
    mesh = new THREE.Mesh(new THREE.ConeGeometry(1, roofHeight, 4), material);
    mesh.scale.set(width * 0.72, 1, depth * 0.72);
    mesh.position.set(centerX, spec.height + roofHeight / 2, centerZ);
    mesh.rotation.y = Math.PI / 4;
  }
  mesh.name = `semantic-roof:${spec.id}`;
  return mesh;
}

interface ModuleTransform { x: number; y: number; z: number; yaw: number }

function facadeModules(spec: SemanticBuildingVisualSpec): ModuleTransform[] {
  const bounds = boundsOf(spec.footprint);
  const modules: ModuleTransform[] = [];
  const floors = Math.min(30, spec.floors);
  const floorHeight = spec.height / spec.floors;
  const addEdge = (
    length: number,
    point: (offset: number) => { x: number; z: number },
    yaw: number,
  ) => {
    const count = Math.max(1, Math.floor(length / 3));
    for (let floor = 0; floor < floors; floor++) {
      for (let index = 0; index < count; index++) {
        const p = point((index + 0.5) / count);
        modules.push({ x: p.x, y: Math.min(spec.height - 0.9, (floor + 0.55) * floorHeight), z: p.z, yaw });
      }
    }
  };
  addEdge(bounds.maxX - bounds.minX, (t) => ({ x: bounds.minX + (bounds.maxX - bounds.minX) * t, z: bounds.minZ - 0.07 }), 0);
  addEdge(bounds.maxX - bounds.minX, (t) => ({ x: bounds.minX + (bounds.maxX - bounds.minX) * t, z: bounds.maxZ + 0.07 }), Math.PI);
  addEdge(bounds.maxZ - bounds.minZ, (t) => ({ x: bounds.minX - 0.07, z: bounds.minZ + (bounds.maxZ - bounds.minZ) * t }), Math.PI / 2);
  addEdge(bounds.maxZ - bounds.minZ, (t) => ({ x: bounds.maxX + 0.07, z: bounds.minZ + (bounds.maxZ - bounds.minZ) * t }), -Math.PI / 2);
  return modules;
}

/** Full-footprint low-poly shells plus two instanced facade batches (windows and doors). */
export function buildSemanticDistrictVisuals(meta: GeospatialMapMeta | undefined): THREE.Group | undefined {
  const specs = semanticBuildingVisualSpecs(meta);
  if (!meta?.district || !specs.length) return undefined;
  const group = new THREE.Group();
  group.name = `semantic-district:${meta.sourceId}`;
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const windows: ModuleTransform[] = [];
  const doors: ModuleTransform[] = [];
  for (const spec of specs) {
    const shape = new THREE.Shape();
    spec.footprint.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, -point.z);
      else shape.lineTo(point.x, -point.z);
    });
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: spec.height,
      steps: 1,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const material = materials.get(spec.color) ?? new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.facade === 'podium-tower' ? 0.72 : 0.9,
      metalness: spec.facade === 'podium-tower' ? 0.08 : 0,
    });
    materials.set(spec.color, material);
    const shell = new THREE.Mesh(geometry, material);
    shell.name = `semantic-shell:${spec.id}`;
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell, roofMesh(spec));
    windows.push(...facadeModules(spec));
    if (spec.entrance) {
      doors.push({
        x: spec.entrance.position.x,
        y: 1.35,
        z: spec.entrance.position.z,
        yaw: spec.entrance.facing,
      });
    }
  }
  const dummy = new THREE.Object3D();
  if (windows.length) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.25, 1.35, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x82a6ad, roughness: 0.28, metalness: 0.12 }),
      windows.length,
    );
    mesh.name = 'semantic-windows';
    windows.forEach((module, index) => {
      dummy.position.set(module.x, module.y, module.z);
      dummy.rotation.set(0, module.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  if (doors.length) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.6, 2.7, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x382b24, roughness: 0.82 }),
      doors.length,
    );
    mesh.name = 'semantic-doors';
    doors.forEach((module, index) => {
      dummy.position.set(module.x, module.y, module.z);
      dummy.rotation.set(0, module.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }
  group.userData.semanticBuildingCount = specs.length;
  group.userData.windowModuleCount = windows.length;
  group.userData.facadeBatchCount = Number(windows.length > 0) + Number(doors.length > 0);
  shadow(group);
  return group;
}

function shadow(group: THREE.Object3D): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
}

function palm(scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.38, 7.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x6d5137, roughness: 0.94 }),
  );
  trunk.position.y = 3.6;
  trunk.rotation.z = 0.035;
  group.add(trunk);

  const frondMaterial = new THREE.MeshStandardMaterial({ color: 0x315f46, roughness: 0.9, side: THREE.DoubleSide });
  for (let index = 0; index < 6; index++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.5, 3), frondMaterial);
    const angle = index / 6 * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.45, 7.25, Math.sin(angle) * 1.45);
    frond.rotation.order = 'YXZ';
    frond.rotation.y = -angle;
    frond.rotation.z = Math.PI / 2.35;
    group.add(frond);
  }
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), frondMaterial);
  crown.position.y = 7.25;
  group.add(crown);
  group.scale.setScalar(scale);
  shadow(group);
  return group;
}

function streetlight(scale: number): THREE.Group {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x303b3d, metalness: 0.58, roughness: 0.44 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xff9f45, emissiveIntensity: 0.48, roughness: 0.3 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 6.2, 6), metal);
  pole.position.y = 3.1;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), metal);
  arm.position.set(0.78, 6.15, 0);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.34), lampMaterial);
  lamp.position.set(1.55, 6.03, 0);
  group.add(pole, arm, lamp);
  group.scale.setScalar(scale);
  shadow(group);
  return group;
}

function barrier(scale: number): THREE.Group {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xbcb7a8, roughness: 0.98 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xd98a27, roughness: 0.72 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x32a9c2, roughness: 0.65 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.05, 0.8), concrete);
  body.position.y = 0.52;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.82, 0.86), amber);
  left.position.set(-1.68, 0.62, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.82, 0.86), cyan);
  right.position.set(1.68, 0.62, 0);
  group.add(body, left, right);
  group.scale.setScalar(scale);
  shadow(group);
  return group;
}

/** Build visual landmarks only. These meshes deliberately have no sim claims. */
export function buildGeospatialDecor(meta: GeospatialMapMeta | undefined): THREE.Group | undefined {
  if (!meta?.decor.length) return undefined;
  const group = new THREE.Group();
  group.name = `geospatial-decor:${meta.sourceId}`;
  for (const spec of meta.decor) {
    const object = spec.kind === 'palm' ? palm(spec.scale)
      : spec.kind === 'streetlight' ? streetlight(spec.scale)
        : barrier(spec.scale);
    object.position.set(spec.pos.x, spec.pos.y, spec.pos.z);
    object.rotation.y = spec.rot;
    group.add(object);
  }
  return group;
}
