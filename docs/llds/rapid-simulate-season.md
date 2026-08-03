# LLD: Rapid Simulate Season (`GameFactory.rapidSimulateSeason`)

> EARS: `docs/specs/rapid-simulate-season-specs.md` (`RSS-001`…`RSS-008`) ·
> UI LLD (sibling): [`rapid-simulate-season-ui.md`](./rapid-simulate-season-ui.md) ·
> Gherkin: `test/bdd/features/rapid-simulate-season.feature`

## Scope

Adds `GameFactory().rapidSimulateSeason(gwId)` in `src/db/domain/game.ts`, plus a new
`GameWorldFactory(id).advanceCurrentDate(date)` mutator in `src/db/domain/game-world.ts`, and the
`POST /api/gameWorld/:gwId/rapid-simulate` endpoint that calls them. This is an **admin/dev-only**
tool (see #101 for the distinct player-facing "Today" snapshot feature — not related) for fast-
forwarding an entire season's remaining games in one call, so contract/standings/results mechanics
can be validated without manually clicking "Simulate Today" once per day.

It is built entirely on top of the existing `GameFactory().simulateBatch(gwId)`
(`src/db/domain/game.ts:82`) — **no change to `simulateBatch` itself**. `simulateBatch` already
only simulates games with `scheduledDate <= GameWorld.currentDate`; today nothing in the codebase
ever advances `currentDate`, so a season's later games are permanently unreachable through the
existing "Simulate Today" flow alone. `rapidSimulateSeason` closes that gap by repeatedly advancing
`currentDate` to each remaining game date and calling `simulateBatch` again, until no unplayed,
scheduled game remains.

Out of scope:
- The UI control — see the sibling UI LLD.
- Season rollover (`GameWorldFactory.newSeason()`) — this method never calls it; reaching the end
  of a season's games leaves the GameWorld exactly as "Simulate Today" would, just further along.
- Any real "Action" (trade offers, contract negotiations) interrupting an in-flight rapid
  simulation. A reserved extension seam is included (see Logic Flow, step 3c) but it is a no-op
  today — no Action model, no pause/resume persistence. Real interruption support is a future
  ticket, designed against actual Action types once they exist.
- Progress streaming/polling. The endpoint is a single blocking request/response; see Edge Case
  Probe e7 for why that's an acceptable choice for an admin tool.

## Interface / Data Model

```ts
// src/db/domain/game-world.ts
interface IGameWorld {
  create: (NewGameWorld) => any;
  find: () => any | any[];
  newSeason: () => any;
  advanceCurrentDate: (date: string) => Promise<{ id: number; currentDate: string }>;   // NEW
}
```

```ts
// src/db/domain/game.ts (GameFactory return shape — unchanged members omitted)
type RapidSimulateResult = {
  daysAdvanced: number;
  simulated: any[];   // union of every simulateBatch() call's `simulated`, across iterations
  skipped: any[];      // union of every simulateBatch() call's `skipped`, across iterations
};

interface IGame {
  // ...existing members (create, result, simulate, simulateBatch)...
  rapidSimulateSeason: (gwId: number) => Promise<RapidSimulateResult>;   // NEW
}
```

```ts
// src/api/endpoints.ts
RapidSimulateSeason = '/api/gameWorld/:gwId/rapid-simulate'   // NEW
```

```ts
// src/api/handlers.ts
const rapidSimulateSeason = async (gwId: number): Promise<RapidSimulateResult> => {
  if (process.env.ENABLE_DEV_TOOLS !== 'true') {
    throw new DomainError('Not found', 404);   // indistinguishable from a nonexistent route
  }
  return await GameFactory().rapidSimulateSeason(gwId);
};
```

```ts
// src/api/router.ts
router.post(Endpoints.RapidSimulateSeason, async (req, res) => {
  await handlers.rapidSimulateSeason(Number(req.params.gwId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});
```

```ts
// src/api/handlers.ts — getGameWorld (MODIFIED)
const getGameWorld = async (id: number) => {
  const gameWorld = await GameWorldFactory(id).find();
  return { ...gameWorld, devToolsEnabled: process.env.ENABLE_DEV_TOOLS === 'true' };
};
```

## Logic Flow

```
rapidSimulateSeason(gwId):
1. Load GameWorld by id (db.models.GameWorld.findByPk). If it does not exist, throw
   Error('No gameworld exists with id=...') with statusCode 404.                        # RSS-001
2. Guard: IF !gameWorld.config?.inProgress OR gameWorld.currentDate == null
   THEN throw DomainError('the GameWorld has no active season to simulate', 422).        # RSS-002
3. daysAdvanced = 0; simulated = []; skipped = []; targetDate = gameWorld.currentDate
   Loop:
   a. result = await GameFactory().simulateBatch(gwId)   # endDate defaults to currentDate
      simulated.push(...result.simulated); skipped.push(...result.skipped)
   b. remaining = query for MIN(scheduledDate) among games reachable from gwId
      (same League → Division → DivisionSeason → DivisionSeasonGame → Game join as
      simulateBatch, src/db/domain/game.ts:99-121) WHERE status != 'COMPLETED'
      AND scheduledDate IS NOT NULL AND scheduledDate > targetDate
   c. [reserved extension point — no-op today] a per-iteration hook is called here that could,
      in the future, signal "pause" (e.g. a pending Action needs player input). It always
      returns "continue" today; see Scope.
   d. IF remaining is null: break (no more scheduled, non-completed games)                # RSS-003
   e. IF result.simulated.length === 0 AND (games with scheduledDate <= targetDate were
      still non-COMPLETED before step 3a, i.e. skipped this iteration for a reason other
      than 'future date'):
      throw DomainError(`rapid simulation made no progress at date ${targetDate} — a
      non-completed game is blocking advancement`, 422).                                 # RSS-005
      (Progress already made in prior iterations of this loop remains committed — each
      simulateBatch() call commits its own transaction independently; see Edge Case e5.)
   f. await GameWorldFactory(gwId).advanceCurrentDate(remaining)                          # RSS-003
      targetDate = remaining; daysAdvanced += 1
4. return { daysAdvanced, simulated, skipped }                                            # RSS-006
   (newSeason() is never called — see Scope.)                                             # RSS-004

GameWorldFactory(id).advanceCurrentDate(date):
1. IF !id: throw Error('no game world to advance') (mirrors newSeason's guard).
2. Load GameWorld by id; if missing, throw 404 (mirrors newSeason/delete pattern).
3. IF gameWorld.currentDate != null AND date <= gameWorld.currentDate:
   throw DomainError("date must be strictly after the GameWorld's current currentDate", 422).
                                                                                            # RSS-008
4. db.models.GameWorld.update({ currentDate: date }, { where: { id } })
5. return { id, currentDate: date }
```

The "MIN(scheduledDate) among remaining games" query in step 3b reuses the exact reachability walk
`simulateBatch` already performs (Leagues → Divisions → DivisionSeasons → DivisionSeasonGame →
Game) rather than introducing a new join — it's the same candidate game set, just aggregated for
the minimum future date instead of filtered against a fixed `endDate`.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `gwId` does not correspond to an existing GameWorld | Throw before doing any work, with `statusCode = 404`. | RSS-001 |
| e2 | GameWorld exists but `config.inProgress` is `false` (no season started) | Reject with 422 before simulating anything — matches the same precondition `AppHeader`'s existing `canBatch` guard already enforces for "Simulate Today" (`src/ui/components/app-header.tsx`). | RSS-002 |
| e3 | GameWorld exists, `inProgress` is `true`, but `currentDate` is `null` | Same 422 as e2 — `currentDate` is required both to seed the loop and because `simulateBatch` itself throws on a missing `currentDate` with no `endDate` override. | RSS-002 |
| e4 | Happy path — season has games spread across several future dates, none blocked | Loop advances through each distinct `scheduledDate` in order, simulating every batch, until no non-COMPLETED scheduled game remains; returns the union of all `simulated`/`skipped` across iterations plus `daysAdvanced`. | RSS-003, RSS-006 |
| e5 | A game at some future date is `IN_PROGRESS` and never resolves (stuck) | The iteration that advances `currentDate` to that date calls `simulateBatch`, which skips the `IN_PROGRESS` game (existing behavior, unchanged) — `result.simulated.length === 0` for that iteration, so the loop aborts with a 422 identifying the blocking date. **Every prior iteration's results already persisted** (each `simulateBatch` call commits independently) — the abort does not roll back days already advanced. This is a deliberate divergence from the all-or-nothing transactional style of `GameWorldFactory.delete` (see `game-world-deletion.md`): rapid-simulate is a multi-step operation over an already-committed sequence of independent batches, not one atomic unit, so losing prior progress on a later failure would be worse for a dev tool meant to save time. | RSS-005 |
| e6 | Games with `scheduledDate == null` | Unaffected — `simulateBatch` already simulates these unconditionally on any call regardless of `endDate` (existing behavior, `src/db/domain/game.ts:141`), so they're resolved on the very first iteration and never factor into the "next date" query (step 3b explicitly filters `scheduledDate IS NOT NULL`). | RSS-003 |
| e7 | A season has hundreds of remaining game-dates | The endpoint blocks for the full duration of the loop (no polling/streaming). Acceptable for an admin/dev tool against test-sized data; if this becomes a real bottleneck, the domain method's return shape (a self-contained summary, not side-effect-only) is already suited to becoming the payload of a future async/status-polling endpoint without changing `rapidSimulateSeason` itself. | — |
| e8 | `advanceCurrentDate` called with a date not strictly after the current `currentDate` | Rejected with 422, `currentDate` left unchanged — defends the invariant even though `rapidSimulateSeason` is the only caller today and always computes a strictly-later date. | RSS-008 |
| e9 | `ENABLE_DEV_TOOLS` is unset or not exactly `'true'` in the server process | `POST /api/gameWorld/:gwId/rapid-simulate` responds 404 — indistinguishable from a route that doesn't exist, so the feature's existence isn't discoverable in a production deployment that hasn't opted in. | RSS-007 |
| e10 | Two concurrent `rapidSimulateSeason` calls for the same `gwId` | Not specifically guarded at the domain layer (no lock/mutex) — each `simulateBatch`/`advanceCurrentDate` call is independently consistent, but interleaved calls could race on `currentDate` reads. Out of scope: this is a single-operator admin tool, and the UI-layer guard (sibling UI LLD) disables both "Simulate Today" and "Rapid Simulate Season" while either is in flight, which is the realistic mitigation for the only client that exists. | — |

## Traceability

| Layer | Artifact |
|---|---|
| **This LLD** | `docs/llds/rapid-simulate-season.md` |
| UI LLD (sibling) | `docs/llds/rapid-simulate-season-ui.md` |
| EARS | `docs/specs/rapid-simulate-season-specs.md` — `RSS-001`…`RSS-008` |
| Gherkin | `test/bdd/features/rapid-simulate-season.feature` |
| Tests | `test/db/domain/game.test.ts`, `test/db/domain/game-world.test.ts` (new cases) |
| Code | `src/db/domain/game.ts` (`GameFactory.rapidSimulateSeason`), `src/db/domain/game-world.ts` (`GameWorldFactory.advanceCurrentDate`), `src/api/handlers.ts` (`rapidSimulateSeason`, `getGameWorld` MODIFIED), `src/api/router.ts`, `src/api/endpoints.ts` |
