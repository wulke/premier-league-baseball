# Start New Season (Division)

```mermaid
flowchart TD
  start([Start]) --> div[FindByPk Division]
  div --> complete{Division.isSeasonComplete?}
  complete -->|no| err[Throw error]
  complete -->|yes| seed[Get seed team ids]
  seed --> formula{gameFormula includes KNOCKOUT?}

  formula -->|yes — elimination| ds_elim[BulkCreate DivisionSeason entries with bracketSlot]
  ds_elim --> pair{gameFormula includes REDRAW?}
  pair -->|yes| shuffle[Shuffle teams randomly]
  pair -->|no| slot[Pair by bracketSlot order]
  shuffle --> r1[BulkCreate round-1 Games + DivisionSeasonGame links]
  slot --> r1
  r1 --> twoleg_elim{TWO_LEG?}
  twoleg_elim -->|yes| r2[BulkCreate round-2 return-leg Games + links]
  twoleg_elim -->|no| endElim([Return DivisionSeason teams])
  r2 --> endElim

  formula -->|no — table| ds_table[BulkCreate DivisionSeason entries]
  ds_table --> gen[generateTableGames: round-robin rotation → round-numbered matchdays]
  gen --> twoleg_table{TWO_LEG?}
  twoleg_table -->|yes| double[Append shuffled return-leg matchdays]
  twoleg_table -->|no| schedule
  double --> schedule[For each matchday: compute scheduledDate from schedulingConfig]
  schedule --> gcreate[BulkCreate Games with round + scheduledDate]
  gcreate --> link[BulkCreate DivisionSeasonGame links]
  link --> endTable([Return DivisionSeason teams])

  click gcreate "create-game.md" "Open Create Game flow"
```

Notes
- `scheduledDate = startDate + (round - 1) × intervalDays` when `schedulingConfig` is present; omitted otherwise.
- `bracketSlot` is only populated for elimination divisions; it preserves seeding for fixed-bracket advancement in `advanceRound()`.
- TWO_LEG elimination creates both legs at season start (round 1 = first legs, round 2 = return legs). TWO_LEG table appends a shuffled second set of matchdays.
