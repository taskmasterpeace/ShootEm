import { defineConfig } from 'vitest/config'; // vite's defineConfig + the `test` key
import { resolve } from 'node:path';
import { readdirSync, statSync, rmSync } from 'node:fs';
// The Sound Editor's dev-only API (regenerate sounds by prompt via ElevenLabs).
// apply:'serve' inside — zero effect on the production build.
import { soundEditorPlugin } from './tools/sound-editor-plugin.mjs';

// opt #1 (L3): Vite copies public/ verbatim, so the WAV pack (134 MB) lands in
// dist even though the game now fetches .ogg. Prune dist/audio/**/*.wav after
// the build — the .ogg siblings (9 MB) are what ships; the WAVs stay in
// public/ as the pipeline/test source. Dist audio 134 MB → 9 MB.
function pruneWavPlugin() {
  return {
    name: 'prune-dist-wav',
    apply: 'build' as const,
    closeBundle() {
      const root = resolve(__dirname, 'dist/audio');
      let freed = 0, n = 0;
      const walk = (dir: string) => {
        let names: string[];
        try { names = readdirSync(dir); } catch { return; }
        for (const name of names) {
          const p = resolve(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else if (name.toLowerCase().endsWith('.wav')) { freed += statSync(p).size; n++; rmSync(p); }
        }
      };
      walk(root);
      if (n) console.log(`[prune-dist-wav] removed ${n} WAVs, freed ${(freed / 1024 / 1024).toFixed(1)} MB from dist`);
    },
  };
}

// The launch harness (autoPort) assigns a free port and hands it over in
// PORT — honor it, so the dev and preview servers never collide with another
// chat's already-running instance. Falls back to the historical defaults
// (3400 dev / 4173 preview) for a plain `npm run dev`/`preview`.
const PORT = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  plugins: [pruneWavPlugin(), soundEditorPlugin()],
  // vitest: only the repo's own suite — agent worktrees under .claude/ carry
  // their own copies of the tests and must not pollute the gate counts
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '.claude/**'],
  },
  server: {
    port: PORT ?? 3400,
    strictPort: true,
  },
  preview: {
    port: PORT ?? 4173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        // the game
        main: resolve(__dirname, 'index.html'),
        // the model / physics / combat debug harness (dev tool, /harness.html)
        harness: resolve(__dirname, 'harness.html'),
        // §11.5 the War Room — the operator's console (/warroom.html)
        warroom: resolve(__dirname, 'warroom.html'),
        // the prop contact sheet — every placeable prop beside a 1.8u man
        // (/props.html); the one check the gates can't run for you
        props: resolve(__dirname, 'props.html'),
        // the FX sheet — explosions on a bench at the sim's real radii (/fx.html)
        fx: resolve(__dirname, 'fx.html'),
        // the armory sheet — every weapon family × brand × mark (/armory.html)
        armory: resolve(__dirname, 'armory.html'),
        // the style lab — the capsule-soldier experiment (/style.html)
        style: resolve(__dirname, 'style.html'),
        // THE BODY SHOP — Robert's body decision: current rig vs capsule
        // with legs vs bare pod, same rig contract (/bodylab.html)
        bodylab: resolve(__dirname, 'bodylab.html'),
        // VANESSA'S PAINTBALL — the pro shop: walk the booths, pick the
        // marker your next yard deploy carries (/vanessas.html)
        vanessas: resolve(__dirname, 'vanessas.html'),
        // the beam lab — continuous beams: hose / kamehameha / heat / flamer (/beams.html)
        beams: resolve(__dirname, 'beams.html'),
        // radar/minimap + PixelLab aircraft instrument state bench
        instruments: resolve(__dirname, 'instruments.html'),
        // #96 the UI GALLERY — Robert's decision sheet (/ui-gallery.html)
        uigallery: resolve(__dirname, 'ui-gallery.html'),
      },
    },
  },
});
