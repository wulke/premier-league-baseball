# Formula Registry

Canonical index of formula contracts. A formula's owner, inputs, output, dependencies, trigger,
and status are maintained here; LLDs explain the surrounding component behavior.

| ID | Formula | Owner | Reads | Writes / Influences | Depends On | Used By | Trigger | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-IVEV-001 | Effective person-attribute read | `src/db/domain/iv-ev-person-attribute.ts` | Person attribute state (`IV`, `EV`, `formWindow`, `ageDiscountMeta`), person-level named Natures, attribute kind, per-attribute aging profile, consumer read policy, read time | A consumer's faded-capacity/form/aggregate input; normally a clamped consumed value | F-IVEV-002, F-IVEV-004 | Future game, manager, scout, and salary formula catalog entries | A consumer requests an attribute read | Implemented |
| F-IVEV-002 | IV-only age discount | `src/db/domain/iv-ev-person-attribute.ts` | Person age, per-attribute aging profile, fixed `ageDiscountMeta` | Decline-only discount in `[floor, 1]` applied to IV before IV/EV capacity composition | None | F-IVEV-001 | F-IVEV-001 evaluates an age-sensitive read | Implemented |
| F-IVEV-003 | Earned delta application | `src/db/domain/iv-ev-person-attribute.ts` | Existing person-attribute state and one grader-attributed signed delta | Adds delta to unbounded EV, appends it to the bounded form ring buffer, and records its identity against repeat application | Future grader/event system (#218) | F-IVEV-001, future event application | A grader accepts one attributable outcome | Implemented |
| F-IVEV-004 | Applicable-Nature resolution | `src/db/domain/iv-ev-person-attribute.ts` | Fixed person-level named Natures, attribute kind, Nature catalog's per-kind multipliers | Fixed expression multiplier for that attribute; a Nature may contribute `>1` to one kind and `<1` to another; `1` when no Nature applies | None | F-IVEV-001 | F-IVEV-001 reads an attribute | Implemented |
| F-PGST-001 | Per-player box-score distribution | Planned `PlayerGameStatsWriter` domain module; LLD `docs/llds/player/player-game-stats-writer.md` | Persisted `SimulationResult` team score; frozen `Lineup`/`LineupEntry` batting order, role, fielding position, and starting pitcher | One `PlayerGameStats` row per participating player: batting and pitching counting columns; batting `SUM(R)` exactly reconciles to each team's engine score | #190 `SimulationEngine` score result | Future player game/season/career stat reads; #191/#192 replaces the fabricated distribution with play-by-play events | A `GameFactory` completion succeeds in either single or batch simulation | Approved design — implementation pending |

## Registry conventions

- **Implemented** entries have a storage-independent domain implementation; they do not imply a
  persistence, API, UI, grader, or simulation consumer is implemented.
- A consumer-specific combination is a catalog policy consumed by `F-IVEV-001`; it is not a new
  storage formula. A new consumer must be added to this registry only if it changes the formula's
  inputs, output, dependency, owner, or trigger.
- The grader/event system owns attribution and delta calculation. It is an external dependency of
  `F-IVEV-003`, not a hidden responsibility of the IV/EV pattern.
