# LORE — the world's facts
### SOURCE OF TRUTH for setting. Facts, not prose. Locked 2026-07-20.

## The year 📋 DESIGN
- **2222.** The aliens arrive in **8 years** (2230). Both facts are known.
- The war is squandering the prep time — nobody in-world says "doom clock,"
  but every broadcast (WAR.md §7) plays under one. The tragedy is implicit,
  never narrated.

## The factions ✅ SHIPPED (names, doctrine) / 📋 (the god-naming split)
- Two human factions — **The United Front** (amber, combined arms, K9s) and
  **The Collective** (cyan, asymmetric & unmanned doctrine). Names locked
  and shipped on every scoreboard (`docs/DESIGN-DIRECTIVE.md` §1).
- One faction names its living weapons **"gods"**; the other says
  **"living super weapons." The machine-naming faction built them.** The
  Collective — the machine-doctrine side — is the builder and says LSW; the
  United Front's infantry say gods. **The name tells you who's talking.**
- Both sides field a full stable today (`docs/ASCENDANTS.md`,
  `src/sim/lsw.ts` — every `LswDef` carries a `faction`). The
  per-faction vocabulary split is a writing rule to enforce, not code.

## Clones — how lives work 🔨 PARTIAL
- Enlistment includes **the imprint**: a full neural record, refreshed each
  deployment. Die at the front and the military **reprints** you at base in
  a fresh sleeve (DD §21, shipped v1: the announcer's **REPRINTED** —
  `src/client/hud.ts:702`; the clone bay in every base —
  `src/sim/base.ts:39`).
- **The body is expendable; the RECORD is you** — the dossier, medals, and
  journal are the imprint's receipts (`src/client/record.ts`).
- Clones are **the treasury of the war**: issued, burned by deaths,
  allocated by officers, stolen and denied by science missions. A front
  with zero clones is a lost front (WAR.md §3).
- The Outbreak corrupts the imprint — **the infected cannot be reprinted**
  (DD §21). That's why a zombie is scary in a world where death is a
  printer queue.

## Robots — the rank and file 📋 DESIGN
- The machines that fill both armies: **chrome frames, subordinate to any
  human**, automatically outranked by every clone (WAR.md §4).
- Destroyed robots are **scrap** — steel lost, no imprint, no grief, no hit
  to the clone treasury.
- Today a `bot` is sim-identical to a human (`SoldierKind`,
  `src/sim/types.ts:236`); the chrome and the rank floor are the build.

## THE IRON EATERS ✅ SHIPPED (half-built roster)
Junk that learned a body plan. Where the Outbreak eats flesh, **these eat
METAL** — they reprint machines the way the war reprints you (DD §21). The
roster in code IS the Iron Eaters (`IronKind`, `src/sim/types.ts:249`):

| Kind | HP / plate / speed (`src/sim/data.ts:421`) | What it does today |
|---|---|---|
| **scraprat** | 26 / 14 / 13 | hunts the nearest enemy vehicle and GNAWS it — a parked hull is a picnic (`src/sim/bots.ts:1681`) |
| **junkhound** | 55 / 35 / 15 | spring legs — JUMPS cover lines instead of pathing around (`src/sim/bots.ts:1702`) |
| **weaver** | 70 / 55 / 9 | stat-body on the shared zed chase — signature behavior not yet authored |
| **ravager** | 380 / 320 / 5.5 | same — the heavy chassis exists, the identity doesn't yet |

- **The molt is the health bar** (SS20.2): spawned PLATED (armor pool =
  the molt, `src/sim/world.ts:995`); shed the plates and the exposed frame
  takes DOUBLE and gets faster and angrier, once, with a burst
  (`src/sim/world.ts:4229`). AP rounds don't skip the molt — it's identity
  armor, not issued plate (`src/sim/world.ts:4268`).
- They join Survival from wave 4 (every 4th spawn, `src/sim/modes.ts:430`)
  and Horde from intensity 4 (a quarter of the pressure,
  `src/sim/modes.ts:561`); the mix deepens with the waves
  (`rollIronKind`, `src/sim/modes.ts:509`).
- Per the design they are **"easily taken out" fodder against robots** —
  the horde shreds chrome without ever touching the clone treasury. The
  scary version of an Iron Eater is what it eats, not what it kills.
- **Zombies are a separate horde** — the Outbreak: zombie / spitter /
  brute / sprinter / bomber / stalker (`ZedKind`, `src/sim/types.ts:238`).

## THE JACKALS 📋 DESIGN SHAPED (issue #103 · full canon: docs/LORE-COF-INTEGRATION.md §3-5, COF `bible/factions/THE_JACKALS.md`)
Hunters of living super weapons — **a deniable guild, not a nation**: both
factions hire them and both disown them. Born in the Jackal Years (Year 3,
Season 2) when LSW blood became the black market's hardest currency.
- **The first Jackal is SANDRA, "the L.A. Jackal"** — a Black American woman,
  unhurried, clinical; her ring whispers under her lines. In-game she IS the
  `venatrix` body (snap-traps + harpoon = Jackal fieldcraft, renamed per the
  COF rename table), and the extraction mode's apex third-party spawn.
- **The kit is capture, not slaughter:** traps, tag darts, harpoon-and-reel,
  containment — a Jackal paid for a LIVE god earns triple. Balance law holds:
  gods get reach and presence, never immunity; Jackals are the proof.
- **Mission hooks:** THE JACKAL RUN (#110 — off-books salvage, no imprint
  refresh); the captured-gods ruling (steal DNA → field one clone NOW) makes
  every Jackal both a rival and a vendor; Scientist Hunt crews hire them.
- **Never contradicted:** Greys stay allies · no supervillains · two
  time-travelers only · the Iron Eaters remain the precursor, not a Jackal
  client. Codex THREATS entry lands when they become a spawnable entity
  (#110/#112 build work).

## The escalation the player meets 📋 DESIGN
1. **Clones & robots** — the human war, fought in bodies you can reprint
   and machines you can't mourn.
2. **Iron eaters** — the scrap stands up; the war's own wreckage becomes a
   third side.
3. **The aliens of 2230** — the thing the whole war was supposed to be
   practice for. Later, and earned.
