# LLD: GameWorld Deletion (`GameWorldFactory.delete`)

> EARS: `docs/specs/game-world/game-world-deletion-specs.md` (`GWD-001`…`GWD-004`) ·
> UI LLD (sibling): [`game-world-deletion-ui.md`](./game-world-deletion-ui.md) ·
> Gherkin: `test/bdd/features/game-world-deletion.feature`

## Scope

Defines the cascade-delete contract for `GameWorldFactory(id).delete()` in
`src/db/domain/game-world.ts`, plus the `DELETE /api/gameWorld/:gwId` endpoint that calls it. This
is a **hard delete** — there is no soft-delete/archive flag anywhere in the schema today, and none
is introduced here. Deletion removes the `GameWorld` row and every row transitively owned by it
(Leagues, Teams, Players, Divisions, DivisionSeasons, Games reachable only through those
DivisionSeasons, Contracts, PlayerGameStats, SeasonResults, Notifications, GameEvents). No
restriction is placed on deleting a GameWorld with `config.inProgress === true` — any GameWorld can
be deleted at any time. The `League.gameWorldId` / `Team.gameWorldId` nullable-by-omission
inconsistency (see Edge Case Probe e6) is a pre-existing data-integrity gap and is explicitly **out
of scope** for this LLD.

**Bug note (#373):** `Notification.belongsTo(GameWorld)` (`associations.ts:97`, `allowNull: false`)
and `GameEvent.belongsTo(Game)` (`associations.ts:83`, `allowNull: false`) were omitted from the
original cascade — a GameWorld with any Notification row, or a Game with any GameEvent row, hits
`SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` on delete. Both are now covered by step 4 below.
Cascade ownership stays hand-rolled in this method (no `onDelete: 'CASCADE'` on any association);
moving that to the DB/Sequelize layer is a larger structural change and is out of scope for this
fix.

Out of scope: UI (hover icon, confirm modal, optimistic list removal) — see the sibling UI LLD.

## Interface / Data Model

```ts
// src/db/domain/game-world.ts
interface IGameWorld {
  create: (NewGameWorld) => any;
  find: () => any | any[];
  newSeason: () => any;
  delete: () => Promise<{ id: number }>;   // NEW
}
```

```ts
// src/api/endpoints.ts
DeleteGameWorld = '/api/gameWorld/:gwId'   // NEW — same path as GetGameWorld, DELETE verb
```

```ts
// src/api/handlers.ts
const deleteGameWorld = async (id: number): Promise<{ id: number }> =>
  await GameWorldFactory(id).delete();
```

```ts
// src/api/router.ts
router.delete(Endpoints.DeleteGameWorld, async (req, res) => {
  await handlers.deleteGameWorld(Number(req.params.gwId))
    .then((response) => res.send(response))
    .catch((error) => sendError(res, error));
});
```

Not-found is signaled by throwing an `Error` carrying `statusCode = 404`, matching the existing
`sendError` convention (`error.statusCode ?? 500`).

## Logic Flow

Deletion follows the dependency graph in `src/db/model/associations.ts`, walked bottom-up so every
`allowNull: false` foreign key (`Player.gameWorldId`, `DivisionSeason.divisionId`/`teamId`,
`Contract.playerId`/`teamId`, `PlayerGameStats.playerId`/`gameId`, `SeasonResult.divisionId`) is
cleared before its parent is removed. The whole operation runs inside one unmanaged transaction
(`db.transaction()` + manual `commit`/`rollback`), mirroring `TeamFactory.create`
(`src/db/domain/team.ts:24-47`) — not Sequelize's `onDelete` cascade config, which is not declared
on any association today (see backend exploration notes) and would leave SQLite's loose FK
enforcement as the only safety net.

```
1. Load GameWorld by id; if it does not exist, throw Error('No gameworld exists with id=...')
   with statusCode 404 BEFORE opening a transaction (no-op on not-found).
2. Begin a transaction (t).
3. Collect id sets scoped to this GameWorld (all reads inside t):
   a. leagueIds   = League.findAll({ where: { gameWorldId: id } })
   b. teamIds     = Team.findAll({ where: { gameWorldId: id } })
   c. playerIds   = Player.findAll({ where: { gameWorldId: id } })
   d. divisionIds = Division.findAll({ where: { leagueId: leagueIds } })
   e. divisionSeasonIds = DivisionSeason.findAll({ where: { divisionId: divisionIds } })
   f. gameIds     = distinct gameId from DivisionSeasonGame.findAll({ where: { divisionSeasonId: divisionSeasonIds } })
4. Delete children bottom-up (all writes inside t):
   a. PlayerGameStats.destroy({ where: { [Op.or]: [{ playerId: playerIds }, { gameId: gameIds }] } })
   b. ContractFactory-owned `deleteForGameWorld({ playerIds, teamIds }, { transaction })`
   c. SeasonResult.destroy({ where: { divisionId: divisionIds } })
   d. Notification.destroy({ where: { gameWorldId: id } })                   # see Edge Case Probe e10 (#373)
   e. DivisionSeasonGame.destroy({ where: { divisionSeasonId: divisionSeasonIds } })
   f. orphanGameIds = gameIds MINUS (gameId still referenced by any remaining DivisionSeasonGame row)
      GameEvent.destroy({ where: { gameId: orphanGameIds } })                # see Edge Case Probe e11 (#373)
      Game.destroy({ where: { id: orphanGameIds } })                         # see Edge Case Probe e3
   g. DivisionSeason.destroy({ where: { id: divisionSeasonIds } })
   h. Division.destroy({ where: { id: divisionIds } })
   i. Player.destroy({ where: { gameWorldId: id } })
   j. Team.destroy({ where: { gameWorldId: id } })
   k. League.destroy({ where: { gameWorldId: id } })
   l. GameWorld.destroy({ where: { id } })
5. Commit the transaction.
6. If any step in (3)-(5) throws: roll back the transaction, rethrow the original error.
7. Return { id }.
```

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `gwId` does not correspond to an existing GameWorld | Throw before opening a transaction, with `statusCode = 404`; no rows are touched. | GWD-001 |
| e2 | Happy path — GameWorld exists and has related Leagues/Teams/Players/Divisions/DivisionSeasons/Games/Contracts/PlayerGameStats/SeasonResults | All of it is deleted along with the GameWorld row itself; `GameWorldFactory` delegates Contract deletion to the Contract-owned cascade writer within the same transaction, so nothing related survives the commit. | GWD-002 |
| e3 | Any delete step fails partway through the cascade (constraint violation, DB error) | Roll back the entire transaction — GameWorld and all related rows remain exactly as before the call — and rethrow the original error. No partial cascades are ever persisted. | GWD-003 |
| e4 | GameWorld has `config.inProgress === true` (active season) | No restriction — deleted the same as any other GameWorld. The confirmation modal (UI LLD) is the only guardrail; there is no additional backend business rule gating in-progress worlds. | GWD-004 |
| e5 | A `Game` row is reachable via `DivisionSeasonGame` from more than one GameWorld's DivisionSeasons (theoretical — current domain logic never shares a Game across GameWorlds, but the association allows it) | Only delete a `Game` row once its `DivisionSeasonGame` references are fully removed *within this transaction*; a Game still referenced by a DivisionSeasonGame row belonging to another GameWorld is left intact. Defensive-only; not expected to trigger in practice. | GWD-002 |
| e6 | Two concurrent delete requests for the same `gwId` (double click, two tabs) | The second transaction's initial `findByPk` (or a mid-flight read after the first commits) finds no GameWorld and throws the same 404 as e1. The first request's success is unaffected. | GWD-001 |
| e7 | `SeasonResult.championTeamId` (nullable FK to `Team`) outlives its `Team` row | Not possible by construction: `SeasonResult` rows scoped to this GameWorld's Divisions are deleted (step 4c) strictly before `Team` rows are deleted (step 4i), so no dangling reference is ever written. | GWD-002 |
| e8 | `League.gameWorldId` / `Team.gameWorldId` are nullable by omission (no explicit column definition), unlike `Player.gameWorldId` (`allowNull: false`) | Out of scope for this LLD — flagged as a pre-existing data-integrity gap. Deletion here is scoped by explicit `gameWorldId` queries regardless of the column's nullability, so it does not affect this cascade's correctness. | — |
| e9 | `deleteGameWorld` is called with no id | `GameWorldFactory()` (no id) has no `delete` capability — `delete()` requires the factory to have been constructed with an id; calling it without one throws synchronously, matching `newSeason`'s `if (!id) throw Error(...)` guard. | GWD-001 |
| e10 | GameWorld has one or more `Notification` rows (`Notification.gameWorldId`, `allowNull: false`) | `Notification.destroy({ where: { gameWorldId: id } })` runs inside the transaction before `GameWorld.destroy`, so no Notification row ever outlives its GameWorld. (#373) | GWD-002 |
| e11 | A `Game` row about to be orphan-deleted (step 4f) has `GameEvent` rows (`GameEvent.gameId`, `allowNull: false`) | `GameEvent.destroy({ where: { gameId: orphanGameIds } })` runs immediately before `Game.destroy` for the same `orphanGameIds`, so no GameEvent row ever outlives its Game. A Game that survives (still referenced by another GameWorld's DivisionSeason, e5) keeps its GameEvents untouched. (#373) | GWD-002 |

## Traceability

| Layer | Artifact |
|---|---|
| **This LLD** | `docs/llds/game-world/game-world-deletion.md` |
| UI LLD (sibling) | `docs/llds/game-world/game-world-deletion-ui.md` |
| EARS | `docs/specs/game-world/game-world-deletion-specs.md` — `GWD-001`…`GWD-004` |
| Gherkin | `test/bdd/features/game-world-deletion.feature` |
| Tests | `test/db/domain/game-world.test.ts` (new cases) |
| Code | `src/db/domain/game-world.ts` (`GameWorldFactory.delete`), `src/api/handlers.ts` (`deleteGameWorld`), `src/api/router.ts`, `src/api/endpoints.ts` |
