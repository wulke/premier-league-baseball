# Start New Season (GameWorld)

```mermaid
flowchart TD
  start([Start]) --> load[FindByPk GameWorld + include Leagues]
  load --> ok{Found?}
  ok -->|no| err[Throw error]
  ok -->|yes| tx[Begin transaction]
  tx --> inc[Increment year]
  inc --> inprog[Update config.inProgress=true]
  inprog --> leagues[For each League -> League.newSeason(currentYear)]
  leagues --> commit[Commit transaction]
  commit --> refresh[Reload GameWorld]
  refresh --> endNode([Return])
  tx -->|error| rollback[Rollback transaction]
  rollback --> refresh

  click load "find-game-world.md" "Open Find Game World flow"
  click leagues "start-new-season-league.md" "Open Start New Season (League) flow"
```
