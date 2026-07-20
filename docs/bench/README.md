# Zombie stress bench — the perf tracker

The instrument for "large number of shambler zombies in combat," recording every run so improvements show on a graph over time.

## Run it

```bash
# one-shot, single count (quick sanity)
npx tsx tools/zombie-bench.ts 300 400

# tracked sweep — appends a labelled run to the history + regenerates the graph
npx tsx tools/bench-track.ts "S4 objective cache"

# the honest baseline for the objective cache, same binary, cache OFF
npx tsx tools/bench-track.ts --nocache

# rewrite the graph pages from history without re-benchmarking
npx tsx tools/bench-track.ts --regen

# custom ramp
npx tsx tools/bench-track.ts "my fix" --counts=100,300,600,1000,2000
```

## What it measures

12 defending bots hold against **N plain shamblers**, topped up to N alive every tick so the load stays constant. It times **`step()` only** (sim tick, not render), over a warm-up + measured window, at a fixed seed. The sweep ramps the count up to find **the wall** — where a single step blows the 16.7 ms frame budget.

## The files

| File | What |
|---|---|
| `zombie-history.json` | every run: `{ts, commit, label, points:[{n, mean, median, p95, max}]}` — append-only |
| `zombie-perf.html` | the graph, standalone (open in a browser / dev server at `/docs/bench/zombie-perf.html`) |
| `zombie-perf.fragment.html` | body-only copy, for publishing as a shareable Artifact |

Each recorded run draws its own line, so landing a fix and re-running shows the new curve dropping below the last. A point turns red when it crosses the budget.

## The workflow per fix

1. Land the optimization (commit it).
2. `npx tsx tools/bench-track.ts "<fix name>"` — adds a line at the new HEAD.
3. Commit the updated `zombie-history.json` + regenerated pages.
4. Re-publish the Artifact if you want the shared link refreshed.

## Reading the current graph (2026-07-20)

Two lines so far — **baseline (no obj-cache)** vs **S4 objective cache**. S4 is 24–33% faster at combat scale (50–300 shamblers) and pushes the wall from **~732 → ~778** shamblers. The big super-linear jump between 500 and 800 is the O(n²) targeting/separation scan (audit issue #38, the spatial grid) — the next line to beat, and the fix that will move the wall the most.
