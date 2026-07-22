# Radar and vehicle instrument certification

Status: **PASS**  
Date: **2026-07-21**

## Production surface

- Five deterministic sources ship: fixed-wing radar (125u / 1.25s), rotorcraft radar (90u / 1.5s), staffed team sensors (160u / 2s), surface naval radar (105u / 1.75s), and submerged sonar (80u / 2.25s).
- Tracks are sim-owned, serializable last-known observations. A moving target stays at its swept point until the next pulse and then fades after its source-specific hold window.
- Weather attenuates radar range. Live ECM reduces non-sonar reach to 65%, offsets the observed point deterministically, lowers precision to 0.45, and draws an uncertainty ring. Destroyed sensors stop new sweeps.
- Low ground radar respects walls. High aircraft radar clears ordinary buildings, while Mountain-theater ridge tiles remain terrain-scale blockers. Sonar resolves surface/submerged domains and excludes air.
- Bot search receives a copied radar destination rather than a hidden live enemy position. Telemetry records sweep, contact, jam, and reacquisition events.

## Scenario evidence

| Matrix | Runs | Radar / sonar sweeps | Contacts | Jammed | Reacquired |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vehicle theater foundation | 210 | 7,489 | 577 | 569 | 135 |
| Rotorcraft | 100 | 9,975 | 472 | 362 | measured |
| Submarine | 20 | 2,761 | 191 | 0 | measured |
| **Total** | **330** | **20,225** | **1,240** | **931** | **measured** |

All matrices advance the production simulation and shared vehicle AI; none uses a mocked combat model. See `foundation-report.md`, `rotorcraft-report.md`, and `submarine-report.md` beside this file.

## Presentation evidence

- The live Proving Grounds showed the tactical minimap in the production renderer with range/sweep/contact layers and zero browser warnings.
- `/instruments.html` exercised eight states: interceptor cruise, strike-jet afterburner, Shrike spool, Condor team radar, Barracuda sonar, dead sensors, ECM jam, and missile inbound.
- The flight plate loaded the bundled PixelLab gunmetal dial and rendered live DOM values for needle speed, digital speed/percentage, compass heading, four elevation pips, radar/sonar source and range, track count, jam/dead state, and missile danger.
- Desktop and 1024×650 checks had no horizontal overflow. The Unified Harness `RDR Instruments` tab lazy-loaded the same standalone page, hid unrelated side panels, retained global navigation, and logged no errors or warnings.
- The production bundle emits `instruments.html`, its JavaScript entry, and the hashed PixelLab PNG asset.

## Automated acceptance

Fresh production gates on 2026-07-21:

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 162 files, 1,947 tests |
| `npm run lint` | PASS (zero errors) |
| `npm run build` | PASS — 159 modules; `instruments.html`, instrument entry chunk, and hashed PixelLab PNG emitted |

Focused radar tests also proved the required red/green cycle for Mountain ridge masking: the new test failed while high aircraft radar crossed the ridge and passed after the theater-specific terrain-height rule landed.
