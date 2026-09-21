# Specs: Game Box Score

| ID | Requirement | Status |
|---|---|---|
| BOXS-001 | WHEN a client requests `GET /api/game/:gameId` for a completed game THE system SHALL return both teams' full PlayerGameStats rosters, attributing each row through that game's frozen Lineup and LineupEntry rather than the player's current team. | [x] → #357 |
| BOXS-002 | WHEN the system returns a box-score player row THE system SHALL include frozen batting order, fielding position, role, raw stat column names, and IP derived from outsRecorded. | [x] → #357 |
| BOXS-003 | WHEN the system returns a completed game's box score THE system SHALL use Game.homeTeamResult and Game.awayTeamResult for the score header and order players by batting order then role group. | [x] → #357 |
| BOXS-004 | WHEN a requested game is not completed THE system SHALL respond with a 422 DomainError using the shared error body convention. | [x] → #357 |
| BOXS-005 | WHEN one completed-game side has no PlayerGameStats rows THE system SHALL return an empty side so the UI renders “No stats recorded” while the other side remains visible. | [x] → #357 |
| BOXSUI-001 | WHEN a user navigates to `/:gwId/game/:gameId` THE system SHALL load the box score through the route loader and render both team tables with the final score. | [x] → #357 |
| BOXSUI-002 | WHEN a returned team has no box-score rows THE system SHALL render “No stats recorded” for that side only. | [x] → #357 |
