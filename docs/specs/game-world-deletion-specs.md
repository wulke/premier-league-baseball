# Specs: GameWorld Deletion (Backend)

Backend requirements for `GameWorldFactory(id).delete()` and the `DELETE /api/gameWorld/:gwId`
endpoint.

| ID | Requirement | Status |
|---|---|---|
| GWD-001 | WHEN `GameWorldFactory(id).delete()` is called IF no GameWorld exists with that id THE system SHALL reject with a 404-statusCode error before modifying any rows | [x] → #99 |
| GWD-002 | WHEN `GameWorldFactory(id).delete()` is called IF the GameWorld exists THE system SHALL delete the GameWorld row together with every League, Team, Player, Division, DivisionSeason, Contract, PlayerGameStats, and SeasonResult it owns, and any Game reachable only through its DivisionSeasons | [x] → #99 |
| GWD-003 | WHEN any step of the GameWorld delete cascade fails THE system SHALL roll back the entire transaction and reject with the original error, leaving the GameWorld and all related rows unchanged | [x] → #99 |
| GWD-004 | WHEN `GameWorldFactory(id).delete()` is called IF the GameWorld's `config.inProgress` is `true` THE system SHALL delete it the same as any other GameWorld, with no additional restriction | [x] → #99 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/game-world-deletion.md`
- Gherkin: `test/bdd/features/game-world-deletion.feature`
- Tests: `test/db/domain/game-world.test.ts` (new cases)
- Code: `src/db/domain/game-world.ts` (`GameWorldFactory.delete`), `src/api/handlers.ts` (`deleteGameWorld`), `src/api/router.ts`, `src/api/endpoints.ts`
