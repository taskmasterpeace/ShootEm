/** THE RING'S PROOF SHEET — run the real draw functions (src/client/ring.ts)
 *  through a minimal 2D-context recorder and rasterize what they emit:
 *  T0 chunks at 3/2/1/0, T1 grade with plate, T2 with the number, and the
 *  LSW threat notches. Writes PNGs to tools/atlas/ring-*.png
 *
 *  npx tsx tools/ring-proof.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  chunkCount, drawChunks, drawGrade, drawNotches, drawNumber, RING_COLORS,
} from '../src/client/ring';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'atlas');
mkdirSync(OUT, { recursive: true });

// ---- a minimal 2D context: records arc strokes + text, rasterizes to RGB ---
const SIZE = 128;
function makeCtx() {
  const px = new Uint8Array(SIZE * SIZE * 3);
  const ops: { type: 'arc' | 'text'; color: string; x: number; y: number; r: number; a0: number; a1: number; w: number; text?: string; size?: number }[] = [];
  const ctx = {
    lineWidth: 1, lineCap: 'round', strokeStyle: '#fff', fillStyle: '#fff',
    font: '', textAlign: 'center', textBaseline: 'middle',
    clearRect: () => px.fill(0),
    fillRect: () => undefined,
    beginPath: () => undefined,
    arc: (x: number, y: number, r: number, a0: number, a1: number) => {
      ops.push({ type: 'arc', color: ctx.strokeStyle, x, y, r, a0, a1, w: ctx.lineWidth });
    },
    stroke: () => undefined,
    strokeText: (t: string, x: number, y: number) => {
      ops.push({ type: 'text', color: 'rgba(0,0,0,0.9)', x, y, r: 0, a0: 0, a1: 0, w: 2, text: t, size: parseInt(ctx.font) || 30 });
    },
    fillText: (t: string, x: number, y: number) => {
      ops.push({ type: 'text', color: ctx.fillStyle, x, y, r: 0, a0: 0, a1: 0, w: 1, text: t, size: parseInt(ctx.font) || 30 });
    },
  };
  const flush = () => {
    for (const op of ops) {
      const col = parseColor(op.color);
      if (op.type === 'arc') {
        const steps = Math.max(8, Math.ceil(Math.abs(op.a1 - op.a0) * op.r * 1.5));
        for (let i = 0; i <= steps; i++) {
          const a = op.a0 + ((op.a1 - op.a0) * i) / steps;
          const cx = op.x + Math.cos(a) * op.r, cy = op.y + Math.sin(a) * op.r;
          blob(px, cx, cy, op.w / 2 + 0.8, col);
        }
      } else if (op.text?.length) {
        // blocky mono stand-in: each char = a small stamped rectangle column
        const cw = (op.size ?? 30) * 0.55, ch = (op.size ?? 30);
        let ox = op.x - (op.text.length * cw) / 2;
        for (const ch of op.text) {
          if (ch !== ' ') blob(px, ox + cw / 2, op.y, 0, col, cw * 0.38, ch * 0.42);
          ox += cw;
        }
      }
    }
    return px;
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, flush };
}

function parseColor(c: string): [number, number, number, number] {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(',').map(Number);
    return [r, g, b, a === undefined ? 1 : a];
  }
  const hex = parseInt(c.replace('#', ''), 16);
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 1];
}

function blob(px: Uint8Array, cx: number, cy: number, r: number, col: [number, number, number, number], rw?: number, rh?: number) {
  const rx = rw ?? r, ry = rh ?? r;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const d = ((x - cx) ** 2) / (rx * rx || 1) + ((y - cy) ** 2) / (ry * ry || 1);
      if (d > 1) continue;
      const i = (y * SIZE + x) * 3;
      px[i] = Math.round(px[i] * (1 - col[3]) + col[0] * col[3]);
      px[i + 1] = Math.round(px[i + 1] * (1 - col[3]) + col[1] * col[3]);
      px[i + 2] = Math.round(px[i + 2] * (1 - col[3]) + col[2] * col[3]);
    }
  }
}

// ---- PNG writer (same zero-dep encoder as atlas-png) ------------------------
function crc32(buf: Buffer): number {
  let c, table = (crc32 as unknown as { t?: number[] }).t;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    (crc32 as unknown as { t?: number[] }).t = table;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePng(path: string, px: Uint8Array) {
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 3 + 1)] = 0;
    px.slice(y * SIZE * 3, (y + 1) * SIZE * 3).forEach((v, i) => { raw[y * (SIZE * 3 + 1) + 1 + i] = v; });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ---- the sheet ---------------------------------------------------------------
const render = (name: string, draw: (ctx: CanvasRenderingContext2D) => void) => {
  const { ctx, flush } = makeCtx();
  draw(ctx);
  writePng(join(OUT, `${name}.png`), flush());
  console.log(`${name}.png`);
};

const fracColor = (f: number) => RING_COLORS.hp(f);
for (const f of [1, 2 / 3, 0.4, 0.15]) {
  render(`ring-t0-chunks-${Math.round(f * 100)}`, (ctx) => drawChunks(ctx, chunkCount(f), fracColor(f)));
}
render('ring-t1-grade-66-plate', (ctx) => drawGrade(ctx, 0.66, 0.8, fracColor(0.66), true));
render('ring-t2-number-42', (ctx) => { drawGrade(ctx, 0.42, 0.5, fracColor(0.42), true); drawNumber(ctx, 42); });
render('ring-lsw-threat3', (ctx) => { drawGrade(ctx, 0.85, 0, RING_COLORS.hostile, false); drawNotches(ctx, 3, RING_COLORS.hostile); });
console.log('ring proof →', OUT);
