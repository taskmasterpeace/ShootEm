# THE BLAST — sizing audit & the two zones

> Robert: "we need to SEE the explosion radius… a circle in the center, and a
> radius around that. And a knockback — the closer you are, the more. And
> concussion grenades. Size everything up. Look at the room sizes."

## The two zones (the model the rings draw)

Every explosion now resolves in two zones, and the ground rings read the
SAME numbers the sim uses — the ring never lies:

- **The kill circle** (`killRadius = min(splash × 0.4, 2.4)`): the lethal
  heart. Inside it you take the full **direct + splash** blow — a frag's core
  is ~105, lethal to a full-HP trooper. Drawn as the bright filled disc.
- **The splash reach** (`radius = splash`): from the kill circle the damage
  falls linearly to **0 at the rim**. Drawn as the expanding shockwave ring.

Before this pass the "kill zone" (where a 100-HP trooper actually died) was
about **0.24u** — you had to land it on their head. Now it's a real ~2.4u
heart. Knockback was already proximity-scaled (`× (1 − d/splash)`) and still
is — the close man is thrown hardest.

## The size-up (blast radii, ~15–20%)

| Weapon | splash before → after | kill circle |
|---|---|---|
| GL-40 / hand frag | 5.0 → **6.0** | 2.4 |
| 120mm tank cannon | 5.5 → **6.5** | 2.4 |
| Micro-missile (MML) | 4.5 → **5.4** | 2.16 |
| Impulse cannon | 2.8 → **3.3** | 1.32 |
| Mech seismic stomp | 4.5 → **5.4** | 2.16 |
| **C-9 Concussion** (new) | **6.5** | 2.6 |

## The concussion grenade (C-9)

A fourth grenade-bag slot (X cycles frag → smoke → fire → **concussion**),
one issued to everyone. On detonation: **heavy knockback (26)**, almost no
lethal bite (~18 core, falling to 0), and a **stagger** — a 1.4s fire-lock
(ringing ears) plus a 1.6s disorient on bots. It shoves and rattles; it does
not kill. Blue rings mark it apart from the orange HE.

## Room sizes — audited, left as shipped

Interior rooms after BSP splitting run **~9–21u** across (manor 14–17×10–12
tiles, bungalow 10–12×8–9, hall-house 14–17×7–8; TILE = 3u). With the
now-**visible** 6u frag radius, a grenade clears a corner-to-half of a small
room — a good tactical proportion, and the rings make it legible. A further
room enlargement was prototyped (+2 tiles per template) but it destabilises
the safehouse neighbourhood house-packer (bigger houses clip a door in the
tight grid, breaking the "every house has a real front door" law). That needs
a packer-robustness fix first, so the room bump is **deferred** — the blasts
were sized up to the rooms instead of the rooms to the blasts.

## Verified

Laws (tests/finish-list.test.ts): the event carries both radii; inside the
kill circle is lethal, the rim only chips, the middle is between; knockback
scales with proximity; the concussion barely bites but shoves harder than a
frag and staggers. All 40 threat bands re-measured green (Magnetar's halo
leak re-widened 0.8 → 0.68 after the more-lethal model tipped him over).
Live: red kill-disc + orange ring for HE, blue rings for concussion.
