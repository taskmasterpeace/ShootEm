# HUD Element System — the direction (2026-07-21)

Robert's ask: **show the actual weapon model on-screen**, and lock **one consistent "charging" grammar** used across *everything* (Impact Charge, LSW signature, reload, cooldowns, force-fields) — in the tactical-terminal look, with PixelLab-generated frames. The mouse wheel stays reserved for **zoom/magnification**, so charge is always **held-input driven**, never a wheel dial.

## DECIDED (Robert, 2026-07-21)

- **Placement:** bottom-right weapon block. ✓
- **Weapon display:** a **live 3D weapon-cam** of the exact equipped model. ✓
- **The frame is skinned PER MANUFACTURER** — pull a Titan and it goes heavy armored slab; a Ceres goes ornate brass; a Küchler goes precise cool-steel. The gun and its HUD speak the same brand language. ✓
- **The charge meter stays CONSTANT across every skin** (Robert: "same across the board") — the frame varies, the meter shape does not. ✓
- **The meter is DECIDED (2026-07-21): A — the segmented bar**, info-rich per UX-LANGUAGE §8. ✓
- **The accent is DECIDED (2026-07-21): the amber lead-notch tick** — a 2px amber hairline on the filling segment's leading edge (the stamina bar's edge treatment, promoted to law). Bracket caps + hairline underline remain in the grammar as reserves. ✓
- Nothing about the weapon-block kit remains open — build is EXECUTION-ORDER.md block B1.

**Zero new plumbing:** `parseBrand(weaponId)` (src/client/models/weapons.ts) already reads the maker off the gun id (`rifle_titan_2` → `titan`); the HUD picks its skin from the same call, and `buildWeaponModel(weaponId)` builds the model for the cam.

### The frames (2026-07-21, rev B)

Two flavors of PixelLab render in this folder:

- **`frame-empty-<brand>.png` — the real deal (6 makers).** EMPTY shells: a hollow weapon bay + an empty meter groove, no content baked in, so the game composites the **live 3D weapon-cam** and the **live meter** inside (Robert's note: the first renders had content baked in — these don't). maklov `c275cf3e` · titan `a5cc9190` · kuchler `7ecb5fee` · harkov `268d040b` · ceres `8295c818` · kamenel `bcbc5dce`. seed 21, 512×224.
- **`brand-<brand>.png` — content mockups (3).** The earlier renders with the weapon + bars baked in — kept only as *style reference* (they show what a filled frame should read like). maklov `c3e145e7` · titan `2e78f1ee` · kuchler `8cba7b13`.

### The meters (rev B is all-static)

The pitch's meter options are now **plain static SVG** (built at assembly time, no runtime JS) — the earlier live/animated version didn't render in Robert's view. Each grammar (segmented bar / analog dial / body-orbit arc) is shown frozen at wind-up → heavy → maximum → overcharge. **Open call:** which grammar rides inside every skin.

**Interactive pitch (pick here):** the published artifact has all three directions with *live, animated* charge meters and the weapon plate — https://claude.ai/code/artifact/1f3433d1-40e8-4f45-9f78-0e3bca9a1d9b

Built from [docs/UI-MASTER.md](../../UI-MASTER.md) (Law 1: near the action · Law 4: one accent, amber, no purple) and the shipping build's own tokens (`src/styles.css`) + fonts.

## The three directions

| | Direction | Charge grammar | Weapon plate | Feel |
|---|---|---|---|---|
| **A** | **Field Terminal** | **segmented bar** (notches fill L→R, top band = MAX, +1 red OVERCHARGE notch) | bracketed `[ ]` bay, stencil name + ammo stamp | most readable, classic-military; corner weapon block |
| **B** | **Gunmetal** | **analog dial** (arc sweeps into gold MAX zone, red OVERCHARGE, needle shakes) | riveted steel plate, octagonal embossed bay | most physical & characterful, "heavy machine" |
| **C** | **Recon Holo** | **body-orbit arc** (closes around the soldier as it fills; wraps the target for struggles) | ghosted holographic wireframe | most modern, most "near the action" (Law 1) |

Whichever wins becomes the **only** fill meter in the game — one shape a player learns once.

## PixelLab assets (in this folder)

| File | PixelLab asset id | Notes |
|---|---|---|
| `hud-A-field-terminal.png` | `431f8bdc-8294-4694-9865-f618ede261aa` | rendered the whole thing: PRIMARY WEAPON bay + CHARGE + segmented AMMO bar |
| `hud-B-gunmetal-dial.png` | `a3220bd6-bca7-47d7-8cb8-a93393d1c365` | riveted plate + octagon weapon bay + brass gauge |
| `hud-C-holo-orbit.png` | `eb35945f-59dd-41c6-98f0-611f2a5149a9` | hairline amber on black + ghosted weapon + orbit-ring emblem |

512×288, amber/ink, no purple. Regenerate variants with `mcp__pixellab__create_ui_asset` (seed 7).

## Next (on Robert's pick)

1. Render the equipped weapon **model** into the plate (mini weapon-cam or a per-weapon silhouette — we already build a real model per weapon id in `src/client/models/weapons.ts`).
2. Replace **every** existing meter (reload bar, Impact Charge text, LSW `lsw-bar`, grenade pip-sweep) with the chosen grammar so they read identically.
3. Wire the PixelLab frame (or a clean vector equivalent) as the plate chrome.
