# War World — Design Directive 01 (Rev 2)

**From matches to a war.** Every fight permanently matters. Grounded in real,
near-future military tech — and the exotic gear has to be *earned*.

- Prepared for: the dev team
- Classification: direction, not spec
- Presentation version: <https://claude.ai/code/artifact/dedca9ad-5780-420b-861f-748b5b80f9d2>

---

## 0. Situation

The game already has the fun part. Players spawn, fight, throw grenades, take a
point, win or lose. The problem is every match is an island.

We don't want players to feel like they *played a match*. We want them to feel
like they *fought a battle in a war that's still going*. The question the whole
team is solving: **how does every match permanently matter?**

> **Intel — we're closer than it looks.** The persistent-war features are mostly
> *saving and presenting things we already produce*. The sim already emits every
> kill, capture, death, class and weapon. We already hand out post-match honors
> (longest shot, top defender). We already record replays. The "career, medals,
> legacy" pillars are that same event stream — kept instead of thrown away at
> the scoreboard.

> **Constraint — one honest limit.** A truly global, shared war needs accounts
> and a backend we don't have yet — today it's offline-vs-bots plus LAN. So we
> build a **local-first war** that delivers the emotion offline now, shaped to
> sync to a server later. That decides the build order in §9.

---

## 1. Whose war is it? — Factions

The unanswered foundational question. Today "red vs blue" is assigned per match
and means nothing. The fix: **you don't pick a team. You enlist.**

| | **The Concord** | **The Meridian Pact** |
|---|---|---|
| Doctrine | Combined arms — armor columns, artillery superiority, air cavalry | Asymmetric & unmanned — drone swarms, EW, loitering munitions, raiding |
| Wins by | Mass and discipline | Precision and denial |
| Colors | Steel grey & cyan | Olive & amber |
| Tech lead | EM-gun line first | Drone program first |

*(Names are placeholders — rename at will; keep the structure.)*

**How enlistment works**

- **You sign for a tour** — one faction per campaign season. Your record,
  medals, and journal entries stamp the tour they were earned in.
- **Every match you play is fought for your faction.** Offline, bots wear both
  flags; you always deploy under yours, and your result moves your faction's
  fronts.
- **Doctrine is real:** your faction's tech tree, vehicle skins, and unlocked
  prototypes differ.
- **Defection is allowed between tours — and it's recorded.** "Two tours
  Concord, then crossed to the Pact" is a story your dossier tells forever.
- **The outbreak (§8.3) belongs to no one.** Quarantine ops are a joint task
  force — the one place both flags fight side by side; your containment record
  credits your faction.

> *You're not on a team. You're in an army. The difference is that an army
> remembers you.* — design north star

---

## 2. Setting — advanced, not sci-fi

A present-to-near-future conventional war on Earth. "Advanced tech" means
today's cutting edge and the next decade: drones, loitering munitions,
networked fires, EW, thermal optics, active protection. If a defense contractor
isn't building it, it isn't *standard issue*. (The exotic stuff still exists —
behind glass. See §6.)

| Current (sci-fi) | Grounded equivalent | Verdict |
|---|---|---|
| Jetpack trooper | **Jet-suit operator** — Gravity Industries suits are real; elite & rare | keep, reskin |
| Cloak / Infiltrator | **Adaptive + thermal camo** — harder to detect, not invisible | rework |
| Ghost / EMP / drone | **EW operator** — jamming, counter-drone, ISR quadcopter (all fielded) | keep |
| Pathfinder / warp beacon | **Pathfinder** + fast-rope insertion instead of teleport | rework |
| Orbital strike | **Call-for-fire** — artillery, airstrike, loitering munition | reskin |
| Railgun / plasma / impulse | **Prototype Program** — locked behind the war (§6) | gate it |
| Solar-system themes, low-g | **Earth theatres, standard gravity** (§8.2) | reskin |

Rifles, LMGs, DMRs, snipers, autocannons, ATGMs, mortars, tanks, IFVs,
flamethrowers, smoke, frags — already realistic. They stay.

---

## 3. The war, in three systems

These three cover all ten pillars from the original brief — and they're
inherently military-realistic: real armies keep records, award decorations, and
fight named campaigns.

### System A · The Record — identity, career, medals, legacy
A persistent soldier dossier: service history, lifetime stats, class mastery,
and **decorations earned from real events** — Iron Defender for holding a
point, Tank Killer for armor kills, a Purple Heart for surviving near-death.
Medals and rank ride the dossier and show on your soldier in-match. Works
entirely offline.

### System B · The War Journal — story, not just stats
After each match, mine the event log for the **narrative**: "Held Bridge Delta
14 minutes against a company-strength assault." Each entry links to its replay
clip. Two players with identical K/D get completely different histories. This
is the retention engine.

### System C · The Living Campaign — a war your matches move
Campaign state (local first) with named **fronts**; each match nudges
ownership, gates which maps/modes are live, escalates difficulty, and scars
maps permanently — a bridge you blow stays blown. You log in to "the Eastern
Front fell overnight," not a map list.

### 3.1 The Kit — personal gear & operational gear

Every soldier carries out of **two lockers**, and the distinction is the whole
design:

**Personal gear — what you OWN.** Earned by use, campaign progress, and
prototype field trials (§6); follows you across classes, matches, and tours.

- **You own weapons, not loadouts.** Your dossier lists them like a gun
  locker — each weapon with its own service history (kills, longest hit,
  tours carried).
- **Bring what's yours to any deployment:** the primary slot opens to your
  personal armory, gated only by weight class (an Infiltrator can't lug an
  autocannon). Your Ghost with the shotgun you've carried three tours *is* a
  story.
- **Never purchasable** (§11.3). Personal gear is biography.

**Operational gear — what the army ISSUES.** Assigned per deployment; it goes
back in the cage when the op ends.

- **Class signature kit:** the Ghost's FPV drone, the Engineer's turrets and
  mines, the Medic's medi-beam — the *role*, and it stays with the role.
- **Equipment picks** (vest, goggles, demo kit…) and **mission issue** —
  breaching charges for Breach & Clear, MANPADS for Air Interdiction, flares
  for pilots: the mission (§8.1) decides what's in the crate.
- **Prototypes are operational by definition** (§6): field-trial loans from
  the program, one per squad, returned — or lost, and that's a Journal entry.

**Why the split matters:** personal gear makes you *you*; operational gear
makes the mission *the mission*. Progression lives in the first, balance
lives in the second — and nothing in either is for sale.

### 3.2 Qualification — train before you deploy, one shot on The Wall

You don't get handed a class. You **qualify** for it — real militaries do
exactly this, and it makes every class feel earned:

- **Each class has a training course** — a solo qualification run in that
  class's craft: the Medic's revive-under-fire drill, the Ghost's drone
  slalom, the Engineer's breach-and-build, the Heavy's live-fire lane.
  Pass it to deploy as that class. (Infantry is basic training — everyone
  starts qualified.)
- **One attempt counts — forever.** You can practice the course any time,
  but your **first scored run** is your permanent qualification score. That
  score goes on **The Wall** — the standing leaderboard every player sees —
  and stamps your dossier: *"Qualified Expert, 96th percentile, first
  attempt."* One shot is what makes the number mean something.
- **Scores feed the Record:** qualification tiers (Marksman / Sharpshooter /
  Expert) are real military grades, shown as ribbons on your soldier (§3
  System A). Re-runs can unlock *practice* bragging rights, but The Wall
  never forgets your first.

---

## 4. Blast physics & the grenade — combat feel

Explosions should move people. Today they only subtract HP.

> **Intel — the machinery already exists.** The sim already has a knockback
> pipeline (blast shove scaled by distance, victims popped airborne, power
> armor immune) — **but only one weapon uses it.** Grenades, rockets, cannon,
> artillery all set knockback to zero. This is a data + tuning pass, not an
> engine build.

### 4.1 Blast knockback — *build next*
- **Every splash weapon shoves.** Frag ~12, GL ~10, rocket ~14, tank cannon
  ~18, artillery ~22 — scaled by distance from center, capped so it's drama,
  not pinball.
- **Survivors stumble:** shoved, briefly off-aim, screen kick. **Kills
  launch:** the ragdoll already tips away from the killing blow — blast kills
  get the full send.
- **Airburst pop:** anyone inside the inner radius gets lifted — clearing a
  trench with a well-cooked frag should *look* like it.

### 4.2 The throw — ✅ SHIPPED (`b722960`)
The proven top-down mechanic, live in the game now:
- **Hold G to aim:** the sim's exact flight arc (dashed) + a splash ring on the
  landing point — the cursor, clamped to max reach (22u). Release to throw.
  Verified in-game: the frag detonates **0.09u** from the previewed ring.
- **All throwables cursor-target** through one clamp: frag, orbital designator,
  demo charge, warp beacon, EMP. **Bots too** — their frags land ON you now.
- Still to add from this section: **cooking** (fuse burns while held),
  **bounces** (bank through doorways), **throwback/dive-on** heroics.

### 4.3 Down, not out — drag, revive, bleed out

Death gets a middle state. Take lethal damage and you go **down** instead of
straight to the respawn timer:

- **Downed:** you're on the ground, bleeding out on a timer. You can hold on
  for help, crawl a few meters, or **give up** and take the respawn.
- **The drag:** any teammate can grab your collar and **haul you behind
  cover** — the medic revives you there. Dragging a wounded soldier (or a
  wounded K9, §5.3) out of a firefight is the single most story-generating
  act we can add; it's a Journal entry and a medal category by itself.
- **What it buys:** medics matter, squads stick together, and firefights get
  a second act — "hold on, I'm coming to you."

> **Honest prerequisite — the maps are too small for this today.** On a
> 200-unit map with our current lethality, everything dies within sight of
> everything; a downed state just becomes a slower death. Revive gameplay
> needs **bigger maps** (300–400 units), travel time, and cover density so
> reaching a downed teammate is a *decision*, not a formality. Scale the maps
> (§8.4) first or alongside — this mechanic ships with them, not before.

---

## 5. Combat systems on the table

### 5.1 Anti-air — aircraft must sweat — *build next*
Flyers currently soar untouchable. Add the predator/prey loop: **MANPADS**
(shoulder-fired IR missile), a vehicle **SPAAG/SAM**, and radar **SAM sites** —
guided missiles with a lock-on tone. Aircraft counter with **flares**,
**chaff**, **terrain-masking**, and flying nap-of-the-earth.

> **Rule — the missile is a hair slower than the plane.** Missile top speed
> sits **~8% under** aircraft top speed. A pilot who commits — burns straight,
> pops a flare on the right beat — *just barely* outruns it. Panic and turn,
> and it closes. Skillful to fly, heroic to shoot down. Escape is a margin, not
> a guarantee; that margin is the whole game.

### 5.2 The Breacher — depth is stealth — *build next*
It *does* grind walls already; it just doesn't feel like it. Grounded model: an
**armored breaching vehicle** (think the armored D9). First pass: spinning
cutter, looping grind, faster chew, screen-shake, IED clearing.

Then the real mechanic — **the breacher can dig down, and depth buys silence:**

```
 SURFACE ────────────────────────────────────────────────
 SHALLOW (detectable):  ))) seismic rumble · dirt breaks
                        · pinged on the minimap
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  depth threshold ─ ─ ─ ─ ─ ─ ─ ─ ─
 DEEP (undetectable):   silent · off minimap
                        · but slower and blind
```

Shallow: everyone knows something's coming. Deep: nothing — but you're slow
and blind. **The trade is the fun.** Counter-tunnel seismic sensors are real;
so is the drama of the ground opening up behind your lines.

### 5.3 Military working dogs — *committed, build*
A real capability that earns its slot as the **counter to stealth**, and the
most beloved unit we can ship. The K9 (a Malinois) comes as a **handler
pairing** — take the K9 option and the dog deploys with you:

- **Detection:** sniffs out camouflaged/signature-reduced operators and
  planted explosives in a radius, marking them for the team — the grounded
  answer to the camo classes and mines.
- **Chase & takedown:** send the dog — fast, fragile, staggers a fleeing
  target long enough for the squad to close. Reuses the existing chase AI.
- **It has a name and a record.** The dog earns Journal entries and its own
  service history ("Rex — 3 tours, 41 finds, wounded twice"). When a K9 goes
  down and the handler carries it to the ambulance, that's the clip of the
  match. Dogs are how you make players *feel* things.
- **Doctrine fit:** K9s are a Concord signature (§1) — the human-and-animal
  army against the Pact's machines. Dog vs robot-dog is a fight we want.

### 5.4 Drones & ground robots — *first slice SHIPPED*
All fielded today: ISR quadcopters, strike drones, loitering munitions
(Switchblade), UGVs (Ripsaw/THeMIS, robot dogs). These are **the Meridian
Pact's doctrine** and the visible reward of §6 — hold the right fronts and your
faction's machines roll onto the field.

**✅ Personal FPV drones — SHIPPED.** The Ghost/EW operator's Q now deploys a
drone the player *flies*: the body kneels at the controller (defenseless —
that's the risk), the camera becomes the drone's feed, and it spots enemies
for the team. The control link is the leash: fly past ~55u and **static floods
the feed until the link drops and the drone tumbles out of the sky and breaks
on the dirt** — same fate from enemy EMP, gunfire, a drained battery, or the
operator going down. Strategically this is the Pact doctrine made playable,
and the EW-vs-drone duel (jam it, shoot it, hunt the kneeling pilot) is the
predator/prey loop in miniature. Bots keep the auto-orbit version.

### 5.5 The bird — *proposed, honest assessment*
"How useful would a bird be?" — more than it sounds, and it's real: Dutch
police trained **eagles to intercept quadcopters**, and hand-launched
bird-sized ISR drones (RQ-11 Raven) are standard issue. Two grounded takes:

- **The falcon (counter-drone):** a trained raptor that dives the Pact's ISR
  quadcopters and rips them out of the sky. Niche — but it's the *organic
  counter* to drone doctrine, it's dramatic, and nobody else's war game has
  it. Pairs with the K9 as Concord's living-army identity.
- **The Raven (ISR mini-drone):** hand-thrown, bird-sized, silent-ish scout —
  effectively the "bird" as advanced tech, and nearly free to build (it's a
  small flying camera reusing drone logic).

**Verdict:** utility is moderate, memorability is huge. Ship the falcon as a
counter-drone specialist option once drones (§5.4) exist to counter; the
Raven can ride along with the EW/recon kit almost immediately.

---

## 6. The Prototype Program — sci-fi behind glass

Don't delete the exotic tech. **Lock it behind the war.** The railgun, the
jet-suit squad, the drone swarm — these are prototypes, and prototypes have to
be earned, escorted, and kept alive.

- **The scientist is the tech tree.** Dr. Voss — already in the game via
  safehouse mode — becomes the head of your faction's weapons program.
  **Protect-the-scientist missions ARE research:** every successful defense or
  extraction banks research points for your faction.
- **Fronts gate fields:** hold the Airbase → aviation prototypes. Hold the
  Refinery → thermobarics. Hold the Lab district → the EM gun. Lose the front,
  the program stalls.
- **Prototypes are rare by design:** limited field-trial issue — one EM rifle
  per squad, one jet-suit per operation. Losing one is a Journal entry. Using
  one well is a medal.
- **Doctrine forks the tree (§1):** Concord unlocks the EM-gun line first; the
  Pact unlocks the swarm line first. The war decides who gets the future.

> *Standard issue is real. The future is a reward.*

---

## 7. Command — rank with teeth

Rank shouldn't be a badge. It should be **decisions**. And the chain of
command — the thing armies invented because people go missing — is also the
answer to "who's online?"

### 7.1 Officers choose things
- **Pick the front:** ranking officers choose where the faction attacks next —
  which maps/modes are live this session.
- **Name operations:** officers commission and *name* them — "Operation Black
  Ice" goes in every participant's service record forever.
- **Spend faction resources:** call a supply drop, unlock a vehicle pool for
  the op, greenlight a prototype field trial (§6).
- **Standing orders:** an officer's priorities persist while they're offline —
  bots and objective weighting follow them.

### 7.2 Relief of command — yes, you can take out your commander
Not a knife in the back — a **challenge on the field**. Any officer one grade
below can call a **Relief of Command**: a live operation where the challenger
attacks and the incumbent defends. Winner holds the rank; the whole thing —
challengers, defenders, the deciding play — is written into both War Journals.
Command trials generate the best stories in the game, and nobody gets
team-killed to do it.

### 7.3 The chain solves "who's online"

> **Insight — armies solved offline players centuries ago.** You can't know
> who'll be online. Neither can a real army — that's *why the chain of command
> exists*. If the colonel is absent, the major commands.

- Command powers always devolve to the **highest-ranked player present**.
- **Standing orders** cover the gaps.
- When you return, the **Morning Dispatch** — a War Journal digest — tells you
  everything your faction won, lost, and named while you were gone.

```
 COL Vasquez        MAJ Okafor              CPT Reyes
 [ OFFLINE ]  ───►  [ ONLINE·IN COMMAND ]   [ ONLINE·NEXT UP ]
```

---

## 8. Vehicles → missions · Terrain · The outbreak

### 8.1 Too many vehicles? Give each a mission
Missions bridge the vehicle roster and the war: each is a match with a job, and
its result feeds a front.

| Mission | The job | Vehicles that star |
|---|---|---|
| Armored Push | Break a dug-in line and hold ground | MBT, IFV, breacher, SPAAG |
| Convoy Escort | Move a transport across contested road, intact | transport, MRAP, buggy, attack helo |
| Air Interdiction | Own the sky / deny it — §5.1 as a mode | helo, drone, SAM, MANPADS |
| Breach & Clear | Open a fortified compound room by room | breacher, engineer, K9, UGV |
| Extraction | Reach a downed crew and get them out under fire | ambulance, helo, transport |
| Counter-Battery | Find and kill the guns shelling the front | recon drone, self-propelled artillery |
| Field Trial | Escort a prototype to the front — or steal the enemy's (§6) | whatever the program issues |

### 8.2 The maps — ten named fronts, in full

Maps are not backdrops. Every map is a **named front in the war** with four
required properties:

1. **Readable from the top-down camera** — clear lanes and landmarks, no maze
   soup.
2. **A signature moment** — the thing players tell stories about.
3. **A persistent scar** — how campaign state permanently rewrites it.
4. **A doctrine lean** — some ground favors Concord armor, some favors Pact
   drones, so the campaign tug-of-war has texture.

| # | Front | Ground | Modes | Stars | The scar (persists) |
|---|---|---|---|---|---|
| 1 | **Bridge Delta** | River crossing: main span, rail bridge, one shallow ford | Armored Push, Convoy, CTF | MBT, breacher, boat | Blown spans stay blown — the ford becomes the only crossing |
| 2 | **Fort Raven** | Hilltop strongpoint: trench rings, bunkers, inner keep | Siege (atk/def), KOTH | Breacher, artillery, engineer | Each siege leaves breached walls & rubble ramps — new entrances accumulate |
| 3 | **Eastern Plains** | Open farmland: hedgerows, silos, shallow ridges | Conquest, Counter-Battery | MBT, IFV, recon drone, SP artillery | Burned fields lose concealment; wrecks become the new cover |
| 4 | **The City** | Dense blocks, rooftops, sewers — reuses the house generator | Breach & Clear, TDM, quarantine | K9, UGV, engineer, jet-suit | Collapsed buildings reroute streets for the rest of the campaign |
| 5 | **Highland Pass** | Alpine switchbacks, one road, cliffs, avalanche zones | Convoy, Air Interdiction | Helo, SAM, MANPADS, transport | Avalanches close routes — and open new ones |
| 6 | **Blacksite (Arctic)** | Polar research station, whiteout weather, frozen lanes | Night ops, Extraction, infiltration | Infiltrator, K9, EW | Storms freeze/thaw water lanes between battles |
| 7 | **Refinery** | Petrochemical maze: catwalks, tank farms, flare stacks | Conquest, sabotage | Engineer, WP/flame, drone | Destroyed storage tanks burn for the rest of the campaign — area denial |
| 8 | **The Port** | Container terminal + moored cargo ship + offshore platform | Amphibious assault, Extraction, boarding | Assault boat, helo, jet-suit | Sunken cranes and hulls change the boat lanes |
| 9 | **Airbase** | Runway, hangars, tower, revetments, SAM ring | Air Interdiction, prototype raid | Everything that flies, SPAAG | Cratered runway grounds that faction's air support until repaired — a campaign-level effect |
| 10 | **The Mine** | Open pit + underground galleries + bunker complex | Breach & Clear, quarantine | Breacher, K9, UGV | Collapsed galleries close routes; the breacher opens new ones — the map is literally rewritable |

**Signature moments, one per front:** holding Bridge Delta's span under
artillery (1) · the last stand on Fort Raven's inner keep (2) · a 60-unit
tank duel broken by a treeline ATGM ambush (3) · a K9 clearing an apartment
stack room by room (4) · a MANPADS ambush on a helo threading the pass (5) ·
thermal-camo operators vs K9 sweeps in a whiteout (6) · a thermobaric chain
reaction walking down the tank farm (7) · the assault-boat run under fire
onto the pier (8) · stealing a prototype out of a hangar with the runway
burning (9) · the breacher surfacing *inside* the enemy bunker (10).

**Engine reuse — these are cheaper than they look:** the house generator
(safehouse mode) builds The City's blocks; water tiles already exist for
Bridge Delta and The Port; the generator is seed-deterministic, so the §10 map
tab lets players preview any front before deploying.

**Water & boats verdict:** one assault boat + the amphibious missions on The
Port and Bridge Delta — not a naval layer. Big-water combat is a different
game.

### 8.3 The outbreak, grounded
Zombies can't be grounded — so reframe the PvE horde as a **CBRN/bioweapon
quarantine**: contaminated hostiles, hazmat teams, containment zones that
spread on the campaign map and threaten *both* coalitions. It stays canon, it
feeds the campaign, and it's the one theatre where the flags fight together.
The classic zombie mode stays as an off-canon arcade toggle for fun.

### 8.4 Structures grow up — roofs, slits, sightlines ✅ *decided — build before more maps*

An honest audit of today's battlefields: maps are wide-open, **no structure
has a roof**, and walls have **no openings** — a "building" is a floor plan you
stand inside with the sky overhead. The plan, engine-checked (house footprints
and per-height shot occlusion already exist):

- **Firing slits, not windows.** A new `T_SLIT` tile: blocks movement always,
  blocks fire and sight everywhere **except a 1.2–1.8 height band** — muzzle
  height is 1.4, so standing soldiers shoot through it. The visual is the
  design: **two stacked wall boxes with a gap** — the gap *is* the slit, no
  textures needed, the geometry tells the truth. Defenders shoot out,
  attackers only get in on the slit's line, and a well-lobbed frag can sail
  through the band. One tile type + one line in `blocksShot`.
- **Roofs — the cutaway rule, phase 1 visual-only.** Every building gets one
  flat roof mesh at wall height. **When you (or your drone/camera focus) are
  inside, that building's roof fades to cutaway** — the proven Diablo/Foxhole
  pattern. Outside, the roof is opaque, so **enemies inside are genuinely
  concealed until you breach** — buildings finally block *knowledge*, not
  just movement. Cost: one mesh per footprint + a point-in-rect check.
- **Not yet: walkable roofs.** Standing on top means a second height layer in
  the sim (pathfinding, LOS, fall) — real engine work. Phase 1 roofs are
  concealment; jet-suits and drones *overfly*, infantry *breaches*. Rooftop
  fighting is a Phase 2 with its own decision.
- **Visibility is the real currency.** Roofs + slits + bigger maps (§4.3)
  make sightlines designed instead of accidental: streets are corridors,
  slits are angles, roofs are denial.

**Sequencing:** slits + cutaway roofs land first, then the ten fronts get
authored against real building tech at the new map scale. **No new maps until
then** — nothing gets built twice.

### 8.5 The Scar — the theater map

The campaign has a face: **THE SCAR — persistent war map**, one painted
theater showing all ten fronts with the campaign-effect legend (destroyed ·
blocked route · open route · persistent fire · rubble cover · flooded ·
frozen). *Every battle leaves a mark. The world remembers.*

- **It's the front-selection screen** (§10's MAP tab grows into it): players
  open the theater, see the state of the war, and deploy to a front.
- **Markers are live overlays, not baked pixels:** we render front markers
  and scar icons on top of the art from campaign state — the Refinery's
  persistent-fire icon burns only while that scar is active; routes flip
  blocked/open as the war moves. (This also covers any stray dots in the
  source art — our overlay owns the surface.)
- The Scar is the visual identity of System C: when players say "check the
  Scar," the campaign has won.
- **Placement is author-driven:** the dev **Scar harness** (`/scar-harness.html`)
  lets you drop the art in and drag all ten markers into position; it exports
  `scar-markers.json` (normalized 0–1 coordinates) that the Scar screen reads.

---

## 9. Build order

Each phase ships and is fun on its own. Local-first, then lift to a server for
the shared global war.

| Phase | What ships | Why now | State |
|---|---|---|---|
| This week | ~~Cursor-targeted grenade throw~~ ✅ (`b722960`) · Blast knockback (§4.1) · Breacher feel + depth-stealth (§5.2) · SAM/MANPADS loop (§5.1) | Combat feel — visible in the first minute of play | in progress |
| Slice 1 | The Record + War Journal, on the existing event stream | Offline, no backend, reuses awards + replays — biggest emotion, smallest build | spec ready |
| Slice 2 | Factions + Living Campaign (local): enlistment, fronts, missions, Prototype Program | Turns matches into a war with a flag on it | proposed |
| Slice 3 | Command: officer choices, named operations, relief of command, devolution | Needs ranks (Slice 1) + campaign (Slice 2) to mean anything | proposed |
| Slice 4 | Lift campaign + dossiers to a shared backend | The true global war — same state, now shared | later |

---

## 10. Screens — inventory & redo priority

Every player-facing screen, ranked worst-first. The combat sim outclasses the
menus around it; for a paid product the storefront has to match the game.

| # | Screen | Score | Verdict |
|---|---|---|---|
| 1 | Deployment / selection menu | 35% | **Redo — the big one** |
| 2 | Map setup | 0% | Doesn't exist — build the map generator here |
| 3 | Settings | 0% | Doesn't exist — mandatory for a paid product |
| 4 | Post-match / scoreboard | 45% | Redo second — it's a plain HTML table |
| 5 | Multiplayer connect | 25% | A raw `ws://` text box inside the menu |
| 6 | Respawn / K.I.A. + killcam | 55% | Bare "K.I.A." text; small polish pass |
| 7 | Chat / comms | 70% | Works, needs styling pass only |
| 8 | Combat HUD | 85% | Fine — killfeed, vignettes, equip chips all good |
| 9 | Harness + Sound Lab (dev tools) | 90% | Internal, done |

### 10.1 Why the deployment screen scores 35%

It's one endless vertical scroll of eight stacked sections — and the worst part
is the Armory: **200+ weapons in two native `<select>` dropdowns.** That's a
spreadsheet, not an armory. Classes are emoji + text cards with no soldier
preview — even though the game already has full 3D soldier models and the
harness literally renders them spinning on a turntable. All the ingredients
for a great screen exist; they're just not used here.

### 10.2 The redo — a tabbed flow

`DEPLOY | CLASS | ARMORY | MAP` (+ a reserved `BARRACKS` slot, see 10.3):

- **Class tab:** live 3D soldier preview (reuse the harness turntable), gear
  list, class stats.
- **Armory tab:** browsable weapon cards with stat bars (DMG / ROF / RANGE)
  instead of dropdowns, filtered by family.
- **Map tab:** the map generator — cheap to build, because `generateMap(seed)`
  is already deterministic and the minimap renderer already draws top-down
  maps. Seed field + 🎲 reroll + live minimap preview + theme/mode pickers.
  Pick the battlefield you like *before* deploying.
- **Deploy tab:** summary card + match setup + the DEPLOY button.

### 10.3 Billing readiness — the two hard gaps

Since the plan is to charge: **Settings (0%)** and **accounts/identity** are
the non-negotiables people expect from a paid game.

- Settings needs volume / video / keybind display at minimum — the per-sound
  volume persistence already exists, it just has no player-facing screen.
- The redesigned menu should **reserve a Barracks/Record tab slot** — that's
  where the service record, medals, and (eventually) purchases live, so the
  tab architecture anticipates it now instead of being rebuilt later.

### 10.4 Recommended order

1. **Deployment screen rebuild** (tabbed, 3D class preview + armory cards +
   map generator tab) — the storefront. Build the tab shell + map tab first
   (fast, immediately visible), then class preview and armory cards.
2. **Post-match AAR screen** — the trophies roll deserves better than a table,
   and it's where the Record/Journal retention systems (§3) plug in.
3. **Settings screen** — small but required.
4. **Respawn/killcam + chat polish** — quick pass, same visual language.

---

## 11. Going online — hosting, mobile, money

### 11.1 Hosting — three stages, no rewrites

The path from "LAN with friends" to "the global war" is three stages, and no
stage throws away the previous one's work:

| Stage | Client | Server | Cost | What you get |
|---|---|---|---|---|
| **1** | Free HTTPS static host | Your PC, through a **cloudflared tunnel** as `wss://` | **$0** | Friends play from anywhere — whenever you're hosting |
| **2** | Same client, untouched | Small always-on VM (e.g. Fly.io) | ~$5–10/mo | The war is up 24/7, host or not |
| **3** | Same client | + accounts, campaign & dossier state server-side | TBD | The shared global war — **this IS Slice 4 (§9)** |

**Two hard rules:**

1. **`wss://` everywhere.** Browsers block insecure WebSockets from HTTPS
   pages, and phones are always HTTPS — a bare `ws://` endpoint locks out
   every mobile player and most desktop ones. The tunnel gives you TLS for
   free at Stage 1; never ship a plain-`ws://` code path.
2. **One process = one war.** The server is single-process and that's fine
   for dozens of players. Don't shard, cluster, or "scale" anything before
   Stage 3 — the money and the complexity both belong there.

### 11.2 Mobile — ships with the menu rebuild

Touch controls (virtual twin-stick), the mobile quality tier, and the PWA
manifest ship **together with the deployment-screen rebuild (§10)** — not
after it. The new tabbed menu gets designed **thumb-first once**, instead of
being styled for desktop and restyled for phones twice. The sim already runs
on phones; input and menu ergonomics are the whole gap.

### 11.3 Money — what's for sale and what never is

**Never for sale:** medals, rank, journal entries, prototype access — anything
that **signals skill or history**. Pillar 9 is the law here: *respect is
earned, not bought.* The moment a medal can be purchased, every medal on every
soldier becomes meaningless.

**For sale:** the game itself, **buy-once** — and at most *identity flavor*
(unit patches, weapon paint) that signals **taste, not achievement**.

**The boundary:** accounts (Stage 3) are the paywall line — nothing is charged
before they exist. And **Settings plus the rebuilt menu (§10) are table
stakes** before charging anyone: you don't sell a game whose options screen
doesn't exist.

---

## Appendix A — Field status

- ✅ **Cursor-targeted throws shipped** (`b722960`): hold-G arc + landing ring,
  0.09u landing accuracy, all throwables + bots, 170 tests green.
- ✅ **Invisible walls verified fixed:** live-map probe — all solid tiles
  rendered or prop-covered; 0 invisible, 0-by-construction across every theme.
- ✅ **Knockback pipeline exists** in the sim (blast shove, airborne pop, armor
  immunity) — explosives just don't use it yet. §4.1 is data + tuning.
- ✅ **Water & neighborhood** already in the engine (water tiles, safehouse
  houses).
- ✅ **Audio:** 58-sound ElevenLabs pack, loudness-leveled, rifle & growl
  variety, review/replace tooling (`/sound-review.html`).
- ✅ **FPV drones shipped** (`880dbf4` + `14dc09b`): pilotable, blinding
  static leash, crash-out, 176 tests green.
- ⚠️ **Decide:** faction names/doctrines (§1) are placeholders — rename at
  will; keep the enlistment/tour mechanics.
- ✅ **Decided:** roofs + firing slits (§8.4) — cutaway roofs (visual-only
  phase 1) + `T_SLIT` tile; build before authoring any of the ten fronts.
- ✅ **The Scar exists** (§8.5) — the painted theater map with all ten fronts
  and the campaign-effect legend; becomes the front-selection screen with
  live marker overlays. Awaiting the hi-res export.
- ⚠️ **Decide:** map scale (300–400u) — prerequisite for down/drag/revive
  (§4.3); ships in the same map pass as §8.4.
