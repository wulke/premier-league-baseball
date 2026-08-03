# Specs: League "Today" Snapshot API

Backend requirements for the League-level rolling-window snapshot endpoint
(`GET /api/league/:leagueId/today`, `src/api/handlers.ts`, `src/db/domain/league.ts`).

| ID | Requirement | Status |
|---|---|---|
| TODAY-001 | WHEN GET /api/league/:leagueId/today is called IF no League with that id exists THE system SHALL reject the request | [ ] |
| TODAY-002 | WHEN GET /api/league/:leagueId/today is called IF the League's GameWorld has no `currentDate` configured THE system SHALL reject the request with a 422 | [ ] |
| TODAY-003 | WHEN GET /api/league/:leagueId/today is called THE system SHALL include COMPLETED games whose `scheduledDate` falls within `[currentDate-3days, currentDate]` and exclude COMPLETED games outside that range | [ ] |
| TODAY-004 | WHEN GET /api/league/:leagueId/today is called THE system SHALL include SCHEDULED and IN_PROGRESS games whose `scheduledDate` is `<= currentDate+3days`, with no lower bound | [ ] |
| TODAY-005 | WHEN GET /api/league/:leagueId/today is called THE system SHALL return the games sorted ascending by `scheduledDate` | [ ] |
| TODAY-006 | WHEN GET /api/league/:leagueId/today is called IF the League has no Divisions, no current-year DivisionSeasons, or no linked games THE system SHALL return an empty array | [ ] |
| TODAY-007 | WHEN GET /api/league/:leagueId/today is called THE system SHALL shape each game as `TeamSeasonGame` (gameId, scheduledDate, homeTeamId/Name, awayTeamId/Name, divisionId/Name, roundLabel, homeTeamResult, awayTeamResult, status), deduplicated per game, using the same bye/round-label derivation as `GetTeamSchedule` | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/league-today.md`
- UI sibling specs: `docs/specs/league-today-ui-specs.md`
- Decision record: [#101](https://github.com/wulke/premier-league-baseball/issues/101)
- Code: `src/api/endpoints.ts` (`GetLeagueToday`), `src/api/handlers.ts` (`getLeagueToday`), `src/db/domain/league.ts` (`LeagueFactory.getToday`)
