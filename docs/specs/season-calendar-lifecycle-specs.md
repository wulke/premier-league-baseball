# Specs: Season Calendar Lifecycle

Requirements for the `League`-scoped `cutover()`/`start()` season lifecycle, `GameWorld.currentDate`
bootstrapping, the derived `GameWorld.config.inProgress`, and the per-League fix to
`TeamFactory.getSchedule()` / `TeamSeasonCalendar`.

| ID | Requirement | Status |
|---|---|---|
| SCL-001 | WHEN a new `League` is created THE system SHALL initialize `League.year` to the parent `GameWorld.year` and `League.status` to `'CUTOVER'` | [x] Implemented → #116 |
| SCL-002 | WHEN `LeagueFactory(id).cutover()` is called IF `League.status` is not `'IN_SEASON'` OR the League's current season is not complete (`isSeasonComplete(league.year)`) THE system SHALL reject with a 422-statusCode error and leave the League unchanged; OTHERWISE THE system SHALL increment `League.year` by 1 and set `League.status` to `'CUTOVER'` | [ ] Active |
| SCL-003 | WHEN `LeagueFactory(id).start()` is called IF `League.status` is not `'CUTOVER'` THE system SHALL reject with a 422-statusCode error and generate nothing | [ ] Active |
| SCL-004 | WHEN `LeagueFactory(id).start()` is called IF any Division with a configured `schedulingConfig` has a `startDate` on or before the GameWorld's current `currentDate` (when non-null) THE system SHALL reject with a 422-statusCode error identifying the offending Division and generate nothing for any Division | [ ] Active |
| SCL-005 | WHEN `LeagueFactory(id).start()` succeeds THE system SHALL generate each Division's season (`DivisionSeason` + `Game` rows, existing round-robin/knockout/byes/two-leg logic unchanged) for `League.year`, and set `League.status` to `'IN_SEASON'` | [ ] Active |
| SCL-006 | WHEN `LeagueFactory(id).start()` succeeds IF the GameWorld's `currentDate` is `null` THE system SHALL set it to the minimum `schedulingConfig.startDate` among this League's Divisions that have one configured; Divisions without `schedulingConfig` SHALL NOT be considered and SHALL NOT gate this computation; IF no Division in this League has `schedulingConfig` THE system SHALL leave `currentDate` as `null` | [ ] Active |
| SCL-007 | WHEN `LeagueFactory(id).start()` succeeds IF the GameWorld's `currentDate` is already non-null THE system SHALL leave it unchanged | [ ] Active |
| SCL-008 | WHEN `League.status` transitions via `cutover()` or `start()` THE system SHALL recompute `GameWorld.config.inProgress` as `true` iff at least one sibling League under the same GameWorld has `status === 'IN_SEASON'` | [ ] Active |
| SCL-009 | WHEN `LeagueFactory(id).start()` generates a Division's season THE system SHALL use `League.year` as that season's year, and NOT `GameWorld.year` | [ ] Active |
| SCL-010 | WHEN `TeamFactory(id).getSchedule(gwId, leagueId?)` resolves `DivisionSeason` rows for a team THE system SHALL use each Division's own parent League's `year`, not `GameWorld.year` | [ ] Active |
| SCL-011 | WHEN `TeamFactory(id).getSchedule()` builds its response THE system SHALL omit a top-level `year` field and SHALL include a `year` field on each `TeamSeasonGame`, sourced from that game's own `DivisionSeason`/League | [ ] Active |
| SCL-012 | WHEN the `League.year`/`League.status` migration runs against an existing League THE system SHALL backfill `year = GameWorld.year` for every League, and `status = 'IN_SEASON'` if that League has any existing `DivisionSeason` row (any year), otherwise `status = 'CUTOVER'` | [x] Implemented → #116 |
| SCL-013 | WHEN `GameFactory().simulateBatch`/`rapidSimulateSeason` walk reachable games for a GameWorld THE system SHALL continue to consider all Leagues under that GameWorld regardless of individual `League.status`, unchanged from current behavior | [ ] Active |
| SCL-014 | WHEN `AppHeader`'s `canBatch` guard evaluates THE system SHALL continue to require `Boolean(gw?.config?.inProgress && gw.currentDate)`, unchanged in shape (only the source of `config.inProgress` changes, per SCL-008) | [ ] Active |
| SCL-015 | WHEN `POST /api/league/:leagueId/season/cutover` is called THE system SHALL invoke `LeagueFactory(leagueId).cutover()` and return its result, propagating its error statusCodes unchanged | [ ] Active |
| SCL-016 | WHEN `POST /api/league/:leagueId/season/start` is called THE system SHALL invoke `LeagueFactory(leagueId).start()` and return its result, propagating its error statusCodes unchanged | [ ] Active |
| SCL-017 | WHEN `PATCH /api/division/:divisionId/config` is called with a `schedulingConfig` update IF the Division's parent League's `status` is not `'CUTOVER'` THE system SHALL reject with a 422-statusCode error and leave the config unchanged | [ ] Active |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/season-calendar-lifecycle.md`
- Gherkin: `test/bdd/features/season-calendar-lifecycle.feature` (new)
- Code: `src/db/model/league.ts`, `src/db/domain/league.ts`, `src/db/domain/game-world.ts`, `src/db/domain/team.ts`, `src/api/models.ts`, `src/api/endpoints.ts`, `src/api/handlers.ts`, `src/api/router.ts`
