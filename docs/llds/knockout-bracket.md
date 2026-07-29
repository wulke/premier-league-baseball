# LLD: Knockout Bracket Round-Advancement (`DivisionFactory` — `KNOCKOUT`)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/league-cup-specs.md` (`CUP-001`..) ·
> Decision records: [#33 Design knockout bracket round-advancement logic](https://github.com/wulke/premier-league-baseball/issues/33),
> [#43 Bracket generation must reduce the field to a power of 2](https://github.com/wulke/premier-league-baseball/issues/43) ·
> Depends on: `docs/llds/competition-format.md` (`CompetitionFormat.tiebreak`/`seeding`)

## Scope

The domain logic that takes a `KNOCKOUT` division from initial bracket generation through to a
decided champion: power-of-2 field reduction with front-loaded byes, round-advancement triggered by
game completion, tiebreak resolution for level `TWO_LEG` ties, and champion recording. Extends
`DivisionFactory.newSeason()`'s existing `KNOCKOUT` branch (`src/db/domain/division.ts`), which today
only seeds round 1 with naive greedy pairing and has no path past it.

## Interface / Data Model

### New table: `SeasonResult`

```ts
// src/db/model — new model
SeasonResult {
  id: number;              // PK
  divisionId: number;      // FK → Division
  year: number;
  championTeamId: number | null;  // FK → Team; null until decided
}
```

General-purpose (not knockout-only): also written by the round-robin League once its top-tier
division decides (`docs/llds/full-season-ui.md`, #40). One row per `(divisionId, year)`.

### Reused fields (no schema change)

| Model | Field | Reuse |
|---|---|---|
| `Game` | `awayTeam` (nullable) | Bye rows: `awayTeam: null`, created already `COMPLETED`, bye team recorded as winner. |
| `Game` | `round` | Tiebreaker games under `ANOTHER_GAME_W_OVERTIME` reuse the tied legs' `round` number rather than incrementing — round-completeness naturally waits for them. |
| `DivisionSeason` | `bracketSlot` | Existing seed/bracket-order field, read by `FIXED` seeding to determine bye/pairing order. |

### Bracket generation math (round 1)

For N teams, reduce to the next-lower power of 2 (P):

```
X = N - P            // number of round-1 ties (play-in matches)
Y = 2P - N           // number of round-1 byes
check: X + Y == P    // every subsequent round then halves cleanly: P → P/2 → ... → 1
```

Example (default League Cup, N=44 → P=32): 12 ties (24 teams) + 20 byes = 32.

| Round | Teams in → out | Ties | Label |
|---|---|---|---|
| 1 | 44 → 32 | 12 played + 20 byes | 1st Round |
| 2 | 32 → 16 | 16 | Round of 32 |
| 3 | 16 → 8 | 8 | Round of 16 |
| 4 | 8 → 4 | 4 | Quarterfinals |
| 5 | 4 → 2 | 2 | Semifinals |
| 6 | 2 → 1 | 1 | Final |

Round labels are tournament-convention strings (not generic "Round N"), computed from the round's
team count and carried via the existing `divisionName`/`roundLabel` fields.

## Logic Flow

### Bracket generation (`DivisionFactory.newSeason()`'s `KNOCKOUT` branch)

```
1. N = teams.length; P = largest power of 2 <= N
2. X = N - P   // play-in ties
   Y = 2P - N  // byes
3. IF seeding == 'FIXED':
     byes go to the top Y seeds (by bracketSlot order); remaining teams play the X ties
   ELSE (REDRAW):
     teams shuffled; first Y (post-shuffle) get byes, remainder paired into X ties
4. FOR each of the X ties:
     create Game row(s) per CompetitionFormat.legs (ONE_LEG=1, TWO_LEG=2), round=1
5. FOR each of the Y byes:
     create one Game row: { awayTeam: null, round: 1, status: 'COMPLETED',
                             homeTeamResult: <bye winner marker>, awayTeamResult: null }
     # bye team recorded as winner directly — no simulation run
```

### Round-advancement (hooked into shared game-completion path)

Wired into the completion path shared by `GameFactory.simulate()` (single) and `simulateBatch()`
(batch) — not batch-specific, not a lazy read-time check:

```
ON game completion (any Game row reaching status COMPLETED):
  IF game's division.structure != 'KNOCKOUT' → no-op (round-robin unaffected)
  IF this game was NOT the last unresolved game in its round → no-op, wait for the rest
  ELSE (round complete):
    winners = []
    FOR each tie in this round:
      IF tie is a bye → winners.push(bye team)
      ELSE:
        aggregate = sum of runs across the tie's legs, per team
        IF aggregate is decisive → winners.push(aggregate winner)
        ELSE (aggregate level — see Tiebreak below):
          resolve per CompetitionFormat.tiebreak → winners.push(resolved winner)
          # AGGREGATE_SCORE: no further fallback: this branch does not
          #   apply — an aggregate tie under AGGREGATE_SCORE is left unresolved
          #   (known accepted edge case, out of scope here)
    IF winners.length == 1:
      SeasonResult.upsert({ divisionId, year, championTeamId: winners[0] })
    ELSE:
      nextRoundTeams = winners (re-shuffled if seeding == 'REDRAW', else bracket order)
      generate nextRoundTeams' pairings as round = currentRound + 1
      # from round 2 onward the team count is always an exact power of 2 (no more byes)
```

### Tiebreak modes (`CompetitionFormat.tiebreak`, `TWO_LEG` ties only)

| Mode | Behavior |
|---|---|
| `AGGREGATE_SCORE` | Sum runs across both legs; higher aggregate advances. **No further fallback** if the aggregate is also level — accepted unresolved edge case for competitions that don't need a guaranteed decisive outcome. |
| `OVERTIME` | On an aggregate tie, extend the **last leg's existing `Game` row** in place (overtime innings are a simulation detail — no new row). That leg's results are overwritten with a decisive (non-draw) score. |
| `ANOTHER_GAME_W_OVERTIME` | On an aggregate tie, create a **new tiebreaker `Game` row**, same `round` number as the tied legs (not the next round). This game cannot end in a draw. |

### Seeding modes

| Mode | Round 1 | Every later round |
|---|---|---|
| `FIXED` | Byes go to the top-P seeds by `bracketSlot`; remaining lowest seeds play the play-in ties. | Winners paired in bracket order — no shuffle, ever. |
| `REDRAW` | Byes/pairings randomly assigned among the initial field. | Winners re-shuffled before pairing, **every round** (not just round 1) — round *sizes* stay fixed by the power-of-2 reduction; only *who* is paired changes. |

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Odd/non-power-of-2 team count | Reduced via the power-of-2 formula above — not a bare "one bye if odd" rule. Superseded #33's original odd-count-only bye assumption. | CUP-009 |
| e2 | Bye row | Created already `COMPLETED`, `awayTeam: null`, no simulation run — counts toward "round complete" trivially since it's resolved at creation time. | CUP-003 |
| e3 | `AGGREGATE_SCORE` tie also level | Left unresolved — a known, accepted gap. Competitions needing a guaranteed decisive outcome must configure `OVERTIME` or `ANOTHER_GAME_W_OVERTIME` instead. Not treated as a domain error. | CUP-004 |
| e4 | Round-advancement trigger ordering | Fires as a side effect of *whichever* game completion (single or batch) happens to be the round's last — batch simulate resolves many games in one transaction, so the check for "last unresolved game in round" must run after all of that transaction's writes, not per-row mid-transaction, to avoid a false "round complete" on a partially-written batch. | CUP-001 |
| e5 | `REDRAW` reshuffling round sizes | REDRAW must never change round *sizes* (fixed at generation time) — only pairing order. A shuffle implementation that also varies bye counts per round would violate the power-of-2 invariant established at generation. | CUP-007 |
| e6 | `SeasonResult` write timing | Upserted (not inserted blindly) — round-advancement could in principle be re-triggered defensively; `championTeamId` should not be overwritten once set for a `(divisionId, year)`. | CUP-002 |
| e7 | `seriesLength` (`Bo3`/`Bo5`) vs. `legs` | This LLD's tie resolution operates on `legs` (`ONE_LEG`/`TWO_LEG`), not `seriesLength` — best-of-N series generation is not yet implemented (see `competition-format.md` e3); a `KNOCKOUT` division's `seriesLength` field is currently inert. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/knockout-bracket.md` |
| EARS | `docs/specs/league-cup-specs.md` — `CUP-001`.. |
| Code | `src/db/domain/division.ts` (`DivisionFactory` — `newSeason`, `KNOCKOUT` branch), `src/db/domain/game.ts` (completion hook), new `SeasonResult` model |
| Decision records | [#33](https://github.com/wulke/premier-league-baseball/issues/33), [#43](https://github.com/wulke/premier-league-baseball/issues/43) |
