# MILITARY MISSIONS — the OPERATIONS track

Shipped 2026-07-21. The loud, combined-arms center of the war—air, land, and sea. The counterpart to `docs/SCIENCE-MISSIONS.md`.

## Production status — SHIPPED

The complete playable loop now ships: the Scar exposes one deterministic Operation window per front and pass; the planning board generates the briefing, validates a named seasonal motor-pool manifest, prices treasury and ammunition, and stages or cancels it without duplication. Deploy builds real skirmish, standard, or large ground, runs ordered objectives and complications in the simulation, permanently settles hull losses and the strategic effect, then reports the result through the HUD, After-Action Report, dossier, and enemy-perspective Courier.

The principal implementation is `src/sim/operations.ts`, `operation-map.ts`, `operation-pads.ts`, `operation-runtime.ts`, `world.ts`, `src/client/campaign.ts`, `operations-ui.ts`, `hud.ts`, `dossier.ts`, `newspaper.ts`, and the Scar wiring in `src/main.ts`. The production proof is the full suite plus the dedicated `operations`, `operation-map`, `operation-runtime`, `operation-settlement`, `operation-effects`, `operations-ui`, `operations-integration`, `operation-hud`, and `operation-record` tests.

The vehicle-theater expansion also ships six map-owned battlefields—City
600×600u, Desert 900×900u, Countryside 900×900u, Mountain 600×900u,
Coastal 900×600u, and Ocean 900×900u—plus the shared **Ground / Building /
Sky / Clouds** elevation law. The seasonal motor pool can commit named Shrike
attack helicopters, Condor transport helicopters, Pike gunboats, and
Barracuda attack submarines. Existing seasons migrate the newly commissioned
hulls into their pool without resetting losses or records.

## Direct-launch field exercises — SHIPPED

The Deploy screen now includes one **MILITARY MISSIONS** card that opens six
curated, immediately playable exercises. These are not mockups or separate
minigames: every card launches the production Operation map generator,
ordered phase runtime, bot war, radar/sonar, four elevation bands, and issued
vehicle package.

| Card | Theater | Size | Mission | Issued package |
|---|---|---:|---|---|
| Urban Assault | Iron Meridian / City | 600×600u | take the rail hub, hold the junction | Mastodon tank, Shrike attack helicopter |
| Air Superiority | Sirocco Reach / Desert | 900×900u | clear the sky, seize the airfield | Falcon interceptor, Mastodon tank |
| Convoy Interdiction | Green March / Countryside | 900×900u | break the escort, secure the road | Vulture strike jet, Bastion APC |
| Pass Assault | Crown Divide / Mountain | 600×900u | insert beyond the ridge, take the pass | Condor transport helicopter, Jackal buggy |
| Beachhead | Breaker Coast / Coastal | 900×600u | land the force, take the shore strongpoint | Pike gunboat, Mastodon tank, Barracuda submarine |
| Naval Hunt | Pelagic Expanse / Ocean | 900×900u | hunt the screen, hold the channel | Barracuda submarine, Pike gunboat, Falcon interceptor |

Exercises always launch locally, even when a multiplayer URL is configured.
They have zero campaign cost and do not cancel a staged Operation, consume an
Operation window, change treasury/front control, lose seasonal hulls, file a
Courier edition, or alter the player's persistent service record. Their AAR
is session-only and names the exercise, theater, and completed phases.

Release verification on 2026-07-21 in `codex/military-operations`:
`npx tsc --noEmit`, all 164 Vitest files / 1,963 tests, `npm run lint`,
and `npm run build` passed. `npm run test:vehicle-scenarios` passed all
330 deterministic vehicle fights. Live browser smokes verified all six Map
Maker sources under the six-law audit, the complete 20-hull model stage and
pad palette, Shrike/Condor/Barracuda procedural models, the 900×600 Coastal
Operation briefing, and the migrated named airframes/submarines in its real
manifest planner with a clean console. The direct launcher was also deployed
through every one of its six cards in the live browser; each reached its
mission-specific Operation HUD and ordered objectives.

## What an Operation is

Where a science Expedition is a tight heist run with a squad of clones, a military Operation is the big war: combined arms over a real map. The resource spent is **materiel**—the tanks, planes, boats, and ammunition the Operation Officer buys into the match manifest.

The difficulty dial is **commitment**. A light manifest is a knife-edge raid where every hull matters; a heavy manifest is an overwhelming push that can afford losses. Committed and destroyed vehicles come off the national motor pool for the current season. Death remains a cheap reprint; a lost vehicle is materiel gone, and a lost objective is ground the enemy keeps. A clean sheet pays a bonus and raises Fiscal Efficiency.

Each front grants a limited number of Operation windows per pass. Major Operations also cost treasury to launch, so the Secretary or Theater Commander chooses which battles to fund. Picking the right battle is the strategy layer.

## The three domains and their verbs

The signature military mission is combined arms: the navy lands the armor, the armor takes the airfield, and the airfield launches the jets. Pure single-domain Operations exist, but the generator favors combinations.

### Land — armor, infantry, artillery

| Verb | Job | Feel |
|---|---|---|
| **Spearhead** | Punch through a fortified line and pour through | Momentum; stall and the force is pinned and ground down |
| **Hold the Line** | Survive the counterattack until dug in | An inverted siege; the waves come to you |
| **Siege** | Reduce bunkers, walls, or an emplacement gun | Patience and heavy metal; charges and tank cannon answer it |
| **Interdict** | Drop a bridge, burn a depot, or cut a rail line | Denial at scale; starve the next battle |
| **Encircle** | Close two prongs around a pocket and destroy it | Timing across a map; both jaws must close |
| **Counterbattery** | Find and destroy enemy guns while under fire | A hunt conducted inside a bombardment |

### Air — jets, bombers, gunships, AA

| Verb | Job | Feel |
|---|---|---|
| **Air Superiority** | Clear the sector sky | Falcon against Falcon across altitude bands |
| **Close Air Support** | Thread Vulture strikes past friendly ground forces | Trust and timing; a bad run kills friendly armor |
| **Strategic Strike** | Level one hardened target in one clean Anvil run | One pass, escort required, no second chance |
| **Intercept** | Stop inbound bombers or gunships | Defense on a clock with the SAM net on your side |
| **Airborne Insertion** | Drop behind the line and hold the landing zone | Cut off and outnumbered while waiting for link-up |

### Sea — gunboats, amphibious forces, coastal defenses

| Verb | Job | Feel |
|---|---|---|
| **Amphibious Assault** | Cross water under fire and seize the beach | The beachhead; water and crossings matter at scale |
| **Blockade** | Choke a port until the timer expires or the fleet breaks | Denial by presence; a grinding stranglehold |
| **Convoy** | Move materiel across a contested channel | Greed versus ambush; every landed hull is banked |
| **Coastal Raid** | Hit a shore battery, dock, or sub pen and escape | The Pike gunboat's hit-and-run purpose |

## Combined-arms signatures

- **The Beachhead — Sea enables Land.** Pike gunboats ferry armor across; armor takes the shore strongpoint; air cover protects the transports.
- **The Hammer — Air enables Land.** Win Air Superiority before the Spearhead or enemy aircraft strafe the push off the map.
- **The Choke — Sea and Air.** Hold a blockade on the water while the enemy attempts to break it from the sky.
- **The Anvil Drop — Air and Land.** Airborne forces hold behind the line while a frontal Spearhead closes the pincer.

## Sites

Military ground reuses systems that already ship:

- front line—the Scar's contested band
- fortified strongpoint—walls and an emplacement gun
- bridge or river crossing—the water system
- supply depot or fuel farm—burnable once fire lands
- rail hub
- enemy airfield—hangars and pads from the attacker's side
- coastal battery
- port
- carrier anchorage
- mountain pass—one road with lethal high ground on both sides

## Generator

An Operation is **Verb × Domain(s) × Site × Stake × Complication**. Every result must be legible in one sentence:

> Spearhead the mountain pass at Kestrel—win Air Superiority first, and a god holds the ridge.

> Amphibious Assault the port at Vega under storm—their reserves are one front away.

> Blockade the carrier anchorage at Tessaly—they will try to break it from the air.

Complications:

- air cover denied—no Close Air Support this run
- a god holds the objective
- night or storm—weather taxes vision
- reserves one front away—a reinforcement clock
- scorched earth—the enemy destroys the prize when defeat is imminent
- no collateral—a town makes stray fire cost treasury and press standing
- one airframe—lose the bomber and the strike is scrubbed

## Effects

Every reward moves a number the player already watches.

### Territory

Take a sector; push the front line; open a permanent supply route; deny an enemy route; seize high ground; hold a chokepoint; split a front; flip a contested city; establish a forward base; claim midfield next battle.

### Facilities

Capture an airfield, port, fuel farm, rail hub, forge, clone hub, radar station, SAM site, repair depot, or intact bridge. Captured facilities persist through the season and reset at armistice.

### Materiel and money

War-chest payout; steal the enemy's opening purse; cheaper family-wide requisition; one off-map barrage per battle; pre-placed mines or wire; rearm pads; captured vehicle variant; ground enemy air; sink a convoy; double the clean-sheet Fiscal Efficiency payout.

### Air and sea control

Sector air superiority; channel sea control; permanent CAS allotment; escort wing; deny enemy CAS; carrier slot; coastal-battery cover; early warning; base no-fly zone; submarine picket.

Carrier rewards and the submarine-picket reward remain strategic modifiers.
The Barracuda itself is now a real playable and committable hull; no carrier
hull is fabricated before carrier gameplay ships.

### Doctrine and intel

Unlock an Armor, Air, Naval, or Special Operations doctrine node; permanent vehicle retrofit; reveal the enemy manifest; Nemesis file; opening fog lift; live radio intercept; sight of enemy books; veteran recovery; commendation; Courier headline.

## Escalation

- **Pass 1:** single-domain teaching Operations with small manifests and forgiving losses.
- **Pass 2:** combined arms; facilities compound, and reinforcement clocks or scorched earth punish waste.
- **Pass 3:** symmetric war; territory, denial, barrages, no-fly zones, and intelligence decide the theater.

The Courier reports the aftermath from the enemy perspective.

## Individual hooks

- **Vehicle ace — shipped:** named hulls accrue sorties and kills by vehicle type. Their loss matters and the dossier records their career.
- **Crew history — future:** persistent individual crews and veteran-recovery missions remain outside this slice; the named hull record is the shipped persistence boundary.
- **Command certification — shipped:** completed objectives and victories advance the dossier's Operation certification.
- **PRINT 7749 — future:** the unnamed-soldier identity beat remains part of the wider soldier/meta track, not the Operation launch gate.

## Locked implementation calls

- Destroyed vehicles leave the national motor pool for the remainder of the season; armistice replenishes it.
- Captured facilities persist for the season and reset at armistice.
- CAS fields the dedicated Shrike attack helicopter; Airborne Insertion fields the nine-seat Condor transport helicopter and its grounded mobile spawn.
- Sea gameplay fields the Pike gunboat and Barracuda attack submarine. Carriers remain sites and strategic effects until a carrier hull ships.

## Shipped play space

- Land: tank, APC, buggy, bike, mech, tunneler, emplacement.
- Air: Vulture strike jet, Falcon interceptor, Anvil bomber, Lance AA track, Shrike attack helicopter, Condor transport helicopter, and the legacy flyer/gunship.
- Sea: Pike gunboat and Barracuda attack submarine, with deep routes, sonar concealment, depth control, and torpedoes.
- Support: transport and ambulance.
- Four named elevation levels—Ground, Building, Sky, Clouds—and automatic AA.
- Six vehicle-scale biome theaters from 600×600u to 900×900u, with mission-owned rectangular geometry and domain routes.
- AI telemetry and reproducible evidence across 330 vehicle battle scenarios (`npm run test:vehicle-scenarios`).
- Water and crossing conversion.
- Treasury, persistent named motor pool, pass-limited Operation windows, and armistice reset.
- Operation Officer planning modal with commitment, domain, support, cost, and validation readouts.
- Deterministic skirmish and authored-front mission grounds across all ten sites and three scales.
- Live objective runtime, seven complications, fifty concrete effects, settlement, HUD/AAR, dossier, and Courier reporting.

Operations capture sites; Expeditions unlock tools; Private Matters recover people and property; the newspaper records the consequences.
