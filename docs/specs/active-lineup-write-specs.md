# Specs: Active Lineup Write API

| ID | Requirement | Status |
|---|---|---|
| LWRITE-001 | WHEN `PATCH /api/team/:teamId/lineup` receives a complete active-lineup entry set THE system SHALL validate the resulting set with `validateLineup` before replacing the active entries transactionally. | [x] → #249 |
| LWRITE-002 | IF active-lineup validation fails THE system SHALL reject the request and preserve every stored active entry without a partial write. | [x] → #249 |
| LWRITE-003 | WHEN `PATCH /api/team/:teamId/lineup` receives entries THE system SHALL accept only a complete permutation of the existing active-template player IDs, all belonging to that team. | [x] → #249 |
| LWRITE-004 | IF a submitted `BENCH` or `BULLPEN` entry carries a batting order or fielding position THE system SHALL reject the lineup as invalid. | [x] → #249 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
