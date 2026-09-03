# LLD: Lineup Schema & Active-Lineup Generation

> Upstream: [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md) · EARS: `docs/specs/manager/lineup-specs.md` (`LIN-001`..`LIN-006`) · Decision record: #138 / issue #198.

## Interface / Data Model

`Lineup(teamId, gameWorldId, gameId?)` owns `LineupEntry(lineupId, playerId, role, battingOrder?, fieldingPosition?)`.
`gameId: null` denotes the one active lineup for a team; a non-null game owns one team-specific
snapshot. Partial unique indexes enforce active `(teamId)` and game `(teamId, gameId)` identities;
entry indexes enforce one player and each non-null batting slot once per lineup.

`MatchRules = { dhEnabled: boolean; benchSize: number; bullpenSize: number }` defaults to
`{ dhEnabled: false, benchSize: 5, bullpenSize: 7 }` in League config. A Division may override it.
`resolveMatchRules(league, division?)` merges that override. The team-creation flow has no Division
yet, so it intentionally uses the League-default values.

## Logic Flow

```
generateActive(team, players, matchRules):
  split roster by allocated primary slot (Pitcher vs fielder)
  pick starting pitcher by mean pitch control, then mean velocity
  use maximum-weight bipartite matching for fielders x 8 defensive positions
  when DH: choose best remaining fielder as the DH
  order batting starters: top two on-base score, next two power, remaining descending;
    no-DH pitcher is ninth, DH starter has no batting slot
  bench = remaining fielders by batting score, capped
  bullpen = remaining pitchers by pitch quality, capped
  validateLineup(entries, matchRules), then persist active Lineup + entries
```

## Edge Case Probe

| Condition | Handling |
|---|---|
| A roster cannot fill every reserve cap | Keep a partial bench/bullpen; caps are maxima, never generation failures. |
| DH is off | Nine starters bat 1..9; the Pitcher is slot 9 and no DH exists. |
| DH is on | Ten starters exist: nine bat 1..9 and the Pitcher has null batting order. |
| A future editor chooses a poorly rated defender | Valid: ratings guide generation only, never validation gates. |
| Duplicate active or game lineups are written | SQLite partial unique indexes reject them. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/manager/lineup-specs.md` |
| Tests | `test/db/domain/lineup.test.ts` |
| Code | `src/db/model/lineup*.ts`, `src/db/domain/lineup.ts`, roster/team creation hooks |
