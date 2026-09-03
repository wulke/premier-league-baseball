# Specs: Next-Game Bullpen Designations

| ID | Requirement | Status |
|---|---|---|
| GBULL-001 | WHEN a team has one or more scheduled games THE system SHALL return only its earliest scheduled game, ordered by scheduled date then game ID; IF it has none THE system SHALL return no next game. | [x] → #243 |
| GBULL-002 | WHEN the next-game lineup is read THE system SHALL materialize or reuse that game's per-game lineup through `snapshotForGame` and return its canonical lineup card. | [x] → #243 |
| GBULL-003 | WHEN a complete valid next-game entry set is saved for a scheduled game THE system SHALL replace only that snapshot's entries after applying the applicable match rules and return the canonical card. | [x] → #243 |
| GBULL-004 | IF a next-game save is incomplete, invalid, contains a non-roster player, or targets a game not involving the team THE system SHALL reject it without partially changing the snapshot. | [x] → #243 |
| GBULL-005 | IF the target game is `IN_PROGRESS` or `COMPLETED` THE system SHALL reject a next-game lineup save and preserve its snapshot. | [x] → #243 |
| GBULL-006 | WHEN the Lineup page's Bullpen tab has a next game THE system SHALL display its starting-pitcher, active-bullpen, and bench slots, offer only primary-position pitchers for starting-pitcher/active-bullpen slots and current non-pitcher bench occupants for bench slots, render selectors only for `GameWorld.managedTeamId` while the game is scheduled, and PATCH the complete snapshot on save. | [x] → #243 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
