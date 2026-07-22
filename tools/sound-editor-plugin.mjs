/**
 * Sound Editor dev-server API (Vite plugin, dev-only / apply:'serve').
 *
 * Powers sound-editor.html: audition every game sound, edit its prompt, and
 * REGENERATE it live through ElevenLabs — N variants at once — hear them,
 * approve one, and it becomes the live sound (wav + the .ogg the game loads).
 * The API key stays server-side (sound-gen-core.loadKey); the browser only ever
 * sends prompts and hears wavs. `apply: 'serve'` → zero effect on the build.
 *
 * The heavy tool modules (sound-specs / sound-gen-core) are loaded at dev
 * RUNTIME via absolute-URL dynamic import — NOT statically — so Vite's esbuild
 * config bundler never tries to inline them (their `#!` shebang breaks that).
 *
 * Endpoints (all under /api/sound):
 *   GET  /specs             → { specs, variants, loops, keyConfigured, ffmpeg }
 *   POST /gen   {name,text,dur,n} → generate N variants → { variants:[{i,url}] , errors }
 *   POST /approve {name,variant,text?} → promote variant → live wav+ogg (+prompt override)
 *   POST /loop  {name,loop}   → designate whether the sound loops (loop-flags.json)
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));

export function isRiffWave(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 44
    && buf.toString('ascii', 0, 4) === 'RIFF'
    && buf.toString('ascii', 8, 12) === 'WAVE';
}

function readBody(req) {
  return new Promise((res) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { res(JSON.parse(data || '{}')); } catch { res({}); } });
  });
}

export function soundEditorPlugin() {
  return {
    name: 'sound-editor-api',
    apply: 'serve',
    async configureServer(server) {
      // runtime import (absolute file URL → esbuild leaves it alone; the dev
      // server, cwd = project root, resolves the real Node modules)
      const toolUrl = (f) => pathToFileURL(resolve(process.cwd(), 'tools', f)).href;
      const { completeSoundSpecs } = await import(toolUrl('sound-specs.mjs'));
      const {
        AUDIO_DIR, VARIANTS_DIR, loadKey, hasFfmpeg, composePrompt, generateTake, wavToOgg,
        VARIANT_INFLUENCES,
      } = await import(toolUrl('sound-gen-core.mjs'));

      const LOOP_FLAGS = join(AUDIO_DIR, 'loop-flags.json');
      const PROMPT_OVERRIDES = join(AUDIO_DIR, 'prompt-overrides.json');
      const catalogNames = readdirSync(AUDIO_DIR)
        .filter((name) => /\.(wav|ogg)$/i.test(name))
        .map((name) => name.replace(/\.(wav|ogg)$/i, ''));
      const COMPLETE_SPECS = completeSoundSpecs(catalogNames);

      /** Encode in staging first; only validated WAV+OGG pairs reach live paths. */
      const promoteWav = (src, destWav) => {
        mkdirSync(VARIANTS_DIR, { recursive: true });
        const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const stageWav = join(VARIANTS_DIR, `.stage-${token}.wav`);
        const stageOgg = join(VARIANTS_DIR, `.stage-${token}.ogg`);
        try {
          copyFileSync(src, stageWav);
          wavToOgg(stageWav, stageOgg);
          copyFileSync(stageWav, destWav);
          copyFileSync(stageOgg, destWav.replace(/\.wav$/i, '.ogg'));
        } finally {
          rmSync(stageWav, { force: true });
          rmSync(stageOgg, { force: true });
        }
      };

      /** which sounds already have variant takes on disk → { name: [1,2,3] } */
      const scanVariants = () => {
        const out = {};
        let names = [];
        try { names = readdirSync(VARIANTS_DIR); } catch { return out; }
        for (const f of names) {
          const m = /^(.+)-(\d+)\.wav$/i.exec(f);
          if (!m) continue;
          (out[m[1]] ??= []).push(Number(m[2]));
        }
        for (const k of Object.keys(out)) out[k].sort((a, b) => a - b);
        return out;
      };

      const send = (res, code, obj) => {
        res.statusCode = code;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
      };

      server.middlewares.use('/api/sound', async (req, res, next) => {
        const url = (req.url || '').split('?')[0];
        try {
          // ---- GET /specs : everything the page needs to render -------------
          if (req.method === 'GET' && url === '/specs') {
            const overrides = readJson(PROMPT_OVERRIDES, {});
            const specs = {};
            for (const [name, s] of Object.entries(COMPLETE_SPECS)) {
              specs[name] = { ...s, ...(overrides[name] || {}) };
            }
            return send(res, 200, {
              specs,
              variants: scanVariants(),
              loops: readJson(LOOP_FLAGS, {}),
              keyConfigured: !!loadKey(),
              ffmpeg: hasFfmpeg(),
            });
          }

          // ---- POST /gen : regenerate N variants from a prompt --------------
          if (req.method === 'POST' && url === '/gen') {
            const { name, text, dur, n = 3 } = await readBody(req);
            if (!name || !COMPLETE_SPECS[name]) return send(res, 400, { error: `unknown sound '${name}'` });
            if (!COMPLETE_SPECS[name].generatable) return send(res, 400, { error: `'${name}' is a spoken line - import or clip a directed TTS take instead` });
            if (!loadKey()) return send(res, 400, { error: 'ELEVENLABS_API_KEY not configured — add it to D:/git/mkm/ad-lab/.env (ELEVENLABS_API_KEY=sk_…) or set the env var, then restart the dev server.' });
            if (!hasFfmpeg()) return send(res, 400, { error: 'ffmpeg not found on PATH.' });
            const key = loadKey();
            const cat = COMPLETE_SPECS[name].cat;
            const desc = (text || COMPLETE_SPECS[name].desc).trim();
            const duration = Number(dur) || COMPLETE_SPECS[name].dur || 1;
            const count = Math.max(1, Math.min(5, Number(n) || 3));
            mkdirSync(VARIANTS_DIR, { recursive: true });
            const prompt = composePrompt(desc, cat);
            const variants = [];
            const errors = [];
            for (let i = 1; i <= count; i++) {
              const outWav = join(VARIANTS_DIR, `${name}-${i}.wav`);
              try {
                await generateTake({ text: prompt, durationSeconds: duration, influence: VARIANT_INFLUENCES[(i - 1) % VARIANT_INFLUENCES.length], outWav, key });
                variants.push({ i, url: `/audio/variants/${name}-${i}.wav?t=${Date.now()}` });
              } catch (e) {
                errors.push(`v${i}: ${e.message}`);
              }
            }
            return send(res, variants.length ? 200 : 500, { name, prompt, variants, errors });
          }

          // ---- POST /approve : promote a variant to the live sound ----------
          if (req.method === 'POST' && url === '/approve') {
            const { name, variant, text, dur } = await readBody(req);
            if (!name || !COMPLETE_SPECS[name]) return send(res, 400, { error: `unknown sound '${name}'` });
            const src = join(VARIANTS_DIR, `${name}-${variant}.wav`);
            if (!existsSync(src)) return send(res, 404, { error: `variant ${variant} for '${name}' not found — generate first` });
            const liveWav = join(AUDIO_DIR, `${name}.wav`);
            try { promoteWav(src, liveWav); } catch (e) { return send(res, 500, { error: `variant validation/encode failed: ${e.message}` }); }
            if (text && text.trim()) {
              const overrides = readJson(PROMPT_OVERRIDES, {});
              overrides[name] = { desc: text.trim(), ...(dur ? { dur: Number(dur) } : {}) };
              writeJson(PROMPT_OVERRIDES, overrides);
            }
            return send(res, 200, { ok: true, live: `/audio/${name}.ogg?t=${Date.now()}` });
          }

          // ---- POST /loop : designate whether this sound loops --------------
          if (req.method === 'POST' && url === '/loop') {
            const { name, loop } = await readBody(req);
            if (!name || !COMPLETE_SPECS[name]) return send(res, 400, { error: `unknown sound '${name}'` });
            const flags = readJson(LOOP_FLAGS, {});
            if (loop) flags[name] = true; else delete flags[name];
            writeJson(LOOP_FLAGS, flags);
            return send(res, 200, { ok: true, loops: flags });
          }

          // ---- POST /save : write a browser-edited WAV (trim/stitch) --------
          // The editor encodes the clipped/stitched AudioBuffer to a WAV and
          // sends it base64. Land it live, or as a fresh variant to audition.
          if (req.method === 'POST' && url === '/save') {
            const { name, wavB64, asVariant } = await readBody(req);
            if (!name || !COMPLETE_SPECS[name]) return send(res, 400, { error: `unknown sound '${name}'` });
            if (!wavB64) return send(res, 400, { error: 'no audio payload' });
            const wavBuf = Buffer.from(wavB64, 'base64');
            if (!isRiffWave(wavBuf)) return send(res, 400, { error: 'payload is not a RIFF/WAVE file' });
            mkdirSync(VARIANTS_DIR, { recursive: true });
            const upload = join(VARIANTS_DIR, `.upload-${process.pid}-${Date.now()}.wav`);
            try {
              writeFileSync(upload, wavBuf);
              if (asVariant) {
                const used = scanVariants()[name] || [];
                const i = (used.length ? Math.max(...used) : 0) + 1;
                const wav = join(VARIANTS_DIR, `${name}-${i}.wav`);
                promoteWav(upload, wav);
                return send(res, 200, { ok: true, variant: i, url: `/audio/variants/${name}-${i}.wav?t=${Date.now()}` });
              }
              const liveWav = join(AUDIO_DIR, `${name}.wav`);
              promoteWav(upload, liveWav);
              return send(res, 200, { ok: true, live: `/audio/${name}.ogg?t=${Date.now()}` });
            } catch (e) {
              return send(res, 500, { error: `WAV validation/encode failed: ${e.message}` });
            } finally {
              rmSync(upload, { force: true });
            }
          }

          return next();
        } catch (e) {
          return send(res, 500, { error: String(e?.message || e) });
        }
      });
    },
  };
}
