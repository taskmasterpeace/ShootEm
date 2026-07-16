# War World — Map Strategy

**The plan for every battlefield we build.** Split out of the Design
Directive (§8.2 keeps the canonical front roster; this document owns *how we
get from here to there*). Living document — updated as decisions land.

- Companion to: [`DESIGN-DIRECTIVE.md`](DESIGN-DIRECTIVE.md) (§8 terrain &
  fronts, §8.4 roofs/slits, §8.6 surfaces, §8.7 jump vocabulary, §19 vision)

---

## 1. The four map families

Everything we will ever build falls into four families, each with its own
job, scale, and toolchain:

| Family | Scale | Job | Built by |
|---|---|---|---|
| **A · Arena pockets** (paintball, duels, drills) | 40–60u | teach movement, taste weapons, arcade fun (§3.3 Paintball Yard) | hand-authored tile stamps |
| **B · Neighborhoods** | 150–250u | close-quarters infantry war; the Outbreak's hunting ground; The City's building blocks | the **dynamic house generator** |
| **C · The ten fronts** | 300–400u | the campaign's named theatres (DD §8.2 roster) | generator recipes v1 → authored maps post-§8.4 |
| **D · Proving Grounds wings** | mixed | qualification courses + tech testbeds | hand-authored, reuse A + B pieces |

The families share one grid engine, one tile vocabulary, one prop system —
a piece built for any family is inventory for all of them.

## 2. The tile vocabulary (the alphabet everything is written in)

Maps are sentences in a small alphabet, and the alphabet is nearly complete:

- **Blocking:** `T_OPEN · T_WALL (4u) · T_COVER (1.2u) · T_WATER` — shipped.
- **Jump tiers (DD §8.7):** HOP (1.2u, anyone vaults) · CLIMB (2–2.5u, jump
  troopers) · WALL (4u, nobody) — *height-aware blocking, to build.* Arena
  pockets (family A) are the proving ground: they're built almost entirely
  from this grammar.
- **Slits & roofs (DD §8.4):** `T_SLIT` firing band + cutaway roofs —
  *decided, build before authoring fronts.*
- **Surfaces (DD §8.6):** grass/mud/sand/ice/snow/road/marsh/rubble layer —
  movement, sound (footstep designation is live), and tracks.

**Sequencing law (from §8.4): no front gets authored twice.** Families A and
B can ship on today's alphabet; family C waits for slits + roofs + surfaces
+ the 300–400u scale decision.

## 3. Dynamic houses — the neighborhood requirement

We already generate houses (safehouse mode: footprints, doors, interior
dividers, yards). To make **neighborhood maps a family**, the generator
generalizes:

- **Parameterized footprints** — size/shape variety, multi-room plans,
  attached garages; row-houses vs detached lots vs the dense blocks The City
  needs.
- **Openings become vocabulary** — doors (exist), window slits (§8.4
  `T_SLIT`), breachable wall segments (the breacher's dinner).
- **Cutaway roofs** (§8.4) — non-negotiable for family B: a house without a
  roof is a floor plan, not a building.
- **Yards & streets carry the surface layer** (§8.6) — lawns, pavement,
  mud alleys: the neighborhood *sounds* like one (footstep designation).

## 4. The concealment rule — houses hide people

The rule that makes buildings matter (user-decided, ties DD §19 + §8.4):

> **If you can't see a character, they are not on your map.** Inside a
> house, an enemy is invisible AND un-minimapped until your cone, your
> squad's eyes, a camera, or the dog finds them. The roof conceals; the
> doorway is the question; the slit is the answer.

The v1 vision cone is the *light* cone (enemy-draw only, no wall-shadow
pass) — but interiors get the concealment rule from day one because roofs
already hide them visually and the minimap simply respects it.

## 5. Sequencing

| Phase | Ships | Unblocks |
|---|---|---|
| 1 | **Arena pockets** on today's alphabet + jump tiers (§8.7) | Paintball Yard (§3.3), movement school (§14) |
| 2 | **Slits + cutaway roofs** (§8.4) + house generator generalization | Neighborhood family, The City prototype |
| 3 | **Surface layer** (§8.6) + map-scale decision (300–400u) | down/drag/revive (§4.3), weather (§8.8) |
| 4 | **The ten fronts**, authored against the full alphabet | the Living Campaign's real theatres (§8.2) |

## 6. Open questions

- Arena pockets: hand-stamped layouts or a mini-generator with heavy
  constraints? (Lean: hand-stamp the first six — arenas live and die on
  exact geometry.)
- Neighborhood streets: grid (classic suburbs) vs organic (older towns)?
  Affects readability from the top-down camera.
- How many arena pockets does the Paintball Yard open with? (Lean: 3.)
- Front scale: one global 300–400u decision, or per-front sizes tuned to
  population targets (§12)? (Lean: per-front, sized to the mode.)
