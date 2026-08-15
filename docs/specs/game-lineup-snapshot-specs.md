# Specs: Per-Game Lineup Snapshot

| ID | Requirement | Status |
|---|---|---|
| LSNAP-001 | WHEN `TeamFactory(teamId).snapshotForGame(gameId)` is called for a team with an active lineup THE system SHALL clone every active lineup entry verbatim into a new `gameId`-set lineup. | [x] → #201 |
| LSNAP-002 | WHEN an active lineup changes after its per-game lineup has been snapshotted THE system SHALL preserve the snapshotted lineup as the valid point-in-time engine input. | [x] → #201 |
| LSNAP-003 | WHEN `snapshotForGame(gameId)` finds an existing per-game lineup for that team and game THE system SHALL return it without overwriting its entries. | [x] → #201 |
| LSNAP-004 | WHEN `getLineup({ gameId, gwId? })` is called THE system SHALL return that per-game lineup or signal not found; WHEN `gameId` is omitted THE system SHALL return the active lineup. | [x] → #201 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
