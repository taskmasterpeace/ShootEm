# UI & RESOURCES — the audit

> Robert: "I don't know if it's energy or armor — audit all that out for me…
> I need documents on everything that we need to be shown in the UI, the
> weapons and the descriptions, what makes them different, a deduping of the
> weapons." This is that document, read from the code, not from memory.

---

## 1. The three resources — what each one IS

| Resource | What it is | Who has it | How it moves | Where it shows |
|---|---|---|---|---|
| **HP (health)** | Flesh. The only resource whose zero is a death. | Everyone. Class-set (trooper ≈ 100, heavy more); an LSW's HP is its THREAT (1200 / 2600 / 5000 / 9000). | Down: damage after plate is gone. Up: medics, medikits, ambulances, a few LSW drains. Regenerates slowly out of combat. | Own HUD: number + bar (`hp-num`/`hp-fill`, reddens under 35%). Squadmates: the health ring. Enemies: **the new tier-gated bar** (§4). |
| **ARMOR (plate)** | Ceramic. A separate pool that absorbs damage BEFORE hp and **never heals back** — medics fix flesh, not plate. | Only soldiers whose *equipment* issues it; LSWs are plateless by law (threat is HP, never a plate wall) — the exceptions are earned in-fiction (Steel Weaver wears the wall he ripped; Iron Eaters wear the scrap they are, and it MOLTS). | Down only. Gone is gone until respawn. | Own HUD: its own bar, shown **only when this life carries any**. Squadmates: the steel-blue second ring. |
| **ENERGY** | The ability battery: jetpack fuel, cloak charge, warp charge — one 0–100 pool per soldier, spent by the class verb and regenerated over time (jets regen only on the ground). | Everyone; only classes with energy verbs actually spend it. EMP **zeroes it** (and drops cloak) — that's the counter. | Down: using the class ability. Up: regen. | Own HUD: number + bar (`en-num`/`en-fill`). Not shown for others — your battery is your business. |

**The verdict on "energy or armor":** they are different things and both already
exist, correctly separated. Armor is *purchased protection that death resets*;
energy is *a rechargeable verb budget*. The HUD already shows all three for
yourself, health+armor rings for squadmates, and (as of this pass) a
tier-gated health bar for enemies. Nothing is missing structurally — the gaps
were presentation, addressed in §4.

## 2. Everything the UI shows today (the inventory)

**Own HUD (always):** hp number+bar · energy number+bar · armor bar (when
carried) · weapon name, clip/reserve, reload state · grenade bag (X cycles
frag/smoke/fire) · ability cooldown · class + rank · kill feed · announcer
line + big-moment banners · minimap (perception-true: cone+ring, smoke, grass
tint, breaches) · match clock/score · LSW telegraph countdowns · music tier.

**Over other soldiers:** name tag (faction-colored, outlined) · squadmate
health ring + plate ring (redrawn on 5% buckets) · downed "help" state ·
**enemy thin health bar when perceived** (new) · **exact enemy number only
with tracking optics** (new — the tier gate) · LSW aura/scale/tint identity.

**Consoles:** V = THE STABLE (roster, tier, price, signature arm, purse,
commission gate) · Tab = scoreboard · chat/comms · deploy screens · the
harness's six tabs (Stage · Arsenal Lab · World · Building Lab · Map Maker ·
⚔ Matchup).

**Cloak opacity (the ask):** already true — a cloaked soldier renders at
**30% alpha to their own team and themselves** (`renderer.ts` alpha 0.3);
enemies see *nothing* because cloak is TRUE in the perception law (pings and
EMP are the counters). If cloak still reads as "fully invisible," that's the
enemy view working as designed — the friendly ghost is the 0.3.

## 3. The weapons — what makes them different, and the dedupe

**Census: 286 weapon defs.** Three layers:

1. **The generated arsenal (~230):** 17 families × 3 Mk tiers × 4 makers.
   Within a family-tier cohort the *makers* trade the same budget differently
   (damage vs rof vs clip vs reload) — cohort-mates are siblings by design,
   not duplicates. Family + Mk is the real identity; the maker is the flavor.
2. **The hand-tuned core (~40):** class defaults, vehicle guns, monster
   attacks, paint markers, utility (repair, medi-beam, EMP, beacons).
3. **THE SIGNATURE ARMS (40, new):** one per LSW, family `lsw`, infinite
   clips, ~90–110 practical DPS. Six are unarmed-melee; the rest split into
   the Beam, Arc, Thrown-Sun, Phantom, and Ordnance schools.

**Dedupe findings (stat-identical on damage/rof/speed/spread/pellets/range/splash):**
exactly **5 duplicate pairs in 286** — and every one is a deliberate alias,
not an accident: `pistol=pistol_maklov_1`, `kuchler=smg_maklov_1`,
`caw=shotgun_maklov_1`, `flamer=flamethrower_maklov_1` (the core issue
weapons ARE the Maklov Mk-1s, listed under both names), and
`smoke_nade=fire_nade` (same ballistics, different payload — the payload
field is the difference). **Recommendation: no deletions.** If the double
listing bothers the Arsenal Lab view, hide the four `*_maklov_1` aliases
behind their core names in the UI only.

**Right-click (alt fire):** four core guns carry an under-barrel personality —
burst (flame burp), skitter (charge on legs), tag (pin dart), overcharge
(dump the clip into one shot). Kept, per Robert ("that's pretty cool").

## 4. The tier gate — who sees exact numbers

Ratified and now live:

- **Bars are public.** Any enemy you currently perceive wears a thin health
  bar — the *shape* of the fight belongs to everyone.
- **Numbers are intel.** The exact HP readout renders only if *your* kit
  carries **tracking optics** — the same gear that already buys longer
  vision linger. One gear, one theme: information.
- Energy is never shown for others (your battery is your business); armor
  shows as the squad's steel ring and, for enemies, is implicit in the
  plate-spark hit feedback (sparks = plate, blood = flesh — already shipped).

Future rungs on the same ladder (not yet built): officer map overlays,
psi-scan revealing energy state, K9 handlers reading crouch/grass hides.

## 5. The attack-VFX grammar (ratified spec — the next renderer pass)

Every LSW attack gets three beats the recruit's rifle never gets:
**charge tell** (0.2–0.4s gathering light — point light ramp + inward
particles) → **the event** (the school's tracer: beams with soft glow-line +
contact bloom; arcs as 3–5-segment jitter rebuilt per frame with end-pop
lights; thrown suns at 18–26u/s with moving point lights; the Phantom school
rendering LESS light than a rifle — Nightmare's lash only on the victim's
screen edge; ordnance with muzzle smoke and shell weight) → **residue**
(scorch/frost/ember decals in the existing capped splat pool). The unarmed
six speak through windup poses, motion-streak arcs, and the world flinching.
Movement dress: leap crouch-squash + crater thud, blink afterimages
(Chronos gold, Voidwalker inward-collapse, Specter mirror-flicker), wraith
hover-silence, tier-scaled footfall dust. House law throughout: **no purple.**
