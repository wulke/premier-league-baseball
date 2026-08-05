# Specs: Multi-stage season run-path (dependent stages)

Backend requirements for simulating a League whose `stages[]` form an ordered, dependent sequence
(group stage → cross-phase seeding → knockout → champion). Implements the **old Champions League**
proving slice (#87): a group stage (round-robin) whose top-N-per-group seed a two-leg knockout
division, runnable to a single champion via the existing simulation + advancement path.

Domain: `src/db/domain/division.ts` (`getSeedTeamIdsForDivision`, `newSeason`),
`src/db/domain/league.ts` (`create`, `start`), `src/db/domain/stage-advancement.ts` (new —
event-driven dependent-stage advance), `src/db/domain/season-result.ts` (`recordSeasonChampionIfMissing`
gate), `src/db/domain/game.ts` (completion hook).

| ID | Requirement | Status |
|---|---|---|
| MSS-001 | WHEN a division has no `seedingSelection` THE system SHALL seed its new season from `DivisionConfig.defaultTeams` | [ ] → #87 |
| MSS-002 | WHEN a division has a `TOP_N_PER_DIVISION` selection THE system SHALL emit its seeds rank-outer (rank 1..topN) then source-stage division declaration order inner, reading each source division's `getStandings` | [ ] → #87 |
| MSS-003 | WHEN a division has a `BEST_OF_REST` or `TIERED_RANK` selection THE system SHALL reject the season start with a domain error (config-surface only — no scheduler this map) | [ ] → #87 |
| MSS-004 | WHEN a multi-stage League is created THE system SHALL stamp each division's config with the enclosing Stage's `stageId`, treating a legacy `divisions[]` config as a single default stage | [ ] → #87 |
| MSS-005 | WHEN a multi-stage League season starts THE system SHALL start only the first stage's divisions | [ ] → #87 |
| MSS-006 | WHEN a game completes in a stage that has a dependent successor THE system SHALL advance the dependent divisions' new seasons once every source-stage division is complete | [ ] → #87 |
| MSS-007 | WHEN cross-stage advancement is evaluated for a dependent division already started this season THE system SHALL no-op | [ ] → #87 |
| MSS-008 | WHEN recording a season champion THE system SHALL write it only if the division's `isTopTier === true`, consulted from both the round-robin and knockout completion paths | [ ] → #87 |
| MSS-009 | WHEN the old Champions League runs end-to-end THE system SHALL progress the group stage to a cross-phase-seeded two-leg knockout decided by a single champion | [ ] → #87 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> Decision record: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → ticket [#87](https://github.com/wulke/premier-league-baseball/issues/87). Implements the run-path for the #79 Stage model, the #80 `TOP_N_PER_DIVISION` seeding arm, and the #81 champion-generalization (the `isTopTier` gate). `BEST_OF_REST` (#84) and `TIERED_RANK` (#95) are config-surface only and rejected at run time (MSS-003) — their schedulers are out of scope for this map. The constrained cross-pool draw fidelity gap (old-CL Ro16 winners-vs-runners-up) is accepted fog; the knockout uses `seeding: 'REDRAW'` (random).

## Traceability

- HLD: [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup)
- LLD: [`docs/llds/multi-stage-season.md`](../llds/multi-stage-season.md)
- Config LLD: [`docs/llds/competition-format.md`](../llds/competition-format.md) (#79–#95 additive surface)
- Gherkin: `test/bdd/features/multi-stage-season.feature`
- Decision records: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87); #79, #80, #81
- Code: `src/db/domain/division.ts`, `src/db/domain/league.ts`, `src/db/domain/stage-advancement.ts` (new), `src/db/domain/season-result.ts`, `src/db/domain/game.ts`
