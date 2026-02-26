# Start New Season (League)

```mermaid
flowchart TD
  start([Start]) --> league[Get League]
  league --> complete{League.isSeasonComplete?}
  complete -->|no| err[Throw error]
  complete -->|yes| divs[For each Division -> Division.newSeason(currentYear)]
  divs --> endNode([Return])

  click league "get-league.md" "Open Get League flow"
  click complete "check-league-season-complete.md" "Open Check League Season Complete flow"
  click divs "start-new-season-division.md" "Open Start New Season (Division) flow"
```
