# Specs: League "Today" Snapshot API

Backend requirements for the League-level rolling-window snapshot endpoint
(`GET /api/league/:leagueId/today`, `src/api/handlers.ts`, `src/db/domain/league.ts`).

**Superseded and removed by [#326](https://github.com/wulke/premier-league-baseball/issues/326).**
`GET /api/league/:leagueId/today`, `LeagueFactory.getToday`, and their tests no longer exist in
the codebase — replaced by the team-level, cross-competition, arbitrary-range query in
`docs/specs/game-world/home-calendar-strip-specs.md` (`CALW-001`..). Retained below as the
historical record of the pre-#326 behavior; rows are left `[x]` rather than relabeled, matching
how this repo records other supersessions (e.g. `ROST-004`/`XFER-022`).

**Slated for reinstatement, unmodified, by [#321](https://github.com/wulke/premier-league-baseball/issues/321)**
as the data source for the new League Dashboard's Today matchup banner (`docs/specs/league/league-dashboard-ui-specs.md`,
`LDASH-003`) — see `docs/llds/league/league-dashboard-ui.md`'s "Reinstatement dependency" note.
Rows below stay `[x]` (historical) until the Code stage of that implementation issue actually
restores the endpoint.

| ID | Requirement | Status |
|---|---|---|
| TODAY-001 | WHEN GET /api/league/:leagueId/today is called IF no League with that id exists THE system SHALL reject the request | [x] → #110 |
| TODAY-002 | WHEN GET /api/league/:leagueId/today is called IF the League's GameWorld has no `currentDate` configured THE system SHALL reject the request with a 422 | [x] → #110 |
| TODAY-003 | WHEN GET /api/league/:leagueId/today is called THE system SHALL include COMPLETED games whose `scheduledDate` falls within `[currentDate-3days, currentDate]` and exclude COMPLETED games outside that range | [x] → #110 |
| TODAY-004 | WHEN GET /api/league/:leagueId/today is called THE system SHALL include SCHEDULED and IN_PROGRESS games whose `scheduledDate` is `<= currentDate+3days`, with no lower bound | [x] → #110 |
| TODAY-005 | WHEN GET /api/league/:leagueId/today is called THE system SHALL return the games sorted ascending by `scheduledDate` | [x] → #110 |
| TODAY-006 | WHEN GET /api/league/:leagueId/today is called IF the League has no Divisions, no current-year DivisionSeasons, or no linked games THE system SHALL return an empty array | [x] → #110 |
| TODAY-007 | WHEN GET /api/league/:leagueId/today is called THE system SHALL shape each game as `TeamSeasonGame` (gameId, scheduledDate, homeTeamId/Name, awayTeamId/Name, divisionId/Name, roundLabel, homeTeamResult, awayTeamResult, status), deduplicated per game, using the same bye/round-label derivation as `GetTeamSchedule` | [x] → #110 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/league/league-today.md`
- UI sibling specs: `docs/specs/league/league-today-ui-specs.md`
- Decision record: [#101](https://github.com/wulke/premier-league-baseball/issues/101)
- Code: `src/api/endpoints.ts` (`GetLeagueToday`), `src/api/handlers.ts` (`getLeagueToday`), `src/db/domain/league.ts` (`LeagueFactory.getToday`)
