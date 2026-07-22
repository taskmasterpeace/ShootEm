# UI MASTER — everything the game must display, and when
### The one document. Built from a 100% sweep of the sim (every displayable state, `src/sim`) and the client (every shipped element, `src/client`) on 2026-07-20. Robert: "one master document for the UI… meticulous detail on the small things."

**Legend:** ✅ shipped · 🔨 partial · ❌ missing · ✦ = a delight detail nobody asked for
**Title lockup:** the game is **WAR WORLD: EARTH** (locked 2026-07-20).

---

## THE LAWS (every element obeys these)

1. **Near the action.** Critical feedback lives ON the body, the target, or the reticle — charge rings orbit the soldier, struggle bars sit over the grapple, the boom ring wraps the jet. Corners hold *summaries* only (ammo, objectives, map). (Robert's outbreak spec §16.4, adopted as standing law.)
2. **Derived, never transcribed.** Every number reads live from the sim (the Codex law). A meter that can drift from the truth is worse than no meter.
3. **Shape is a channel.** Friendlies are dots, enemies are triangles, memories are hollow marks, machines get hard corners, the living get curves. Color-blind players read the shape alone.
4. **One accent.** House amber `#e8a33d` carries "yours/ready"; signal-red carries "enemy/danger"; steel carries "information." Semantic green/red for health states only. **No purple, ever.**
5. **The world teaches first, the HUD confirms.** If a state can be worn by the body (a shimmer, a stance, a flame), wear it there — the HUD chip is the caption, not the message.
6. **Nothing blinks out.** States HOLD, then fade. (The sight law — applies to every marker, ghost, and timer.)

## THE SURFACES (where things are allowed to live)

| Surface | What belongs there |
|---|---|
| **The body orbit** (rings/arcs around YOUR soldier) | health ring ✅, energy arc ✅, aim ring ✅(W1.2), charge ring ✅(§4, 2026-07-21), spawn-protection shimmer ❌, status pips ✅(status strip) |
| **The target orbit** (on what you're aiming at / fighting) | enemy health ring ✅(hover), struggle bar ❌, revive channel ❌, capture progress ❌ |
| **World-space marks** (at a place, through the camera) | ping chevrons ✅, waypoints ✅, blast rings ✅, LZ warning ❌, contact marks ❌(W0.2), field boundaries ❌ |
| **The weapon block** (bottom-right) | name/ammo/reload ✅, grenade pouch ✅🔨, alt-fire ✅🔨, WPN cycle ✅ |
| **The vitals block** (bottom-left) | ring+numbers ✅, stamina bar ✅, equip chips ✅, buff/debuff strip ❌ |
| **Top bar** | objectives ✅, clock ✅, weather ✅🔨, killfeed ✅, announce ✅ |
| **Minimap** | full inventory ✅ (see hud.ts:454-649) + missing layers below |
| **Screens** | menu/armory/codex/barracks/map/scoreboard ✅ |

---

## 1 · SOLDIER — vitals, movement, resources

| State | When shown | Where | The visual | Status |
|---|---|---|---|---|
| HP / armor / energy | always | vitals ring | shipped ring + arcs + numbers | ✅ |
| **Energy regen STALL** (airborne jet / sprinting = zero regen; `jetSpent` latch until 35) | the moment regen halts | stamina bar | ✦ the bar's leading edge turns **grey and grows a small ⏸ notch**; when `jetSpent` latches, the jet chip shows `RELIGHT 35` — "why isn't my meter filling" answered where the eye already is | ❌ |
| Sprint | while held | body | ✦ no HUD — the body already leans; add breath audio at 20% energy (the soldier PANTS before the bar dies) | 🔨 |
| Dash/roll cooldown (0.9s) | after a dash | body orbit | ✦ a hair-thin arc sweeps closed around the boots — subliminal, no corner element | ❌ |
| Crouch / grass concealment | crouched in grass | body | ✦ grass blades LEAN over the soldier and a faint `CONCEALED` whisper-chip fades in once, first time only (teach, then trust) | ❌ |
| Swimming (deep water = no hands) | on T_DEEP | weapon block | weapon name swaps to `SWIMMING — hands busy`; ✦ the gun visibly rides the backpack | ❌ |
| Ragdolled (inputs dead) | while luggage | none | ✦ correct as-is: the tumbling body IS the message. Add controller rumble only. | ✅ |
| Warp/gate cooldown | at a gate, cooling | world-space | ✦ the gate's ring dims and rebuilds clockwise — the WORLD shows its own cooldown | ❌ |

## 2 · SOLDIER — the downed experience (the biggest missing chapter)

Sim has the whole §4.3 system (`downed`, 20s bleedout, `reviveProgress`, `draggingId`); the client shows **none of it**. The complete treatment:

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| YOU are downed | instantly | banner + body | **SHIPPED 2026-07-20**: breathing red `DOWN — bleeding out Ns · crawl — a medic can lift you` banner (flips to `medic on you — N% lifted` mid-revive) + the amber ground ring pulsing faster as the clock runs (✦ later: frame desaturation) | ✅ |
| Teammate downed | instantly | world | **SHIPPED 2026-07-20**: pulsing amber ground ring under every downed friendly, urgency-paced (✦ later: minimap pulse + heartbeat tag) | ✅ |
| Revive channel (3s E) | while channeling | target orbit | **SHIPPED 2026-07-20**: a green arc CLOSES around the body with the channel — both the medic and the fallen read it; the sim's reset-on-hit snaps it visibly | ✅ |
| Being dragged | while dragged | body | ✦ heels carve two furrows in the dirt (decal pair) — read at command height instantly | ❌ |
| Medibeam instant-lift | on revive | body | green surge already exists — add the body SNAPPING upright with a gasp SFX | 🔨 |

## 3 · GRENADES & THROWN KIT (Robert's direct ask)

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| Grenade count per pouch | always on foot | weapon block | pouch line shipped — **add the missing CONCUSSION pouch** (sim has `concs`, the bag omits it — a real bug) | 🔨 |
| **Throw cooldown** (`nextGrenadeAt`, 1.2-2.5s) | after a throw | the pouch pip | **LOCKED (Robert): pip refill** — pouches render as pips (`frags ●●●●`) and the selected pouch's lead pip sweeps ◔◑◕→● through the cooldown. Conc pouch restored to the bag in the same fix. **SHIPPED 2026-07-20** | ✅ |
| Held-aim (G held) | while held | world | dashed arc + landing ring shipped ✅; ✦ add the LOFT as a visible apex marker that rises/falls with the wheel — you *see* rope vs mortar before releasing | 🔨 |
| Cooking? | n/a | — | grenades don't cook in this sim — correctly no UI | ✅ |
| Pouch cycling (X) | on cycle | pouch line | ➤ selector shipped; ✦ the selected pouch pip grows 1px and warms to amber | 🔨 |
| Orbital beacons / MANPADS count | when carried | equip chips | count badge on the chip (`◈2`); **SAM lock** gets its own row below | ❌ |
| **SAM lock state** (the G that won't fire) | aiming at air | reticle + target | the seeker draws a **diamond that rotates and tightens** around the aircraft as the cone closes; solid + tone = locked, G releases. The silent-refusal bug becomes a hunt ritual | ❌ |
| Axe states (flying / buried / recallable) | always for axe carriers | equip chip + world | chip shows 🪓 / a buried glint pulses amber in world; ✦ on recall, everything in the return lane gets a hair-thin warning line 0.2s before the blade travels it | ❌ |

## 4 · WEAPONS — charge, alt-fire, melee

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| **Charge meter** (`chargeStart` — hold-to-×mul) | while holding | body orbit | **the Impact Charge ring** (outbreak spec §13, one ring for melee AND weapons): fills around the soldier, enters an amber MAXIMUM band, then a red OVERCHARGE pulse; release snaps it into the shot. ✦ the gun model itself glows through the same ramp (emissive rises) — enemy sees the wind-up too, which is the counterplay | ✅ **DONE 2026-07-21** — `renderer.ts` `chargeRing` orbits the local body, TIGHTENS as it winds (1.5u→1.0u), amber MAXIMUM band ≥0.71, red OVERCHARGE pulse ≥1.3 (reads `meleeCharge`). TODO(follow-up): the enemy-visible gun-emissive glow + showing the ring on visible enemy chargers (the counterplay half) |
| Alt-fire cooldown + burst window | RMB weapons | weapon block | the `RMB ×N` text gains a tiny cooldown sweep behind it; during a burst window the text pulses | ❌ |
| Melee windup/strike | swinging | body | zed telegraph + slash ring shipped; extend to soldiers with the STRIKE/GUARD/GRAPPLE build (#47) | 🔨 |
| Fire-rate stagger (melee hit / concussion "ringing ears") | when locked out | reticle | ✦ the crosshair itself **rings** — a wobble + faint tinnitus vignette; you FEEL why the trigger is dead | ❌ |
| Weapon switch | on switch | weapon block + body | name swaps ✅ + the armory system already swaps the in-hand model ✅ | ✅ |

## 5 · STEALTH, MARKS, AND BEING HUNTED (victim-side truth)

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| **YOU are pinged/tagged** | while marked | vitals block + body | a red 📡 chip + a faint red ring pulsing at your feet that only YOU see — "they can see me" changes every decision and the sim already knows it | ❌ |
| YOU are inside smoke | in a cloud | screen edge | ✦ soft grey vignette breathing at the frame edges + `SMOKED` whisper-chip — concealment you can trust | ❌ |
| Marked by Reaper (×2 damage) | while marked | fullscreen | the promised-but-missing tell: a scythe-thin red crescent at the screen top + heartbeat audio — you are HUNTED | ❌ |
| Psi-linked (share 60% pain) | while linked | body | a thin tether line renders to your link partner (you both see it; enemies don't) | ❌ |
| Spawn protection (≤5s) | after spawn | body | a slow-turning wire shell that thins as the window expires (v1 **SHIPPED 2026-07-20**; the panel-flake upgrade stays a ✦ later) | ✅ |
| Cloak (you/team/enemy) | cloaked | body | alpha states shipped; ✦ add a heat-haze ripple only when MOVING (stand still = truly gone) — makes stillness a verb | 🔨 |
| Blind (Nightmare / conc) | while blind | fullscreen | white-noise bloom collapsing over 2s (already earned by bots; humans need the same honesty when it lands on them) | ❌ |

## 6 · STATUS EFFECTS — the buff/debuff strip (one system for all timers)

One horizontal strip of small square chips above the stamina bar, each with an icon + radial-wipe timer. **Feed it everything:** overcharge (Reactor/Steel Weaver), time-field SLOWED, possession clock, EMP-stunned (in vehicle), encased, protected, marked, pinged, tagged, smoked, psi-linked. Chips appear on gain (slide in), radial-wipe down, and **fade — never pop** (Law 6). Enemy-sourced chips wear signal-red edges; buffs wear amber. ❌ (nothing exists — this is the single highest-leverage NEW element in this document.)

**The encased-in-ice struggle** gets special treatment (it's a minigame with zero UI today): the ice block is shipped; add a **crack-pattern that spreads with your mash progress** (`struggle` 0..1 drives crack decals on the ice mesh) + the drain choice as two hair-labels: `MASH — break at −45` / `HOLD — bleed 2.5/s`. The ice itself is the meter. ✅ **DONE 2026-07-21** — a jagged crack web (`makeIceCrackGeo`) rides the block, opacity = `struggle`, the ice stressing brighter (emissive climbs) as it nears breaking; the two hair-labels float over your own body (`MASH — BREAK −45` amber / `HOLD — BLEED 2.5/s` steel), reading the sim's `STRUGGLE_HP`/`ICE_HOLD_DRAIN`. `renderer.ts` `updateIceBlock`; `tests/encased-struggle.test.ts` (2).

## 7 · LSW — piloting and facing gods

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| Signature cooldown (pilot) | as a god | weapon block | shipped meter ✅; ✦ add the god's HANDS charging (emissive rises on the prop) in the last 20% | ✅🔨 |
| **LSW drop countdown** (`landsAt`, 15-40s) | from the call | top bar + world | **SHIPPED 2026-07-20**: `☄ TITAN INBOUND 0:29` chip (amber yours / red theirs) + a pulsing LZ ground ring that TIGHTENS as the pod falls and panic-pulses at T-5s. Both teams see it. ✦ later: minimap ⚠ + birds scattering at T-3s | ✅ |
| Enemy god threat tier | god on field | its body orbit | ring + notches shipped 🔨; add the threat-tier chip (SKIRMISH/STRONGPOINT/SIEGE/EXTINCTION) on first sight, then trust the silhouette | 🔨 |
| Gargoyle's perch (half damage) | perched | target | ✦ the perch TILE glows faint red with hairline cracks — "break the ground, not the god" taught visually | ❌ |
| Chronos echo (campable cheat-death) | echo live | world | gold breadcrumb shipped; add a faint hourglass mark at the echo POINT (the campable spot reads as a spot) | 🔨 |
| Oblivion's hole charge | hole growing | world | **the charge % as the event-horizon ring**: radius already scales — add an accretion shimmer that spins faster with charge; fuse (fixed 1.5s) = the ring's final contraction. No numbers — the physics is the meter | ❌ |
| Magnetar's bullet-halo | in his 4u | target orbit | ✦ your tracers visibly CURVE into the halo and fizzle — after two bursts you stop shooting bullets at him. The lesson is the VFX | ❌ |
| Venatrix snap-traps | placed | world | glint shipped; ✦ K9s growl at traps within their nose radius (the dog is the detector) | 🔨 |
| Leap/dive telegraphs | mid-air | ground | shadow shipped; add the LANDING RING that tightens as they fall (the dodge window made spatial) | 🔨 |

## 8 · VEHICLES — the cockpit truth

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| Hull/systems/crew/WPN cycle | aboard | vehicle block | shipped ✅ | ✅ |
| **AFTERBURNER** (Robert's example) | burner lit | the jet itself | Today: flames scale 2.1× uniformly. The full treatment: flames **stretch on the thrust axis** (not grow), a heat-shimmer cone behind, the engine HOWL pitch-bends up — and at the moment speed crosses the threshold, **THE SOUND BARRIER BREAKS: a white vapor CONE-RING snaps perpendicular to the fuselage, expands and shreds in 0.4s, with a double-crack boom that arrives LATE to distant listeners** (the delay IS the physics). ✦ on humid maps (rain/storm) the ring is fatter and lingers; ✦ the boom flattens grass in a lane under the flight path; ✦ your own cockpit hears it as a soft double-thud behind you — you outran your own noise | ❌→✦ |
| PixelLab flight cluster | driving aircraft/naval hull | instrument plate below minimap | **SHIPPED 2026-07-21:** live airspeed needle + digital speed/%, compass heading, `STALL / CRUISE / AB / SPOOL`, four elevation pips, radar/sonar state and lock danger over the PixelLab gunmetal dial | ✅ |
| Altitude band | flying | vehicle block + instrument plate + minimap | `G / B / S / C` four-level ladder with Q/E hints; radar contacts repeat their band as a letter | ✅ |
| Tactical radar / sonar | sensor available | minimap + instrument plate | **SHIPPED 2026-07-21:** range rings stay circular in rectangular world space; sweep arm follows the sim cadence; hollow glyphs separate air/ground/surface/submerged; tracks hold at last-known position then fade | ✅ |
| ECM / damaged sensors | jammed or sensor HP zero | minimap + instrument plate | `JAM` shortens reach and adds deterministic offset/uncertainty rings; `SEN DEAD` stops new sweeps and lets old tracks expire | ✅ |
| Rotor spool | spooling | instrument plate | live `SPOOL n.n` countdown; ✦ dust ring widening remains a later world-only flourish | ✅→✦ |
| Stall floor (jets never stop) | always in a jet | instrument plate | live needle/digital speed switches to a red `STALL` state below the fixed-wing floor | ✅ |
| Submarine sonar | submerged | minimap + instrument plate | `SUBMERGED`, `DEPTH D`, `SONAR 80`; surface/submerged returns only, never airborne contacts | ✅ |
| **MISSILE INBOUND** | seeker homing on you | vehicle block | red blinking `⚠ MISSILE INBOUND` on the role line the moment a seeker homes on your hull (**SHIPPED 2026-07-20**; the target-only red trail stays a ✦ later) | ✅ |
| Flares count | in aircraft | vehicle block | `G flares ●●●` on the role line, pips burn down with each pop (**SHIPPED 2026-07-20**) | ✅ |
| Bomb load / nuke armed | bomber | vehicle block + all | `BOMBS ▮▮▮▮` pips; when the Cradle arms, EVERYONE's top bar gains the radiation chevron + the bomber's hull lamp strobes (world-teaches, HUD confirms) | ❌ |
| Hotwire progress (6s/3s) | stealing | target orbit | a lockpick ring around the hull that snaps back if you move — tension made visible | ❌ |
| Abandonment/write-off clocks | near a stray hull | walk-up prompt | the [E] prompt gains `HOTWIRE 90s` / `WRITE-OFF 3:00` mini-lines — the requisition economy stops being invisible | ❌ |
| EMP-stunned | dead stick | vehicle block | all five system pips flicker blue-white for the stun; controls chip shows `REBOOT n.n s` | ❌ |
| Infected wagon (Plaguebearer) | driving it | vehicle block | a sickly green drip icon + the trail already renders; ✦ windshield-wiper smear of spores (screen-edge grime) while aboard | 🔨 |
| Ambulance heal bubble | pulsing | world | ✦ the ring breathes IN TIME with the 1s pulse and each pulse lifts tiny green crosses off healed bodies — read the radius, feel the tick | 🔨 |
| Overload fuse (Volt Striker 2s) | aboard the bomb | fullscreen | the WHOLE vehicle block flashes `BAIL — 2.0…1.4…` — the funniest two seconds in the game deserves its clock | ❌ |

## 9 · FORCE FIELDS, TIME FIELDS, SHIELDS (the "charge your force fields" family)

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| Force-field volume (pull/push) | field live | world | **the field must have a BODY**: a soap-film boundary sphere + interior drift-lines showing force direction (in = pull, out = shove); victims' screen gains a subtle directional smear. Owner team sees it steel-faint, victims signal-red | ❌ |
| Field charge (Oblivion overdraw; future charged fields) | while charging | the caster + the field | the caster's **energy bar IS the charge meter — label it** (`OVERDRAW` tag while channeling) + the field's boundary brightens with charge %. One grammar for every charged field to come | ❌ |
| Time-field slow | inside one | body + strip | amber clock-chip in the status strip + ✦ your own tracers/casings visibly fall in slow motion inside the bubble — the bubble grades the WORLD, not the screen | ❌ |
| Shield domes (400hp, reflect-first-2s) | dome up | world | dome mesh shipped; add an **hp-crack grammar** (3 crack stages) + the Barrier reflect window shown as a mirror-sheen that burns off after 2s — "shoot it NOW or wait" answered visually | 🔨 |

## 10 · TURRETS, DRONES, GADGETS

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| FPV signal (static grows to 55u) | piloting | fullscreen | static shipped ✅; add a `LINK ▂▄▆` meter + ✦ the horizon line tilts a degree as link degrades (analog dying) | 🔨 |
| Drone battery | piloting | vitals | your energy bar (it drains 4/s) grows a small 🔋 label while piloting | ❌ |
| Turret hacked/possessed | flipped | world | team tint flips ✅ + add a 1s glitch-flicker on the housing at the flip moment | 🔨 |
| Mine arming (1.2s) | placed | world | ✦ the puck's lamp blinks fast → solid; enemy detector view shipped | 🔨 |
| Skitter incoming | chasing | target | ✦ its leg-taps get louder in YOUR mix only as it closes on you (proximity = pitch) | 🔨 |
| Beacons/cameras/fields on minimap | deployed | minimap | the missing layers: target beacons, cameras, fire/smoke fields, snap traps — each a small owner-colored glyph | ❌ |

## 11 · THE ANIMALS (locked: carrion birds first)

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| **Carrion birds** | corpses accumulate | the sky | a slow wheel of 3-7 silhouettes over any 2+ corpse cluster (client-only boids reading corpse positions). **They are the intel layer**: circling = bodies below, and later = outbreak pressure made visible. ✦ they scatter when anyone sprints through — betraying flankers to a watchful eye. ✦ at an LSW pod's T-3s they burst off the LZ. ✦ the Codex THREATS page gains a FAUNA footnote | ❌ (design locked) |
| K9 nose | dog nearby | world | ✦ the dog's head TURNS toward cloaked enemies inside nose radius before the ping fires — watch the dog, not the map | ❌ |

## 12 · MODES, OBJECTIVES, META

| State | When | Where | The visual | Status |
|---|---|---|---|---|
| Conquest capture progress | contesting | the point + chip | the point's ring fills with the capturing team's color (world) + the chip gains the same fill | ❌ |
| CTF dropped-flag auto-return (25s) | flag on ground | world + chip | the ⚠ chip gains a draining slice; the world flag's pole glows fainter as return nears | ❌ |
| Wave countdown (survival) | between waves | top bar | `NEXT WAVE 0:12` beside the wave chip — the breath you can plan in | ❌ |
| **Materiel purse** | always (modes with LSWs) | top bar | a small `◈ n` chip near the clock (both teams' visible to commissioned officers only — intel is a rank perk) | ❌ |
| Weather intensity + AIR GROUNDED | rough weather | weather chip | chip shipped 🔨; add intensity ticks + a struck-through jet glyph when `airGrounded` — pilots stop guessing | 🔨 |
| Underfunded-victory ledger | match end | career pane | shipped ✅ | ✅ |
| YOU have the flag | carrying | body + banner | one-time banner `YOU HAVE IT — RUN` + a cloth streamer renders off your own back (you never forget what you are) | ❌ |

## 13 · KNOWN WIRING BUG (found by this audit)

**Hover unit-tags and enemy health rings never appear in OFFLINE matches** — `renderer.setHover` was fed only by the multiplayer loop (`net.ts:163`). **FIXED 2026-07-20** — the local frame loop feeds the cursor too (`main.ts`). ✅

---

## PRIORITY ORDER (what the loop builds, in order)

**P0 — the criminal gaps (shipped systems with zero readout):** the hover wiring bug (§13) · grenade pip-refill + missing conc pouch (§3) · the downed experience (§2) · MISSILE INBOUND + SAM lock diamond (§3/§8) · ~~encased struggle cracks (§6)~~ ✅ **DONE 2026-07-21** · spawn-protection shimmer (§5) · LSW drop countdown + LZ ring (§7).
**P1 — the new grammars:** the status-effect strip (§6) · the charge ring / Impact Charge (§4) · afterburner + sonic boom (§8) · force-field bodies + labels (§9) · altitude ladder + flares/bombs pips (§8) · victim-side marks (§5).
**P2 — the aura layer:** carrion birds (§11) · conquest/CTF progress fills (§12) · materiel chip (§12) · minimap gadget layers (§10) · all remaining ✦ details.

*Superseded: `docs/UI-AND-RESOURCES.md` remains the HP/armor/energy audit of record; THIS document is the master display inventory going forward.*
