// ---------------------------------------------------------------------------
// THE ARMORY, VISIBLE — a real silhouette for every weapon family, with brand
// and mark variations (Robert: "we need the weapons created so we can have a
// visual representation… go by family and then make variations of that").
//
// One builder per family. Variation is DERIVED, never bespoke: the weapon id
// (`rifle_kuchler_2`) picks a FamilyBuilder, a BrandStyle (proportions +
// palette + one physical tell per manufacturer) and a mark dress (amber
// barrel bands — Mk II wears one, Mk III two and a brighter muzzle). The same
// id always builds the same gun on every client.
//
// Conventions (models law): muzzle points +X. The pistol grip sits near
// (-0.15, -0.11) and the support hand's handguard near (+0.30, -0.06) —
// grip.ts closes real hands on those anchors, and a builder that moves them
// declares its own in userData.anchors (handguard: null = one-handed).
// Budget: every weapon ≤ 500 tris (gadget class), most well under 300.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import type { WeaponDef } from '../../sim/types';
import { WEAPONS } from '../../sim/data';
import { mat, box, cyl } from './shared';

/** Manufacturer visual identity: scale flavor + palette + a physical tell. */
interface BrandStyle {
  key: string;
  /** girth multiplies part heights/depths; length multiplies X spans */
  girth: number; length: number;
  metal: number; furniture: number;
  /** the one thing you notice: vents, slabs, optics, drums, coils */
  tell: 'none' | 'vents' | 'slab' | 'optic' | 'drum' | 'coil';
}

const BRAND_STYLES: Record<string, BrandStyle> = {
  maklov:  { key: 'maklov',  girth: 1.0,  length: 1.0,  metal: 0x23231f, furniture: 0x3a352b, tell: 'none' },
  kuchler: { key: 'kuchler', girth: 0.85, length: 0.94, metal: 0x4a4e55, furniture: 0x39404a, tell: 'vents' },
  titan:   { key: 'titan',   girth: 1.2,  length: 1.02, metal: 0x1c1c1a, furniture: 0x2b2620, tell: 'slab' },
  harkov:  { key: 'harkov',  girth: 0.95, length: 1.18, metal: 0x262b24, furniture: 0x2e3428, tell: 'optic' },
  ceres:   { key: 'ceres',   girth: 1.08, length: 0.97, metal: 0x2d2a24, furniture: 0x4a3d28, tell: 'drum' },
  kamenel: { key: 'kamenel', girth: 1.0,  length: 1.0,  metal: 0x2a2320, furniture: 0x33291f, tell: 'coil' },
};

const ACCENT = 0xe8a33d; // mark bands + brand glows: house amber, never purple

/** Everything a family builder needs, precomputed once per weapon. */
interface Kit {
  st: BrandStyle;
  mk: number;
  metal: THREE.Material;
  dark: THREE.Material;      // furniture / polymer
  wood: THREE.Material;      // warm furniture for the shotgun line
  glow: THREE.Material;      // emissive amber accent
  hot: THREE.Material;       // emissive muzzle/energy tip
}

function kit(st: BrandStyle, mk: number): Kit {
  return {
    st, mk,
    metal: mat(st.metal, { metal: 0.55, rough: mk === 3 ? 0.28 : 0.38 }),
    dark: mat(st.furniture, { rough: 0.72 }),
    wood: mat(0x4a3320, { rough: 0.8 }),
    glow: mat(ACCENT, { emissive: ACCENT, metal: 0.2, rough: 0.4 }),
    hot: mat(0xff8a2a, { emissive: 0xff7a1a, rough: 0.4 }),
  };
}

/** Mark dress: Mk II one amber band, Mk III two — read the tier off the barrel
 *  the way you read rank off a shoulder. `x` is the band's center. */
function markBands(g: THREE.Group, k: Kit, x: number, r: number) {
  for (let i = 0; i < k.mk - 1; i++) {
    const band = cyl(r + 0.012, r + 0.012, 0.025, k.glow, 8);
    band.rotation.z = Math.PI / 2;
    band.position.set(x - i * 0.09, 0, 0);
    g.add(band);
  }
}

/** Brand tells that fit any receiver: vents (kuchler), slab (titan),
 *  optic (harkov), coil (kamenel). Drum is handled where mags live. */
function brandTell(g: THREE.Group, k: Kit, recLen: number, recH: number, muzzleX: number) {
  const t = k.st.tell;
  if (t === 'vents') {
    for (let i = 0; i < 3; i++) {
      const v = box(0.05, 0.012, 0.1, k.dark);
      v.position.set(-0.1 + i * 0.11, recH / 2 + 0.008, 0);
      g.add(v);
    }
  } else if (t === 'slab') {
    const s = box(recLen * 0.62, 0.035, 0.11, k.metal);
    s.position.set(0.02, recH / 2 + 0.02, 0);
    g.add(s);
  } else if (t === 'optic') {
    const tube = cyl(0.028, 0.028, 0.14, k.metal, 6);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0.02, recH / 2 + 0.05, 0);
    g.add(tube);
    const lens = cyl(0.024, 0.024, 0.012, mat(0x66ccff, { emissive: 0x3388cc }), 6);
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.095, recH / 2 + 0.05, 0);
    g.add(lens);
  } else if (t === 'coil') {
    const c = cyl(0.05, 0.05, 0.04, k.hot, 8);
    c.rotation.z = Math.PI / 2;
    c.position.set(muzzleX - 0.14, 0, 0);
    g.add(c);
  }
}

/** Shared skeleton: receiver + barrel + stock + mag + grip — the rifle-shaped
 *  families are all dialects of this. Returns key geometry for the caller. */
function frame(g: THREE.Group, k: Kit, o: {
  recLen: number; recH: number; recD?: number;
  barrelLen: number; barrelR?: number;
  stock?: 'full' | 'wire' | 'pad' | 'none';
  magLen?: number; magDrum?: number; // drum radius wins over box mag
}) {
  const recD = o.recD ?? 0.09;
  const recLen = o.recLen * k.st.length;
  const recH = o.recH * k.st.girth;
  const receiver = box(recLen, recH, recD * k.st.girth, k.metal);
  g.add(receiver);

  const bl = o.barrelLen * k.st.length;
  const br = (o.barrelR ?? 0.028) * k.st.girth;
  const barrel = cyl(br, br, bl, k.metal, 6);
  barrel.rotation.z = Math.PI / 2;
  const muzzleX = recLen / 2 + bl / 2 - 0.02;
  barrel.position.set(muzzleX, 0.01, 0);
  g.add(barrel);

  const stock = o.stock ?? 'full';
  if (stock === 'full') {
    const s = box(0.2, 0.13 * k.st.girth, 0.06, k.dark);
    s.position.set(-recLen / 2 - 0.08, -0.03, 0);
    g.add(s);
  } else if (stock === 'wire') {
    const top = box(0.2, 0.02, 0.02, k.metal);
    top.position.set(-recLen / 2 - 0.09, 0.02, 0);
    g.add(top);
    const heel = box(0.02, 0.1, 0.05, k.metal);
    heel.position.set(-recLen / 2 - 0.18, -0.03, 0);
    g.add(heel);
  } else if (stock === 'pad') {
    const p = box(0.06, 0.14 * k.st.girth, 0.08, k.dark);
    p.position.set(-recLen / 2 - 0.02, -0.01, 0);
    g.add(p);
  }

  if (o.magDrum) {
    const drumR = o.magDrum * (k.st.tell === 'drum' ? 1.3 : 1);
    const drum = cyl(drumR, drumR, 0.09, k.dark, 10);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0.08, -recH / 2 - drumR * 0.7, 0);
    g.add(drum);
  } else if (o.magLen) {
    const ml = o.magLen * (k.st.tell === 'drum' ? 1.35 : 1);
    const magH = ml * k.st.girth;
    const mg = box(0.08, magH, 0.05, k.dark);
    mg.position.set(0.05, -recH / 2 - magH / 2 + 0.02, 0);
    mg.rotation.z = 0.22;
    g.add(mg);
  }

  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -recH / 2 - 0.05, 0);
  g.add(grip);

  brandTell(g, k, recLen, recH, muzzleX);
  markBands(g, k, muzzleX + bl * 0.28, br);
  return { recLen, recH, muzzleX, barrelEnd: muzzleX + bl / 2 };
}

// --------------------------------------------------------------------------
// family builders — each returns a Group in gun-local space (muzzle +X)
// --------------------------------------------------------------------------
type FamilyBuilder = (k: Kit, def: WeaponDef) => THREE.Group;

const buildPistol: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const slideLen = 0.3 * k.st.length;
  const slide = box(slideLen, 0.07 * k.st.girth, 0.055, k.metal);
  slide.position.set(0.06, 0, 0);
  g.add(slide);
  const muzzle = cyl(0.02, 0.02, 0.07, k.metal, 6);
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.set(0.06 + slideLen / 2 + 0.03, 0.005, 0);
  g.add(muzzle);
  const gripP = box(0.07, 0.14, 0.05, k.dark);
  gripP.position.set(-0.04, -0.1, 0);
  gripP.rotation.z = 0.28;
  g.add(gripP);
  const guard = box(0.08, 0.015, 0.04, k.metal);
  guard.position.set(0.03, -0.055, 0);
  g.add(guard);
  const sight = box(0.02, 0.02, 0.02, k.dark);
  sight.position.set(0.16, 0.045, 0);
  g.add(sight);
  brandTell(g, k, slideLen, 0.07, 0.24);
  markBands(g, k, 0.2, 0.024);
  // one hand on the grip; the off hand stays free (Infantry pistol carry)
  g.userData.anchors = { grip: new THREE.Vector3(-0.04, -0.1, 0), handguard: null };
  return g;
};

const buildRifleFam: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const f = frame(g, k, { recLen: 0.66, recH: 0.11, barrelLen: 0.34, magLen: 0.18 });
  // handguard rail slats — the support hand has something to hold
  for (let i = 0; i < 2; i++) {
    const slat = box(0.16, 0.02, 0.1, k.dark);
    slat.position.set(0.26, -0.035 - i * 0.028, 0);
    g.add(slat);
  }
  const post = box(0.015, 0.05, 0.015, k.metal);
  post.position.set(f.muzzleX + 0.06, 0.05, 0);
  g.add(post);
  return g;
};

const buildCarbine: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  frame(g, k, { recLen: 0.5, recH: 0.1, barrelLen: 0.2, stock: 'wire', magLen: 0.17 });
  const foregrip = box(0.05, 0.1, 0.05, k.dark);
  foregrip.position.set(0.28, -0.1, 0);
  g.add(foregrip);
  return g;
};

const buildSmg: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const f = frame(g, k, { recLen: 0.42, recH: 0.1, barrelLen: 0.12, barrelR: 0.038, stock: 'wire', magLen: 0.26 });
  const shroud = cyl(0.045 * k.st.girth, 0.045 * k.st.girth, 0.14, k.dark, 6);
  shroud.rotation.z = Math.PI / 2;
  shroud.position.set(f.recLen / 2 + 0.05, 0.01, 0);
  g.add(shroud);
  return g;
};

const buildShotgun: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const recLen = 0.6 * k.st.length;
  const recH = 0.1 * k.st.girth;
  const receiver = box(recLen, recH, 0.08, k.metal);
  g.add(receiver);
  const barrel = cyl(0.035, 0.035, 0.4 * k.st.length, k.metal, 6);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(recLen / 2 + 0.18, 0.035, 0);
  g.add(barrel);
  const tube = cyl(0.028, 0.028, 0.34 * k.st.length, k.metal, 6);
  tube.rotation.z = Math.PI / 2;
  tube.position.set(recLen / 2 + 0.15, -0.02, 0);
  g.add(tube);
  const pump = box(0.14, 0.06, 0.07, k.wood);
  pump.position.set(0.3, -0.02, 0);
  g.add(pump);
  const stock = box(0.22, 0.12, 0.06, k.wood);
  stock.position.set(-recLen / 2 - 0.09, -0.04, 0);
  stock.rotation.z = -0.12;
  g.add(stock);
  // shell loop: brass on the receiver flank
  for (let i = 0; i < 3; i++) {
    const shell = cyl(0.016, 0.016, 0.05, mat(0x9a6f2f, { metal: 0.6, rough: 0.4 }), 6);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(-0.12 + i * 0.07, 0.02, 0.055);
    g.add(shell);
  }
  brandTell(g, k, recLen, recH, recLen / 2 + 0.3);
  markBands(g, k, recLen / 2 + 0.3, 0.038);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.09, 0), handguard: new THREE.Vector3(0.3, -0.04, 0) };
  return g;
};

const buildSlugger: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const breech = box(0.34 * k.st.length, 0.14 * k.st.girth, 0.1, k.metal);
  breech.position.set(-0.08, 0, 0);
  g.add(breech);
  const barrel = cyl(0.05 * k.st.girth, 0.056 * k.st.girth, 0.62 * k.st.length, k.metal, 8);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.36, 0.01, 0);
  g.add(barrel);
  const lever = box(0.12, 0.02, 0.03, k.metal);
  lever.position.set(-0.1, -0.1, 0);
  g.add(lever);
  const stock = box(0.2, 0.13, 0.06, k.wood);
  stock.position.set(-0.32, -0.03, 0);
  g.add(stock);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.12, 0);
  g.add(grip);
  brandTell(g, k, 0.34, 0.14, 0.6);
  markBands(g, k, 0.5, 0.06);
  return g;
};

const buildLaser: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const bodyLen = 0.7 * k.st.length;
  const body = box(bodyLen, 0.1 * k.st.girth, 0.09, k.metal);
  g.add(body);
  // the energy core-line: an amber seam down the flank you can read at range
  const seam = box(bodyLen * 0.8, 0.02, 0.005, k.glow);
  seam.position.set(0, 0.01, 0.048);
  g.add(seam);
  // focusing rings ahead of the body, then the emitter crystal
  for (let i = 0; i < 2 + (k.mk - 1); i++) {
    const ring = cyl(0.045, 0.045, 0.02, k.metal, 8);
    ring.rotation.z = Math.PI / 2;
    ring.position.set(bodyLen / 2 + 0.05 + i * 0.07, 0.01, 0);
    g.add(ring);
  }
  const emitter = box(0.06, 0.04, 0.04, k.hot);
  emitter.position.set(bodyLen / 2 + 0.1 + (1 + k.mk) * 0.055, 0.01, 0);
  g.add(emitter);
  const cell = box(0.1, 0.14, 0.06, k.dark);
  cell.position.set(0.02, -0.1, 0);
  g.add(cell);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.1, 0);
  g.add(grip);
  const pad = box(0.05, 0.12, 0.07, k.dark);
  pad.position.set(-bodyLen / 2 - 0.02, -0.01, 0);
  g.add(pad);
  brandTell(g, k, bodyLen, 0.1, bodyLen / 2 + 0.1);
  return g;
};

const buildLmg: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const f = frame(g, k, { recLen: 0.72, recH: 0.13, barrelLen: 0.36, barrelR: 0.032, magDrum: 0.07 });
  // heat-shield slats over the barrel
  for (let i = 0; i < 3; i++) {
    const s = box(0.09, 0.015, 0.075, k.metal);
    s.position.set(f.recLen / 2 + 0.08 + i * 0.11, 0.045, 0);
    g.add(s);
  }
  // folded bipod legs under the muzzle
  for (const side of [1, -1]) {
    const leg = box(0.22, 0.015, 0.015, k.metal);
    leg.position.set(f.muzzleX - 0.12, -0.05, side * 0.03);
    leg.rotation.z = -0.25;
    g.add(leg);
  }
  return g;
};

const buildHmg: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const recLen = 0.8 * k.st.length;
  const recH = 0.17 * k.st.girth;
  const receiver = box(recLen, recH, 0.13, k.metal);
  g.add(receiver);
  const barrel = cyl(0.04, 0.04, 0.5 * k.st.length, k.metal, 8);
  barrel.rotation.z = Math.PI / 2;
  const muzzleX = recLen / 2 + 0.23;
  barrel.position.set(muzzleX, 0.02, 0);
  g.add(barrel);
  const brake = box(0.1, 0.09, 0.09, k.metal);
  brake.position.set(muzzleX + 0.26, 0.02, 0);
  g.add(brake);
  // top belt drum, lying flat — the ammunition IS the silhouette
  const drum = cyl(0.09 * (k.st.tell === 'drum' ? 1.25 : 1), 0.09 * (k.st.tell === 'drum' ? 1.25 : 1), 0.1, k.dark, 10);
  drum.rotation.x = Math.PI / 2;
  drum.position.set(-0.05, recH / 2 + 0.08, 0.02);
  g.add(drum);
  const handle = box(0.18, 0.02, 0.03, k.metal);
  handle.position.set(0.1, recH / 2 + 0.05, -0.03);
  g.add(handle);
  const grip = box(0.06, 0.13, 0.05, k.dark);
  grip.position.set(-0.15, -recH / 2 - 0.05, 0);
  g.add(grip);
  const pad = box(0.05, 0.15, 0.08, k.dark);
  pad.position.set(-recLen / 2 - 0.02, 0, 0);
  g.add(pad);
  brandTell(g, k, recLen, recH, muzzleX);
  markBands(g, k, muzzleX + 0.1, 0.045);
  return g;
};

/** Shoulder tubes: AT is one long fat tube, AP a shorter revolver cluster. */
const buildAtRocket: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const len = 1.0 * k.st.length;
  const r = 0.075 * k.st.girth;
  const tube = cyl(r, r, len, k.metal, 8);
  tube.rotation.z = Math.PI / 2;
  tube.position.set(0.1, 0.06, 0);
  g.add(tube);
  const bell = cyl(r + 0.035, r, 0.12, k.dark, 8);
  bell.rotation.z = -Math.PI / 2;
  bell.position.set(0.1 - len / 2 - 0.05, 0.06, 0);
  g.add(bell);
  const warhead = cyl(0.03, r - 0.01, 0.1, k.glow, 8);
  warhead.rotation.z = -Math.PI / 2;
  warhead.position.set(0.1 + len / 2 + 0.04, 0.06, 0);
  g.add(warhead);
  const sightBox = box(0.12, 0.07, 0.05, k.dark);
  sightBox.position.set(-0.05, 0.06 + r + 0.05, 0);
  g.add(sightBox);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, 0.06 - r - 0.07, 0);
  g.add(grip);
  const fore = box(0.05, 0.1, 0.05, k.dark);
  fore.position.set(0.3, 0.06 - r - 0.06, 0);
  g.add(fore);
  brandTell(g, k, 0.4, r * 2, 0.55);
  markBands(g, k, 0.42, r);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.03, 0), handguard: new THREE.Vector3(0.3, -0.02, 0) };
  return g;
};

const buildApRocket: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const len = 0.62 * k.st.length;
  // three-tube revolver cluster
  const R = 0.045 * k.st.girth;
  const offs: [number, number][] = [[0.055, 0], [-0.03, 0.05], [-0.03, -0.05]];
  for (const [dy, dz] of offs) {
    const t = cyl(R, R, len, k.metal, 6);
    t.rotation.z = Math.PI / 2;
    t.position.set(0.08, 0.06 + dy, dz);
    g.add(t);
  }
  const collar = cyl(0.11 * k.st.girth, 0.11 * k.st.girth, 0.08, k.dark, 8);
  collar.rotation.z = Math.PI / 2;
  collar.position.set(0.08 - len / 2 + 0.06, 0.06, 0);
  g.add(collar);
  const body = box(0.26, 0.12, 0.1, k.dark);
  body.position.set(-0.16, 0.02, 0);
  g.add(body);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.1, 0);
  g.add(grip);
  const fore = box(0.05, 0.1, 0.05, k.dark);
  fore.position.set(0.28, -0.05, 0);
  g.add(fore);
  brandTell(g, k, 0.3, 0.12, 0.35);
  markBands(g, k, 0.3, 0.1);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.1, 0), handguard: new THREE.Vector3(0.28, -0.04, 0) };
  return g;
};

const buildMortar: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const len = 0.66 * k.st.length;
  const r = 0.065 * k.st.girth;
  const tube = cyl(r + 0.008, r, len, k.metal, 8);
  tube.rotation.z = Math.PI / 2;
  tube.rotation.y = 0; // carried level; the sim lobs it regardless
  tube.position.set(0.12, 0.03, 0);
  g.add(tube);
  // muzzle flare — a mortar mouth reads as a MOUTH
  const mouth = cyl(r + 0.03, r + 0.008, 0.07, k.metal, 8);
  mouth.rotation.z = Math.PI / 2;
  mouth.position.set(0.12 + len / 2 + 0.03, 0.03, 0);
  g.add(mouth);
  // folded baseplate under the breech
  const plate = box(0.16, 0.02, 0.16, k.dark);
  plate.position.set(-0.18, -0.08, 0);
  g.add(plate);
  for (const side of [1, -1]) {
    const legB = box(0.26, 0.018, 0.018, k.metal);
    legB.position.set(0.05, -0.05, side * 0.055);
    legB.rotation.z = -0.15;
    g.add(legB);
  }
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.09, 0);
  g.add(grip);
  const shell = cyl(0.03, 0.045, 0.1, k.glow, 6);
  shell.rotation.z = -Math.PI / 2;
  shell.position.set(-0.3, 0.06, 0);
  g.add(shell);
  brandTell(g, k, 0.3, r * 2, 0.45);
  markBands(g, k, 0.38, r + 0.008);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.08, 0), handguard: new THREE.Vector3(0.3, 0, 0) };
  return g;
};

const buildArtillery: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const len = 0.95 * k.st.length;
  const barrel = cyl(0.045, 0.06 * k.st.girth, len, k.metal, 8);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.2, 0.05, 0);
  g.add(barrel);
  // recoil sled rails over the breech — field-gun DNA at carbine size
  for (const side of [1, -1]) {
    const rail = box(0.34, 0.025, 0.02, k.metal);
    rail.position.set(-0.12, 0.11, side * 0.045);
    g.add(rail);
  }
  const breech = box(0.24, 0.14 * k.st.girth, 0.12, k.metal);
  breech.position.set(-0.18, 0.03, 0);
  g.add(breech);
  // a sliver of gun-shield: the tell that this is ARTILLERY someone sawed loose
  const shield = box(0.02, 0.16, 0.2, k.dark);
  shield.position.set(-0.02, 0.05, 0);
  g.add(shield);
  const grip = box(0.06, 0.13, 0.05, k.dark);
  grip.position.set(-0.15, -0.08, 0);
  g.add(grip);
  const spade = box(0.05, 0.1, 0.05, k.dark);
  spade.position.set(-0.34, -0.05, 0);
  g.add(spade);
  brandTell(g, k, 0.24, 0.14, 0.6);
  markBands(g, k, 0.55, 0.05);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.07, 0), handguard: new THREE.Vector3(0.3, 0.02, 0) };
  return g;
};

const buildScatter: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  // 2×2 bore cluster with flared tips — a handheld broadside
  for (const dy of [0.03, -0.03]) for (const dz of [0.03, -0.03]) {
    const bore = cyl(0.026, 0.026, 0.3 * k.st.length, k.metal, 6);
    bore.rotation.z = Math.PI / 2;
    bore.position.set(0.22, dy, dz);
    g.add(bore);
    const flare = cyl(0.038, 0.026, 0.05, k.metal, 6);
    flare.rotation.z = Math.PI / 2;
    flare.position.set(0.22 + 0.15 * k.st.length + 0.02, dy, dz);
    g.add(flare);
  }
  const body = box(0.32 * k.st.length, 0.13 * k.st.girth, 0.12, k.wood);
  body.position.set(-0.04, 0, 0);
  g.add(body);
  const strap = box(0.06, 0.15, 0.13, k.dark);
  strap.position.set(0.08, 0, 0);
  g.add(strap);
  const stock = box(0.16, 0.11, 0.06, k.wood);
  stock.position.set(-0.26, -0.03, 0);
  stock.rotation.z = -0.14;
  g.add(stock);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.11, 0);
  g.add(grip);
  brandTell(g, k, 0.32, 0.13, 0.35);
  markBands(g, k, 0.3, 0.075);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.1, 0), handguard: new THREE.Vector3(0.24, -0.05, 0) };
  return g;
};

const buildSonic: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const body = box(0.44 * k.st.length, 0.13 * k.st.girth, 0.11, k.metal);
  body.position.set(-0.06, 0, 0);
  g.add(body);
  // the horn: a cone opening +X — you can SEE the shove coming
  const horn = cyl(0.11 * k.st.girth, 0.035, 0.24, k.dark, 10);
  horn.rotation.z = -Math.PI / 2;
  horn.position.set(0.3, 0.01, 0);
  g.add(horn);
  const throat = cyl(0.12 * k.st.girth, 0.12 * k.st.girth, 0.02, k.glow, 10);
  throat.rotation.z = Math.PI / 2;
  throat.position.set(0.43, 0.01, 0);
  g.add(throat);
  // resonator rings on the body
  for (let i = 0; i < 2; i++) {
    const ring = box(0.03, 0.15 * k.st.girth, 0.13, k.dark);
    ring.position.set(-0.14 + i * 0.12, 0, 0);
    g.add(ring);
  }
  const seam = box(0.3, 0.018, 0.005, k.glow);
  seam.position.set(-0.06, 0.02, 0.058);
  g.add(seam);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.12, 0);
  g.add(grip);
  const fore = box(0.05, 0.1, 0.05, k.dark);
  fore.position.set(0.16, -0.1, 0);
  g.add(fore);
  brandTell(g, k, 0.44, 0.13, 0.35);
  markBands(g, k, 0.24, 0.07);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.11, 0), handguard: new THREE.Vector3(0.16, -0.09, 0) };
  return g;
};

const buildFlamer: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const body = box(0.4 * k.st.length, 0.1 * k.st.girth, 0.09, k.metal);
  g.add(body);
  const lance = cyl(0.022, 0.022, 0.34 * k.st.length, k.metal, 6);
  lance.rotation.z = Math.PI / 2;
  const tipX = 0.2 + 0.17 * k.st.length;
  lance.position.set(tipX, 0.02, 0);
  g.add(lance);
  const nozzle = cyl(0.035, 0.022, 0.06, k.dark, 6);
  nozzle.rotation.z = -Math.PI / 2;
  nozzle.position.set(tipX + 0.17 * k.st.length, 0.02, 0);
  g.add(nozzle);
  // pilot light: a live ember at the tip
  const pilot = box(0.03, 0.03, 0.03, k.hot);
  pilot.position.set(tipX + 0.17 * k.st.length + 0.05, 0.02, 0);
  g.add(pilot);
  // underslung fuel bottles — the fuel IS the fear
  for (const dz of [0.035, -0.035]) {
    const tank = cyl(0.04 * k.st.girth, 0.04 * k.st.girth, 0.26, mat(0x7a2f1c, { metal: 0.4, rough: 0.5 }), 8);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(-0.02, -0.09, dz);
    g.add(tank);
  }
  const gauge = cyl(0.025, 0.025, 0.015, k.glow, 6);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(-0.14, 0.06, 0.05);
  g.add(gauge);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.1, 0);
  g.add(grip);
  const fore = box(0.05, 0.1, 0.05, k.dark);
  fore.position.set(0.24, -0.07, 0);
  g.add(fore);
  brandTell(g, k, 0.4, 0.1, 0.4);
  markBands(g, k, 0.34, 0.026);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.09, 0), handguard: new THREE.Vector3(0.24, -0.06, 0) };
  return g;
};

const buildGrenadeLauncher: FamilyBuilder = (k, def) => {
  const g = new THREE.Group();
  const barrel = cyl(0.055 * k.st.girth, 0.055 * k.st.girth, 0.3 * k.st.length, k.metal, 8);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.26, 0.01, 0);
  g.add(barrel);
  // revolver drum on its side — six chambers you can count
  const drum = cyl(0.09 * k.st.girth, 0.09 * k.st.girth, 0.12, k.dark, 8);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0.02, 0, 0);
  g.add(drum);
  const rear = box(0.2, 0.1 * k.st.girth, 0.08, k.metal);
  rear.position.set(-0.16, 0, 0);
  g.add(rear);
  const stock = box(0.06, 0.13, 0.07, k.dark);
  stock.position.set(-0.28, -0.01, 0);
  g.add(stock);
  // ladder sight flipped up — lobbed rounds aim HIGH
  const ladder = box(0.015, 0.09, 0.05, k.metal);
  ladder.position.set(0.1, 0.09, 0);
  ladder.rotation.z = 0.2;
  g.add(ladder);
  const grip = box(0.06, 0.12, 0.05, k.dark);
  grip.position.set(-0.15, -0.09, 0);
  g.add(grip);
  const fore = box(0.05, 0.09, 0.05, k.dark);
  fore.position.set(0.26, -0.08, 0);
  g.add(fore);
  // payload stripe: smoke rounds gray, phosphorus fire-orange, frag amber
  const payload = def.id.includes('smoke') ? mat(0x9aa4ad, { rough: 0.6 })
    : def.id.includes('wp') || def.id.includes('phos') ? k.hot : k.glow;
  const band = cyl(0.06 * k.st.girth, 0.06 * k.st.girth, 0.03, payload, 8);
  band.rotation.z = Math.PI / 2;
  band.position.set(0.36, 0.01, 0);
  g.add(band);
  brandTell(g, k, 0.2, 0.1, 0.35);
  markBands(g, k, 0.28, 0.058);
  g.userData.anchors = { grip: new THREE.Vector3(-0.15, -0.08, 0), handguard: new THREE.Vector3(0.26, -0.07, 0) };
  return g;
};

/** Specials: hard case + antenna — demolition and emplacement gear reads as
 *  EQUIPMENT, not gun. Vehicle-mounted 'special' guns never render in hand. */
const buildSpecial: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  const caseB = box(0.34, 0.2, 0.12, k.dark);
  caseB.position.set(0.02, 0, 0);
  g.add(caseB);
  const lid = box(0.34, 0.03, 0.12, k.metal);
  lid.position.set(0.02, 0.115, 0);
  g.add(lid);
  const handle = box(0.12, 0.025, 0.03, k.metal);
  handle.position.set(0.02, 0.15, 0);
  g.add(handle);
  const antenna = box(0.012, 0.2, 0.012, k.metal);
  antenna.position.set(0.16, 0.2, 0.04);
  g.add(antenna);
  const lamp = box(0.03, 0.03, 0.015, k.hot);
  lamp.position.set(0.12, 0.06, 0.065);
  g.add(lamp);
  const stencil = box(0.14, 0.06, 0.005, k.glow);
  stencil.position.set(-0.06, 0.02, 0.063);
  g.add(stencil);
  g.userData.anchors = { grip: new THREE.Vector3(0.02, 0.15, 0), handguard: null };
  return g;
};

const buildUnarmed: FamilyBuilder = (k) => {
  const g = new THREE.Group();
  // The armory registry requires a bounded silhouette even though the soldier
  // renderer hides this family and uses the body's real hands. These are the
  // two cloth wraps represented by the Bare Hands inventory card.
  const rightWrap = box(0.34, 0.08, 0.08, k.dark);
  rightWrap.position.set(0.06, -0.05, -0.06);
  g.add(rightWrap);
  const leftWrap = box(0.3, 0.075, 0.075, k.dark);
  leftWrap.position.set(0.04, 0.06, 0.06);
  g.add(leftWrap);
  g.userData.anchors = { grip: new THREE.Vector3(-0.08, -0.05, -0.06), handguard: null };
  return g;
};

/** Civilian close-combat silhouettes. These stay intentionally ordinary:
 * sporting wood, a clean blade, and a red-headed fire axe. */
const buildMeleeWeapon: FamilyBuilder = (k, def) => {
  const g = new THREE.Group();
  const wood = mat(def.id === 'baseball_bat' ? 0x8b6237 : 0x4b3524, { rough: 0.82 });
  if (def.id === 'katana') {
    const blade = box(0.78, 0.035, 0.025, mat(0xc7d0d2, { metal: 0.75, rough: 0.2 }));
    blade.position.x = 0.28;
    g.add(blade);
    const grip = cyl(0.035, 0.035, 0.3, k.dark, 8);
    grip.rotation.z = Math.PI / 2;
    grip.position.x = -0.25;
    g.add(grip);
    const guard = box(0.035, 0.17, 0.045, k.metal);
    guard.position.x = -0.08;
    g.add(guard);
  } else if (def.id === 'fire_axe') {
    const handle = cyl(0.035, 0.045, 0.72, wood, 8);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.02;
    g.add(handle);
    const head = box(0.18, 0.22, 0.06, mat(0xb83b2d, { metal: 0.38, rough: 0.42 }));
    head.position.set(0.37, 0.08, 0);
    head.rotation.z = -0.18;
    g.add(head);
  } else {
    const bat = cyl(0.065, 0.035, 0.82, wood, 10);
    bat.rotation.z = Math.PI / 2;
    bat.position.x = 0.08;
    g.add(bat);
    const tape = cyl(0.043, 0.043, 0.2, k.dark, 8);
    tape.rotation.z = Math.PI / 2;
    tape.position.x = -0.32;
    g.add(tape);
  }
  g.userData.anchors = { grip: new THREE.Vector3(-0.28, 0, 0), handguard: new THREE.Vector3(-0.05, 0, 0) };
  return g;
};

const BUILDERS: Record<string, FamilyBuilder> = {
  pistol: buildPistol,
  rifle: buildRifleFam,
  carbine: buildCarbine,
  smg: buildSmg,
  shotgun: buildShotgun,
  slugger: buildSlugger,
  laser: buildLaser,
  lmg: buildLmg,
  hmg: buildHmg,
  at_rocket: buildAtRocket,
  ap_rocket: buildApRocket,
  mortar: buildMortar,
  artillery: buildArtillery,
  scatter: buildScatter,
  sonic: buildSonic,
  flamethrower: buildFlamer,
  grenade: buildGrenadeLauncher,
  special: buildSpecial,
  melee: buildUnarmed,
  melee_weapon: buildMeleeWeapon,
};

/** Brand off the generated id (`family_brand_mk`); hand-tuned core ids and
 *  LSW arms fall back to Maklov at the def's own tier. */
function parseBrand(id: string): string {
  const parts = id.split('_');
  const cand = parts.length >= 3 ? parts[parts.length - 2] : '';
  return BRAND_STYLES[cand] ? cand : 'maklov';
}

/** The maker's public face (B1 weapon-cam chrome + weapon cards): brand key +
 *  the furniture tint the HUD may wear. One source — the same table that
 *  shapes the gun shapes its chrome. */
export function weaponBrand(id: string): { key: string; tint: number } {
  const st = BRAND_STYLES[parseBrand(id)];
  return { key: st.key, tint: st.furniture };
}

/** The armory's front door: one deterministic Group per weapon id.
 *  Root is named 'gun' (the animator's contract) and faces +X. Unknown ids
 *  still build honestly — family off the id prefix, mark off the tail. */
export function buildWeaponModel(weaponId: string): THREE.Group {
  const def = WEAPONS[weaponId];
  const family = def?.family
    ?? Object.keys(BUILDERS).find((f) => weaponId.startsWith(`${f}_`))
    ?? 'rifle';
  const builder = BUILDERS[family] ?? buildRifleFam;
  const st = BRAND_STYLES[parseBrand(weaponId)];
  const tailMk = Number(weaponId.split('_').pop());
  const k = kit(st, Math.min(3, Math.max(1, def?.tier ?? (Number.isFinite(tailMk) ? tailMk : 1))));
  const g = builder(k, def ?? WEAPONS['rifle_kuchler_1']);
  g.name = 'gun';
  g.userData.weaponId = weaponId;
  return g;
}
