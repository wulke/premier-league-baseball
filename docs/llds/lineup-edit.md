# LLD: Wholesale Active Lineup Save

> Upstream: #226 decision record · EARS: `docs/specs/lineup-edit-specs.md` (`LEDIT-001`..`LEDIT-004`) · complements the legacy constrained `PATCH` write from #249.

## Interface / Data Model

```ts
PUT /api/team/:teamId/lineup
{ entries: Array<{ playerId, role, battingOrder, fieldingPosition }> }
// -> TeamLineup
```

The target is the existing `Lineup(teamId, gameId IS NULL)` row. Its ID is retained; every one of
its entries is replaced. Submitted players may be any current roster member, rather than only a
permutation of the previous card. `gameId` is deliberately not accepted: game snapshots are frozen.

## Logic Flow

```
PUT entries
  -> resolve Team + GameWorld and apply the shared managed-team gate (DEV_MODE bypasses it)
  -> resolve the Team's applicable League/Division match rules (division overrides league/default)
  -> resolve active Lineup, verify every submitted Player is on Team's current roster
  -> validateLineup(entries, rules); map every semantic failure to 422
  -> transaction: delete active LineupEntry rows; bulk-create only the four declared entry fields on the same Lineup ID; commit
  -> read and return the canonical TeamLineup card
```

Transfers add a `currentDate` requirement after using the shared resolver; lineup editing does not,
so a manager can prepare a template before season start.

## Edge Case Probe

| Condition | Handling |
|---|---|
| Team is not the GameWorld's `managedTeamId` | 422, unless `DEV_MODE === 'true'`; no entries change. |
| GameWorld has no current date | Allowed; date is not an editing precondition. |
| Duplicate player, batting orders, coverage, DH/pitcher shape, bench/bullpen cap | `validateLineup` error becomes 422 before delete/create; old card remains exact. |
| Player is a free agent, belongs to another club, or is absent | 422 `player is not on this team's roster`; no entries change. |
| Division rules override its League rules | Validate with `resolveMatchRules(league.config, division.config)`, mirroring generation precedence. |
| Per-game lineup exists | Never selected or mutated; no `gameId` input is exposed. |
| Submitted entry includes persistence or unknown fields | Ignore them; only `playerId`, `role`, `battingOrder`, and `fieldingPosition` are persisted on the active Lineup. |
| Database error during replacement | Transaction rollback preserves the old entries. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/lineup-edit-specs.md` |
| Gherkin | `test/bdd/features/lineup-edit.feature` |
| Steps | `test/bdd/steps/lineup-edit.steps.test.ts` |
| Code | `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`, `src/db/domain/team.ts` |
