# Specs: Lineup Schema & Active-Lineup Generation

| ID | Requirement | Status |
|---|---|---|
| LIN-001 | WHEN models initialize THE system SHALL persist Lineup and LineupEntry records with the declared active, per-game, player, and batting-order uniqueness indexes | [x] → #198 |
| LIN-002 | WHEN League or Division configuration supplies match rules THE system SHALL use League defaults with an optional Division override for DH and reserve caps | [x] → #198 |
| LIN-003 | WHEN a Team receives its generated roster THE system SHALL create exactly one valid active lineup from that roster | [x] → #198 |
| LIN-004 | WHEN active lineup generation assigns defensive fielders THE system SHALL maximize total positional ratings globally and choose the starting pitcher by mean control then velocity | [x] → #198 |
| LIN-005 | WHEN DH is disabled THE system SHALL create nine batting starters with the pitcher batting ninth; WHEN DH is enabled THE system SHALL create ten starters with a non-batting pitcher and DH | [x] → #198 |
| LIN-006 | WHEN the roster cannot meet reserve caps THE system SHALL produce a valid partial bench or bullpen without failing generation | [x] → #198 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
