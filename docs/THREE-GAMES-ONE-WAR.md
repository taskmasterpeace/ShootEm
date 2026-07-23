# THREE GAMES, ONE WAR — identity, stats, and the GONET
### Robert's 2026-07-22 creative session, captured as law-in-draft. Supersedes META-LAYER §A's 10-proficiency sketch. Decisions marked LOCKED are his words; the rest is the working shape.

> **DOC KIND: INTENT (the canon laws) — this is what we are AIMING at.**
> The LOCKED lines are design law and should be honoured. But this document
> describes the *destination*, not the build: several systems it states as fact
> are declared-only in code (notably 5 of the 8 master stats, stat decay, and
> the visible-AI-commander law). **For what exists, read `FEATURES.md` →
> `STATISTICS.md` / `MASTER-SYSTEMS.md`.** Aim with this; ship against those.

## The thesis
Not one game — **three games sharing one persistent world**, and *everything exists to support the war*:
1. **MILITARY** — combined arms, fronts, logistics. The expensive missions. Officers spend credits.
2. **SCIENCE** — small teams, discovery not killing. Science makes the military stronger.
3. **PERSONAL** — your soldier's career, locker, apartment, dog, reputation, legacy. Consequences, not quests (your engraved rifle gets stolen → the recovery mission is *personal*).

Design law (LOCKED): **combat is always the center; every other system changes the next battle.** People should feel they're helping the war effort even when not shooting.

## Victory condition (LOCKED)
The global war is won when **every front is taken — all three battlegrounds on each front**. (The 3×3 board is the per-front face of this.)

## The 8 master stats (replaces the 10-proficiency list)
POWER · AGILITY · WEAPON HANDLING · PILOTING · ENGINEERING · LEADERSHIP · SCIENCE · CHARISMA
- Standing law kept: **never an aim-roll.** Weapon Handling is ADS/recoil-recovery/swap/reload/hipfire/suppression-resistance — a veteran and rookie FEEL different with the same rifle; the bullet goes where you point it.
- **Decay is LOCKED: use it or lose it** ("things should go down when you don't use it — that'll make it balance out"). This *is* the "Rust as biography" ruling, now confirmed — decay is the generalist-cap; no artificial stat limit needed.
- Secondary skills (rifle/SMG/tank-gunner/medic/dog-handler/…) level independently **through use**.
- Hidden story-stats (fear, morale, squad trust, pilot hours, friendly-fire incidents, cities liberated…) exist to generate stories, not power.

## Certifications, not unlocks (LOCKED direction)
- Classes become **licenses**: Medic CERTIFIED · Pilot NOT CERTIFIED · Explosives Level II · Nuclear DENIED.
- Earned at **schools** (flight school, tank school, medical school) at training bases — training bases stay valuable forever. Tutorials are academies; you graduate.
- Vehicle licenses gate hulls (basic driver → heavy truck → APC → tank → rotary → fixed wing → bomber…). "You don't fly the bomber because you're level 20 — you passed flight school."
- A new soldier starts **empty** and learns — even the pistol. Range drills score **closest-to-center at increasing distances** (the target-ring qualification, feeds certs).
- **Account owns:** identity, certifications, reputation, friends, research, war history. **Each PRINT owns:** its body, combat experience, equipment, injuries, mission history.

## Prints & Personnel Intake (the front door's final form)
- The player IS the account holder; the government **issues** your first print ("PRINT AUTHORIZATION… watch it being manufactured" — a world moment, not a char creator). The word is **Print** (LOCKED vocabulary).
- Intake phases: civilian identity (name/country/city/accent — feeds NPC dialogue, local news, hometown notices) → appearance profile (later: natural-language print description) → psychological profile (recommends first assignment — the yard read grows into this) → print authorization → she wakes up: "Well… guess I'm back."
- Multiple prints per account is the long-game (and the monetization seed — people should WANT more than one; voice/background depth makes each print somebody).

## The GONET laptop (menus become the world)
Boot into the **operations network**, not a menu: world status, briefings, messages, friends ("someone from Kingston is deployed"), certifications, print hangar, war map, marketplace, news, promotion board. The laptop is home; "logging in" replaces "main menu". (Ties: accounts/auth #83.)

## Media = the world's voice
Generated **newspaper** (exists — grows into the daily), **radio** with faction culture + commercials + PSAs, **billboards** (NOW HIRING · LOST DOG UNIT 224 · BUY EAGLE CERAMIC ARMOR), **news TV** reporting what players actually did, AI **music** about yesterday's battles. All of it feeds off the blackbox/ledger truth.

## Economy & command
- **Countries fund the war** — national identities (manpower vs tech vs logistics) make enlistment a real social choice ("we're all signing with Brazil").
- Chain: President → **Secretary of War** (shapes the economy: funding priorities, factories, doctrine) → General → Officer (picks a **Doctrine Package** — Armor Spearhead / Air Superiority / Infantry Surge / Spec Ops — then fine-tunes the manifest) → squad → soldier.
- **AI commander is visible as AI** (LOCKED): the player must KNOW command is AI-held and that they can take over. Take over alone → you hold all three battlegrounds' command; another human arrives → they take one. **Vote of confidence**: players can call someone up for (or out of) a command seat; the vote weighs their war-effort record.

## New reticle/targeting orders (concrete, from this session)
1. **Laser pass:** more transparent, dimmer by day / visible by night — it's *targeting*, not a beam show.
2. **The red dot:** a new reticle style — a small dot with a soft gradient halo that appears ON the target (enemy, surfaces); nothing drawn between muzzle and dot.
3. **The spotter window:** hover an enemy → a small magnified inset so high-velocity shots can be timed.
4. **Movement bob:** characters don't bob at all today; running must visibly bob/sway (Operation Flashpoint reference) — the visual twin of the shipped accuracy ladder.
5. Reticles/lasers may become **per-gun attachments**, some deliberately *unreliable* — rotate the options, then assign.

## Still open (the next decision batch)
Which civilian vehicles weaponize · vehicles captured/stored/named? · exact per-rank authorities · what friendships/rivalries DO mechanically · how much power is player-skill vs progression (his instinct: **responsibilities > numbers** — the strongest feeling is being trusted with the bomber, the platoon, the front) · what survives a print's death beyond the account layer · Secretary specifics (he's reading the pitches).

---

# APPENDIX — THE ROSTERS (transcribed 2026-07-23)
*These lists previously existed only in the source transcript — #94 pointed here and found nothing. Now it finds this. Robert's words, structured.*

## Secondary skills (level independently, THROUGH USE)
Rifle · SMG · LMG · Sniper · Rocket · Knife · Pistol · Tank Driver · Tank Gunner · Helicopter · Jet · Boat · Engineer · Medic · Dog Handler · Drone Pilot · Radio Operator · Commander · Navigator · Mechanic · Explosives · Scout

## Vehicle certifications (earned at training bases, never XP) — **BUILT** (src/sim/licenses.ts)
Basic Driver · Heavy Truck · APC · Tank · Hovercraft · Boat · Helicopter · Fixed Wing · Bomber · Transport · Drone Pilot · Dropship

The register is live: every hull in the fleet (military + civilian) names the licence it demands, each licence names its SCHOOL (Motor Pool · Armour School · Naval Yard · Flight School · Signals School), and the ladder is a **chain, not a level** — the bomber seat requires Fixed Wing first, the tank requires Basic Driver → Heavy Truck → APC. Holding the top paper alone clears nothing. The Codex shows LICENCE and EARNED AT on every vehicle card. Boards, bikes and scooters need no paperwork. The ACCOUNT owns licences, so they survive a print (the account/print split). What remains: the schools themselves as playable qualification courses (the Proving Grounds is the door) and the entry gate that refuses an unlicensed driver.

## Civilian vehicles ("military vehicles make war; civilian vehicles make the world feel alive")
**Ground:** Sedan · Pickup · SUV · Sports car · Taxi · School bus · Motorcycle · Scooter · ATV · Garbage truck · Tow truck · Ambulance · Fire truck · Fuel tanker · Moving truck · Food truck · Delivery van · Police cruiser · Construction loader · Forklift · Bulldozer · Cement mixer · Train · Subway · Golf cart · Hoverboard · Bicycle
**Air:** Passenger jet · Private jet · Cargo aircraft · Bush plane · Crop duster · News helicopter · Medical helicopter · Police helicopter · Sky crane · Hot air balloon · Blimp · Ultralight · Paraglider · Hang glider · Parachute · Jetpack · Wingsuit
**Water:** Fishing boat · Yacht · Speedboat · Ferry · Cargo ship · Patrol boat · Jet ski · Hovercraft · River barge · Submersible
*(Still open: which weaponize · captured/stored/named?)*

**Roster status:** all 48 civilian hulls are BUILT — defs, models and Codex entries (ground incl. train + subway on rails, air, water). Parachute · Jetpack · Wingsuit are deliberately NOT hulls: they are movement systems (the jetpack already flies as the Jump Trooper ability; the parachute is its own build, #74).

## The parachute (gameplay, not a fall mechanic)
steer · flare · collapse canopy · cut parachute · land on rooftops · land in trees · get tangled · shoot while descending · be shot while descending · deploy too low and die

## Hoverboard mastery ("Tony Hawk meets Halo")
wall ride · power slide · grind rails · drift · bunny hop · boost jump · reverse · air brake · trick off ramps

## Hidden story-stats (stories, not power)
Combat Experience · Fear · Morale · Discipline · Fame · Infamy · Loyalty · Squad Trust · Vehicle Preference · Pilot Hours · Tank Hours · Kill Distance Record · Rescue Count · Friendly Fire Incidents · Scientist Extractions · Cities Liberated · Fronts Served · Decorations · Campaign Tours

## The GONET home screen (the transcript's mock)
```
----------------------------------
GOOD EVENING MAJOR SMITH
----------------------------------
WORLD STATUS
  Front Delta            LOSING
  Science                3 Missions Available
  Military               18 Missions Available
  Personal Mail          4
  Friends Online         12
  Nearby Players         3
  Player From Virginia   ONLINE
  Your Squad             2 Waiting
  Factory                Tank Ready
  Research               New Prototype Complete
  Promotion Board        Eligible
  News                   Battle of Richmond Continues
----------------------------------
```

## The closing law (Robert's biggest-opportunity ruling)
**Don't make the RPG stats the main progression.** Knowledge, certifications, rank, relationships, and reputation ARE the progression. Stats help — but the most powerful feeling is earned responsibility: being trusted to fly the bomber, command the platoon, lead the science op, turn a front.
