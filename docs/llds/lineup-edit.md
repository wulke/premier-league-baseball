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

## Transfer Repair Semantics

`LineupFactory().repairActive()` runs inside the Sign/Release transaction. Unlike a wholesale
save, it preserves the existing active Lineup row and every entry whose player still belongs to
the team. A signed player is appended to `BENCH` unless their primary position is `Pitcher`, in
which case they are appended to `BULLPEN`; retained entry fields are never re-ranked or rewritten.

For released starter entries, repair identifies only their now-free fielding positions and runs the
existing optimal fielding assignment against unassigned current-roster players. It selects the
best assignment for every fillable subset when fewer candidates than vacancies remain, so a thin
roster still fills as many positions as it can. Each assignment replaces the departed entry while
retaining its batting order and fielding position. Primary non-pitchers are preferred; when that
pool is too thin, pitchers may be used as a positional fallback. A departed reserve is removed;
a signed player is the only transfer-created reserve entry.

If no current-roster player can fill a departed starter position, the departed entry remains in the
card. Read projection marks it `valid: false` because its player is no longer on the team. This is
an intentionally manager-resolvable active-template state: Sign/Release still commits, while a
missing active Lineup (which cannot be preserved) continues to use generation and may propagate
its existing error. If that entry is the Pitcher, `startingPitcherId` is `null` rather than an ID
for a player no longer on the team.

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
| A transfer leaves no available player for a departed starter | Preserve the departed entry as an invalid read-card row; commit the transfer so higher-level roster management is never blocked. |
| A transfer leaves fewer replacement fielders than starter vacancies | Fill the highest-value feasible subset through the fielding-assignment algorithm; leave only the remainder invalid. |
| The invalid entry is the Pitcher | Return `startingPitcherId: null`; the invalid starter row remains visible for manager repair. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/lineup-edit-specs.md` |
| Gherkin | `test/bdd/features/lineup-edit.feature` |
| Steps | `test/bdd/steps/lineup-edit.steps.test.ts` |
| Code | `src/api/endpoints.ts`, `src/api/router.ts`, `src/api/handlers.ts`, `src/db/domain/team.ts` |
