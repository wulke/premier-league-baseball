# Specs: Home Calendar Strip — Cross-Competition Date-Range Query

Backend requirements extending the team schedule read API
(`GET /api/team/:teamId/calendar`, `src/api/handlers.ts`, `src/db/domain/team.ts`) with an
optional date-range window and per-game competition tag, so the GameWorld home page can request
one club's games across every competition in a given range. `TSCH-001`..`TSCH-004`
(`docs/specs/manager/team-schedule-read-api-specs.md`) govern the endpoint's unchanged behavior
(team-name resolution, season-year scoping, bye/round-label shape) and are not restated here.

| ID | Requirement | Status |
|---|---|---|
| CALW-001 | WHEN GET /api/team/:teamId/calendar is called WITHOUT `from`/`to` THE system SHALL return the full season's games (per TSCH-001/TSCH-002) together with `seasonStart` and `seasonEnd` | [ ] |
| CALW-002 | WHEN GET /api/team/:teamId/calendar is called IF the team has no games in the GameWorld's current year THE system SHALL return `games: []`, `seasonStart: null`, and `seasonEnd: null` | [ ] |
| CALW-003 | WHEN GET /api/team/:teamId/calendar returns games THE system SHALL tag each game with the `leagueId` and `leagueName` of its owning League, independent of `divisionName` | [ ] |
| CALW-004 | WHEN a returned game is a knockout bye (`awayTeam` null) THE system SHALL preserve the existing `Bye`/no-scoreline handling (TSCH-004) unchanged, whether or not a range was applied | [ ] |
| CALW-005 | WHEN GET /api/team/:teamId/calendar is called WITH `from` and/or `to` values that are not valid `YYYY-MM-DD` strings THE system SHALL NOT raise a validation error, parsing the malformed value as a Date (which matches nothing) rather than throwing | [ ] |
| CALW-006 | WHEN GET /api/team/:teamId/calendar is called WITH `from` sorting after `to` THE system SHALL return `games: []` with no special-cased error | [ ] |
| CALW-007 | WHEN GET /api/team/:teamId/calendar is called WITH only one of `from`/`to` present THE system SHALL treat the range as absent, behaving per CALW-001 | [ ] |
| CALW-008 | WHEN GET /api/team/:teamId/calendar is called WITH both `from` and `to` present THE system SHALL return only games whose `scheduledDate` falls within `[from, to]` inclusive | [ ] |
| CALW-009 | WHEN GET /api/team/:teamId/calendar computes `seasonStart`/`seasonEnd` THE system SHALL derive them as MIN/MAX `scheduledDate` over the team's full, unwindowed current-year games — never over an already-range-filtered set | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — HLD: Game World Home Page Overhaul](../high-level-design.md#hld-game-world-home-page-overhaul)
- LLD: `docs/llds/game-world/home-calendar-strip.md`
- Sibling specs: `docs/specs/game-world/home-calendar-strip-ui-specs.md`; `docs/specs/manager/team-schedule-read-api-specs.md` (`TSCH-001`..`TSCH-004`, referenced not restated)
- Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326)
- Code: `src/api/endpoints.ts` (`GetTeamSchedule`), `src/api/router.ts`, `src/api/handlers.ts` (`getTeamSchedule`), `src/db/domain/team.ts` (`TeamFactory.getSchedule`), `src/api/models.ts` (`TeamSeasonGame`, `TeamSeasonSchedule`) — plus removal of `src/db/domain/league.ts` (`LeagueFactory.getToday`), `src/api/endpoints.ts` (`GetLeagueToday`), its router route and handler
