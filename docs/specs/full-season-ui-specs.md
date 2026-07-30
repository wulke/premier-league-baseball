# Specs: Full-Season UI

Frontend requirements for driving a full season across two concurrent competitions (League +
League Cup) to completion — bracket rendering, champion banner, cross-competition team calendar,
and season-lifecycle display (`src/ui/pages/league.tsx`, `src/ui/pages/game-world.tsx`, `src/ui/routes.tsx`).

| ID | Requirement | Status |
|---|---|---|
| LIFE-001 | WHEN determining whether a season is complete THE UI SHALL derive it from each League's `GetLeagueBracket` champion presence at render time, with no new persisted GameWorld-level state | [ ] |
| UI-001 | WHEN a League's champion-producing division has a `SeasonResult` row for the current year THE League page SHALL show a champion banner on the League identity block in place of the in-progress subtitle, using `🏆 Cup Champion: <team> · Final` for the League Cup and `🏆 <League> Champion: <team> · Table decided` for the round-robin League | [ ] |
| UI-002 | WHEN both Leagues in a GameWorld are decided THE GameWorld hub SHALL show a computed `Season Complete` block naming both champions; WHILE only one is decided THE hub SHALL show that champion and `In progress` for the other | [ ] |
| UI-003 | WHEN a League page's champion-producing division is decided THE UI SHALL disable that page's simulate-triggering control while leaving team-click navigation and bracket expand-on-click interactive | [ ] |
| UI-004 | WHEN a user navigates to a team's calendar THE system SHALL show that team's games across all leagues in the GameWorld at route `/:gwId/team/:teamId/calendar`, with no `leagueId` scoping | [x] |
| UI-005 | WHEN a Division's `structure` is `KNOCKOUT` THE Division card SHALL render `BracketView` grouped by round instead of `StandingsTable` | [x] |
| UI-006 | WHEN a round contains byes THE `BracketView` SHALL group them under a "Byes (N)" subheading listing team names inline | [x] |
| UI-007 | WHEN a tie has more than one leg THE `BracketView` SHALL render one row per series with per-game scores, expandable on click to one row per game | [x] |
| UI-008 | WHEN a KNOCKOUT division has no games yet THE `BracketView` SHALL show the existing "No bracket yet — season not started." empty state with the `TeamRoster` grid; WHEN resolved rounds exist but the next round has not been generated yet THE `BracketView` SHALL show a `Next: <label> — games pending` placeholder row after the resolved rounds | [x] |
| UI-009 | WHEN "Simulate Today" is triggered from `AppHeader` THE system SHALL advance games across both the League and the League Cup in the same batch, with no competition-specific change required | [ ] |
| UI-010 | WHEN a team's calendar includes a knockout bye row THE UI SHALL render the opponent as `Bye`, omit the scoreline, and count that row as played rather than scheduled | [x] → #52 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/full-season-ui.md`
- Decision records: [#34](https://github.com/wulke/premier-league-baseball/issues/34), [#35](https://github.com/wulke/premier-league-baseball/issues/35), [#39](https://github.com/wulke/premier-league-baseball/issues/39), [#40](https://github.com/wulke/premier-league-baseball/issues/40)
- Code: `src/ui/pages/league.tsx`, `src/ui/pages/game-world.tsx`, `src/ui/routes.tsx`, `src/db/domain/team.ts` (`getSchedule`, unchanged)
