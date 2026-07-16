# War World — Design Directive 01 (Rev 6)

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

| | **The Titan Coalition** | **The Collective** |
|---|---|---|
| Doctrine | Combined arms — armor columns, artillery superiority, air cavalry, K9s | Asymmetric & unmanned — drone swarms, EW, loitering munitions, raiding |
| Wins by | Mass and discipline | Precision and denial |
| Colors | Gunmetal & **amber** | Steel & **cyan** |
| Tech lead | EM-gun line first | Drone program first |

**Names LOCKED (decision 1B):** the shipped game already calls them the
**Titan Coalition** (amber) and **The Collective** (cyan) on every
scoreboard, killfeed, and team chip — the directive now matches the code.
The warm-amber *human* army against the cold-cyan *machine* doctrine is the
identity; no rename pass will ever be needed because nothing was ever
shipped under another name.

**Asymmetry LOCKED (decision 2B):** factions differ in **early access,
signature assets, and operational options** (the Coalition fields K9s and
falcons first, the Collective fields swarms and UGVs first) — but counters
are shared and tech *crosses over* eventually. No hard-split rosters: full
asymmetry multiplies balance, content, bot-AI, and onboarding costs for a
team of this size.

**How enlistment works**

- **You sign for a tour — and a tour IS one campaign season (decision 4A).**
  Enlistment, season history, defection windows, and tour rewards all share
  one clock. Your record, medals, and journal entries stamp the tour they
  were earned in.
- **Every match you play is fought for your faction.** Offline, bots wear both
  flags; you always deploy under yours, and your result moves your faction's
  fronts.
- **Doctrine is real:** your faction's tech tree, vehicle skins, and unlocked
  prototypes differ.
- **Defection is allowed between tours — and it's recorded.** "Two tours
  Coalition, then crossed to the Collective" is a story your dossier tells forever.
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
- **Vehicle hardpoints — decided (operational requisition).** Upgrades to
  the motor pool are fits, not property: flare pods (shipped, §5.1), ECM,
  cage armor vs rockets, mine flails, dozer blades — **requisitioned per
  deployment with faction War Materiel (§17)**. Your vehicle *service
  history* gates which fits you may draw (qualified crews get the good
  hardpoints), but history never raises raw stats — access is earned, the
  fit is issued, and nothing personal makes your tank hit harder (§11.3).

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
- **One attempt counts — forever, and you KNOW when you're taking it
  (decision 18B).** Practice runs are unlimited and marked PRACTICE. The
  official run is a separate, **explicitly confirmed** entry — you step to
  the line, the game asks *"this one counts, forever — ready?"*, and only
  then does the clock arm. The result records both the fixed grade and the
  percentile-at-the-time. That score goes on **The Wall** — the standing
  leaderboard every player sees — and stamps your dossier: *"Qualified
  Expert, 96th percentile, first attempt."* A permanent score is only
  meaningful when the player knowingly accepts the attempt — nobody locks a
  lifelong number by accident, and nobody locks it in the tutorial (§14's
  Basic Training run is always PRACTICE; the official Infantry attempt is
  offered right after, ready when you are).
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
- **The Paintball Yard — the arcade wing.** Small **Brawl-Stars-scale arena
  pockets** (~40–60u, mirrored, readable at a glance) built almost entirely
  from the jump vocabulary (§8.7): low walls you vault, barriers you can't,
  one or two sightline blocks. **Paintball markers** — full gunplay feel,
  zero damage: a hit is a *splat-out* and a 3-second bench. It's where you
  taste weapons risk-free with STAKES (a local Wall board per arena), where
  new players learn movement without dying for it (§14), and where the jump
  grammar gets stress-tested before it ships to real maps. Off-canon, no
  dossier weight — the rec yard behind the barracks.
- **Motor Trials (proposed, honest):** time-trial circuits for the motor
  pool. *Blocked on feel:* today's vehicles steer by tank-style turn rate —
  fine for combat, dull for racing. Trials ship **after a vehicle-handling
  feel pass** (grip, drift, momentum), not before; a bad race is worse than
  no race.

**v1 scope (honest):** one new mode id (`range`), a small hand-tuned map
(reusing safehouse-house + harness pieces), infantry course + two class
courses, dummy targets that report score. Solo only. The Wall is a local
leaderboard until Stage 3 accounts make it global. The Paintball Yard is the
v1 *stretch goal*; Motor Trials wait for the handling pass.

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
- **Doctrine fit:** K9s are a Coalition signature (§1) — the human-and-animal
  army against the Collective's machines. Dog vs robot-dog is a fight we want.

### 5.4 Drones & ground robots — *first slice SHIPPED*
All fielded today: ISR quadcopters, strike drones, loitering munitions
(Switchblade), UGVs (Ripsaw/THeMIS, robot dogs). These are **the Meridian
Collective's doctrine** and the visible reward of §6 — hold the right fronts and your
faction's machines roll onto the field.

**✅ Personal FPV drones — SHIPPED.** The Ghost/EW operator's Q now deploys a
drone the player *flies*: the body kneels at the controller (defenseless —
that's the risk), the camera becomes the drone's feed, and it spots enemies
for the team. The control link is the leash: fly past ~55u and **static floods
the feed until the link drops and the drone tumbles out of the sky and breaks
on the dirt** — same fate from enemy EMP, gunfire, a drained battery, or the
operator going down. Strategically this is the Collective doctrine made playable,
and the EW-vs-drone duel (jam it, shoot it, hunt the kneeling pilot) is the
predator/prey loop in miniature. Bots keep the auto-orbit version.

### 5.5 The bird — *proposed, honest assessment*
"How useful would a bird be?" — more than it sounds, and it's real: Dutch
police trained **eagles to intercept quadcopters**, and hand-launched
bird-sized ISR drones (RQ-11 Raven) are standard issue. Two grounded takes:

- **The falcon (counter-drone):** a trained raptor that dives the Collective's ISR
  quadcopters and rips them out of the sky. Niche — but it's the *organic
  counter* to drone doctrine, it's dramatic, and nobody else's war game has
  it. Pairs with the K9 as the Coalition's living-army identity.
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
- **Doctrine forks the tree (§1):** the Coalition unlocks the EM-gun line first;
  the Collective unlocks the swarm line first. The war decides who gets the future.

> *Standard issue is real. The future is a reward.*

---

## 7. Command — rank with teeth

Rank shouldn't be a badge. It should be **decisions**. And the chain of
command — the thing armies invented because people go missing — is also the
answer to "who's online?"

**Rank ≠ command — LOCKED (decision 10B).** Rank creates *eligibility*;
holding command additionally requires a **command qualification** (a §3.2
course — judged, one-shot scored like the rest) and an **acceptable conduct
history** (§16's audit trail is the record). Hours played prove endurance,
not judgment — the largest grinder does not automatically inherit a
faction's war.

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

**✅ The Goliath Assault Walker — SHIPPED.** The motor pool's twelfth hull and
its first legs. The design is the *walking middle ground*, and every stat
points at it:

- **The legs are the mechanic:** low cover that walls off every wheeled and
  tracked hull is a stair step to the Goliath (`strider`) — it walks straight
  over sandbag lines, crate yards, and trench lips. The first vehicle that
  uses infantry routes.
- **Balance slot (relational, test-enforced):** hp **480** between APC (450)
  and tank (650) · straight-line speed **9** — slowest armed ground unit ·
  turn rate **2.4** — best heavy pivot in the pool (walkers turn in place;
  the tank's 1.5 doesn't). You out-rotate armor and out-climb it; it outruns
  and outguns you.
- **The GAU-9 arm cannon:** 22 dmg × 4/s (88 sustained dps) with a light
  1.2u splash — strong against flesh in the open, mediocre against armor.
  **The tank stays armor king;** the Goliath is infantry support that terrain
  can't stop.
- **The Seismic Stomp** (ability, 6s cooldown): an AoE ground slam through
  the shipped knockback pipeline — 16 knockback + a 35-splash bruise scatters
  whoever crowds the legs. A panic button, not a strategy.
- **Fiction slot:** walkers aren't fielded hardware (§2) — the Goliath is the
  **Prototype Program's first walker** (§6). v1 parks on a pad like the rest;
  when factions land, it graduates to field-trial issue.
- **What kills it:** AT rockets, the tank it can't outgun, massed fire from
  cover it *strides into*, and — when they arrive — the Iron Eaters (§20),
  who will regard it as a delicacy.

### 8.2 The maps — ten named fronts, in full

> **The map PLAN now lives in its own document — [`docs/MAP-STRATEGY.md`](MAP-STRATEGY.md):**
> map families (arena/paintball pockets, dynamic neighborhoods, the ten
> fronts, Proving Grounds wings), the dynamic-house requirement, the
> concealment rule (inside a house = unseen, §19), and build sequencing.
> This section stays the canonical *front roster*; the strategy doc owns
> *how we get there*.

Maps are not backdrops. Every map is a **named front in the war** with four
required properties:

1. **Readable from the top-down camera** — clear lanes and landmarks, no maze
   soup.
2. **A signature moment** — the thing players tell stories about.
3. **A persistent scar** — how campaign state permanently rewrites it.
4. **A doctrine lean** — some ground favors Coalition armor, some favors Collective
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

**Sequencing — DECIDED (35B): one integrated foundation pass.** Roofs/slits,
the larger scale, the terrain surface layer (§8.6), and height-aware jump
obstacles (§8.7) all touch the same grid and the same authoring assumptions —
they land as **a single map-foundation pass**, not four retrofits. Then the
ten fronts get authored once, against the finished alphabet. **No new maps
until the pass lands** — nothing gets built twice.

**Map scale — DECIDED (33C): population-scaled families, not one number.**
"Bigger" is not a design; scale follows population, mission, and travel
expectations: **~300–360u for standard 12v12 fronts** (32B), smaller mission
pockets (arenas, Breach & Clear compounds), and larger corridors only where
a front's vehicle play earns them (the Plains' tank country, the Pass's
convoy road). Per-front, tuned — never a global constant.

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
2. **Results move fronts — with BANDS, not a hair-trigger flip (decision
   22B):** finish a match deployed at front F → win shifts `control` toward
   your faction, **weighted by mode and by the front's importance** (a
   Conquest win on the Airbase moves more than a TDM skirmish on the
   Plains). The −100..+100 value reads out in three bands — **controlled /
   contested / enemy-controlled** — so ownership changes feel like
   campaigns, not coin flips, and a single match can never whipsaw a front
   between owners.
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

**Menu placement LOCKED (decision 6B):** the deploy-screen rebuild does not
wait and does not block. The **tab shell + reserved Map/Barracks slots ship
alongside Slice 1** (the Dossier needs a Barracks door anyway); visual polish
lands during Slice 1.5. The storefront and the persistence systems proceed in
parallel instead of queueing.

**SCOPE FREEZE for the next three slices (decision 7A):** the slices contain
**the Dossier, the Scar, the Proving Grounds, the essential menu shell, bot
parity, accessibility table stakes, and the trust prerequisites — and nothing
else.** No stretch goals, no "it looked cheap" additions (that moves the
Paintball Yard, Motor Trials, and every §20 system explicitly *after* the
freeze). The project's biggest threat is not a lack of ideas; it is features
entering through side doors. This paragraph is the door policy.

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

### 9.2 Three.js build support — where the `/threejs-game` skill applies

The team carries a Three.js game-dev skill (quick-reference patterns plus
deep files: `materials.md`, `cameras.md`, `effects.md`, `lighting.md`, and a
performance checklist — instancing, LOD, draw-call budgets, texture atlases,
pixel-ratio caps). **Invoke it at the START of these work items**, ranked by
where its encoded gotchas save the most real debugging time:

| # | Work item | Why the skill earns its keep there |
|---|---|---|
| 1 | **§8.4 cutaway roofs + firing slits** | The single best fit. Cutaway roofs are a classic Three.js trap zone: transparency sorting, `renderOrder`, depth-write on fading materials, per-building opacity transitions *without a material explosion*. These gotchas are exactly what `materials.md` encodes — and §8.4 gates every new map, so debugging time saved here is schedule saved everywhere. |
| 2 | **§10.2 deploy-screen rebuild** | The 3D class turntable + map-preview tab is greenfield Three.js-in-UI: a second small scene embedded in a menu — its own lighting, staging, resize handling. The harness stage already does all of this (and now pulls `THEME_PALETTES` from the renderer and biome audio from the soundscape module) — the skill's job is helping **extract that stage into a reusable player-facing component** cleanly instead of forking it. |
| 3 | **§11.2 mobile performance** | The renderer bundle is ~835 KB and phones are the stated next platform. The skill's perf checklist (instancing — walls already use it, extend the discipline; draw-call budgets; material sharing — the blip layer set the pattern; pixel-ratio caps — the harness already clamps to 2; LOD) turns the mobile pass into a checklist walk instead of rediscovery. |
| 4 | **Killcam phase 2** (hero-orbit + ordnance chase cams, tabled in the §10.5 conversation) | Cinematic camera rigs, orbit framing, and speed-ramping are standard skill territory (`cameras.md`, `animation.md`). The duel-framing killcam shipped; the orbit and missile-chase shots pick up from there. |

**The rule:** these four items don't start with a blank editor — they start
by loading the skill and its relevant reference file. Everything else in the
renderer keeps following the codebase's own established patterns first.

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

1. **Send only what a player could perceive — interest-managed snapshots.
   DECIDED (68A): this ships BEFORE any internet hosting, period.** Cull each
   client's snapshot to units it can plausibly see — using the **same
   perception function as the §19 vision cone** (team, cone + ring, squad
   share, pinged). Cloaked/burrowed/deep units never reach the enemy's wire —
   concealment becomes *true* instead of a rendering hint. This kills ESP and
   shrinks bandwidth (helps mobile, §11.2). Sending hidden enemy positions to
   every client is not a future anti-cheat problem; it is a present
   architecture defect, and no `wss://` endpoint goes public while it exists.
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

### 11.5 The War Room — the operator's surface (decided, scoped)

When the war runs 24/7 (Stage 2+), the admin doesn't join a match to check on
it — they **log into the War Room**, a web console beside the game:

- **Observe:** the Scar live (every front's control %, owner, active scars,
  momentum), battles in progress (front, mode, humans vs bots, score), and
  the season standing — *who is winning the war*, at a glance.
- **Administrate:** freeze/end a match, kick/ban, server broadcast, restart
  a room — the boring tools that keep a live service alive.
- **Nudge the campaign:** tip a front's control, stage or name an operation,
  flip a scar — the operator's hand on the map, logged to the Journal like
  any other act of command (§16's audit rule applies to admins too).
- **Doubles as the spectator surface:** the same read-only view is the
  broadcast/caster screen, free.

**Scoped by decision:** the War Room ships *observe + administrate + nudge*.
A fourth panel — pacing and orchestration of the war's events — has a
**reserved empty slot and no design**: that conversation (see Appendix A) is
deliberately deferred.

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

**A. Match sizing — DECIDED (32B): 12 v 12 competitive, 4–6 co-op.** Today
it's an accident of a formula (1 human + 7 vs 8 locally; the server
hard-codes 6 vs 7 and *ignores* the bot slider). The target is locked:
**12 v 12 with bots filling every open position**, co-op 4–6 — big enough to
feel like a battle, small enough that one soldier's actions still matter and
phones can carry it. Maps are sized *to* that body count (§8.4 / 33C) — a
front's playable area follows expected population, never the reverse. Bots
auto-fill to the target and **rebalance on join/leave** (neither happens
today).

**B. Bots are first-class soldiers — parity order DECIDED (49A).**
"A toy one-in-sixteen can use" is not *done*. The retrofit order is locked:

1. **Now:** MANPADS (bots lock and flare), breacher depth toggle, and
   FPV/recon drone behavior — the three shipped mechanics bots can't touch.
2. **With the downed system (§4.3):** revive & drag — bots drag and *are*
   draggable, or the drag medal never fires in a bot match and medics stay
   pointless.
3. **Then:** the remaining class abilities — the `pathfinder` and `ghost`
   bots we already spawn are currently ability-inert.

**C. Difficulty must mean tactics, not just aim.** Today the three tiers vary
**one number** — aim error. Veteran/Elite should also mean *use cover, retreat
when hurt, focus-fire, coordinate a push* — otherwise "harder" is just
"snappier headshots," which reads as cheap, not skilled.

**D. Bots carry the war, not just the match.** In the Living Campaign (§8.5),
bot-heavy matches still move fronts — a faction's bots hold the line while its
humans sleep. This is §7.3's "who's online" answer one level down: the army
fights on without you, and the Morning Dispatch reports how the bots did.

- **The offline "overnight" is HONEST (decision 27B):** a local game cannot
  fight while the program is closed. On launch, the campaign runs a **capped,
  deterministic time-skip simulation** of the elapsed period and labels every
  outcome as **simulated bot actions** in the Dispatch — *"while you were
  gone (simulated): the Collective pushed Bridge Delta to contested."* The
  emotional promise survives; the game never pretends a nonexistent server
  was running. (Real overnight war arrives with Stage 2 servers.)

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
- **The season tells its story in three acts** — war, outbreak, Iron Eaters —
  with a faction-choice finale. The acts are canon; see **§20.5** for the
  ladder. (What *paces* them is deliberately unspecified for now.)

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
   §18/§19). Five minutes, hand-held, ending in your first dossier entry.
   This *is* the infantry course (§3.2) doubling as the tutorial — one build,
   two jobs — but the tutorial run is always a **PRACTICE** run: the one-shot
   *official* attempt (18B) is offered right after, taken only when you say
   you're ready. No newcomer locks a lifelong score by accident.
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

- **Spawn protection — DECIDED (55B).** There is none today, and §4.3 adds
  lethality on bigger, camp-friendly maps. The rule: **protection holds until
  you fire or take any hostile action, hard-capped at ~5 seconds**, combined
  with **enemy-aware spawn selection** (never drop a player in an enemy's
  lap). No spawn kills, and no protected player ever shoots first.
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

- **Rust is biography, never decay — decided.** A class unplayed for ~a
  season gets a **rusty** tag in the dossier: zero stat loss, ever (Tarkov
  tried real decay; players hate being punished for vacations). Instead your
  first match back runs a *"knocking the rust off"* arc — a small warm-up XP
  bonus and a returning-soldier ribbon. The record says you were away and
  says you came back; both are story.

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
- **Vehicle hardpoints (§3.1) are the ledger's standing sink:** every fitted
  flare pod, ECM set, and cage-armor kit is Materiel spent — a mechanized
  faction runs richer *and* burns hotter, which is exactly the tension the
  Iron Eaters (§20) then feed on.

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
- **v1 is the LIGHT cone — decided.** No wall-shadowing, no shadow-casting
  pass: the cone only decides **which enemies draw**. Terrain always renders;
  the existing losClear rules keep governing what they already govern. The
  full occluded fog is a maybe-later — the light cone delivers ~90% of the
  fear for ~10% of the work.
- **Ghosts, not teleports — and the memory is GATED.** An enemy who leaves
  your vision keeps a fading **last-known ghost** at the spot you lost them —
  base linger ~1.5s, and gear/skill can buy more, **hard-capped at 3s**
  (tracker optics, the 360 helmet's rear memory — §19.2: how long your
  mind's eye holds a contact is itself a piece of kit). Re-acquired = snap
  back to live.
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

## 20. The Iron Eaters — the war's third act

The third force, committed. Rogue **self-replicating nanite munitions** from a
downed prototype munitions platform — the war's own hubris (§6, Dr. Voss's
program) made them. They don't shoot much. They **corrode, consume, and
assemble**. Where the Outbreak (§8.3) eats flesh, the Iron Eaters eat metal:

| Threat | Devours | Feared most by |
|---|---|---|
| The Outbreak | flesh | the human army (Coalition doctrine) |
| **The Iron Eaters** | metal | the machine army (Collective doctrine) |

Each faction's greatest strength is exactly what its nightmare eats. That
tension is permanent, and it's the spine of the season's story (§13).

### 20.1 The bestiary — junk given hunger

They are **metallic beasts assembled from battlefield scrap** — not robots,
not vehicles: wreckage that stood up. Every silhouette reads as *junk that
learned a body plan*:

| Beast | Scale | Built from | Behavior |
|---|---|---|---|
| **Scrap-rats** | rodent | shell casings, servos | swarm; gnaw parked vehicles; flow through gaps nothing else fits; individually trivial, collectively a plague |
| **Junkhounds** | dog | drone rotors, suspension springs | fast packs; **they jump** (§8.7 HOP and CLIMB tiers — obstacles don't save you); harry and drag |
| **Weavers** | spider | rebar, cable, plating | junk-metal spiders; climb walls; string salvage-wire between structures; turn buildings into larders |
| **Ravagers** | tank | dead MBTs and IFVs | siege beasts; your own armor's silhouette, wrong; shrug off small arms |
| **The swarm** | cloud | corrupted Collective drones | captured drone swarms flying in Iron Eater livery — the Collective's doctrine turned on everyone |
| **The Leviathan** | front-sized | an entire battlefield's wrecks | the Act-III event boss: a walking foundry that eats the front's wreckage and births beasts as it moves. Killing one is a joint operation and a Journal chapter |

**Where they come from is the loop:** Iron Eaters assemble from **wreck
fields**. Every burned-out tank a battle leaves behind (§8.5 scars) is raw
material — a front that hosted heavy armor combat *breeds* them. Fight a
mechanized war today, face what it fed tomorrow.

### 20.2 Durability doctrine — you have to KEEP shooting

Iron Eaters don't have health bars so much as **stages**. Sustained fire
sheds them apart:

1. **Plated** — scrap armor sloughs off under fire, piece by visible piece
   (the damage is *readable*: they molt).
2. **Exposed** — the glowing nanite frame shows; damage now counts double,
   but the beast gets *faster and angrier*.
3. **Collapse** — it comes apart into inert junk… which a living Eater can
   later re-eat unless burned.

Small arms alone means a LONG fight — the soldiers have to keep shooting,
together. **Fire, EMP, and demolition skip stages** (flame fuses the frame,
EMP staggers the swarm-logic, a demo charge is a stage in a box). The
Engineer's kit and the flamethrower become front-line answers, and the
machine army learns what infantry always knew: volume of fire is a virtue.

*(Engine honesty: staged shedding is the vehicle subsystem-damage model
reskinned; conversion reuses existing vehicle meshes + a rust material; the
counters all already exist. The bestiary is mostly models + AI, not systems.)*

### 20.3 Corrosion & conversion — your machines betray you

Any machine an Eater closes with starts a **rust meter**. Unchecked: subsystems
fail one by one (the model exists), then the vehicle **converts** — same
silhouette, grey-pitted, hunting its old crew. A Mechanic Kit scrubs early
rust; fire sterilizes; abandoning the vehicle and killing it yourself is the
last honest option. **The more you mechanize, the more you feed them.**

### 20.4 Playable monsters — the other side of the fun

When the escalation acts (§20.5) put monsters on a front, **players can BE
them**. The design law of monster play: **short, punchy, disposable lives —
menace without biography.** Monsters never touch the dossier's power (§11.3);
they're a costume the war lends you, and the fun is the *verbs*.

**The Infected (playable Outbreak):** not shambling zombies — the infected
run. Every debuff they inflict **telegraphs itself on the victim's screen**
(you always know WHY you're missing):

| Infected | The verbs |
|---|---|
| **Runner** | sprint; **pounce** that clears HOP obstacles and pins a soldier for a beat — the pack's opener |
| **Spitter** | lobbed acid glob: pool denial + on hit, **corrosion DoT that sways your aim and softly blurs the screen edges** — the blur IS the telegraph; also strips vehicle plating |
| **Brute** | a charging shove (the knockback pipeline, reversed) that scatters a firing line and cracks cover to rubble |
| **Bomber** | the volunteer bomb: sprint, hiss, detonate — trade your life for their formation |
| **Stalker** | short phase-cloak and a backstab pin; the reason the K9's bark (§5.3) and the 360 helmet (§19.2) earn their keep |

*(All five already exist as AI kinds — playable versions are a control
mapping and one active ability each, not new creatures.)*

**Playable Iron Eaters (directional — control model to be figured):**
Junkhound pack-play (you are the alpha, the pack follows), the Scrap-rat
swarm as ONE controllable tide, the Ravager as a siege role. The open
question is feel: monsters must be *fun to pilot for 90 seconds*, not a
second career.

**Versus — the mode (decided).** Monsters enter through a **dedicated versus
mode**: humans defend an objective, a monster TEAM of players hunts them —
the full L4D-versus shape, not a death-swap gimmick. Eyes open about the
cost: versus is a real mode with real balance work (monster team sizes,
respawn cadence, objective tuning) and its own population needs — which the
bot doctrine (§12) answers on both sides: **bots can play monsters too**, so
the mode works at any human count. It ships with Act II (§20.5), because the
Infected roster is five control mappings on creatures that already exist.

**The melee feel pass (prerequisite):** close combat today is a range check.
For infected play (and against it) melee needs **commitment** — a lunge with
a windup, a visible hit arc, a beat of recovery. Zombies got us to "close";
playable monsters need "close" to feel like teeth.

### 20.5 The escalation ladder — the season in three acts

The season (§13) tells its story in acts, and the campaign paces them:

- **Act I — The War.** Human vs human. Doctrine, skill, territory. Clean.
- **Act II — The Outbreak.** The plague flares on contaminated fronts
  (§8.3); quarantine ops open; the flags fight side by side for the first
  time.
- **Act III — The Iron Eaters.** When the war is at its most mechanized —
  prototypes fielded, fronts littered with wrecks — the technology wakes up
  hungry. Machine-heavy fronts breed beasts; the Leviathan walks.
- **The finale:** the factions choose, front by front — keep killing each
  other, or hold the joint line. Either way the season's Armistice (§13.C)
  writes what they chose into every dossier.

*(What paces the acts — automated director, officer votes, or the operator's
hand — is deliberately **not specified yet**; the acts themselves are canon.)*

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
- ✅ **The Goliath Assault Walker shipped** (§8.1): strider legs (crosses the
  cover that stops wheels and tracks), Seismic Stomp on the knockback
  pipeline, GAU-9 anti-infantry cannon, biped model with driven walk cycle,
  one per team on every battlefield. Balance is relational and test-enforced
  (hp between APC and tank, slowest armed hull, best heavy pivot). Live-
  verified striding a cover line and stomping in the shipped bundle.
- ⚠️ **Decide:** terrain surface layer (§8.6) and the jump vocabulary (§8.7)
  ship with the §8.4 map pass — same grid work, do them together.
- ⚠️ **Decide:** §19 vision cones are the same work item as §11.4
  interest-managed snapshots — one vision function, two consumers. Sequence
  them as one. **Decided since:** v1 is the *light* cone (enemy-draw only, no
  wall-shadow pass); ghost linger base ~1.5s, gear-gated, hard cap 3s.
- ✅ **Committed: the Iron Eaters (§20)** — junk-metal bestiary (rat → hound →
  weaver → ravager → Leviathan), staged shed-to-kill durability, wreck-field
  breeding, rust/conversion, playable monsters (Infected roster with
  telegraphed debuffs; Iron Eater control model open), and the season's
  three-act escalation (§20.5). The melee feel pass is the prerequisite for
  monster play.
- ✅ **Committed: the Paintball Yard** (§3.3) — Brawl-Stars-scale arcade
  arenas on the jump grammar, splat-out paintball markers, local Wall board.
  Motor Trials proposed but **blocked on a vehicle-handling feel pass**.
  **Scheduling per the 7A scope freeze:** both sit explicitly *after* the
  next three slices — committed as design, not as near-term production.
- 📄 **Map strategy split out** to `docs/MAP-STRATEGY.md` — arena pockets,
  dynamic neighborhoods (generalize the safehouse house generator), the ten
  fronts, and the inside-a-house-means-unseen concealment rule.
- ⛔ **Explicitly NOT in this document (user's call): the Director.** The
  pacing/orchestration system is deferred — §20.5 names the acts but not
  their conductor. Revisit later.
- ✅ **Four decisions landed (post-pitch Q&A):** skill rust = **biography,
  never decay** (§17.A — rusty tag + knocking-the-rust-off arc, zero stat
  loss); vehicle upgrades = **operational requisition** (§3.1 hardpoints,
  Materiel-funded, history gates access, never raw stats); the **War Room
  ships scoped** (§11.5 — observe/administrate/nudge; the pacing panel slot
  stays empty); playable monsters enter via a **dedicated versus mode**
  (§20.4 — bots fill both sides).
- ✅ **Decided (1B):** faction names locked to the code's shipped names — the
  **Titan Coalition** (amber) vs **The Collective** (cyan). Zero rename work:
  nothing ever shipped under another name.
- ✅ **Decided:** roofs + firing slits (§8.4) — cutaway roofs (visual-only
  phase 1) + `T_SLIT` tile; build before authoring any of the ten fronts.
- ✅ **The Scar exists** (§8.5) — the painted theater map with all ten fronts
  and the campaign-effect legend; becomes the front-selection screen with
  live marker overlays. Awaiting the hi-res export.
- ✅ **Decided (33C/35B):** map scale is population-scaled per family
  (~300–360u for 12v12 fronts, pockets smaller, vehicle corridors larger),
  and it ships inside ONE integrated map-foundation pass with roofs/slits,
  the surface layer, and jump obstacles (§8.4).
- ✅ **Decided (32B):** match population target is **12v12** (bots fill,
  rebalance on join/leave), co-op 4–6. Sizes the maps (33C).
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

---

### Implementation status — the 7A freeze, SHIPPED

The frozen scope of the next three slices is implemented and live:

- ✅ **Slice 1 — the Dossier** (`249a637`): record.ts pipeline (IndexedDB
  dossier v1, 30s checkpoints, idempotent finalize), medals v1 (8), journal
  v1, the 14-grade rank ladder, the 6B menu tab shell (Deploy | Barracks |
  Map), the Barracks screen, and the post-match career pane.
- ✅ **Slice 1.5 — the Scar live** (`1f34b24`): ten fronts on existing
  recipes, banded weighted control (22B), scars as real match modifiers
  (fire fields, rubble stamps), the Morning Dispatch, the honest simulated
  time-skip (27B), and the theater map as the deploy screen.
- ✅ **Slice 1.6 — the Proving Grounds** (`57d2fd9`): the range mode, dummy
  targets that stay down, the clocked infantry course, practice/official
  split with the explicit 18B confirm, permanent quals, the local Wall.
- ✅ **Bot parity phase 1** (`488e2a9`, 49A): bots fire MANPADS, work the
  breacher's depth, and fly recon drones. 12v12 fill + join/leave rebalance
  (32B) local and server. Spawn protection + enemy-aware spawn picks (55B).
- ✅ **Trust prerequisite** (`14a97e6`, 68A): per-client interest-managed
  snapshots — cloak/burrow/mines are true on the wire, flag carriers public.
- ✅ **Accessibility table stakes** (`14a97e6`, §18): Settings (master
  volume, reduced motion, persisted) and the always-on second channel —
  hostiles are triangles/rings by SHAPE on minimap and field blips.

236 tests green across 19 suites. Still open from the freeze: keybind
remap (§18), revive/drag bot parity (rides §4.3), music beds (assets).

## Appendix B — Decision register

The locked product decisions, in one place. Reopening any of these requires a
better argument than the one that closed it. Numerical tuning (exact seconds,
damage, radii, percentages) is deliberately absent — numbers are decided on
the range and in playtests, not in this document.

### The 15-decision baseline (adopted)

| # | Decision | Locked choice |
|---|---|---|
| 1B | Faction names | **Titan Coalition** (amber) vs **The Collective** (cyan) — the code's shipped names; the directive aligned to the game (§1) |
| 2B | Faction asymmetry | Early access + signature assets + operational options differ; counters shared; tech crosses over. No hard-split rosters (§1) |
| 4A | What is a tour | One tour = one campaign season — enlistment, history, defection, rewards share one clock (§1/§13) |
| 6B | Menu placement | Tab shell + Map/Barracks slots ship alongside Slice 1; polish in Slice 1.5 (§9) |
| 7A | Scope freeze | Next three slices: Dossier, Scar, Proving Grounds, menu shell, bot parity, accessibility, trust prerequisites — **nothing else** (§9) |
| 10B | Rank vs command | Rank = eligibility; command needs a qualification + clean conduct history (§7) |
| 18B | The Wall attempt | Unlimited practice; the official run is explicitly confirmed; grade + percentile recorded; tutorial never locks a score (§3.2/§14) |
| 22B | Front control | −100..+100 with controlled/contested/enemy bands; mode- and importance-weighted (§8.5) |
| 27B | Offline overnight | Capped deterministic time-skip on launch, outcomes labeled *simulated* (§12.D) |
| 32B | Match population | 12v12 competitive (bots fill + rebalance), 4–6 co-op (§12.A) |
| 33C | Map scale | Population-scaled families: ~300–360u standard fronts, smaller pockets, larger vehicle corridors (§8.4) |
| 35B | Map foundation | Roofs/slits + scale + surface layer + jump obstacles = ONE integrated pass before any front is authored (§8.4) |
| 49A | Bot parity order | Now: MANPADS/breacher/drones → with §4.3: revive & drag → then remaining abilities (§12.B) |
| 55B | Spawn protection | Until first hostile action, capped ~5s, plus enemy-aware spawn selection (§16) |
| 68A | Snapshot culling | Interest-managed snapshots ship **before any internet hosting**, sharing the §19 perception function (§11.4) |

### Previously settled (do not reopen)

Local-first now, server sync later · two-faction enlistment · personal vs
operational gear · no permanent raw-stat vehicle upgrades (hardpoints are
requisitioned, §3.1) · prototypes are operational issue · buy-once, never
sell skill/history/power · roofs + slits before more named maps · light-cone
vision v1 (no shadow-casting) · ghost linger gear-gated, 3s cap · dossier
persists, war resets · skill rust is biography, never decay · War Room =
observe/administer/nudge (pacing panel slot empty) · Outbreak canon, classic
zombies off-canon toggle · Iron Eaters + three acts committed · playable
monsters via dedicated Versus · monsters get no dossier power · `wss://`
everywhere · one process = one war until Stage 3 · bootcamp skip = Draftee
rank (biography, no power) · the Director is deliberately absent from this
document.

### Deliberately deferred

Iron Eater control models and Versus tuning (§20.4) · the Leviathan's
mechanics · the Director conversation · Stage-3 economy pricing · everything
numerical.
