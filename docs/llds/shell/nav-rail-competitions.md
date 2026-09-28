# LLD: Nav-Rail Competition Selector

> EARS: [`app-shell-ui-specs.md`](../../specs/shell/app-shell-ui-specs.md) (SHELL-007, SHELL-012, SHELL-013) · Issue: #394

## Interface / Data Model

`GET /api/gameWorld/:gwId` already includes the world's `Leagues`, `managedTeamId`, and
`Teams`. The managed Team's persisted `homeLeagueId` is the Primary Home League. No new
primary-league field or session-persisted selector state is introduced.

```ts
type CompetitionSelectorData = {
  managedTeamId: number | null;
  Teams: Array<{ id: number; homeLeagueId: number }>;
  Leagues: Array<{ id: number; config?: { name?: string } }>;
};
```

## Logic Flow

1. Resolve the managed Team from `gw.Teams` using `gw.managedTeamId`.
2. Resolve its Primary Home League from `gw.Leagues` using that Team's `homeLeagueId`.
3. If either resolution fails, render no COMPETITIONS section.
4. Otherwise render one labelled native selector containing every world league. Its value is
   the current `:leagueId` when that id exists in `gw.Leagues`; otherwise it is the Primary
   Home League id.
5. On a selector change, navigate to `/:gwId/:leagueId`. The route remains the source of truth,
   so the selected competition is not separately persisted across sessions.

## Edge Case Probe

| Condition | Handling |
| --- | --- |
| No managed team (`managedTeamId === null`) | Hide COMPETITIONS rather than exposing an arbitrary world league. |
| Managed Team is absent from a stale/partial payload | Hide safely. |
| Managed Team's `homeLeagueId` does not name a current world league | Hide safely; do not fall back to the first league. |
| Direct navigation to another world league | Display that league as selected, allowing read-only browsing of every competition already exposed by the world. |
| GameWorld route or unknown league route | Default selector value is the Primary Home League. |
