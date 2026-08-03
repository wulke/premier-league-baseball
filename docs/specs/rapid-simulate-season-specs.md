# Specs: Rapid Simulate Season (Backend)

Backend requirements for `GameFactory().rapidSimulateSeason(gwId)`,
`GameWorldFactory(id).advanceCurrentDate(date)`, and the
`POST /api/gameWorld/:gwId/rapid-simulate` endpoint.

| ID | Requirement | Status |
|---|---|---|
| RSS-001 | WHEN `GameFactory().rapidSimulateSeason(gwId)` is called IF no GameWorld exists with that id THE system SHALL reject with a 404-statusCode error before simulating anything | [x] Implemented (PR #104) |
| RSS-002 | WHEN `GameFactory().rapidSimulateSeason(gwId)` is called IF the GameWorld's `config.inProgress` is not `true` OR its `currentDate` is `null` THE system SHALL reject with a 422-statusCode error and simulate nothing | [x] Implemented (PR #104) |
| RSS-003 | WHEN `GameFactory().rapidSimulateSeason(gwId)` is called IF the GameWorld has an active season THE system SHALL repeatedly simulate all eligible games at the current `currentDate` and then advance `currentDate` to the next distinct `scheduledDate` among remaining non-`COMPLETED` games, until no non-`COMPLETED` game with a `scheduledDate` remains | [x] Implemented (PR #104) |
| RSS-004 | WHEN `GameFactory().rapidSimulateSeason(gwId)` completes (success or failure) THE system SHALL NOT call `GameWorldFactory.newSeason()` | [x] Implemented (PR #104) |
| RSS-005 | WHEN an iteration of the rapid-simulate loop resolves zero games IF non-`COMPLETED` games with a `scheduledDate` at or before the current `currentDate` still remain THE system SHALL abort with a 422-statusCode error identifying the blocking date, leaving every prior iteration's already-committed results unchanged | [x] Implemented (PR #104) |
| RSS-006 | WHEN `GameFactory().rapidSimulateSeason(gwId)` completes successfully THE system SHALL return `daysAdvanced` together with the union of every iteration's `simulated` and `skipped` game lists | [x] Implemented (PR #104) |
| RSS-007 | WHEN `POST /api/gameWorld/:gwId/rapid-simulate` is called IF `process.env.ENABLE_DEV_TOOLS` is not exactly `'true'` THE system SHALL respond 404, identical to a nonexistent route | [x] Implemented (PR #104) |
| RSS-008 | WHEN `GameWorldFactory(id).advanceCurrentDate(date)` is called IF `date` is not strictly after the GameWorld's current `currentDate` THE system SHALL reject with a 422-statusCode error and leave `currentDate` unchanged | [x] Implemented (PR #104) |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/rapid-simulate-season.md`
- Gherkin: `test/bdd/features/rapid-simulate-season.feature`
- Tests: `test/db/domain/game.test.ts`, `test/db/domain/game-world.test.ts` (new cases)
- Code: `src/db/domain/game.ts` (`GameFactory.rapidSimulateSeason`), `src/db/domain/game-world.ts` (`GameWorldFactory.advanceCurrentDate`), `src/api/handlers.ts`, `src/api/router.ts`, `src/api/endpoints.ts`
