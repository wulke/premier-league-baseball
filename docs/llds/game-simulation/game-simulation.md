# LLD: Backend Simulate Game (`GameFactory`)

> **Backfill.** This is a low-level design written *after* the code shipped, to bring the
> simulate-game domain logic under the LID Arrow of Intent (`HLD → LLD → EARS → Tests → Code`).
> It documents the code as it exists on `feat/simulate-game` (`src/db/domain/game.ts`,
> `src/db/domain/game-world.ts`), not the PRD's proposals where they diverge. Divergences are
> called out in the [Edge Case Probe](#edge-case-probe).
>
> **Corrigendum (#190 — engine strategy seam).** Score production is now delegated to a
> swappable `SimulationEngine` strategy behind an injectable seeded RNG, and the vestigial
> `result()` is removed. The sections below describe the **post-seam** design (code follows the
> arrow). Upstream: *HLD: Simulation Engine Strategy Seam* in
> [`docs/high-level-design.md`](../high-level-design.md).
>
> Upstream: [HLD: Simulate Game](../high-level-design.md) · EARS: `docs/specs/game-simulation/simulate-game-specs.md`
> (`SIM-001`..`SIM-015`) · PRD: `docs/architecture/prd/simulate-game-plan.md` ·
> Gherkin: `test/bdd/features/simulate-game.feature`

## Scope

The domain logic that lets a player advance the season by simulating scheduled games:

- **Single-game simulate** — `GameFactory(id).simulate()`: one guarded game → random score + `COMPLETED`.
- **Batch simulate** — `GameFactory().simulateBatch(gwId, endDate?)`: every reachable, still-simulatable game in a GameWorld up to a date, in one transaction, with a skip ledger.

Status/date guards, the engine-delegated score production, and the transaction boundary all live
in the domain layer. Score production itself is a swappable `SimulationEngine` strategy (#190); The API layer (`src/api/handlers.ts`, `src/api/router.ts`) is a thin pass-through and
is summarized under [API Surface](#api-surface) for traceability only.

---

## Interface / Data Model

### Factory

```ts
// src/db/domain/game.ts
const GameFactory = (id?: number) => ({
  create(homeTeam, awayTeam),          // not part of simulate flow
  simulate(options?: { seed?: number }): Promise<GameRow>,        // single-game, guarded
  simulateBatch(gwId, endDate?, options?: { seed?: number }): Promise<{ simulated: GameRow[]; skipped: { game; reason }[] }>,
  simulateToday(gwId): Promise<{ simulated: GameRow[]; skipped: { game; reason }[]; nextDate: string | null }>,
  rapidSimulateSeason(gwId),           // unchanged — delegates through simulateBatch
});
// result(): REMOVED (#190, was e4) — no unguarded score-write path remains
```

`simulateBatch` ignores the factory's `id` argument; it is invoked as `GameFactory().simulateBatch(...)`.
The optional `seed` is **domain-only** (tests/golden master); handlers never pass it (e16).

### Simulation engine seam (#190)

New module `src/db/domain/simulation/` — the strategy that owns *what the score is*, never
*whether/how it is written* (guards, transaction, completion hooks stay in `GameFactory`).

```ts
// src/db/domain/simulation/engine.ts
export interface SimulationContext {
  gameId: number;      // seed derivation; stays stable across engine impls
  homeTeam: number;
  awayTeam: number;
  // #191/#192 grow this: lineups, attribute reads — the seam contract
}

export interface SimulationResult {
  homeTeamResult: number;   // [0, 9] at Depth 0 (e8)
  awayTeamResult: number;
}

export interface SimulationEngine {
  simulateGame(ctx: SimulationContext): SimulationResult;   // pure: no DB, no side effects
}

export const resolveSimulationEngine = (seed?: number): SimulationEngine;
// → RandomSimulationEngine today; the attribute-driven engine (#191) is the second impl
```

```ts
// src/db/domain/simulation/seed.ts — per-game seed derivation (shared infra)
// Deterministic 32-bit avalanche mix (murmur3-style finalizer) of (base, gameId):
// imul/xor/shift integer ops only — no floats, no Math.random — so a pinned seed yields
// the same scores on every machine, every run (golden master).
export const deriveGameSeed = (base: number, gameId: number): number;
```

```ts
// src/db/domain/simulation/random-engine.ts — preserves today's behavior exactly
export class RandomSimulationEngine implements SimulationEngine {
  constructor(private readonly seed?: number) {}
  simulateGame(ctx: SimulationContext): SimulationResult {
    const rng = mulberry32(deriveGameSeed(this.seed ?? Date.now(), ctx.gameId));
    const homeTeamResult = Math.floor(rng() * 10);   // draw 1: home (e15 — order pinned)
    const awayTeamResult = Math.floor(rng() * 10);   // draw 2: away
    return { homeTeamResult, awayTeamResult };
  }
}
// mulberry32: existing export from src/db/domain/identity.ts (#143) — no new RNG code.
```

### Data model (simulate-relevant fields)

| Model | Field | Type | Notes |
|---|---|---|---|
| `Game` | `status` | `ENUM('SCHEDULED','IN_PROGRESS','COMPLETED')`, `NOT NULL`, default `'SCHEDULED'` | Only `SCHEDULED` is simulatable. `IN_PROGRESS` is reserved for future in-game management and is rejected. |
| `Game` | `scheduledDate` | `DataTypes.DATE` (nullable) | `null` ⇒ unscheduled ⇒ bypasses the date guard. Indexed. |
| `Game` | `homeTeamResult`, `awayTeamResult` | `INTEGER` (nullable) | Populated only when simulated. |
| `GameWorld` | `currentDate` | `DataTypes.DATEONLY` (nullable) | `'YYYY-MM-DD'` string. **Not populated by `newSeason()`** — set out-of-band (tests/handlers write it directly). `null` ⇒ the date guard cannot be evaluated. |

### Reachability join chain

A game is "reachable" from a GameWorld for batch simulate via:

```
GameWorld → League → Division → DivisionSeason → DivisionSeasonGame → Game
```

Single-game simulate uses the **reverse** link to resolve the owning GameWorld for its date guard:

```
Game →(DivisionSeasonGame.gameId)→ DivisionSeason → Division → League → GameWorld
```

### Domain error

```ts
// src/db/domain/errors.ts
export class DomainError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 422) { ... }
}
```

Every guard failure throws `DomainError(message, statusCode)`. The API layer maps `statusCode` to
the HTTP response. *(The PRD proposed a dedicated `GameSimulationError`; the shipped code reuses the
shared `DomainError` — functionally equivalent, both carry a numeric `statusCode`.)*

The guard messages are part of the contract — the BDD step `Then /^the error indicates (.+)$/`
matches them literally:

| Guard | `statusCode` | `message` |
|---|---|---|
| Game not found | `404` | `'the game was not found'` |
| Single: already `COMPLETED` | `422` | `'the game has already been completed'` |
| Single: `IN_PROGRESS` | `422` | `'the game cannot be simulated in its current status'` |
| Single: no resolvable `currentDate` | `422` | `'the GameWorld has no current date configured'` |
| Single: future-dated | `422` | `'the game is scheduled for a future date'` |
| Batch: GameWorld not found | `404` | `'the GameWorld was not found'` |
| Batch: `currentDate` null & no `endDate` | `422` | `'the GameWorld has no current date configured'` |
| Batch: `endDate > currentDate` | `422` | `"the endDate exceeds the GameWorld's current date"` |

### API surface (thin wrappers — for traceability)

```ts
// src/api/handlers.ts
const simulateGame     = async (id: number)              => GameFactory(id).simulate();
const simulateBatchGames = async (gwId: number) => GameFactory().simulateToday(gwId);
// src/api/endpoints.ts
SimulateGame      = '/api/game/:gameId/simulate'        // POST → handlers.simulateGame(Number(gameId))
BatchSimulateGames = '/api/gameWorld/:gwId/simulate'     // POST → handlers.simulateBatchGames(gwId, body?.endDate)
```

---

## Logic Flow

### `simulate()` — single game

```
1. game = Game.findByPk(id)
   if game is null  → throw DomainError('the game was not found', 404)            # SIM-002
2. switch on game.status:
      'COMPLETED'   → throw DomainError('…already been completed', 422)           # SIM-003
      'IN_PROGRESS' → throw DomainError('…cannot be simulated in its current status', 422)  # SIM-004
      ('SCHEDULED' falls through to step 3)
3. DATE GUARD — only when game.scheduledDate != null:                              # SIM-007 bypass when null
     a. dsg = DivisionSeasonGame.findOne({ where: { gameId: id } })
        if dsg is null → throw DomainError('…no current date configured', 422)    # SIM-006 (no link)
     b. traverse dsg → DivisionSeason → Division → League → GameWorld
        if gameWorld is null OR gameWorld.currentDate is null
            → throw DomainError('…no current date configured', 422)               # SIM-006 (null date)
     c. if toDateStr(scheduledDate) > gameWorld.currentDate
            → throw DomainError('…scheduled for a future date', 422)              # SIM-005
        (comparison is lexicographic on 'YYYY-MM-DD' strings → chronological;
         '<=' therefore permits backfill of a missed/past date.)
4. engine = resolveSimulationEngine(options?.seed)                                     # SIM-016
   { homeTeamResult, awayTeamResult } = engine.simulateGame(
       { gameId: id, homeTeam, awayTeam })       # homeTeam/awayTeam from the loaded row; [0,9] (e8)
5. Game.update({ homeTeamResult, awayTeamResult, status: 'COMPLETED' }, { where: { id } })
6. return (await Game.findByPk(id)).dataValues                                   // status now COMPLETED  # SIM-001
```

No transaction wraps the single-row update (a single `UPDATE` is atomic by itself).

`toDateStr(d) = new Date(d).toISOString().slice(0, 10)` normalizes `scheduledDate` (a `DATE`, may
carry a time component) down to `'YYYY-MM-DD'` so it compares cleanly against the `DATEONLY`
`currentDate`.

### `simulateBatch(gwId, endDate?)` — whole GameWorld up to a date

```
1. gw = GameWorld.findByPk(gwId)
   if gw is null → throw DomainError('the GameWorld was not found', 404)           # SIM-008
2. currentDate = gw.currentDate
3. if currentDate is null AND endDate is null
       → throw DomainError('…no current date configured', 422)                     # SIM-009
4. if endDate AND currentDate AND endDate > currentDate
       → throw DomainError("…endDate exceeds the GameWorld's current date", 422)   # SIM-010
5. effectiveEndDate = endDate ?? currentDate
6. REACHABILITY (early-exit with { simulated:[], skipped:[] } at each empty layer):
     leagues         = League.findAll({ where:{ gameWorldId: gwId } })   → leagueIds
     divisions       = Division.findAll({ where:{ leagueId IN leagueIds } })        → divisionIds
     divisionSeasons = DivisionSeason.findAll({ where:{ divisionId IN divisionIds } }) → divisionSeasonIds
     dsGames         = DivisionSeasonGame.findAll({ where:{ divisionSeasonId IN divisionSeasonIds } })
     gameIds         = unique(dsGames.gameId)
     games           = Game.findAll({ where:{ id IN gameIds } })
   (NB: no date predicate in the query — ALL reachable games are loaded; date/status
    filtering happens in the loop below. See Edge Case Probe e1.)
7. engine = resolveSimulationEngine(options?.seed)   # resolved once; calls are pure per game
   tx = db.transaction()
   try:
     for game of games:
       if game.status == 'COMPLETED'
            → skipped.push({ game, reason:'already completed' }); continue          # SIM-012
       if game.status == 'IN_PROGRESS'
            → skipped.push({ game, reason:'game in progress' }); continue           # SIM-013
       if game.scheduledDate != null AND toDateStr(scheduledDate) > effectiveEndDate
            → skipped.push({ game, reason:'future date' }); continue                # SIM-014
       { homeTeamResult, awayTeamResult } = engine.simulateGame(
           { gameId: game.id, homeTeam: game.homeTeam, awayTeam: game.awayTeam })   # SIM-016
       Game.update({ homeTeamResult, awayTeamResult, status:'COMPLETED' },
                   { where:{ id: game.id }, transaction: tx })
       simulated.push({ ...game, homeTeamResult, awayTeamResult, status:'COMPLETED' })   # SIM-011
     tx.commit()
   catch error:
     tx.rollback(); throw error                                                     # SIM-015
8. return { simulated, skipped }
```

Only the `Game.update` writes run inside the transaction; the preceding reads do not. On rollback no
`simulated` row is persisted, so the batch is all-or-nothing with respect to writes.

### `simulateToday(gwId)` — player-facing daily progression

`simulateToday` is the domain orchestration behind `POST /api/gameWorld/:gwId/simulate`.
It deliberately keeps `simulateBatch` reusable and date-bounded for callers such as
`rapidSimulateSeason`, whose loop owns multi-day progression.

```
1. result = simulateBatch(gwId)                                                   # SIM-019
2. Reload reachable games after completion hooks have run.
3. If a non-COMPLETED game with scheduledDate <= GameWorld.currentDate remains,
      return { ...result, nextDate:null }                                         # SIM-020
   (an IN_PROGRESS game is a blocker; never skip over an unresolved current day.)
4. nextDate = MIN(scheduledDate) among reachable non-COMPLETED games with
      scheduledDate > GameWorld.currentDate.
5. If nextDate exists, GameWorldFactory(gwId).advanceCurrentDate(nextDate);
   return { ...result, nextDate }. If no later scheduled game exists, return
   { ...result, nextDate:null }.                                                   # SIM-019
```

The response preserves the batch skip ledger for diagnostics. In particular, games on later
dates may still be recorded with reason `future date`; this is informational rather than a
failure of Simulate Today because the returned `nextDate` advances the world to the earliest one.

---

## Edge Case Probe

Each row ties a condition to its handling and the EARS id that pins it.

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `simulateBatch` candidate set | Loaded in full via reachability joins, **then** filtered for status/date in the loop — *not* by a SQL `scheduledDate <= ?` predicate (the PRD, Task 7.5, proposed a DB-side date filter). Correctness is identical; only set size differs. Revisit if batch sizes grow. | — |
| e2 | `endDate` supplied but `currentDate` is `null` | Step 3's "no current date" guard fires only when **both** are null, so this case *passes* step 4 (its `currentDate` conjunct is false) and simulates every reachable game with `scheduledDate <= endDate`. Reasonable but undocumented; align with `SIM-009` intent before relying on it. | SIM-009 |
| e3 | Single game with no `DivisionSeasonGame` link | Same `422 "no current date configured"` as a `null` `currentDate` — the two causes share one message/status. Distinguishable only by inspection. | SIM-006 |
| e4 | `GameFactory(id).result()` — **REMOVED (#190)** | Legacy blind `UPDATE … status='COMPLETED'` with **no guards** and caller-supplied scores. Zero callers existed; deleted. `Game.update` is now reachable only through the guarded `simulate` / `simulateBatch` paths — no unguarded score-write path remains. | — |
| e5 | `scheduledDate` carries a time component | `toDateStr()` strips to `'YYYY-MM-DD'` before comparison, so a game scheduled at `2025-04-10T23:00` still compares equal to `currentDate "2025-04-10"`. Without normalization a time-bearing `scheduledDate` would string-compare greater and look "future." | SIM-001/005 |
| e6 | `currentDate` lifecycle | `DATEONLY`, nullable, and **not** populated by `GameWorldFactory.newSeason()` — it is written out-of-band (tests/handlers set it directly). Any caller that forgets to set it hits the SIM-006/SIM-009 guard. Wire `newSeason()` to seed it from `config.seasonStartDate` to remove this footgun. | SIM-006/009 |
| e7 | Score ties | Results are independent `floor(random()*10)` draws, so `homeTeamResult === awayTeamResult` is possible. The domain records results only; **no winner/tiebreaker logic exists** here. (Standings resolution is out of scope for this LLD.) | — |
| e8 | Randomness range | Both results are integers in `[0, 9]`. Scores are unbounded above only by the literal `* 10`. Any change to the range is a contract change for downstream display/standings code. | SIM-001/011 |
| e9 | New `status` enum value added later | The single-game guards are **explicit** equality checks (`=== 'COMPLETED'`, `=== 'IN_PROGRESS'`), not `!== 'SCHEDULED'`. A hypothetical fourth status would fall through unguarded. Today the `ENUM` has only three values, so `SCHEDULED` is the sole pass case — but re-express as `!== 'SCHEDULED'` if the enum grows. | SIM-003/004 |
| e10 | Batch concurrency | A single transaction serializes the batch's own writes. There is no row/optimistic lock guarding a concurrent single-game `simulate()` of the same id racing a batch — last writer wins on `status`/results. Acceptable for the current single-player simulation model. | — |
| e11 | DB error mid-batch | `catch` rolls the transaction back and rethrows; nothing in `simulated` persists. The API layer surfaces this as a `500`. The BDD exercises this via a forced-error step (`forceDbError`), not a domain-level injection. | SIM-015 |
| e12 | Empty GameWorld (no leagues/divisions/seasons/games) | Each reachability layer early-returns `{ simulated: [], skipped: [] }` rather than throwing — an empty world is a successful no-op, not an error. | SIM-011 |
| e13 | Same-millisecond `Date.now()` seeds within a batch | Production base seed is drawn per `simulateGame` call, so consecutive games in one loop share a millisecond. `deriveGameSeed(base, gameId)` mixes in `gameId` — unique per game ⇒ distinct RNG streams, no identical-score collisions. | SIM-016 |
| e14 | Batch determinism vs loop order / skipped games | Each game's outcome is `f(base, gameId)` only — no shared stream. Reordering the loop, skipping games (already-completed / in-progress / future), or adding games to the world leaves every other game's pinned-seed score unchanged. Golden-master batch tests are stable under reachable-set drift. | SIM-017 |
| e15 | RNG draw order inside a game | Pinned **home-then-away**. Changing draw order changes pinned-seed scores — the golden master fails loudly rather than silently, which is the desired alarm. | SIM-017 |
| e16 | Seed exposure | `seed` is a domain-only optional parameter. Handlers/API pass nothing — production always draws a fresh per-game seed (variance preserved). A seed in the API contract would leak a test concern into the public surface. | SIM-018 |
| e17 | Engine purity vs transaction scope | `simulateGame` is pure (no DB reads/writes, no side effects), so calling it inside the batch transaction changes nothing about tx semantics — writes still begin and end at `Game.update`. | SIM-016 |
| e18 | Simulate Today sees future-dated games in its skip ledger | They remain `future date` skips from `simulateBatch`, but `simulateToday` advances `currentDate` to the earliest remaining scheduled date and returns it as `nextDate`; the UI presents this as successful progression, not an alarming failure. | SIM-019 |
| e19 | An unresolved reachable game is at or before the current date | `simulateToday` does not advance past it. This prevents an `IN_PROGRESS` game from being stranded behind a later date; the response has `nextDate:null` and its normal skip reason remains available to the UI. | SIM-020 |

---

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md) |
| **This LLD** | `docs/llds/game-simulation/game-simulation.md` |
| EARS | `docs/specs/game-simulation/simulate-game-specs.md` — `SIM-001`..`SIM-020` |
| Gherkin | `test/bdd/features/simulate-game.feature` (22 scenarios, one `@spec:SIM-###` tag per scenario; #190 adds engine-seam scenarios) |
| Step defs | `test/bdd/steps/simulate-game.steps.test.ts` |
| Code | `src/db/domain/game.ts` (`GameFactory.simulate`, `simulateBatch`, `simulateToday`), `src/db/domain/simulation/` (`engine.ts`, `seed.ts`, `random-engine.ts` — #190), `src/db/domain/game-world.ts` (`currentDate`), `src/db/domain/errors.ts` (`DomainError`), `src/api/handlers.ts` (`simulateGame`, `simulateBatchGames`) |

**Branch note (for the merge ticket).** The EARS spec file and `LID.md` currently live on the
`docs/simulate-game-ears-specs` branch and are **not yet present on `feat/simulate-game`**; the
`@spec:SIM-###` tags are therefore not yet on this branch's feature file either. This LLD cites the
canonical paths and IDs assuming that branch is reconciled before merge (issue #27). The HLD and
this LLD are added directly to `feat/simulate-game` for consistency with how the HLD landed.
