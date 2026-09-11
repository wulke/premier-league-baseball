# Specs: Simulate Game

Backend requirements for single-game and batch game simulation (`GameFactory(id).simulate()` and `GameFactory().simulateBatch(gwId, endDate)` in `src/db/domain/game.ts`, exposed via `src/api/handlers.ts`). Score production is delegated to the swappable `SimulationEngine` strategy (`src/db/domain/simulation/`, #190) — the engine owns *what the score is*, never *whether/how it is written.

| ID | Requirement | Status |
|---|---|---|
| SIM-001 | WHEN the player simulates a SCHEDULED game by id IF scheduledDate ≤ GameWorld currentDate THE system SHALL set status COMPLETED and populate both homeTeamResult and awayTeamResult with random integers | [x] |
| SIM-002 | WHEN the player simulates a game by id IF no game with that id exists THE system SHALL reject with a 404 error indicating the game was not found | [x] |
| SIM-003 | WHEN the player simulates a game by id IF the game's status is COMPLETED THE system SHALL reject with a 422 error indicating the game has already been completed, leaving its result unchanged | [x] |
| SIM-004 | WHEN the player simulates a game by id IF the game's status is IN_PROGRESS THE system SHALL reject with a 422 error indicating the game cannot be simulated in its current status | [x] |
| SIM-005 | WHEN the player simulates a SCHEDULED game by id IF scheduledDate is after the GameWorld's currentDate THE system SHALL reject with a 422 error indicating the game is scheduled for a future date | [x] |
| SIM-006 | WHEN the player simulates a SCHEDULED game with a scheduledDate IF the GameWorld's currentDate cannot be resolved (no DivisionSeasonGame link, or GameWorld currentDate is null) THE system SHALL reject with a 422 error indicating the GameWorld has no current date configured | [x] |
| SIM-007 | WHEN the player simulates a SCHEDULED game by id IF the game has no scheduledDate THE system SHALL bypass the current-date guard and simulate it directly | [x] |
| SIM-008 | WHEN the player triggers batch simulation for a GameWorld IF no GameWorld with that id exists THE system SHALL reject with a 404 error indicating the GameWorld was not found | [x] |
| SIM-009 | WHEN the player triggers batch simulation for a GameWorld IF the GameWorld's currentDate is null AND no endDate was provided THE system SHALL reject with a 422 error indicating the GameWorld has no current date configured | [x] |
| SIM-010 | WHEN the player triggers batch simulation for a GameWorld with an endDate IF endDate is after the GameWorld's currentDate THE system SHALL reject with a 422 error indicating the endDate exceeds the GameWorld's current date | [x] |
| SIM-011 | WHEN the player triggers batch simulation for a GameWorld THE system SHALL simulate every reachable game whose status is SCHEDULED and whose scheduledDate is on or before the effective end date (or which has no scheduledDate), setting status COMPLETED and populating random homeTeamResult/awayTeamResult, and return all of them in the response's simulated list | [x] |
| SIM-012 | WHEN the player triggers batch simulation IF a reachable game's status is already COMPLETED THE system SHALL skip it and return it in the response's skipped list with reason "already completed" | [x] |
| SIM-013 | WHEN the player triggers batch simulation IF a reachable game's status is IN_PROGRESS THE system SHALL skip it and return it in the response's skipped list with reason "game in progress" | [x] |
| SIM-014 | WHEN the player triggers batch simulation IF a reachable game's scheduledDate is after the effective end date THE system SHALL skip it and return it in the response's skipped list with reason "future date" | [x] |
| SIM-015 | WHEN a database error occurs while writing batch simulation results THE system SHALL roll back the transaction, leaving all games in the batch unchanged with no result values written | [x] |
| SIM-016 | WHEN the system simulates a game, singly or in batch THE system SHALL produce that game's homeTeamResult and awayTeamResult by delegating to the configured SimulationEngine strategy, with guards, the transaction, and completion hooks remaining in GameFactory | [x] → #190 |
| SIM-017 | WHEN a game or batch is simulated with a provided seed THE system SHALL derive each game's RNG stream deterministically from the seed and the gameId, so the same seed reproduces the same scores across runs and machines, independent of loop order and skipped games | [x] → #190 |
| SIM-018 | WHEN a game is simulated without a provided seed THE system SHALL draw a fresh seed per game (current time mixed with gameId) so outcomes vary between simulations and no two games in a batch share a seed | [x] → #190 |
| SIM-019 | WHEN the player triggers Simulate Today for a GameWorld and every reachable game scheduled on or before currentDate has completed THE system SHALL advance GameWorld currentDate to the earliest later scheduled date among remaining reachable non-COMPLETED games, return that date as nextDate, and leave currentDate unchanged with nextDate null when no later scheduled game exists | [ ] → #293 |
| SIM-020 | WHEN the player triggers Simulate Today IF a reachable non-COMPLETED game scheduled on or before currentDate remains after batch simulation THE system SHALL leave currentDate unchanged and return nextDate null | [ ] → #293 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- Gherkin: `test/bdd/features/simulate-game.feature` (`@spec` tag per scenario)
- Step definitions: `test/bdd/steps/simulate-game.steps.test.ts`
- Code: `src/api/handlers.ts` (`simulateGame`, `simulateBatchGames`), delegating to `src/db/domain/game.ts` (`GameFactory`)
- Engine seam (#190, `SIM-016..018`): `src/db/domain/simulation/` — `engine.ts` (interface, `resolveSimulationEngine`), `seed.ts` (`deriveGameSeed`), `random-engine.ts` (`RandomSimulationEngine`). Golden-master/determinism scenarios bind via domain-direct step definitions (the seed is a domain-only parameter — handlers pass nothing, per LLD e16); they land with the test stage on `feat/190-engine-strategy-seam`.
