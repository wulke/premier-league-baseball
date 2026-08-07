# Specs: Contract Schema & Roster Generation

Backend requirements for the `Contract` model, roster size constraints, and roster generation at Team
creation (`src/db/model/`, `src/db/domain/player.ts`, `src/db/domain/team.ts`).

| ID | Requirement | Status |
|---|---|---|
| PCON-001 | WHEN a Team is created THE system SHALL generate a roster with a headcount randomized within [20, 30] Players | [x] → #74 |
| PCON-002 | WHEN a roster is generated THE system SHALL allocate positions proportionally (~40% Pitcher, remainder across the 8 fielding positions) rather than via a hardcoded per-position template | [x] → #74 |
| PCON-003 | WHEN a Player's attributes are generated as part of initial roster generation THE system SHALL roll every scalar rating, `positions` map entry, and `pitches` entry uniform-random with no position-appropriate skew | [x] → #74 |
| PCON-004 | WHEN a Player is generated as part of initial roster generation THE system SHALL auto-issue one Contract with `startYear = GameWorld.year` and `endYear = startYear` | [x] → #74 |
| PCON-005 | WHEN a Team's roster headcount falls outside [20, 30] THE system SHALL NOT block Team creation or `newSeason()` — enforcement is deferred | [D] |
| PCON-006 | WHEN a Contract's `endYear` is reached THE system SHALL NOT auto-trigger free-agency or renewal — `endYear` is descriptive only in v1 | [D] |
| PCON-007 | WHEN a Player's team assignment changes after initial generation THE system SHALL update `Player.teamId` and issue/close the corresponding `Contract` as one unit of work, keeping both in sync | [D] |
| PCON-008 | WHEN the database models initialize THE system SHALL define a `Contract` model with `playerId`, `teamId`, `startDate`, and `endDate` as DATE columns, and SHALL NOT define a salary or `value` field in v1 | [x] → #168 |
| PCON-009 | WHEN model associations are applied THE system SHALL expose `Player.hasMany(Contract)` and `Team.hasMany(Contract)` | [x] → #73 |
| PCON-010 | WHEN roster generation needs headcount bounds THE system SHALL export `MIN_ROSTER_SIZE = 20` and `MAX_ROSTER_SIZE = 30` as named constants | [x] → #73 |

`PCON-007` is Deferred, not Active — no code path changes a Player's team after initial generation in
this map (transfers/trades are out of scope); it records the sync obligation for whichever future map
introduces one, per `docs/llds/player-contracts-roster.md`'s Edge Case Probe (e6).

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/player-contracts-roster.md`
- Decision record: [#63](https://github.com/wulke/premier-league-baseball/issues/63), [#64](https://github.com/wulke/premier-league-baseball/issues/64)
- Code: `src/db/model/contract.ts`, `src/db/model/associations.ts`, `src/db/domain/contract.ts`, `src/db/domain/player.ts`, `src/db/domain/team.ts`
