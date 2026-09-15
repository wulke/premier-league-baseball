# LLD: Player Stats Schema (`PlayerGameStats`)

> Upstream: [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md#hld-players-attributes-stats--contracts) ·
> EARS: `docs/specs/player/player-stats-specs.md` (`PSTAT-001`..) ·
> Decision record: [#61 Research standard baseball stat categories](https://github.com/wulke/premier-league-baseball/issues/61), [#62 Design season/career Player stats schema + write-timing plan](https://github.com/wulke/premier-league-baseball/issues/62)

## Scope

Defines the storage grain and column set for Player stats. This schema map did not implement a
writer. The approved first write-path design is now
[`player-game-stats-writer.md`](./player-game-stats-writer.md): a temporary box-score distributor
hooked after #190's score-only `SimulationEngine`. It will be superseded by
#191/#192's real per-player play-by-play events.

## Interface / Data Model

```ts
// src/db/model/ — new PlayerGameStats model
interface PlayerGameStats {
  id: number;
  playerId: number;  // FK to Player.id
  gameId: number;     // FK to Game.id
  // one row per (playerId, gameId)

  // Batting — Core only (per #61 research)
  AB: number;  // at-bats
  H: number;   // hits
  R: number;   // runs scored
  RBI: number; // runs batted in
  '2B': number; // doubles
  '3B': number; // triples
  HR: number;  // home runs
  BB: number;  // walks
  SO: number;  // strikeouts

  // Pitching — Core only (per #61), adjusted for game-grain
  GS: boolean;        // did this player start this game (replaces season-grain "games started" count)
  IP: number;         // innings pitched
  pitchingH: number;  // hits allowed
  pitchingBB: number; // walks allowed
  pitchingSO: number; // strikeouts recorded
  ER: number;         // earned runs allowed
}
```

**No `PlayerSeasonStats` or `PlayerCareerStats` tables.** Season and career stats are pure
`SUM`/`COUNT` aggregate queries over `PlayerGameStats`, filtered by year (via `Game.scheduledDate` /
`GameWorld.year`) or unfiltered (career), respectively.

### Field semantics

| Field | Notes |
|---|---|
| `G` (games played) | **Not a stored column.** Derived as `COUNT(*)` of a player's `PlayerGameStats` rows for the relevant season/career window. |
| `pitchingH` / `pitchingBB` / `pitchingSO` | **Pitching-prefixed on purpose.** Batting keeps the canonical `H` / `BB` / `SO` names, so the pitching counters need distinct column names for a two-way player's single row to remain unambiguous. |
| `2B` / `3B` | **Stored batting counting stats.** Doubles and triples supply the extra-base-hit detail needed to derive `SLG` from aggregate rows; singles are inferred as `H - 2B - 3B - HR`. |
| `W` / `L` (wins/losses) | **Dropped from v1 entirely.** Real attribution requires decision logic (starter IP thresholds, bullpen credit rules, etc.) the random `SimulationEngine` cannot produce. An always-null column was judged worse than omitting the field. |
| Rate stats (`AVG`, `OBP`, `SLG`, `OPS`, `ERA`, `WHIP`) | **Never stored.** Computed at read-time from counting-stat aggregates, at whatever grain (game/season/career) is queried — avoids drift against the counting stats they're derived from. |
| Fielding (`E`/`A`/`PO`/`FLD%`) and deferred "Common" tiers (`SB`/`CS`/`HBP`/`SV`/`HLD`/`K9`/`BB9`) | **Deferred**, not modeled by this schema. Add real-world flavor but aren't required for a believable v1 stat line or for `SimulationEngine`. |

## Logic Flow

### Computing rate stats (read-time, any grain)

```
AVG(rows)  = SUM(rows.H)  / SUM(rows.AB)
OBP(rows)  = (SUM(rows.H) + SUM(rows.BB)) / (SUM(rows.AB) + SUM(rows.BB))
totalBases(rows) = SUM(rows.H - rows.2B - rows.3B - rows.HR) + 2 * SUM(rows.2B) + 3 * SUM(rows.3B) + 4 * SUM(rows.HR)
SLG(rows)  = totalBases(rows) / SUM(rows.AB)
OPS(rows)  = OBP(rows) + SLG(rows)
ERA(rows)  = 9 * SUM(rows.ER) / SUM(rows.IP)
WHIP(rows) = (SUM(rows.pitchingBB) + SUM(rows.pitchingH)) / SUM(rows.IP)
G(rows)    = COUNT(rows)
```

`rows` is the `PlayerGameStats` set for the requested window: all rows for career, rows joined to
`Game`s within the target `year` for season.

### Write-timing

The first planned writer is a post-score box-score distributor, not a `SimulationEngine` event
producer. It snapshots each team lineup at completion, silently skips a missing/incomplete side,
and uses plain inserts (not upserts); see
[`player-game-stats-writer.md`](./player-game-stats-writer.md). #191/#192 will later replace this
temporary attribution source with real play-by-play events.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Rate stat requested where denominator is 0 (e.g. `AVG` with `AB = 0`) | Not resolved by this LLD — no writer exists yet to produce real denominators; the read-time computation's zero-division handling is left to whichever future map implements the aggregation queries. | — |
| e2 | A player who both bats and pitches in the same game | Single-table, non-role-conditioned shape (matching `Player.attributes`' flat precedent) — one `PlayerGameStats` row can carry both batting and pitching columns for the same `(playerId, gameId)`, no split needed. | PSTAT-001 |
| e3 | `SLG`/`OPS` requested from game, season, or career rows | Computable at read-time: infer singles as `H - 2B - 3B - HR`, derive `SLG` from total bases and at-bats, then add `OBP` for `OPS`. Neither rate is stored. | PSTAT-003 |
| e4 | Season/career query before any `PlayerGameStats` rows exist (current state — no writer yet) | Aggregate queries over an empty set — `COUNT` returns 0, `SUM` returns `NULL`/0 depending on driver. Not guarded by this LLD since no query implementation exists yet either. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-players-attributes-stats--contracts) |
| **This LLD** | `docs/llds/player/player-stats.md` |
| EARS | `docs/specs/player/player-stats-specs.md` — `PSTAT-001`.. |
| Code | `src/db/model/player-game-stats.ts`, `src/db/model/associations.ts` |
| Decision record | [#61](https://github.com/wulke/premier-league-baseball/issues/61), [#62](https://github.com/wulke/premier-league-baseball/issues/62) |
