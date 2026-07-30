# Specs: Contract Schema & Roster Generation

Backend requirements for the `Contract` model, roster size constraints, and roster generation at Team
creation (`src/db/model/`, `src/db/domain/player.ts`, `src/db/domain/team.ts`).

| ID | Requirement | Status |
|---|---|---|
| PCON-001 | WHEN a Team is created THE system SHALL generate a roster with a headcount randomized within [20, 30] Players | [ ] |
| PCON-002 | WHEN a roster is generated THE system SHALL allocate positions proportionally (~40% Pitcher, remainder across the 8 fielding positions) rather than via a hardcoded per-position template | [ ] |
| PCON-003 | WHEN a Player's attributes are generated as part of initial roster generation THE system SHALL roll every scalar rating, `positions` map entry, and `pitches` entry uniform-random with no position-appropriate skew | [ ] |
| PCON-004 | WHEN a Player is generated as part of initial roster generation THE system SHALL auto-issue one Contract with `startYear = GameWorld.year` and `endYear = startYear` | [ ] |
| PCON-005 | WHEN a Team's roster headcount falls outside [20, 30] THE system SHALL NOT block Team creation or `newSeason()` — enforcement is deferred | [D] |
| PCON-006 | WHEN a Contract's `endYear` is reached THE system SHALL NOT auto-trigger free-agency or renewal — `endYear` is descriptive only in v1 | [D] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/player-contracts-roster.md`
- Decision record: [#63](https://github.com/wulke/premier-league-baseball/issues/63), [#64](https://github.com/wulke/premier-league-baseball/issues/64)
- Code: *(not yet implemented — this map is planning-only)* `src/db/model/` (`Contract`), `src/db/domain/player.ts` (`PlayerFactory`), `src/db/domain/team.ts` (`TeamFactory.create`)
