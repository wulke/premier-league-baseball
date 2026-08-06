# Specs: Competition Format Config

Backend requirements for the `CompetitionFormat` config type and its resolution (`src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| CFG-001 | WHEN a League config is authored THE system SHALL declare its competition format on every `DivisionConfig`, with no league-level fallback | [x] → #163 |
| CFG-002 | WHEN a `CompetitionFormat`'s `structure` is `ROUND_ROBIN` THE system SHALL disallow a `seeding` value being set (type-level discriminated union) | [x] → #51 |
| CFG-003 | WHEN a `CompetitionFormat`'s `structure` is `KNOCKOUT` THE system SHALL require a `seeding` value of `FIXED` or `REDRAW` | [x] → #51 |
| CFG-004 | WHEN the default League and League Cup configs are constructed THE system SHALL reference the named shared constants `STANDARD_LEAGUE_FORMAT` and `STANDARD_CUP_FORMAT` rather than hand-authored inline arrays | [x] → #51 |
| CFG-005 | WHEN a League expresses ordered phases THE system SHALL group every division under `LeagueConfig.stages[]` (`{ id, name, divisions }`), whose array order is the phase sequence | [x] → #163 |
| CFG-006 | WHEN a division's format `structure` is `SWISS` THE system SHALL carry `gamesPerTeam` and partitioning `qualificationTiers[]` and SHALL NOT carry `legs`/`winsToAdvance`/`seeding` (type-level discriminated union) | [x] → #85 |
| CFG-007 | WHEN a division is seeded from another stage's output THE system SHALL declare it via a `seedingSelection` discriminated union on the consuming division (`TOP_N_PER_DIVISION` / `BEST_OF_REST` / `TIERED_RANK`), referencing its source by id only | [x] → #85 |
| CFG-008 | WHEN divisions run in parallel conferences (e.g. AL/NL) THE system SHALL carry an optional `conference` producer label on `DivisionConfig` (not a node or Stage) | [x] → #85 |
| CFG-009 | WHEN a best-of-N series decides a knockout tie THE system SHALL accept a per-division `winsToAdvance` of `Bo1` / `Bo3` / `Bo5` / `Bo7` | [x] → #85 |
| CFG-010 | WHEN reusable competition configs are authored THE system SHALL house them in a named `LeagueTemplates` registry decoupled from `GameWorldType`, with team pools in `TeamPools` and runnable bundles in `DefaultWorlds` | [x] → #85 |
| CFG-011 | WHEN validating a League config THE system SHALL require every division to declare exactly one team source: non-empty `defaultTeams` XOR `seedingSelection` | [x] → #163 |
| CFG-012 | WHEN validating stages and cross-stage seeding THE system SHALL require non-empty unique stage ids and each `fromStage` to resolve to a strictly-prior stage | [x] → #163 |
| CFG-013 | WHEN validating a League config with one or more divisions THE system SHALL require exactly one `isTopTier` division and require it to be in the final stage | [x] → #163 |
| CFG-014 | WHEN validating a League config THE system SHALL require every division to declare a `format` | [x] → #163 |
| CFG-015 | WHEN validating a League config THE system SHALL reject a SWISS division that declares `seedingSelection` | [x] → #163 |
| CFG-016 | WHEN validating a League config THE system SHALL reject a `TWO_LEG` format whose `winsToAdvance` is not `Bo1` | [x] → #163 |
| CFG-017 | WHEN validating a `TIERED_RANK` selection THE system SHALL require its prior source stage to contain a SWISS division with the selected tier id | [x] → #163 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

> #163 completes the generalized config migration: `stages[]` is the sole League shape, formats are per-division, and `validateLeagueConfig` applies CFG-011..017 before persistence.

## Traceability

- LLD: `docs/llds/competition-format.md`
- Decision record: [#36](https://github.com/wulke/premier-league-baseball/issues/36)
- Code: `src/api/models.ts` (`CompetitionFormat`, `STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`, `validateLeagueConfig`, `LeagueConfig`, `DivisionConfig`, `Stage`, `SeedingSelection`, `SwissTier`, `LeagueTemplates`, `TeamPools`, `DefaultWorlds`)
