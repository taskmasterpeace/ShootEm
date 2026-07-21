# STATUS — everything asked for, done vs not
### The honest ledger. Robert: "I need to find out what's not been completed. That's the most important thing." Last swept 2026-07-20 against the code + the two ground-truth audits this session.

**Legend:** ✅ SHIPPED · 🔨 PARTIAL (substrate exists, the ask isn't finished) · ❌ NOT DONE · 📋 DESIGNED (a spec is written, no code yet) · 🎯 DECISION (a call only Robert makes)

**Where it's tracked:** `BACKLOG` = a wave in `docs/MASTER-BACKLOG.md` · `#N` = GitHub issue · `PLAN` = a doc under `docs/superpowers/plans/`.

---

## THE ROAD TO ZERO — the resolution plan (added 2026-07-20)

The plan that resolves 100% of this ledger. Eight campaigns, dependency-ordered; each is a `/loop` diet of `docs/MASTER-BACKLOG.md` items with the gates + proof ritual baked in. **Run order matters** — early campaigns are substrate for later ones.

| # | Campaign | What it clears | Board items | Rough size |
|---|---|---|---|---|
| C1 | **SIGHT** | the visibility rewrite: per-viewer bodies, hold-then-fade marks, the dark, house LOS, 3 bugs | W0.1-0.2, [#43-46](https://github.com/taskmasterpeace/ShootEm/issues) | 2-3 sessions |
| C2 | **UI P0** | every shipped-system-with-no-readout in `docs/UI-MASTER.md` P0 (hover bug, grenade pips, downed experience, missile lock, struggle, protection, LSW drop) | UI-MASTER §13,3,2,8,6,5,7 | 2-3 sessions |
| C3 | **COMBAT FEEL** | accuracy ladder + aim ring + falloff + spacebar verbs + ragdoll fix + tank rock + Impact Charge ring | W1.1-1.7, UI-MASTER §4 | 3-4 sessions |
| C4 | **STEEL + OUTBREAK Phase 1** | melee triangle (locked terms) + infection component + corpse lifecycle + fire/neutralization + Ball/AP/INC ammo + dropped weapons + ammo diagnostics→cut | W0.3/#47, 10.11, W2.4, 10.4, 10.5, W7.3 | 4-6 sessions |
| C5 | **THE DEATH SHOW + AIR** | death-cam director, gore, kill cam + aircraft crash, altitude legibility (sonic boom lands here), AA bands, drive-by, seat yield, rearm pads | W2.1-2.5, W5.1-5.6, 10.7, 10.8, UI-MASTER §8 | 4-5 sessions |
| C6 | **THE WAR** | time-skip deletion, 3×3 board, clone economy, pass escalation, science missions v1, leaders, class-change, bots-as-robots, rank, press (AI paper + TV) | W3.1-3.10, W4.1-4.3 | 6-8 sessions |
| C7 | **THE SOLDIER + WORLD** | papercraft port (4 moves), SURF fold, slick ice, impact VFX, weapon-family holds, fire modes + brand mechanics + armed gods + beams/clash | W6, W7.1-7.4, 10.1, 10.2, 10.6 | 5-7 sessions |
| C8 | **PERF + NET + POLISH** | remaining audit issues [#2-#42] in board order (bench-tracked per fix), multiplayer staged stack, UI P1/P2 + all ✦ delights, memorable details W9 | 8.1-8.2, 10.10, W9, UI-MASTER P1-P2 | ongoing |

**The loop line:** `/loop` work `docs/MASTER-BACKLOG.md` campaign-by-campaign in the order above; per item: gates (tsc/vitest/lint/build) → on-screen proof in `docs/reference/` → bench-track if perf → check the box with the commit hash → update THIS ledger's row. A campaign is done when its every row here reads ✅.
**Standing rules:** decisions on the desk stay Robert's · no purple · marks are sidegrades · push on ask.

---

## THE SHORT LIST — what you asked for that is NOT done

If you read one thing, read this. Everything below has a full row further down.

**Combat feel:** ✅ **THE WHOLE §1 SECTION IS GREEN (2026-07-21)** — aim ring · accuracy-by-movement · ballistic falloff · tap-jump/hold-duck · tank hull wobble · ragdoll-threshold-everywhere (grass-conceal + duck-behind-cover already shipped).
**The death show:** a killer-facing kill-cam reward (replay is victim-only). *(DONE 2026-07-21: corpses lingering 20–30s both outbreak + non-outbreak · the death-cam director varies the shot by death — spawn-cut / the-wide / autopsy / ride-the-round / duel · gore/gibs on violent deaths.)*
**Sight (you just approved the fix):** 3D-shows-you / minimap-shows-team · darkness outside your cone. *(Fixed 2026-07-21: the three fog BUGS — fishbowl #43, corpses #44, vehicles #45 — plus upstairs-vs-upstairs house LOS and **contacts now hold-then-fade instead of blinking** on both the 3D view and the minimap.)*
**Melee:** STRIKE / GUARD / GRAPPLE + Impact Charge + the Control Struggle (terminology now LAW per the outbreak spec; the swing engine exists, wired only to zombie claws).
**The outbreak (new spec, §17):** infection/viral load ✅ · corpse lifecycle & reanimation ✅ · outbreak pressure/levels ✅ · emergent variants ✅ · ammo TYPES (Ball/AP/Incendiary) ✅ — all SHIPPED 2026-07-20, live in horde/survival/safehouse. Still design: zombies as a third faction mid-war · flashlight interiors · Bite Struggle · mixed magazines.
**The war:** the 3×3 board · killing the time-skip · the clone economy · pass escalation · **science missions** (now fully designed) · class-change requests · the two faction leaders · bots looking like robots.
**The press:** AI-generated newspaper · the base TV newscast · the unnamed-soldier fiction.
**Air & armor:** aircraft can't crash · no map wraparound · **planes don't read as high enough** (no shadow, HIGH sits below rooftops) · drive-by shooting · cars that handle like cars · seat-yield · rearm pads.
**Weapons:** fire modes (single/auto/burst/**double-barrel**/pump) · per-family secondary fire · brand signature mechanics · and the Codex columns for all of it.
**Beams:** continuous/held beams · **beam-vs-beam clash** · beam birth effects · the seven beam types.
**Armed gods:** bow · spear · recall axe · summoners.
**Multiplayer:** the whole server/netcode stack (the sim is built for it; nothing is wired).
**Ammo:** the diagnostics pass, then the 25% cut.
**Optimization:** 42 findings, [issues #1–#42](https://github.com/taskmasterpeace/ShootEm/issues) — none started.

---

## 1 · COMBAT FEEL

| Ask | Status | Evidence / where |
|---|---|---|
| Aim ring orbiting the character, showing facing + accuracy bloom | ✅ | **DONE 2026-07-21.** A faint amber orbit ring + a two-arm WEDGE on the local player that points where you aim and OPENS with the live cone — it tightens crouched/still and sprays sprinting/airborne, reading out the accuracy-by-movement the sim applies. `renderer.ts` `aimRing`/`buildAimRing`; live-verified (neutral half-angle 0.15rad, faces aim, amber). BACKLOG W1.2 |
| Accuracy varies by movement (crouch/still/walk/sprint/airborne/vehicle) | ✅ | **DONE 2026-07-21.** `aimSpreadMul` (world.ts) bends the weapon cone by stance at the fire site: crouch ×0.7 (braced), still/walking ×1 (neutral), sprint ×1.7, airborne ×2.1. `tests/aim-spread.test.ts` (6). Neutral kept ×1 so the threat-measure balance arena is untouched. Vehicle-mounted fire rides the separate turret-spread path (not stance-based). BACKLOG W1.1 |
| Ballistic falloff (bullets tire; lasers exempt) | ✅ | **DONE 2026-07-21.** `ballisticFalloff` (world.ts) tapers a bullet/shell round's damage past `max(range·0.55, 42u)` down to `FALLOFF_FLOOR` (60%) at max range — energy weapons (rail/beam/plasma) exempt. Full damage inside 42u so close/mid fights (and the threat-measure arena) are untouched; only the long shot pays. `tests/falloff.test.ts` (5, incl. far-hit < near-hit). BACKLOG W1.4 |
| Tap space = jump, hold = duck | ✅ | **DONE 2026-07-21.** SPACE is a tap/hold for ground classes: a quick tap (<180ms) jumps on release, a longer hold ducks (no accidental hop, and no more bunny-hop from held-jump). Jetpack + ascended bodies keep space as held thrust/flight, duck stays on C. Pure `resolveSpace` (`input.ts`), `tests/space-input.test.ts` (3); live-verified (tap → y1.06 jump, hold → crouch). BACKLOG W1.3 |
| Ragdoll threshold applied at every knockback site | ✅ | **DONE 2026-07-21.** Extracted `maybeRagdoll(s, applied)` as the one shared gate (threshold, god/encased exemptions, extend-not-shorten, single event) and wired it into the **shockwave/Titan slam** (was shove-only) alongside `explode()` (mech stomp routes through explode). Self-movement (dash/roll/pad/lunge) and sustained force-fields deliberately excluded — impulse hits only. `tests/ragdoll.test.ts` (3). BACKLOG W1.5 |
| Tank hull wobble/settle on cannon fire | ✅ | **DONE 2026-07-21.** On the cannon's recoil signal the whole hull now PITCHES up and settles in a quick damped wobble (`env = e^-7t·cos(26t)`, ±0.09rad), on top of the existing barrel kick — tanks only, YXZ local pitch. `renderer.ts` (vehicle loop). Live-verified: pitch swings −0.046→−0.09rad under fire, flat at rest. BACKLOG W1.6 |
| Grass concealment (hide in tall grass, deeper when ducked) | ✅ | `perception.ts:95-101`, bots respect it |
| Duck behind cover / in grass | ✅ | crouch stance on C, sinks below grass line |

## 2 · THE DEATH SHOW

| Ask | Status | Evidence / where |
|---|---|---|
| Death-cam **director** — different shot per death (bullet path / autopsy / wide / spawn-cut) | ✅ | **DONE 2026-07-21.** `pickKillcamShot` (replay.ts) frames the death by HOW it happened — **SPAWN CUT** (brisk, cam 16), **THE WIDE** (a blast pulled back, cam 22), **AUTOPSY** (precision rail/beam from range, tight cam 12), **RIDE THE ROUND** (a long bullet, cam 15), or the straight **DUEL** — each with its own banner, camera pull, and tempo. `tests/killcam-shot.test.ts` (5); live-verified (spawn-cut + the-wide seen in a match). BACKLOG W2.1 |
| Deaths differ by weapon in the **animation** (fire collapse, laser drop-straight, melee spin) | ✅ | **DONE 2026-07-21.** The ragdoll reads the killing weapon (`Soldier.lastKillWeapon`) → `collapseStyleFor`: a beam/rail drops you STRAIGHT (little tip, fast crumple), fire makes you WRITHE (thrashing limbs), a melee blow SPINS you down (yaw), else the default topple. `src/client/deathpose.ts` + `renderer.ts` collapse; `tests/deathpose.test.ts` (4); live-verified (rg2→straight, knife→spin, ar606→default). BACKLOG W2.2 |
| Gore / gibs on overkill + explosives | ✅ | **DONE 2026-07-21.** A VIOLENT death (splash weapon, or a ≥40-dmg overkill round) now throws chunky flesh GIBS (heavy, arcing, long-lived) + a wetter mist + a wider pool over the base splash, keyed off the death event's `weaponId`. Gated on `settings.blood` so reduced-gore players never see it. `renderer.ts` death case; live-verified: a GL death emits 29 particles vs a rifle's 12. BACKLOG W2.3 |
| Corpses linger 20–30s (a fought-on battlefield) | ✅ | **DONE 2026-07-21, both mode families.** OUTBREAK: the reanimating `world.corpses` render + linger their incubation, thrashing before they rise (§1/§6). NON-OUTBREAK (tdm/ctf): a fallen body is booked on the alive→dead edge and lingers `BATTLEFIELD_CORPSE_LINGER` (24s) decoupled from the 4s respawn, then sinks away (`renderer.ts` `battlefieldCorpses`, live-verified in CTF). Client-side, no sim change. (Minor gap: non-viral deaths inside an active outbreak still clear at ~4s.) BACKLOG W2.4 |
| A **kill** cam — reward a great kill, not just the death | ✅ | **DONE 2026-07-21 (W2.5).** Resolved as THE KILL CONFIRM — the killer's own flourish, never a screen takeover while he's alive and fighting: `✕ NAME · 47u` under the reticle (own element, the announce banner never blocked), a heavier confirm tick, streak `×n` spice, and a gold `— NEW LONGEST` when the trophy ledger moves (>20u). Sim emits `kill_confirm` addressed to the killer (humans only; zombie kills stay quiet). `tests/kill-confirm.test.ts` (3); live: `✕ DOZER2 · 47u — NEW LONGEST` in gold |
| Blood past armor, sparks off plate | ✅ | `bare` flag on hit events, `renderer.ts:3536` |

## 3 · SIGHT — the visibility rewrite (you approved this 2026-07-20)

Full spec: **`PLAN 2026-07-20-sight-and-steel.md` § A**. Measured: the game draws **8.70 enemies when you can personally see 4.84** — because vision is keyed by team, not by your eyes.

| Ask | Status | Evidence / where |
|---|---|---|
| 3D view shows what **you** see; minimap shows what your **team** sees | ✅ | **DONE 2026-07-21.** The 3D soldier draw now rides a PER-VIEWER seen trail (`renderer.localSeen`) stamped by the LOCAL eye alone via `perceivesNow([local])` — same laws (cone+ring, skyline, smoke, grass, pings, muzzle reveal; the torch rides free); the minimap keeps the sim's TEAM trail (hud untouched). Hold-then-fade applies per-viewer; while DEAD the squad's radio paints (team fallback) so the death cam still frames the killer. Live-proven in-match: spotter's contact painted the minimap while the 3D hid it (`ROW_81_PROVEN: true`), turn-and-look draws it. [#46](https://github.com/taskmasterpeace/ShootEm/issues/46) W0.2 |
| Contacts **hold then fade** — never blink/pop out | ✅ | **DONE 2026-07-21.** 3D view: the ghost FREEZES at the lost-position and dissolves over the per-class linger (`renderer.ts` ghostAlpha, `tests/visibility.test.ts` "ghosts freeze"). Minimap: hostiles no longer pop off — each holds at its last-drawn spot and fades over the same `classLinger`, then prunes at `MAX_LINGER` (`hud.ts` `minimapContacts`). Live-verified via `window.__ww.hud`. (The separate 3D-vs-team-view split stays row above.) W0.2 |
| The world outside your cone goes **dark** | ✅ | **DONE 2026-07-21** (plan A2 steps 1+2+3+5). `src/client/darkness.ts`: analytic cone via `onBeforeCompile` — zero draws/passes/uploads, ~6 ALU/fragment; SHARED uniforms (one write reaches every material); cone = the SIM's `CONE_HALF`, the 9u `RING` stays lit, `uRange` = the same `perceiveRange` fog pins to (weather closes it free); soft smoothstep murk, never a laser line. Coverage: `mat()` at creation + an idempotent scene sweep every 90 frames (GLBs/drops/corpses ride the next pass); Basic mats exempt (instruments stay readable). Setting off/subtle/full (off = classic look exactly). `tests/darkness.test.ts` (5); live: brightness 73.5→61.1→53.6 ordered by setting, cone FOLLOWS yaw (turn around → murk swaps sides, ~35-48pt asym), 0 console errors. W0.2 |
| In a house/maze, see what you can see and no more | 🔨 | ground-floor LOS good; **upstairs-vs-upstairs now obeys the UPPER walls** (2026-07-21, sight-plan A3 step 2 — `losClearUpper`/`grid2` wired into `perceivesNow`, `tests/upperlos.test.ts`). Roof-peek + the floor-plan giveaway (A3 step 4) remain. W0.3 |
| **BUG:** any second storey is a fishbowl — seen through walls by the whole enemy team | ✅ | **FIXED 2026-07-21** (sight-plan A3 step 1): the skyline rule now guards on `(s.floor ?? 0) !== 1` — a jet or jump-trooper still skylines, but an UPSTAIRS body obeys cone+LOS. `perception.ts:94`, `tests/fishbowl.test.ts`. [#43](https://github.com/taskmasterpeace/ShootEm/issues/43) |
| **BUG:** enemy corpses bypass the fog entirely | ✅ | **FIXED 2026-07-21**: local play now culls enemy corpses live against friendly eyes, the exact rule `cullSnapshotFor` already enforced. Shared `eyesSeePoint` primitive. `renderer.ts` (soldier loop), `perception.ts`. [#44](https://github.com/taskmasterpeace/ShootEm/issues/44) |
| **BUG:** enemy vehicles are never fog-culled | ✅ | **FIXED 2026-07-21**: enemy hulls now obey the same fog (burrowed/ECM/LOS parity with the culler); live-verified — a tank with no friendly eyes on it draws `visible=false`. `renderer.ts` (vehicle loop), `tests/fogcull.test.ts`. [#45](https://github.com/taskmasterpeace/ShootEm/issues/45) |

## 4 · MELEE — STRIKE, GUARD, GRAPPLE

Implementation plan: **`PLAN 2026-07-20-sight-and-steel.md` § B** · **terminology and rules now LAW per `docs/OUTBREAK-SPEC.md` §12-16** (same triangle, locked words: GUARD beats STRIKE, STRIKE beats GRAPPLE, GRAPPLE beats GUARD; charged melee = **Impact Charge**; rear grab = **Rear Control** resolved by the **Control Struggle** best-of-three; vs zombies = **Bite Struggle**). The surprise stands: the swing engine (windup, 90° arc, locked facing, stagger, lunge) **already ships** at `world.ts:2569-2619` — wired only to zombie claws.

| Ask | Status | Evidence / where |
|---|---|---|
| A real melee weapon + a melee key | 🔨 | **SHIPPED 2026-07-20**: the universal `knife` (Combat Knife, 34 dmg, 2.2u reach) is on **F** for every soldier without a returning axe — no ammo, shambler on you, you still have an answer. `tests/melee.test.ts` STRIKE block (4) |
| STRIKE (interrupts grabs, deals damage) | 🔨 | **SHIPPED 2026-07-20**: the knife STRIKE drives the existing windup→90°-arc→stagger swing (`WEAPONS.knife` → `startMelee`); shares the fire clock (no knife-and-shoot in one beat). Grab-interrupt lands with GRAPPLE. [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| GUARD (frontal arc, beats strikes) | 🔨 | **SHIPPED 2026-07-20**: held **V** raises a brace over a 150° frontal cone — a facing STRIKE lands only 12% and PARRIES (staggers + shoves the attacker off his swing: GUARD beats STRIKE); a flank/rear blow slips past. Costs stamina (~10/s, pauses regen), slows to 0.45×, lowers your gun & knife. `melee_block` event; `tests/melee.test.ts` GUARD block (5). Loses to GRAPPLE next |
| GRAPPLE → Rear Control → Control Struggle (zone vs needle, best-of-three) | 🔨 | **grab + pin + struggle SHIPPED 2026-07-20**: **Z** is a close grab that BYPASSES + drops a raised guard (*GRAPPLE beats GUARD*) and pins the target in a rooted hold; a target mid-STRIKE stuffs it (*STRIKE beats GRAPPLE*); the pinned body mashes MOVE to break early and rebounds on the grabber. `grabbed`/`grab_break` events, HUD BREAK-FREE meter, `tests/melee.test.ts` GRAPPLE block (6). **BITE STRUGGLE SHIPPED 2026-07-20** (§15.5): ~1 in 4 shamblers LATCH ON instead of clawing (`beginBiteStruggle`, id-picked so the seeded stream never shifts) — the grip gnaws Viral Load, failing to break in time is a full bite (damage + infection), mashing MOVE escapes, and a broken clinch grants brief re-grab immunity; sprinters clamp briefly, brutes clamp longer; gods/ascendants shrug it off; HUD banner reads **BITE STRUGGLE**. `tests/melee.test.ts` (7). **REAR TAKEDOWN SHIPPED 2026-07-21** (§14.2): once you hold a rear pin, a SECOND Z commits the finisher — a heavy armour-piercing EXECUTION (overkill, so the body drops for good instead of crawling; credited as a knife kill → the melee-spin collapse). The pin's recover delay gives the victim a struggle window; gods are exempt (`maybeRagdoll`-style gate); `takedown` event; `world.maybeGrab`/grapple block, `tests/takedown.test.ts` (2). REMAINING (📋): the PvP **Control Struggle** needle-vs-zone best-of-three minigame (§15) + the rest of the outcome menu (choke/disarm/throw/human-shield). [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| Impact Charge (wind-up → charged → maximum → overcharged, meter NEAR the action) | 🔨 | **SHIPPED 2026-07-20**: **hold F** winds up the knife STRIKE, release commits — bands 0-30% quick (×1) / 31-70% heavy (×1.6) / 71-100% MAXIMUM (×2.4) / overhold = FUMBLE (×1.2) + stamina bleed (`meleeCharge`/`meleeChargeMul`, `chargeMult()`); charge pauses regen, harder blows lunge further; HUD `⚔ IMPACT ▮▮▮▯▯` meter on the action line. `tests/melee.test.ts` Impact Charge (3). A tap is still an instant quick strike |
| See it — the swing animation reads | 🔨 | slash ring VFX + the "slam"/"thrust" curves exist but are gated to gods/zeds. [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |

## 5 · HUD

| Ask | Status | Evidence / where |
|---|---|---|
| Health / armor / integrity meters | ✅ | `hud.ts:122-163` |
| Energy meter + weapon-recharge (soldier) | ✅ | reload bar + stamina/energy arc |
| **Vehicle** weapon recharge (see when the gun's ready) | ✅ | **shipped this session** (WPN cycle bar, `hud.ts`) |
| Crew dots per seat + walk-up occupancy | ✅ | `hud.ts:209-226` |
| Right-click command wheel (order bots) | ❌ | RMB is alt-fire; no order path. BACKLOG (E1) |
| Rank insignia visible in match | ✅ | **DONE 2026-07-21 (W3.9).** `#rank-chip` rides the in-match vitals row: insignia in the mono vocabulary (`rankInsignia` — Private wears the dot, enlisted chevrons ▴×1-6, senior NCO ◆+chevrons, officers ▮×1-5; all 14 distinct) + the rank name, amber glyphs on steel text, set from the dossier at boot. `tests/rank-insignia.test.ts` (3); live: `· PRIVATE` in the vitals row beside EN/viral |
| Altitude band readout when flying | ✅ | **SHIPPED (B2, row was stale).** The vehicle line reads `ALT ▁▂▅█ n/3` + the band-2/3 `— SAM-only sky` sanctuary reminder (`hud.ts` ~257). Live-verified in-match: `ALT ▅ 2/3 — SAM-only sky` |

## 6 · AIR & ARMOR

| Ask | Status | Evidence / where |
|---|---|---|
| Q/E discrete altitude bands | ✅ | `world.ts:1970-1995` |
| Afterburner · belly MG · missiles faster than planes | ✅ | J1, `world.ts:3502` |
| Helicopters (band-2 flyer) | ✅ | the Kestrel |
| Flares vs heat-seekers | ✅ | `world.ts:2820`, bots pop them too |
| Hoverboard drift / slip | ✅ | `world.ts:3526` |
| Death frees the vehicle seat | ✅ | `world.ts:4409` |
| **Planes read as HIGH enough** | ✅ | **SHIPPED (B2 trio, row was stale):** the SHADOW ALTIMETER (`89e717c` — fixed-wing hulls cast a ground blob that grows+fades with altitude; the hovering Kestrel exempt by design), the CLOUD SHELF (`a0cbe12` — band 3 flies IN the clouds), and REAL ALTITUDE (`472d864` — sanctuary law + `BAND_ALT [0.12, 2.0, 8.6, 14.0]`: band 2 renders *above* the 8.15 rooftops, band 3 at 14). The old diagnosis (no shadow / no parallax / HIGH below rooftops) is fully answered |
| Aircraft can crash into terrain/buildings | ✅ | **DONE 2026-07-21 (W5.1).** THE SKYLINE IS REAL: at band 1 (~2u) a hull that meets building fabric (walls/slits/doors/metal — `buildingAt`) takes speed-scaled damage (12 + spd×2.2, one scrape per 0.5s) and is REBUFFED, never ghosting through; band 2+ soars the sanctuary (BAND_ALT clears rooftops); deck keeps the taxi pass. Cover/climb sit under the low-flight deck. `tests/crash.test.ts` (2); live: band-1 jet into a wall hp 62→42, passed=false |
| Map wraparound for aircraft | ✅ | **DONE 2026-07-21 (W5.2).** An AIRBORNE flyer (band ≥ 1) crossing the border comes out the far side — attack runs re-enter instead of grinding the fence; the deck and every ground hull keep the clamp. Seam distances don't wrap (a SAM reads the long way round — documented price). `tests/crash.test.ts` (+2); live: trail 140→144→**−149**→−142 (east fence → west sky) |
| Drive-by shooting (personal weapon from a seat) | ✅ | **DONE 2026-07-21 (W5.4).** A PASSENGER (seat > 0) fires his OWN gun from the seat — clip/rof/reload/§11 ammo riders via the shared `fireSoldierWeapon` + pool-aware `finishReload` (extracted, one law both paths); his own aim; slot switching works. The driver's hands stay on the wheel; mounted-gun seats unchanged; band-2+ airframes too high to lean out of; no knife lunges/charge rifles from a seat; friendly rounds can't bite the carrying hull. `tests/driveby.test.ts` (3); live: shotgun seat clip 30→24, rounds in flight, hull untouched |
| Cars handle like cars / handbrake | ✅ | **DONE 2026-07-21 (W5.5).** The wheeled runabouts ride the slip dial: buggy 2.4 · bike 2.0 (slides furthest) · transport 3.4 (grip wins fast); momentum carries through a hard turn. **SPACE is the HANDBRAKE** (human drivers, slip hulls): rear grip breaks (lateral survives 3×), the nose whips (turn ×1.6), the engine drags (×0.5). Tracks stay on rails — a tank corners like a tank ON PURPOSE. `tests/handling.test.ts` (3), hoverboard suite updated to the new law (the board keeps its crown). Live: plain turn 0.445 rad vs handbrake 1.043 rad |
| Seat-yield (bot gives up its seat to a human) | ✅ | **DONE 2026-07-21 (W5.6).** A FULL hull makes room for a human — the rear-most bot steps out; the wheel yields LAST ("move over, I'm driving"); seated humans are never touched. `tests/seats.test.ts`; live: full buggy → bench bot yielded, bot driver kept the wheel |
| Diegetic per-hatch entry | ✅ | **DONE 2026-07-21 (W5.6).** A human's seat follows the hatch they walked to: the NOSE takes the wheel, the TAIL takes a bench (the wheel from behind only when it's the last seat). Bots keep the classic first-free pick — a convoy needs drivers. `tests/seats.test.ts` (4); live: tail-hatch E → seat 1, wheel left open |
| **Rearm pads** (a place to reload, turrets ringed around it) | 📋 | designed this session; base becomes clone-bay + hangars + rearm pad + turret ring. BACKLOG (new) |

## 7 · THE WAR

Full law: **`docs/WAR.md`**. Almost all of it is 📋 DESIGN — the substrate (ten-front living campaign, materiel purse, LSW rosters) ships, but the solo-war shape does not.

| Ask | Status | Evidence / where |
|---|---|---|
| Enlist once; 3×3 board (three fronts × three passes) | ❌ | ships as a flat ten-front campaign. BACKLOG W3.2 |
| Kill the time-skip (war only moves while you play) | ✅ | **DONE 2026-07-21 (W3.1).** `simulateTimeSkip` is DEAD (deleted, not bypassed) — boot now calls `holdTheLine`: after >1h away it writes ONE honest line ("the fronts HELD. The war only moves while you fight", `simulated:false` because it's TRUE) and touches no front. Your last map is exactly the map. `tests/campaign.test.ts` rewritten to pin the new law (a month away changes NOTHING); live: 48h rewind + reboot → the held line, fronts intact |
| Clones are the currency (per-front reserves, front lost at zero) | ✅ | **DONE 2026-07-21 (W3.3).** Every front carries a CLONE RESERVE (`400 × importance`); your side's deaths in a battle there SPEND it (`applyResult` gains `deaths` — main.ts passes the AAR's count); a win convoys +60 back (never past the seed); crossing 25% fires a `reserves CRITICAL` dispatch; **at ZERO the front is LOST outright** (control → −100, "the vats stand empty") whatever the scoreboard said. Armistice refills the theatre; old saves migrate to full vats (client + server loaders). `tests/campaign.test.ts` (+2); live: stripped-save boot → all 10 fronts seeded by the importance math, original save restored |
| Pass escalation (P1 no gods → P2 enemy gods → P3 both) | ✅ | **DONE 2026-07-21 (W3.4).** `FrontState.pass` (1-3): every battle digs the front one pass deeper with escalation dispatch lines ("their stable is awake" / "both stables are loose"); the armistice calms it back to P1. The gate lives at `requestLsw` — the ONE door every god walks through (human calls + the bot officer): P1 refuses both stables, P2 only team 1 answers (the war escalates AT you first), P3/absent = today's behavior (quick matches unaffected). Deploy passes the front's pass via `WorldOptions.lswPass`. `tests/pass-gate.test.ts` (3) + campaign advance test; live: P1 locked, P3 open, quick-match at pass 3 |
| **Science missions** | ❌📋 | **now fully designed** — `docs/SCIENCE-MISSIONS.md` (10 verbs × 10 sites × 50 effects). BACKLOG W3.5 |
| Class change by request (leader AI rules on it) | ✅ | **DONE 2026-07-21 (W3.6).** A class is a POSTING: `ruleOnClassRequest` (src/sim/officer.ts, pure+deterministic) weighs the LIVE roster — infantry always signed, medics 1-per-5, one wrench per trench, recon capped, heavy 2-per-4 — and rules in the officer's voice ("REQUEST APPROVED — MEDIC. Keep them standing." / "DENIED — the line has medics enough. Hold your post."). Wired inside `redeployAs` (the death re-select rack): denial keeps your posting, the banner says why; re-clicking your current class is never a request. `tests/officer.test.ts` (4); live: the officer spoke on the banner in-match |
| Two authored faction leaders (voiced) | ❌ | no leader entity. BACKLOG W3.7 |
| Bots look like robots (chrome, subordinate) | ✅ | **DONE 2026-07-21 (W3.8).** `chromeBody` in `buildSoldier`: a bot body steels — color pulled to gunmetal, metalness ≥0.85, roughness ≤0.35 — same silhouette/rig/team tint. **The ANDROID law:** the UF face plate (exact skin tone) is exempt so faction identity (visual.test.ts, "UF shows a face") survives — their machines are androids: a human face on a chrome chassis. `tests/robot-look.test.ts` (3); live: bot avg metal 0.85 vs human 0.15 |
| Iron Eaters finished (weaver/ravager signatures, named, in Codex) | 🔨 | roster exists, half the behaviors + naming missing. Codex THREATS now lists them ✅. BACKLOG W3.10 |
| Underfunded-victory + morale banking | ✅ | B1, `world.ts:458` |

## 8 · THE PRESS

| Ask | Status | Evidence / where |
|---|---|---|
| The Front Courier newspaper | ✅ | HTML edition + archive (`newspaper.ts`) |
| **AI-generated** newspaper image per war-front change | ❌ | no image hook; HTML stays the fallback. BACKLOG W4.1 · 🎯 which image API |
| Base TV newscast (~25s, anchor VO + ticker, before deploy) | ❌ | no TV substrate. BACKLOG W4.2 |
| Corrections box (the paper corrects itself) | ✅ | **DONE 2026-07-21 (W4.3).** Each edition runs ONE small retraction about the PREVIOUS issue — grounded in its actual data (the re-measured brag shot, the ace demanding +1, the quartermaster's "it remains impossible," the flip-flopping front, or the apology for finding no errors), picked by the stable hash so the same pair always prints the same line. `correctionLine` pure; hairline-rule italic box on the page. `tests/press-corrections.test.ts` (6); live: "ACE writes to claim 7 confirmed, not the 6 we printed…" |
| **Unnamed-soldier fiction** (a serial number, not "recruiter"; TTS reads digits; naming yourself is a beat) | 📋 | designed this session. BACKLOG (new) |

## 9 · SOLDIER & WEAPON VISUALS

| Ask | Status | Evidence / where |
|---|---|---|
| Show the actual weapon on screen; swap on switch | ✅ | **shipped this session** (the armory, `models/weapons.ts`) |
| Papercraft body adopted into the game | ❌ | still only in the style lab. BACKLOG W6 |
| Named elbow joints (better strikes/holds) | ✅ | **DONE 2026-07-21 (W6.2).** The trooper's forearm pivots are named `elbowL`/`elbowR` and ride `JOINT_NAMES`; GLB bodies lack them and every pose skips gracefully (the quadruped-name contract). FIRST USE: the living STRIKE — the forearm COCKS back through the windup (+0.85) and SNAPS through on the hit (−1.05, easing home), absolute-from-rest so nothing accumulates; zeds keep their additive shoulder swing. `tests/elbow.test.ts` (3: names, rig-law geometry+pivot, bend-moves-hand-not-shoulder); live trace: cock +0.74 → snap −0.66 on a real knife swing |
| Vehicle guns read as their armament | ✅ | `models/vehicles.ts` |

## 10 · WEAPONS — the variation gap

You have 200 weapons with 200 stat lines and **one firing behavior**. That's the gap.

| Ask | Status | Evidence / where |
|---|---|---|
| Fire modes: single / auto / burst-2/3 / **double-barrel** / charge / pump | ✅ | **DONE 2026-07-21 (10.1 slice 1).** `WeaponDef.fireMode` (absent = auto): single/pump fire on the trigger EDGE (one press one round; pump's action lives in its rof), burst-2/3 spend the whole n/rof cycle up front (round 1 on press, the RUNNER delivers the rest at 3× cadence), double fires BOTH barrels and pays 2/rof; charge pre-existed. **Every mode is DPS-NEUTRAL by construction** — feel changes, balance sheet doesn't; bots bypass trigger discipline (perfect taps), so threat-measure never moves. `tests/firemodes.test.ts` (5) |
| Double-barrel · auto-shotgun · two-round-burst rifle | ✅ | **DONE 2026-07-21.** Real guns via family disciplines carried through the arsenal generator: **Scatter Pack = THE DOUBLE-BARREL** (both barrels, one press), Shotgun+Slugger = pump, **Carbine = the two-round-burst rifle** ("a heck of an edge"), CAW-8 + SMG stay full-auto (THE auto-shotgun lives), P9 = single. Live: scatter press → clip −2, held → no spam |
| Per-family **secondary fire** | ✅ | **DONE 2026-07-21 (10.1 row 177).** The four proven alt kinds spread across the shooty core by family idiom (carried through the generator onto every variant): rifle+LMG+HMG = **burst** (flame burp) · carbine+laser = **tag** (recon dart) · SMG = **skitter** · sonic = **overcharge** (6 cells, one orb). Action guns (shotgun/slugger/scatter) + ordnance keep their hands full BY DESIGN — the pump/double IS their secondary. `altAmmo` seeds from the def at spawn. Live: carbine tag fired, smg skitter spawned, sonic paid its cells |
| Brand **signature mechanics** (not just stat curves) | ✅ | **DONE 2026-07-21 (10.1 row 178).** Six manufacturers, six firing BEHAVIORS hooked at one measured site each: **maklov** TRUE ISSUE (−25% move-spread) · **kuchler** HOT HALF (back half of the mag cycles +10%) · **titan** CONCUSSIVE (a horizontal shove on rounds with no knockback) · **harkov** MATCH-GRADE (no ballistic falloff — the round carries) · **ceres** DEEP POCKETS (special pools pay −25%/reload) · **kamenel** HOT LOADS (+15% muzzle). Core class weapons carry NO brand → bots/threat-measure never feel it. `tests/brand-signatures.test.ts` (6); live: kamenel sonic muzzle 24.1 vs 21 (×1.15). Also hardened `spatial.add` against non-finite positions (seam sanitizer) + softened titan to horizontal-only after it perturbed a seed-pinned CTF match |
| Codex shows fire-mode + secondary columns | ✅ | **DONE 2026-07-21.** The Codex weapon sheet derives both live: `Fire mode` (sheet column — charge weapons read `charge`, absent = `auto`) + `Secondary` (detail/compare — the under-barrel kind where one exists). Live census across the armory: 12 double · 12 burst2 · 24 pump · 13 single · 231 auto · 4 charge. The Secondary column fills out as row 177 lands per-family alts |

## 11 · BEAMS

Ground-truthed this session. **Beams draw** (as fast box tracers); everything interactive is unbuilt.

| Ask | Status | Evidence / where |
|---|---|---|
| Beams render | ✅ | `makeProjectile` case 'beam', `renderer.ts:3310` — a flying box, not a stream |
| **Continuous / held** beam (LSW only — soldiers never carry one) | ❌📋 | only in the beam LAB (`/beams.html`); no held stream in-game. BACKLOG (new) |
| **Beam-vs-beam clash** (DBZ struggle, overpower, knock-off-aim) | ❌📋 | no projectile-projectile collision at all. BACKLOG (new) |
| Beam **birth** effects (charge tell, muzzle bloom) | ❌ | beams are *excluded* from the muzzle spark (`renderer.ts:3453`). BACKLOG (new) |
| Beam **landing** effects, material-aware | ✅ | the hit handler already branches on tile/surface (`renderer.ts:3532`) |
| Seven beam types (Lance/Torrent/Tether/Sweep/Pulse/Siphon/Prism) | ❌📋 | designed this session. BACKLOG (new) |
| LSW production/landing effects (each god's beam looks distinct) | 🔨 | per-god tints exist; birth/impact/type flavor doesn't. BACKLOG (new) |

## 12 · MOVEMENT

| Ask | Status | Evidence / where |
|---|---|---|
| Charged **leap** (hold-and-release with a direction; land loud, no air control) | ✅ | **DONE 2026-07-21.** SPACE's third face: hold past the tap window WITH a direction = the duck is a COIL; release springs a ballistic arc (charge ramps 9→15 u/s over 0.9s of coil, `leapChargeOnRelease` pure in `input.ts`). Costs 25, shares the dash cooldown, NO air control (`s.leaping` gates the vel overwrite), and lands LOUD: `loudUntil` pings recon like gunfire + wakes dormant sprinters (§7.1). `tests/space-input.test.ts` (+4), `movement-verbs.test.ts` (+2), `sim.test.ts` (+1); live-verified (counter-steer 30 ticks → velX untouched; landing ping true) |
| Jetpack **commitment cost** (no regen airborne + a timeout after landing) | ✅ | full flight economy: burn-dry latch (relight at 35) + soft ceiling above 6u + ground-only regen + `JET_BREATHER` 1.0s post-landing pause (`world.ts` applyCmd; `tests/sim.test.ts` "landing is a COMMITMENT"). Gods exempt |
| Dive-roll / mantle / slide-off-sprint | ❌📋 | later; slide rides the hoverboard slip system. BACKLOG (new) |

## 13 · LOOT & BODIES

| Ask | Status | Evidence / where |
|---|---|---|
| Weapon shows on the body when you die; others pick it up | ✅ | **DONE 2026-07-21.** A dead human/bot drops its PRIMARY beside the body as a `type:'weapon'` pickup (gunmetal+glint mesh, bobbing): walk-over loads it into the special slot, a matching carried gun makes it an AMMO run; issue ar606 never drops, 20s despawn, 12-drop field cap, humans-only scavenge (threat-measure guard — bots drop but don't loot). Rides the snapshot free. Also fixed: consumed pickups' meshes never left the scene (supply-pod ghosts). `tests/loot.test.ts` (6); live-verified end-to-end |
| Bodies last longer (so loot reads as loot) | ✅ | **DONE 2026-07-21** (`38aa67c`) — battlefield corpses linger 24s in tdm/ctf, outbreak corpses live their full incubation on-field (`491dab6`) |
| Lower ammo (**25%** reserve cut) so fights end in pistols | ❌📋 | **locked at 25%**, but MEASURE FIRST. BACKLOG (new) |
| Ammo **diagnostics** (rounds fired, reloads, dry-clicks, secondary time) | ✅ | **DONE 2026-07-21.** Per-soldier counters in the sim (`statShots`/`statReloads`/`statDry` rate-limited/`statSecondaryT`, mortals only — claws never count) + per-weapon tally (`world.ammoShotsByWeapon`); `ammoReport` (blackbox.ts) rides `__ww.blackbox('report')` with humans split out. `tests/ammo-diag.test.ts` (5); live: 45 sim-s of war → 470 shots/19 reloads by weapon. **The 25% cut (row above) is now measurable — run real matches and read the box before cutting** |

## 14 · ARMED GODS

| Ask | Status | Evidence / where |
|---|---|---|
| A god with a **bow** (charge-draw, arcing, pins bodies) | ❌📋 | designed. BACKLOG (new) |
| A god with a **spear** (thrown + tethered, recalled) | ❌📋 | designed. BACKLOG (new) |
| A god with a **recall axe** (boomerangs through the return path) | ❌📋 | the recall-weapon idea. BACKLOG (new) |
| A **summoner** (human squad) and a summoner (the horde) | ❌📋 | reuses the clone + Iron-Eater rosters. BACKLOG (new) |

## 15 · MULTIPLAYER

The sim was **built** for this (deterministic, seeded, headless, already serializes snapshots for the kill cam). The plan is in `docs/OPTIMIZATION-AUDIT.md` § THE NETCODE PLAN.

| Ask | Status | Evidence / where |
|---|---|---|
| A server process (Node, same sim, 20 Hz) | ❌ | doesn't exist. OPT-AUDIT |
| Transport + input protocol (WebSockets, input-relay) | ❌ | OPT-AUDIT N-series |
| Determinism airtight (no drift) | 🔨 | deterministic by design; verification is a netcode-plan prerequisite. #20 |
| Client-reaches-into-sim cleanup | 🔨 | audited; several seams. OPT-AUDIT |
| Sessions / lobby / reconnect / late-join | ❌ | OPT-AUDIT |
| **Staged path:** co-op science missions first → full PvP second | 📋 | recommended in the netcode plan |

## 16 · WORLD / MATERIALS / ONBOARDING

| Ask | Status | Evidence / where |
|---|---|---|
| Trees | ✅ | procedural + GLB, forest regions |
| Materials: SURF fold (one movement source) | 🔨 | table exists; movement still on legacy tables. BACKLOG W7.1 |
| Ice is slick (momentum carry) | 🔨 | `slick` flag is dead data. BACKLOG W7.2 |
| Fire / burnable wood | ❌ | `flammable` declared, never consumed. BACKLOG W7.3 |
| Per-material impact VFX | 🔨 | only drill sparks read it. BACKLOG W7.4 |
| Non-lethal training rounds | ✅ | `training` flag, the yard survives |
| Boot-camp prey bug (you're hunter both rounds) | ❌ | dummies counted as people. BACKLOG F.1 |
| 3+ storey buildings | ❌ | tops out at 2 (typed `1|2`). DEFERRED by you |
| Water that freezes into a crossable surface | 🔨 | ice is a surface; water never freezes |

## 17 · THE OUTBREAK — zombies as a systemic third faction (spec landed 2026-07-20)

Full spec: **`docs/OUTBREAK-SPEC.md`** (infection model, outbreak pressure/levels, corpse lifecycle, emergent variants, ammo types, melee UI, networking authority, 4-phase roadmap, acceptance criteria). Core promise: *the horde grows from casualties and contamination, not invisible spawn points.* Everything below is 📋 designed / ❌ unbuilt except where noted.

| System | Status | Substrate that already ships |
|---|---|---|
| Base Shambler + rare Sprinter as the production roster | 🔨 | both exist (`ZOMBIE_STATS`: zombie 60hp, sprinter 40hp/15.5u/s); brute/bomber/stalker/spitter also ship but the spec scopes them OUT of the base implementation. **SPRINTER DORMANCY SHIPPED 2026-07-20 (§7.1, acceptance #18):** a sprinter spawns `dormant` — creeps at 3u/s and lies low until woken by PROXIMITY (7u), a clear LINE OF SIGHT (12u), or NOISE/gunfire (18u), then sprints for good; `sprinter_wake` terror event. `tests/sim.test.ts` |
| Shamblers at materially greater density (acceptance §21.17) | 🔨 | **the zombie bench + spatial index (#38) just proved ~790 shamblers inside the frame budget** — the perf groundwork is real; the spec's AI tiers/flow fields would push further |
| Infection model (viralLoad, incubation, treatment; damage ≠ infection) | 🔨→ | **slices 1-2 SHIPPED 2026-07-20**: claws +22 / acid +14 (plate no defense); exposed soldiers INCUBATE (~1.4/s creep) and TURN at 100 — your own side rising against you; medic stim / heal beam are the CURE (walk it back); CLEAN→EXPOSED→INFECTED→CRITICAL HUD state ladder; `tests/infection.test.ts` (11). **LIVE in horde/survival/safehouse.** Resistance/strain families still design |
| Corpse lifecycle → reanimation (exposed body rises on a clock; blasts deny) | 🔨 | **SHIPPED 2026-07-20**: a ≥40-viral death books a corpse that rises as a named shambler (hotter = faster); explosions / INC / BNR neutralize; `reanimated` event; **§6 CRITICAL window** — a `corpse_critical` last-chance alert fires in the final 2s before it rises (acceptance #13 "final warning window"). `tests/infection.test.ts`. The intermediate fresh/incubating body VISUALS (twitching mesh) still design — pairs with W2.4 corpse-linger |
| Corpse burning / neutralization meter | ❌ | needs the fire system (W7.3 — `flammable` is declared, never consumed); incendiary→material interaction is exactly W7's fold |
| Outbreak Pressure + Levels 0-4 | 🔨 | **SHIPPED 2026-07-20**: `outbreakPressure` (live infected + unburned corpses×1.5 + exposed×0.5, eased) drives `outbreakLevel` 0-4 with a 3s confirmation window (§3.3); escalation announces; a color-climbing biohazard HUD chip. Sector-loss objective conversion still design |
| Third-faction outbreak DURING a human-vs-human front | ❌ | zombies are hardcoded team 1 — a true third faction needs the team model widened (the spec's biggest structural ask) |
| Clone infection tied to the reinforcement economy | ❌ | rides the clone economy (W3.3), itself unbuilt |
| Emergent variants from casualties (the body decides the form) | 🔨 | **SHIPPED 2026-07-20**: `riseKind(classId)` — a scout rises as a SPRINTER (lean), a heavy as a BRUTE, everyone else a base shambler; applies to both reanimated corpses and turned living. Armored/heavy-emergent full roster + mutation-field variants still design |
| Environmental mutation fields (readable causes) | 🔨 | **EMERGENT NESTS SHIPPED 2026-07-20 (§8/§3.1):** a body with ≥3 unburned neighbours within 6u anchors a contamination NEST (`world.nests`, rescanned ~1.5s) — infected inside run ×1.2 and a corpse rising in one rises MUTATED (×1.4 hp, "(mutated)"); nests raise outbreak pressure; `contamination` event = readable cause (too many bodies left to rot). `tests/infection.test.ts`. Facility-sourced fields (clone vat / reactor / foundry, §8 table) still design |
| Ammunition TYPES (Ball / AP / Incendiary launch; TRC/SUB/EXP/BNR later) | ✅ | **FULL ROSTER SHIPPED 2026-07-20**: B cycles all 7 — ball→AP→INC→TRC→SUB→EXP→BNR (`Soldier.ammoType`, deterministic on `PlayerCmd.cycleAmmo`, ballistic-only). AP threads plate −25%; INC burns corpses + ×1.6 vs ZedKind; **TRC** marks the struck target (psi-ping) − loud; **SUB** −20% dmg / −25% range (quiet); **EXP** ×1.5 vs bare flesh / ×0.65 vs armor·undead; **BNR** chemical corpse denial without fire at −40% dmg. HUD tags the loaded round; gods don't fumble ammo; `tests/ammo.test.ts` (8). Only **mixed magazines** (§11.3) remain design |
| Weapon HUD: ammo type, penetration, noise, fire hazard | 🔨 | **ammo-type tag SHIPPED 2026-07-20**: the mag counter reads `30 / 90 · AP` / `· INC` on ballistic weapons; penetration/noise/fire-hazard readouts still design |
| Interior flashlight (vision cone as a tool; wakes dormant sprinters) | ✅ | **DONE 2026-07-21.** T toggles the torch: the eye's CONE reaches `TORCH_MULT` (1.35×) further (`perception.ts` eyeSees — the RING/back-sensor untouched) and the darkness beam stretches by the same law (`renderer.ts` feeds `perceiveRange × TORCH_MULT` to the cone shader — one law, two surfaces). The PRICE: a lit torch is a beacon — dormant sprinters notice it at 2× sight radius (`bots.ts` wake). `tests/torch.test.ts` (3); live: range 65→87.8→65 through the real T toggle, 0 errors. `__ww.darkness()` debug handle added (eval-side imports get fresh module instances) |
| Networking authority for infection/grapples | 📋 | matches the netcode plan's server-authoritative model (OPT-AUDIT); grapple latency handling is new |
| Analytics for tuning (§19) | 🔨 | the blackbox ships and is the rail; ammo diagnostics already queued (10.5) |

**Sequencing note:** the spec's Phase 1 (Shambler+Sprinter, infection component, corpse timers, burning, Ball/AP/INC, the melee triangle) overlaps Wave 0.3 (#47), W2.4, W7.3, and 10.1/10.4/10.5 — build those as ONE campaign, not five.

---

## 18 · THE UI (master display inventory — audited 2026-07-20)

**`docs/UI-MASTER.md` is the one document**: every displayable state in the sim (a 100% sweep) × every shipped element in the client, with the visual treatment, the surface it lives on, and ✦ delight details throughout. Locked: near-the-action law, grenade **pip-refills**, **carrion birds** as the first animal, title **WAR WORLD: EARTH**.

**P0 execution (2026-07-20, C2 — all verified live):** ✅ the offline hover bug FIXED (tags + enemy rings work offline now) · ✅ grenade pips + cooldown sweep + the missing conc pouch · ✅ spawn-protection shell · ✅ MISSILE INBOUND warning + flares count · ✅ LSW drop countdown chip + tightening LZ dread ring · ✅ **THE DOWNED EXPERIENCE** (breathing DOWN banner + bleedout clock, pulsing amber rings under downed friendlies, the green revive arc that closes with the channel — proof: `docs/reference/ui-p0-downed.png`). **Still open in P0:** the encased-struggle cracks · the charge-weapon ring (Impact Charge, lands with C3/#47).

## LOCKED DECISIONS (this session)

- **The title is WAR WORLD: EARTH** (Robert, 2026-07-20). The DSOA letterhead on the outbreak spec was the doc template's, not a rename.
- **UI law: near the action** — meters orbit the body/target/reticle; corners keep summaries. Grenade cooldown = **pip refills**. First new animal = **carrion birds** (the corpse-intel layer).
- **Sight:** 3D view = your eyes, minimap = team intel. Contacts **hold, then fade** — never blink out.
- **Science mission squad size:** scales **1 → 8** clones with difficulty (1 = knife-edge solo, 8 = forgiving assault).
- **Ammo cut:** **25%** on reserves — but the **diagnostics pass runs first** and validates it before it lands.
- **Beams:** LSW only. Soldiers never carry a continuous beam.
- **Repo:** push only when you ask (last sync 2026-07-20); commits stay local between asks.

**From the outbreak spec (§22.1 — these are LAW):**
- Clones can become infected. Outbreaks are **condition-driven**, never fixed-time; the infected can emerge as a third faction during active fronts.
- Shamblers are the horde's mass; **sprinters stay rare** (0.5–2%). Most variants emerge from casualties + environment, not rosters.
- **Fire is the primary corpse-denial mechanic.** Ball / AP / Incendiary are the launch ammunition trio.
- Melee is **STRIKE / GUARD / GRAPPLE**; rear grabs enter the **Control Struggle** (attacker's Control Zone vs defender's Break Needle, best-of-three); the horde's version is the **Bite Struggle**.

## STILL ON THE DECISION DESK (only you can answer)

- Which image API funds the AI newspaper (W4.1).
- Which three of the ten fronts survive into the 3×3 board (W3.2).
- Can you field a **captured** enemy god, or is that too big a swing? (science-mission reward)
- Science-mission stake: **permanent loss** on a failed run, or retry next window? (fear vs fairness)
- Leader names/personalities sign-off before they're voiced (W3.7).

**From the outbreak spec (§22.2):**
- Does a perfect Break Hit give escape only, or an immediate **reversal** (defender takes control)?
- Can players **haul infected corpses into enemy territory** — and what anti-grief/war-crime rules apply?
- Who sees the exact incubation timer: everyone, or medics/recon only?
- Does incendiary ignite corpses reliably, or do armor/wetness make it genuinely uncertain?
- Do contaminated sectors **persist across sessions**, and for how long?
- Which rear-grab outcomes are allowed in PvP at launch (drag / disarm / human shield / choke / takedown / throw)?
- ~~The DSOA-vs-War-World title~~ **RESOLVED: WAR WORLD: EARTH** (see Locked Decisions).

---

*This file is the index. `docs/MASTER-BACKLOG.md` is the ordered work queue (Wave 0 first). `docs/OPTIMIZATION-AUDIT.md` + [issues #1–#47](https://github.com/taskmasterpeace/ShootEm/issues) are the performance/bug board. `docs/SCIENCE-MISSIONS.md` is the mission design. The DOCUMENTS INDEX below catalogs every design doc.*

---

## THE DOCUMENTS INDEX — every doc, what it is, its state

**REFERENCE** = a living spec that stays true (not "done/undone") · **SHIPPED** = describes built code · **DESIGN/PLAN** = a spec for something not yet built · **STALE** = superseded.

| Document | What it is | State | Note |
|---|---|---|---|
| `DESIGN-DIRECTIVE.md` | The wide-angle war directive (Rev 6) — factions, "enlist, don't pick" | REFERENCE | Direction, not spec; faction names/colors locked & shipped |
| `WAR.md` | The solo-war bible — 3×3 board, clones-as-currency, science missions, the press | REFERENCE | Locked source-of-truth for war shape; mostly 📋 with a thin ✅ substrate |
| `LORE.md` | Setting — year 2222, factions, gods-vs-LSW naming, clone fiction | REFERENCE | Faction names ✅; god-naming split + clone economy 📋 |
| `ASCENDANTS.md` | The LSW roster law — threat tiers, per-unit status | REFERENCE | Roster/threat law; specific numbers superseded by ABILITIES.md |
| `ABILITIES.md` | Complete ability reference, read from source, updated 2026-07-20 | REFERENCE | The **trusted** numbers doc; matches code today |
| `ARSENAL.md` | The armory catalog — 16 families × 4 makers × 3 marks, vehicles, equipment | REFERENCE | Live in the sim & menu today |
| `BALANCE-PLAN.md` | The standing balance loop + tooling | REFERENCE | Living process doc; tools exist |
| `MANUAL.md` | Field manual — deployment, controls, HUD, modes, classes | REFERENCE | Player-facing how-to; core controls accurate |
| `HARNESS.md` | Dev-tool manual for the model/physics/combat inspector | REFERENCE | Describes the shipped `harness.html` |
| `MAP-STRATEGY.md` | Map-building doctrine — map families, tile alphabet, generator | REFERENCE | Tile vocab shipped; height-aware jump tiers still to build |
| `UI-AND-RESOURCES.md` | Audit of HP/armor/energy + the UI inventory | REFERENCE | Concludes the three resources exist & are correct |
| `SOUND-MANIFEST.md` | Every loadable sound file + how to swap one | REFERENCE | Living asset manifest |
| `ASSETS.md` | Third-party (Quaternius) asset audit | REFERENCE | ⚠ license UNRESOLVED — flagged blocker before shipping |
| `MASTER-BACKLOG.md` | The loop document — everything owed, Waves 0–9 | REFERENCE | Living queue; "ALREADY DONE" shipped, all wave items unchecked |
| `STATUS.md` | **This file** — everything asked for, done vs not | REFERENCE | The ledger you're reading |
| `SCIENCE-MISSIONS.md` | Full science-mission design — 10 verbs × 10 sites × 50 effects | DESIGN | Written this session; unbuilt (BACKLOG W3.5) |
| `OUTBREAK-SPEC.md` | The zombie outbreak / ammo types / melee combat & UI spec (Robert, 2026-07-20) | DESIGN | §22.1 decisions are LAW; STRIKE/GUARD/GRAPPLE naming supersedes older drafts; status in §17 |
| `OUTBREAK-IMPLEMENTATION.md` | **The update doc** — every spec §, acceptance criterion & locked decision → shipped/blocked, with file+test pointers | STATUS | THE completion ledger for the outbreak goal; 3 honest structural gaps named (third faction, PvP Control Struggle, dedicated-server infra) |
| `UI-MASTER.md` | THE master display inventory — every state × every surface × the visual, with delight details | REFERENCE | Supersedes UI-AND-RESOURCES as the display doc; P0/P1/P2 build order; §18 |
| `BLAST-AUDIT.md` | The two-zone explosion model + the C-9 concussion grenade | SHIPPED | Rings read the sim's own numbers; C-9 shipped |
| `VO-DIRECTORS-NOTES.md` | Whisper-verified transcript of 160 VO takes | SHIPPED | All 160 clean, 0 off-script |
| `plans/2026-07-18-lsw-embodiment.md` | Per-school LSW rig/prop/attackPose + movement dress | SHIPPED | Verified in code (EMBODY record, silhouette pass done) |
| `plans/2026-07-18-projectile-effects.md` | Composable projectile effect-flags on 40 LSW weapons | SHIPPED | pierce/beam flags in code; only `ignite` waits on the fire system |
| `MOBILE-FEASIBILITY.md` | Feasibility — loads on phones, needs touch controls | DESIGN | "What works now" is true; touch controls unbuilt, parked |
| `AI-AUDIT.md` | 2026-07-19 six-agent bot-AI audit — ranked findings | DESIGN | Roadmap mostly unbuilt (Utility Brain, A*, cover, Nemesis open) |
| `OPTIMIZATION-AUDIT.md` | Perf + netcode audit — the ranked board of fixes (#1–42) | DESIGN | Measurements real; the board is Wave 8, unexecuted |
| `plans/2026-07-20-sight-and-steel.md` | The by-viewer visibility rewrite + the melee layer | DESIGN | Wave 0; unbuilt (`lastSeen` still team-keyed, no melee weapon) |
| `AI-REPORT.md` | 2026-07-10 writeup of the bot brain as a ~330-line AI | **STALE** | AI-AUDIT supersedes it; `bots.ts` is now ~1524 lines |
