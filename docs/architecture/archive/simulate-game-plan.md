> Superseded by docs/high-level-design.md and docs/llds/game-simulation.md as of LID backfill.

# Implementation Plan: Simulate a Game

## Summary

Adds `Game.status` and `GameWorld.currentDate` schema fields, guard logic to the single-game simulate path, and a new batch simulate endpoint — enabling players to simulate one or many scheduled games while enforcing temporal and status preconditions.

## Pre-conditions

- Branch: `new-season-schedule` (or feature branch off it)
- BDD runner is configured (`npm run test:bdd` via `jest-cucumber`)
- `test/bdd/features/simulate-game.feature` and `test/bdd/steps/simulate-game.steps.test.ts` already exist as scaffolding
- Sequelize uses `db.sync({ force: true })` in test env — no separate migration tool required

### Step file observation

The existing step file (`test/bdd/steps/simulate-game.steps.test.ts`) stores `currentDate` in `GameWorld.config` (JSON), e.g. `config: { currentDate }`. The design calls for a dedicated `currentDate` DATEONLY column. Task 10 updates the step file to use the dedicated column.

---

## Task 1: Add `status` column to Game model

**Type:** Schema change
**File(s):** `src/db/model/game.ts`
**Depends on:** none

### What to implement

Add a `status` column to the `Game` Sequelize model definition:

```ts
status: {
  type: DataTypes.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED'),
  allowNull: false,
  defaultValue: 'SCHEDULED',
}
```

`IN_PROGRESS` is reserved for future in-game management actions and should not be set by the simulate flow.

### Acceptance criteria

- Invariant: A new `Game` record created without an explicit `status` has `status = 'SCHEDULED'` when read back from the DB.
- Invariant: The `status` column rejects values outside the enum (Sequelize validation error).

---

## Task 2: Add `currentDate` column to GameWorld model

**Type:** Schema change
**File(s):** `src/db/model/game-world.ts`
**Depends on:** none

### What to implement

Add a `currentDate` column to the `GameWorld` Sequelize model definition:

```ts
currentDate: {
  type: DataTypes.DATEONLY,
  allowNull: true,
}
```

Nullable — it is unset until `newSeason()` is updated in a future task to populate it from `config.seasonStartDate`.

### Acceptance criteria

- Invariant: A newly created `GameWorld` has `currentDate = null` by default.
- Invariant: `currentDate` can be set to a date string and read back as a `DATEONLY` value.

---

## Task 3: Add index on `Game.scheduledDate`

**Type:** Schema change
**File(s):** `src/db/model/game.ts`
**Depends on:** none

### What to implement

Add an index on `scheduledDate` to support efficient date-range queries in the batch simulate path. Add an `indexes` array to the `sequelize.define` call for `Game`:

```ts
sequelize.define('Game', { /* existing fields */ }, {
  indexes: [
    { fields: ['scheduledDate'] }
  ]
});
```

### Acceptance criteria

- Invariant: `db.sync()` completes without error after this change.
- Invariant: The index exists on the `Games` table in the SQLite schema (verifiable via `.schema Games` in sqlite3).

---

## Task 4: Fix router bug — wrong param passed to `simulateGame`

**Type:** Bug fix
**File(s):** `src/api/router.ts`
**Depends on:** none

### What to implement

At `router.ts:87`, the `SimulateGame` route handler incorrectly passes `req.params.gwId` (which is `undefined` on this route) to `handlers.simulateGame`. Fix it to pass `req.params.gameId`:

```ts
// Before
await handlers.simulateGame(req.params.gwId)

// After
await handlers.simulateGame(Number(req.params.gameId))
```

### Acceptance criteria

- Invariant: `POST /api/game/:gameId/simulate` with a valid `gameId` reaches the handler with the correct numeric id (verifiable via debug log or integration test).

---

## Task 5: Add `GameSimulationError` custom error class

**Type:** Domain layer
**File(s):** `src/db/domain/game.ts` (or a new `src/db/domain/errors.ts`)
**Depends on:** none

### What to implement

Create a typed error class that carries an HTTP status code so callers (handlers, step files) can map domain errors to the correct HTTP response without string-matching:

```ts
export class GameSimulationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 422
  ) {
    super(message);
    this.name = 'GameSimulationError';
  }
}
```

Error messages must match the strings expected by the BDD `Then /^the error indicates (.+)$/` step:

| Guard failure | statusCode | message |
|---------------|-----------|---------|
| Game not found | 404 | `'the game was not found'` |
| Already completed | 422 | `'the game has already been completed'` |
| IN_PROGRESS | 422 | `'the game cannot be simulated in its current status'` |
| Future-dated | 422 | `'the game is scheduled for a future date'` |
| No `currentDate` on GameWorld | 422 | `'the GameWorld has no current date configured'` |
| GameWorld not found (batch) | 404 | `'the GameWorld was not found'` |
| `endDate` exceeds `currentDate` | 422 | `'the endDate exceeds the GameWorld\'s current date'` |

### Acceptance criteria

- Invariant: `new GameSimulationError('the game was not found', 404)` is an instance of both `GameSimulationError` and `Error`.
- Invariant: `error.statusCode` is accessible as a number.

---

## Task 6: Update `GameFactory` — add `simulate()` method with guards

**Type:** Domain layer
**File(s):** `src/db/domain/game.ts`
**Depends on:** Task 1, Task 2, Task 5

### What to implement

Add a `simulate()` method to `GameFactory`. This replaces the current blind-update pattern in `result()` with a guarded flow:

1. **Fetch game** — `FindByPk(id)`. If not found, throw `GameSimulationError('the game was not found', 404)`.
2. **Status guard** — if `game.status !== 'SCHEDULED'`, throw `GameSimulationError` with the appropriate message (see Task 5 table).
3. **Date guard** (only if `game.scheduledDate` is not null):
   - Traverse the join chain to find `GameWorld.currentDate`:
     `Game → DivisionSeasonGame → DivisionSeason → Division → League → GameWorld`
   - If `GameWorld.currentDate` is null, throw `GameSimulationError('the GameWorld has no current date configured', 422)`.
   - If `game.scheduledDate > GameWorld.currentDate`, throw `GameSimulationError('the game is scheduled for a future date', 422)`.
4. **Simulate** — generate `homeTeamResult` and `awayTeamResult` as `Math.floor(Math.random() * 10)`.
5. **Update** — `Game.update({ homeTeamResult, awayTeamResult, status: 'COMPLETED' }, { where: { id } })`.
6. **Return** — the updated game's `dataValues`.

The existing `result()` method can remain for internal use by `simulateBatch()`, but `simulate()` is the new guarded entry point for single-game simulation.

### Acceptance criteria

- Gherkin: `simulate-game.feature / Scenario: Simulate a scheduled game on its scheduled date` passes
- Gherkin: `simulate-game.feature / Scenario: Simulate a scheduled game whose scheduled date is in the past (backfill)` passes
- Gherkin: `simulate-game.feature / Scenario: Simulate an unscheduled game with no scheduledDate` passes
- Gherkin: `simulate-game.feature / Scenario: Attempt to simulate a game that does not exist` passes
- Gherkin: `simulate-game.feature / Scenario: Attempt to simulate a game that is already completed` passes
- Gherkin: `simulate-game.feature / Scenario: Attempt to simulate a game that is in progress` passes
- Gherkin: `simulate-game.feature / Scenario: Attempt to simulate a future-dated game` passes
- Gherkin: `simulate-game.feature / Scenario: Attempt to simulate a dated game when GameWorld has no currentDate set` passes
- Gherkin: `simulate-game.feature / Scenario: Game status transitions from SCHEDULED to COMPLETED after simulation` passes
- Gherkin: `simulate-game.feature / Scenario: COMPLETED game retains its result after a failed re-simulation attempt` passes
- Gherkin: `simulate-game.feature / Scenario: Simulating the same single game twice returns an error on the second attempt` passes

---

## Task 7: Add `GameFactory.simulateBatch()` method

**Type:** Domain layer
**File(s):** `src/db/domain/game.ts`
**Depends on:** Task 1, Task 2, Task 3, Task 5

### What to implement

Add a `simulateBatch(gwId: number, endDate?: string): Promise<{ simulated: any[], skipped: { game: any, reason: string }[] }>` method to `GameFactory` (or as a standalone factory function — either is acceptable).

Flow:

1. **Fetch GameWorld** — `FindByPk(gwId)`. If not found, throw `GameSimulationError('the GameWorld was not found', 404)`.
2. **Check `currentDate`** — if `GameWorld.currentDate` is null and no `endDate` provided, throw `GameSimulationError('the GameWorld has no current date configured', 422)`.
3. **Resolve `effectiveEndDate`** — `endDate ?? GameWorld.currentDate`.
4. **Validate `endDate`** — if `endDate` is provided and `endDate > GameWorld.currentDate`, throw `GameSimulationError('the endDate exceeds the GameWorld\'s current date', 422)`.
5. **Fetch candidate games** — a 3-step query:
   - Get all `DivisionSeason.id`s reachable from `gwId` via `League → Division → DivisionSeason`.
   - Get all `gameId`s from `DivisionSeasonGame` where `divisionSeasonId IN (...)`.
   - Find all `Game`s where `id IN (...)` AND `(scheduledDate IS NULL OR scheduledDate <= effectiveEndDate)`.
6. **Process each game** — for each game:
   - If `game.status !== 'SCHEDULED'`: push to `skipped` with `reason = 'already completed'` or `'game in progress'` depending on status.
   - If `game.scheduledDate > effectiveEndDate` (future): push to `skipped` with `reason = 'future date'`. *(This should not occur given the query filter but is a safety net.)*
   - Otherwise: generate random score, update game (`homeTeamResult`, `awayTeamResult`, `status = 'COMPLETED'`), push to `simulated`.
7. **Transaction** — wrap all `Game.update` calls in a single Sequelize transaction. On error, rollback and rethrow as a 500.
8. **Return** `{ simulated, skipped }`.

### Acceptance criteria

- Gherkin: `simulate-game.feature / Scenario: Simulate all games on the current date` passes
- Gherkin: `simulate-game.feature / Scenario: Simulate all games up to a specified endDate covering multiple days` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation includes an unscheduled game alongside a dated game` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation skips non-simulatable games and returns all in response` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation when all games in range are already completed` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation skips IN_PROGRESS games` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation when no games exist for the date range` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation with endDate beyond GameWorld currentDate is rejected` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation when GameWorld does not exist` passes
- Gherkin: `simulate-game.feature / Scenario: Batch simulation when GameWorld has no currentDate set and no endDate provided` passes
- Gherkin: `simulate-game.feature / Scenario: Database error during batch simulation rolls back all updates` passes

---

## Task 8: Update `handlers.simulateGame` to call `GameFactory.simulate()`

**Type:** API layer
**File(s):** `src/api/handlers.ts`
**Depends on:** Task 6

### What to implement

Replace the current blind random-score logic in `handlers.simulateGame` with a call to `GameFactory(id).simulate()`. Map `GameSimulationError` to the appropriate HTTP status; let unexpected errors bubble as 500.

```ts
const simulateGame = async (id: number) => {
  return await GameFactory(id).simulate();
};
```

Error mapping (in `router.ts` or a middleware): if the caught error is a `GameSimulationError`, respond with `error.statusCode` and `{ error: error.message }`. All other errors respond 500.

### Acceptance criteria

- Invariant: `POST /api/game/:gameId/simulate` with a valid SCHEDULED game returns `200` with `{ status: 'COMPLETED', homeTeamResult: <int>, awayTeamResult: <int> }`.
- Invariant: `POST /api/game/:gameId/simulate` with a COMPLETED game returns a `4xx` with an error message.

---

## Task 9: Add batch simulate endpoint

**Type:** API layer
**File(s):** `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`
**Depends on:** Task 7

### What to implement

**`endpoints.ts`** — add:
```ts
BatchSimulateGames = '/api/gameWorld/:gwId/simulate',
```

**`handlers.ts`** — add:
```ts
const simulateBatchGames = async (gwId: number, endDate?: string) => {
  return await GameFactory().simulateBatch(gwId, endDate);
};
```

**`router.ts`** — add route before the `NewSeason` route to avoid path conflicts:
```ts
router.post(Endpoints.BatchSimulateGames, async (req, res) => {
  await handlers.simulateBatchGames(Number(req.params.gwId), req.body?.endDate)
    .then((response) => res.send(response))
    .catch((error) => { /* map GameSimulationError → 4xx, else 500 */ });
});
```

### Acceptance criteria

- Invariant: `POST /api/gameWorld/:gwId/simulate` with a valid GameWorld and SCHEDULED games returns `200` with `{ simulated: [...], skipped: [...] }`.
- Invariant: `POST /api/gameWorld/:gwId/simulate` with `gwId = 9999` returns `4xx`.

---

## Task 10: Update BDD step file — single-game path

**Type:** Test
**File(s):** `test/bdd/steps/simulate-game.steps.test.ts`
**Depends on:** Task 2, Task 6, Task 8

### What to implement

Two changes to the step file:

**A. Fix `currentDate` storage** — the `Given a GameWorld exists…` step currently stores `currentDate` in `config` JSON. Update it to use the dedicated `currentDate` column added in Task 2:

```ts
// Before
await db.models.GameWorld.create({ id, year: parsedYear, config: { currentDate } });

// After
await db.models.GameWorld.create({ id, year: parsedYear, currentDate, config: {} });
```

Apply the same fix to the `'the GameWorld currentDate is null'` step.

**B. Fix error status code mapping** — `simulateSingleGame` currently catches all errors as status 500. Update it to check for `GameSimulationError` and use `error.statusCode`:

```ts
try {
  const body = await simulateGame(gameId);
  world.response = { statusCode: 200, body };
} catch (error) {
  if (error instanceof GameSimulationError) {
    world.response = { statusCode: error.statusCode, error };
  } else {
    world.response = { statusCode: 500, error };
  }
}
```

### Acceptance criteria

- All single-game Gherkin scenarios (happy paths + guard failures + status transitions) pass under `npm run test:bdd`.

---

## Task 11: Update BDD step file — wire batch simulate path

**Type:** Test
**File(s):** `test/bdd/steps/simulate-game.steps.test.ts`
**Depends on:** Task 9, Task 10

### What to implement

Replace the `simulateBatchGames` stub (currently returns 501) with a real call to the handler:

```ts
import { simulateBatchGames } from '../../../src/api/handlers';

const simulateBatchGames = async (world: WorldState, gameWorldId: number, endDate?: string) => {
  if (world.forceDbError) {
    world.response = { statusCode: 500, error: new Error('Injected database error') };
    return;
  }
  try {
    const body = await simulateBatchGames(gameWorldId, endDate);
    world.response = { statusCode: 200, body };
  } catch (error) {
    if (error instanceof GameSimulationError) {
      world.response = { statusCode: error.statusCode, error };
    } else {
      world.response = { statusCode: 500, error };
    }
  }
};
```

Note: the `forceDbError` branch remains to cover the transaction rollback scenario, which cannot be easily injected at the domain level without mocking.

### Acceptance criteria

- All batch Gherkin scenarios pass under `npm run test:bdd`.
- Gherkin: `simulate-game.feature / Scenario: Database error during batch simulation rolls back all updates` passes (via `forceDbError` path).

---

## Task 12: Run full BDD suite and verify all 22 scenarios pass

**Type:** Verification
**File(s):** n/a
**Depends on:** Tasks 1–11

### What to implement

Run `npm run test:bdd` and confirm all 22 scenarios in `test/bdd/features/simulate-game.feature` pass with no skipped or pending steps.

### Acceptance criteria

- `npm run test:bdd` exits 0.
- 22 scenarios pass, 0 fail, 0 pending.
- No other test files regress (`npm test` also exits 0).

---

## Task Summary

| # | Title | Type | Depends On |
|---|-------|------|------------|
| 1 | Add `Game.status` ENUM column | Schema | none |
| 2 | Add `GameWorld.currentDate` DATEONLY column | Schema | none |
| 3 | Add index on `Game.scheduledDate` | Schema | none |
| 4 | Fix router bug — wrong param in SimulateGame route | Bug fix | none |
| 5 | Add `GameSimulationError` custom error class | Domain | none |
| 6 | Add `GameFactory.simulate()` with status + date guards | Domain | 1, 2, 5 |
| 7 | Add `GameFactory.simulateBatch()` method | Domain | 1, 2, 3, 5 |
| 8 | Update `handlers.simulateGame` to call `GameFactory.simulate()` | API | 6 |
| 9 | Add `BatchSimulate` endpoint (endpoint, handler, router) | API | 7 |
| 10 | Update BDD step file — single-game path (column ref + 4xx handling) | Test | 2, 6, 8 |
| 11 | Update BDD step file — wire batch simulate to real handler | Test | 9, 10 |
| 12 | Run full BDD suite — confirm all 22 scenarios pass | Verification | 1–11 |
