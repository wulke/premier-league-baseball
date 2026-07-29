# Specs: Competition Format Config

Backend requirements for the `CompetitionFormat` config type and its resolution (`src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| CFG-001 | WHEN resolving a Division's competition format THE system SHALL use `divisionConfig.format` if present, otherwise fall back to `leagueConfig.format` | [ ] |
| CFG-002 | WHEN a `CompetitionFormat`'s `structure` is `ROUND_ROBIN` THE system SHALL disallow a `seeding` value being set (type-level discriminated union) | [ ] |
| CFG-003 | WHEN a `CompetitionFormat`'s `structure` is `KNOCKOUT` THE system SHALL require a `seeding` value of `FIXED` or `REDRAW` | [ ] |
| CFG-004 | WHEN the default League and League Cup configs are constructed THE system SHALL reference the named shared constants `STANDARD_LEAGUE_FORMAT` and `STANDARD_CUP_FORMAT` rather than hand-authored inline arrays | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/competition-format.md`
- Decision record: [#36](https://github.com/wulke/premier-league-baseball/issues/36)
- Code: `src/api/models.ts` (`CompetitionFormat`, `LeagueConfig`, `DivisionConfig`, `DefaultLeagues`)
