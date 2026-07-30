# Specs: GameWorld Season Transition

Backend requirements for `GameWorldFactory(id).newSeason()` season rollover behavior.

| ID | Requirement | Status |
|---|---|---|
| GWS-001 | WHEN `GameWorldFactory(id).newSeason()` encounters an error while advancing the GameWorld or starting any League season THE system SHALL roll back the season transition and reject with the original error instead of returning a success-shaped GameWorld payload | [x] → #37 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/game-world-season-transition.md`
- Decision record: [#37](https://github.com/wulke/premier-league-baseball/issues/37)
- Tests: `test/db/domain/game-world.test.ts`
- Code: `src/db/domain/game-world.ts` (`GameWorldFactory.newSeason`)
