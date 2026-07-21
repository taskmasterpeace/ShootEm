# WAR WORLD: EARTH — UI BIBLE
### UI Direction & Implementation Brief · **Make the battlefield explain itself.**
**v1.02 (2026-07-01) · DESIGN / UI / CLIENT / VFX / AUDIO / QA**

> **This is the North Star.** Robert (2026-07-21): *"This is our UI bible. It's visual for me and made so I and you can understand it — it has to be referenceable for all of us, so lock in on this. If it's missing anything, improve it."* Every HUD/UI decision — mine, and the parallel worktrees' — routes through this document. Layout, hierarchy, and visual grammar are intentional; labels/numbers are placeholders until wired to live sim data.

The doc is reproduced faithfully in §01–§15. **§16 reconciles what's already shipped against it; §17 folds in Robert's live-direction additions.**

---

## 01 · EXECUTIVE DIRECTION
The current HUD has the right anchor map and a usable industrial identity, but spends too much screen area on persistent chrome while high-value gameplay states are missing or detached from their cause. **A ground-up redesign is wasteful.** Preserve the top bar, bottom-left vitals, bottom-right weapon block, kill feed, minimap; rebuild the hierarchy and standardize the feedback grammar.

- **KEEP THE ANCHORS** — the player knows where health, ammo, objectives, and the map live. Reduce footprint and improve hierarchy instead of moving things.
- **MOVE CAUSALITY TO THE ACTION** — cooldowns, locks, charge, struggle, revive, capture belong on the body, target, reticle, or world position that causes them.
- **ONE GRAMMAR PER DATA TYPE** — rings = spatial progress · pips = discrete inventory · chips = timed states · bars = long resources · banners = strategic changes.
- **FIX INVISIBLE TRUTH BEFORE POLISH** — a missing lock/struggle/victim-side mark beats a beautiful afterburner. Close information gaps first.
- **THE SUCCESS TEST** — in a 5-second glance the player answers: *What is happening to me? What caused it? What can I do next? How long until I can act again? Where is the objective/threat?* If it needs scanning corners or reading a paragraph, the UI failed.

## 02 · CURRENT HUD ASSESSMENT
The layout is salvageable; the information density is not. Persistent boxes dominate; transient causes and lockouts are under-explained.

- **KEEP:** top-center mode/score/clock · bottom-left vitals + bottom-right weapon · top-right kill feed + persistent minimap · industrial brackets, thin borders, amber selection language.
- **CHANGE:** **shrink the weapon and vitals blocks ~20–30%** at reference res · remove empty panel interiors / reduce opaque black · keep center text brief and out of the aiming lane · stop using corners to explain short-lived causes · **separate team identity from status color — cyan = friendly, amber = yours/ready.**
- **FRAME-KIT:** convert rectangular/circular frames to **9-slice** (corners + border thickness fixed, center stretches) · large opaque frame only for maps/menus; in combat prefer corner brackets, short rails, translucent backing · **one frame family + state accents**, not a texture per module · content determines module size, not a fixed art rectangle.

## 03 · NON-NEGOTIABLE DESIGN LAWS
The decision filter. A feature that violates these needs a specific, documented exception.
1. **NEAR THE ACTION** — critical feedback on body/target/reticle/world. Corners summarize, never explain immediate causality.
2. **DERIVED, NEVER TRANSCRIBED** — every number/timer reads live sim state. The UI never keeps a second truth that can drift.
3. **SHAPE IS A CHANNEL** — friendlies/enemies/machines/objectives/memories stay distinguishable *without color*. Color confirms; shape carries.
4. **ONE ACCENT** — house **amber** = yours/selected/charged/ready · signal **red** = enemy/danger · **steel** = information · **green** reserved for health/recovery.
5. **THE WORLD TEACHES FIRST** — a shimmer/stance/flame/crack/tether/ground-ring communicates the state before any corner chip.
6. **HOLD, THEN FADE** — states never pop out of existence; they hold long enough to read, then fade. Interruption and completion are visually distinct.

**Alert hierarchy:** CRITICAL (missile/overload/hunted/downed/bleedout → body/target/screen-edge + audio; one at a time, persist till resolved) · TACTICAL (reload/revive/charge/lock/capture/hotwire/cooldown → reticle/orbit/world-mark; no big banner, indicator beside its cause) · INFORMATIONAL (score/weather/wave/feed/equipment → top bar/corner/minimap; steel or team color, never competes with critical).

## 04 · SURFACE ARCHITECTURE
Every element has **one owner surface**, chosen by *what the info is about*, not by where there's empty space.

| Surface | Owns | Examples | Do NOT put here |
|---|---|---|---|
| **Body orbit** | your immediate state | health/energy arc, dash CD, charge ring, spawn shield, status pips | objectives, inventory, global alerts |
| **Target orbit** | state of what you act on | enemy health, revive, struggle, grapple, hotwire, capture | your own resources, unrelated timers |
| **World-space mark** | a place/radius/route/event | ping, blast ring, LZ, field boundary, dropped flag, waypoint | persistent stats, long labels |
| **Reticle** | aim/lock/hit/interruption | SAM lock, fire-rate stagger, target confirm, damage direction | inventory, match state, long text |
| **Vitals block** | persistent player summary | HP, armor, energy, status strip, equipment counts | short action timers already in the world |
| **Weapon/vehicle block** | current weapon/platform state | ammo, reload, alt-fire, pouches, flares, bombs, system | character health, objective progress |
| **Top bar** | match & strategic state | mode, score, time, wave, weather, major event, kill feed | personal cooldowns, local interaction progress |
| **Minimap/screens** | tactical inventory & planning | contacts, objectives, assets, zones, layers, armory, codex, scoreboard | momentary hit confirmation |

**DUPLICATION RULE:** a state gets one primary readout + one confirmation (world shows cause, HUD confirms consequence) — never a third meter. **ROUTING TEST:** changes next 1–3s? → body/target/reticle. About a location/radius? → world-space (mirror on minimap if strategic). Persistent inventory? → vitals/weapon (pips or compact number). Match-wide? → top bar/minimap (one banner on change). Victim-only existential? → body + screen edge + audio (never audio alone).

## 05 · VISUAL LANGUAGE & LAYOUT TOKENS
**Color system (exact tokens):**

| Token | Hex | Use |
|---|---|---|
| Smoke black | `#111715` | combat panel backing, deep screens |
| Field white | `#F6F5F0` | primary document / light UI text |
| **House amber** | `#E8A33D` | yours, selected, ready, maximum |
| **Friendly cyan** | `#35C9D6` | team identity ONLY — not a generic accent |
| **Signal red** | `#FF3B30` | enemy, danger, lockout, critical |
| Information steel | `#A7B0B8` | neutral data, inactive, supporting text |
| Recovery green | `#4CD964` | health, healing, revive completion ONLY |

**Restrictions:** no purple in combat UI · green never means generic success/interactable/selected · amber must not become a second team color · critical meaning survives desaturation (shape + placement also carry it).

**Shape language:** friendly/owned = dot/circle (soft, closed) · enemy/danger = triangle/wedge (directional, aggressive) · machine/asset = square/diamond/hard corners · living body = curved ring/arc (organic, around a silhouette) · objective/neutral = open ring/bracket · memory/last-known = hollow/dashed (clearly not current truth).

**Type/numbers:** condensed display face for headings/alerts/labels; clean utility sans for descriptive text/names; **tabular/monospaced numerals** (digits must not shift). No all-caps paragraphs (reserve for 1–3-word labels). Combat panels = translucent backing + 1px steel borders + small amber corner accents; opaque black only for maps/menus. **Reference @1080p:** 18px min critical text, 14–16px secondary, 22–32px dominant digits, 24px edge safe zone, 12px module gap. Support 80–150% UI scale; reserve 35% horizontal expansion for localization.

## 06 · COMPONENT GRAMMAR, MOTION, AUDIO
Build a **small set of reusable components**; refuse one-off meters unless a state genuinely needs a new model.

| Component | Use when | Behavior | Hard rule |
|---|---|---|---|
| **Orbit ring/arc** | progress is spatial, tied to a body/target | clockwise fill, 12 o'clock origin; distinct complete/interrupted/overcharge | never a body-action timer in a corner if an orbit can carry it |
| **Pip bank** | count is discrete | one pip/charge; selected warms amber; cooldown sweeps lead pip | don't turn 4 grenades into a vague bar |
| **Status chip** | a timed modifier affects player/vehicle | icon, short label, radial wipe, source-colored edge, slide-hold-fade | all timed effects share this component |
| **Resource bar** | precision over a long interval | linear fill, threshold notches, stall/lockout states | use sparingly; bars are poor for spatial actions |
| **Banner** | a strategic state changes | one line, optional timer, short entry, readable hold, fade | never for routine reloads/hits/cooldowns |
| **World marker** | a place/radius/route/landing matters | shape-coded, distance-scaled, occlusion-aware, mirrored to minimap | no paragraph labels in world space |
| **Reticle response** | aim/lock/hit/trigger-refusal changes | tightens/rings/wobbles/changes shape + short sound | don't hide trigger refusal behind silent logic |

**Motion:** micro response 100–160ms · state entry 160–240ms (slide/scale a few px, don't fly across screen) · **minimum readable hold 300–600ms** (hold the completed visual even if the state ended) · banner hold 0.9–2.5s · danger pulse 1.5–2.5Hz (faster only in final countdown) · **reduced-motion required** (replace orbit rotation/scale-pulse with alpha/static threshold). **Audio confirms cause, never carries essential info alone** — every critical sound must be readable with audio muted.

## 07 · CORE HUD MODULES
Keep anchor positions; make every module content-driven, compact, subordinate to the battlefield.
- **VITALS (bottom-left):** HP dominant; armor/energy secondary arcs or compact numbers; status-effect strip above the stamina line; remove persistent rank copy unless rank changes gameplay; equipment as small badges; **block contracts when optional rows are empty.**
- **WEAPON/VEHICLE (bottom-right):** ammo + current action state dominant; reload = ring/sweep around the ammo count; pouches/alt-fire/flares/bombs/system as compact pip rows; **the weapon silhouette may stay as a small recognition cue but must NOT occupy most of the panel.**
- **TOP BAR + FEED:** mode/score/clock + one strategic objective at center; kill feed right-aligned, capped 5 lines; announcements queue by priority (no routine center banner); weather/materiel only when they affect decisions.
- **MINIMAP:** default shows player/friendlies/contacts/objectives/downed/urgent-zones; assets/gadgets are lower layers; preserve shape language at small size; **hold-to-expand** rather than a permanently huge map.

**Reference footprints @1920×1080:** vitals ~320×170 (24px edge/12px row gap, hide empty rows, 6 chips then +N) · weapon/vehicle ~460×190 (silhouette shrinks/disappears first, 1 primary + 2 support rows) · minimap 280–320px sq (expand to 420–480) · top objective ≤420px · kill feed ≤360px (5 lines, fade oldest). **Scale from a reference canvas, anchor to safe zones, reflow optional rows — do NOT uniformly shrink the whole HUD until text is unreadable.** On 21:9 keep combat modules near the 16:9 safe frame.

## 08 · SOLDIER, DOWNED, GRENADES, WEAPONS
*Tracks: **VERIFY** = keep shipped + regression-test · **BUILD** = missing/incomplete truth · **POLISH** = world/VFX after core readout works.*
- Energy-regen stall → vitals bar: leading edge steel-grey + pause notch the moment regen stops; jet relight-latch labels the live threshold. **BUILD**
- Dash/roll cooldown → body orbit: hair-thin arc around the boots for the 0.9s lockout, no corner icon. **BUILD**
- Crouch in grass → grass leans over the soldier; one-time CONCEALED whisper chip then trust the world. **POLISH**
- Deep-water swimming → weapon block reads `SWIMMING — HANDS BUSY`, gun visibly stowed on the pack. **BUILD**
- Downed → breathing bleedout banner + urgency-paced ground ring; revive replaces copy with live lift progress. **VERIFY**
- Teammate downed → amber world ring; minimap pulse only after world read proven. **VERIFY**
- Revive channel → green arc closes on the fallen body; damage interruption visibly *snaps the arc back*. **VERIFY**
- Being dragged → paired heel furrows / drag trail (world state, not a banner). **POLISH**
- Grenade pouch → one pip per grenade; selected row carries pointer + lead pip refills through cooldown. **VERIFY**
- Held throw aim → dashed trajectory + landing ring + a visible **apex marker** (read loft vs low throw). **POLISH**
- SAM/MANPADS lock → rotating diamond that tightens as the cone closes; solid + tone = locked (readable, not silent). **BUILD**
- Impact charge → ONE charge ring for melee + charged weapons: fill → amber max band → red overcharge pulse; raise model emissive so enemies read the wind-up. **BUILD**
- Alt-fire/burst window → small cooldown sweep behind the label; pulse only during the active burst. **BUILD**
- Fire-rate stagger → ring/wobble the crosshair + restrained tinnitus when melee/concussion blocks firing. **POLISH**

## 09 · COMBAT TRUTH, STEALTH, STATUS EFFECTS
**The unified status strip is the highest-leverage new component in this brief** — it replaces multiple one-off timers and gives every victim-side state a consistent home.
- Damage direction → short red directional arcs by attacker bearing (no heavy full-screen flash). **BUILD**
- Low ammo/empty → ammo turns amber at low, signal red only when empty/can't-fire; numbers stay dominant. **BUILD**
- Reload → ring around the ammo count; time only when it helps; completion holds briefly. **BUILD**
- Target health → only on hover/aim/engagement; curved ring on living, hard-corner on machines. **VERIFY**
- Grapple/struggle → struggle bar *directly over the bodies*, showing progress AND reversal (not just a label). **BUILD**
- Pinged/tagged → red sensor chip + faint victim-only foot ring (you must know the enemy has vision on you). **BUILD**
- Inside smoke → soft grey edge vignette + short SMOKED chip. **BUILD**
- Marked/hunted → thin red crescent at top of screen + restrained heartbeat (victim-side truth). **BUILD**
- Psi link → thin tether visible only to linked players + timed chip. **BUILD**
- Spawn protection → wire shell thins as it expires; the end holds then fades (you see it actually end). **VERIFY**
- Cloak → keep alpha; add heat-haze ONLY while moving (stillness becomes a verb). **POLISH**
- Blind/concussion → white-noise bloom that collapses over the true duration; preserve HUD contrast + reduced-flash. **BUILD**
- **Unified status strip (above vitals)** → one chip row for overcharge/slow/possession/EMP/encased/protected/marked/pinged/smoked/linked: icon, short label, radial wipe, source edge, hold, fade. **BUILD**
- Encased in ice → spreading crack decals driven by struggle progress + `MASH — BREAK` / `HOLD — BLEED`. The ice IS the meter. **BUILD**

## 10 · VEHICLES & AIRCRAFT
Explain *why* controls are unavailable, *what* the platform can spend, *what* happens next. Don't make pilots infer system state from failed input.
- Afterburner → stretch flames on thrust axis + heat-shimmer + pitch-bend; threshold = vapor cone-ring + delayed boom (after critical readouts). **POLISH**
- **Altitude band → three-step ALT ladder with climb/dive hints; air markers gain one ring per altitude band.** **BUILD**
- Rotor spool → weapon/system fill grammar for SPOOLING + widening dust ring. **POLISH**
- Jet stall floor → teach once on entry `AIRSPEED — NO HOVER` (no permanent label). **BUILD**
- Missile inbound → critical warning tied to actual seeker homing (not generic nearby projectiles). **VERIFY**
- Flares → one pip per charge; burn immediately then show refill. **VERIFY**
- Bomb load / nuke armed → bomb pips; strategic weapon arms → every player gets a radiation chip + bomber gains a world hull strobe. **BUILD**
- Hotwire → lockpick ring around the hull; movement interruption snaps progress back. **BUILD**
- Abandonment/write-off → live HOTWIRE + WRITE-OFF mini-lines on the interaction prompt. **BUILD**
- EMP stunned → flicker system pips blue-white + `REBOOT` with live remaining duration (dead controls, never silent). **BUILD**
- Infected wagon → sickly drip icon + restrained spore smear. **POLISH**
- Ambulance heal bubble → ring breathes on the 1s pulse; lift green crosses from bodies that get a tick. **POLISH**
- Overload fuse → flash the whole vehicle block with `BAIL` + live 2s countdown (a justified full-module critical). **BUILD**

## 11 · LSWs, FORCE FIELDS, SHIELDS, GADGETS
The world exposes the rule; the HUD confirms ownership/duration/consequences — it doesn't replace the physical read.
- Signature cooldown → keep the meter; raise emissive on hands/prop during the final 20%. **POLISH**
- LSW drop countdown → inbound chip + tightening ground ring; minimap only if the world ring is insufficient. **VERIFY**
- Enemy threat tier → SKIRMISH/STRONGPOINT/SIEGE/EXTINCTION on first sight, then notches + silhouette carry it. **BUILD**
- Gargoyle perch → perch tile glows and cracks (attack the ground, not only the god). **POLISH**
- Chronos echo → breadcrumb + faint hourglass at the campable return point. **POLISH**
- Oblivion hole → the event horizon IS the meter; accretion speeds with charge, ring contracts during the fuse. **BUILD**
- Magnetar halo → curve incoming tracers into the halo and fizzle them (counterplay learned via visible physics). **POLISH**
- Leap/dive telegraph → a landing ring that tightens as the body falls = the actual dodge window. **BUILD**
- **Force-field body → soap-film boundary + interior drift lines; pull flows inward, push outward; victims see red, owners faint steel.** **BUILD**
- Field charge → caster energy IS the meter, labeled `OVERDRAW` while channeling; boundary brightens from the same value. **BUILD**
- Time field → SLOWED chip; inside, tracers/casings visibly slow (don't grade the whole screen). **BUILD**
- Shield dome → three crack stages for HP + mirror sheen that burns off when reflect ends. **BUILD**
- FPV link → static + compact LINK meter; energy bar labeled BATTERY while piloting. **BUILD**
- Turret hack/possession → flip team tint + 1s glitch on the housing at the transition. **POLISH**
- Mine arming → blink the lamp fast while arming, then hold solid (no floating countdown unless interacting). **POLISH**
- Gadget minimap layers → beacons/cameras/fields/smoke-fire/traps as owner-colored glyphs, strict priority. **BUILD**

## 12 · MODES, MINIMAP, FULL-SCREEN SCREENS
- Conquest capture → fill the point ring in the capturing team color + compact objective chip (same normalized value). **BUILD**
- CTF flag return → drain a slice from the event chip + dim the world flag as auto-return nears. **BUILD**
- Wave countdown → `NEXT WAVE` + live timer beside the wave chip (planning time, not a center interruption). **BUILD**
- Materiel purse → compact value near the clock only for roles allowed to know it (info access = rank perk). **BUILD**
- Weather / air-grounded → intensity ticks + struck-through aircraft glyph when air ops are disabled. **BUILD**
- You carry the flag → `YOU HAVE IT — RUN` once, then a cloth streamer on the carrier (no persistent banner). **BUILD**
- Carrion birds → *(LATER)* circle corpse clusters, scatter on nearby sprint/major landing — environmental intel.
- K9 nose → *(LATER)* the dog's head turns toward hidden threats before any ping — the animal is the readout.
- **Minimap layer priority (1→6):** player+immediate danger (never hide) → downed/objective-carriers (pulse, above contacts) → contacts (shape-coded, last-known hollow) → objectives/events (open rings/zones) → vehicles/assets/gadgets (hard-corner glyphs, cluster/fade first) → fields/zones (low-opacity, hide first).
- **Full-screen screens:** heavier frame kit OK (they don't compete with combat). One shell: left nav, central work area, right context. Armory compares loadouts; Codex reads live values; map exposes layer toggles; **scoreboard leads with objective contribution, revives, vehicle impact, team value — before raw kills.**

## 13 · ENGINEERING, ACCESSIBILITY, CONTENT
- **Live data contract:** UI reads normalized values + absolute timestamps from the sim; it never decrements authoritative timers locally.
- **State + event:** persistent truth is state; entry/interruption/completion/expiry are events used only to animate transitions.
- **Reusable components:** implement `OrbitMeter, PipBank, StatusChip, WorldMarker, AlertQueue, TacticalMapLayer, InputPrompt` before any one-off widget.
- **9-slice + atlas:** convert frames to 9-slice; consolidate icons into an atlas with shared stroke/padding.
- **Debug gallery:** a dev screen that force-shows every state/timer/team/severity/interrupted condition at fixed resolutions.
- **Responsive:** anchor to safe zones, reflow optional rows, truncate names safely, reserve 35% text expansion.
- **Performance:** pool world marks, cull off-screen indicators, cap low-priority transient marks, no per-frame layout allocation.
- **Accessibility (required):** shape+color redundancy · 80–150% UI scale + adjustable safe frame · reduced-motion/flash static alternatives · audio redundancy both ways · strong contrast · device-correct input glyphs (update on input-method change) · no text baked into textures · configurable team colors that keep the amber/red/steel semantics.
- **CONTENT RULE:** never bake a gameplay number into art/tooltip/hand-maintained constant when the sim owns it. Codex, HUD, and menus read the same source of truth.

## 14 · DELIVERY PLAN & BUILD ORDER
*Sequence matters — don't spend the team on decorative world-intel while players hit silent lockouts or invisible victim states.*
- **GATE A — FOUNDATION (lock the grammar):** color/shape tokens, type scale, 9-slice frames, OrbitMeter/PipBank/StatusChip/WorldMarker/AlertQueue, debug gallery. *Exit: all components render idle/active/critical/complete/interrupted/expired at reference resolutions.*
- **GATE B — VERIFY SHIPPED (stop regressions):** downed banner/rings, revive arc, grenade refill + pouches, missile warning, flares, spawn shield, LSW inbound, offline hover. *Exit: a test script proves every shipped pattern reads live state, online + offline.*
- **GATE C — CLOSE GAMEPLAY GAPS (make hidden truth visible):** SAM lock, encased struggle, unified status strip, charge ring, victim-side marks, altitude/bombs, hotwire/EMP, force-field bodies, objective progress. *Exit: 10-min mixed combat produces no unexplained trigger refusal / control loss / state transition.*
- **GATE D — TACTICAL DEPTH:** minimap gadget layers, CTF return, wave timing, weather/air-grounded, materiel, expanded map layers, screen consistency. *Exit: players plan without opening a separate screen for routine info.*
- **DELIGHT LAYER (only after Gate C):** afterburner vapor cone, delayed boom, humidity, grass flattening; carrion birds; drag furrows, K9 head turns, mine lamps, hack glitches, ambulance particles; weapon emissive wind-ups, curved Magnetar tracers, crack/dust language.
- **PRIORITY RULE:** *a missing explanation beats a prettier effect.* Build the readout that prevents wrong decisions first; add the memorable effect second.

## 15 · DEFINITION OF DONE / REVIEW / DECISIONS
**Done when:** *Comprehension* — within 5s a player IDs health, action-readiness, immediate threat, objective state, and the cause of any lockout · *Causality* — every critical state has a source-adjacent readout · *Data integrity* — HUD/Codex/map/menus agree (same sim values) · *Interruption* — every progress component distinguishes complete/interrupted/cancelled/expired · *Accessibility* — color redundant with shape, reduced-motion/flash preserve meaning, muted audio playable · *Resolution* — no overlap at 720p/1080p/1440p/3440×1440/4K with supported scales · *Density* — readable under max feed/status/contact/objective/world-marker load · *Input/localization* — prompts swap device glyphs immediately, translated strings fit or truncate without moving dominant data.

**Review:** use the debug gallery for a fixed screenshot set per component/transition · playtest at full color / desaturated / reduced-motion / muted · **ask players what happened and why before asking whether it looked good** · record every valid-control-press-with-no-visible-explanation · never approve a component from a static mockup alone (verify interruption, stacking, expiry, high-density in motion).

**Locked decisions:** reference canvas 1920×1080, 80–150% scale, 16:9 safe frame on ultrawide · one condensed display face + one utility sans + tabular numerals, no third family · **cyan = team identity, amber = personal ownership/readiness** · compact always-on minimap + hold-to-expand · **six visible status chips, deterministic priority, overflow = +N** · weapon silhouette only as a small recognition cue (remove if it doesn't aid identification in playtest).

> **FINAL DIRECTION:** *Do not add more HUD until the existing state space has a clear ownership model. The strongest version of this UI is not the one with the most widgets — it's the one where the battlefield, the body, and a small number of consistent components make every important rule obvious.*

---

## 16 · SHIPPED AGAINST THIS BIBLE (reconciliation — updated as slices land)
What's already live and where it maps:
- **§02 "shrink the weapon block 20–30%" + §07 "silhouette must not occupy most of the panel"** → **DONE** (`6f96fe9`): the weapon-cam plate was ballooning to ~⅓ screen; capped block 17rem / plate 13rem, lines wrap. Plate 640px→187px.
- **§09 grapple/struggle + §03 world-teaches-first** → the melee **pulse-ring** (`6c7549b`): grab reaches pulse outward, guard lights a blue 150° arc under the body.
- **§09 unified status strip** → **DONE** (`0d78808`): the StatusChip + priority-ordered strip above vitals (ICED/HUNTED/PINGED/INFECTED/POWER/LINK/SMOKED/CLOAK/SHIELD, 6+N).
- **§09 grapple/struggle bar OVER THE BODIES** → **DONE** (below): a world-space billboard over each grabbed body — fills amber→green as they break free, flips RED on the choke reversal; not a corner label.
- **§06 reticle response + §05 shape/spread honesty** → the **ground spread-circle** (`c22da2f`): a ring at the aim point sized to the weapon's live `spread` — shotgun wide, pistol tight, "derived never transcribed."
- **§08 grenade-pip pattern / §09 low-ammo** → the **ammo dwindle strip** (`13f2279`): rounds as pips that empty as you fire, red at ≤25%. (Aligns with "pips for discrete inventory," not a vague bar.)
- **§13 debug gallery direction** → the **regenerating range dummies** (`3ee67e3`) are the first step toward the debug/harness sandbox that force-shows states.

## 17 · ADDITIONS FROM ROBERT'S LIVE DIRECTION (improvements to fold in — he said "if it's missing anything, improve it")
These extend the bible with his verbal direction and are treated as part of it:
- **The reticle SET (extends §06 Reticle response):** **5 selectable reticles**, each **scalable** to aim distance, **customizable per weapon**. The ground spread-circle (§16) is one; add a "**choose how far**" knob (the circle's distance from the player is adjustable).
- **STEALTH — the footstep/noise mechanic (extends §09):** no dedicated sneak key. Full-speed non-sprint movement for **~2.5s** (scaled by the **AGL proficiency**) before **footsteps start = you become AUDIBLE**; stop before that and stay silent; sprint = always loud. **Bring back the ground sound-ripple** (the "see-through white thing" on the ground) as the audible-noise world-marker (§04 world-space), restyled in this language.
- **LOOT (extends §08 weapon block / §04):** a dedicated **loot button** (pick-up action, not just walk-over) with a world prompt.
- **LOADOUT SLOTS (extends §07 vitals equipment badges):** one **PRIMARY** (large) **or** two **SECONDARY** (a small secondary + a gadget) — "room for one large or two small," shown as **slots**, not text lines (§02 "better use of space").
- **§10 Altitude band** — Robert wants the top band to read **higher** (distance = the aircraft/helicopter advantage) and is considering a **4th cloud/mountain band**. *Owned by the parallel **LSW-flight-combat worktree** — do not touch the altitude bands from the main lane (collision risk).*

*Parallel worktrees to coordinate with: **LSW flight combat** (owns §10 altitude), **the announcer** (owns audio/VO; `SOUND_NAMES` is append-only). See `docs/META-LAYER.md` §C.*
