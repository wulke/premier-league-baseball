# Specs: Wholesale Active Lineup Save

| ID | Requirement | Status |
|---|---|---|
| LEDIT-001 | WHEN `PUT /api/team/:teamId/lineup` receives a complete valid roster-member entry set for the managed team THE system SHALL transactionally replace only the declared entry fields on the existing active Lineup row and return the canonical `TeamLineup` card. | [ ] → #254 |
| LEDIT-002 | IF a lineup save targets a team other than `managedTeamId` THE system SHALL reject it with 422 and preserve the active card; WHEN `DEV_MODE` is true THE system SHALL bypass that identity gate. | [x] → #254 |
| LEDIT-003 | WHEN the GameWorld has no current date THE system SHALL permit an otherwise valid managed-team lineup save; IF any submitted player is not on that team's current roster THE system SHALL reject it with 422 and the message `player is not on this team's roster`. | [x] → #254 |
| LEDIT-004 | WHEN a wholesale save is validated THE system SHALL use applicable division-over-league-over-default match rules and SHALL map every lineup-integrity rejection to 422 without partial active-template writes. | [x] → #254 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
