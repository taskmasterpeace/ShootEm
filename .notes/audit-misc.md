# War World — Systems Audit: WEAPONS · RENDERING · MULTIPLAYER · PAINTBALL/SHOP · TELEMETRY · DEV LABS · MISC CLIENT

Auditor slice: "everything else." Read from the CODE at `D:/git/ShootEM`. Every status is grounded in a file:line.

---

## ★ HEADLINE: THE MULTIPLAYER VERDICT

**Real, working, authoritative-server netcode exists — this is NOT aspirational.** There is a dedicated Node WebSocket game server at `src/server/server.ts` (501 lines) and a matching client at `src/client/net.ts` (204 lines). It is genuine client/server multiplayer, not "replay-dressed-as-multiplayer."

What is real (cited):
- **A dedicated authoritative server** — `src/server/server.ts:433` `new WebSocketServer`, `:496` `httpServer.listen(PORT)` (default 3401). Launched via `npm run server` → `tsx src/server/server.ts` (package.json). Depends on `ws` `^8.18.0`.
- **Server-authoritative simulation** — one `Room` per game mode (`server.ts:50`), each running the SAME deterministic `World.step` the client runs, at 30 Hz (`TICK = 1/30`, `server.ts:26`), broadcasting snapshots at 15 Hz (`SNAP_EVERY = 2`, `:27`). An accumulator tick loop (`:115`) prevents time dilation from GC/event-loop stalls.
- **The client is a true thin puppet** — `net.ts:56` `createPuppetWorld` (server state is truth), sends `{t:'cmd'}` at ~30 Hz (`net.ts:136`), applies authoritative snapshots (`applySnapshot`, `snapshot.ts:224`), and dead-reckons/extrapolates between them (`net.ts:148` `world.step` on a `puppet:true` world).
- **Interest management / server-side anti-cheat** — `cullSnapshotFor` (`snapshot.ts:176`) builds a PER-VIEWER snapshot so "nobody's wire carries an enemy they couldn't perceive. ESP reads static" (`server.ts:210`). Cloak, smoke, mine-detector, submarine detection all gate wire visibility. This is a genuine architectural anti-cheat measure, not a stub.
- **Bots fill every room** (`server.ts:86` `fillBots`, TEAM_TARGET = 12/side), joins/leaves swap a bot out/in so the match never shrinks (`:125` `join`, `:185` `leave`), and finished matches auto-restart after 12 s (`:214`, `:220`).
- **Full comms over the wire** — chat channel relay (`server.ts:152`), team-only filtering, an offline **mailbox** delivered on next join (`:40`, `:142`), tactical waypoints relayed to teammates (`:164`), and **LSW "stable" calls** judged server-side (`:178` `callLsw` → `world.requestLsw`).
- **An operator "War Room" HTTP surface** — `GET /warroom/status` + `POST /warroom/cmd` (`server.ts:389`) for observe/end/restart/announce/kick/nudge/operation, guarded by a shared `x-warroom-key` header (`warroom.ts` helpers; `/warroom.html` is the console). permessage-deflate compression on the socket (`server.ts:433`, ~5× on snapshots).

What is NOT there (the honest caveats):
- **No matchmaking, no lobby, no server browser.** The player pastes a URL into a `server-url` text input (`main.ts:695`); `NetGame` connects to exactly that (`main.ts:747`). One fixed room per mode; you get whatever room your mode maps to.
- **No accounts / no auth / no persistence server-side.** Career (Dossier) is IndexedDB-local; the server keeps only an in-memory mailbox + a JSON campaign file (`.warroom-campaign.json`). The code itself flags "Stage-2 hardening" repeatedly (`server.ts:24`, `:320`): plain HTTP, dev-key default, wide-open CORS — "Not before [it runs public]."
- **The server self-describes as LAN-grade** — `snapshot.ts:46` "Fine for LAN play at 15Hz"; full-world JSON snapshots (quantized to 3 decimals via `wireRound`, `snapshot.ts:90`), no delta compression beyond zlib.
- **Science/military-mission modes are forced local** (`main.ts:745,758`; `server.ts:32-33` deliberately omits them from public rooms).
- **Graceful fallback**: if the socket can't be reached, the client drops to offline bots (`main.ts:750-753`).

**Verdict: single-player (offline bots) AND multiplayer both exist and share one deterministic sim. Multiplayer is a real, playable, self-hosted authoritative-server build with per-client interest culling — production-shaped but pre-hardening (no matchmaking/accounts/TLS), and self-labelled LAN-grade.**

---

## WEAPONS & ARSENAL

### The Arsenal generator — ✅ WIRED (`src/sim/arsenal.ts:94` `buildArsenal`)
Deterministic table: **16 weapon families** (`arsenal.ts:64` — pistol, rifle, carbine, smg, shotgun, slugger, laser, lmg, hmg, at_rocket, ap_rocket, mortar, artillery, scatter, sonic, flamethrower) × **4 brands** (rotating from 6 solar-system manufacturers, `:23`) × **3 Mk tiers** (SIDEGRADE curve — higher marks hit harder/tighter but shrink the mag and drag the reload, `:37`) = 192, plus 9 grenade launchers (frag/smoke/phosphorus × 3), plus 5 special/vehicle guns (demo_charge, emplacement_gun, bike_mg, flyer_plasma, transport_mg). **Measured live: 206 generated ids.**
- Merge law (`data.ts:234`): `WEAPONS = { ...buildArsenal(), ...CORE_WEAPONS, ...LSW_ARMS }` — core/LSW ids override and never change. **Measured live total: 316 WeaponDefs** (206 generated + ~92 core + LSW arms).
- Class armory gates which families each class draws from (`arsenal.ts:205` `CLASS_ARMORY`).
- **Full pipeline is wired**: stats (`arsenal.ts`/`data.ts`) → sim (`WEAPONS` consumed by `world.ts` firing) → model (`buildWeaponModel`, deterministic per id) → sound (every def carries a `sound` field: rifle/pistol/smg/shotgun/rail/autocannon/rocket/thump/cannon/impulse/flame). No weapon family is stubbed; `alt`/`fireMode`/`payload` (burst/tag/skitter/overcharge, pump/double, smoke/fire) all ride variants.

### Weapon models — ✅ WIRED (`src/client/models/weapons.ts:1`, 946 lines)
One builder per family; variation DERIVED from the id, never bespoke. Brand = proportions + palette + one physical "tell" (vents/slab/optic/drum/coil, `weapons.ts:79`); Mk dress = amber barrel bands (`:68`). Muzzle points +X, budget ≤500 tris. Deterministic per id (same gun on every client).

### The grip solver — ✅ WIRED (`src/client/models/grip.ts:1`, 226 lines)
CCD (cyclic coordinate descent) closes the RIGHT hand on the pistol grip and LEFT on the handguard using real arm-chain IK with human joint limits (`grip.ts:57`), sliding the rifle to the chest when the handguard is out of reach. Build-time only; renderer recoil/carry stay additive. (MEMORY notes "held-gun grip in-game still broken" — this solver is the fix that landed; live in-game feel not re-verified here.)

### The Codex (arsenal + bestiary browser) — ✅ WIRED & COMPLETE (`src/client/codex.ts:1`, 814 lines)
The "master sheet." **6 sections**: Vehicles, Civilian, Weapons (~316 rows, searchable), Infantry (classes), Ascendants (LSWs), Threats (zombies + Iron Eaters). ONE LAW: every number is read/derived from the sim's own tables at render time (`codex.ts:7`), pinned by `tests/codex.test.ts` against the real `World.damageVehicle`. Derived columns include shots-to-kill (simulated median over the 65/35 hull-share model, `:75` `hitsToKill`), effective HP, sustained/burst DPS, AR-rounds-to-kill an LSW. Live 3D turntable per entry (baked thumbnails + spinning model bench, `:401`), a 2–3-way compare tray with best-value highlighting (`:733`), and a **Service Net** review layer per item (`:669`). Reachable from the game menu. This is a genuinely complete, drift-proof browser.

### Weapon-cam HUD plate — ✅ WIRED (`src/client/weaponcam.ts:51`)
Bakes one offscreen render of the EXACT equipped weapon model per id, cached as a data URL; the HUD shows your real gun, not an icon.

### The Proving Grounds (range qual) — ✅ WIRED (`src/client/range.ts:45` `RangeCourse`)
6-target timed infantry qualification on the `range` mode; score curve, grade bands (Qualified→Expert), a local Wall leaderboard with percentiles, first official run written permanently to the Dossier. Regenerating dummies. Player-facing.

### The Reticle family — ✅ WIRED (`src/client/reticle.ts:29`)
Robert's "8 or 9" aim cursors: standing styles (crosshair/dot/cross/chevron/brackets/ringdot) built here; ground styles (wedge/circle/reddot) in the renderer; personal green laser (`:112`), red-dot sprite (`:91`), rangefinder state (`:12`). Fully surfaced via Settings (`settings.ts:29` — 10 styles + color/dist/scale/facing knobs).

**Open question (weapons):** none material. The generator, models, grip, codex, and sounds are all wired end-to-end. Only cosmetic gap: gadgets model file (`models/gadgets.ts`, 426 lines) not deep-read here but referenced by the deployable/mine/turret path — assumed wired via props.

---

## RENDERING PIPELINE

### `src/client/renderer.ts` — ✅ WIRED (6515 lines; the single largest client module)
Responsibilities (by method survey): full static-world build (`buildStaticWorld:1389`), per-frame `update:2662`, and `applyEvents:5873` (the event→VFX bridge). It owns:
- **Weather** (`updateWeather:655`, `buildPrecip:996`) — rain/snow/storm, tied to the sim's `WeatherState`.
- **Impact/decal FX** — goo, splat, blood smudge, blast rings, generic impacts (`spawnGoo:802`, `spawnSplat:816`, `spawnImpactFx:847`, `spawnSmudge:903`, `spawnBlastRings:918`).
- **The vision-cone darkness shader** wiring (see `darkness.ts`), sky dome + painted sky (`ensureSkyDome:1294`, `paintSky:1313`), water sheet (`buildWaterSheet:1330`).
- **Reticles** (`updateReticle:2208`, `resolveReticleStyle:2194`), melee/struggle rings + choke/break bars (`updateMeleeRings:2315`, `updateStruggleBars:2426`), autopsy line + killcam round (`updateAutopsyLine:2490`, `updateKillcamRound:2542`).
- **Unit tags / name sprites / minimap ring** (`makeUnitTag:2560`, `makeNameSprite:2593`, `makeRingMap:2619`).
- **Vehicle placement preview** — the "ghost board" for building/deploying hulls (`setGhostBoard:2631`, `moveGhost:2653`).
- **Soldier animation** (`animateSoldier:5077`), **LSW/Ascendant presentation** — aura, ice-encase block, blink ghosts, pose (`lswAura:4633`, `updateIceBlock:4919`, `spawnBlinkGhost:5058`, `setLswPose:5027`).
- **Projectiles/tracers** (`makeProjectile:5677`), grenade-throw arc + landing-ring preview (`setGrenadePreview:5804`), in-game **Vanessa's shop dressing** (`dressVanessasShop:1044`) and **paintball-yard dressing** (`dressPaintballYard:1148`).
- **Destruction**: breach piles + tile collapse (`breachPile:551`, `collapseTile:575`).
- Exposes `stats():639` (draw calls/tris/geo/tex) consumed by THE BOARD.
No half-built/stubbed visual systems found (no TODO/FIXME/placeholder markers in the class). The `'shell'` tracer comment (`:5726`) is a real branch, not a stub.

### Supporting render modules — ✅ WIRED
- `models/soldiers.ts` (1400), `models/vehicles.ts` (1376), `models/props.ts` (591) — procedural low-poly builders; `buildSoldier`/`buildVehicle` are shared by the codex bench and the game.
- `animation.ts` (326) — shared `poseSoldierJoints`; one walk cycle for game + harness + the Vanessa idle.
- `effects.ts` (392) — pooled additive `Particles` (MAX 3000) + `StaticOverlay` (the FPV-drone whiteout used by net.ts).
- `damagetext.ts` (151) — floating "-HP" (red) / "-ARMOR" (blue) DOM overlay projected from victim heads; reads `damage` events, wired from main.ts only.
- `darkness.ts` (121) — the analytic vision-cone as a shader chunk (~6 ALU/fragment, zero extra passes); murk tightens with weather/night. Accessibility knob in Settings.
- `segmeter.ts` (57) — THE one meter grammar (amber lead-notch); the game's only meter shape by law.

---

## MULTIPLAYER / REPLAY SPINE

### Netcode — ✅ WIRED (see HEADLINE). `net.ts`, `server.ts`, `input-queue.ts`, `warroom.ts`.
- `src/server/input-queue.ts` (72) — per-client command queue (`pushCmd`/`drainCmd`): one press per tick, held-repeat when starved, stall when stale (replaces a latest-wins slot; opt #3).
- `src/server/warroom.ts` (149) — the HTTP command layer helpers (`keyOk`, `roomStatus`, `campaignSummary`, `WarroomCmd`).

### Snapshots — ✅ WIRED (`src/sim/snapshot.ts`, 308 lines)
`takeSnapshot` (`:93`) whole-object-spread wire format (`Snapshot` carries soldiers/vehicles/turrets/projectiles/pickups/mines/gadgets/pinged/smoked/dug/breached/doors/glass/weather/events). `recordSnapshot` (`:133`) = replay-grade explicit deep copies (no structuredClone, opt #19). `cullSnapshotFor` (`:176`) = per-viewer interest management. `applySnapshot` (`:224`) reconciles a puppet world incl. cumulative destruction/doors/glass. `createPuppetWorld` (`:29`) is the ONE recipe shared by multiplayer AND replay. Infinity↔-1 wire encoding, 3-decimal quantizer.

### Replay / Killcam / Highlights — ✅ WIRED (`src/client/replay.ts`, 342 lines)
A replay is a ring of timestamped snapshots played into a puppet world — same machinery as multiplayer. `ReplayRecorder` (10 Hz, 14 s ring). **The Death Cam** streams past the moment of death (slow-mo consumes footage slower than the recorder lays it, so the aftermath fills in live, `:194` `append`). A **Director's shot table** (`pickKillcamShot:73`) varies the frame by how you died — spawn-cut / wide-blast / rail-autopsy / ride-the-round / duel / vehicle-wreck, each with its own banner, camera pull, and smooth speed ramp (`killcamSpeedAt:54`). `ReplayDirector` (`:245`) drives killcam + post-match highlights for BOTH local and net loops (one implementation). No mid-fight cut for your own kills (deliberate, `:264`).

### Career recorder — ✅ WIRED (`src/client/record.ts`, 515 lines)
The **Dossier** (v2): lifetime/per-class/per-weapon stats, personal armory, quals, 8 medals, journal, an **operations career** (sorties/wins/clean-sheets/certification ladder), rank ladder (14 ranks + mono insignia). IndexedDB-persisted, 30 s crash-checkpoints, idempotent `finalize`. `MatchTracker` folds the live event stream into medals + journal + AAR views (nemesis/prey/weapon lines/moments). Advances the onboarding machine on net matches too (`net.ts:196`). Explicitly "server-sync shaped from day one" but sync not built (Stage-3).

### Black Box flight recorder — ✅ WIRED (`src/sim/blackbox.ts`, 257 lines)
Every authoritative sim self-records: 0.5 Hz time-series of per-team spread, base-pooling, and STUCK bodies (commanded-velocity-vs-actual-displacement — the statue-bug signature). Files incidents (knot/stuck) with member-by-member snapshots; readable via `__ww.blackbox('report')`. Includes an ammo-economy report (`ammoReport:216`). Diagnostic tooling that ships in the sim, deterministic + cheap.

---

## PAINTBALL & THE SHOP

### Paintball AI play-types — ✅ WIRED (`src/sim/paintball.ts`, 187 lines)
Every yard bot dealt a STYLE off its id (rusher/flanker/anchor, pure function, `:27`). Hunter objectives by personality with **sight-not-sonar** chasing (the pack converges on the team's last-seen mark; break LOS in the maze and after 6 s they lose the trail, `:45`). Prey brain commits to unguarded pads or evades to stretch the pack (`:112`). Overhead **barks** (start/splat/taunt) as positioned announces (`:160`), proximity taunts within 14u (`:172`) — personas speak their own script, anonymous bots borrow the style table. (VO generation is a separate workstream — these are the scripts.)

### The Field Record — ✅ WIRED (`src/client/fieldrecord.ts`, 250 lines)
The paintball card, kept OUT of the war Dossier by design. Tracks outnumbered splits (1v1…1v5+), off-the-break splats, clutches, clock-outs, longest splat, pod spills, paint thrown, **the Gauntlet ladder** (rung N = you vs a pack of N; two losses ends a run, `advanceGauntlet:89`). Fed by the shared event stream, localStorage-persisted.

### The Honors (trophies) — ✅ WIRED (`src/client/trophies.ts`, 153 lines)
Circulating single-holder artifacts with append-only lineage: **Yard Cup** (series honor, changes hands at the whistle), **Longball Belt** (distance honor, transfers mid-match on a record splat, `checkBelt:87`), **House Score** (Gallery record). Law 4 enforced — you never lose an honor off-screen. `settleCup:122` handles vacant/defend/take/lose.

### Vanessa's Pro Shop — ✅ WIRED, and TWICE
- **Standalone page** `/vanessas.html` (`src/client/vanessas.ts`, 278) — a warm walkable shop: 4 booths each showing the arsenal's REAL marker model over LIVE stats from `WEAPONS`; Vanessa is the game's own soldier body with the game's idle gait; TAKE writes `st.marker` through the same onboarding store the yard deploys from ("wired, not a mock").
- **In-game walkable interior** `src/client/vanessas-place.ts` (225) — a real sealed `GameMap` under the war camera (the "amusement-park law"): walk-up stations, E opens comic-lettered `dialogue.ts` conversations, "take it to the yard" writes the same `st.marker`. Furniture is sim-solid.
- `vanessas-stock.ts` (68) — the SHOP'S TRUTH kept apart for the test suite; 4 markers (Blitz/Pump/Scatter/Lobber), each with a booth, pitch, Vanessa line, and NO-purple paint; card stats read live from `WEAPONS`.

---

## TELEMETRY

### THE BOARD (the desk under the TV) — ✅ WIRED (`src/client/board.ts`, 246 lines)
Cinemascope 2.28:1 aspect law defended in the header. Four columns, all DERIVED (owns no truth): **THE RECKONING** (hardest blow / best defence / longest kill / deadliest / best run / toughest / deadeye / the match), **THE FIGHTERS** (click-to-rank table), **THE ENGINE** (fps + 1%-low + sim/draw ms + draw calls/tris/geo/tex + body/hull counts + event rate + picture aspect, all from `renderer.stats()` + a frame-time window), **THE FEED** (rolling killfeed). Built once per session; painted at 5 Hz. On by default on desktop, off on touch.

### The Combat Ledger — ✅ WIRED (`src/client/ledger.ts`, 276 lines)
The accountant behind THE BOARD. Reads the event stream once/tick, FOLDS multi-pellet/plate+flesh hits into whole "attacks" per attacker+victim+weapon, ranks hardest blow / longest kill / streaks / accuracy (connections-over-rounds) / a defence formula (soaked-per-life + blocks). Read-only by construction ("can be wrong about nothing"). Names outlive deleted bodies.

### Field Record / Trophies — see Paintball (also telemetry-shaped, localStorage-persisted).

---

## DEV LABS (internal tooling — confirmed NOT shipped player features)

All of these are **separate `/*.html` Vite entry points** (`vite.config.ts:63` rollup inputs) — dev benches, not reachable from the game menu:

- `stylelab.ts` → `/style.html` — the papercraft-soldier body experiment (👻 internal).
- `bodylab.ts` → `/bodylab.html` — Robert's live body-decision bench (capsule-vs-papercraft) (👻 internal).
- `beamlab.ts` → `/beams.html` — continuous-beam weapon harness (hose/wave-cannon/heat/flamer) (👻 internal).
- `armorysheet.ts` → `/armory.html` — every weapon family × brand × mark contact sheet (👻 internal; the weapons verification ritual).
- `propsheet.ts` → `/props.html` — every prop on its footprint next to a 1.8u soldier (👻 internal).
- `fxsheet.ts` → `/fx.html` — the explosion on a bench at real radii; `window.__fx.boom()` (👻 internal).
- `ui-gallery.ts` → `/ui-gallery.html` — Robert's HUD decision sheet from the real modules (👻 internal).
- `admin.ts` → `/admin.html` — THE ADMIN ROOM: dev knobs behind a plaintext door BY DESIGN ("admin/Galactic", replaced when accounts land); first knob is the clock scrub (👻 internal/operator).
- (`warroom.html`, `harness.html`, `instruments.html`, `beams.html`, `vehicle-sheet.html`, etc. are likewise dev/operator pages.)

**Exceptions — these three are wired into the LIVE game via `main.ts`, so bucket them as features/testing-in-game, not benches:**
- `godmode.ts` → 🟡 in-game **testing harness**: `initGodMode` imported at `main.ts:22`; backtick toggles a panel to WEAR any LSW instantly (no faction/one-per-team rules), untouchable, to watch the AI. Dev tool, but present in the shipped client.
- `ringdrill.ts` → ✅ **PLAYER feature**: `RingDrill` imported at `main.ts:71` — the "READ THE RING" 30-second boot-camp station in the paintball flow.
- `gallerydrill.ts` → ✅ **PLAYER feature**: `GalleryDrill` imported at `main.ts:76` — THE GALLERY target range (pop-ups + a second target game), COMPETITIVE-ARC §6; feeds the House Score honor.

---

## MISC CLIENT

- `reviews.ts` (257) — ✅ WIRED. THE SERVICE NET behind the Codex: 1–5 stars, premade phrases (the spam armor), one filing/item/print + cooldown, reviewer PRINT CARDs. "Other people" are deterministic synthetic reviews seeded per item from the bot callsign pool; your review is real + local + listed first. Server-shaped schema, sync not built.
- `chat.ts` (257) — ✅ WIRED. Channels, F1–F8 macros, `/join`/`/leave` custom channels, offline mailbox. `onSend`/`onMail` are rerouted through the server socket when online (`net.ts:59`).
- `dialogue.ts` (95) — ✅ WIRED. The RPG conversation layer (#124): comic-panel bubble, Yes/No node map, 1–9 keyed choices, `act`/`next`/close. Drives the Vanessa shop conversations.
- `classvo.ts` (173) — ✅ WIRED. Class-voice dispatcher: hangs ~186 catalogued mortal-class barks (intros/kills/CTF/down/up/abilities) off existing SimEvents + local player state. Purely client-side, no sim/RNG contact. (MEMORY noted these packs merged but "intros/abilities/CTF/revive still need renderer wiring" — this dispatcher is that wiring; live-verify not done here.)
- `touch.ts` (221) — ✅ WIRED. Twin-stick touch layer riding the gamepad rails; dynamic sticks; the sim never learns a finger exists. Mounted when `isTouchDevice()` (`main.ts:717`).
- `settings.ts` (153) — ✅ WIRED. Master volume, reduced motion, quality tier, HUD opacity, blood (off/light/full), darkness (off/subtle/full), reticle family (10 styles + color/dist/scale/facing), personal laser, and live FEEL knobs (projectile/vehicle/move speed with a generation-bump reseed), full controller config (deadzone/sensitivity/invert). localStorage-persisted, tolerant loader.
- `segmeter.ts` (57), `darkness.ts` (121), `animation.ts`, `effects.ts`, `damagetext.ts` — covered under Rendering; all ✅ WIRED.

---

## COUNTS

- **✅ WIRED:** ~34 systems (netcode server+client, arsenal generator, weapon models, grip solver, Codex, weapon-cam, range qual, reticles, renderer, soldiers/vehicles/props/animation/effects/damagetext/darkness/segmeter, snapshots, replay/killcam, career recorder, black box, paintball AI, field record, trophies, Vanessa's shop ×2 + stock, THE BOARD, ledger, ringdrill, gallerydrill, reviews, chat, dialogue, classvo, touch, settings)
- **🟡 PARTIAL:** 2 — godmode (in-game dev tool, not a player feature); multiplayer as a *product* (real netcode, but no matchmaking/accounts/hardening — the sim spine is complete, the service layer is not).
- **👻 INVISIBLE (internal benches):** 8 dev-lab HTML entry points (stylelab, bodylab, beamlab, armorysheet, propsheet, fxsheet, ui-gallery, admin).
- **⬜ UNBUILT:** 0 in this slice — everything named has real code. The only true absences are LAYERS on top of built systems: server-side accounts/persistence/matchmaking, and Dossier/reviews server sync (both explicitly deferred to "Stage-2/3" in-code).

---

## TOP 5 GAPS IN THIS SLICE

1. **MULTIPLAYER SERVICE LAYER (not the netcode) is the #1 gap.** The hard part — authoritative deterministic sim, per-client interest culling, input queue, room lifecycle, comms — is DONE and working. What's missing is everything around it: no matchmaking/lobby/server browser (you paste a URL), no accounts/auth, no TLS, dev-key-by-default admin over plain HTTP, wide-open CORS, in-memory-only server state, and full-world JSON snapshots self-labelled "LAN-grade." This is a genuinely multiplayer game that is not yet a hostable multiplayer *service*.
2. **No cross-device / server-side career.** Dossier (`record.ts`), Field Record, Trophies, Reviews are all local (IndexedDB/localStorage), explicitly "server-sync shaped" but with no sync built. A player's rank, medals, honors, and reviews live on one browser.
3. **In-game grip / class-VO / LSW-presentation are wired but not live-verified in this audit.** The grip solver (`grip.ts`), the classvo dispatcher (`classvo.ts`), and the renderer's LSW aura/ice/blink all have complete code, but MEMORY carries prior "grip still broken" / "abilities still need wiring" notes — worth a live-match visual verification pass (Playwright, per house convention) rather than trusting the code read alone.
4. **`godmode` ships in the live client.** A backtick-key panel that makes you an untouchable any-LSW god is a testing harness imported into `main.ts:22` — fine for dev, but it needs a build-flag/admin gate before any public/online exposure (it currently bypasses faction/one-per-team/no-humans-on-fliers rules).
5. **Paintball VO is scripts-only.** `paintball.ts`/`personas` define what every play-type SAYS (barks, taunts) but the generated-speech pass is a separate unbuilt workstream — the yard currently shows the words as overhead text without voice.

## OPEN DESIGN QUESTIONS (real forks only)

- **Multiplayer product shape:** does War World ship as (a) a self-host/LAN build (the current honest state — no accounts, paste-a-URL), or (b) a hosted service (needs matchmaking + accounts (#83) + hardening + delta-compressed snapshots)? Every deferred item in this slice hangs off that decision.
- **One career or two ledgers, synced?** The Dossier (war) and Field Record (yard) are deliberately separate local books. If accounts arrive, do they sync as one identity, and does the yard's Cup/Belt lineage go global (shared shelf) or stay per-player? `trophies.ts:120` flags "personas arrive in Wave 3" as the trigger.
- **Snapshot scaling:** full-world JSON at 15 Hz is fine for ≤24 bodies on LAN; a public server with many rooms/players will need delta snapshots or a binary wire. Not a fork today, but the first thing that breaks past LAN scale.
