# Specs: Player Stats Schema (`PlayerGameStats`)

Backend requirements for the `PlayerGameStats` model and season/career aggregation (`src/db/model/`).

| ID | Requirement | Status |
|---|---|---|
| PSTAT-001 | WHEN a Player both bats and pitches in the same Game THE system SHALL store both batting and pitching columns on a single `PlayerGameStats` row for that `(playerId, gameId)` pair, not split across rows; pitching counters that would otherwise collide with batting names SHALL use distinct pitching-prefixed columns | [x] |
| PSTAT-002 | WHEN season or career games-played (`G`) is requested THE system SHALL derive it as `COUNT(*)` over the player's `PlayerGameStats` rows rather than reading a stored column | [x] |
| PSTAT-003 | WHEN a rate stat (`AVG`, `OBP`, `SLG`, `ERA`, `WHIP`) is requested at any grain (game/season/career) THE system SHALL compute it at read-time from counting-stat aggregates rather than reading a stored value | [x] |
| PSTAT-004 | WHEN Player stats are scoped to Core batting and Core pitching per v1 THE system SHALL exclude fielding stats (`E`/`A`/`PO`/`FLD%`), Common-tier stats, and `W`/`L` from the schema | [D] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

`PSTAT-004` is marked Deferred rather than Active — it describes a scope boundary already fixed by the
map's decision record, not a behavior to implement later. No write path exists yet for any of these
requirements; they apply once a future map wires real per-player game events into `SimulationEngine`.

## Traceability

- LLD: `docs/llds/player/player-stats.md`
- Decision record: [#61](https://github.com/wulke/premier-league-baseball/issues/61), [#62](https://github.com/wulke/premier-league-baseball/issues/62)
- Code: `src/db/model/player-game-stats.ts`, `src/db/model/associations.ts`
