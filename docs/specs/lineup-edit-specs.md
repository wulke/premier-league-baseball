# Specs: Wholesale Active Lineup Save

| ID | Requirement | Status |
|---|---|---|
| LEDIT-001 | WHEN `PUT /api/team/:teamId/lineup` receives a complete valid roster-member entry set for the managed team THE system SHALL transactionally replace only the declared entry fields on the existing active Lineup row and return the canonical `TeamLineup` card. | [x] → #254 |
| LEDIT-002 | IF a lineup save targets a team other than `managedTeamId` THE system SHALL reject it with 422 and preserve the active card; WHEN `DEV_MODE` is true THE system SHALL bypass that identity gate. | [x] → #254 |
| LEDIT-003 | WHEN the GameWorld has no current date THE system SHALL permit an otherwise valid managed-team lineup save; IF any submitted player is not on that team's current roster THE system SHALL reject it with 422 and the message `player is not on this team's roster`. | [x] → #254 |
| LEDIT-004 | WHEN a wholesale save is validated THE system SHALL use applicable division-over-league-over-default match rules and SHALL map every lineup-integrity rejection to 422 without partial active-template writes. | [x] → #254 |
| LEDIT-005 | WHEN Sign or Release repairs an existing active Lineup THE system SHALL preserve every retained player's entry verbatim, place a signed player in BENCH or BULLPEN, and fill only the departed players' vacant starter positions from the remaining roster. | [x] → #256 |
| LEDIT-006 | WHEN Release leaves an existing active Lineup vacancy that no remaining roster player can fill THE system SHALL complete the transfer, retain the unfilled departed entry, and mark that entry invalid rather than rolling back the mutation. | [x] → #256 |
| LEDIT-007 | WHEN the system returns a `TeamLineup` card THE system SHALL include `valid: boolean` on every STARTER, BENCH, and BULLPEN entry, indicating whether that entry's player remains on the team's current roster. | [x] → #256 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
