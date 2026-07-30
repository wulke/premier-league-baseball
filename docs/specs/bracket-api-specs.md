# Specs: Bracket State API

Backend requirements for the League-level bracket-state endpoint (`GET /api/league/:leagueId/bracket`,
`src/api/handlers.ts`, `src/db/domain/league.ts`/`division.ts`).

| ID | Requirement | Status |
|---|---|---|
| API-001 | WHEN GET /api/league/:leagueId/bracket is called IF no League with that id exists THE system SHALL reject the request | [ ] → #56 |
| API-002 | WHEN GET /api/league/:leagueId/bracket is called THE system SHALL return, for each division, `divisionId`, `divisionName`, `structure`, an optional `champion` sourced from `SeasonResult`, and `rounds` (empty for `ROUND_ROBIN` divisions) | [ ] → #56 |
| API-003 | WHEN a KNOCKOUT division is mid-redraw (a round has resolved but the next round's games are not yet generated) THE system SHALL return the resolved rounds as `COMPLETE`/`IN_PROGRESS` and the ungenerated round as `PENDING` with null-teamed ties | [ ] → #56 |
| API-004 | WHEN a division's `champion` is present THE system SHALL source it from `SeasonResult.championTeamId` identically for both `ROUND_ROBIN` and `KNOCKOUT` divisions | [ ] → #56 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/bracket-api.md`
- Decision record: [#41](https://github.com/wulke/premier-league-baseball/issues/41)
- Code: `src/api/endpoints.ts` (`GetLeagueBracket`), `src/api/handlers.ts` (`getLeagueBracket`), `src/db/domain/league.ts` (`LeagueFactory.getBracket`), `src/db/domain/division.ts` (`DivisionFactory.getBracket`)
