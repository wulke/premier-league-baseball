# Specs: GameWorld Home "Today" Section

Frontend requirements for the Today snapshot section on the GameWorld home page
(`src/ui/pages/game-world.tsx`), consuming `GET /api/league/:leagueId/today`.

| ID | Requirement | Status |
|---|---|---|
| TODAYUI-001 | WHEN the GameWorld home page loads IF the season is in progress THE system SHALL fetch GET /api/league/:leagueId/today for each league alongside the existing GetLeague/GetLeagueBracket calls | [x] → #111 |
| TODAYUI-002 | WHEN a league's /today fetch fails or returns non-ok (including a 422 for an unconfigured currentDate) THE system SHALL treat that league as having zero games rather than surfacing an error | [x] → #111 |
| TODAYUI-003 | WHEN at least one league has games in the window THE system SHALL render a "Today" section between the Season section and the Leagues section, with one sub-block per league sorted chronologically within | [x] → #111 |
| TODAYUI-004 | WHEN a league has zero games in the window THE system SHALL omit that league's sub-block from the Today section | [x] → #111 |
| TODAYUI-005 | WHEN no league has any games in the window THE system SHALL omit the Today section entirely | [x] → #111 |
| TODAYUI-006 | WHEN the GameWorld home page loads IF the GameWorld payload reports no `currentDate` THE system SHALL NOT request GET /api/league/:leagueId/today for any league — the request is guaranteed to 422 (TODAY-002) and only produces server-side log noise — and every league SHALL be treated as having zero games (TODAYUI-004/005 omission applies) | [x] → #247 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/league/league-today-ui.md`
- Backend sibling specs: `docs/specs/league/league-today-specs.md`
- Decision record: [#101](https://github.com/wulke/premier-league-baseball/issues/101)
- Code: `src/ui/pages/game-world.tsx`
