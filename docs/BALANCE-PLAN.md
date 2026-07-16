# War World — Balance Plan

**Testing finds balance; the table is the witness.** This is the standing
loop for polishing what we have — numbers first, feel second, doctrine
guarded by tests. Companion to [`DESIGN-DIRECTIVE.md`](DESIGN-DIRECTIVE.md)
(Appendix B: numerical tuning is decided *here*, never in the directive).

## 1. The loop

```
 MEASURE ──► DIAGNOSE ──► TUNE LIVE ──► APPLY ──► RE-MEASURE
 (sim tool)  (ledger)     (Arsenal Lab)  (data.ts)  (sim + tests)
```

1. **MEASURE** — `npx tsx tools/balance-sim.ts --matches 10 --mode tdm`
   runs headless 12v12 bot wars at sim speed and prints the ledger:
   per-class K/D + win%, per-weapon kills, match durations, outlier flags.
   Deterministic seeds — the same command reproduces the same war.
2. **DIAGNOSE** — read the ledger against the acceptance bands (§3below).
   An outlier is a *question*, not automatically a problem (heavies SHOULD
   out-kill medics — by how much is the design decision).
3. **TUNE LIVE** — open the **Arsenal Lab** (harness ▸ 🎯), select the
   weapon, drag the 11 sliders while firing down the measured lane, and
   **Copy Δ** puts the changes on the clipboard.
4. **APPLY** — paste the Δ into `data.ts` / `arsenal.ts`. Relational tests
   (mech/knockback/armor doctrine) fail if a tune breaks a locked
   relationship — the doctrine is guarded, the numbers are free.
5. **RE-MEASURE** — sim again + `npx vitest run`. Commit tune + ledger
   excerpt in the message, so balance history reads like history.

For **feel** (what the sim can't measure): a 10-minute manual checklist per
tuning round — hut fight (breach a slitted building), a vault chase, a mud
crossing under fire, one MANPADS duel, one mech stomp brawl. Feel notes go
in the commit too.

## 2. First findings (already on the board)

From the tool's maiden run (2× tdm, 12v12):

| Finding | Reading | Candidate knobs |
|---|---|---|
| **jump K/D 0.47** vs heavy 1.65 | jump troopers die 2× more than they kill — fragile + close-range kit on a 300u map | hp 90→100? kuchler range/dmg; jet energy regen; spawn-side positioning |
| **heavy/infantry dominate kills** | frontline classes over-reward vs specialists | watch, don't touch yet — specialists score differently (heals, spots, caps) |
| **TDM hits 50 kills in ~1 sim-min** | lethality very high for the mode target at 12v12 | raise tdm target to ~75 for 12v12, or that's the intended bloodbath — decide by feel |
| medic/infiltrator low K/D, high win% | support correlates with winning — GOOD signal | none — this is the design working |

## 3. Acceptance bands (v1 — tighten with data)

- **Class K/D** within ±35% of the mean *for frontline classes*
  (infantry/heavy/jump/engineer); specialists judged by win-correlation
  instead.
- **Class win%** within ±10 points of 50 across a 10-match batch.
- **No weapon** above 2× the median of its tier's kill count.
- **Match duration** ≥ 40% of the configured cap (a mode that ends in a
  minute needs a bigger target, not better players).
- **Draw rate** under 20%.

## 4. The knob inventory (where tuning lives)

- **Weapons:** `data.ts` CORE_WEAPONS + `arsenal.ts` FAMILIES/BRANDS/TIERS —
  damage, rof, speed, range, spread, clip, reload, splash, knockback.
- **Classes:** `data.ts` CLASSES — hp, speed, primaries.
- **Vehicles:** VEHICLES — hp, speed, turnRate, systemHp (+ the mech's
  relational slots are test-locked).
- **Surfaces:** `map.ts` SURF_* tables — the §8.6 movement fork.
- **Campaign:** `campaign.ts` BASE_SHIFT, MODE_WEIGHT, band edges,
  SEASON_FRONTS_TO_WIN.
- **Modes:** `modes.ts` targets (tdm 50, ctf 3, koth 120s, conquest 500).
- **Combat rules:** spawn protection window, knockback caps, armor pools.

## 5. Cadence

- **Per feature ship:** one 4-match sim batch — did the ledger move in an
  unintended direction?
- **Weekly polish round:** 10-match batches on tdm + conquest + one co-op,
  one tuning pass, feel checklist, commit.
- **Before any public wss:// endpoint:** a 20-match batch across all
  competitive modes with every band green.

## 6. What the sim cannot see (playtest-only)

Human-only signals: whether slit fights feel oppressive or thrilling ·
vault timing generosity · mud frustration vs texture · killcam
readability · the sound of a hut breach · whether 300u fronts feel like
travel or like walking. These are decided at the screen, logged as feel
notes, and never overruled by the table alone.
