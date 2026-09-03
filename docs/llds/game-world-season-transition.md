# LLD: GameWorld Season Transition (`GameWorldFactory.newSeason`)

> EARS: `docs/specs/game-world/game-world-season-transition-specs.md` (`GWS-001`) ·
> Decision record: [#37 Fix: GameWorldFactory.newSeason() swallows errors instead of rethrowing](https://github.com/wulke/premier-league-baseball/issues/37)

## Scope

Defines the failure contract for `GameWorldFactory(id).newSeason()` in `src/db/domain/game-world.ts`
when the season rollover work cannot complete. This LLD is narrowly about error propagation from the
GameWorld-level coordinator; it does not redesign season seeding, `currentDate`, or multi-season UI.

## Interface / Data Model

```ts
// src/db/domain/game-world.ts
newSeason(): Promise<GameWorldRow>
```

`newSeason()` coordinates three responsibilities for one existing GameWorld:

1. load the GameWorld and its leagues
2. advance GameWorld season state
3. ask each League to start its next season

If any write or downstream `LeagueFactory(id).newSeason(currentYear)` call fails, the domain contract
is that the returned promise rejects with that error. The caller must not receive a success-shaped
`GameWorld` payload for a failed rollover attempt.

## Logic Flow

```
1. Load GameWorld by id, including Leagues; reject if id is missing or the GameWorld does not exist.
2. Begin a transaction.
3. Attempt the season rollover work:
   a. read currentYear from the loaded GameWorld
   b. increment GameWorld.year
   c. set GameWorld.config.inProgress = true
   d. call LeagueFactory(leagueId).newSeason(currentYear) for each League
   e. commit the transaction
4. If any step in (3) throws:
   a. roll back the transaction
   b. rethrow the original error
5. Only after a successful commit, return the refreshed GameWorld row.
```

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | A GameWorld write fails before any League starts its season | Roll back the transaction and reject `newSeason()` with the same error. | GWS-001 |
| e2 | One League fails while others are being started | Treat the overall rollover as failed: roll back and reject with the originating error rather than returning a refreshed GameWorld. | GWS-001 |
| e3 | A caller expects `find()`-shaped success data even after a failure | Disallowed by contract. Success-shaped data is returned only after commit; failures propagate by promise rejection. | GWS-001 |

## Traceability

| Layer | Artifact |
|---|---|
| **This LLD** | `docs/llds/game-world-season-transition.md` |
| EARS | `docs/specs/game-world/game-world-season-transition-specs.md` — `GWS-001` |
| Tests | `test/db/domain/game-world.test.ts` |
| Code | `src/db/domain/game-world.ts` (`GameWorldFactory.newSeason`) |
| Decision record | [#37](https://github.com/wulke/premier-league-baseball/issues/37) |
