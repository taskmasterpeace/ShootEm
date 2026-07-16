# War World — Design Directive 01 (Rev 4)

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

### 3.3 The Proving Grounds — your own patch of the war

Every soldier gets a **personal training ground**: a solo instance that is
part firing range, part gadget sandbox, part qualification hall. It answers
three needs with one place:

- **Test anything, free.** Every weapon in your armory, every equipment pick,
  every gadget — live on firing lanes with target dummies, a vehicle pad row,
  and a building mock-up. No cooldown pressure, no cost, no judgment. (The
  dev harness already has the pieces: target-dummy combat sandbox, vehicle
  gallery, physics drills — the Proving Grounds is the *player-facing* cut of
  it.)
- **Home of the qualification courses (§3.2).** Each class's course is a
  wing of the grounds. Walk to the Medic wing, step on the start plate, run
  the drill. Practice runs are unlimited and marked PRACTICE; your first
  *scored* run is forever, and it posts to The Wall.
- **The tech testbed.** New mechanics land here first — cutaway roofs and
  firing slits (§8.4) debut in the building mock-up, blast knockback on the
  range, the breacher pit for depth drills. Players stress-test our features
  by playing with them, before those features reach the fronts.

**v1 scope (honest):** one new mode id (`range`), a small hand-tuned map
(reusing safehouse-house + harness pieces), infantry course + two class
courses, dummy targets that report score. Solo only. The Wall is a local
leaderboard until Stage 3 accounts make it global.

### 3.4 Building the Record — the Dossier file (Slice 1 plan)

The concrete plan for System A + B. **No backend, ships offline, and every
later system (§3.1–3.3, §6, §7) reads from it.**

**The store.** One versioned JSON document — the **Dossier** — persisted
locally (IndexedDB), shaped for Stage-3 server sync from day one:

```
dossier v1 {
  soldier:   { callsign, created, rankPoints, rank }
  tours:     [{ faction, season, startedAt }]
  lifetime:  { perClass: {kills, deaths, time, wins},
               perWeapon: {kills, longestHit, toursCarried} }
  armory:    [ ownedWeaponIds ]            // §3.1 personal gear
  quals:     { classId: {score, percentile, firstAttemptAt} }  // §3.2
  medals:    [{ id, earnedAt, matchRef }]
  journal:   [{ template, params, at, replayRef? }]
}
```

**The pipeline.** A new `src/client/record.ts` consumes the SAME event
stream the HUD already reads (kills, captures, deaths, heals, holds — all
with class/weapon attached). During the match it folds events into deltas;
at match end (and checkpointed every 30s against crashes) it merges deltas
into the Dossier. The sim is untouched — this is presentation-side, which is
why it ships fast.

**Medals v1** (all computable from events we already emit): First Blood ·
Marksman (longest hit thresholds) · Iron Defender (point-hold time) · Tank
Killer (3 vehicles / match) · Purple Heart (survive under 10 HP) · Medic's
Cross (heal totals) · Grenadier (multi-kill with one frag) · Drone Ace
(spots leading to kills) · Campaign ribbons per tour.

**Journal v1:** template entries mined from the event log at match end —
*"Held POINT for M minutes against N attackers"*, *"Avenged TEAMMATE"*,
*"First to down a VEHICLE this campaign"* — each linked to its replay clip
reference where the recorder has one.

**Surfaces v1:** a **Barracks** screen from the menu (the dossier: rank,
medals, armory, quals, journal feed) + a post-match "career" pane showing
what this match added. The §10 menu rebuild reserves the Barracks tab; v1
can ship as a plain screen before the rebuild lands.

**Explicitly deferred:** accounts, server sync, anti-cheat on The Wall —
all Stage 3 (§11.1). The file format is versioned so nothing migrates
painfully.

---

## 4. Blast physics & the grenade — combat feel

Explosions should move people. Today they only subtract HP.

> **Intel — the machinery already exists.** The sim already has a knockback
> pipeline (blast shove scaled by distance, victims popped airborne, power
> armor immune) — **but only one weapon uses it.** Grenades, rockets, cannon,
> artillery all set knockback to zero. This is a data + tuning pass, not an
> engine build.

### 4.1 Blast knockback — ✅ SHIPPED (`d50374f`)
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

### 5.1 Anti-air — aircraft must sweat — ✅ MANPADS + flares SHIPPED (`92df4a8`); SPAAG & SAM sites open
Flyers currently soar untouchable. Add the predator/prey loop: **MANPADS**
(shoulder-fired IR missile), a vehicle **SPAAG/SAM**, and radar **SAM sites** —
guided missiles with a lock-on tone. Aircraft counter with **flares**,
**chaff**, **terrain-masking**, and flying nap-of-the-earth.

> **Rule — the missile is a hair slower than the plane.** Missile top speed
> sits **~8% under** aircraft top speed. A pilot who commits — burns straight,
> pops a flare on the right beat — *just barely* outruns it. Panic and turn,
> and it closes. Skillful to fly, heroic to shoot down. Escape is a margin, not
> a guarantee; that margin is the whole game.

### 5.2 The Breacher — depth is stealth — ✅ SHIPPED (`1384a68`)
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
- **The bark is your sixth sense (§19):** a threat behind you inside the
  dog's sense radius triggers a directional bark — a growl-vector pointing
  through your fog of war at the stalker. With vision cones live, the K9 is
  a living 360 sensor that loves you; no equipment slot can compete with
  that, and it shouldn't.
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

**Making the Scar live — the v1 plan (no new maps required).** The art and
markers are in the repo (`public/scar-map.png`, `public/scar-markers.json`)
but nothing reads them yet. The unlock: **the Scar doesn't have to wait for
the ten authored fronts** — each front maps to an *existing* generator
recipe today, and upgrades to its authored map later without touching the
screen:

| Front | v1 recipe (exists today) |
|---|---|
| Bridge Delta | savanna + water-heavy seed, CTF |
| Fort Raven | corridors gen, KOTH |
| Eastern Plains | field gen, Conquest |
| The City | neighborhood/houses gen, TDM |
| Highland Pass | rocks gen, Convoy-style CTF |
| Blacksite | triton/ice gen, night vibe, TDM |
| Refinery | starship/industrial gen, Conquest |
| The Port | ocean gen, CTF |
| Airbase | field gen + pads, Conquest |
| The Mine | asteroid gen, breacher-friendly TDM |

1. **Campaign state file** (`ww_campaign` local, Stage-3 syncable):
   `{ season, fronts: { id: { control: -100..100, scars: [], lastBattleAt } } }`.
2. **Results move fronts:** finish a match deployed at front F → win shifts
   `control` toward your faction (±8 by default, mode-weighted); crossing
   thresholds flips ownership and fires a Journal/dispatch entry.
3. **Scars v1 as modifiers on existing generators:** persistent-fire = fire
   fields seeded near the middle; frozen = ice palette + slick handling;
   rubble = extra cover density; flooded = more water tiles; blocked/open
   route = spawn-lane bias. Cheap, real, and visible.
4. **The screen:** a menu tab rendering `scar-map.png`, markers at the
   authored coordinates, control/scars as live overlays; click a front →
   deploy into its recipe with its scar modifiers.

This turns the painting into the game's front door in one slice — and every
later map upgrade just swaps a recipe.

---

### 8.6 The ground fights back — terrain types per biome

Today every walkable tile plays identically; only water is special. Terrain
should be a combat variable — real armies plan around mud season.

- **A SURFACE layer, orthogonal to blocking.** Alongside the collision grid,
  each tile gets a surface: `grass · mud · sand · ice · snow · road/plate ·
  marsh · rubble`. Biomes deal from their own deck (savanna: grass/dirt/road;
  Triton: ice/snow; starship: deck plate; Europa: wet floor/ice), and scars
  (§8.5) re-deal it — *burned fields turn to ash, floods turn fields to marsh,
  frost slicks the roads.*
- **Movement is the payload, and it forks by locomotion:**

  | Surface | Infantry | Wheels | Tracks | Hover |
  |---|---|---|---|---|
  | Road/plate | fast | **fastest** | fast | fast |
  | Grass/dirt | normal | normal | normal | normal |
  | Sand/grit | −10% | **−30%** | −10% | normal |
  | Mud/marsh | −20% | **−40%, can bog** | −15% | **normal — hover's moment** |
  | Ice | slide (momentum carries) | slide hard | −10% | normal |
  | Snow | −15%, **leaves tracks** | −25% | −15% | normal |
  | Rubble | −10% | −25% | normal — tracks eat rubble | −15% |

  Suddenly the motor pool is a *choice*: wheels own the roads, tracks own the
  ruins, hover owns the swamp. Route planning becomes doctrine (§1).
- **Snow remembers.** Footprints and tire tracks persist for ~a minute —
  stealth's counter on cold fronts, and the K9's (§5.3) visual cousin. An
  infiltrator on Triton must *think about the ground*.
- **Sound is part of the surface** — the footstep designation (§18) keys off
  this same layer: deck plate betrays you at range, grass whispers, snow is
  silent but writes a confession. Terrain, audio, and stealth are ONE system.
- **Engine note:** the surface layer is a second `Uint8Array` next to the
  grid — generated per biome, serialized like everything else, read by the
  movement code as a speed multiplier and by the renderer as ground paint.
  The scar modifiers (§8.5 v1) already imagined this ("frozen = slick
  handling"); this section names the general mechanism.

### 8.7 The jump vocabulary — obstacles as verbs

We already have jumping (Space: hop/jetpack). What we don't have is **height-
aware obstacles** — today every blocker blocks absolutely, so jumping is
travel, not traversal. Formalize three obstacle tiers and map-making gets a
whole new alphabet:

| Tier | Height | Who crosses | Reads as |
|---|---|---|---|
| **HOP** | ~1.2u (cover, sandbags, crates, fences) | any soldier with a running jump | "vault it" |
| **CLIMB** | ~2–2.5u (barricades, container walls) | jump troopers' jet, breacher, ladders later | "find a way" |
| **WALL** | 4u (walls, buildings) | nobody on foot — breach, fly, or tunnel | "hard cover" |

- **The mechanic:** blocking becomes height-aware — `isBlocked` learns your
  current jump apex the way `blocksShot` already knows heights (walls block
  shots below 4, cover below 1.2 — *the data is literally already there*).
  A soldier at apex clears T_COVER; a jump trooper clears CLIMB-tier.
- **What it buys maps (§8.2):** trench lines you vault into but vehicles
  can't cross · fence-hopped shortcuts through The City's yards · Fort
  Raven's inner walls CLIMB-tier so jump troopers are the siege's second
  storey · sandbag fights where both sides can commit over the top.
- **The chase gets a grammar:** infantry flow over HOP obstacles, vehicles
  must route around them — infantry escape cavalry through the hedgerows,
  exactly like real ground.
- **Bootcamp teaches it** (§14): the vault, the climb, and "you can't jump a
  wall" are lesson one of movement school.

### 8.8 Weather — the sky is a combat variable (proposed)

Each front carries a weather state — rolled by the campaign, aimed by
officers, escalated by scars. Weather is a *modifier set*, not a mode:

| Weather | Vision (§19) | Sound (§18) | Movement (§8.6) | Air (§5.1) |
|---|---|---|---|---|
| **Clear** | full | full | — | flies |
| **Rain** | −15% | footsteps masked, gunshots dulled — *infiltrator weather* | mud spreads | flies |
| **Fog** | cone halved, 360-ring intact | intact — you HEAR what you can't see | — | grounded below X |
| **Snowstorm** | −40% | muffled | snow rules + fresh tracks fade fast | grounded |
| **Dust storm** | −30% | −20% | wheels choke | grounded |
| **Night** | cone −25%, muzzle flashes GLOW | full — sound is king | — | flies; flares matter |

- **Weather grounds aircraft** — the honest counter-air the MANPADS duel
  (§5.1) wants sometimes: a storm does what missiles can't.
- **Blacksite's whiteout (§8.2) stops being a skin** and becomes the weather
  system's flagship; every front inherits the machinery.
- **The Morning Dispatch reads like a real briefing:** *"Highland Pass:
  snowstorm, air grounded, convoy fight at ground level."*
- **Engine note:** one `weather` field on the campaign front + a modifier
  struct the sim reads (vision radius, sound radius, speed mults, air
  permission) + a render pass (rain streaks, fog plane, night grade). Ships
  naturally with §19 since both act through the vision budget.

---

## 9. Build order

Each phase ships and is fun on its own. Local-first, then lift to a server for
the shared global war.

| Phase | What ships | Why now | State |
|---|---|---|---|
| This week | ~~Cursor-targeted grenades~~ ✅ · ~~FPV drones~~ ✅ · ~~Blast knockback (§4.1)~~ ✅ · ~~Breacher depth-stealth (§5.2)~~ ✅ · ~~MANPADS loop (§5.1)~~ ✅ · ~~killcam duel framing~~ ✅ · ~~armor pool + overhead layer (§10.5)~~ ✅ | Combat feel — visible in the first minute of play | **shipped** |
| Slice 1 | **The Dossier** (§3.4): record.ts pipeline, medals v1, journal v1, Barracks screen | Offline, no backend, reuses awards + replays — biggest emotion, smallest build; everything else reads from it | **planned in full — next up** |
| Slice 1.5 | **The Scar goes live** (§8.5 v1 plan): campaign file, fronts→existing recipes, scar modifiers, the screen | The painting becomes the front door — no new maps required | planned in full |
| Slice 1.6 | **The Proving Grounds** (§3.3): range mode, gadget sandbox, first qualification courses + local Wall | The training/testing home; also the §8.4 roofs/slits testbed | planned |
| Slice 2 | Factions + full Living Campaign: enlistment, tours, missions, Prototype Program | Turns matches into a war with a flag on it | proposed |
| Slice 3 | Command: officer choices, named operations, relief of command, devolution | Needs ranks (Slice 1) + campaign (Slice 2) to mean anything | proposed |
| Slice 4 | Lift campaign + dossiers to a shared backend | The true global war — same state, now shared | later |

### 9.1 Cross-cutting tracks — the things that ride every slice

The Rev-3 additions (§12–§18, §11.4) mostly aren't a *phase* — they're
disciplines that attach to slices already on the board. Where each lands:

| Section | Where it lands | Note |
|---|---|---|
| §12 Bot doctrine | **Every slice.** Ability parity ships with each mechanic (retrofit MANPADS/breacher/drone **now**); match-sizing with the §8.4 map pass; tactical depth alongside Slice 2 | "A toy one-in-sixteen can use" is not done |
| §11.4 Trust | Interest-managed snapshots at **Stage 1**; aim-refereeing + identity with **Slice 4** — and they **gate charging** for competitive play | The floor beneath §11.3 |
| §13 Season | **Slice 2** (with the Living Campaign) | Win/loss/reset is the top of §8.5 |
| §14 Onboarding | Tail of **Slice 1.6** / head of **Slice 2** | Needs Dossier + Proving Grounds first |
| §15 Squad | Primitives early (**Slice 1.6**, offline = friendly bots); full social system **Slice 2** | Build the container now |
| §16 Conduct | Guardrails ship **with their features** (spawn protection + FF now/with maps; command cooldowns Slice 3; moderation Slice 2) | Every social verb answers its abuse case in-slice |
| §17 Progression/economy | Mastery + session loop with **Slice 1** (Dossier); the War Materiel ledger with **Slice 2** | Names the money §6/§7 spend |
| §18 Sensory/access | Music + ambience early (cheap, high ROI); colorblind + comfort + Settings with the **§10** menu rebuild | Correctness, not polish |

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

### 10.5 The overhead layer — semantic zoom ✅ *shipped, phase 2 proposed*

The rule that governs everything drawn over a soldier's head: **when you zoom
out, the world shrinks — the information must not.** Names and meters are
instruments, not props; anything that exists to be *read* holds constant
screen size across the whole 16–55 zoom range.

**Shipped (`9c1f2ee` + `e3b5bc9`):**

- **Squad-only overhead.** Name tags are teammates-only — enemy plates were
  clutter *and* free intel; enemies read as silhouettes and team color. Tags
  are crisp outlined text (the old blurred shadow read as a black plate over
  the character's head).
- **The vitals circles.** Under each teammate's name: a health ring that
  walks green → amber → red, and a steel armor ring beside it when they carry
  plate. Glance at the squad, know who's hurt and whose plate is gone.
- **Constant screen size.** Tags and circles scale with the camera height
  actually flown (killcam duels included), exactly canceling distance —
  identical legibility at 16 and 55, clamped so nothing balloons up close.
- **Far-zoom blips.** Past mid-zoom the *models* are the illegible thing, so
  a team-colored ground disc fades in under every soldier (~34→48, capped
  0.8) and scales with zoom. At command height the disc IS the soldier — the
  RTS strategic-icon rule (don't shrink the tank, swap in the icon).
- **The model is never inflated.** The soldier mesh stays true-scale at every
  zoom — growing it would lie about aim, cover, and splash. Findability comes
  from the marker layer, honesty stays in the world.

The result is **semantic zoom**: zoomed in you see soldiers; zoomed out you
see *units*; the transition is a crossfade, not a mode switch.

**Phase 2 — tactical map mode (decide with the §10 rebuild):** at max zoom
the field and the minimap now carry similar information. The candidate move:
lean all the way in — max zoom becomes a *command view* (bigger blips,
objective callouts drawn on the field, squad orders clickable) and the
minimap recedes or disappears. That's also where §18's colorblind work bites
hardest: the blips are pure hue today, so the second channel (shape/icon per
team) should land here.

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

### 11.4 Trust & fair play — the anti-cheat floor

The whole game sells one thing: **respect you earn** — one-shot Wall scores
(§3.2), medals that can't be bought (§11.3), ranked command (§7). As built, all
of it is forgeable.

> **Intel — server-authoritative, but leaky.** Online, the server holds the
> real state and clients send only intent (`PlayerCmd`) — good, it contains
> state-fabrication. But it **broadcasts every soldier's exact position to
> every client** (cloaked and burrowed included) and **trusts `aimYaw`
> verbatim**. That's free wall-hack ESP and a trivial, undetectable aimbot with
> nothing but a WebSocket reader and a command injector. No memory hacking
> required.

Three rules, in leverage order:

1. **Send only what a player could perceive — interest-managed snapshots.**
   Cull each client's snapshot to units it can plausibly see (team, LOS +
   sensor range, pinged). Cloaked/burrowed/deep units never reach the enemy's
   wire — concealment becomes *true* instead of a rendering hint. This kills
   ESP and shrinks bandwidth (helps mobile, §11.2). It's a snapshot-layer
   change, not a sim change, so it can land at **Stage 1** and pays for itself
   on LAN too.
2. **The server referees the shot.** Extend the cooldown checks it already does
   into aim/hit plausibility: rate caps, spread enforced server-side, and a
   sanity gate on impossible aim (a crosshair that teleports onto every target,
   180° snaps every shot). The client asks; the server decides and can flag.
3. **Identity before The Wall.** A one-shot qualification percentile is a claim,
   and an unauthenticated claim is noise. Until accounts (Stage 3), The Wall is
   explicitly **local & unranked** and labelled so — a practice board, not a
   standing. Ranked command and the global Wall ship *with* auth.

> **Rule — the §11.3 law is void if skill can be faked.** "Never sell skill or
> history" assumes skill and history are *real*. Interest-managed snapshots +
> server-side aim-refereeing + identity are therefore the **floor beneath
> charging money** for competitive play, not a later polish pass.

*(The browser client's `window.__ww` debug handle is an offline-only sandbox —
online it only mutates the puppet world the next snapshot overwrites — but
strip or guard it in production builds regardless.)*

---

## 12. The war is mostly bots — population & bot doctrine

> **Constraint — face the body count.** For the entire local-first era (Stages
> 1–2; Slices 1–3), a match is **~1 human among ~15 bots**. The shared war with
> many humans is Stage 3+. Bots aren't filler. **Bots are the army.** Two
> consequences the rest of the directive has to own.

> **Intel — the toys are invisible to the force that plays the match.** Bots use
> **3 of 8 class abilities** (engineer turret, medic heal, infiltrator cloak)
> and **none of the new kit** — no MANPADS, no breacher burrow, no FPV drone,
> no pathfinder warp, no orbitals, **no revive**. So the anti-air duel (§5.1),
> the depth-stealth drama (§5.2), and the drag-your-buddy medal (§4.3) — the
> emotional centrepieces — do not happen in a match that is mostly bots.

**A. Match sizing is a decision, not an accident.** Today it's an accident of a
formula (1 human + 7 vs 8 locally; the server hard-codes 6 vs 7 and *ignores*
the bot slider). Set a target: **competitive fronts ~12 v 12** (humans plus
bots filling to target), **co-op 4–6**. The bigger maps (§4.3) are sized *to*
that body count — a front's playable area follows expected population, not the
reverse; a 400-unit map with 16 bodies is a ghost town. Bots auto-fill to the
target and **rebalance on join/leave** (neither happens today).

**B. Bots are first-class soldiers — parity ships in the mechanic's own slice.**
"A toy one-in-sixteen can use" is not *done*. Every mechanic lands with its bot
behaviour, priority order:

1. **Revive & drag** — bots drag and *are* draggable, or the §4.3 medal never
   fires in a bot match and medics stay pointless.
2. **MANPADS** (bots lock and flare), **breacher burrow** (bot tunnelers
   dive/surface), **FPV/recon drones**, then **pathfinder/ghost/orbital**
   abilities — the `pathfinder` and `ghost` bots we already spawn are currently
   ability-inert.

**C. Difficulty must mean tactics, not just aim.** Today the three tiers vary
**one number** — aim error. Veteran/Elite should also mean *use cover, retreat
when hurt, focus-fire, coordinate a push* — otherwise "harder" is just
"snappier headshots," which reads as cheap, not skilled.

**D. Bots carry the war, not just the match.** In the Living Campaign (§8.5),
bot-heavy matches still move fronts — a faction's bots hold the line while its
humans sleep. This is §7.3's "who's online" answer one level down: the army
fights on without you, and the Morning Dispatch reports how the bots did.

> **Honest scope.** Ability *parity* (B) is incremental — ~a day of bot logic
> per mechanic; retrofit the just-shipped MANPADS/breacher/drone first.
> Tactical *depth* (C) is a bigger lift — v1 target is parity, v2 is smarts.

> *An army that only fights when you're watching isn't an army. Make the bots
> carry the war.* — bot design north star

---

## 13. The season — winning, losing, and resetting the war

§8.5 designs how a match moves a front. This is the missing top of the campaign:
what the war **is across time**. Three unsolved problems every persistent war
dies on, each with a design.

**A. Snowball & comeback — the losing side needs a war worth fighting.** The
failure mode is universal (Foxhole, Planetside): one faction takes everything,
the other logs off.

- **The front line, not the map, is the unit of momentum.** A faction can only
  push fronts *adjacent* to ground it holds — gains are a moving line, not a
  sweep. You can't lose all ten at once.
- **Darkest Hour bonuses.** The trailing faction gets escalating help — more
  War Materiel per hold (§17), cheaper prototype trials (§6), a home-ground
  defensive edge on its last fronts. Losing becomes a *rally*, not a spiral.
- **No total wipe.** Each faction always holds a **capital front** that can be
  besieged but not captured. The war is won *on points at season end*, never by
  erasing someone mid-season.

**B. Faction balance — enlistment can't be a trap.** §1 makes enlistment a
one-way door per tour; if 80% pick one flag, the queue decides the war.

- **The underdog is the better deal:** the outnumbered/losing faction offers
  more rank progress and richer Journal stakes, so population self-balances
  toward the fight that needs bodies.
- **Bots backfill the thin side first** (§12): human imbalance is softened with
  more and better bots for the outnumbered faction.
- **Defection stays costly and recorded** (§1): between tours only, stamped in
  the dossier forever — a valve, not a revolving door.

**C. The season lifecycle — the war has to end so the next can mean something.**

- A **season** is a fixed span (target ~4–6 weeks live; offline, a configurable
  campaign length). It ends when a faction crosses the **victory threshold**, or
  the clock expires and points decide.
- **Season end is the Armistice:** the victors are written into every
  participant's dossier ("fought for the winners of the Meridian Offensive"),
  and a new season opens — optionally with the losing doctrine buffed
  (dynamic-canon catch-up).
- **Persist vs reset — the clean line:** the **dossier persists** (identity,
  medals, armory, quals, journal) because that's biography (§3.1). The **war
  resets** (control, scars, the front line) because that's the map. Your record
  remembers every season; the theatre starts fresh.

> **Honest scope.** Offline, a "season" is one configurable run of the local
> `ww_campaign` file (§8.5); win/reset is local logic. Cross-player shared
> seasons are Stage 3. Darkest-Hour and underdog bonuses are tuning knobs on the
> control math that already exists — cheap to prototype.

---

## 14. The first hour — onboarding & the new player

§10 fixes the deploy *screen*; nothing designs *moment zero*. Today a newcomer
lands in a 16-body TDM with 200 weapons in a dropdown and no idea who they're
fighting or why. For a paid game this is the conversion moment — design the
funnel.

1. **Enlist, don't configure.** First launch asks one real question: **pick your
   faction** (§1). Callsign, then straight into a scripted **Basic Training** run
   in the Proving Grounds (§3.3): move, shoot, throw (the hold-G arc), take a
   point — plus movement school: the vault and the climb (§8.7), reading the
   ground (§8.6), and sound discipline (deck plate betrays, snow confesses,
   §18/§19). Five minutes, hand-held, ending in your Infantry qualification and
   your first dossier entry. This *is* the infantry course (§3.2) doubling as the
   tutorial — one build, two jobs.
   **Skipping bootcamp costs you a rank.** Basic Training graduates enlist as
   **Private**; skip it and you deploy as a **Draftee** — one rank below, and
   the dossier remembers which you were forever. No power difference, pure
   biography (§11.3-safe): the price of skipping school is that your record
   says you skipped school. Finish bootcamp later and you promote — but the
   Draftee start stays in the service history.
2. **First deployment is a soft landing.** The first real match is flagged:
   a teaching mode (small Conquest or TDM), difficulty pinned to Recruit,
   **spawn-protected** (§16), a squad of friendly bots that follow you (§12,
   §15), and a one-line objective callout. No prototype, no vehicle pressure.
3. **The war reveals itself in layers.** Don't show the whole Scar on day one.
   After match one: "your fight moved the Eastern Front." After a few: the
   Barracks, medals, the personal armory. Systems unlock as you meet them, so
   the 200-weapon armory and the ten-front war arrive as *earned context*, not a
   wall on the first screen.

> **Constraint — it rides on Slice 1 + 1.6.** FTUE needs the Dossier and the
> Proving Grounds to exist first, so it's authored at the tail of Slice 1.6 /
> head of Slice 2 — but it's the thing that makes both *legible* to a stranger.

> *The tutorial is the infantry course is the first medal. One flow, three
> payoffs.*

---

## 15. The squad — friends, grouping & comms

The directive's best fantasy — drag your buddy out of the fire (§4.3), one
prototype per squad (§3.1, §6), the squad holds together (§7) — all assume a
**squad** that isn't designed. Design it, because five other systems lean on it.

- **The squad is 2–4 soldiers** who deploy together, **share a spawn**, and read
  each other on the HUD (name tags, health, a "downed — help" beacon that pings
  the squad first, §4.3). **Spawn-on-squadmate** (a living, safe one) is the
  travel-time answer for bigger maps — you rejoin the fight *near your people*,
  which is exactly what makes reaching a downed teammate a decision instead of a
  formality.
- **Comms without voice, first.** A grounded **comms wheel** ("enemy armor," "on
  me," "need a medic," "contact — grid") plus **map pings** the squad sees.
  Voice is a Stage-3 nicety; the wheel and pings carry 90% of coordination and
  ship now — the ping/waypoint plumbing already exists (tac-system waypoints).
- **Friends & persistence.** A friends list (callsign-keyed, like the existing
  chat mailbox) and **named squads that persist across matches** — your
  fireteam accrues history, and its feats ("Reyes' Rangers — held Bridge Delta
  twice") are Journal-worthy (§3). Clans/companies are the same idea one size
  up, deferred to Stage 3.
- **The squad is the unit of issue.** Prototypes and mission gear written "one
  per squad" (§3.1, §6) finally have a referent — the squad leader draws it.

> **Constraint — build the container now, fill it later.** The full social
> system needs humans (Stage 2+), but the *primitives* — squad HUD,
> spawn-on-mate, comms wheel, pings — should be in the sim/HUD early. Offline,
> **your friendly bots are your squad**, which also serves §14's first match and
> §12's bot doctrine. Design the squad as the container today.

---

## 16. Conduct — griefing, moderation & the social dark side

The systems that generate the best stories also hand a bad actor the sharpest
tools. **Every powerful social verb ships with its abuse case answered in the
same slice** — guardrails are cheaper built in than bolted on.

- **Spawn protection.** There is none today, and §4.3 adds lethality on bigger,
  camp-friendly maps. Add a short **post-spawn invulnerability that breaks the
  instant you fire**, plus enemy-aware spawn selection (never drop a player in an
  enemy's lap). Standard, cheap, load-bearing.
- **Friendly fire & the team-kill ladder.** Decide FF per mode (off casual,
  reduced competitive); repeated team-damage escalates damage-reflect → forgive
  prompt → auto-kick. **The drag can't become a grief tool** (§4.3): you can't
  haul an unwilling teammate into danger — the downed player consents, or the
  drag only ever moves them *toward* friendly cover.
- **Command is not a troll's throne (§7).** Relief of Command gets a **cooldown
  and a cost** so it can't be spammed; officer standing orders have guardrails
  (can't order the faction to abandon every front); devolution (§7.3) routes
  command past an AFK or abusive officer. And officer power is **audited in the
  Journal** — grief leaves a permanent, public record, which is itself the
  deterrent.
- **The basics.** Text chat gets **mute + report** (Stage 2); **AFK detection**
  returns idle bodies to bots so a match isn't held hostage; and a flagged or
  cheated Wall score is **voided, not merely hidden** (ties to §11.4).

> **Honest scope.** Most of this is small and local — spawn protection, FF
> rules, consent-gated drag, and command cooldowns ship *with* their features.
> Report/mute/moderation tooling is Stage 2+ with the social layer.

---

## 17. Progression & the faction ledger — the 95% and the economy

Command (§7) is the endgame for a handful of officers; medals and quals (§3) are
the collection layer. Missing: a mastery ladder for everyone who'll never
command, a per-match reward loop, and a defined economy for the resources §7
already spends.

**A. The mastery ladder (the non-officer chase).** Rank gives *command* to a
few; rank **points** should give *everyone* a legible climb — per-class mastery
tiers (feeding §3.2 quals), weapon service milestones that unlock **cosmetic-only
flair** (§11.3 — taste, never power), and a **prestige** loop at the ceiling
(reset the number, keep the record, earn a mark) so the 500-hour player still
has a next thing. None of it sells power; all of it signals history.

**B. The session reward loop.** Every match ends owing you something concrete
beyond the scoreboard: dossier deltas (§3.4), campaign movement (§8.5), and a
short end-of-match "what you earned" beat on the AAR screen (§10.4). The loop is
**fight → your record grew → your war moved**, visible every single match.

**C. The faction ledger (the economy §7 spends from).** §7 has officers
*spending* supply drops, vehicle pools, and prototype trials; §6 banks research —
but nothing defines the **income**. Model it as one per-faction currency, **War
Materiel**:

| | Source | Sink |
|---|---|---|
| Passive | Holding fronts (trickle, scaled by front value, §8.2) | Darkest-Hour rebates to the underdog (§13) |
| Active | Winning matches; completed missions (§8.1) | Supply drops, vehicle-pool unlocks, prototype trials (§6) |

- **The rule: a faction can go broke.** Overspend and the pool dries up, forcing
  officers to prioritise. **Scarcity is what makes officer decisions (§7.1)
  actual decisions** instead of free clicks.

> **Honest scope.** The ledger is a few counters on the campaign file (§8.5) —
> cheap. Prestige and mastery flair are cosmetic and trickle in. The point is to
> **name the economy now** so §6 and §7 aren't spending imaginary money.

---

## 18. The sensory & access layer — music, ambience, accessibility, comfort

The game *feels* great to shoot — rich particles, ragdolls, a slow-mo killcam —
but it is **silent between gunshots** and **legible only to players who see
hue**, and it's about to add motion (knockback, screen kick, airborne pops) with
no comfort valve. Four gaps, one layer.

- **Music — the emotional score (absent).** The audio engine is a pure one-shot
  SFX player; there is no music at all. Add an **adaptive bed**: a low loop that
  swells on contact and drops on the lull (drive it off the combat-intensity
  signal the sim already has — nearby enemies, recent damage), plus **authored
  stingers** on the beats that matter — deploy, a front falling, the last stand,
  the Morning Dispatch (§7.3), a medal earned. Cheapest emotional ROI on the
  board; it just needs a looping music bus beside the SFX player.
- **Ambience — the soundscape (✅ pipeline shipped, assets pending).** One
  ducked ambient bed per theatre so the world isn't dead air between shots.
  The **designation system is live** (`371fe9d`): every theme has a named
  ambience slot + a per-surface footstep slot (`src/client/soundscape.ts`),
  the engine gained a fading loop bus, footsteps pick the theme's surface and
  fall back to the universal step until a slot is filled, the harness's
  **Biome Audio panel** auditions every slot, and `sound-specs.json` carries
  the generation prompt for each — one ElevenLabs run fills the war with
  sound.
- **Colorblind & shape-coding (a correctness gap, not polish).** Team identity is
  **100% hue** — amber vs cyan, and *nothing else* — so a colorblind player can't
  reliably tell friend from foe. Add a **second channel**: friend/enemy shape or
  icon differentiation on soldiers and minimap dots (not just color), plus a
  colorblind palette option. You can't sell a shooter a player can't read.
- **Comfort & control.** A **reduced-motion** toggle (caps camera shake, softens
  the airborne pop, tones the drone whiteout) — the §4.1 knockback work hangs its
  intensity on this switch. Plus **keybind remapping** (hardcoded today) and
  master + per-bus volume sliders. These live in the **Settings screen (§10.3)**
  the directive already flags as a billing gate — this section names *what
  Settings must contain* beyond video and volume.

> *A war you can't hear the weight of, or can't tell your side in, isn't
> finished — no matter how good the ragdolls are.*

---

## 19. Seeing the war — vision cones & the fog of war

Today the top-down camera is omniscient: everyone on screen is visible to
you, which quietly deletes half of infantry combat — flanking, ambush,
stealth, *checking corners*. Give sight a shape and all of it comes back.

### 19.1 The cone, the ring, and the dark

- **You see a cone** (~130°) in your facing, out to your vision range — full
  color, full detail. **You sense a ring** (~9u) all around — footsteps-close
  presence, rendered but dim. **Beyond both is the dark:** the world dims
  (ground/walls stay readable — you always know the *terrain*), and enemies
  there simply aren't drawn.
- **Ghosts, not teleports.** An enemy who leaves your vision keeps a fading
  **last-known ghost** for ~2s at the spot you lost them — you watch the
  memory decay, then they're gone. Re-acquired = snap back to live. (The
  killcam's "watch them maneuver into the shot" already proved how much story
  live position data carries; ghosts are that as core gameplay.)
- **The squad shares eyes** (§15): anything a squadmate sees, you see. The
  Head Cam Network equipment already promises exactly this on the minimap —
  it graduates to *field* vision. Drones, spy cams, and beacons become
  remote eyes with real value.
- **Aiming narrows you.** ADS-style focus (hold-fire, scoped weapons)
  lengthens the cone and narrows it — the sniper's tunnel vision is REAL,
  and flanking a scoped enemy becomes the counter the range deserves.

### 19.2 The counter-economy — gear that buys sight

Vision becomes the war's second currency (the §8.4 audit called it: streets
are corridors, slits are angles, roofs are denial — now *facing* is too):

- **The 360 sensor helmet** (equipment): full-circle awareness ring at
  double radius — no cone extension. You can't be crept on, but you gave up
  a slot for it. The paranoid pick.
- **The K9 barks at what you can't see** (§5.3 — *the dog we already
  planned becomes indispensable*): a threat behind you inside the dog's
  sense radius triggers a **directional bark** — a growl-vector on screen
  pointing THROUGH your fog at the stalker. The dog is a living 360 sensor
  that loves you. Nothing else in the game will generate more "good boy"
  clips.
- **Sound renders in the dark** (§18 ties in): gunshots, footsteps-by-
  surface (§8.6), engines — anything audible outside your sight draws a
  brief directional smudge. Sneaking on deck plate is LOUD; grass is quiet;
  snow is silent but leaves tracks. Hearing becomes a skill.
- Existing gear re-prices itself: IR/UV goggles (see cloaked → see *through
  dark*?), flares/night (§8.8), the falcon's aerial eyes (§5.5), spy
  cameras. The equipment table finally has a fight to referee.

### 19.3 Honesty — what this costs and where it must live

- **The fog must be TRUE, not cosmetic.** Rendering-only fog is a wallhack
  invitation (§11.4's exact ESP hole). The vision function (cone + ring +
  squad-share) is written ONCE in the sim and used twice: the server culls
  snapshots with it (what you can't see is never on your wire), the client
  renders with it. §11.4 and §19 are the same work item — build the fog and
  the anti-cheat comes free, build the anti-cheat and the fog comes free.
- **Bots must respect it** (§12): bot target acquisition already uses LOS;
  it adopts the same cone so bots can be flanked, snuck past, and ambushed —
  which single-handedly makes stealth classes work in bot matches.
- **Comfort:** the dark is *dim, not black* (top-down needs spatial
  orientation), the minimap keeps its own rules (§10.5's tactical layer),
  and the killcam ignores fog (it's a replay of truth).
- **Phase 1** (client-visual): cone/ring dimming + enemy cull + ghosts +
  squad share, offline-first where the sim is local anyway. **Phase 2**
  (server-authoritative): the same function culls the wire — §11.4 Stage 1.
  The 360 helmet, K9 bark, and sound smudges ride Phase 1.

> *The map shows you the war. The cone shows you YOUR war. The difference
> between them is fear — and fear is content.*

---

## Appendix A — Field status

- ✅ **Cursor-targeted throws shipped** (`b722960`): hold-G arc + landing ring,
  0.09u landing accuracy, all throwables + bots, 170 tests green.
- ✅ **Invisible walls PERMANENTLY fixed** (single source of truth): the
  generator records exactly which tiles each prop's mesh stands in for
  (`map.propCovered`), prunes claims later stamps overwrite, and the renderer
  skips that set and nothing else — footprint re-derivation (the root of every
  recurrence) is structurally gone. Unknown future tile types render as walls
  and warn instead of going invisible. Guarded by `tests/walls.test.ts`
  (35 maps across all themes; mutation-tested — a planted orphan claim fails
  the suite) and live-probed: 764 blocked tiles, 0 without a visual owner.
- ✅ **Knockback pipeline exists** in the sim (blast shove, airborne pop, armor
  immunity) — explosives just don't use it yet. §4.1 is data + tuning.
- ✅ **Water & neighborhood** already in the engine (water tiles, safehouse
  houses).
- ✅ **Audio:** 58-sound ElevenLabs pack, loudness-leveled, rifle & growl
  variety, review/replace tooling (`/sound-review.html`).
- ✅ **FPV drones shipped** (`880dbf4` + `14dc09b`): pilotable, blinding
  static leash, crash-out, 176 tests green.
- ✅ **Combat-feel trio shipped:** blast knockback (`d50374f`), breacher
  depth-stealth (`1384a68`), MANPADS vs Kestrel with flares (`92df4a8`) —
  each with tests, all live-verified in the shipped bundle.
- ✅ **Killcam duel framing shipped** (`311bb66`): the top-down killcam frames
  victim + killer at midpoint, marks the killer with a pulsing ring, and
  names the shot with range ("Killed by Grit · 50u"). Replicates online.
- ✅ **Armor is a real pool now** (`9c1f2ee`): vest/power armor issue PLATE
  that absorbs before hp and never heals back; reissued on respawn. Same
  totals as the old maxHp bonus — balance unchanged, presentation honest.
  Prototype shields (§6) later = the third pool that *recharges*.
- ✅ **Overhead layer / semantic zoom shipped** (`9c1f2ee` + `e3b5bc9`, §10.5):
  squad-only crisp name tags, vitals circles (health + armor rings),
  constant-screen-size scaling across zoom, far-zoom team blips.
- ✅ **Unified harness + Arsenal Lab shipped** (`7abc2f9`): top-nav modes
  (Stage / Arsenal / World), global time-scale (0.05×–2× + freeze), all 230
  weapons in one sortable compared table with an 11-slider live editor
  (mutates the real defs; Copy-Δ to hand tuning back), and a measured firing
  lane that shows every projectile's real speed, arc, tracer, splash, and
  damage.
- ✅ **Biome soundscape pipeline shipped** (`371fe9d`, §18): per-surface
  footstep slots + per-theme ambience beds, designation table, loop bus,
  fallback chain, harness Biome Audio panel, generation specs. Assets fill
  via the existing ElevenLabs run.
- ⚠️ **Decide:** terrain surface layer (§8.6) and the jump vocabulary (§8.7)
  ship with the §8.4 map pass — same grid work, do them together.
- ⚠️ **Decide:** §19 vision cones are the same work item as §11.4
  interest-managed snapshots — one vision function, two consumers. Sequence
  them as one.
- ⚠️ **Decide:** faction names/doctrines (§1) are placeholders — rename at
  will; keep the enlistment/tour mechanics.
- ✅ **Decided:** roofs + firing slits (§8.4) — cutaway roofs (visual-only
  phase 1) + `T_SLIT` tile; build before authoring any of the ten fronts.
- ✅ **The Scar exists** (§8.5) — the painted theater map with all ten fronts
  and the campaign-effect legend; becomes the front-selection screen with
  live marker overlays. Awaiting the hi-res export.
- ⚠️ **Decide:** map scale (300–400u) — prerequisite for down/drag/revive
  (§4.3); ships in the same map pass as §8.4.
- ⚠️ **Decide:** match/population target (§12) — a match is ~1 human + ~15 bots
  today; the server ignores the bot slider and never rebalances. Sizes the maps.
- ⚠️ **Risk — trust floor (§11.4):** online snapshots broadcast *every*
  position (free ESP) and the server trusts `aimYaw` (trivial aimbot).
  Interest-managed snapshots + server-side aim-refereeing + identity gate
  charging for competitive play.
- ⚠️ **Gap — bot parity (§12):** bots use 3/8 class abilities and none of the
  new kit (MANPADS, burrow, FPV drone, revive). Retrofit parity per mechanic.
- ⚠️ **Decide:** season win condition + reset cadence (§13) — the campaign has
  no ending, no comeback, no faction pop-balance as designed.
- ❌ **Gap — no squad system (§15):** friends, grouping, spawn-on-mate, comms
  wheel/pings don't exist; several systems (drag, prototype-per-squad) assume it.
- ❌ **Gap — no music or ambience (§18):** the 58-sound pack is 100% SFX; the
  audio engine is a one-shot player with no music bus.
- ❌ **Gap — team identity is hue-only (§18):** amber vs cyan and nothing else —
  no colorblind palette, no shape/icon coding. A readability/correctness gap.
- ❌ **Gap — no Settings, no keybind remap, no reduced-motion (§18/§10):** master
  volume is hardcoded; the knockback/screenshake work has no comfort valve.
- ❌ **Gap — no spawn protection (§16):** and §4.3 adds lethality on bigger,
  camp-friendly maps.
