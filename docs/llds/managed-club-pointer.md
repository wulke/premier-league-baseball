# LLD: Managed Club Pointer

> EARS: `docs/specs/managed-club-specs.md` (`MCLB-001`–`MCLB-005`) ·
> Parent: [#137 My Club concept](https://github.com/wulke/premier-league-baseball/issues/137) ·
> Delivery: [#152](https://github.com/wulke/premier-league-baseball/issues/152)

## Interface / Data Model

`GameWorld.managedTeamId` is a nullable `INTEGER` pointer to the Team currently managed by the
user. It is deliberately a pointer only: it neither authorizes other writes nor changes simulation
behavior in this slice.

```ts
GameWorldFactory(gwId).setManagedClub(teamId: number | null): Promise<{
  id: number;
  managedTeamId: number | null;
}>;

POST /api/gameWorld/:gwId/managed-club
{ teamId: number | null }
```

The additive startup migration creates the nullable column when it is missing. It performs no
backfill, so rows created before this feature retain `managedTeamId = null` (unclaimed).

## Logic Flow

1. The GET GameWorld handler serializes the existing `GameWorldFactory(gwId).find()` result, which
   includes `managedTeamId`.
2. The POST handler passes `req.body.teamId` to `GameWorldFactory(gwId).setManagedClub()`.
3. The factory loads the target GameWorld; a missing world produces a 404 error.
4. For a non-null team id, the factory loads the Team and confirms `team.gameWorldId === gw.id`.
5. A missing, foreign, malformed, or non-integer team id produces a 422 invalid-state error.
6. The factory updates only `GameWorld.managedTeamId` and returns the pointer value. `null` skips
   the Team lookup and clears the pointer.

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| Existing row predates the column | Add the nullable column only; read it as `null`, with no inferred owner. | MCLB-001 |
| Requested GameWorld does not exist | Return 404 before changing any pointer. | MCLB-005 |
| Team id is unknown or belongs to another GameWorld | Reject with 422 and leave the pointer unchanged. | MCLB-005 |
| Request sends `null` | Clear the pointer; a later user action may set a different valid team. | MCLB-004 |
| Future ownership-gated actions | Out of scope: they consume this pointer in later slices and must not be implicitly gated here. | MCLB-003 |

## Traceability

| Layer | Artifact |
|---|---|
| **This LLD** | `docs/llds/managed-club-pointer.md` |
| EARS | `docs/specs/managed-club-specs.md` — `MCLB-001`–`MCLB-005` |
| Tests | `test/bdd/features/managed-club.feature`, `test/bdd/steps/managed-club.steps.test.ts` |
| Code | GameWorld model/migration, `GameWorldFactory.setManagedClub`, managed-club handler and route |
