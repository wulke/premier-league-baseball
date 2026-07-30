# Specs: Player Model & Attribute Schema

Backend requirements for the `Player` model and its `attributes` JSON shape (`src/db/model/`, `src/api/models.ts`).

| ID | Requirement | Status |
|---|---|---|
| PATTR-001 | WHEN deriving a Player's primary position THE system SHALL compute it at read-time as the highest-rated entry in `attributes.positions`, never from a stored `position` column | [ ] -> #71 |
| PATTR-002 | WHEN a Player's `attributes.pitches` repertoire is populated THE system SHALL populate it uniformly regardless of position, including non-pitchers | [ ] -> #71 |
| PATTR-003 | WHEN a Player's `teamId` is `null` THE system SHALL treat the Player as a free agent | [ ] -> #71 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/player-attributes.md`
- Decision record: [#60](https://github.com/wulke/premier-league-baseball/issues/60)
- Tests: `test/db/domain/player.test.ts`
- Code: `src/db/model/player.ts`, `src/db/model/associations.ts`, `src/api/models.ts`, `src/db/domain/player.ts`
