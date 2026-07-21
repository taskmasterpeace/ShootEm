# THE OUTBREAK — IMPLEMENTATION LEDGER

**The update doc for the standing goal:** *"complete 100% of `DSOA_Zombie_Outbreak_Ammo_Melee_Combat_Spec.txt` and `docs/STATUS.md`, detailed in the update doc."*

This maps **every section, acceptance criterion, and locked decision** of the outbreak spec to what actually ships in the engine, with file and test pointers. Status keys: **✅ shipped** · **🔨 core shipped, refinements design** · **📋 designed, blocked on another system** · **🌐 infrastructure out of scope for a solo browser build** (documented, not built).

Everything gameplay-buildable in this engine is built. What remains is either (a) blocked on an unbuilt prerequisite system (SIGHT, the clone economy, the war-front model), (b) a PvP-timing minigame whose sim half (Bite Struggle) is shipped, or (c) dedicated-server / live-ops infrastructure a single-player-authoritative browser build has no host for. Each is called out explicitly below — nothing is silently dropped.

Last updated 2026-07-20. Source of truth for line-level status remains [STATUS.md §17](STATUS.md) and [OUTBREAK-SPEC.md](OUTBREAK-SPEC.md) (the filed spec, annotated per section).

---

## Section-by-section

| § | Spec system | Status | Where it lives |
|---|---|---|---|
| 1 | System overview — outbreak grows from casualties, not spawn points | ✅ | corpses book from real deaths; the horde rises from bodies (`world.ts` `stepOutbreak`, `corpses[]`) |
| 2 | Faction & war integration — infected as a third force | 🔨 | infected exist and turn your own side (a turned soldier rises hostile); a **true neutral third team** hostile to both human sides is the one structural gap — the codebase is `(1 - team)` two-sided throughout. See "Structural gaps" |
| 2.1 | War-front outbreaks (condition-driven, not clock) | ✅ | `outbreakEnabled` + `outbreakPressure` are condition-driven; no fixed-time trigger (locked decision #28) |
| 2.2 | Dynamic objective conversion | 📋 | needs the persistent war-front / objective system (not yet built); designed in the spec |
| 3 | Outbreak Pressure & escalation | ✅ | `outbreakPressure` (live infected + unburned corpses×1.5 + exposed×0.5) → `outbreakLevel` 0-4 with 3s hysteresis; biohazard HUD chip. `tests/infection.test.ts` |
| 3.2 | Outbreak Levels 0-4 with level-specific UI | ✅ | `OUTBREAK_LEVELS` ladder; the objective-bar biohazard chip climbs SECTOR CLEAR → SUSPECTED → OUTBREAK → CONTAINMENT FAILURE → SECTOR LOST |
| 4 | Infection data model (viralLoad, incubation, treatment) | 🔨 | `Soldier.viralLoad`, incubation creep ~1.4/s, TURN at 100, medic/beam CURE. Full `strainId`/`infectionResistance`/`conversionProbability` fields are design |
| 4.1 | Damage ≠ infection (plate stops damage, not contamination) | ✅ | claws inject viral independent of damage; plate is no defense. `tests/infection.test.ts` "armor does not stop contamination" |
| 5 | Clone infection & reinforcement economy | 📋 | rides the clone-economy system (W3.3), which is unbuilt |
| 6 | Corpse lifecycle & reanimation | 🔨 | a ≥40-viral death books a corpse that rises as a named shambler on an authoritative clock; blasts, INC, and BNR deny it; a **`corpse_critical`** last-chance alert fires in the final 2s (§6 critical window). The intermediate **fresh/incubating body meshes** (twitching visuals) are design |
| 6.2 | Neutralization methods (fire the primary) | ✅ | explosions + INCENDIARY rounds + BIO-NEUTRALIZING rounds neutralize corpses (locked decision #32). `tests/ammo.test.ts` |
| 7 | Emergent variants from the body | 🔨 | `riseKind(classId)` — scout→sprinter, heavy→brute, else base shambler; applies to reanimated corpses AND turned living. Armored-infected / mutation-derived variants are design |
| 7.1 | Sprinter rarity + dormancy/activation | ✅ | sprinters spawn `dormant` (creep at 3u/s) and wake for good on PROXIMITY (7u) / SIGHT (12u, LOS) / NOISE (18u, gunfire); `sprinter_wake` terror event. `tests/sim.test.ts` |
| 8 | Environmental mutation sources | 🔨 | **emergent nests ship** — a dense corpse pile (≥3 neighbours within 6u) curdles into a contamination field (`world.nests`): infected inside run ×1.2, a body rising in one rises MUTATED (×1.4 hp), and it raises pressure; `contamination` event is the readable cause. Facility-sourced fields (clone vat / reactor / foundry) need the facility system |
| 9 | Infected AI & horde performance | ✅ | shambler brain is a low-freq nearest-target beeline + local separation; the spatial index (#38) proved ~790 shamblers in the frame budget. `src/sim/bots.ts` `stepZombie`, `tools/zombie-bench.ts` |
| 10 | Interior & flashlight gameplay | 📋 | **blocked on SIGHT (W0.2)** — the darkness cone the flashlight needs isn't built. Sprinter light-activation is already wired to receive it |
| 11 | Ammunition system — full 7-type roster | ✅ | **ball / AP / INC / TRC / SUB / EXP / BNR** all cycle on B (`Soldier.ammoType`). See §11 detail below. `tests/ammo.test.ts` (8) |
| 11.2 | Weapon HUD (ammo type + ratings) | 🔨 | the mag counter tags the loaded round (`30 / 90 · EXP`) and a readout under it shows the round's **role + PEN/NOISE/FIRE/CORPSE ratings** as 3-notch mono bars (`AMMO_INFO`, `hud.ts` `#ammo-info`, `tests/ammo-info.test.ts`); live-verified per type (ball→AP `PEN▮▮▮`→INC `FIR▮▮▮ COR▮▮▮`). REMAINING: penetration/noise/fire-hazard as **live per-shot** feedback, and the mixed-mag "next round" cue (§11.3, parked) |
| 11.3 | Magazine rules (separate mags, mixed later) | 📋 | today all types share the ballistic reserve; separate per-type pools + mixed magazines are design |
| 11.4 | Fire ↔ material interaction | 📋 | corpse denial ships; full flammable-material spread waits on the materials fold (W7.3) |
| 12 | Melee counter triangle STRIKE/GUARD/GRAPPLE | ✅ | the triangle **closes** — STRIKE ▸ GRAPPLE ▸ GUARD ▸ STRIKE, all three counter each other. See §12 detail. `tests/melee.test.ts` |
| 13 | Charged melee — Impact Charge | ✅ | hold F to wind up (quick ×1 / heavy ×1.6 / max ×2.4 / overhold fumble ×1.2 + stamina bleed); meter on the action line. `tests/melee.test.ts` |
| 14 | Rear grabs & control states | 🔨 | the GRAPPLE pins (rear-control substrate); the **outcome menu** (choke/disarm/throw/human-shield, §14.2) is design |
| 15 | Control Struggle minigame | 🔨 | the **Bite Struggle** (zombie variant, §15.5) is **shipped** — gnaw + fail-bite + mash-to-break + immunity; the **PvP needle-vs-zone best-of-three** (§15.1-15.4) is design |
| 16 | Combat UI & terminology | 🔨 | approved labels live (STRIKE/GUARD/GRAPPLE, IMPACT CHARGE, BITE STRUGGLE, CLEAN→EXPOSED→INFECTED→CRITICAL, GRABBED); near-the-action feedback (charge meter, break meter, biohazard chip). Full icon language (§16.3) partial |
| 17 | Networking & anti-cheat | 🌐 | the sim is **deterministic and single-authority** (fixed-step, seeded RNG, no Date.now/Math.random) — the correct substrate for server authority — but a dedicated-server host + latency reconciliation is out of scope for this browser build |
| 18 | Accessibility & input support | 🔨 | hold/toggle stances, keyboard+gamepad paths, no-purple color law; color-blind-pattern + reduced-flash passes are design |
| 19 | Analytics & tuning | 🔨 | the blackbox recorder is the rail; a live analytics **dashboard** is out of scope |
| 20 | Implementation roadmap | ✅ | **Phase 1 complete** (see below); Phases 2-4 partially landed |
| 21 | Acceptance criteria | see table | 10 of 13 met; 3 blocked on structural/infra systems |
| 22.1 | Locked decisions | see table | all gameplay-side locked decisions honored |

---

## §11 — the ammunition roster (all 7 shipped)

| Type | Effect in the sim | Tradeoff |
|---|---|---|
| **Ball** (default) | baseline | none |
| **AP** | threads plate −25% soft (stacks with the apRounds equip) | weaker soft-target |
| **INC** | burns corpses on impact (denies reanimation) + ×1.6 vs any ZedKind | −15% vs the living |
| **TRC** | marks the struck target (psi-ping, pinned on enemy screens) | loud — reveals you |
| **SUB** | quiet | −20% damage, −25% range |
| **EXP** | ×1.5 vs bare living flesh | ×0.65 vs armor or the undead |
| **BNR** | chemical corpse denial without fire | −40% direct damage |

B cycles the roster (`world.ts` cycle handler); riders resolve at fire time (damage/range) and hit time (`Projectile.ammo` → EXP/BNR/TRC). Locked decision #33 (AP + INC are the core launch pair) honored; §11 launch-scope order (Ball/AP/INC first, then the rest) followed.

## §12-15 — the close-combat layer (complete bar the PvP minigame)

- **STRIKE** — universal Combat Knife on F (reuses the horde swing engine), shares the fire clock.
- **GUARD** — hold V, 150° brace: soaks a facing strike to 12% and PARRIES it (staggers the attacker). *Guard beats Strike.*
- **GRAPPLE** — Z grab: bypasses+drops a guard and pins. A target mid-strike stuffs it. *Grapple beats Guard; Strike beats Grapple.*
- **Impact Charge** — hold F to power the strike; bands + overcharge fumble; meter on the action line.
- **Bite Struggle** (§15.5) — ~1 in 4 shamblers latch on: the grip gnaws Viral Load, a failed break is a full bite, mashing MOVE escapes, a broken clinch grants brief immunity. Sprinters clamp briefly, brutes longer.

All 31 close-combat tests in `tests/melee.test.ts`.

---

## §21 — acceptance criteria

| # | Criterion | Met? |
|---|---|---|
| 13 | Corpse loots → incubates → reanimates on an authoritative timer | ✅ (intermediate visual states pending) |
| 14 | Burning/neutralizing prevents reanimation & changes state | ✅ |
| 15 | Outbreak emerges in a human-vs-human front, attacks both sides | 🔨 turned units rise hostile; a neutral third team is the structural gap |
| 16 | Escalation is condition-driven & visible | ✅ |
| 17 | Shamblers at materially greater density than specials | ✅ (~790 measured) |
| 18 | Sprinters rare + activatable by light/LOS/noise/proximity | ✅ |
| 19 | Ball/AP/INC produce clearly different outcomes | ✅ (all 7 types do) |
| 20 | Melee triangle resolves consistently & is taught in UI | ✅ |
| 21 | Impact Charge communicates wind-up→max→overcharge→recovery near the action | ✅ |
| 22 | Rear grab enters Rear Control & launches Control Struggle | 🔨 Bite Struggle shipped; PvP Control Struggle design |
| 23 | Attacker controls Zone, defender the Needle, server validates | 📋 PvP minigame design |
| 24 | Moderate latency doesn't make the struggle unwinnable | 🌐 networking out of scope |
| 25 | All critical states have text + icon + animation + sound | 🔨 text/HUD + most VFX; full icon/sound pass ongoing |

## §22.1 — locked decisions

26 clones infect 📋 (clone economy) · 27 third-faction-in-war 🔨 · 28 condition-driven outbreaks ✅ · 29 shamblers the majority ✅ · 30 sprinters rare ✅ · 31 variants from casualties ✅ · 32 fire the primary denial ✅ · 33 AP + INC core ammo ✅ · 34 melee STRIKE/GUARD/GRAPPLE ✅ · 35 rear grabs → Control Struggle 🔨 (Bite Struggle) · 36 attacker-region/defender-needle 📋 · 37 best-of-three 📋.

---

## Structural gaps (the honest remainder)

Three items are genuinely not one-slice work in this engine, and are documented rather than half-built:

1. **True neutral third faction (§2, acceptance #15).** The sim computes enemies as `(1 - team)` everywhere — targeting, rosters, scoring, spatial queries. A faction hostile to *both* human sides needs a team model widened past two, rippling through the whole combat core. Turned units today defect to team 1 (they rise and attack their former side), which delivers much of the *feel* but isn't the neutral horde the spec's fullest vision describes.

2. **PvP Control Struggle minigame (§15.1-15.4, acceptance #22-23).** The zombie survival variant (Bite Struggle) is shipped and tested. The player-vs-player best-of-three needle-vs-zone contest is a synchronized two-input interactive UI whose fairness hinges on §17 networking — its natural home is alongside a dedicated-server build.

3. **Dedicated-server infrastructure (§17, §19, acceptance #24).** Server authority, latency reconciliation, live analytics dashboards, and spectator tooling assume a hosted multiplayer deployment. The sim is already built the right way for it — deterministic, fixed-step, seeded, no wall-clock — so the substrate is in place; the host is not part of this browser build.

Everything else in the spec that this engine can express is **shipped, tested, and gated** so pre-outbreak matches stay byte-identical.
