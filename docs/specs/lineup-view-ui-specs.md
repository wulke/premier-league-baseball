# Specs: Team Lineup View UI

Frontend requirements for the Lineup tab at `/:gwId/team/:teamId/lineup`, consuming the active
lineup card from `GET /api/team/:teamId/lineup` and roster display identities.

| ID | Requirement | Status |
|---|---|---|
| LINEUI-001 | WHEN the team hub renders THE system SHALL provide a read-only Lineup tab at `/:gwId/team/:teamId/lineup` alongside Calendar and Roster. | [ ] → #200 |
| LINEUI-002 | WHEN an active lineup has DH disabled THE system SHALL render its nine batting starters in order 1 through 9, show each fielding position, and highlight the starting pitcher without rendering a DH row. | [ ] → #200 |
| LINEUI-003 | WHEN an active lineup has DH enabled THE system SHALL render batting starters in order 1 through 9, render the null-position starter as a DH row, and highlight the non-batting starting pitcher. | [ ] → #200 |
| LINEUI-004 | WHEN the active lineup renders THE system SHALL display bench and bullpen pools and SHALL link every starter, reserve, and pitcher row to `/:gwId/player/:playerId` without providing a mutating control. | [ ] → #200 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
