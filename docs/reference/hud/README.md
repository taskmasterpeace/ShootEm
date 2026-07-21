# HUD Element System — 3 directions (2026-07-21)

Robert's ask: **show the actual weapon model on-screen**, and lock **one consistent "charging" grammar** used across *everything* (Impact Charge, LSW signature, reload, cooldowns, force-fields) — in the tactical-terminal look, with PixelLab-generated frames. The mouse wheel stays reserved for **zoom/magnification**, so charge is always **held-input driven**, never a wheel dial.

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
