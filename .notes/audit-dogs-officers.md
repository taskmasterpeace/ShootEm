# SYSTEMS AUDIT — DOGS/ANIMALS & OFFICERS/COMMAND

Code-read audit for the master systems document. Every claim below is grounded in a
`file:line`. Status legend:

- ✅ **WIRED** — the sim executes it; it affects play.
- 🟡 **PARTIAL** — real code runs, but scoped/gated/incomplete so most players never see it.
- 👻 **INVISIBLE** — the mechanic runs but produces no perceptible in-game effect, OR the data exists and is assigned but never read by the sim.
- ⬜ **UNBUILT** — named in fiction/labels only; no gameplay code behind it.

---

# PART ONE — DOGS / ANIMALS (go deep)

## Headline answer

**There is a REAL dog entity in the sim, not scaffolding.** A dog is a first-class
`Soldier` with `kind: 'dog'` (`types.ts:436`). It spawns, moves, paths, bites, deals
damage, takes damage, dies, and redeploys. It has a bespoke AI brain (`stepDog`), a
bespoke 3D model (a rigged German-Shepherd), a bespoke trot animation, a HUD control
panel, player key/gamepad bindings, and a network-replicated order state. The K9 order
system (`k9-orders.ts`) is fully executed on that real dog — orders are NOT issued into
the void.

**The only animal in the game is the military working dog (K9).** No birds, mounts,
wildlife, pests, or livestock exist as entities. Every other "animal" word in the code is
a metaphor (see the ANIMALS SWEEP at the end of Part One).

---

## DOG SYSTEMS

### 1. Dog entity & stats — ✅ WIRED
`data.ts:839` (`DOG_STATS`), `data.ts:96` (`dog_bite`), `data.ts:849` (`DOG_NAMES`), `world.ts:1613` (`addDog`)

- **What it does:** A dog is built by `addDog()` as a full `Soldier`. Stats
  (`DOG_STATS`): HP 60, speed 16.8 (~1.6× an infantryman — "nobody outruns the dog"),
  weapon `dog_bite`, `heelDist 4`, `guardRadius 18`, `noseRadius 10`. The bite
  (`dog_bite`) is a melee weapon: 16 damage, 1.6 rof, 2.0 range, claw sound, 🐕 icon.
  Each dog gets a real service name from a pool of 8 (Rex, Ajax, Bruno, Sable, Grit,
  Valkyrie, Koda, Havoc). `classId` is nominally `'infantry'` but the class is inert —
  the dog uses its own brain and its own single weapon `[DOG_STATS.weapon]`.
- **What remains:** Only one stat block for all dogs — no breed/size variants, no
  handler-bond stat, no per-dog HP/speed variance beyond the shared constant.
- **Open question:** Should dogs have distinct breeds/roles (scout vs. attack vs.
  detection) or stay a single archetype?

### 2. Fielding a dog (spawn ownership) — ✅ WIRED (auto), 🟡 PARTIAL (player agency)
`main.ts:1217-1224`, `server.ts:92-100`, `k9-orders.ts:27` (`k9HandlerForTeam`)

- **What it does:** Each fighting side **automatically** fields exactly one K9 in every
  mode except `range`, `paintball`, and races (`main.ts:1219`). The dog is paired to a
  handler chosen by `k9HandlerForTeam`: it prefers the local player (if the player's id
  is passed and eligible), else the first **bot**, else the first eligible soldier.
  Eligibility = alive, on-team, `kind` human/bot, `classId` **infantry or engineer**
  (`k9-orders.ts:30-35`). Multiplayer server does the same, pairing to the first
  infantry/engineer bot (`server.ts:96-99`).
- **What remains:** The player does **not choose** to bring a dog — it's automatic and
  only ONE per team. The player only *controls* the dog if they happen to be
  infantry/engineer (otherwise a bot owns it and the player has no panel). There is no
  loadout slot, kennel purchase, or "bring your dog" toggle.
- **Open question:** Should fielding a dog be a deliberate player choice (a loadout/kit
  slot, a rank perk, a purchase) rather than an automatic infantry/engineer freebie? Is
  one-dog-per-team the intended ceiling outside science missions?

### 3. Dog packs — 🟡 PARTIAL (science-only)
`world.ts:1613` (`allowPack` param), `science-runtime.ts:221-228` (`dogTeams`)

- **What it does:** `addDog(handler, allowPack=true)` bypasses the one-per-team guard, so
  **multiple** dogs can exist. This is used ONLY by science missions:
  `encounterBudget.dogTeams` spawns N dogs, each placed at a `dogPost` and paired to a
  guard (`science-runtime.ts:221-227`). So a science raid CAN face a pack of guard dogs.
- **What remains:** No pack *coordination* AI (they don't flank or hunt as a unit — each
  runs its own independent `stepDog`). Packs are unreachable in normal PvP/co-op modes.
- **Open question:** Should packs exist outside science (e.g., a "K9 unit" that fields
  2-3), and should a pack get group behavior (surround/relay) vs. N independent dogs?

### 4. The K9 order system (heel / sic / stay) — ✅ WIRED
`k9-orders.ts` (whole file), `types.ts:457-458` (`K9Order`/`K9Command`)

- **What it does:** Three orders exist: `heel` (default follow), `sic` (clear a building),
  `stay` (hold a spot). Player issues `sic`/`stay`; `heel` is the implicit return state.
  Order state is stored on the dog Soldier itself (`k9Order`, `k9BuildingId`,
  `k9OrderPos`, `k9StayAnchor`, `k9TargetId`, `k9Door`, `k9NextBarkAt`, `k9SearchIndex`,
  `k9ClearSince` — `types.ts:547-563`), so it **replicates over the wire for free** and
  the HUD/renderer read it directly. `setK9Heel/Stay/Sic` (`k9-orders.ts:75-119`) are pure
  state transitions. `issueK9Command` (`k9-orders.ts:172`) is the entry point: finds the
  handler's owned dog, validates it's alive, and either sets stay or resolves the aimed
  point to a building (`buildingAtOrderPoint`, with an 8-unit snap tolerance,
  `K9_BUILDING_SNAP`) and sets sic. Toggle semantics: re-issuing `stay` while already
  staying returns to heel (`k9-orders.ts:90-93`).
- **What remains:** No "fetch/carry", "guard this teammate", "track that specific enemy",
  or recall-to-vehicle orders. Sic is building-scoped only — you cannot sic on an open-field
  target or a point that isn't inside/near a building (`issueK9Command` returns
  `no-building`).
- **Open question:** Should `sic` work on open ground / a specific marked enemy, not just
  buildings? Are three orders the final vocabulary, or is there a "track/search this
  scent" and "return" the design wants?

### 5. `stepDog` — the K9 brain — ✅ WIRED
`bots.ts:1880-1989` (`stepDog`), dispatched from `world.ts:2378`

- **What it does:** The dog's per-tick brain, called from the world's soldier loop
  (`world.ts:2378: else if (s.kind === 'dog') { stepDog(...) }`). Priority ladder:
  1. **THE NOSE (always):** every hostile within `noseRadius` (10, includes a ×4 vertical
     term for floors) is added to `world.pinged` — cloaked or not (`bots.ts:1885-1892`).
  2. **Handler down/absent:** forces heel, freezes, scans ("ears up") (`bots.ts:1894-1902`).
  3. **stay order** → `stepK9Stay` (`bots.ts:1904`).
  4. **sic order** → `stepK9Sic` (`bots.ts:1908`).
  5. **Guard (default heel):** picks the nearest hostile within `guardRadius` (18) of the
     **handler** (not the dog) — a cloaked enemy beyond nose range is ignored unless it has
     a live ping (`bots.ts:1917-1923`). If found, it paths to and bites the target
     (horde-style pathing so walls don't save the target, `bots.ts:1926-1942`).
  6. **Indoor scent chase:** if no guard target, follows the strongest recent scent trail
     (`strongestDogScent`), barking "HAS THE SCENT", pinging the target
     (`bots.ts:1944-1965`). Window-hesitation slows it to 35% when crossing an unbroken
     window (`dogWindowHesitation`).
  7. **Heel:** if none of the above, trots back to `heelDist` (4) off the handler's
     shoulder, matching the handler's yaw when settled (`bots.ts:1966-1986`).
- **What remains:** Vehicles are ignored (`e.vehicleId >= 0` skipped); scientists are
  ignored as guard targets. No fear/morale on the dog, no stamina, no "lost the scent"
  give-up bark.
- **Open question:** Should the dog react to its own wounds (flee/whimper at low HP), or
  is a fearless attack dog the intent?

### 6. `sic` execution — building clear — ✅ WIRED
`bots.ts:1812-1872` (`stepK9Sic`), helpers in `k9-orders.ts:121-170`

- **What it does:** When siced on a building, the dog: finds hostiles *inside that
  building* (`hostilesInK9Building`), sorts by floor-distance + planar distance, drives to
  the nearest and bites it. With no target, it runs a **deterministic room/door sweep**
  using `k9SearchWaypoints` (indoor room centers if the map has interior tactics, else
  door→center), advancing a `k9SearchIndex`. If it reaches a **closed door** in its path
  it stops and BARKS "WAITING AT DOOR" every 5s (`dogWaitsAtDoor`, `bots.ts:1740-1762`) —
  the dog will not open doors itself; it waits for a human. After confirming the building
  quiet for 2s it announces "BUILDING CLEAR" and returns to heel (`bots.ts:1866-1870`).
- **What remains:** The dog can't breach — it's fully dependent on a human/teammate to open
  the door it's barking at. Metal doors and locked upper doors specifically block it
  (`closedDoorAhead`, `k9-orders.ts:165`).
- **Open question:** Is "dog waits, human opens" the intended tactical loop (dog as a
  flush-and-hold tool), or should engineers/handlers get a "dog breaches" upgrade?

### 7. `stay` execution — hold & bite — ✅ WIRED
`bots.ts:1790-1810` (`stepK9Stay`)

- **What it does:** The dog holds an anchor point (`k9StayAnchor`, set to its position when
  the order lands). It bites any hostile that comes within bite range + 0.5 while held, and
  self-corrects back to the anchor if pushed off (drift threshold 0.18u). A stationary
  guard-post/area-denial tool.
- **What remains:** No facing control (you can't tell it which way to watch); no "stay and
  be quiet" vs "stay and bark" distinction.
- **Open question:** Should `stay` accept a facing or a small patrol arc?

### 8. THE NOSE — anti-stealth ping — ✅ WIRED (this is the dog's whole reason to exist)
`bots.ts:1885-1892`, `world.ts:2419` / `2659` (perception consumes `pinged`), `perception.ts:60/146`

- **What it does:** Every tick, every enemy within `noseRadius` (10u, floor-aware) is added
  to `world.pinged`. `pinged` is the **same reveal channel** the spy cameras and loud
  events feed. Perception treats a pinged unit as visible **even through cloak**
  (`perception.ts:60`: "cloak is TRUE unless a mark reveals it"; `:146/:148`). So a K9
  near a cloaked infiltrator lights it up for the whole team's AI targeting and the
  seen-linger/minimap. This is load-bearing and fully wired — "with a K9 on the field,
  stealth has to sweat" is literally true in code. The ping cycle double-buffers
  (`pinged`/`pingedLast`, `world.ts:2190-2196`) so bots read last tick's marks.
- **What remains:** Nothing structural. The radius (10) and the fact that it's radial +
  floor-aware but ignores walls (a dog can "smell" an enemy through a wall within 10u) is a
  design choice, not a bug — but worth confirming.
- **Open question:** Should the nose respect walls (scent under doors only) or is the
  through-wall 10u bubble intended? Should it also reveal to the *player's* HUD explicitly
  (a scent-ping marker) rather than only feeding AI perception + minimap linger?

### 9. Indoor scent-trail tracking — 🟡 PARTIAL (asymmetric / mission-scoped)
`indoor-ai.ts:218-256` (`recordIndoorScent` / `strongestDogScent`), written at `world.ts:2201-2204`

- **What it does:** When the map has interior tactics (`indoorTactics`, created for any map
  with rooms — `world.ts:694`), team-0 human/bot operators lay a decaying **scent trail**
  each tick (`recordIndoorScent`, capped nodes, ~seconds of memory). A dog with no guard
  target follows the strongest recent trail node near its handler
  (`strongestDogScent`, `bots.ts:1944`).
- **What remains / the catch:** Scent is recorded **only for `operator.team !== 0`… wait —
  the gate is `operator.team !== 0` → continue, i.e. ONLY team 0 lays scent**
  (`world.ts:2203`). That means only intruders on team 0 leave a trail, so only an
  **enemy (team-1) dog** can meaningfully track it. A team-0 player's own dog reads its own
  team's scents (useless for hunting). This reads as tuned for the science/safehouse raid
  (team 0 = raiders, team 1 = facility guards + dogs) and is effectively invisible/one-way
  in symmetric PvP.
- **Open question (flag to owner):** Is the team-0-only scent gate deliberate (guard dogs
  hunt raiders) or a latent asymmetry that should be both-teams? This is the single biggest
  "is this intended?" in the dog code.

### 10. Bite mechanics — hold/haul — ✅ WIRED
`world.ts:4601-4606` (bite haul), `bots.ts:223-227` (windup), `world.ts:4517-4526` (zed bite hold, separate)

- **What it does:** A dog's bite is a melee swing (`startMelee(dog, dog_bite)`). On landing,
  besides the 16 damage, it applies a small **haul** — pulling the victim ~5 units *toward*
  the dog's jaws (`world.ts:4603-4605`) — "the added threat is space." Melee windup for a
  dog is 0.2s (quick but dodgeable, `bots.ts:226`).
- **What remains:** No prolonged "latch/pin" that immobilizes a victim (that exists for
  zombies via `BITE_HOLD`, but the working dog does not pin — it hauls and re-bites). No
  bleed/infection from a dog bite.
- **Open question:** Should a dog bite be able to *pin/stagger-lock* a target (a real
  takedown) rather than a repeatable haul-bite?

### 11. Dog death, respawn & redeploy — ✅ WIRED
`world.ts:1765-1778` (`spawn` dog branch), `world.ts:2210-2214` (respawn wave), `world.ts:2400` (purge exemption)

- **What it does:** A dog dies like any soldier (takes damage, `alive=false`). It does NOT
  draw from the armory or spawn queue — it **redeploys at its handler's side** with full HP
  and the same teeth, but **only once the handler is alive and back up** and it's past its
  respawn time (`world.ts:2210-2214`). If the handler leaves the match, the dog is deleted
  ("the dog goes home", `world.ts:2213`). Dogs are exempt from the corpse-purge that removes
  zombies/iron (`world.ts:2400`), and from the morale loop and the class-request loop
  (they're outside the org chart).
- **What remains:** No permadeath/"your dog fell" consequence carried between matches; no
  wounded-but-alive state; the bond is purely "spawns next to the handler."
- **Open question:** Should losing your dog carry a cost (a cooldown before it redeploys, a
  meta-layer "vet bill", a morale hit to the handler)?

### 12. Dog rendering & animation — ✅ WIRED
`models/soldiers.ts:136` (dispatch) & `:554-620+` (`buildDog`), `animation.ts:204-218` (trot), `renderer.ts:2966-2982` (order markers)

- **What it does:** `buildDog(team)` builds a real low-poly German-Shepherd: sloped
  shepherd body, black saddle marking, dark snout, pricked ears, a tail, and **four named
  leg joints** (`legFL/FR/RL/RR`) plus a team-colored **K9 service harness/vest** so you can
  read whose dog it is. The trot animation (`animation.ts:204`) swings diagonal leg pairs
  in anti-phase driven by ground speed, wags the tail (fast when working, lazy at heel),
  and drops the head into a run. Paws are silent (no footstep cue), dogs bark on events
  rather than growl. The renderer shows a floating **sic/stay marker sprite** above your own
  dog (`renderer.ts:2966`, `k9MarkerKind` in `k9-controls.ts:30`) and hangs the dog's name
  low (y=1.55 vs 2.55 for people, `renderer.ts:3088`). Dogs never wear an armory piece
  (`renderer.ts:2882`) and are excluded from certain overlays (`renderer.ts:5322`).
- **What remains:** Nothing notable — this is a complete visual treatment.
- **Open question:** None material.

### 13. Dog HUD control panel — ✅ WIRED
`k9-controls.ts` (state), `hud.ts:496-503` (update), `main.ts:729-730` (buttons), `styles.css:560-598` (panel), `input.ts:133-134,240-241,291`

- **What it does:** `k9ControlState` derives the whole handler panel purely from replicated
  sim state (visible only if the local soldier owns a live dog). Status readout:
  HEEL / STAY / CLEARING / "WAITING · DOOR" (`k9-controls.ts:18-20`). The `#k9-controls`
  panel (styled, mobile-responsive, hides in killcam/placement screens) shows a SIC button
  and a STAY/HEEL toggle button, disabled when no dog. Inputs: keyboard **K = sic**,
  **L = stay/heel** (`input.ts:133-134`); gamepad **L3 = sic, R3 = stay** (`input.ts:240-241`);
  on-screen buttons (`main.ts:729-730`); touch layer. Issuing a command emits a "K9 ·
  CLEARING/STAY/HEEL" announce (`world.ts:3266-3276`). The aim point for `sic` is computed
  from the player's yaw and a clamped 0-80u aim distance (`k9AimPoint`, default 12u).
- **What remains:** Panel only appears for infantry/engineer players (the only eligible
  handlers). Non-eligible classes get no dog UI at all.
- **Open question:** Should the panel show the dog's HP / distance / a "recall" affordance?

### 14. Iron Eater "junkhound" — ✅ WIRED but **NOT an animal**
`data.ts:834` (`IRON_STATS.junkhound`), `world.ts:1699-1720` (`addIronEater`), `types.ts:449`

- **What it does:** `junkhound` is one of the four **Iron Eaters** — scrap machines that
  learned a body plan (HP 55, plate 35, speed 15, uses `dog_bite`). It's a hostile horde
  enemy, wears a serial designation ("HOUND-03"), molts armor under fire. It borrows the
  `dog_bite` weapon and a dog-like silhouette but is explicitly **machine, not fauna**
  ("machine to the last", `world.ts:1701-1703`).
- **Open question:** None for the dog audit — flagged only so the master doc doesn't
  miscount it as a living animal.

---

## ANIMALS SWEEP — is there anything besides the dog?

**No other animal entity exists.** Exhaustive reference check across `src/`:

- `kennel` (`buildings.ts:297`) — a **building floorplan template** only (a themed military
  building interior). It does **not** spawn or house dogs; purely decorative/interior-gen.
- `junkhound` (`data.ts:834`) — a **machine** (Iron Eater), see #14 above.
- `DOG_NAMES` "kennel" comment (`data.ts:848`) — flavor text for the K9 name pool.
- "rabbit / prey / hounds / pack" (`bots.ts:1423-1478`, `map.ts:923`) — **paintball
  metaphors** for the Prey/Hunt game mode (human players), not animals.
- "the bird" (`renderer.ts:3395`, `bots.ts:1548`, `data.ts:643` "rally truck") —
  **aircraft/vehicle** slang.
- "bird down" / "perch" (`lsw/gargoyle.ts:79`) — the **Gargoyle LSW** perched on a tile;
  not an animal.
- "swarm" (`horde.ts`, `lsw/reactor.ts:49`) — zombie/enemy crowd metaphor.
- "cat / crow / rat" hits — CSS classes (`cx-crow`), `category` abbreviations (`cat`), and
  "concat"-type substrings. No entities.

**Conclusion:** The game's entire "animal kingdom" is one species — the military working
dog. No birds, mounts, horses, pests, wildlife, or livestock as entities or planned stubs.

---

# PART TWO — OFFICERS / COMMAND (go deep)

## Headline answer

**"Officer" in this codebase is not one thing — it is THREE unrelated things wearing the
same word, and none of them is a commanding-officer *entity* that issues orders to bots:**

1. **`officer.ts` = an AI "officer" that is really a class-quota rule-maker.** It has no
   body, no rank, no position. It's a pure function that approves/denies a player's request
   to change class based on team composition. The "officer" is a fiction wrapped around a
   deterministic cap check.
2. **`ranks.ts` = a promotion ladder that grants AUTHORITY, not orders.** Rank is read off
   lifetime service and buys three things: a morale aura (leadership radius), permission to
   call the LSW stable, and permission to "take command" (the last of which is a
   display-only label — see below).
3. **The fiction's "chain of command / officers commanding soldiers"** — an officer whose
   orders bots obey, a command hierarchy, in-match promotion, rally — **does not exist in
   the sim.** Bots obey their own per-class doctrine AI (`bots.ts`), never a commanding
   officer. There is no order-issuing officer entity.

**The gap in one line:** the fiction promises "government structure for command / officers
who command"; the sim delivers a quota-approving rules function, a passive morale bubble
tied to a stored rank number, and a rank-gated summon button — but **zero** soldier-obeys-
officer command flow.

---

## OFFICER / COMMAND SYSTEMS

### 15. The "officer" class-request ruling — ✅ WIRED (but it's a quota function, not an entity)
`officer.ts` (whole file), called at `world.ts:1732-1750` (`redeployAs`)

- **What it does:** `ruleOnClassRequest(counts, requested, teamSize)` is the "officer." When
  a **dead** player requests a class change for their next deploy (`redeployAs`), the sim
  counts the live team roster by class and asks the officer to rule. Infantry is always
  approved ("the line always needs rifles", cap = ∞). Specialists are capped by headcount:
  medic ≤ teamSize/5, engineer/ghost/infiltrator ≤ teamSize/6, heavy ≤ teamSize/4, runners
  ≤ teamSize/3 (`officer.ts:14-24`). Denied requests are refused with in-fiction voice lines
  ("DENIED — one wrench per trench.") emitted as an announce (`world.ts:1748`). Pure and
  deterministic — same composition, same ruling.
- **What remains:** The "officer" is disembodied — there is no officer *soldier* doing the
  ruling; it's a global rule. It only fires at redeploy (dead players), never mid-life.
- **Open question:** Is the class-quota "officer" meant to eventually be an actual
  in-world CO (a soldier you can see / who can die / whose absence lifts the quota), or is
  the disembodied doctrine-rule the final design?

### 16. Rank ladder & the Promotion Board — ✅ WIRED (as progression/gate), 👻 INVISIBLE (as command)
`ranks.ts` (whole file), `service.ts` (record→rank), `service-file.ts` / `gonet/index.ts` (UI)

- **What it does:** Ten ranks (Recruit→General) at service thresholds (`ranks.ts:34-45`).
  Rank is **read** from lifetime service (`serviceScore`), never stored — matches, wins,
  kills, medals, certifications (worth 30 — "knowledge is the progression"), track records,
  skill bands (`ranks.ts:49-58`, `service.ts:57-95`). The GONET desk and the Service File
  surface the board, the ladder, and each rank's grant text (`gonet/index.ts:203-204`,
  `service-file.ts:108-115`). The player's current rank id is stamped onto their Soldier at
  spawn (`world.ts:1079`, from `main.ts:927 rank: currentRank().id`).
- **What remains / the catch:** Rank's *command* meaning is fiction text. Of the three
  advertised authorities (steady the men / call the stable / command seat), only the first
  two touch the sim (see #17, #18). The third — Captain's "command seat and doctrine
  package" — is **unbuilt** (#19).
- **Open question:** Is the ten-rung ladder the real progression spine, and if so which
  ranks should unlock *actual mechanics* vs. flavor?

### 17. Leadership reach — the morale aura — ✅ WIRED (the one real command effect)
`ranks.ts:115-118` (`leadershipRadius`), consumed at `world.ts:2430-2442`, `morale.ts:54` (`ledWell +0.7/s`)

- **What it does:** This is **the only place rank changes the sim.** Each tick, for every
  living non-zed/non-dog/non-ascendant soldier, the world scans teammates; any teammate
  with a leadership radius (`leadershipRadius(rankId)` — 0 below Corporal, then 10u at
  Corporal scaling +4/rank up to 38u at General) who is within that radius contributes a
  distance-falloff morale boost (`MORALE_SHIFTS.ledWell` +0.7/s × proximity). A man near
  rank holds his nerve; a man alone loses it (`MORALE_SHIFTS.alone`). Morale then feeds bot
  behavior (`s.shaken` → wants cover, `world.ts:2449`). Notably a **food truck** grants the
  same steadying (`world.ts:2446`) — "steadies you the way an officer does."
- **What remains:** The aura is passive and proximity-only — it is NOT an order, has no UI,
  and the player can't feel it directly beyond bots holding cover better. Only the *human's*
  rank is stamped (bots have no `rankId`, so bots never radiate leadership — `world.ts:1079`
  gates on `kind==='human'`). So in practice the aura is "stand near the high-rank human."
- **Open question:** Should NCO/officer **bots** carry rank and radiate leadership (a real
  chain), or is leadership meant to be the human player's aura only? Should there be any
  UI/feedback so the player knows their presence is steadying the line?

### 18. `mayCallStable` — rank-gated LSW summon — ✅ WIRED
`ranks.ts:107` (`MAY_CALL_STABLE=5`), enforced `world.ts:1207`, UI `stable.ts:16-19`

- **What it does:** Lieutenant (rank 5) unlocks "THE STABLE" — the V-channel console to call
  a Living Super Weapon (a "god") down onto the field (`stable.ts`). The sim enforces it: a
  human caller below the stable rank is refused (`world.ts:1207`). The console
  double-locks: singleplayer checks rank points ≥ 8000 OR the OCS onboarding path
  (`stable.ts:16-19`), multiplayer defers to the server. This is a real, gated authority
  that changes what the player can do. **Note:** despite the name, THE STABLE is the
  LSW-summoning console — it is **not** an animal stable/roster (a recurring naming trap).
- **What remains:** Consistency of two thresholds (rank id ≥ 5 in the sim vs. 8000 rank
  points in the console) is worth confirming they agree.
- **Open question:** Are the rank-id gate and the 8000-points gate meant to be the same
  line? (They can disagree.)

### 19. `mayCommand` — the "command seat & doctrine package" — ⬜ UNBUILT (label only)
`ranks.ts:108` (`MAY_COMMAND=6`), read only at `service.ts:92` → displayed `service-file.ts:115`

- **What it does:** Captain (rank 6) is advertised as granting "the command seat and set the
  doctrine" (`ranks.ts:18,41`). In code, `mayCommand(rankId)` is computed in exactly one
  place — the Service File board — and rendered as a static yes/no line ("MAY TAKE COMMAND"
  / "MAY NOT TAKE COMMAND", `service-file.ts:115`). **There is no command seat, no doctrine
  package, and no gameplay behind it.** Grep confirms `mayCommand` is never consumed by the
  sim; no "takeCommand"/"commandSeat"/"doctrine package" mechanic exists.
  (The `campaign.doctrine` array in `client/campaign.ts` is a *separate* meta-layer thing —
  operation-reward nodes — not the Captain's command seat.)
- **What remains:** Everything. The entire "command" verb the rank promises is a display
  label.
- **Open question (biggest command decision):** What IS the command seat? Concretely: does a
  Captain get to issue orders bots obey (push/hold/regroup), pick a doctrine package that
  re-kits the team, take a top-down RTS view, or something else? Until answered, rank 6+ is
  narratively "command" but mechanically identical to rank 5.

### 20. `materielBonus` — rank → opening manifest — 👻 INVISIBLE (defined, never called)
`ranks.ts:121`

- **What it does:** Defined to grant +1 materiel at rank ≥ 4 (Staff Sergeant) and +2 at
  rank ≥ 7 (Major) — "a modest opening-manifest bonus." Grep shows it is **never imported or
  called anywhere.** The Staff Sergeant "heavier opening manifest" and Major "full manifest"
  grants (`ranks.ts:39,42`) have no code behind them.
- **What remains:** Wire it into whatever builds the opening materiel/manifest, or delete it.
- **Open question:** Should rank actually buy opening materiel (making rank a soft power
  curve), or is rank strictly non-numeric authority (the stated design law) — in which case
  this function should be removed?

### 21. The `commander` skill — 👻 INVISIBLE (declared, unwired)
`skills.ts:51`

- **What it does:** A skill named "Commander" — earnedBy "Time holding a command seat",
  gives "Squad holds its nerve better." Grep shows `commander` is referenced only at its own
  definition line; no sim code reads it or applies a morale/nerve effect. Since the command
  seat (#19) doesn't exist, the skill can't even be earned.
- **What remains:** Wire it to the morale loop (a real "squad holds nerve" modifier) once a
  command seat exists to earn it from.
- **Open question:** Same as #19 — it's blocked on defining the command seat.

### 22. The squad container (`squadId`) — 🟡 PARTIAL
`world.ts:1060-1068` (assign), read at `world.ts:1872-1878` (spawn-on-mate) & `bots.ts:180-183` (rescue bias), `types.ts:805-808`

- **What it does:** On spawn, human/bot soldiers are bucketed into fireteams of 4 by roster
  order (`squadId = team*100 + floor(mates/4)`). This is the closest thing to a command
  *structure*, and it does two real things: (a) you can redeploy onto a **safe living
  squadmate** instead of the spawn ring (`world.ts:1872`, gated off in science mode), and
  (b) a cut-off squadmate counts as **half distance** when a bot picks who to rescue
  (`bots.ts:182`) — so bots prefer to rescue their own fireteam.
- **What remains:** No squad *leader*, no squad orders, no squad UI, no squad-scoped morale,
  no link between `squadId` and rank/leadership. It's a spawn/rescue affinity, not a command
  unit.
- **Open question:** Should the squad have a designated leader (tie it to rank/leadership
  radius) and become the unit that command orders act on? Right now leadership radius (#17)
  and squad membership (#22) are unrelated systems that never reference each other.

### 23. The `leadership` master-stat — 👻 INVISIBLE (rolled & carried, never read)
`types.ts:431`, rolled `world.ts:1031`, default `world.ts:1035`

- **What it does:** One of the 8 master stats. Commented as "squad size, command radius,
  radio authority." It's rolled for bots and carried on every human print, but grep shows
  **no sim code reads `.leadership`** — command radius is driven by *rankId* (#17), not this
  stat; squad size is a fixed 4 (#22). So the stat that literally says "command radius" does
  not drive the command radius. Pure meta-layer theatre (consistent with the known
  "stat theatre gap").
- **What remains:** Either wire `leadership` into leadership radius / squad size, or accept
  it as declared-only meta-layer data.
- **Open question:** Should the `leadership` stat and `rankId` be unified into one command
  authority, or do they intentionally measure different things (earned rank vs. innate
  trait)?

### 24. Order flow — do bots obey a commander? — ⬜ UNBUILT
`bots.ts` (whole file), `world.ts:3266` (K9 only)

- **What it does:** The **only** order any unit obeys from a player is the K9 command
  (`cmd.k9`, `world.ts:3266`). Bots run entirely on autonomous per-class doctrine
  (`bots.ts:441` "per-class doctrine", objective selection, rescue, cover, piloting). There
  is **no** mechanism for an officer/player to issue "move here / hold / focus that / fall
  back / regroup" to friendly bots. `rally` appears only as flavor text (`map.ts:923`
  hunters "rally on the fence"; `data.ts:643` "rally truck").
- **What remains:** The entire command-order layer (issue order → bots obey) if the design
  wants officers to command.
- **Open question:** This is the core owner decision — should the player-as-officer be able
  to command friendly bots at all, and if so, is it order-based (issue verbs), doctrine-based
  (set a stance the whole team adopts), or seat-based (an RTS command view)? Everything in
  #19/#21/#22 hinges on this.

---

# PUNCH-LIST — OPEN QUESTIONS ABOUT DOGS / ANIMALS

1. **Fielding agency:** Should bringing a dog be a deliberate player choice (loadout slot /
   rank perk / purchase), or stay an automatic infantry/engineer freebie, one per team?
2. **Scent asymmetry (highest priority):** Is the **team-0-only** scent-trail gate
   (`world.ts:2203`) intended (guard dogs hunt raiders in science), or a latent bug that
   should let both teams' dogs track? Right now a normal player's own dog can't scent-track.
3. **Sic scope:** Should `sic` target open ground / a marked enemy, not just buildings?
4. **Order vocabulary:** Are heel/sic/stay the final three, or does the design want
   track-this-scent, guard-this-teammate, return-to-vehicle, fetch?
5. **Nose through walls:** Should the 10u nose bubble respect walls, and should it draw an
   explicit scent-ping marker on the *player's* HUD (not just feed AI perception)?
6. **Breeds/roles:** One dog archetype forever, or scout/attack/detection variants with
   different stats?
7. **Packs:** Should packs (with real group AI) exist outside science missions?
8. **Breaching:** Keep "dog waits at door, human opens" as the loop, or add a breach upgrade?
9. **Bite depth:** Should a bite pin/immobilize (a true takedown) rather than haul-and-rebite?
   Should it bleed/infect?
10. **Losing your dog:** Any consequence (redeploy cooldown, vet cost, handler morale hit,
    wounded state) or is instant handler-side respawn fine?
11. **Handler bond:** Is there meant to be a handler-bond stat/relationship (the fiction hints
    at "good dogs"), or is ownership purely mechanical?

**Dogs — what exists vs. what's missing (one-liner):** *A fully-simulated, rendered,
player-controllable military dog with heel/sic/stay orders and a load-bearing anti-stealth
nose EXISTS and works; what's MISSING is player agency to field it, symmetric scent
tracking, richer orders/roles/packs, and any meta-consequence for its death.*

---

# PUNCH-LIST — OPEN QUESTIONS ABOUT OFFICERS

1. **Define the command seat (the biggest one):** What does Captain's "command seat &
   doctrine package" (#19) actually DO? Order-issuing, team re-kit, RTS view, or stance
   selection? Until answered, rank 6+ is command in name only.
2. **Do bots obey a commander at all? (#24):** Decide whether player-as-officer can command
   friendly bots, and the shape (verbs / stance / seat). This unblocks #19, #21, #22.
3. **`materielBonus` (#20):** Wire rank→opening materiel, or delete it — decide whether rank
   is ever numeric power or strictly non-numeric authority (the stated law).
4. **`commander` skill (#21):** Blocked on #1 — wire it to a real "squad holds nerve"
   modifier once a command seat can be earned.
5. **`leadership` stat vs `rankId` (#23):** Unify command authority, or keep two systems
   (earned rank aura + innate trait)? The stat that says "command radius" doesn't drive it.
6. **NCO/officer bots (#17):** Should bots carry rank and radiate leadership (a real chain of
   command on the field), or is the morale aura the human player's alone?
7. **Squad ↔ command link (#22):** Give the 4-man squad a leader tied to rank, and make it
   the unit orders act on? Today squad and leadership are unrelated.
8. **The "officer" identity (#15):** Is the class-quota officer meant to become an actual
   in-world CO (visible, mortal, whose absence lifts the quota), or stay a disembodied rule?
9. **Stable gate consistency (#18):** Reconcile the rank-id≥5 sim gate with the 8000-points
   console gate so they can't disagree.
10. **Leadership feedback:** Any UI so the player perceives the command/morale aura they
    provide (or is it invisible-by-design)?

**Officers — what exists vs. what's missing (one-liner):** *What EXISTS is a rank ladder
read from real service, a passive proximity morale aura, a rank-gated LSW-summon, and a
class-quota "officer" rules function; what's MISSING is the entire command layer the fiction
promises — no order-issuing officer, no command seat, no doctrine package, no bots obeying a
commander, and the `mayCommand`/`materielBonus`/`commander`-skill/`leadership`-stat hooks all
dangle unwired.*
