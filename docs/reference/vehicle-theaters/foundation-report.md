# Vehicle Theater Foundation Report

Status: **PASS**

Deterministic seeds: 7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606

| Scenario | Runs |
| --- | ---: |
| route | 60 |
| fixed wing | 50 |
| ground duel | 80 |
| naval | 20 |
| combined arms | 0 |
| **total** | **210** |

## Acceptance evidence

| Gate | Result | Required |
| --- | ---: | ---: |
| Structural violations | 0 | 0 |
| Route failures | 0 | 0 |
| Engagements without contact | 0 | 0 |
| Fixed-wing first contact | 11.5-29.2s | 8-45s |
| Ground/naval first contact | 20-44s | 20-120s |
| Maximum mirrored side win rate | 59.3% | <=70% |

The matrix advances the real simulation at 20 Hz. It uses authored theater routes, bot vehicle control, weapon collisions, and the production telemetry recorder; it is not a mocked combat model.

