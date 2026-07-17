/** dev-only: BMP → PNG converter so the atlas renders are viewable.
 *  npx tsx tools/atlas-png.ts the_city.small the_city.large ... */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'atlas');

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

function bmpToPng(bmp: Buffer): Buffer {
  const off = bmp.readUInt32LE(10);
  const w = bmp.readInt32LE(18);
  const h = Math.abs(bmp.readInt32LE(22));
  const rowPad = (4 - ((w * 3) % 4)) % 4;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    let o = off + y * (w * 3 + rowPad);
    for (let x = 0; x < w; x++) {
      const i = y * (w * 3 + 1) + 1 + x * 3;
      raw[i] = bmp[o + 2]; raw[i + 1] = bmp[o + 1]; raw[i + 2] = bmp[o]; // BGR→RGB
      o += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const name of process.argv.slice(2)) {
  const bmp = readFileSync(join(DIR, `${name}.bmp`));
  writeFileSync(join(DIR, `${name}.png`), bmpToPng(bmp));
  console.log(`${name}.png`);
}
