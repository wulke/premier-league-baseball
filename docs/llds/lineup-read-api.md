# LLD: Lineup Read API

> Upstream: [`lineup-generation.md`](./lineup-generation.md) · EARS: `docs/specs/lineup-read-api-specs.md` (`LREAD-001`..`LREAD-004`) · Decision record: #138 / issue #199.

## Interface / Data Model

```ts
type LineupStarter = {
  playerId: number;
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
};

type TeamLineup = {
  starters: LineupStarter[]; // ascending battingOrder; null (DH-on pitcher) last
  startingPitcherId: number;
  bench: Array<{ playerId: number }>;
  bullpen: Array<{ playerId: number }>;
};

TeamFactory(teamId).getLineup({ gameId?, gwId? }): Promise<TeamLineup>
GET /api/team/:teamId/lineup?gameId=…&gwId=…
```

`getLineup` resolves the team's active `Lineup` when `gameId` is omitted, or its per-game `Lineup`
when `gameId` is supplied. It projects only entry IDs and lineup assignments; it does not join or denormalize player identity. The
starting pitcher is derived from the unique `STARTER` entry positioned at `Pitcher`, never from a
stored foreign key. `bench` and `bullpen` are intentionally unordered pools.

## Logic Flow

```
GET /api/team/:teamId/lineup?gameId=…&gwId=…
  → if gwId supplied, reject absent team or team.gameWorldId !== gwId with 404
  → TeamFactory(teamId).getLineup({ gameId? })
      → resolve Team or 404
      → resolve Lineup where teamId and gameId is the supplied value, or gameId IS NULL when omitted, or 404
      → load LineupEntry rows
      → starters = STARTER rows sorted by battingOrder (null last)
      → startingPitcherId = STARTER row whose fieldingPosition is Pitcher
      → project BENCH and BULLPEN rows as unordered player-ID pools
```

## Edge Case Probe

| Condition | Handling |
|---|---|
| Team does not exist, or has no active lineup | 404; a read never constructs or selects a per-game snapshot. |
| `gwId` names another world | 404, matching roster/player read scoping. |
| DH is enabled | Return all ten `STARTER` entries, including the `fieldingPosition: null` DH and null-order pitcher. |
| Pool query order changes | No contract promises pool ordering; consumers treat bench/bullpen as sets. |
| Player name or attributes change | Response stays ID-only; consumers resolve player detail through the player read. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/lineup-read-api-specs.md` |
| Tests | `test/bdd/features/lineup-read-api.feature`, `test/bdd/steps/lineup-read-api.steps.test.ts` |
| Code | `src/api/models.ts`, `src/db/domain/team.ts`, `src/api/endpoints.ts`, `src/api/handlers.ts`, `src/api/router.ts` |
