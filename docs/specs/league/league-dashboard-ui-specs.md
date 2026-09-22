# Specs: League Dashboard

Frontend requirements for the League Dashboard snapshot page (`src/ui/pages/league-dashboard.tsx`),
mounted at `/:gwId/:leagueId`. Companion to the routing/loader split in
`docs/specs/shell/route-loader-foundation-ui-specs.md` (`STDRT-001`..`STDRT-004`), which governs
where this page sits in the route tree and what its loader fetches.

| ID | Requirement | Status |
|---|---|---|
| LDASH-001 | WHEN the player navigates to `/:gwId/:leagueId` THE system SHALL render the League Dashboard from the dashboard loader's `{ league, today, standings, brackets }` data, rendering nothing further (matching today's `League` page's empty guard) WHEN `league` is `null` | [x] → #297 |
| LDASH-002 | WHEN the League Dashboard's identity header renders THE system SHALL show the league name and type badge, and SHALL show the existing champion banner (`formatLeagueChampionBanner`) in place of the season-status subtitle WHEN the league's champion-producing division has a decided champion, otherwise SHALL show the existing "`<N> division(s)` · season status" subtitle | [x] → #297 |
| LDASH-003 | WHEN the League Dashboard's `today` data (from the reinstated `GetLeagueToday`) contains at least one game THE system SHALL render one horizontal matchup-banner tile per game, in backend chronological order, scoped to this league only; WHEN `today` is empty (including on fetch failure, per `STDRT-004`) THE system SHALL omit the Today section entirely | [x] → #297 |
| LDASH-004 | WHEN a `ROUND_ROBIN` division has standings rows THE League Dashboard SHALL render a condensed standings widget for that division showing at most its top 5 rows via the existing `StandingsTable` presentation, with no new column set | [x] → #297 |
| LDASH-005 | WHEN the League Dashboard renders THE system SHALL show exactly one "View full standings" call-to-action per league section (not one per division) that navigates to `/:gwId/:leagueId/standings` | [x] → #297 |
| LDASH-006 | WHEN a `KNOCKOUT` division has at least one generated round AND at least one round with `status !== 'COMPLETE'` THE League Dashboard SHALL render a bracket teaser for that division showing only the first such round's label and its ties (team names, `TBD` for unresolved slots) | [x] → #297 |
| LDASH-007 | WHEN a `KNOCKOUT` division has at least one generated round AND every round has `status === 'COMPLETE'` THE League Dashboard SHALL render that division's champion name in place of a round teaser, derived from that division's own bracket `champion.teamId`, independent of whether that division is the league's champion-producing division | [x] → #297 |
| LDASH-008 | WHEN a `ROUND_ROBIN` division has no standings rows, OR a `KNOCKOUT` division has no generated bracket rounds, THE League Dashboard SHALL render the existing `TeamRosterGrid` pre-season fallback for that division's teams in place of its condensed widget/teaser, unchanged from today's `league.tsx`/`BracketView` empty-state presentation | [x] → #297 |
| LDASH-009 | WHEN the player clicks a team identity anywhere on the League Dashboard (condensed standings row, bracket teaser tie, roster-grid fallback, or division champion line) THE system SHALL navigate to `/:gwId/team/:teamId`, identical to today's `League` page's team-click behavior | [x] → #297 |
| LDASH-010 | WHEN the player clicks a series tie inside a bracket teaser THE system SHALL NOT expand it to per-game rows and SHALL NOT render `BracketView`'s round-to-round tree connectors — the teaser exposes only the team-identity navigation of `LDASH-009`, not `BracketView`'s interactive affordances | [x] → #297 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: [`docs/llds/league/league-dashboard-ui.md`](../../llds/league/league-dashboard-ui.md)
- Routing/loader sibling: [`docs/specs/shell/route-loader-foundation-ui-specs.md`](../shell/route-loader-foundation-ui-specs.md) — `STDRT-001`..`STDRT-004`
- Reinstated backend dependency (unmodified): [`docs/specs/league/league-today-specs.md`](./league-today-specs.md) — `TODAY-001`..`TODAY-007`
- Decision records: [#297](https://github.com/wulke/premier-league-baseball/issues/297), [#321](https://github.com/wulke/premier-league-baseball/issues/321)
- Gherkin: `test/ui/features/league-dashboard-ui.feature`, bound by `test/ui/steps/league-dashboard-ui.steps.test.tsx`
- Code: `src/ui/pages/league-dashboard.tsx`
