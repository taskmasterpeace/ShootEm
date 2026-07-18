#!/usr/bin/env node
// ---------------------------------------------------------------------------
// REGEN THE NOTE-BLEED CLIPS — size is the tell. gemini-3.1-flash-tts
// occasionally reads its DIRECTION aloud, and those takes run 20-65s where a
// correct bark is 1-3s. The whisper diff (transcribe-vo) is superset-tolerant
// and passed a 26s clip as "clean", so we gate on DURATION instead: any
// vo_/ann_ clip over the ceiling is re-rolled (same prompt — the note-bleed is
// per-take) until it lands short, keeping the smallest attempt.
//
//   node tools/regen-oversized-vo.mjs --dry-run          # just list offenders
//   node tools/regen-oversized-vo.mjs                     # regen (ceil 6.5s, 3 tries)
//   node tools/regen-oversized-vo.mjs --ceil 6.5 --tries 3
// ---------------------------------------------------------------------------
import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const CEIL = parseFloat(arg('--ceil', '6.5'));           // seconds
const TRIES = parseInt(arg('--tries', '3'), 10);
const DRY = process.argv.includes('--dry-run');
const CEIL_BYTES = 44 + Math.round(CEIL * 88200);        // 44.1k mono s16
const dur = (bytes) => ((bytes - 44) / 88200);

// every VO/announcer clip on disk, largest first
const files = readdirSync(OUT)
  .filter((f) => /^(vo|ann)_.*\.wav$/.test(f))
  .map((f) => ({ slot: f.replace(/\.wav$/, ''), path: join(OUT, f), bytes: statSync(join(OUT, f)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const over = files.filter((f) => f.bytes > CEIL_BYTES);
console.log(`${files.length} VO/ann clips · ceiling ${CEIL}s (${CEIL_BYTES} B) · ${over.length} over:`);
for (const f of over) console.log(`  ${f.slot.padEnd(28)} ${(f.bytes / 1024).toFixed(0).padStart(5)}KB  ${dur(f.bytes).toFixed(1)}s`);
if (DRY) { console.log('\n(dry run — nothing regenerated)'); process.exit(0); }
if (!over.length) { console.log('\nall clips already under the ceiling.'); process.exit(0); }

const cleared = [], stubborn = [];
for (const f of over) {
  let bestBytes = f.bytes;
  const backup = f.path.replace(/\.wav$/, '.best.tmp');
  copyFileSync(f.path, backup); // current is the best-so-far
  let ok = false;
  for (let t = 1; t <= TRIES; t++) {
    try {
      execFileSync(process.execPath, [join(ROOT, 'tools', 'gen-lsw-vo.mjs'), '--only', f.slot, '--force'], { stdio: 'pipe' });
    } catch (e) {
      console.error(`  ✗ ${f.slot} roll ${t}: gen failed (${String(e.message).slice(0, 80)})`);
      continue;
    }
    const nb = statSync(f.path).size;
    if (nb < bestBytes) { bestBytes = nb; copyFileSync(f.path, backup); } // keep the smallest
    console.log(`  ${f.slot} roll ${t}/${TRIES}: ${(nb / 1024).toFixed(0)}KB (${dur(nb).toFixed(1)}s)${nb <= CEIL_BYTES ? ' ✓' : ''}`);
    if (nb <= CEIL_BYTES) { ok = true; break; }
  }
  copyFileSync(backup, f.path);                    // restore the smallest attempt
  execFileSync(process.platform === 'win32' ? 'cmd' : 'rm',
    process.platform === 'win32' ? ['/c', 'del', backup.replace(/\//g, '\\')] : [backup]);
  (ok ? cleared : stubborn).push(`${f.slot} → ${(bestBytes / 1024).toFixed(0)}KB / ${dur(bestBytes).toFixed(1)}s`);
}

console.log(`\ncleared ${cleared.length}, still over ${stubborn.length}`);
if (stubborn.length) { console.log('STILL OVER (manual review — kept smallest roll):'); for (const s of stubborn) console.log('  ' + s); }
