import * as THREE from 'three';
import { GEO_CLASS_BUILDING } from '../sim/geospatial/compiler';
import type { GameMap, GeospatialMapMeta } from '../sim/map';

const MIAMI_WALLS = [0xd8cbb4, 0xb8c8c2, 0xd7b9a3, 0xc8c1ae, 0xaebfba, 0xe0d7c5];

export function paletteKeyForMap(map: Pick<GameMap, 'theme' | 'geospatial'>): string {
  return map.geospatial?.style === 'miami-gardens' ? 'miami-gardens' : map.theme;
}

export function backgroundWallStyle(
  meta: GeospatialMapMeta | undefined,
  index: number,
): { color: number; storeys: number } | undefined {
  if (!meta || meta.classification[index] !== GEO_CLASS_BUILDING) return undefined;
  const sourceStoreys = meta.buildingHeight[index] || 1;
  return {
    color: MIAMI_WALLS[Math.abs(index - 1) % MIAMI_WALLS.length],
    storeys: Math.max(1, Math.min(2, sourceStoreys)),
  };
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
