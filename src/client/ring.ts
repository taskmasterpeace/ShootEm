// ---------------------------------------------------------------------------
// THE RING — one health language, three resolutions (§UI: "never three
// widgets"). A segmented ring at the soldier's feet; what changes with your
// tier is only how finely it divides:
//   T0 THE CHUNKS — everyone: 3 pie-arcs (floor boundaries; a sliver of the
//     top third still shows 3 — low tiers are never wrong, just less precise)
//   T1 THE GRADE — recon classes + squadmates on each other: a continuous
//     arc, plus the plate as a thin outer arc in steel-blue
//   T2 THE NUMBER — medics on teammates, optics, commission: the same ring,
//     exact value in stencil-mono beneath
// The arc spans 270° with the gap at the body's back — facing comes free.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export type RingTier = 0 | 1 | 2;

/** The upgrade rule is arithmetic: class tier + optics(+1) + commission(+1),
 *  capped at T2 — and squadmates always read each other at least at grade. */
export function ringTier(opts: {
  viewerRecon: boolean;
  viewerMedic: boolean;
  viewerOptics: boolean;
  viewerCommissioned?: boolean;
  squadmate: boolean;
}): RingTier {
  if (opts.squadmate && opts.viewerMedic) return 2; // the diagnostic eye
  const arithmetic = (opts.viewerRecon ? 1 : 0) + (opts.viewerOptics ? 1 : 0) + (opts.viewerCommissioned ? 1 : 0);
  return Math.max(opts.squadmate ? 1 : 0, Math.min(2, arithmetic)) as RingTier;
}

/** T0's floor boundaries: hp>0 always shows ≥1 chunk; ≥2/3 shows 3. */
export function chunkCount(hpFrac: number): 0 | 1 | 2 | 3 {
  if (hpFrac <= 0) return 0;
  if (hpFrac < 1 / 3) return 1;
  if (hpFrac < 2 / 3) return 2;
  return 3;
}

// the house palette — faction amber/cyan for friends, signal red for
// hostiles, steel-blue plate, mono numbers. No purple.
export const RING_COLORS = {
  hp: (frac: number) => (frac < 0.35 ? '#e05252' : frac < 0.7 ? '#e0b352' : '#7fd45c'),
  hostile: '#e05252',
  plate: '#9fc3d8',
  energy: '#e8d9a0',
  track: 'rgba(0,0,0,0.45)',
  number: '#f0d9a8',
};

const RING_R = 44;             // main arc radius on the 128px canvas
const ARC_START = Math.PI * 0.75;  // 135° — the gap centers on the body's back
const ARC_SPAN = Math.PI * 1.5;    // 270° of language

function arcSpan(ctx: CanvasRenderingContext2D, r: number, frac: number, width: number, color: string) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = RING_COLORS.track;
  ctx.beginPath();
  ctx.arc(64, 64, r, ARC_START, ARC_START + ARC_SPAN);
  ctx.stroke();
  if (frac > 0.004) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(64, 64, r, ARC_START, ARC_START + ARC_SPAN * Math.min(1, frac));
    ctx.stroke();
  }
}

/** T0 — the 3-chunk ring (4 cached textures total: 3/2/1/0). */
export function drawChunks(ctx: CanvasRenderingContext2D, chunks: 0 | 1 | 2 | 3, color: string) {
  ctx.clearRect(0, 0, 128, 128);
  const seg = ARC_SPAN / 3;
  const gapPad = 0.06;
  ctx.lineWidth = 11;
  ctx.lineCap = 'butt';
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = RING_COLORS.track;
    ctx.beginPath();
    ctx.arc(64, 64, RING_R, ARC_START + seg * i + gapPad, ARC_START + seg * (i + 1) - gapPad);
    ctx.stroke();
    if (i < chunks) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(64, 64, RING_R, ARC_START + seg * i + gapPad, ARC_START + seg * (i + 1) - gapPad);
      ctx.stroke();
    }
  }
}

/** T1 — the grade: continuous arc + thin outer plate arc. */
export function drawGrade(ctx: CanvasRenderingContext2D, hpFrac: number, plateFrac: number, color: string, drawPlate = true) {
  ctx.clearRect(0, 0, 128, 128);
  arcSpan(ctx, RING_R, hpFrac, 11, color);
  if (drawPlate && plateFrac > 0.004) arcSpan(ctx, RING_R + 10, plateFrac, 4, RING_COLORS.plate);
}

/** T2 — the grade, plus the exact number in stencil-mono. */
export function drawNumber(ctx: CanvasRenderingContext2D, exact: number) {
  ctx.font = '700 30px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 5;
  ctx.strokeText(String(exact), 64, 66);
  ctx.fillStyle = RING_COLORS.number;
  ctx.fillText(String(exact), 64, 66);
}

/** LSW threat notches: 1–3 tick marks on the ring's outer edge — the god's
 *  tier is public even when its exact health isn't. */
export function drawNotches(ctx: CanvasRenderingContext2D, n: number, color: string) {
  if (n <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = ARC_START + ARC_SPAN * (0.42 + i * 0.08);
    ctx.beginPath();
    ctx.arc(64, 64, RING_R + 15, a, a + 0.14);
    ctx.stroke();
  }
}

/** one soldier's ring: a ground-plane mesh with its own small canvas.
 *  T0 asks for the SHARED cached textures instead (ringChunkTexture). */
export function makeRingMesh(tex: THREE.Texture): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1.5, 1.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, // sits above the ground paint, below boots
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2; // flat on the ground plane — never covers the body
  mesh.position.y = 0.07;
  mesh.renderOrder = 1;
  return mesh;
}

// the T0 cache: 3 chunks × 3 colors + hostile, drawn once ever
const chunkCache = new Map<string, THREE.CanvasTexture>();
export function ringChunkTexture(chunks: 0 | 1 | 2 | 3, color: string): THREE.CanvasTexture {
  const key = `${chunks}:${color}`;
  let tex = chunkCache.get(key);
  if (!tex) {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    drawChunks(cvs.getContext('2d')!, chunks, color);
    tex = new THREE.CanvasTexture(cvs);
    chunkCache.set(key, tex);
  }
  return tex;
}
