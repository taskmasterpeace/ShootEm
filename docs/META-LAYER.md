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
