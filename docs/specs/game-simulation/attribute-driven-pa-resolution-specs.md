# Specs: Attribute-Driven PA-Resolution Pipeline

Backend requirements for the second `SimulationEngine` implementation
(`AttributeDrivenSimulationEngine`, `src/db/domain/simulation/`) — attribute-driven plate-appearance
resolution, real baserunner advancement, and `PlayerGameStats` projection over the resulting event
chain, with team score emergent from that projection. Exercised directly against synthetic lineups;
not yet wired into `GameFactory`/`resolveSimulationEngine()` (see [#192](https://github.com/wulke/premier-league-baseball/issues/192)).

| ID | Requirement | Status |
|---|---|---|
| PARP-001 | WHEN the attribute-read seam reads a Player attribute for PA resolution THE system SHALL return the raw stored scalar as `iv` and `0` as `ev`, never a pre-combined effective value | [ ] |
| PARP-002 | WHEN a plate appearance is resolved THE system SHALL produce exactly one of the outcomes {out, 1B, 2B, 3B, HR, BB, SO} by drawing once from a weighted distribution derived from the batter's and pitcher's attribute reads | [ ] |
| PARP-003 | WHEN an attribute differential shifts a PA-outcome weight below zero THE system SHALL floor that weight at zero before normalizing the distribution to sum to 1 | [ ] |
| PARP-004 | WHEN a plate appearance resolves to BB THE system SHALL advance the batter to first and force-advance existing runners only in the standard cascade (first always forced to second; second forced to third only if first was occupied; third forced home only if bases were loaded) | [ ] |
| PARP-005 | WHEN a plate appearance resolves to 1B, 2B, or 3B THE system SHALL place the batter on the corresponding base and advance every existing runner exactly that many bases, scoring any runner advanced past third | [ ] |
| PARP-006 | WHEN a plate appearance resolves to HR THE system SHALL score the batter and every existing runner and clear the bases | [ ] |
| PARP-007 | WHEN a runner, including the batter, transitions bases as a result of a plate appearance THE system SHALL emit one BaserunningEvent per transitioning runner, each with `causedByEventId` set to that plate appearance's PlateAppearanceResolutionEvent | [ ] |
| PARP-008 | WHEN a team's batting order advances across plate appearances THE system SHALL track the order index per `teamId`, continuing without reset across innings and wrapping modulo 9 | [ ] |
| PARP-009 | WHEN a plate appearance resolves to `out` or `SO` THE system SHALL record one out for the batting team's half-inning, ending the half-inning once 3 outs are recorded | [ ] |
| PARP-010 | WHEN a game is simulated THE system SHALL play exactly `matchRules.innings` full innings, both halves in every inning with no early stop when the home team already leads, and SHALL allow a tied final score | [ ] |
| PARP-011 | WHEN a game completes simulation THE system SHALL derive each team's final score as the sum of `R` across that team's projected PlayerGameStats rows, never as an independently drawn value | [ ] |
| PARP-012 | WHEN PlayerGameStats rows are derived for a simulated game THE system SHALL compute them via a single replay of that game's event chain, with no separate resolver for batting versus pitching stats | [ ] |
| PARP-013 | WHEN a runner scores as a result of a plate appearance THE system SHALL credit that plate appearance's batter with one RBI, including when the batter scores themselves on a HR | [ ] |
| PARP-014 | WHEN pitching stats are projected for a simulated game THE system SHALL accrue every out, hit, walk, strikeout, and earned run allowed by the batting team to that half-inning's single starting pitcher, and SHALL increment `outsRecorded` rather than write `IP` | [ ] |
| PARP-015 | WHEN AttributeDrivenSimulationEngine.simulateGame is called with a SyntheticLineup lacking exactly 9 distinct-playerId batting-order entries or a resolvable starting pitcher THE system SHALL throw a plain Error before consuming any RNG state | [ ] |
| PARP-016 | WHEN a game is simulated by AttributeDrivenSimulationEngine THE system SHALL consume exactly one RNG draw per plate appearance and zero further RNG draws for baserunning or stat projection | [ ] |
| PARP-017 | WHEN a game is simulated by AttributeDrivenSimulationEngine with a pinned seed THE system SHALL reproduce an identical event chain and PlayerGameStats projection across runs and machines | [ ] |
| PARP-018 | WHEN persistPlayerGameStats is called a second time for the same (playerId, gameId) THE system SHALL reject the write via the existing PlayerGameStats unique index rather than silently upserting | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Simulation Engine Strategy Seam](../high-level-design.md#hld-simulation-engine-strategy-seam), [`docs/high-level-design-event-grading-reward.md`](../high-level-design-event-grading-reward.md)
- LLD: `docs/llds/game-simulation/attribute-driven-pa-resolution.md`
- Sibling specs: `docs/specs/game-simulation/simulate-game-specs.md` (`SIM-001..020` — the seam this engine plugs into; unaffected by this stage)
- Decision record: [Map: Attribute-driven Simulation Engine (#136)](https://github.com/wulke/premier-league-baseball/issues/136), [#191](https://github.com/wulke/premier-league-baseball/issues/191), [Map: Event, Grading & Reward Architecture (#218)](https://github.com/wulke/premier-league-baseball/issues/218)
- Code: `src/db/domain/simulation/attribute-engine.ts`, `pa-resolver.ts`, `baserunning.ts`, `attribute-read.ts`, `stat-projection.ts`, `events.ts`; `src/db/domain/events/envelope.ts`; `src/db/domain/simulation/engine.ts` (MODIFIED, additive); `src/db/domain/player-game-stats-writer.ts` (MODIFIED, additive); `src/db/model/player-game-stats.ts` (MODIFIED — `outsRecorded` column); `src/api/models.ts` (MODIFIED — `MatchRules.innings`)
