# Specs: GameWorld API (list + create)

Code-as-evidence backfill for the two pre-LID GameWorld collection endpoints:
`GET /api/gameWorld` and `POST /api/gameWorld/new`. Written from observed behavior
(`src/api/handlers.ts`, `src/db/domain/game-world.ts`), per the approved legacy-backfill
process. The single-world read (`GET /api/gameWorld/:gwId`) is already specced via
MCLB-002/RSS-007 and is not restated here; deletion is specced in GWD-001..004.

| ID | Requirement | Status |
|---|---|---|
| GWA-001 | WHEN `GET /api/gameWorld` is called THE system SHALL return every GameWorld as a raw unwrapped JSON array (200), with no filter, envelope, or pagination | [x] |
| GWA-002 | WHEN `GET /api/gameWorld` is called IF no GameWorld rows exist THE system SHALL return `200` with an empty array | [x] |
| GWA-003 | WHEN `POST /api/gameWorld/new` is called with `{ name, leagues, teams, year }` THE system SHALL persist the GameWorld with the full payload embedded in its `config` JSON plus `inProgress: false`, create all Teams first (shared across Leagues, composed with the first League's identity/match-rule defaults per PID-010, LIN-002, LIN-003) then all Leagues, and return `200` with `{ ...gameWorld, leagues, teams }` | [x] |
| GWA-004 | WHEN a GameWorld is created via `POST /api/gameWorld/new` THE system SHALL leave the `year` column at its model default (current year − 1); the body's `year` value SHALL be stored only inside `config` JSON and SHALL NOT set the column | [x] |
| GWA-005 | WHEN `POST /api/gameWorld/new` receives a malformed body THE system SHALL apply no router-level validation (per backend-standards §3) and SHALL surface whatever persistence-layer error occurs as `{ error }` with the standard `sendError` status mapping | [x] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Flags for the EARS gate (behavior recorded as-is; ruling requested)

- **GWA-004** — the required `NewGameWorld.year` field is effectively dead payload: it is
  persisted into `config` JSON but never applied to the `year` column, which always takes
  the `currentYear − 1` default. Backend-standards documents the default as intentional,
  but nothing documents the body field being ignored. Accept as `[x]`, or file as an
  intent gap (either honor the field or drop it from `NewGameWorld`).
- Handler-level `console.debug(newGameWorld)` / `console.debug(gameWorlds)` leftovers —
  cosmetic; propose removing when annotating (step 4), no spec row.

## Traceability

- Code: `src/api/endpoints.ts` (`GetGameWorlds`, `NewGameWorld`), `src/api/handlers.ts` (`getGameWorlds`, `newGameWorld`), `src/db/domain/game-world.ts` (`find`, `create`)
- Upstream: PID-010, LIN-002/LIN-003 (identity composition, referenced not restated); GWT-002/GWT-004 (template-side create flow)
- Gherkin: `test/bdd/features/game-world-api.feature` (`test/bdd/steps/game-world-api.steps.test.ts`)
