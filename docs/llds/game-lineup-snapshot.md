# LLD: Per-Game Lineup Snapshot

> Upstream: [`lineup-generation.md`](./lineup-generation.md) · EARS: `docs/specs/game-lineup-snapshot-specs.md` (`LSNAP-001`..`LSNAP-005`) · Decision record: #138 / issue #201.

## Interface / Data Model

```ts
TeamFactory(teamId).snapshotForGame(gameId): Promise<GameLineupSnapshot>
TeamFactory(teamId).getLineup({ gameId?, gwId? }): Promise<TeamLineup>
GET /api/team/:teamId/lineup?gameId=…&gwId=…
```

`Lineup(gameId: null)` is the team's active, mutable template. `Lineup(gameId: number)` is the
team's immutable-in-practice per-game input. A snapshot copies every `LineupEntry` value
(`playerId`, `role`, `battingOrder`, and `fieldingPosition`) from the active lineup into a new
per-game lineup at freeze time. The existing partial unique index on `(teamId, gameId)` preserves
the single per-game lineup identity shared by snapshots and future manager overrides.

## Logic Flow

```
snapshotForGame(teamId, gameId):
  → resolve Team or 404
  → resolve Game or 404
  → resolve existing Lineup(teamId, gameId); return it unchanged when present
  → resolve active Lineup(teamId, gameId IS NULL) or 404
  → transactionally create Lineup(teamId, gameWorldId, gameId)
  → clone every active LineupEntry assignment verbatim into the new lineup

getLineup(teamId, { gameId?, gwId? }):
  → validate team and optional GameWorld scope
  → choose gameId when supplied; otherwise choose active gameId IS NULL
  → project the selected lineup through the established ID-only card
```

## Edge Case Probe

| Condition | Handling |
|---|---|
| Per-game lineup already exists (snapshot or #137 override) | Return the existing row without changing its entries. |
| Active lineup changes after freeze | Existing per-game entries remain unchanged; the engine reads the snapshot. |
| No active lineup exists to freeze, or no requested per-game lineup exists | Signal not found (404), matching #199's read convention. |
| Target Game does not exist | Signal not found (404); a snapshot never creates an orphaned per-game lineup. |
| Concurrent snapshot requests | The partial unique index is the final integrity guard; the loser re-reads and returns the established row. |
| Player roster membership mutates after a snapshot | Not repaired here: #140 owns active-lineup repair on transfer, release, or injury. Rosters are static within a #138 season, so a snapshot is valid at freeze time. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/game-lineup-snapshot-specs.md` |
| Tests | `test/bdd/features/game-lineup-snapshot.feature`, `test/bdd/steps/game-lineup-snapshot.steps.test.ts` |
| Code | `src/api/models.ts`, `src/db/domain/team.ts`, `src/api/endpoints.ts`, `src/api/handlers.ts`, `src/api/router.ts` |
