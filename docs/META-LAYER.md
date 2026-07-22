# THE META-LAYER v2 — THE CALLS ARE IN
### Robert answered the forks 2026-07-21. This is the clear plan he asked for — nothing builds until he reviews it.

**His brief, round 2:** *"I want you to be my creative partner… take what I'm saying in the place right now… I would definitely like for you to write something up for me… Don't move forward until you got a clear plan."*

**Standing guardrails:** the loop stays COMBAT · everything additive ("don't allow me to destroy things") · N countries in the META, every battle stays 2-sided · faction names are PLACEHOLDERS until his spreadsheet · **"I don't want you to bring over too much from superhero tactics that we don't actually need"** — imports are lean, data-only, pulled when a feature needs them.

---

## 0 · DECISIONS LOGGED (the four forks, called)

| Fork | His call | What it means |
|---|---|---|
| **F1 Integration** | **(A) ABSORB — "Yes… take whatever data you need"** | SHT stays where it is; War World imports its *data* (countries, cities, orgs) feature-by-feature. Lean: only what a shipping feature actually consumes. |
| **F2 Faction identity** | **(B) TEMPLATE — "You can use that as the template. Yes."** | The roster is *Consequences of Failure* fictional governments built ON SHT's stat schema (cloning policy, science, GDP, military budget, crime, culture). Names/presidents stay placeholders until his spreadsheet names them. |
| **F3 Three tracks** | **CONFIRMED — science→clones · military→money · personal→locker** | (Renamed from "tanks" — they're resource *pools*, and the word collided with vehicles.) Each mission family pays its own currency. |
| **F4 Individual stats** | **ON — "Let your character have stats… keep it relevant"** | Per-character stats born at character creation, each mapped to something you FEEL: **Dexterity → reload speed · Strength → melee damage** (+ 1-2 more, tuned so no dump stats). Balanced, visible, class system stays. |

**F3 clarification that changes the design:** *"I didn't necessarily mean a locker you could lose just so you could have something taken away from you."* The personal track is not loss-as-punishment — it's **a life outside the war**. The locker is your persistent collection ("all the stuff you collect when you play"), and its in-match presence is a **physical locker building you have to walk to** to pull a personal weapon — *"and I think it would be cool if it could be destroyed."* Destruction denies access this match; it doesn't delete your stuff.

---

## 1 · THE PERSONAL TRACK — the world outside the war

His words: bounty hunter. *"You wanna literally just go around and just hunt bad guys and fight people… they should be able to do a bunch of different things"* beyond mass war. And: **"we need to have smaller scale combat, with clear, direct—"** (objectives).

- **Bounty hunts** — small-scale, few-vs-few or 1-vs-target missions. Hunt a named bad guy. Pays the locker.
- **The dream he flagged** (down the line, "that's too dope"): two real players silently sent on **opposite missions** — one guarding the thing the other was sent to take. The bounty *is* another player's mission.
- **The frame he wants:** the two sides are *"always fighting over something"* — every small mission is a tug on some contested thing, so even personal play feeds the war's story.
- Rides on: the quick-modes system (safehouse/duel yards already exist), the mission system data, the locker.

## 2 · THE BUILDINGS OF WAR — bases become places

His concrete roster, each budgeted from the war chest (*"however much money is budgeted for that initiative"*), each a real target:

| Building | Function | Notes from him |
|---|---|---|
| **Resupply point** | ammo/equipment refill | "we need a way to resupply" |
| **Personal weapon locker** | walk to it → swap to a personal weapon from your collection | **destroyable** — denies it for the match |
| **Cloning vat** | the physical home of the clone reserve | "the VAT" — science track made visible |
| **Engineering bay** | repairs vehicles (the truck lives here) | the truck itself gets **tech-gated** ("held behind some type of science thing") |
| **Hospital** | medical — healing/infection treatment | pairs with the outbreak cure chain |
| **Helipad** | helicopters are coming, "of course" | *"maybe the helipad is on top of the vehicle repair thing. How cool would that be?"* — stacked structure |
| **Factory** | manufacture during the match (engineer verb?) | "maybe that's part of the vehicle repair" — could merge with the bay |
| **Docks** | boats + water maps are coming | with the water/forest world growth (§6) |

Money law attached: **clear winners** — *"when you have money, you either gotta win or you gotta lose."* Match outcomes must be decisive so the payouts mean something.

## 3 · THE SCIENTIST HUNT — the first science mission, fully designed by him

*"The people gotta come in, they gotta find out WHICH HOUSE the scientist is in. And then they gotta kill the scientist. The other team knows who the scientist is and they gotta protect them — guide them around. The scientist could go upstairs, hide in a corner, in a hole, whole neighborhood."*

- Asymmetric VIP round: **HUNTERS** (don't know the house) vs **GUARDS** (know, escort, can reposition the VIP).
- The scientist is an AI civilian-class unit (slow, unarmed, hides) the guards shepherd — upstairs floors, interiors, the whole neighborhood as the haystack.
- Science track payout: guards hold → clones tick up; hunters kill → deny + steal science.
- Rides on: houses + upper floors (shipped), the upstairs-LOS work (shipped this week), bot escort behaviors, `docs/SCIENCE-MISSIONS.md` (this is its "protect the asset" verb, made concrete).
- Named placeholder: **Dr. Voss** (his name for it — keep until the spreadsheet).

## 4 · PEDESTRIANS — the street isn't empty (open design)

*"What will pedestrians do? …you know how now you just shoot your gun reckless — but what if it was a small hallway…"*

The point: **civilians make fire discipline real.** Directions to explore with him/Chris:
- Collateral cost — hitting a pedestrian bites the war chest / your standing (money law gives this teeth).
- Information — pedestrians as the neighborhood's eyes (they saw the scientist's house; they panic and point).
- Terrain of flesh — crowds block lanes, force muzzle discipline in hallways, give infiltrators cover.
- Outbreak fuel — in outbreak modes a dead civilian is a corpse on the reanimation clock. (Dark. Probably correct.)

## 5 · THE CHARACTER IS THE ROOT

*"A lot of it is rooted in the character being down… the voices and all that."* Priority statement — the Pattern/JA2 layer isn't a someday, it's load-bearing:

- **Character creation** = Pattern registration (Q1 country → your government; Q2 typed city → accent) + **stat allocation** (F4).
- Stats stay visceral: DEX→reload, STR→melee damage; candidates for the other axes: AGL→slide/roll recovery, GRIT→suppression resistance. No spreadsheet-stat that doesn't map to a feeling.
- The government you enlisted with sends you missions and *"provides you with stuff"* — your country's stats (crime, science, cloning policy) tint WHAT it sends.
- His half-idea, parked as an open question: a character could **become an LSW** permanently ("actually, I don't know. Maybe that's too crazy"). Not in plan; on the questions list.

## 6 · THE WORLD GROWS

- **More fronts** — *"the country might need to be a front… every city."* Direction: fronts scale toward city-level (SHT's city table is the source when we get there).
- **The mountains map** — *"I really think we need that map, with them in the mountains."*
- **More forest** + his mechanic: *"when you see your enemy, you gotta cut off the top of the tree so it's visible"* — destructible treetops as vision plays.
- **Water**: docks, boats; **air**: helicopters (helipad in §2).
- 3+ storey buildings reconnect here (the scientist hides "upstairs… whole neighborhood") — currently deferred, will be wanted for neighborhoods.

## 7 · THE RIG DEBT + THE BUTTONS (owed to the combat loop NOW)

He's right and it's on the record twice: *"We never updated the models… that little harness, the paper doll… we need variations… **we need to change that model, bro, so we can get these movements. I feel like you're doing stuff for movements that we can't even really do.**"*

- **The rig must READ the movement verbs** we shipped: slide (low skid), roll (full revolution), dash lean, coil-leap, mantle, guard brace, grapple holds, elbow strike. Today's body language is minimal-to-invisible on some of these. This is a harness/animation pass: new poses + stronger silhouettes, verified per-verb in `/harness.html`.
- **Model variations** — the paper-doll body needs its long-promised variant pass (per-class/faction silhouettes).
- **Buttons**: full map exists in code (WASD · SHIFT sprint · C crouch/slide · SPACE jump-coil · double-tap dash/roll · F melee-charge · V guard · Z grapple · G grenade · Q ability · E use · R reload · B ammo · X nade-cycle · T torch · TAB board · 1-3 slots) but there's **no controls screen**. Build one; audit against genre convention ("traditional stuff in the world of these type of games"); he signed off Q/E for plane altitude.
- **Lean: does not exist yet** (honest answer to "we got a leaning functionality?" — only the dash's *visual* lean). Peek-lean (Q/E on foot? contextual?) enters the queue with the buttons audit deciding its key.

## 8 · THE FIGHTING GAME — grappling gets consequential

*"We bring the whole fighting mechanic. We improve the grappling and it's more consequential when you grab them from behind."* This blesses the already-specced **Control Struggle** (§15 of the outbreak spec): attacker-driven Control Zone vs defender's Break Needle on a shared track, best-of-three, rear-grab advantage — the rear takedown (shipped) becomes the finisher tier of a real contest. Next combat-loop slice after the plan is approved.

---

## 9 · THE BUILD ORDER (proposed — he confirms)

Two tracks run in parallel: the **COMBAT TRACK** (the loop's lane, keeps the game feeling better every week) and the **META TRACK** (the new spine). Slices stay small, gated, proven on screen.

**COMBAT TRACK (continues immediately):**
- **C-1** The rig pass — movement verbs visible on the body (§7). *He named it twice; it's first.*
- **C-2** Controls screen + buttons audit (+ decide lean's key).
- **C-3** Control Struggle minigame (§8).
- **C-4** Held beams → beam clash → the rest of the ledger, in STATUS order.

**META TRACK (starts on his GO after this doc):**
- **M-1 The war chest** — money spine + clear win/lose payouts (§2 money law). Everything prices off this.
- **M-2 Governments-as-template** — placeholder-named roster on SHT's stat schema; enlistment picks your government (president + slogan surface).
- **M-3 Character creation v1** — Pattern Q1/Q2 + stats ON (F4). Voices follow.
- **M-4 The buildings, one at a time** — resupply → vat → engineering bay → locker → hospital → helipad/factory (§2), each priced.
- **M-5 The Scientist Hunt** — first science mission (§3), paying clones.
- **M-6 Bounty hunts** — first personal missions paying the locker (§1); smaller-scale modes.
- **M-7 The world** — city-fronts, mountains map, treetop cutting, docks/boats, helicopters (§6).
- **M-8** Pedestrians (§4) once their role is chosen.

## 10 · WHERE WE ARE — his asks vs the ledger (the review he requested)

| He asked | State |
|---|---|
| Gun kill DISTANCE shown | ✅ per-weapon ledger shows `N CONFIRMED · 62u` longest-range (marksman guns); AAR "Longest Shot" award |
| Vehicle-TYPE kills shown | ✅ tracked + AAR vehicle-killer award |
| Weapons visible in a UI room | ✅ `/armory.html` visual armory |
| Re-select class/loadout after each death | ✅ quick modes death re-select |
| Way more end-of-match detail | ✅ rich AAR (awards, ledgers, timelines) — will grow again with money/stats |
| Iron eaters NEVER with zombies + endless selector | ✅ horde roster selector (zombies / iron eaters / both) |
| Newspaper after the match | 📋 queued (his "might be the move" — now inside M-1/M-2 era) |
| Fire system | ⏸ paused on his word |
| Movement verbs (dash/roll/slide/leap/mantle) | ✅ in the sim — but §7 is right that the BODY undersells them → C-1 |
| Lean | ❌ doesn't exist → C-2 decides its key |
| Buttons/controls screen | ❌ map exists in code only → C-2 |
| Mountains map | ❌ → M-7 |
| Grappling more consequential | 🔨 rear takedown shipped; Control Struggle next → C-3 |
| STATUS ledger overall | **80 ✅ / 103** — remainder is big systems (beams, multiplayer stack), 🎯 decision rows, and the meta rows this doc absorbs |

## 11 · OPEN QUESTIONS (for him + Chris)

1. **Stats roster** — DEX and STR are set; which 1-2 more axes? (proposed: AGL→movement recovery, GRIT→suppression resist)
2. **Pedestrians' primary role** — collateral cost, information, cover-chaos, or outbreak fuel first? (§4)
3. **Character→LSW permanent ascension** — in or "too crazy"? (§5)
4. **Factory** — its own building or folded into the engineering bay? (§2)
5. **Fronts→cities scale** — how far now: keep 10 fronts with city NAMES, or a real city map per front? (§6)
6. **Opposite-missions PvP** — hold for the multiplayer stack, or prototype vs bots earlier? (§1)
7. **The spreadsheet** — whenever the government names arrive, placeholders get replaced everywhere in one pass.

---

*Nothing above is being built yet. On his review: the COMBAT track resumes at C-1 (the rig pass) and the META track opens at M-1 (the war chest) — folded into `docs/MASTER-BACKLOG.md` as ritual rows, one gated slice at a time.*

---

# META-LAYER v3 — THE BIG REVIEW (2026-07-21 pm, Robert's firehose)

Robert reviewed everything, played the beam gods, gave the data he'd promised (`Country Master Sheet` CSVs + the whole **`D:\git\COF`** story universe), and dumped a large vision plus a ChatGPT-organized **Goals 09-18** architecture. His framing: *"some of this is trash... but our countries and cities and story is key,"* and — critically — **"I almost wanna have multiple agents working on this. You just tell me what I could tell them to do and you don't touch. Like, the UI/UX, you gotta do that."**

So the work splits into **two lanes**: what **Claude builds** (combat/UI/UX, hands-on) and what **Robert dispatches to other agents** (the strategy spine — I write the specs, he runs them).

## A · DECISIONS LOCKED THIS PASS (additive to v2)

- **The game in one line (his synthesis, blessed):** a persistent global war where you **enlist under a country** and serve three paths — **Operations** (combined-arms war, risks materiel), **Expeditions** (small science, risks reprints/discoveries), **Private Matters** (solo/2-player personal, risks your name/gun/body). Operations capture sites -> Expeditions unlock tools -> Private Matters recover people/property -> the newspaper records it -> the next Operation starts changed.
- **Matchmaking correction (important):** countries give IDENTITY; **COALITIONS give matchmaking** (a few wartime coalitions assemble teams so 168 countries != 168 dead queues). Every battle still 2-sided (v2 law holds).
- **Detective idea is NOT a fourth game** — combat-first personal casework: Lead -> Pursuit -> Resolution on systems we already have.
- **Secretary of War = a 3-layer hierarchy:** Secretary (treasury %, priority front, doctrine) -> Theater Commander (front ops) -> **Operation Officer** (buys the match manifest). The **right-click command wheel (row 110) is the Operation Officer's tool.** Launch order: AI/default doctrine -> human Officers -> public ledger -> safeguards -> elected Secretary.
- **Individual stats = PROFICIENCIES, never a hidden aim-roll** (firm — aiming stays the player's job): Weapon Handling, Endurance, Melee, Field Medicine, Engineering, Science, Driving, Piloting, Investigation, Nerve. STR set; **AGL confirmed** (his Spider-Man leaping -> tie to the shipped leap/slide). Bonuses 5-10%; newbies stay competitive. **NO gender/ethnicity combat modifiers.** He REJECTED "GRIT" (seen elsewhere). Health derives from STR around today's average. Apply it INTELLIGENTLY (no per-tick juggling that slows the sim).
- **Locker = life outside the war:** ISSUE (replaceable) / serialized OWNED (drops, persists, recoverable — a lost gun reappears in another player's hands / black market / recovery mission) / MISSION tools (extract) / IRREPLACEABLE mementos. Everyone gets one immediately.
- **The PRINT LIBRARY (new, big):** the cloning vat's second use — buy prints (classes/personalities). Start with ONE; acquire more; a print can be permanently an LSW ("Pokemon shit"), carry a zombie gene, or a small chosen ability. Aging-cream lore = clone reaches adult fast (COF canon).
- **Pets** — dogs + **birds**; cloneable. **Buildings: TWO+ uses each** (radius / inside / a third). Engineering Bay = its own building (research + character gear); Factory folds in.
- **Newspaper = persistent world memory:** After-Action Extra per match + Daily National Edition (front map, treasury, obituaries, MIA, **lost serialized weapons**, wanted notices) — **clicking a story launches its mission.** Kill a pedestrian on a personal mission -> sued / in the paper. Facts first, per-country spin second.
- **Indoor generation by SHT city types** — residential / commercial / industrial. *"Actually use the city types from Superhero Tactics. BOOM."*

## B · WHAT CLAUDE BUILDS NEXT (combat/UI lane — hands-on, gated)

1. **Guns too big on screen** — *"take a screenshot... taking up too much of the screen."* Shrink the viewmodel/weapon-cam. FIRST. (BEAM bugs already fixed this turn: through-vehicles, energy drain, impact splash.)
2. **Kill the melee minigame; rebuild the feel** — remove the Control Struggle needle game ("eliminate the minigame", said twice). Keep: grab-from-behind, win-the-grab-they-can't-loose, human shield, disarm/choke/throw. Add: break-out **knocks the grabber back** (anti-spam) [DONE 6796d6e] + a **pulse-ring UI** (guard = blue 150 arc; grab = a ring that pulses outward to the grab radius) [DONE 6c7549b]. Remaining: rock-paper-scissors polish + the block-both-sides ring refinement.
3. **The authored HUD element system is unused** — *"I feel like that died."* Wire it in; **show AMMO as a dwindling segmented bar** (like the reload meter, rounds ticking down — ideally the actual bullets, by gun/ammo type).
4. **Beam feel — the Kamehameha** — a slower **projectile-front** stream that LAGS your aim (harder to redirect), charge + width control, force-vs-pierce ratings; needs a real **beam lab**.
5. **Unify the HARNESS** — one test bed: weapons/abilities/melee, **regenerating dummies**, sneak-up scenarios (1/2/3 in a room), switchable **sounds** (shotgun, reload-by-type). Unblocks HIS testing ("I'm kind of stuck, all I can do is play").
6. **Bilateral fire** (beams/projectiles from left AND right; Magnetar's center-fire he liked) + melee weapon models (knife/katana) -> codex.
7. **Force-field capsule power** — a character-worn bubble that soaks fire (ice character firing icicles from inside). Reuses the shield gadget.
8. **Combat-sim modes** (his testing method + fun): hoverboard **RACING** (ghosts, visible track, on-screen announcer words) + tank **COMBAT** (Atari-style, low-vis field, dust, pickup ammo). Double as the test bed.

## C · WHAT ROBERT DISPATCHES TO OTHER AGENTS (strategy spine — I write specs, you run them)

Each is a self-contained brief for a capable agent, armed with the CSVs + `D:\git\COF` + this doc:

- **AGENT-1 Nations & Coalitions** — ingest the two CSVs to typed WW data; enlistment (country+city+president+slogan+culture region); the coalition matchmaking layer. Absorb, lean.
- **AGENT-2 City-data mission generator** — `Mission Weight = Base x Local Need x Unresolved Consequence x Career Fit x Front Relevance x Variety` over city attributes; the story->mission board.
- **AGENT-3 The garrison town** — modular national garrison (8-12 kits), 7 stations, 30-second-walk + quick-menu, two-uses-per-building.
- **AGENT-4 Newspaper-as-memory** — After-Action + Daily National editions over real facts; click-to-launch-mission; per-country spin. Builds on the shipped Front Courier.
- **AGENT-5 COF lore integration** — read `D:\git\COF` (bible/canon/prose); WW as an alternative-timeline slice; the naming pass that replaces placeholders; aging-cream/print/LSW-gene lore. Pairs with Robert; a creative (Fable) model fits.
- **AGENT-6 Stats/proficiency system** — the 10 proficiencies, a PERF-SAFE application model (design before code), occupation->starting-proficiency, the 5-10% band, health-from-STR.

**The vertical slice to prove it all:** one nation + one coalition enemy + one garrison + one president/newspaper + one front + default doctrine + one Officer procurement phase + one Operation + one Expedition + one lost serialized weapon + one solo recovery Private Matter + one newspaper chain linking all three. *Capture an airfield -> science Expedition -> lose a gun/person -> newspaper story -> pursue & recover -> return to a changed garrison.*

## D · ROBERT'S DIRECT QUESTIONS — ANSWERED

- **GitHub health:** green — main synced with origin, tree clean, 471 commits, 5.1 MiB pack. Stale `worktree-agent-*` + `feature/maps`/`lsw-combat`/`ascendants-wave1` branches are prunable (cosmetic).
- **Another AI on a worktree:** `git worktree add ../ww-nations -b agent/nations` = an isolated checkout on its own branch; merge by PR when green. This repo already uses that pattern. I can also spawn my own sub-agents in worktrees for research/scoping.
- **The Fable model:** say when — I can run sub-agents on it; it fits the lore/design briefs (AGENT-5).
- **The spreadsheet:** received. Both CSVs read + logged. The naming pass (AGENT-5) replaces placeholders from them.

## E · WHAT I'M NOT DOING (still)

Not building the strategy spine solo (§C is yours to dispatch). Not renaming factions until the COF pass. Not touching the 2-sided combat law. §B is mine to ship one gated slice at a time; §C is specs awaiting your agents.

---

# META-LAYER v3.1 — THE UI DIRECTIVES + STEALTH (2026-07-21, screenshots + firehose)

Robert sent the game screenshots + his authored **UI MASTER reference sheet**, and a design dump. Progress + new orders:

## SHIPPED off the screenshots
- **Guns too big — FIXED** (`6f96fe9`): the weapon-cam plate ballooned to ~⅓ of the screen (the block had no max-width, `ammo-info` was nowrap). Capped block 17rem / plate 13rem → plate 640px → 187px. **Remaining (deeper): the HELD gun on the character isn't gripped/animated right in-game** — Robert: "the character doesn't move right or hold the gun… we did that with the other model, the grip, kickback, the harness — I don't understand why we ain't got it." A rig-in-game investigation (the harness rig work isn't reaching the live third-person body). NEXT hands-on after this.

## THE UI DESIGN LANGUAGE (his UI MASTER sheet = the authoritative reference — build TOWARD this)
- **Shape is a channel:** friendlies = light-blue **circle** · enemies = red **triangle** (over them) · memories = gray **diamond** · machines = gray **square** · neutrals/objectives = **ring**.
- **Palette:** accent (yours/ready) `#e8a33d` · danger (enemy/alert) `#ff3b30` · info (steel) `#a7b0b8` · success/health (green) `#4cd964`.
- **The laws (his):** near the action, on the body/target/reticle · derived, never transcribed · one accent · world teaches first, HUD confirms · states HOLD then fade · nothing blinks out.
- **Better use of space:** show mines / grenades / gadgets in SLOTS (a compact inventory row), not long text lines. The plate + bag lines waste the corner.

## THE RETICLE SYSTEM (his detailed spec — a real slice)
- **5 aim reticles** the player can choose, and each **scales** to how far you're aiming.
- **Per-weapon reticle** — the receptacle changes with the equipped weapon.
- **THE GROUND SPREAD CIRCLE (the big one):** a circle on the ground at your aim point, **auto-sized to the bullet-spread radius** (shotgun = wide, pistol = tight), that **rotates around you** as you aim, not attached to the body. "Within that circle is where your bullets land — keeps the system honest and balanced." This is a live, honest spread-visualizer tied to the weapon's `spread`.

## STEALTH — the sneaking mechanic (new /goal, detailed)
- **No dedicated sneak key** — it's emergent from movement time. Move at full speed (no sprint) for **~2.5s** (AGL scales this window) → **footsteps start** = you become AUDIBLE to enemies. Stop before that and you stay silent. Sprint = always loud, and you stop caring about your own noise.
- Ties directly to the **AGL proficiency** (§v2 F4) — high agility = a longer silent window.
- **Bring back the ground sound-ripple** — "seeing the sounds by seeing the ground, a little see-through white thing" — the audible-noise visualizer, restyled in the UI language.
- Feeds the **mini-simulation scenarios** he wants in the harness: sneak up / get caught / catch someone from behind (pairs with the shipped rear-control).

## LOADOUT + LOOT
- **Loot button** — a dedicated pick-up action (not just walk-over).
- **Slots:** one **PRIMARY** (large item) **or** two **SECONDARY** (a small secondary + a gadget). Room for one large or two small.

## THE ANNOUNCER (handed to a parallel agent — my read)
A separate window designed the full **"Command Net"** kit (dry corporate-war dispatcher). **My take: it's right and ready.** The voice isn't invented — it's already written in the shipping killstreak lines ("HR has been informed", "the enemy has filed a formal complaint"); voicing that register is the correct, consistent pick. The worktree isolation is correct (the announce path is text-only today at `hud.ts`; VO lives in `tools/gen-*` + `audio.ts`, minimal overlap with the gameplay loop). **The one coordination point I own:** `SOUND_NAMES` in `audio.ts` — the announcer agent must APPEND-ONLY so my weapon/VFX additions merge clean. LSW VO lane is off-limits to it (`gen-lsw-vo.mjs` owns per-god lines). "We don't need dynamic names" is correct — pre-gen static stingers, names stay on the text banner.

## FLIGHT ALTITUDE (his directive — but a PARALLEL WORKTREE owns LSW flight combat)
Robert: the 3 flight levels need to read **HIGHER** — the top band especially, "further from the ground, because when they're shooting you need distance, and that gives helicopters the advantage." He's considering a **4th band = mountains/clouds** (helicopters live up there, over the peaks, in the actual clouds). **COORDINATION: "another worktree is working on LSWs flight combat"** — the altitude-band heights touch flight rendering, so this is THEIRS or needs a merge plan. Claude does NOT touch the altitude bands unprompted (collision risk); logged here for that lane. (Two parallel worktrees now: LSW-flight-combat + the announcer.)

## §B REORDERED (Claude's hands-on lane, updated)
Done: beam fixes · melee-minigame eliminated · pulse-ring · ammo-dwindle · **guns-too-big (plate)** · **ground spread-circle reticle** (`c22da2f`). Next, in order: **(1) the held-gun grip/animation in-game** (why the harness rig isn't on the live body) · (2) **unify the harness** + regen dummies + sneak scenarios · (3) the **stealth footstep/noise** mechanic + ground-ripple · (4) loot button + loadout slots · (5) the 5 selectable reticles + the "choose how far" knob (builds on the shipped spread ring) · (6) wire the UI-MASTER design language (shape-channel marks, slot inventory) · (7) bilateral fire · (8) capsule force-field · (9) racing/tank sim modes. AVOID: altitude bands (LSW-flight worktree), audio/SOUND_NAMES beyond append (announcer worktree).

---

# META-LAYER v3.2 — MILITARY OPERATIONS SHIPPED (2026-07-21)

The first full strategy-path loop is now real. **Operations ship; Expeditions and Private Matters remain designed.** The Scar offers a pass-limited planning window where the Operation Officer commits treasury, ammunition, support, and named seasonal hulls. P1 teaches on a skirmish pocket, P2 moves to standard combined arms, and P3 opens a large front. The match runs ordered objectives plus a real complication, reports their state in the HUD and AAR, and settles losses and the selected strategic effect exactly once.

The return loop is also live: facilities, territory, materiel, air/sea control, doctrine, and intelligence modify later battles or campaign state; destroyed named vehicles remain lost until armistice; survivors retain sorties and vehicle-type kills; the dossier advances Command certification; and the Front Courier records the result from the enemy perspective. This completes the Operation link in the v3 chain—**Operations capture sites → the next battle starts changed**—without pretending the Expedition, persistent crew-person, PRINT, or Private Matter links have shipped.
