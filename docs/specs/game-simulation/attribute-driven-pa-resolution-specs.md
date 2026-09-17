# Specs: Attribute-Driven PA-Resolution Pipeline

Backend requirements for the second `SimulationEngine` implementation
(`AttributeDrivenSimulationEngine`, `src/db/domain/simulation/`) — attribute-driven plate-appearance
resolution, real baserunner advancement, and `PlayerGameStats` projection over the resulting event
chain, with team score emergent from that projection. Exercised directly against synthetic lineups;
not yet wired into `GameFactory`/`resolveSimulationEngine()` (see [#192](https://github.com/wulke/premier-league-baseball/issues/192)).

| ID | Requirement | Status |
|---|---|---|
| PARP-001 | WHEN the attribute-read seam reads a Player attribute for PA resolution THE system SHALL return its persisted `ivEv` pair as separate `iv` and `ev` values, never a pre-combined effective value; legacy attribute JSON without that pair SHALL read as the scalar `iv` and `0` `ev` | [x] → #193 |
| PARP-002 | WHEN a plate appearance is resolved THE system SHALL produce exactly one of the outcomes {out, 1B, 2B, 3B, HR, BB, SO} by drawing once from a weighted distribution derived from the batter's and pitcher's attribute reads | [x] → #191 |
| PARP-003 | WHEN an attribute differential shifts a PA-outcome weight below zero THE system SHALL floor that weight at zero before normalizing the distribution to sum to 1 | [x] → #191 |
| PARP-004 | WHEN a plate appearance resolves to BB THE system SHALL advance the batter to first and force-advance existing runners only in the standard cascade (first always forced to second; second forced to third only if first was occupied; third forced home only if bases were loaded) | [x] → #191 |
| PARP-005 | WHEN a plate appearance resolves to 1B, 2B, or 3B THE system SHALL place the batter on the corresponding base and advance every existing runner exactly that many bases, scoring any runner advanced past third | [x] → #191 |
| PARP-006 | WHEN a plate appearance resolves to HR THE system SHALL score the batter and every existing runner and clear the bases | [x] → #191 |
| PARP-007 | WHEN a runner, including the batter, transitions bases as a result of a plate appearance THE system SHALL emit one BaserunningEvent per transitioning runner, each with `causedByEventId` set to that plate appearance's PlateAppearanceResolutionEvent | [x] → #191 |
| PARP-008 | WHEN a team's batting order advances across plate appearances THE system SHALL track the order index per `teamId`, continuing without reset across innings and wrapping modulo 9 | [x] → #191 |
| PARP-009 | WHEN a plate appearance resolves to `out` or `SO` THE system SHALL record one out for the batting team's half-inning, ending the half-inning once 3 outs are recorded | [x] → #191 |
| PARP-010 | WHEN a game is simulated THE system SHALL play exactly `matchRules.innings` full innings, both halves in every inning with no early stop when the home team already leads, and SHALL allow a tied final score | [x] → #191 |
| PARP-011 | WHEN a game completes simulation THE system SHALL derive each team's final score as the sum of `R` across that team's projected PlayerGameStats rows, never as an independently drawn value | [x] → #191 |
| PARP-012 | WHEN PlayerGameStats rows are derived for a simulated game THE system SHALL compute them via a single replay of that game's event chain, with no separate resolver for batting versus pitching stats | [x] → #191 |
| PARP-013 | WHEN a runner scores as a result of a plate appearance THE system SHALL credit that plate appearance's batter with one RBI, including when the batter scores themselves on a HR | [x] → #191 |
| PARP-014 | WHEN pitching stats are projected for a simulated game THE system SHALL accrue every out, hit, walk, strikeout, and earned run allowed by the batting team to that half-inning's single starting pitcher, and SHALL increment `outsRecorded` rather than write `IP` | [x] → #191 |
| PARP-015 | WHEN AttributeDrivenSimulationEngine.simulateGame is called with a SyntheticLineup lacking exactly 9 distinct-playerId batting-order entries or a resolvable starting pitcher THE system SHALL throw a plain Error before consuming any RNG state | [x] → #191 |
| PARP-016 | WHEN a game is simulated by AttributeDrivenSimulationEngine THE system SHALL consume exactly one RNG draw per plate appearance and zero further RNG draws for baserunning or stat projection | [x] → #191 |
| PARP-017 | WHEN a game is simulated by AttributeDrivenSimulationEngine with a pinned seed THE system SHALL reproduce an identical event chain and PlayerGameStats projection across runs and machines | [x] → #191 |
| PARP-018 | WHEN persistPlayerGameStats is called a second time for the same (playerId, gameId) THE system SHALL reject the write via the existing PlayerGameStats unique index rather than silently upserting | [x] → #191 |
| PARP-019 | WHEN PA resolution consumes an attribute IF its current-game formula is evaluated THE system SHALL use `0.3 × IV + 0.9 × EV` for that input, so equal-IV players with distinct earned effort can produce distinct seed-stable outcomes | [x] → #193 |

`PARP-001` (attribute-read seam pass-through) and `PARP-003` (outcome-weight floor before
normalizing) are internal algorithm invariants of `readAttribute`/`resolvePA` with no
acceptance-level behavior distinct from what `PARP-002` already exercises end to end — bound to
unit tests (`test/db/domain/attribute-read.test.ts`, `test/db/domain/pa-resolver.test.ts`), not
Gherkin. Every other Active row has ≥1 scenario in `test/bdd/features/attribute-driven-pa-resolution.feature`.

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — Simulation Engine Strategy Seam](../high-level-design.md#hld-simulation-engine-strategy-seam), [`docs/high-level-design-event-grading-reward.md`](../high-level-design-event-grading-reward.md)
- LLD: `docs/llds/game-simulation/attribute-driven-pa-resolution.md`
- Gherkin: `test/bdd/features/attribute-driven-pa-resolution.feature` (`@spec:PARP-NNN` tag per scenario; `PARP-001`/`PARP-003` routed to unit tests instead, see above)
- Sibling specs: `docs/specs/game-simulation/simulate-game-specs.md` (`SIM-001..020` — the seam this engine plugs into; unaffected by this stage)
- Decision record: [Map: Attribute-driven Simulation Engine (#136)](https://github.com/wulke/premier-league-baseball/issues/136), [#191](https://github.com/wulke/premier-league-baseball/issues/191), [Map: Event, Grading & Reward Architecture (#218)](https://github.com/wulke/premier-league-baseball/issues/218)
- Code: `src/db/domain/simulation/attribute-engine.ts`, `pa-resolver.ts`, `baserunning.ts`, `attribute-read.ts`, `stat-projection.ts`, `events.ts`; `src/db/domain/events/envelope.ts`; `src/db/domain/simulation/engine.ts` (MODIFIED, additive); `src/db/domain/player-game-stats-writer.ts` (MODIFIED, additive); `src/db/model/player-game-stats.ts` (MODIFIED — `outsRecorded` column); `src/api/models.ts` (MODIFIED — `MatchRules.innings`)
