# Specs: Lineup Read API

| ID | Requirement | Status |
|---|---|---|
| LREAD-001 | WHEN `TeamFactory(teamId).getLineup()` reads a team with an active lineup THE system SHALL return its STARTER entries ordered by batting order and its BENCH and BULLPEN entries as ID-only pools | [x] → #199 |
| LREAD-002 | WHEN composing an active-lineup read THE system SHALL derive `startingPitcherId` from the unique STARTER entry assigned `Pitcher` and SHALL NOT read a stored starting-pitcher field | [x] → #199 |
| LREAD-003 | WHEN the active lineup was generated with DH disabled THE system SHALL expose nine starters; WHEN it was generated with DH enabled THE system SHALL expose ten starters including its null-position DH entry | [x] → #199 |
| LREAD-004 | WHEN a client requests `GET /api/team/:teamId/lineup` THE system SHALL return the active-lineup card; IF an optional `gwId` does not own that team THE system SHALL return 404 | [x] → #199 |
| LREAD-005 | WHEN a client requests a game-scoped lineup IF `:teamId` is neither the game's home nor away team THE system SHALL return 404 and SHALL NOT materialize a `Lineup(gameId)` snapshot for that team | [x] → #354 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
