# DOGS & ANIMALS — the K9, and the fact that it is the only animal in the game
### Status: **BUILT** (the dog is a first-class entity and works) with named gaps against the design. Verified against code 2026-07-23.

## 0 · FOR THE NEXT AI

**There is a real dog in the simulation.** Not scaffolding, not orders issued into the void: a K9 is a first-class `Soldier` with `kind: 'dog'` that spawns, paths, bites, takes damage, dies and redeploys. It has its own brain, its own rigged model with a four-legged trot, a HUD control panel, key and gamepad bindings, and an order state that replicates over the wire for free.

**And it is the ONLY animal in the game.** No birds, mounts, wildlife, pests or livestock exist as entities. Every other animal word in the codebase is a metaphor or a machine — see §1.6 before you go looking.

**The files that ARE the feature:**
| File | What it owns |
|---|---|
| `src/sim/k9-orders.ts` | The order layer: heel/sic/stay, handler eligibility, building snap, door + scent helpers. Pure. |
| `src/sim/bots.ts` `stepDog` (~1880) | The dog brain, dispatched from `world.ts:2378`. |
| `src/sim/world.ts` `addDog` (~1613) | Spawn, pairing, redeploy, purge exemptions. |
| `src/sim/data.ts` | `DOG_STATS`, `DOG_NAMES`, the `dog_bite` weapon. |
| `src/client/k9-controls.ts` + `hud.ts` | The handler panel and its status line. |
| `src/client/models/soldiers.ts` `buildDog` (~554) | The shepherd model. `animation.ts` (~204) has the trot. |

**The one thing to know before touching it:** the dog's whole reason to exist is **THE NOSE** — it writes every hostile within `noseRadius` into `world.pinged`, the same reveal channel spy cameras use, which perception treats as visible **even through cloak**. "With a K9 on the field, stealth has to sweat" is literally true in code. Break that and you have removed the dog's purpose.

---

## 1 · WHAT THE CODE DOES

### 1.1 The numbers (tune here)
| Stat | Value | Source |
|---|---|---|
| HP | 60 | `data.ts` `DOG_STATS` |
| Speed | 16.8 (~1.6× an infantryman — nobody outruns the dog) | `DOG_STATS` |
| Bite | `dog_bite`: 16 damage, 1.6 rof, 2.0 range, claw sound | `data.ts:96` |
| `heelDist` | 4 (how far off the handler's shoulder it settles) | `DOG_STATS` |
| `guardRadius` | 18 (measured from the **handler**, not the dog) | `DOG_STATS` |
| `noseRadius` | 10, floor-aware (×4 vertical term) | `bots.ts:1885` |
| Melee windup | 0.2 s — quick but dodgeable | `bots.ts:226` |
| Bite haul | pulls the victim ~5u toward the jaws | `world.ts:4603` |
| Scent memory | 8 s, max 24 nodes; a new node only after >0.34 s or >0.75u | `indoor-ai.ts:50` |
| Scent pull from handler | 32u (`DOG_HANDLER_PULL`) | `indoor-ai.ts:52` |
| `sic` building snap | 8u tolerance from the aimed point | `k9-orders.ts` `K9_BUILDING_SNAP` |
| Phantom counter radius | 12u | `lsw/phantom.ts:41` |
| Names | 8: Rex, Ajax, Bruno, Sable, Grit, Valkyrie, Koda, Havoc | `data.ts:849` |

### 1.2 The systems
| System | Status | What it does | Cite |
|---|---|---|---|
| Dog entity | ✅ | A full `Soldier`, `kind:'dog'`. `classId` is nominally infantry but inert — it uses its own brain and its single weapon. | `types.ts:436`, `world.ts:1613` |
| Fielding | ✅ auto / 🟡 agency | Each side **automatically** fields exactly one K9 in every mode except range, paintball and races. Paired to the local player if eligible, else the first bot. Eligibility = alive, on-team, human/bot, **infantry or engineer**. | `main.ts:1217`, `k9-orders.ts:27` |
| Packs | ⬜ **not in practice** | `addDog(allowPack=true)` bypasses the one-per-team guard, but the only caller is science and `dogTeams` computes **0 or 1** (gated `security ≥ 0.55 && prints ≥ 3`), with only 2 `dogPosts` on the map. **There is no pack anywhere in the game**, and no pack coordination AI. | `science.ts:108`, `science-map.ts:225` |
| Orders (heel/sic/stay) | ✅ | State lives **on the dog Soldier** (`k9Order`, `k9BuildingId`, `k9StayAnchor`, `k9TargetId`, `k9Door`, `k9SearchIndex`…), so it replicates for free and the HUD/renderer read it directly. Re-issuing `stay` while staying returns to heel. | `k9-orders.ts`, `types.ts:547` |
| `stepDog` brain | ✅ | Priority ladder: **nose (always)** → handler-down freeze ("ears up") → stay → sic → guard (nearest hostile within 18u of the *handler*) → indoor scent chase → heel. Horde-style pathing, so walls do not save the target. | `bots.ts:1880` |
| `sic` — building clear | ✅ | Drives into the siced building, bites hostiles inside, else runs a deterministic room/door sweep. **At a closed door it stops and BARKS** every 5 s — the dog will not open doors. Announces "BUILDING CLEAR" after 2 s quiet. | `bots.ts:1812` |
| `stay` | ✅ | Holds an anchor, bites anything in range, self-corrects if shoved (drift 0.18u). Area denial. | `bots.ts:1790` |
| **THE NOSE** | ✅ **load-bearing** | Every hostile within 10u → `world.pinged`, the same channel as cameras; perception reveals **through cloak**. Double-buffered (`pinged`/`pingedLast`) so bots read last tick's marks. | `bots.ts:1885`, `perception.ts:60` |
| Indoor scent trail | 🟡 **asymmetric** | Team-0 operators lay a decaying trail a dog can follow. **The gate is team-0-only**, so only an *enemy* dog can meaningfully track — a normal player's own dog cannot scent-hunt. Tuned for the science raid. | `indoor-ai.ts:218`, gate at `world.ts:2203` |
| Death & redeploy | ✅ | Dies like any soldier; **redeploys at the handler's side** at full HP once the handler is up. Handler leaves → the dog goes home (deleted). Exempt from corpse-purge, morale and the class-request loop. | `world.ts:1765`, `:2210`, `:2400` |
| Model & animation | ✅ | A real low-poly German Shepherd: sloped body, black saddle, dark snout, pricked ears, tail, four named leg joints, **team-coloured K9 harness**. Trot swings diagonal pairs, wags the tail (fast when working). Floating sic/stay marker over your own dog; name hangs low (y=1.55 vs 2.55). | `models/soldiers.ts:554`, `animation.ts:204`, `renderer.ts:2966` |
| Handler panel | ✅ | HEEL / STAY / CLEARING / "WAITING · DOOR". **K = sic, L = stay/heel**; gamepad **L3 = sic, R3 = stay**; two DOM buttons. **There is no touch layer for the K9** — the buttons are it. Aim point clamped 0–80u. | `k9-controls.ts`, `input.ts:133`, `:240` |
| Phantom counter | ✅ | A **Phantom LSW** phase-blink landing within **12u of any enemy dog** is uncloaked and the strike cancelled — the design's "counter to stealth", wired into a god. | `lsw/phantom.ts:37-47` |
| Ladders | ⬜ by rule | `actorCanUseVerticalTransition` **refuses ladders to dogs** (stairs are fine). A `sic` on a ladder-only upper floor never completes — `stepK9Sic` has no timeout. | `map-layers.ts:106-108` |
| Multiplayer | ⬜ | **The human never owns a dog online** — the server pairs the K9 to the first `kind === 'bot'` explicitly, so K/L do nothing in MP. | `server.ts:96-98` |

### 1.3 The animals sweep — there is only the dog
Exhaustive check. Every other "animal" is something else:
- **`kennel`** (`buildings.ts:297`) — a building floorplan template. It does not house or spawn dogs.
- **`junkhound`** (`data.ts:834`) — a **machine**: one of the four Iron Eaters, HP 55, plate 35, borrows `dog_bite` and a dog-like silhouette, wears a serial ("HOUND-03"), molts armour. Explicitly "machine to the last".
- "rabbit / prey / hounds / pack" — **paintball metaphors** for the Prey/Hunt mode (human players).
- "the bird" — aircraft slang. "perch / bird down" — the **Gargoyle** LSW. "swarm" — the horde.

---

## 2 · WHAT WE ARE AIMING AT

`DESIGN-DIRECTIVE.md §5.3` is the intent, and it is more ambitious than what shipped. Verbatim highlights:

> *"A real capability that earns its slot as the **counter to stealth**, and the most beloved unit we can ship. The K9 (a Malinois) comes as a **handler pairing** — take the K9 option and the dog deploys with you."*

- **Detection** — sniffs out camouflaged operators **and planted explosives**, marking them for the team.
- **"The bark is your sixth sense"** — a threat behind you inside the dog's radius triggers a **directional bark**, "a growl-vector pointing through your fog of war at the stalker". With vision cones live, *"the K9 is a living 360 sensor that loves you; no equipment slot can compete with that, and it shouldn't."*
- **Chase & takedown** — send the dog: fast, fragile, **staggers** a fleeing target long enough for the squad to close.
- **"It has a name and a record."** Journal entries and its own service history — *"Rex — 3 tours, 41 finds, wounded twice"*. **"When a K9 goes down and the handler carries it to the ambulance, that's the clip of the match. Dogs are how you make players *feel* things."**
- **Doctrine fit** — K9s are a **United Front signature**: the human-and-animal army against the Collective's machines. *"Dog vs robot-dog is a fight we want."* (That robot dog exists: the junkhound.)

---

## 3 · THE GAP, RANKED

| # | Gap | Evidence |
|---|---|---|
| 1 | **No service record.** The dog has a name but no history — no tours, finds, wounds, no Journal entry. The design calls this the emotional core ("dogs are how you make players feel things"); it is the biggest missing piece and it is *meta*, not sim. | no dog fields in `client/record.ts` |
| 2 | **No wounded state and no carry.** A dog dies and respawns at your side. The design's best moment — carrying a downed K9 to the ambulance — cannot happen. | `world.ts:2210` |
| 3 | **The scent trail is one-way.** Team-0-only gate means your own dog cannot track. This is the single biggest "is this intended?" in the dog code. | `world.ts:2203` |
| 4 | **No explosive detection.** The nose finds hostiles only; the design promises mines/IEDs too. The `pinged` channel already supports it. | `bots.ts:1885` |
| 5 | **No directional "sixth sense" bark.** The dog barks at doors and on events, but never gives the growl-vector at a stalker behind you — which the design calls the whole point of pairing with a dog. | `bots.ts:1740` |
| 6 | **No handler agency.** You do not *choose* the dog; it is an automatic infantry/engineer freebie, one per team, and if a bot is the handler you get no panel at all. The design says "take the K9 option". | `main.ts:1217` |
| 7 | **Sic is building-scoped only.** You cannot sic on open ground or a marked enemy. | `k9-orders.ts:172` |
| 8 | **No takedown.** The bite hauls ~5u and re-bites; the design says *stagger* a fleeing target. | `world.ts:4603` |

---

## 4 · OPEN QUESTIONS

1. **Is the team-0-only scent gate deliberate?** (Guard dogs hunting raiders in science) or a latent asymmetry that should be both-teams? *This is the one I would ask first.*
2. **Should fielding a dog be a choice** — a loadout slot, a rank perk, a purchase — rather than an automatic freebie? And is one-per-team the intended ceiling outside science?
3. **Breeds/roles?** One archetype forever, or scout / attack / detection variants with different stats? (The design says Malinois; the model is a Shepherd.)
4. **Should `sic` work on open ground or a marked enemy**, not just buildings? Are heel/sic/stay the final vocabulary, or do we want track-this-scent / guard-this-teammate / return?
5. **Should the nose respect walls?** Today it is a 10u through-wall bubble. And should it draw an explicit scent-ping on the *player's* HUD rather than only feeding AI perception?
6. **Does losing your dog cost anything?** A redeploy cooldown, a vet bill, a handler morale hit, a wounded-not-dead state?
7. **Do we ever want other animals** — wildlife, pests, mounts — or is a one-species animal kingdom correct for this world?

---

## 5 · MY RECOMMENDATION

**Build the record and the wound, in that order. They are cheap and they are the whole point.**

The dog's *mechanics* are done and good — genuinely one of the best-implemented systems in the game. What is missing is everything that makes you care about this particular dog. The design says it out loud: *"dogs are how you make players feel things,"* and the two features that deliver that are both meta-layer, not simulation:

1. **A service record.** "Rex — 3 tours, 41 finds, wounded twice." The dog already has a name from a fixed pool and already generates the events worth counting (finds via the nose, bites, deaths). This is a small store and a card in YOUR FILE, and it converts a good mechanic into a character. **Highest emotional return per hour in the codebase.**
2. **A wounded state + carry.** Right now death is free — the dog blinks back at your side. Make it go *down* like a person does, and let the handler carry it out. The revive/drag machinery already exists for soldiers (`world.ts:2237`). That is the clip-of-the-match the design is asking for, and most of it is already written for another body.

**Then fix the scent asymmetry** (§4.1) — it is probably a one-word gate change and it silently disables a whole feature for the player's own dog.

**I would not** add breeds, packs or a bigger order vocabulary yet. The order set (heel/sic/stay) is tight and readable, and widening it before the dog *means* anything to the player is decoration on a stranger.

**On other animals:** I would keep the animal kingdom at one species deliberately, and say so in the fiction. The K9's power comes from being *the* animal — the one living thing in a war of machines and prints. Wildlife would dilute that, and the Collective's junkhound already gives you the "dog vs robot-dog" fight the design wants without adding a second real creature.

---

## 6 · TRAPS

- **The nose is the feature.** `pinged` is a shared reveal channel and perception treats it as sight-through-cloak. If you narrow it, you silently make the infiltrator classes strictly better.
- **`pinged` is double-buffered.** Bots read `pingedLast` because recon fills `pinged` *after* the brains run. Read the wrong one and dog-marks land a tick late (or never).
- **Guard range is measured from the HANDLER, not the dog** (`bots.ts:1917`). Debugging "why won't it engage" starts there.
- **Dogs are exempt from several loops on purpose** — corpse purge, morale, class-request. If you add a system that iterates soldiers, decide explicitly whether dogs belong in it.
- **The dog will not open doors.** It stops and barks. That is the intended tactical loop (dog flushes, human breaches) — do not "fix" it without a decision.
- **Order state lives on the Soldier**, which is why it replicates free. Do not move it into a client-side map; multiplayer will silently lose orders.
- **Scent is team-0-only today** (`world.ts:2203`). Any test you write against your own dog's tracking will pass or fail for this reason, not for the reason you think.
- **The dog cannot climb ladders** (`map-layers.ts:107`), and `stepK9Sic` has **no timeout** — sic a building whose upper floor is ladder-only and the sweep stalls at that waypoint forever.
- **`dogWaitsAtDoor` returns `true` from inside `driveK9Toward`**, so the caller silently loses its movement that tick. Ground-floor **metal** doors are excluded from the block check, so the dog can walk into one and neither bark nor pass.
- **In multiplayer the human never owns the dog** (`server.ts:96-98` pairs to a bot explicitly) — the whole control surface is dead online.
- **`stepDog` never reads `s.hp`.** A 1-HP dog charges exactly like a full one; there is no fear, no flinch, no retreat.

---

*Verified against `main`, 2026-07-23. Code evidence from `.notes/audit-dogs-officers.md`; intent from `DESIGN-DIRECTIVE.md §5.3`.*
