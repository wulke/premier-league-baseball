# Create League

```mermaid
flowchart TD
  start([Start]) --> lcreate[Create League]
  lcreate --> divs[For each division config -> Create Division]
  divs --> endNode([Return League])
```
