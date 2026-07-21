# MILITARY MISSIONS — the OPERATIONS track

Drafted 2026-07-21. The loud, combined-arms center of the war—air, land, and sea. The counterpart to `docs/SCIENCE-MISSIONS.md`.

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

Carrier and submarine rewards are strategic modifiers in this version. They do not expose fake playable hulls before those vehicles ship.

### Doctrine and intel

Unlock an Armor, Air, Naval, or Special Operations doctrine node; permanent vehicle retrofit; reveal the enemy manifest; Nemesis file; opening fog lift; live radio intercept; sight of enemy books; veteran recovery; commendation; Courier headline.

## Escalation

- **Pass 1:** single-domain teaching Operations with small manifests and forgiving losses.
- **Pass 2:** combined arms; facilities compound, and reinforcement clocks or scorched earth punish waste.
- **Pass 3:** symmetric war; territory, denial, barrages, no-fly zones, and intelligence decide the theater.

The Courier reports the aftermath from the enemy perspective.

## Individual hooks

- **Vehicle ace:** named hulls accrue kills by vehicle type. Their loss matters and the newspaper reports their record.
- **Crew history:** a downed crew is a persistent person eligible for veteran recovery.
- **Command certification:** Operation performance earns the right to buy a later manifest.
- **PRINT 7749:** the unnamed-soldier hook carries into military dialogue until a callsign is earned.

## Locked implementation calls

- Destroyed vehicles leave the national motor pool for the remainder of the season; armistice replenishes it.
- Captured facilities persist for the season and reset at armistice.
- The shipped flyer/gunship supports CAS and Airborne Insertion. A dedicated helicopter may replace it later without changing mission verbs.
- Sea gameplay uses the shipped Pike gunboat. Submarines and carriers remain sites and strategic effects until their hulls ship.

## Shipped substrate

- Land: tank, APC, buggy, bike, mech, tunneler, emplacement.
- Air: Vulture strike jet, Falcon interceptor, Anvil bomber, Lance AA track, flyer/gunship.
- Sea: Pike gunboat.
- Support: transport and ambulance.
- Altitude bands and automatic AA.
- Water and crossing conversion.
- Materiel purse and war ledger.
- Operation Officer procurement rail.
- Deterministic skirmish and front map builders.
- Briefing-card art pipeline.

Operations capture sites; Expeditions unlock tools; Private Matters recover people and property; the newspaper records the consequences.
