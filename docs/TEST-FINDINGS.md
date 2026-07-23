# TEST FINDINGS — 2026-07-23

Live measurements from the running game, for the things Robert asked me to
actually test rather than describe.

---

## THE DENSE HORDE — what shooting into a crowd feels like

Robert: *"I asked for the zombies to have the dense zombies… I wanna know how
does it feel to be just shooting into a crowd."*

Measured in the Threat Room, **THE TIDE** preset (`the_tide_test`):

| | |
|---|---|
| Shamblers spawned | **30**, all base `zombie` (the slow kind — correct: "a lot of shamblers, very few quick ones") |
| Average spacing to nearest zed | **2.35u** — genuinely shoulder-to-shoulder |
| Within 30u of the player | **all 30** — the whole tide is on you at once |
| Within 15u | 8 already in the near band |
| Frame rate with 30 dense | **avg 88 fps, 1% low 60** on this machine |
| Shambler HP | 60 · slow |

**The verdict:** the density is real and it holds framerate on a desktop. The
open question is the **Steam Deck** — 88fps here with a discrete GPU is not
88fps on the Deck's iGPU. The 60fps 1%-low is the number to watch; the density
is right, the perf headroom on handheld is unproven.

**What would make it FEEL better** (none built yet):
- **Penetration:** a rifle round should pass through a packed line, not stop at
  the first body. Right now each shot is one target — a crowd absorbs fire
  instead of a burst mowing a lane through it. This is the single biggest
  "shooting into a crowd" upgrade.
- **The mixed horde** (`mixed_horde`) adds the quick ones for contrast — worth
  running side by side.
- Bigger counts (60–100) need a perf pass before they're a mode, not a lab toy.

---

## VEHICLE STATS — the ones Robert asked about

Pulled live from `VEHICLES` in `src/sim/data.ts`.

### The fast lane (top speeds, ground)

| Hull | Speed | Mass (t) | Grip | Turn | Shock | Traction (paved/dirt/ice) | Slip |
|---|---|---|---|---|---|---|---|
| Muscle Car | 31 | 1.9 | 0.95 | 2.5 | 3 | 1.35 / 0.70 / 0.45 | 3.6 |
| Hot Rod | 29 | 1.15 | 0.9 | 2.7 | 2 | 1.25 / 0.65 / 0.40 | 4.0 |
| Roadster | 27 | 1.05 | 1.4 | 3.2 | 2.2 | 1.40 / 0.75 / 0.50 | 1.4 |
| **Jackal Recon Bike** | 26 | 0.35 | 1.15 | 3.4 | 1.6 | 1.15 / 1.00 / 0.55 | 2.0 |
| Sports Car | 26 | 1.35 | 1.3 | 2.9 | 2.2 | 1.35 / 0.75 / 0.50 | 3.2 |
| Rally Truck | 26 | 2.0 | 1.25 | 2.9 | **7** | 0.95 / 1.35 / 0.85 | 2.6 |
| Hoverboard | 24 | 0.12 | 1.1 | 4.2 | 1.4 | 1.00 / 0.95 / 0.80 | 2.6 |

### The two-wheelers (Robert: "how do motorcycles handle?")

There is **no `motorcycle` kind** — the bike is the **Jackal Recon Bike**
(`bike`). Nicely, "Jackal" is now lore-load-bearing (docs/THE-LORE.md).

| Two-wheeler | Speed | Mass | Grip | Turn | Shock | Slip | Feel |
|---|---|---|---|---|---|---|---|
| Jackal Recon Bike | 26 | 0.35t | 1.15 | 3.4 | 1.6 | 2.0 | quick, light, slides ~0.5s at speed; hard landings (low shock) hurt |
| Trail ATV | 15 | 0.42t | 1.1 | 2.8 | **4** | 2.1 | slow but takes drops — a dirt/ice specialist (dirt 1.3) |
| Street Scooter | 13 | 0.14t | 1.1 | 3.0 | 1.0 | 2.0 | toy-fast, nimble, fragile |
| Hoverboard | 24 | 0.12t | 1.1 | **4.2** | 1.4 | 2.6 | the most agile thing in the game; the trick economy lives here |
| Town Bicycle | 7 | 0.02t | 1.1 | 3.2 | 0.6 | 0 | pedal power, no drift |

**How the bike feels, precisely:** `slip: 2` means the velocity chases the nose
at 2/sec, so a hard carve at 26 speed slides for ~0.5s before it bites —
slippery, not soap. `shock: 1.6` is low, so a jump that a rally truck (shock 7)
shrugs off will damage the bike and scrub its speed on landing. `turnRate 3.4`
is high — it flicks.

### Tank vs pickup (Robert's exact question)

| | Tank (Ares) | Pickup |
|---|---|---|
| Top speed | ~14 | ~18 |
| Mass | ~19t | ~1.7t |
| The point | a fact of nature — slow, unstoppable, tracked | faster, lighter, and the natural **cargo** hull |

**The pickup is faster than the tank** — correct. And it *should* carry more,
which brings us to:

### CARGO — the gap Robert named

There is a `CARGO` table in `src/sim/garage.ts` (the racing droppables: mines,
oil) — but **no cargo-CAPACITY system.** A pickup does not currently haul more
than a sports car. Robert: *"a pickup truck is gonna have much more cargo
space, so we wanna make sure we implement that."*

**What a real cargo system needs** (unbuilt, scoped):
- a `cargoCapacity` on VehicleDef (pickup high, tank low, truck highest)
- something worth hauling — salvage, bodies (see below), supplies, the science
  mission's extracted asset
- a weight-affects-handling tie-in: a loaded pickup is slower and turns worse,
  which the mass/heft drivetrain already models — cargo would just raise
  effective mass

This is a clean, high-value addition and nothing blocks it.

---

## DECAY & BONES — Robert's new idea, captured

Robert: *"I'm thinking about having characters decay. We have the bodies, and
when you burn the body I kind of don't want it to just disappear. What if you
had bones left over? In the Ascendants game everything is a statistic. A body
is one thing — they could be reanimated — but if it's bones you should be able
to INVESTIGATE it, use your science to determine how they died and what killed
them. Maybe you need the bones and take them somewhere. We have all these
country stats and we gotta leverage that."*

This is a strong idea and it connects three systems that already exist:
- **Corpses** already persist with physics (`corpseUntil`, the death shove) and
  the outbreak already reanimates exposed bodies.
- **SCIENCE** is a real secondary skill and a real mission type.
- **Forensics** would give the Science stat a *reason to exist on a soldier*,
  which the statistics audit will show it currently lacks.

**The decay chain, as a design** (unbuilt — filed as an issue):
`fresh body → (reanimates OR is burned) → BONES → investigate with Science →
reads cause of death / weapon / time → banked as intel`, with a high-Science
threshold or a "take the bones to a lab" step gated on country capability. It
turns a corpse from set-dressing into a lead — which is exactly the CoF/jackal
economy (the body IS the resource).

Filed for real scoping rather than built in this pass.
