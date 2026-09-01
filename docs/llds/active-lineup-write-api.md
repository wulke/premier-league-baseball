# LLD: Active Lineup Write API

> Upstream: [HLD: Lineup View — Defensive | Batting Tabs](../high-level-design.md#hld-lineup-view--defensive--batting-tabs) · UI sibling: [`lineup-view-ui.md`](./lineup-view-ui.md) · EARS: `docs/specs/active-lineup-write-specs.md` (`LWRITE-001`..).

## Interface / Data Model

```ts
type ActiveLineupEntry = {
  playerId: number;
  role: 'STARTER' | 'BENCH' | 'BULLPEN';
  battingOrder: number | null;
  fieldingPosition: PlayerPosition | null;
};

PATCH /api/team/:teamId/lineup
{ entries: ActiveLineupEntry[] }
```

The endpoint updates only `Lineup(teamId, gameId: null)`. It neither creates a lineup nor mutates
any `gameId` snapshot. Authentication is intentionally absent: the UI scopes controls using
`GameWorld.managedTeamId`, consistent with this auth-free application.

## Logic Flow

```
PATCH entries
  → resolve Team and active Lineup(gameId IS NULL), or 404
  → resolve the template's first League match rules (same source used at active-lineup creation)
  → validateLineup({ entries }, matchRules); on failure return 422 before writes
  → transaction: delete current active LineupEntry rows; bulk-create submitted entries; commit
  → return the active read-card projection
```

## Edge Case Probe

| Condition | Handling |
|---|---|
| Missing active lineup or team | 404; the write never constructs a template. |
| Invalid duplicate, batting order, defensive coverage, DH, bench, or bullpen shape | Return 422 before the transaction begins; old entries remain intact. |
| Database failure after validation | Roll back the delete/create transaction so no partial active lineup survives. |
| Submitted data names a per-game lineup | There is no gameId input; only the `gameId IS NULL` row is selected. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/active-lineup-write-specs.md` |
| Tests | `test/bdd/features/active-lineup-write-api.feature`, `test/bdd/steps/active-lineup-write-api.steps.test.ts` |
| Code | `src/api/models.ts`, `src/api/endpoints.ts`, `src/api/handlers.ts`, `src/api/router.ts`, `src/db/domain/team.ts` |
