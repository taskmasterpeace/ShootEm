// ---------------------------------------------------------------------------
// REDO THE OFF TAKES — the other half of the director's loop.
//
// transcribe-vo.mjs finds the takes that drifted from their script (it writes
// tools/vo-transcript.json). This regenerates each OFF slot through the FULL
// pipeline (gen-lsw-vo.mjs --only <slot> --force, so the sci-fi FX pass runs),
// using the hardened buildPrompt that no longer leaks the direction into the
// read. Run transcribe-vo.mjs again afterward to confirm they came out clean.
//
//   node tools/transcribe-vo.mjs      # 1. find the OFF takes
//   node tools/redo-off-vo.mjs        # 2. redo them (this)
//   node tools/transcribe-vo.mjs      # 3. verify they're clean now
//
// --slots a,b,c  redo an explicit list instead of reading the transcript.
// ---------------------------------------------------------------------------
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

let slots;
const explicit = flag('--slots');
if (explicit) {
  slots = explicit.split(',').map((s) => s.trim()).filter(Boolean);
} else {
  const jsonPath = join(ROOT, 'tools', 'vo-transcript.json');
  if (!existsSync(jsonPath)) { console.error('No tools/vo-transcript.json — run tools/transcribe-vo.mjs first.'); process.exit(1); }
  const { rows } = JSON.parse(readFileSync(jsonPath, 'utf8'));
  slots = rows.filter((r) => r.status === 'OFF').map((r) => r.slot);
}

if (!slots.length) { console.log('Nothing OFF to redo. ✅'); process.exit(0); }
console.log(`Redoing ${slots.length} off take(s) with the hardened prompt…\n`);

let ok = 0, fail = 0;
for (const slot of slots) {
  try {
    execFileSync('node', ['tools/gen-lsw-vo.mjs', '--only', slot, '--force'], { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ✓ ${slot}`);
    ok++;
  } catch (e) {
    console.log(`  ✗ ${slot} — ${String(e.message || e).split('\n')[0].slice(0, 120)}`);
    fail++;
  }
}
console.log(`\nRedone ${ok}, failed ${fail}. Now run: node tools/transcribe-vo.mjs  (to verify they're clean)`);
