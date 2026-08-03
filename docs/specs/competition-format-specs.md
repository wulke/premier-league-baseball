# Specs: Competition Format Config

Backend requirements for the `CompetitionFormat` config type and its resolution (`src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| CFG-001 | WHEN resolving a Division's competition format THE system SHALL use `divisionConfig.format` if present, otherwise fall back to `leagueConfig.format` | [x] → #51 |
| CFG-002 | WHEN a `CompetitionFormat`'s `structure` is `ROUND_ROBIN` THE system SHALL disallow a `seeding` value being set (type-level discriminated union) | [x] → #51 |
| CFG-003 | WHEN a `CompetitionFormat`'s `structure` is `KNOCKOUT` THE system SHALL require a `seeding` value of `FIXED` or `REDRAW` | [x] → #51 |
| CFG-004 | WHEN the default League and League Cup configs are constructed THE system SHALL reference the named shared constants `STANDARD_LEAGUE_FORMAT` and `STANDARD_CUP_FORMAT` rather than hand-authored inline arrays | [x] → #51 |
| CFG-005 | WHEN a League expresses multiple ordered phases THE system SHALL group its divisions under a `Stage` (`{ id, name, divisions }`) on `LeagueConfig.stages[]`, whose array order is the phase sequence, alongside the legacy `divisions[]` | [x] → #85 |
| CFG-006 | WHEN a division's format `structure` is `SWISS` THE system SHALL carry `gamesPerTeam` and partitioning `qualificationTiers[]` and SHALL NOT carry `legs`/`seriesLength`/`seeding` (type-level discriminated union) | [x] → #85 |
| CFG-007 | WHEN a division is seeded from another stage's output THE system SHALL declare it via a `seedingSelection` discriminated union on the consuming division (`TOP_N_PER_DIVISION` / `BEST_OF_REST` / `TIERED_RANK`), referencing its source by id only | [x] → #85 |
| CFG-008 | WHEN divisions run in parallel conferences (e.g. AL/NL) THE system SHALL carry an optional `conference` producer label on `DivisionConfig` (not a node or Stage) | [x] → #85 |
| CFG-009 | WHEN a best-of-N series decides a knockout tie THE system SHALL accept a per-division `seriesLength` of `Bo1` / `Bo3` / `Bo5` / `Bo7` | [x] → #85 |
| CFG-010 | WHEN reusable competition configs are authored THE system SHALL house them in a named `LeagueTemplates` registry decoupled from `GameWorldType`, with team pools in `TeamPools` and runnable bundles in `DefaultWorlds` | [x] → #85 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> CFG-005..010 are the **generalized multi-stage extension** (decision record [#78](https://github.com/wulke/premier-league-baseball/issues/78), tickets #79-#85). They extend the #36 surface additively: `LeagueConfig.divisions` stays (PL/Cup) alongside the new `stages[]`; the `seriesLength` → `winsToAdvance` rename, the drop of league-level `format` + `resolveCompetitionFormat`, and the migration of the live configs / create path onto `stages` are #87's run-path work — tracked explicitly on #87.

## Traceability

- LLD: `docs/llds/competition-format.md`
- Decision record: [#36](https://github.com/wulke/premier-league-baseball/issues/36)
- Code: `src/api/models.ts` (`CompetitionFormat`, `STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`, `resolveCompetitionFormat`, `LeagueConfig`, `DivisionConfig`, `Stage`, `SeedingSelection`, `SwissTier`, `LeagueTemplates`, `TeamPools`, `DefaultWorlds`)
