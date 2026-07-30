# Get League

```mermaid
flowchart TD
  start([Start]) --> find[FindByPk League + include Divisions + Teams]
  find --> ok{Found?}
  ok -->|no| err[Throw error]
  ok -->|yes| endNode([Return League])
```
