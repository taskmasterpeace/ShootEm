# THE OUTBREAK SPEC — zombies as a third faction, ammunition types, melee combat & combat UI

> **Provenance:** Robert's design spec, delivered 2026-07-20 (source: `DSOA_Zombie_Outbreak_Ammo_Melee_Combat_Spec.txt`; the DSOA working title is noted on the decision desk in `docs/STATUS.md`). Verbatim below — table formatting flattened by the export, content intact. **This document's §22.1 Locked Decisions are LAW** and supersede earlier drafts where they conflict (notably: melee verbs are STRIKE / GUARD / GRAPPLE, refining `plans/2026-07-20-sight-and-steel.md` Part B's punch/block/grab naming — same triangle, locked words). Build status lives in `docs/STATUS.md` §17; the queue in `docs/MASTER-BACKLOG.md`.

DIVIDED STATES OF AMERICA
ZOMBIE OUTBREAK, AMMUNITION,
MELEE COMBAT & COMBAT UI
Detailed Design and Implementation Specification

Core Design Promise
Every casualty can change the battle. Every ammunition choice solves a different battlefield problem. Every close-range encounter is a contest of timing, position, stamina, and control.
Version 1.0  |  July 2026


Document Purpose
This specification defines the zombie outbreak system, emergent infected variants, infection and corpse lifecycle, ammunition types, melee counter system, rear-grab struggle, combat UI requirements, networking authority, implementation phases, and tuning requirements.
The infected are not designed as a disconnected arcade mode. They are a systemic third faction capable of emerging inside an active war and transforming the objectives, economy, geography, and emotional tone of the battlefield.
Design Pillars
1. Emergent, not authored: the battlefield creates most infected variants from actual casualties.
2. Science-grounded, tonally ominous: infection values and counterplay are measurable, while the strain's origin may remain unexplained.
3. Readable cause and effect: players should understand why an outbreak began, why a mutation occurred, and how to contain it.
4. Tactical ammunition: ammunition types solve different problems instead of forming a simple damage ladder.
5. Close-range clarity: every melee state must be readable through animation, sound, icons, and local HUD feedback.
6. Server-authoritative online play: infection, damage, fire, grapples, and timing results must be authoritative and latency-tolerant.
Table of Contents
* 1. System Overview
* 2. Faction and War Integration
* 3. Outbreak Pressure and Escalation
* 4. Infection Data Model
* 5. Clone Infection and Reinforcement Economy
* 6. Corpse Lifecycle and Reanimation
* 7. Emergent Infected Variants
* 8. Environmental Mutation Sources
* 9. Infected AI and Horde Performance
* 10. Interior and Flashlight Gameplay
* 11. Ammunition System
* 12. Melee Counter Triangle
* 13. Charged Melee Attacks
* 14. Rear Grabs and Control States
* 15. Control Struggle Minigame
* 16. Combat UI and Terminology
* 17. Networking and Anti-Cheat
* 18. Accessibility and Input Support
* 19. Analytics and Tuning
* 20. Implementation Roadmap
* 21. Acceptance Criteria
* 22. Remaining Decisions


1. System Overview
The zombie system is a simulation-driven outbreak layer that can exist in dedicated survival scenarios or emerge inside the persistent war. Human casualties create physical bodies. Bodies may retain equipment, accumulate infection, become environmental hazards, and eventually reanimate. Because the horde grows from battlefield losses, combat performance and cleanup discipline directly affect future threat density.
Primary Rule
The horde should grow primarily from casualties and contamination, not from invisible spawn points.
1.1 Intended Player Experience
* A slow horde creates steady attrition and area pressure.
* Rare sprinters create sudden terror spikes.
* Every unprocessed corpse creates a future risk.
* Fire and specialized ammunition create meaningful denial choices.
* An outbreak can force opposing human armies to change priorities without making them allies.
* The map tells the story: abandoned equipment, burned body piles, quarantine lines, contaminated buildings, and lost sectors remain as evidence of what happened.
1.2 System Boundaries
The base zombie implementation should initially exclude the existing Brute, Bomber, and Stalker specials. The first production target is a highly scalable base Shambler plus a rare Sprinter. Heavy, lean, and armored infected are later emergent body-derived variants. Iron Eaters remain a separate machine roster and cannot be infected unless a future lore decision explicitly introduces biological-machine contamination.
2. Faction and War Integration
ForcePrimary BehaviorRelationship to InfectionHuman Faction ACaptures objectives, fields players and AI soldiers, manages supply and reinforcement.Can suffer exposure, lose soldiers to conversion, contain or exploit outbreaks.Human Faction BOpposes Faction A under the normal war rules.Faces the same infection rules and may be forced into emergency containment.The InfectedAttacks living targets, expands through casualties, contamination, and failed containment.Third faction with no diplomacy, morale, or traditional logistics.Iron EatersSeparate machine force with its own objectives and roster.Immune to normal biological infection; facilities may act as mutagen sources.
2.1 War-Front Outbreaks
An outbreak may occur during any war phase when conditions justify it. War phase can modify risk, but phase number should not be the sole trigger. A predictable rule such as 'zombies always arrive at Level 3' would destroy uncertainty and encourage clock-based play instead of battlefield awareness.
Recommended model: war phases establish maximum severity and unlock possible triggers. Actual outbreak activation depends on corpse density, contamination, facility state, viral load, sabotage, research outcomes, and campaign events.
2.2 Dynamic Objective Conversion
Normal ObjectiveOutbreak ConversionCapture command postSeal or purge the command post before infected spread through its interior.Hold bridgePrevent infected crossing while preserving the bridge for later use.Escort convoyEscort medical containment or evacuation vehicles through a compromised route.Destroy facilityChoose whether to destroy, secure, or reactivate containment systems.Recover intelligenceRetrieve strain data or patient samples before the site is overrun.Defend clone bayProtect living reinforcements and prevent unfinished bodies from becoming infected.
3. Outbreak Pressure and Escalation
Each active sector maintains an authoritative Outbreak Pressure value. The server calculates pressure from local and campaign-wide conditions. Players receive readable warnings, but they do not necessarily see the exact numeric value unless they possess specialized reconnaissance or medical capabilities.
3.1 Pressure Inputs
Pressure IncreasePressure ReductionUnburned human and clone corpsesBurning or chemically neutralizing corpsesZombie bites, scratches, and blood exposureMedical treatment and quarantineContaminated facilities and mutation fieldsSecuring or destroying contamination sourcesHigh casualty density in a small areaCorpse removal and battlefield sanitationRuptured reactors, clone vats, or research systemsRepairing containment infrastructureDeliberate biological sabotageCompleting containment or decontamination objectivesAbandoned infected bodies and nestsDestroying nests and processing remainsLate-war campaign modifiersFaction research and specialized equipment
3.2 Outbreak Levels
LevelNameGameplay StateRequired UI0ClearNo confirmed infection. Standard corpse rules apply.No persistent biohazard alert.1Suspected ExposureContamination or viral load detected; isolated bodies may be incubating.Yellow alert, exposure markers, optional corpse timers.2Confirmed OutbreakMultiple infected or confirmed conversion; containment objectives appear.Orange alert, infected estimate, contamination overlay.3Containment FailureInfected operate as a major third force; rare mutations become more likely.Red alert, quarantine border, emergency objective conversion.4Sector LostInfected dominate the sector; normal military goals may be suspended.Black/red map state, spread forecast, purge or evacuation missions.
3.3 Escalation Rules
* Escalation requires sustained pressure or a catastrophic trigger.
* Level changes should have a short confirmation window to prevent rapid oscillation.
* Pressure can remain high after visible enemies are killed if corpses, contamination, or nests remain.
* A lost sector increases pressure in neighboring sectors through refugee movement, infected migration, and disrupted supply routes.
* Emergency containment success may reduce the outbreak level without fully clearing the sector.
4. Infection Data Model
FieldPurposestrainIdIdentifies the strain family and mutation rule set.viralLoadCurrent internal infection amount.infectionRateRate at which Viral Load grows after exposure.incubationDurationExpected time before critical symptoms or conversion.mutationThresholdThreshold used to determine enhanced phenotype eligibility.infectionResistanceCharacter-specific reduction to exposure and growth.timeSinceExposureAuthoritative elapsed exposure time.treatmentProgressMedical reduction, suppression, or stabilization progress.conversionProbabilityProbability of conversion under current conditions.corpseReanimationTimerTime remaining after death before reanimation.exposureSourceBite, scratch, gas, fluid, environment, ammunition, or scripted source.
4.1 Damage and Infection Are Separate
A zombie attack can deal low physical damage while delivering high Viral Load. Armor may stop tissue damage but still become contaminated. Conversely, a lethal gunshot does not automatically create an infected corpse unless the victim was exposed or died inside an active contamination field.
This separation creates meaningful medical and tactical states: wounded but clean, healthy but exposed, dying and infected, dead but safe, and dead with imminent reanimation.
4.2 Exposure Sources
* Bites and deep scratches
* Blood spray and close-range tissue impact
* Contaminated gas, mist, water, or surfaces
* Handling infected corpses without protection
* Environmental mutation zones
* Bio-weapon or bio-neutralizing ammunition failures
* Clone-bay contamination
* Scripted campaign incidents
5. Clone Infection and Reinforcement Economy
Clone soldiers can become infected. This connects the reinforcement economy to outbreak risk and prevents printed soldiers from functioning as consequence-free disposable units.
Clone AttributeGameplay EffectGenetic stabilityReduces mutation probability and conversion volatility.Immune resistanceSlows Viral Load growth and extends treatment time.Mutation volatilityIncreases chance of enhanced infected phenotype.Neural degradationMay alter post-conversion aggression or sensory behavior.Reanimation delayControls how long the corpse remains recoverable before turning.Production qualityHigher quality costs more but improves survivability and containment reliability.
Strategic Tension
Cheap emergency clones can hold a collapsing line, but every dead unstable clone may become a stronger infected combatant.
5.1 Clone Facility Failure
A destroyed or contaminated clone facility may contain unfinished bodies, biological material, medical waste, and active growth systems. If containment fails, the facility becomes both a spawn source and a mutation field. Securing the facility should be more valuable than simply destroying it, but destruction may be the only safe option during a severe outbreak.
6. Corpse Lifecycle and Reanimation
StateBehaviorPlayer CounterplayFresh CorpseEquipment recoverable; body movable and scannable.Loot, relocate, inspect, burn, or chemically process.Incubating CorpseSubtle twitching, audio cues, rising Viral Load.Neutralize before critical stage; trained roles see timer.Critical ReanimationStrong movement and final warning window.Immediate burn, destruction, or emergency finisher.ReanimatedBody becomes infected unit derived from original attributes.Engage using appropriate ammo and melee rules.NeutralizedCannot reanimate.No further action required unless contamination remains.
6.1 Reanimation Inputs
* Viral Load at death
* Cause of death
* Time since death
* Nearby contamination modifier
* Corpse temperature and environmental conditions
* Clone instability
* Body type and armor state
* Fire, chemical, or explosive damage received after death
6.2 Neutralization Methods
* Sustained fire damage
* Dedicated chemical neutralization
* Complete body destruction
* Decapitation or catastrophic brain destruction if supported by the damage model
* Specialized containment processing
Incendiary ammunition should contribute to a corpse Neutralization Meter rather than guaranteeing instant denial. Corpse mass, armor coverage, wetness, fuel, caliber, and burn duration determine the required exposure.
7. Emergent Infected Variants
Most variants are generated from the victim's pre-death body, role, equipment, injuries, and contamination environment. The system should avoid arbitrary roster selection when a causal transformation can be derived.
VariantTypical OriginCombat RoleBase ShamblerOrdinary soldier, civilian, or stable clone.Slow mass pressure; simple pursuit and grab behavior.SprinterScout, infiltrator, athletic body, or mutation-field conversion.Rare terror spike; rapid line-of-sight or light activation.Heavy InfectedHeavy soldier, large body type, powered-armor operator.Slow corridor blocker with high stagger resistance.Lean InfectedScout, infiltrator, light infantry.Faster navigation, lower health, improved obstacle handling.Armored InfectedVictim reanimates in intact armor.Resists standard rounds; vulnerable to joints, AP, fire, or finishers.
7.1 Sprinter Frequency
Recommended normal baseline: 0.5% to 2% of infected. Local mutation fields and unstable clone batches may increase this rate. Sprinters should be frightening because they are uncommon, not because every encounter contains several.
A sprinter may appear dormant, crouched, or slow-moving until activated by direct light, line-of-sight, loud noise, proximity, or nearby combat. This allows the flashlight to become a risk-bearing detection tool.
8. Environmental Mutation Sources
SourcePossible ModifiersChemical spillHigher movement speed, aggression, or Viral Load per hit.Ruptured clone vatShorter reanimation delay and higher phenotype instability.Damaged Iron Eater foundryHeat resistance, armor retention, or toxic contamination.Destroyed reactorIncreased durability, sensory range, or mutation probability.Bio-research laboratoryStrain-specific mutations and rare advanced behaviors.Contaminated sewerPersistent migration routes and concealed spread.Experimental ammunition depotFire-reactive or chemical-resistant infected.
8.1 Readability Requirements
Mutations must be spatially and visually explainable. Players should see vapor, leaking fluid, warning lights, scan readings, altered corpse textures, map overlays, or facility damage that explains why local infected are stronger or faster. The player should rarely feel that a mutation was random or hidden.
9. Infected AI and Horde Performance
9.1 Base Shambler Brain
* Acquire nearest reachable living target using a low-frequency query.
* Follow shared flow fields or navigation corridors where possible.
* Use simple local avoidance and crowd separation.
* Attack, grab, or push when within range.
* Do not use cover, weapons, squad tactics, or complex utility scoring.
9.2 Performance Strategy
* Use distance-based AI update tiers.
* Use shared target information for nearby horde groups.
* Cull animation and sensory updates outside relevance range.
* Pool bodies, effects, decals, and infected actors.
* Use corridor and doorway capacity rules to limit active contact points.
* Use simplified collision for distant or densely packed infected.
* Limit expensive path recalculation after every obstruction.
* Separate visual crowd density from fully simulated combatants where required.
Traditional shamblers are themselves a performance optimization. Their simple behavior should allow greater density than the current special roster.
10. Interior and Flashlight Gameplay
10.1 Interior Layout Requirements
* Narrow corridors and door chokepoints
* Intersections and blind corners
* Stairwells and vertical transitions
* Utility tunnels and maintenance shafts
* Lockable or breakable doors
* Emergency lighting and power controls
* Flammable rooms and hazardous storage
* Alternative exits and partial shortcuts
10.2 Flashlight Rules
The flashlight is not cosmetic. It defines the player's vision cone in darkness and interacts with infected activation. The beam can identify bodies, reveal contamination, awaken dormant sprinters, expose the player's location, and help teammates coordinate.
Flashlight EventPossible ConsequenceBeam crosses dormant sprinterActivation meter begins or immediate sprint triggers.Beam remains on targetImproved identification but greater activation certainty.Rapid sweep through corridorMore area revealed but multiple threats may awaken.Light switched offReduced detection but lower navigation and target certainty.Tracer or muzzle flash nearbyMay reveal shooter and trigger light-sensitive infected.
11. Ammunition System
Ammunition types are tactical tools, not linear upgrades. The player selects ammunition based on expected armor, outbreak conditions, fire risk, stealth, range, collateral damage, and resource cost.

> **BUILD STATUS (2026-07-20):** the launch trio is LIVE. **B** cycles the loaded round Standard Ball → AP → Incendiary (`Soldier.ammoType`; deterministic via `PlayerCmd.cycleAmmo`, so replays reproduce it). AP threads issued plate for −25% soft damage on ballistic weapons (bullet/shell — energy weapons unaffected; iron molt & LSW identity armor stay exempt). Incendiary burns the body it lands on — denying reanimation like a blast — and hits any ZedKind for ×1.6 at a −15% cost against the living. Gods skip the cycle (a firebrand doesn't fumble ammo boxes). The magazine counter reads `30 / 90 · AP` / `· INC`. `tests/ammo.test.ts` (5). REMAINING: separate reserve pools per type (today AP/INC share the ballistic reserve), Tracer/Subsonic/Expanding/Bio-Neutralizing, mixed magazines, penetration/noise/fire-hazard HUD readouts, and the full §11.4 material-fire interaction (waits on W7.3).
11.1 Core Ammunition Types
TypeBest AgainstAdvantagesTradeoffsStandard BallGeneral unarmored targetsLow cost, reliable, widely available.Limited armor penetration; no corpse denial.Armor-Piercing (AP)Armor, vehicles, Iron Eaters, armored infectedHigh penetration; reduced armor mitigation; light-cover penetration.Higher cost; overpenetration risk; weaker soft-target expansion.Incendiary (INC)Corpses, infected groups, flammable coverApplies burn; advances neutralization; area denial.Lower penetration; collateral fire; destroys recoverable gear; smoke.Tracer (TRC)Team fire correction and darknessVisible trajectory; target marking; squad coordination.Reveals shooter; attracts infected; may activate sprinters.Subsonic (SUB)Stealth and suppressed interiorsReduced noise and muzzle signature.Lower velocity, penetration, and effective range.Expanding (EXP)Unarmored living targetsHigh stopping power and soft-target trauma.Poor against armor, machines, and infected denial.Bio-Neutralizing (BNR)Containment inside flammable spacesSlows or prevents reanimation without fire.Expensive, limited, low direct damage.
11.2 Weapon HUD Requirements
* Current ammunition abbreviation and icon
* Rounds loaded and reserve rounds by type
* Magazine identity and composition
* Reload progress and next available magazine
* Penetration rating
* Noise rating
* Fire hazard warning
* Corpse-neutralization capability
* Next round type for mixed magazines
11.3 Magazine Rules
The initial implementation should support separate magazines by ammunition type. Mixed magazines may be added later as an advanced loadout feature. Mixed magazines create interesting planning opportunities but also increase cognitive load, networking state, UI burden, and reload complexity.
Recommended Launch Scope
Ship Standard Ball, Armor-Piercing, and Incendiary first. Add Tracer and Subsonic after the core combat loop is stable.
11.4 Fire and Material Interaction
Incendiary ammunition should interact with the existing material system. Fuel, cloth, dry vegetation, chemicals, wood, insulation, and contaminated organic matter may ignite. Concrete, wet surfaces, metal, and treated materials should resist or limit spread. Fire creates light, smoke, area denial, equipment destruction, and corpse neutralization.
12. Melee Counter Triangle
Counter Relationship
Guard beats Strike. Strike beats Grapple. Grapple beats Guard.

> **BUILD STATUS (2026-07-20):** two of the three vertices are LIVE. **STRIKE** — every soldier without a returning axe carries a universal Combat Knife on **F** (34 dmg, 2.2u reach), driving the existing windup→90°-arc→stagger swing and sharing the fire clock. **GUARD** — held **V** raises a brace over a 150° frontal cone: a facing STRIKE lands only 12% and PARRIES (staggers + shoves the attacker — *Guard beats Strike*), while a flank or rear blow slips past (which is exactly what GRAPPLE will exploit). Guard costs ~10 stamina/s, pauses regen, slows to 0.45×, and lowers your own weapons. `melee_block` event; `tests/melee.test.ts` (9 new). REMAINING: **GRAPPLE** (§14, the third vertex — rear-grab entry, *Grapple beats Guard*), the **Control Struggle** / **Bite Struggle** minigames (§15), and **Impact Charge** (§13, hold-to-charge the STRIKE). Simultaneous-action priority (§12.1) resolves today by swing timing; explicit startup/active-frame arbitration is a later pass.
ActionUI NameBeatsLoses ToRoleDirect melee attackSTRIKEGRAPPLEGUARDInterrupts grab attempts and deals damage.Defensive block or parryGUARDSTRIKEGRAPPLEAbsorbs or redirects direct attacks.Grab or clinch attemptGRAPPLEGUARDSTRIKEBypasses passive defense and enters control.
12.1 Resolution Rules
* The server evaluates action startup, active frames, contact angle, stamina, and counter relationship.
* A correct counter grants a clear animation and audio response.
* A mistimed counter may still reduce damage without winning the exchange.
* Simultaneous actions use priority, reach, startup time, and latency-compensated timestamps.
* The UI triangle is a teaching aid; the physical combat state remains authoritative.
13. Charged Melee Attacks
Holding the Strike input initiates a Power Strike. The player-facing meter is named Impact Charge.
StageGameplay MeaningUI StateWind-UpAttack is being prepared and may be interrupted.Charge ring begins filling.ChargedHeavy strike threshold reached.Meter enters emphasized zone.MaximumHighest intended impact.Perfect-release cue.OverchargedHolding too long drains stamina or destabilizes timing.Meter pulses or enters warning zone.ReleasedAttack commits.Meter collapses into directional strike cue.RecoveryPlayer cannot immediately repeat or defend fully.Recovery arc or cooldown indicator.
Recommended tuning bands: 0-30% quick strike, 31-70% heavy strike, 71-100% maximum impact. Holding beyond maximum should introduce stamina drain, accuracy loss, forced release, or a larger punish window.
The meter must appear close to the character, reticle, or target lock. Requiring the player to look at a distant HUD corner would undermine timing and spatial awareness.
14. Rear Grabs and Control States
A successful grab from behind enters a Rear Control state. The attacker gains positional advantage but must still resolve a short competitive struggle before executing a high-value action.
14.1 Entry Conditions
* Attacker is within valid grab range.
* Attacker is inside the target's rear grab cone.
* Target is not invulnerable or in an uninterruptible state.
* Size, strength, posture, and equipment permit the grab.
* The grab attempt is not interrupted by a Strike.
14.2 Available Outcomes
* Restrain
* Drag
* Shove
* Disarm
* Choke
* Human shield
* Takedown
* Throw
* Defender escape
* Defender reversal
Against infected, rear grabs should be restricted or carry meaningful infection risk. A survivor may shove or control a shambler briefly, but prolonged contact should increase Viral Load or create a bite-struggle state.
15. Control Struggle Minigame
The rear-grab contest is named Control Struggle. It uses a shared horizontal Contest Track, an attacker-controlled moving Control Zone, and a defender-controlled Break Needle.
ElementOwnerFunctionContest TrackSharedDefines the total movement range.Control ZoneAttackerMoving valid region the defender must hit.Break NeedleDefenderTiming marker the defender attempts to place inside the zone.Round TimerSharedDefault three-second contest window.Success PipsSharedDisplays attacker and defender round wins.Momentum IndicatorSharedShows direction and acceleration without revealing exact inputs.
15.1 Recommended Resolution
Use a best-of-three structure. Each timing check lasts up to three seconds. The first participant to win two checks resolves the grapple. This is easier to understand, balance, spectate, and tune than one opaque continuous meter.
7. The attacker moves the Control Zone left or right inside the Contest Track.
8. The defender moves or times the Break Needle.
9. The defender confirms while the needle overlaps the Control Zone.
10. A successful overlap awards a Break Hit.
11. A miss, timeout, or invalid confirmation awards Lock Progress to the attacker.
12. The first side to two wins resolves the grapple.
15.2 Attacker Controls
* Move the Control Zone left or right.
* Reverse direction with a short momentum delay.
* Spend stamina to accelerate or tighten control.
* Use a limited fake reversal.
* Commit to drag, choke, disarm, takedown, or throw.
15.3 Defender Controls
* Move or time the Break Needle.
* Confirm the needle position.
* Spend stamina to slow or stabilize movement.
* Attempt a high-risk reversal.
* Use an equipped escape tool where permitted.
15.4 Stat Modifiers
Stat or ConditionEffectAttacker strengthWidens Control Zone or increases defender stamina drain.Attacker grapple skillImproves acceleration control and reduces reversal vulnerability.Defender agilitySlows needle speed or increases confirmation forgiveness.Defender escape skillImproves reversal opportunity and recovery.Surprise advantageReduces defender's first timing window.Heavy armorReduces escape responsiveness but may resist damage outcomes.Arm injuryWeakens zone control or confirmation stability.Low staminaShrinks valid regions and limits advanced actions.
15.5 Zombie Variation: Bite Struggle
Zombie grabs use a simplified survival version called Bite Struggle. The player must land the Break Needle inside a moving Safe Zone before the bite timer completes. Failure applies bite damage, Viral Load, knockdown, or a drag-toward-horde effect.
Sprinters should create faster timing with weaker hold strength. Heavy infected should move more slowly but create greater stamina drain and a narrower escape window.
16. Combat UI and Terminology
16.1 Standard Action Labels
SystemApproved Player-Facing TermsMelee actionsSTRIKE, GUARD, GRAPPLECharge systemIMPACT CHARGE, WIND-UP, CHARGED, MAXIMUM, OVERCHARGED, RECOVERYGrab systemGRAB ATTEMPT, CONTACT, REAR CONTROL, CONTROL STRUGGLE, LOCK SECURED, ESCAPE, REVERSAL, TAKEDOWNInfectionCLEAN, EXPOSED, INFECTED, CRITICAL, TURNING, REANIMATED, NEUTRALIZEDGrapple feedbackBREAK HIT, LOCK PROGRESS, CONTROL CONFIRMED, ESCAPEZombie grabBITE STRUGGLE
16.2 Required HUD Modules
HUD ModuleRequired InformationWeapon HUDWeapon, magazine, reserve, ammo type, fire mode, reload, penetration, noise, fire hazard.Melee HUDCurrent state, Impact Charge, Guard stamina, Grapple availability, recovery, rear-grab opportunity.Infection HUDViral Load, exposure state, treatment, incubation estimate, contamination warning.Corpse HUDClean, exposed, incubating, burning, neutralized, or reanimation imminent.Grapple HUDContest Track, Control Zone, Break Needle, timer, pips, stamina, current action.World MapOutbreak level, quarantine line, contamination source, infected estimate, spread direction.
16.3 Icon Language
* Strike: fist, blade, or impact burst
* Guard: shield or angled brace
* Grapple: gripping hand
* Impact Charge: filling impact ring
* Rear Control: hand behind a silhouette
* Escape: broken chain
* Infection: biohazard
* Incendiary: flame
* Armor-Piercing: pointed round through a plate
* Corpse warning: body silhouette with timer
* Reanimation imminent: rising silhouette
16.4 Local Feedback Priority
Critical combat feedback must remain near the action. Charge meters, grab prompts, counter cues, and reanimation warnings should appear near the character, target, corpse, or reticle. The global HUD should summarize state, not force the player to look away from the battlefield.
17. Networking and Anti-Cheat
17.1 Server Authority
* Infection and Viral Load
* Corpse timers and reanimation
* Ammunition type and magazine state
* Damage, armor penetration, and fire spread
* Grapple entry, Control Zone movement, Break Needle confirmation, and result
* Stamina cost and recovery
* Outbreak Pressure and sector level
17.2 Grapple Latency Handling
* Server-authoritative struggle timeline
* Client-side visual prediction
* Timestamped input reconciliation
* Small timing forgiveness window
* Ping-aware validation caps
* Deterministic movement seeds where useful
* No visibly impossible late reversals
The minigame must not become an advantage for high-ping players or an unwinnable experience for moderate-latency players. The server should validate input time, not merely packet arrival time, within strict anti-cheat limits.
18. Accessibility and Input Support
* Color-blind-safe icons and patterns for outbreak levels and ammo types
* Optional larger timing zones for accessibility modes
* Adjustable struggle speed without changing competitive rules where matchmaking requires parity
* Audio cue alternatives for charge, reanimation, and successful timing
* Controller, keyboard/mouse, and touch-compatible interaction models
* Reduced-flash option for incendiary, muzzle flash, and infection effects
* Hold/toggle alternatives for Guard, flashlight, and charge controls
* High-contrast local combat indicators
For competitive modes, accessibility settings should alter presentation and input ergonomics without secretly changing server outcome rules unless the playlist explicitly supports assisted timing.
19. Analytics and Tuning
MetricWhy It MattersDeaths converted to infectedMeasures whether the corpse loop is meaningful or overwhelming.Average reanimation timeSupports pacing and denial tuning.Corpses neutralized by methodShows whether fire dominates every alternative.Ammo usage by enemy typeTests whether ammunition choices are understandable.Sprinter frequency and kill rateProtects rarity and terror without unfairness.Outbreak escalation causesIdentifies opaque or overly common triggers.Grapple win rate by side and pingDetects latency, balance, or control problems.Average Control Struggle durationTests whether the minigame interrupts combat too long.Interior deaths by visibility stateMeasures flashlight and darkness fairness.Clone quality versus infection outcomesBalances reinforcement cost against outbreak risk.
20. Implementation Roadmap
Phase 1 � Foundation
* Base Shambler
* Rare Sprinter
* Infection component and Viral Load
* Corpse reanimation timer
* Corpse burning and neutralization
* Basic Outbreak Pressure
* Standard Ball, AP, and Incendiary ammunition
* Strike, Guard, Grapple counter triangle
* Core combat state labels and icons
Phase 2 � Battlefield Integration
* Third-faction outbreaks during war fronts
* Outbreak Levels 1-4
* Clone infection
* Sector contamination
* Dynamic containment objectives
* Corpse-density effects
* Interior flashlight activation
* Rear Control and Control Struggle
Phase 3 � Mutation and Strategy
* Environmental mutation fields
* Heavy, lean, and armored emergent infected
* Faction research and quarantine progression
* Sector loss and recovery
* Biological sabotage
* Tracer, Subsonic, Expanding, and Bio-Neutralizing ammunition
* Mixed magazines
* Advanced medical countermeasures
Phase 4 � Polish and Scale
* Animation and audio telegraphs
* Controller and touch refinement
* Latency compensation hardening
* Spectator readability
* Combat tutorials
* Replay and kill-feed language
* Analytics dashboards
* Large-horde performance testing
21. Acceptance Criteria
13. A human or clone corpse can remain lootable, enter incubation, display readable warnings, and reanimate on an authoritative timer.
14. Burning or chemically neutralizing a corpse prevents reanimation and visibly changes its state.
15. An outbreak can emerge during an active human-versus-human war front and cause infected to attack both sides.
16. Outbreak escalation is condition-driven and visible through level-specific UI.
17. Base Shamblers can be simulated at materially greater density than existing complex specials.
18. Sprinters remain rare and can be activated by light, line-of-sight, noise, or proximity.
19. Standard Ball, AP, and Incendiary produce clearly different outcomes against armor, machines, living targets, infected, and corpses.
20. The melee counter triangle resolves consistently and is taught through the UI.
21. Impact Charge communicates wind-up, effective charge, maximum release, overcharge, and recovery near the action.
22. A valid rear grab enters Rear Control and launches a synchronized Control Struggle.
23. The attacker controls the Control Zone; the defender controls the Break Needle; the server validates all outcomes.
24. Moderate latency does not make Control Struggle consistently unwinnable for either side.
25. All critical states have distinct text, icon, animation, and sound feedback.
22. Locked Decisions and Remaining Questions
22.1 Locked Decisions
26. Clones can become infected.
27. The infected can emerge as a third faction during active war fronts.
28. Outbreaks are condition-driven rather than guaranteed at a fixed time.
29. Shamblers form the majority of the horde.
30. Sprinters remain rare.
31. Most infected variants emerge from casualties and environmental mutation.
32. Fire is the primary corpse-denial mechanic.
33. Armor-Piercing and Incendiary are core launch ammunition types.
34. Melee uses STRIKE, GUARD, and GRAPPLE.
35. Rear grabs enter a competitive Control Struggle.
36. The Control Struggle uses an attacker-controlled region and defender-controlled timing needle.
37. The recommended resolution is best-of-three timing checks.
22.2 Remaining Questions
38. Should a defender's perfect Break Hit cause only escape, or allow an immediate reversal and temporary control of the attacker?
39. Can players deliberately move infected corpses into enemy territory, and what anti-griefing or war-crime consequences should apply?
40. How much of the exact incubation timer is visible to ordinary soldiers versus medical, science, or reconnaissance roles?
41. Does incendiary ammunition ignite every corpse consistently, or should armor and environmental wetness create significant reliability differences?
42. Can contaminated sectors persist across campaign sessions, and how long should a lost sector remain infected without player intervention?
43. Which rear-grab outcomes are allowed in competitive PvP at launch: drag, disarm, human shield, choke, takedown, and throw?
Final Product Direction
This system should make players fear unprocessed casualties, respect ammunition planning, and treat close-range combat as a readable contest rather than an animation lottery.
DIVIDED STATES OF AMERICA � INTERNAL GAME DESIGN SPECIFICATION
Page 1

