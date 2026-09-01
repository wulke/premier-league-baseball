# Specs: Active Lineup Write API

| ID | Requirement | Status |
|---|---|---|
| LWRITE-001 | WHEN `PATCH /api/team/:teamId/lineup` receives a complete active-lineup entry set THE system SHALL validate the resulting set with `validateLineup` before replacing the active entries transactionally. | [x] → #249 |
| LWRITE-002 | IF active-lineup validation fails THE system SHALL reject the request and preserve every stored active entry without a partial write. | [x] → #249 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*
