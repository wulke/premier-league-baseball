# Check League Season Complete

```mermaid
flowchart TD
  start([Start]) --> league[Get League]
  league --> divs[For each Division -> Division.isSeasonComplete(year)]
  divs --> all{All true?}
  all -->|yes| endNode([Return true])
  all -->|no| end2([Return false])

  click league "get-league.md" "Open Get League flow"
```
