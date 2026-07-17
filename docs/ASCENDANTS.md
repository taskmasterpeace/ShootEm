# LIVING SUPER WEAPONS — the LSW roster
### SOURCE OF TRUTH. Supersedes DD §21.6 ("the Ascendants") and the old `LSW-ROSTER.md`.

> **The frame — Robert's law, and it overrides the older text everywhere:**
> **There are no heroes and villains. There are two factions, and each fields
> its own stable of Living Super Weapons.** Roster A belongs to **the United
> Front**, roster B to **the Collective**. When you fight the Collective,
> *their* LSWs drop on you; *yours* fight beside you. Same war, two arsenals.
> Wherever inherited spec text says "hero", read *UF LSW*; "villain", read
> *Collective LSW*. The file keeps the ASCENDANTS name for its §21.6 lineage;
> the units are **LSWs**.
>
> **The standard every unit is held to:** powers that create DECISIONS, not
> damage numbers · no duplicate identities · **nothing that takes control
> away from a human player** · every ability telegraphs · every counter maps
> to a system the game already ships · every LSW dies to ordinary guns. An
> unanswerable boss is a griefer we wrote ourselves.

---

## 1. Legend

| Status | Meaning |
|---|---|
| ⬜ | not started |
| 🔧 | in progress |
| ✅ | shipped (sim + bot brain + VFX + tests + live-verified) |
| 🧊 | shipped procedurally, awaiting Robert's GLB — never a blocker |

| Tier | Meaning | Cost |
|---|---|---|
| **T1** | new combination of systems that ship TODAY | days |
| **T2** | needs ONE new sim mechanic (which usually serves several LSWs) | ~a week per mechanic |
| **T3** | real engine work — new movement/physics/AI layers | weeks; sequence last |

**The shipped toolbox:** fire/smoke fields · quarantine gas · EMP · orbital
strike + beacons · warp gates + blink · knockback · tagged pings + psi scan ·
the §19 vision cone + §19.2 sound smudges · K9 noses · hacked turrets
(machine possession) · drones + the SAM/MANPADS/AA economy · downed/revive ·
the recorder/replay · **grenade bounce + the loft solver** · per-surface
movement (S_ICE!) · dynamic houses + drill-eats-wall rubble · drop pods ·
spawn protection · per-theme gravity · the announcer · **the run carry**.

---

## 2. UNITED FRONT — roster A

| # | LSW | Role · Movement | Primary | Secondary | The decision it creates | Counterplay | Tier | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Vanguard** | breacher · ground | Shield bash: short charge, stuns + shoves; raised shield blocks frontal fire | Plants barricades that block bullets **for both sides** | Placement is the skill — his own wall can cage his team | Flanks; banked frags (they bounce now) | T1 | ⬜ |
| 2 | **Firebrand** | zoner · ground | Fire streams that paint burning trails on the ground | Detonates every patch he's painted, **all at once** | You see the floor he owns: cross NOW or wait — he chooses when to cash the board | Don't stand in paint; rain douses it | T1 | ⬜ |
| 3 | **Volt Striker** | anti-cluster · ground | Chain lightning, arcs to 3 | Overloads a vehicle: detonates in 2s **unless the crew bails** | Punishes clustering; the crew decides — abandon armor or gamble | Spread out; bail fast | T1 | ⬜ |
| 4 | **Shadowstep** | assassin · blink | Blink behind, stab | Departure point holds an explosive decoy — **blows on touch** | Chasing him IS the trap | Shoot the decoy at range | T1 | ⬜ |
| 5 | **Titan** | bruiser · huge, slow | **Grabs and throws vehicles** — crew included | Ground pound cracks cover to rubble, slows a cone | Starve him: keep armor out of his reach | Kite him — he's slow | **T3** | ⬜ |
| 6 | **Frostbite** ⭐ | controller · ground | **THE ICE BLOCK** (§4.2) — encases a soldier alive | Ice sheets — vehicles genuinely spin out (S_ICE) | The encased player: struggle out hurt, or hold still and outlast. Freezing their star also **saves** him — timing is everything | Stay near squadmates who can shatter you free | T2 | ⬜ |
| 7 | **Phantom** | infiltrator · hover, silent | Phases through walls, strikes out of them | Possesses a **bot/turret/vehicle** 3s — never a human | Your own machines become the threat | K9 noses smell him; psi scanner | T2/T3 | ⬜ |
| 8 | **Sniperhawk** | marksman · perches | Piercing rail through bodies + thin cover, **visible laser telegraph between shots** | Marks a point; artillery erases it | The laser tells you where he is — close the gap between shots | Rush him during the telegraph | T1 | ⬜ |
| 9 | **Gravity Warden** | controller · levitates | Pull-field, then slam | Reverses gravity: enemies float 2.5s, then drop staggered — **they can still shoot** | Floating: panic-fire or hold discipline | Kill him mid-channel to end it | T2 | ⬜ |
| 10 | **Inferno** | skirmisher · **TRUE FLIGHT** | Dive-bombing fireballs | Burning aura: anyone within 6u cooks | Flight is his power AND his exposure | SAMs, MANPADS, small arms | **T3** | ⬜ |
| 11 | **Steel Weaver** | tank · ground | Rips a T_METAL panel from the map, carries it as a tower shield — **the team loses that wall** | Assembles panels into an exosuit: +armor, +damage, loud, slow | His defense literally costs the map | Flank the noise | T2 | ⬜ |
| 12 | **Pulse** | recon · ground | Sonic wave staggers + pings victims **through walls**, footsteps map-wide | Deafening burst: disables vehicle controls and **mutes the enemy's sound cues** | In this game, muting ears is blinding half their information | Dodge the visible wave | T1 | ⬜ |
| 13 | **Venom** | attrition · ground | Poison volley → contamination zones (quarantine canon); poisoned enemies **leak a visible trail** | Acid glob eats armor plate | Pressures the support economy | Medics cleanse | T1 | ⬜ |
| 14 | **Blitz** | momentum · dash | Dash-strike; each kill inside 1.5s **refunds the dash** | His last two dash paths replay as damaging afterimages (**the recorder, weaponized**) | Break his chain or he never stops | He's paper between dashes | T1/T2 | ⬜ |
| 15 | **Barrier** | zoner · ground | Projects an energy wall | 2s **REFLECT**: returns projectiles to their shooters (grenade-bounce math + re-team) | Shoot and it's your bullet — the wall telegraphs | Bait it; lob over the top | T1 | ⬜ |
| 16 | **Riptide** | counter-pick · water-strong | Traveling wave shoves a line back **and extinguishes fire** | Whirlpool traps a circle; **doubled on real water** (Port, Bridge Delta, the leads) | The answer to every flame character | Leave the painted circle early | T2 | ⬜ |
| 17 | **Crusher** | bruiser · ground | Charging smash straight through cover | Hurls terrain that **becomes new cover where it lands** | He remodels the map — for whoever's smart enough to use it | Bait the charge into a wall: self-stun | T2 | ⬜ |
| 18 | **Mirage** | trickster · ground | Up to 3 walking, fake-firing decoys | Swaps places with any decoy instantly | Which one is real? | **Dogs ignore decoys; decoys make no footsteps** — senses tell the truth | T1 | ⬜ |
| 19 | **Stormcaller** | zoner · **TRUE FLIGHT** | Seeds a roaming tornado that flings soldiers skyward | 8s lightning storm over an area — **both sides beware** | Her own team eats bolts too | AA; fight indoors — roofs block bolts | **T3** | ⬜ |
| 20 | **Reactor** | support · ground | Charged nova — longer charge, bigger risk window | **Overcharges an ally's next attack** (an overcharged Frostbite freezes a three-wide line) | Kill the battery first | Focus him, not the carry | T2 | ⬜ |

## 3. THE COLLECTIVE — roster B

| # | LSW | Role · Movement | Primary | Secondary | The decision it creates | Counterplay | Tier | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Oblivion** | zoner · levitates | Void bolts that lob over any cover (**black with a white rim — house law: no purple**) | Black hole drags soldiers AND vehicles to a collapse point, then bursts | 1.5s telegraph: run tangentially or die | Sprint across the pull, never against it | T2 | ⬜ |
| 2 | **Ragebeast** | bruiser · ground | Rampage: **damage taken feeds his speed and power** | Tears his own armored flesh (costing HP) and hurls it as homing projectiles | Burst him or starve him — half-measures feed him | Disengage; deny the rage | T1 | ⬜ |
| 3 | **Nightmare** | disruptor · ground | Fear pulse: **vision cones shrink**, false red pings litter the minimap | Blinds one target 2s — **ears still work** | Trust your ears or trust a lying map | Fight by ear (§19.2 trained you for this) | T1 | ⬜ |
| 4 | **Chronos** | controller · ground | Slow-time bubble: bullets crawl, movement drags — **walk through a frozen bullet-wall** | Temporal echo: on lethal damage he snaps back 3s, once per fight — **the echo point glows** | Burst him now, or camp the glow | Camp the echo point | T2 | ⬜ |
| 5 | **Plaguebearer** | attrition · ground | Toxic clouds (quarantine canon) | Infects a vehicle — it trails poison as it drives | The crew chooses: abandon the tank, or drive the plague wagon | Park it; engineer cleanse | T1 | ⬜ |
| 6 | **Leviathan** | boss · massive | Terrain-flattening sweeps | **Belly flop**: map-scale leap, shadow-telegraphed landing, rim shockwave | Scatter from the shadow — and he's soft mid-air | Hit him in the air (the AA window) | **T3** | ⬜ |
| 7 | **Pyroclasm** | zoner · ground | Molten rocks leaving long-lived lava pools | **Erupts at 25% HP** — the room decides | Burst through the threshold, or poke and pray | Range the threshold; Riptide douses him | T1 | ⬜ |
| 8 | **Voidwalker** | assassin · blink | Teleport strikes | Every blink leaves a shadow clone that **detonates after 1s** | Chase him and walk a cluster bomb | Hold ground; don't follow | T1 | ⬜ |
| 9 | **Tremor** | siege · burrow | Earthquake stomps: stagger + shaken aim | Burrows; a **visible soil ripple** races forward and erupts in spikes | Sidestep the ripple — you can see it coming | He's deaf underground | T2 | ⬜ |
| 10 | **Wraith** | thief · levitates | Possesses vehicles/turrets/bots — **never your body** | Drains possessed machines to heal himself | Destroy your own tank to deny him, or duel it | **EMP evicts him instantly**; empty your vehicles | T1/T2 | ⬜ |
| 11 | **Crimson** | attrition · ground | Life-drain beam | Consumes a blood pool (from nearby deaths) to raise **one** blood brute | Deny his economy or fight two | **Burn the pools** — fire denies him | T1 | ⬜ |
| 12 | **Eclipse** | controller · levitates | Moving dome of darkness — vision drops to arm's length inside | **Asymmetric sight**: he sees everything in the dome; nobody sees in or out | Inside, ears are eyes | Dogs, psi scanners, sound | T2 | ⬜ |
| 13 | **Magnetar** | anti-ranged · ground | Bullets curve into a harmless debris orbit around him — **melee, energy, and arcs pass clean** | Magnetic pulse: guns jam mid-reload, metal vehicles stall | Ranged fire FEEDS his halo — change weapons or close | **Frags don't care** (and yours bounce now) | T1/T2 | ⬜ |
| 14 | **Venatrix** | trapper · ground | Snap-traps that hold a soldier fast (**the ice block's little sister** — same state) | Harpoon reels one enemy to her through the open | The tether has HP: **shoot your teammate free** | Spot the glint | T2 | ⬜ |
| 15 | **Overload** | ambusher · ground | Arc bursts | Becomes pure current, travels **connected metal** — walls, vehicles, turrets — emerging anywhere on the circuit | The Refinery, the Port, the Blacksite are HIS maps | **Fight him on dirt** | T2/T3 | ⬜ |
| 16 | **Gargoyle** | skirmisher · **TRUE FLIGHT** | Screaming dive slams — **the shriek is the telegraph** | Perches on a roof as a stone turret: half damage while perched | Rush the perch or answer the sky | AA; collapse the perch | **T3** | ⬜ |
| 17 | **Reaper** | duelist · ground | Chain pull into scythe combo — **the chain grabs the first body** | Marks a target for double damage — **the mark shows on your HUD** | Tanks can eat the pull for the squad; you know you're hunted | Bait him into the guns | T1/T2 | ⬜ |
| 18 | **Specter** | trickster · ground | Mirror images converge on you | All images detonate **on his command** | The guessing game has a fuse | **Only the real one casts a shadow**; dogs know | T1 | ⬜ |
| 19 | **Cataclysm** | siege boss · massive | Huge, slow area slams | While he lives, seismic eruptions fire map-wide, **worsening the longer he's up** | A DPS check that punishes stalling — the announcer counts the quakes you survived | All-in focus | T2 | ⬜ |
| 20 | **Dominator** ⭐ | finale · levitates | Psychic lance — a piercing line | **PSYCHIC LINKS**: visible threads chain up to 4 soldiers; damage one and every linked soldier takes 60%. **He can link YOUR squad to each other** | Your own tight formation becomes his weapon — positioning IS the fight | Scatter beyond thread range, or melt as a group | T2 | ⬜ |

---

## 4. ENGINE FIRST — build before any character

### 4.1 The LSW entity
- `ascendant?: AscendantId` on `Soldier` — **replicates for free** (the snapshot
  spread law: a new field on Soldier rides the wire with no codec edit).
- Soldier-like, big HP pool, its own brain file, faction-flagged (an LSW is
  simply on team 0 or team 1 — no third allegiance).
- **At most one LSW per faction on the field.** OFF in paintball / range /
  onboarding (the yard stays the yard).
- Arrives by **drop pod** (system ships) with an announcer line. Killing one
  pays score + a Journal line (§21.6 canon).

### 4.2 THE ICE BLOCK ⭐ (shared: Frostbite, Venatrix, all future stasis)
The flagship mechanic. Build it **once**, correctly:
- An encased soldier becomes a **real 1-tile block**: blocks movement AND
  shots, **both ways** (it is cover — for both sides).
- **Inside, the player chooses:** hold still → HP drains very slowly (outlast
  it); struggle (any move/fire input) → out in ~4s but **arrives badly hurt**.
  Die slow, or gamble.
- **Teammates shatter the block by shooting it** → instant, free release.
- **Encased soldiers cannot be hurt by anything else.** Freezing an enemy
  briefly *saves* him — freezing their star mid-firefight takes him off the
  board and protects him. **Timing is the entire skill.**
- Gone at round/match end. Never applied to a human without an escape.

### 4.3 Status scaffolding
`slow` · `stun` (short stagger) · burn-zone (reuse `fire_field`) ·
`visionShrink` (the perception budget is already a number — crush it) ·
`damageLink` (Dominator) · `mark` (double damage, shown on the victim's HUD).

### 4.4 The five shared mechanics that unlock 17 LSWs
1. **ENCASE** → Frostbite ⭐, Venatrix (+ future stasis). *Build first.*
2. **FORCE FIELDS** (radial/directional velocity applied in the soldier +
   projectile step) → Gravity Warden, Riptide, Oblivion, Stormcaller's
   tornado, Magnetar's halo. **One system, five LSWs.**
3. **TIME FIELDS** → Chronos. Zone speed *multipliers* for movement and
   projectiles — never clock manipulation (the sim stays deterministic 30Hz).
4. **MACHINE POSSESSION** → Phantom, Wraith. Generalize the hacked-turret
   flip to vehicles/bots + timer + EMP eviction. **Never humans — law.**
5. **TRUE FLIGHT AI** → Inferno, Stormcaller, Gargoyle (exactly the three
   fliers). Most engine-ish; schedule after the roster has legs.

---

## 5. Special AI — one brain per LSW
The sim already runs per-kind brains (`stepBot` / `stepZombie` / `stepDog` /
`stepScientist`). LSWs slot in as **new kinds with one brain file each**:
`src/sim/lsw/<id>.ts`, sharing a small `LswBrain` toolkit (target selection,
ability cadence, retreat thresholds, telegraph timers).

**Laws:** deterministic · DOM-free · every ability emits a telegraphed
SimEvent (**the counter-play IS the telegraph**) · an ability the AI never
uses doesn't exist — the brain ships with the character, not after.

---

## 6. Deployment — the officer calls it

Robert's design, and it's right:
- LSWs are **War Materiel (§17)**: each faction's campaign stock holds a
  limited stable per front.
- **The officer decides WHEN** — mid-match, from the officer surface
  (§7.1/§11.5). A human spending a shared resource: exactly what officers
  are for.
- **The drop is telegraphed and DELAYED** — the announcer calls it, a
  pod-incoming shadow marks the LZ, **20–40s of dread** before arrival. Both
  sides get the information; the fight bends around the countdown.
- Some recipes **start** with an LSW on the field (siege/boss: Cataclysm).
  Most arrive as officer calls. AI officers use a materiel budget + a
  pressure heuristic.
- Dropping the enemy's LSW = Materiel + a medal + a Journal line.

### 6.1 How you BECOME an officer — ⚠️ OPEN, needs Robert
§7 promises the chain of command; onboarding already shows an **OCS** card;
**no officer system exists in code.** This is a design fork, not an
implementation detail — see §13 Q2.

---

## 7. Playable LSWs — ⚠️ OPEN, needs Robert
Robert: *"what if the player could play as one of these characters? That
might be incredibly empowering. But we gotta get flight to feel right. It
should fly like Superman or Goku."*

The honest read:
- **The bodies are already player-compatible** — an LSW is a Soldier; the
  local player is a Soldier. Handing the camera to one is not the hard part.
- **The hard part is flight FEEL.** Superman/Goku flight is a different
  movement model from a jetpack: free 3D velocity, momentum, banking, a
  camera that follows a flier. That's a real engine layer (and it's the same
  layer the three TRUE FLIGHT LSWs need for their AI).
- **The balance question is separate:** a human driving an LSW against 11
  ordinary soldiers is a different game than an AI LSW. Options: an earned
  one-life state (score streak), a dedicated mode, or never.
- **Recommendation:** ship LSWs as AI first (they're designed as events with
  counterplay). Build flight for the AI fliers. THEN, with flight feeling
  right, hand the player the keys as its own decision. See §13 Q1.

---

## 8. Look & sound — every LSW is unmistakable
Robert: *"make sure visually the LSWs look different. Like the fire — I want
them to look like they're on fire. When they shoot energy blasts, shoot it.
Make sure they have their own sound effects."*

Per LSW, non-negotiable:
- **A distinct procedural body**: bigger silhouette than a trooper, signature
  palette, readable at command zoom. **No purple, ever** (test-swept).
- **A signature CONSTANT effect** — the thing that says *this is not a
  soldier*: Firebrand/Inferno/Pyroclasm **visibly burn** (persistent flame
  emitters on the body, heat shimmer, ember trail); Volt Striker crackles;
  Frostbite fogs and frosts the ground he stands on; Oblivion drinks light
  (black core, white rim — never purple); Dominator trails visible threads.
- **Real projectiles/beams**, not recolored bullets: energy blasts get their
  own tracer family (the `makeProjectile` switch is the seam).
- **A telegraph sound + an ability sound + an announcer line** each. The
  standalone generator pattern (`tools/gen-*-sounds.mjs`) is proven — three
  packs shipped that way; never regenerate the curated pack.
- **GLB slot**: probe `/models/ascendant_<id>.glb` exactly like class bodies.
  Missing model = procedural forever, mark 🧊, **never block**. When Robert
  drops one: `node tools/add-soldier.mjs` conventions (pipeline →
  glb-strip-rotations → **harness check FIRST**).

---

## 9. The harness must adjust to them
`/harness.html` ▸ Stage is where every model gets judged before a match ever
sees it. Required work when the first LSW lands:
- An **LSW section** in the Troopers panel: pick any LSW → Show.
- The Stage already does bbox/joint/arm-vector overlays, gait, team toggle —
  LSWs must answer the same overlays (they're Soldiers; the rig contract is
  the same eight joints).
- **Ability preview**: a "fire ability" button per LSW (the Arsenal Lab
  already has "Fire selected" for weapons — same pattern).
- This is how "concentrate on easiest to hardest" stays honest: the harness
  tells you in one screenshot whether a body is assembled, scaled, and posed.

---

## 10. The Iron Eaters — model them alongside (DD §20)
Robert: *"since we're doing these, we might as well model the Iron Eaters —
they're really blocky, they look like random things, metal chairs, TVs, just
scraps. Need to be humanoid-ish. We gotta figure that part out."*

DD §20 already specs them fully (canon, don't re-litigate): rogue
self-replicating nanite munitions that **corrode, consume, and assemble**.
Where the Outbreak eats flesh, the Iron Eaters eat **metal** — each faction's
greatest strength is what its nightmare eats. The bestiary: **scrap-rats**
(swarm), **junkhounds** (fast packs, they jump), **weavers** (wall-climbing
junk spiders), **ravagers** (siege beasts from dead MBTs), **the swarm**
(corrupted Collective drones), **the Leviathan** (a walking foundry).

**The modeling answer — and it's good news:** the pipeline's **voxel-block
remesh is already the Iron Eater art style.** Junk that learned a body plan
IS blocky assembled scrap. Two routes:
- **Procedural-first (recommended):** compose bodies from the existing prop
  vocabulary — crate/wreck/silo/crane parts on the eight-joint rig. A
  humanoid junkhound built from a thrown track and two drone rotors reads
  exactly right, costs no GLB, and is seed-varied per beast (no two alike —
  which is the whole point of "assembled from scrap").
- **GLB route:** Robert generates "pile of scrap metal chairs and TVs shaped
  like a man" → `add-soldier.mjs` at any `--height`. **Known gap:** the
  pipeline's `classify()` assumes human proportions (neck at 90% height, arms
  at 78%). Non-humanoid scale (Titan, Leviathan, scrap-rats) needs a
  `--parts` override. *Noted, not built.*

---

## 11. Adjacent fixes Robert reported (not LSW work — but blocking the feel)

| # | Report | Diagnosis | Status |
|---|---|---|---|
| 1 | "trees inside a house… couldn't get down the hallways" | **FOUND.** `map.ts` tree placement checks `grid[...] === T_OPEN` — but a house's interior floor **is** T_OPEN. The `houses` array and `houseAt()` sit right there, unconsulted. Trees grow indoors and wall the hallways. | ✅ fixed |
| 2 | "we need to SEE when bullets impact stuff" | Sound + debris shipped (`78501e2`). Robert wants it more visible: sparks on metal, chips on stone, dust puffs, decals. | ⬜ |
| 3 | "if one teammate sees you, they ALL know" | **Already true** (vision-share is team-wide, §19 explicit decision, holds until squads §15). The gap is REACTION, not knowledge. | ✅ by design |
| 4 | "if you're behind enemy lines they should come GET you" | No rescue behavior exists. Bots have no concept of an isolated friendly. Design: the spotter (or nearest free bot) breaks off and moves to you. | ⬜ |
| 5 | "everybody goes for the flag, nobody plays defense — they let people set up turrets near them" | **Real.** `raidsFlags()` sends bots at the flag; nothing assigns defense. Design: a role split (N attackers / M defenders per team), defenders anchored to their own flag/CP, and turret-sighting adds a defense pull. | ⬜ |
| 6 | "when you look away from an enemy they should fade over 5s; different classes see longer; max 5" | Today: `SEEN_LINGER = 1.5s`, `SEEN_LINGER_GEARED = 3s` — a hard pop, not a fade. Design: per-class linger (recon classes long, max **5s**), and a **visual fade** across the linger instead of a snap. | ⬜ |
| 7 | ElevenLabs "isn't that emotional" for death sounds | Every sound in the game is **synthesized from scratch** (CC0, no third-party audio) — four packs shipped that way. Real emotional VO is a different pipeline and a licensing question. See §13 Q4. | ⬜ |

---

## 12. Build order — easiest to hardest (Robert's rule)

1. **The officer-drop pipeline** + ONE T1 LSW per faction as proof:
   **Firebrand (UF)** vs **Plaguebearer (Collective)** — both pure
   fire/gas-field plays on shipped systems. Instant faction flavor, no new
   mechanics, and it proves the whole entry path end to end.
2. **ENCASE** ⭐ + **Frostbite** (UF flagship) vs **Ragebeast** (Collective —
   pure numbers, terrifying, T1). The first "oh hell" pair.
3. **FORCE FIELDS** → **Gravity Warden** + **Oblivion** (one mechanic, two
   drops).
4. **Dominator** ⭐ — the Collective finale mechanic (psychic links). Note:
   our new bot spacing fix is, accidentally, the bots learning to fight him.
5. Machine possession pair (**Phantom** / **Wraith**), then **Tremor** (the
   tunneler already donated its organs — burrow ships).
6. Remaining T1s in roster order (they're nearly free).
7. **TRUE FLIGHT** trio last, once the AA meta has data — and that same layer
   is what makes a **playable** LSW possible (§7).

*(The wave-1 order in the loop spec — Frostbite, Titan, Volt Striker,
Sniperhawk, Barrier, Reactor, Oblivion, Tremor, Magnetar, Wraith, Eclipse,
Dominator — is honored EXCEPT Titan, which is T3 (vehicle-throw physics) and
belongs after the T1s. Flagged, not silently reordered.)*

---

## 13. DECIDED (Robert, 2026-07-17)

- **D1 — Order of work: the AI and feel fixes come FIRST**, then the roster.
  They affect every match today; LSWs land on a better game. The agreed
  sequence:
  1. **Bot role split** — attackers/defenders; someone guards home and
     answers turret nests. *(§11 row 5)*
  2. **Rescue** — the spotter breaks off and comes for the isolated friendly.
     *(§11 row 4)*
  3. **Vision fade** — 0→5s, per-class linger, a visual dissolve not a pop.
     *(§11 row 6)*
  4. **Impact VFX** — sparks/chips/dust + decals. *(§11 row 2)*
  5. **THEN** the LSW engine + **Firebrand (UF) vs Plaguebearer (Collective)**.
- **D2 — Officers are EARNED BY RECORD.** The Dossier already tracks service
  (kills, objectives, tours, longest hold). Cross a threshold → OCS → you're
  an officer **across matches**. This is §7's "orders that outlive your
  login", and it needs no new tracking — the record already exists.
- **D3 — LSWs are AI-first; the player gets the keys later.** Ship them as
  events with counterplay, build TRUE FLIGHT for the three fliers, and only
  once flight genuinely feels like Superman/Goku does a human drive one — as
  its own decision, on proven movement. **Do not** shape the entity around a
  playable case now.
- **D4 — Iron Eaters are PROCEDURAL scrap-composition.** Compose bodies from
  the existing prop vocabulary (crate/wreck/silo/crane parts) on the
  eight-joint rig, seed-varied so no two beasts are alike — which is the
  whole point of "assembled from scrap". Free, testable, animates today,
  matches the voxel look. No GLB dependency. *(The pipeline's non-humanoid
  `--parts` gap stays noted, unbuilt, and unblocking.)*

### Still open
- **Emotional VO:** every sound ships synthesized CC0 (four packs). Robert
  finds ElevenLabs "not that emotional" for death cries. Options: stay
  synth-only, license a VO pipeline, or Robert records. **Unanswered —
  doesn't block anything above.**
