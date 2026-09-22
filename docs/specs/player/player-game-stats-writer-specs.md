# Specs: Per-Player Game Event Writer (Box-Score Distributor)

Backend requirements for the first `PlayerGameStats` write path. This is a temporary box-score
distributor, to be superseded by #191/#192 play-by-play simulation.

| ID | Requirement | Status |
|---|---|---|
| PGSW-001 | WHEN `GameFactory` completes a game through either single or batch simulation THE system SHALL obtain each participating team's frozen `Lineup(gameId)` through `TeamFactory(teamId).snapshotForGame(gameId)` and SHALL use its `LineupEntry` values, rather than the mutable active lineup, as player-stat attribution input | [x] → #217 |
| PGSW-002 | WHEN a completing game's team has no lineup or an incomplete lineup including no valid starting pitcher THE system SHALL silently write no `PlayerGameStats` rows for that team's side and SHALL leave the game score completed | [x] → #217 |
| PGSW-003 | WHEN the box-score distributor writes a complete team's batting rows THE system SHALL distribute `AB`, `H`, `R`, `RBI`, `HR`, `2B`, `3B`, `BB`, and `SO` among its ordered batting starters with earlier batting-order slots favored, and SHALL make `SUM(R)` exactly equal that team's `SimulationResult` score | [x] → #217 |
| PGSW-004 | WHEN the box-score distributor writes a complete team's pitching rows THE system SHALL set `GS` only for the lineup's starting pitcher, give that pitcher most generated `IP`, distribute any remaining pitching line among frozen bullpen pitchers, and merge batting and pitching values into one row for a two-way participant | [x] → #217 |
| PGSW-005 | WHEN player game-stat writing is invoked more than once for the same player and game THE system SHALL use normal create semantics and SHALL surface the existing `(playerId, gameId)` uniqueness failure rather than upserting or suppressing it | [x] → #217 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Routing after the authored-lineup pipeline (#191/#192)

The specs above describe the legacy distributor. Since SIM-021/022, `GameFactory.simulate`
routes games whose **both** sides resolve a complete authored lineup to
`AttributeDrivenSimulationEngine`, whose projection (PARP-011..014) writes those rows
instead of this writer — covering batting-order participants (9/side), `GS` on the
starting pitcher, and `outsRecorded` in place of fabricated `IP`. The legacy distributor
still runs when the authored context is unavailable (one side missing/incomplete — the
PGSW-002 scenarios, which keep asserting 10 rows incl. bullpen on the complete side) and
remains directly invocable (PGSW-005). The acceptance scenarios bind each path
accordingly; the writer itself is unchanged.

## Traceability

- HLD: `docs/high-level-design.md` — Per-Player Game Event Writer (Box-Score Distributor)
- LLD: `docs/llds/player/player-game-stats-writer.md`
- Future Gherkin/domain tests: tagged `@spec:PGSW-001` through `@spec:PGSW-005`
- Planned code: `GameFactory` completion hook and a dedicated PlayerGameStats writer domain module
