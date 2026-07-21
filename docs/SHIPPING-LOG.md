# WAR WORLD: EARTH — Shipping Log

The public record of what shipped, written for players and backers — not engineers. Newest first. Versions anchor to `docs/VERSION`.

---

## v0.9.0 — 2026-07-21 · "The Air War to The Outbreak"

**Momentum: 43 commits in 37 hours.** 547 files touched, ~8,000 lines added, the automated battle-test suite grew to **1,355 passing checks**, and the download shrank **73%** — all between the afternoon of July 20 and the small hours of July 21.

### New

- **The sky has floors.** Aircraft now fly in three altitude bands — tap Q to climb a level, E to dive one, and on the deck E becomes the door. Jets earn the sky: a real afterburner stretch, and when you cross the threshold **the sound barrier visibly breaks** — a vapor ring snaps off the fuselage and distant listeners hear the double-crack *late*, because that's how physics works.
- **Every gun is real now.** All weapon families have actual 3D models — six manufacturers each change the silhouette (vents, slabs, drums, coils), and higher marks visibly dress the barrel. Soldiers carry the exact gun they're firing; an armory contact sheet shows the whole catalog.
- **THE OUTBREAK.** The dead are now a system, not a spawn point:
  - Infection is separate from damage — armor stops the claw, not the contamination. Exposed soldiers incubate, and untreated they **TURN — your own side rising against you**. Medics are the cure.
  - Bodies that die hot rise on a clock, **by name**. A corpse warning fires in the final seconds — burn it or meet it.
  - Blasts, incendiary rounds, and bio-neutralizer deny corpses. Fire is policy.
  - A sector-wide **Outbreak Level (0–4)** climbs from CLEAR to SECTOR LOST, driven by real conditions — bodies, bites, and nests — with biohazard alerts as it escalates.
  - **The body decides the form**: scouts rise as sprinters, heavies as brutes. Sprinters spawn *dormant* — light, noise, or proximity wakes them, and only once.
  - Leave corpses piled and they **curdle into contamination nests**: infected inside run hotter, and bodies that rot there rise *mutated*.
- **Seven ammunition types.** Tap B to cycle Ball → Armor-Piercing → Incendiary → Tracer → Subsonic → Expanding → Bio-Neutralizer. Each solves a different battlefield problem — AP threads plate, INC burns the dead, TRC marks what it hits, SUB trades reach for silence.
- **Close combat is a contest now.** The full counter triangle: **STRIKE beats GRAPPLE beats GUARD beats STRIKE.** Every soldier carries a combat knife (F), a held guard blocks and *parries* (V), a grab pins through a raised guard (Z), and holding F winds up an **Impact Charge** — quick, heavy, maximum, or a fumbled overcharge if you're greedy. When a zombie latches on, it's a **Bite Struggle**: mash free before the jaws close.
- **The downed experience speaks.** A breathing bleedout banner with the clock, a pulsing ground ring under every fallen friendly, and a revive arc that closes around the body as the medic works.
- **The HUD tells the truth.** Grenade pouches as refilling pips, a spawn-protection shell you can see expire, **MISSILE INBOUND** warnings with flare counts, the enemy god's drop countdown with a tightening landing ring, and the mounted gun's recharge cycle on the vehicle panel.
- **The war has a memory.** Print counters on every clone, HR streak notices for kill runs, a flesh-vs-chrome scoreboard ledger, and a deadpan weather desk calling the sky.
- **The Codex grew war intelligence** — ASCENDANTS and THREATS pages: every god and every horde unit, with real shots-to-kill numbers.

### Improved

- **The game runs dramatically better under load** — four optimization waves, each proven on a public benchmark graph:
  - The horde stress-wall moved to **~790 simultaneous zombies** inside the frame budget (per-team spatial index).
  - Bot thinking under a horde got **26–37% cheaper** (objective caching).
  - The download shrank from **173MB to 47.6MB** (audio re-encoded, nothing cut).
  - Multiplayer inputs queue per-client — no eaten button presses, no stuck-walking after tabbing out.
- The game has its name: **WAR WORLD: EARTH**, on the masthead.

### Fixed

- Hover unit-tags and enemy health rings never appeared in offline matches — now they do everywhere.
- A hand-tuned pass from a live playtest: vehicle hulls, flame behavior, god balance, and meters that weren't drawing.

---

*Log begins at v0.9.0. Earlier history lives in git. Rendered page: `docs/whats-new.html`.*
