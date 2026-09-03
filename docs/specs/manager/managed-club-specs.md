# Specs: Managed Club Pointer

Backend requirements for selecting, reading, and clearing the Team managed in a GameWorld.

| ID | Requirement | Status |
|---|---|---|
| MCLB-001 | WHEN the application starts with a GameWorld table created before managed-club support THE system SHALL add a nullable `managedTeamId` column without backfilling existing rows, which SHALL read as `null` | [x] → #152 |
| MCLB-002 | WHEN a client gets an existing GameWorld THE system SHALL include its `managedTeamId` in the existing `GET /api/gameWorld/:gwId` response | [x] → #152 |
| MCLB-003 | WHEN a client posts a Team id belonging to the target GameWorld to `POST /api/gameWorld/:gwId/managed-club` THE system SHALL set and return that GameWorld's managed-club pointer without gating unrelated actions | [x] → #152 |
| MCLB-004 | WHEN a client posts `{ teamId: null }` to `POST /api/gameWorld/:gwId/managed-club` THE system SHALL clear and return the GameWorld's managed-club pointer | [x] → #152 |
| MCLB-005 | WHEN a managed-club request names a missing GameWorld THE system SHALL return 404, and WHEN it names a malformed, unknown, or foreign Team id THE system SHALL return 422 without changing the pointer | [x] → #152 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/manager/managed-club-pointer.md`
- Decision record: [#152](https://github.com/wulke/premier-league-baseball/issues/152)
- Tests: `test/bdd/features/managed-club.feature`, `test/bdd/steps/managed-club.steps.test.ts`
- Code: `src/db/model/game-world.ts`, `src/db/migrations/managed-club-pointer.ts`, `src/db/domain/game-world.ts`, `src/api/handlers.ts`, `src/api/router.ts`
