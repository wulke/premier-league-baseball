# LLD: Per-Player Game Event Writer (Box-Score Distributor)

> Upstream: [HLD: Per-Player Game Event Writer](../../high-level-design.md#hld-per-player-game-event-writer-box-score-distributor) ·
> EARS: `docs/specs/player/player-game-stats-writer-specs.md` (`PGSW-001`..`PGSW-005`) ·
> Successor: #191/#192 replace this distributor with attribute-driven play-by-play output.
>
> **Status: Implemented by #217.**

## Interface / Data Model

```ts
// planned domain entry point, called only from GameFactory's shared completion path
PlayerGameStatsWriter().writeForCompletedGame({
  gameId,
  homeTeamId,
  awayTeamId,
  result: { homeTeamResult, awayTeamResult },
}): Promise<void>
```

The writer consumes `Lineup(gameId)` and its `LineupEntry` rows, never the mutable active lineup.
For a team side, a complete lineup has all of the following:

- nine distinct `STARTER` entries with batting orders 1 through 9 exactly once;
- one valid `STARTER` at `fieldingPosition: 'Pitcher'` (the `startingPitcherId`);
- all participating entry `playerId`s still resolve to that team; and
- an existing frozen lineup, either already present or created by
  `TeamFactory(teamId).snapshotForGame(gameId)`.

The batting participants are those nine ordered starters. Pitching participants are the starting
pitcher plus frozen `BULLPEN` entries. The persisted player set is their union; a starter who
also pitches receives one combined row. `BENCH` entries receive no row because this distributor
does not model substitutions.

The writer uses plain `PlayerGameStats.bulkCreate()` (or `create()` for one row), never upsert.
The existing unique `(playerId, gameId)` index is therefore the intentional idempotency boundary.

## Logic Flow

```
GameFactory completion hook (both simulate paths):
  → call writeForCompletedGame with the SimulationResult already persisted on Game
  → for each { teamId, teamRuns } in home then away:
       attempt snapshotForGame(gameId)
       load and validate that frozen lineup
       IF snapshot is absent, cannot be created, or is incomplete: continue (silent skip)
       construct batting and pitching participant maps keyed by playerId
       allocate batting stats; allocate pitching stats; merge maps
       bulkCreate that side's PlayerGameStats rows
```

### Batting allocation

Each allocation selects batting participants with replacement using this batting-order weight
vector, indexed one through nine: `[1.14, 1.11, 1.08, 1.05, 1.00, 0.96, 0.92, 0.89, 0.85]`.
Thus every batter can receive any count, while earlier slots receive more in expectation. The
writer first generates an unconstrained non-negative fabricated team total for `AB`, `H`, `RBI`,
`HR`, `2B`, `3B`, `BB`, and `SO`, then allocates each total independently with that vector.

`R` is the sole exception: its input is exactly `teamRuns` from
`SimulationResult.homeTeamResult` or `.awayTeamResult`, and allocation guarantees
`SUM(batting.R) === teamRuns`. `RBI` is deliberately not reconciled to runs, and extra-base hits
are deliberately not constrained by `H`; those are fabricated v1 counts, not resolved plays.

### Pitching allocation

The writer generates unconstrained non-negative fabricated team totals for `IP`, `pitchingH`,
`pitchingBB`, `pitchingSO`, and `ER`. `GS` is `true` only for the derivable starting pitcher.
The starter receives a strict majority of any positive `IP` total; the remainder is allocated
among frozen bullpen pitchers. With no bullpen, the starter receives all IP. Pitching `H`, `BB`,
`SO`, and `ER` are allocated independently across the same pitcher set. They do not reconcile to
the opponent's batting totals or score, and total IP is not required to equal nine.

No allocation has a plausibility validation, per-player cap, team-total cap, or correction pass.
Random selection is an implementation detail; the required observable contracts are exact run
reconciliation, batting-order-biased allocation, starter-majority IP, and the column semantics
above.

### Completion-hook placement

The hook runs after `GameFactory` has successfully persisted `status: COMPLETED` and both score
columns. It is invoked once per newly completed game in both `simulate()` and the post-commit
completion loop of `simulateBatch()`, before later completion consumers need player stats. It
must not move score generation into `SimulationEngine`: #190 keeps the engine pure and limited to
`SimulationResult` production.

Each team side is independent. Build all rows for a valid side before its one plain bulk insert;
do not create partial rows for an incomplete side. A duplicate invocation reaches the unique
index and throws. This is intentional: no completed-game re-simulation flow exists.

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| No active or frozen lineup exists when completion snapshots a team | Silently skip that team side; the score remains completed and the other side may write. | PGSW-002 |
| Frozen/active lineup lacks a valid pitcher, nine unique batting slots, or a current-team participant | Silently skip that team side; write no `PlayerGameStats` rows for it. | PGSW-002 |
| Snapshot was already created by next-game lineup UI | Reuse its frozen entries unchanged; never copy the current active template over it. | PGSW-001 |
| A designated hitter is present | It is one of the nine batting-order participants; the pitcher may have no batting allocation. | PGSW-003 |
| Starting pitcher also bats | Merge batting and pitching allocation into that player's one `(playerId, gameId)` row. | PGSW-004 |
| No bullpen pitchers | Starter receives all generated IP and is the only pitching participant. | PGSW-004 |
| `teamRuns` is zero | Allocate zero `R` exactly; all other fabricated counts may still be non-zero. | PGSW-003 |
| Completion writes twice for a game | Do not upsert or swallow it; the unique index throws and exposes the completion bug. | PGSW-005 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — Per-Player Game Event Writer (Box-Score Distributor) |
| EARS | `docs/specs/player/player-game-stats-writer-specs.md` — `PGSW-001`..`PGSW-005` |
| Tests | `test/bdd/features/player-game-stats-writer.feature` plus its step bindings cover single/batch snapshotting, silent side-local skips, run reconciliation, IP ownership, and duplicate-write surfacing |
| Code | `src/db/domain/game.ts`, `src/db/domain/player-game-stats-writer.ts`, `src/db/model/player-game-stats.ts` |
