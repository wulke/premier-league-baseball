# LLD: Multi-stage season run-path (dependent stages)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> Config LLD: [`competition-format.md`](./competition-format.md) (#79 Stage model, #80 `TOP_N_PER_DIVISION` seeding, #81 champion generalization) ·
> EARS: `docs/specs/multi-stage-season-specs.md` (`MSS-001`..) ·
> Decision record: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → ticket [#87](https://github.com/wulke/premier-league-baseball/issues/87)

## Scope

The run-path that makes a League's ordered, dependent `stages[]` actually *simulate*: group stage (round-robin) → cross-phase seeding → knockout → champion. This is the **proving slice** (#87) that validates the generalized config model (#79–#95) is real, implemented end-to-end as the **old Champions League**.

**In scope (Slice B):**
- Stage-aware `create` (minimal: read `stages`, stamp `stageId`; keep the legacy `divisions` + league-level format fallback so PL/Cup still build — full migration is Slice A).
- `start()` restricts season kickoff to the **first** stage's divisions.
- `getSeedTeamIdsForDivision` branches for `TOP_N_PER_DIVISION` (rank-then-group emit from the source stage's final standings); `BEST_OF_REST`/`TIERED_RANK` reserved (config-surface only — no scheduler builds them this map).
- Event-driven dependent-stage advance, hooked into the shared game-completion path alongside the existing knockout/round-robin resolvers.
- `isTopTier` champion gate moved into `recordSeasonChampionIfMissing` so both paths consult it (group stage records nothing; the final knockout division records the champion).

**Out of scope (other slices / map):** the config-surface *migration* (rename `seriesLength`→`winsToAdvance`, drop league-level `format`+`resolveCompetitionFormat`, drop `LeagueConfig.divisions`, rewrite PL/Cup templates) — **Slice A**. Minimal UI (surface that the bracket is seeded from groups) — **Slice C**. Swiss scheduler, best-of-N engine, MLB fixture matrix, cross-League qualification — out of scope for map #78.

## Interface / Data Model

The seam is small because `DivisionFactory.newSeason` is **already seed-driven**: it calls `getSeedTeamIdsForDivision()`, today a stub returning `config.defaultTeams` (its own docstring lists cross-stage seeding as a future use case). Four coordinated changes:

### 1. `DivisionConfig.stageId` + `stageOrder` — stamped at create (no new table, per #79)

```ts
interface DivisionConfig { /* existing fields */ stageId?: string; stageOrder?: number }
```
Two fields stamped from the enclosing `Stage` when the division is created:

- **`stageId`** — the enclosing `Stage.id`. Resolves "which divisions belong to stage X" without a schema change — the source stage's divisions are found by matching `stageId` against a consuming division's `seedingSelection.fromStage`.
- **`stageOrder`** — the division's index within its `stage.divisions[]` array. Carries config **declaration order** into the runtime as an explicit, queryable value, so `TOP_N_PER_DIVISION` emit (§2) sorts source divisions on a real input. The existing legacy `create` fires divisions via `Promise.all`, so `Division.id` ordering is **not** a reliable proxy for declaration order — `stageOrder` makes it a designed guarantee instead (see edge case e10).

### 2. `getSeedTeamIdsForDivision(year)` — branch on `seedingSelection`

```ts
// src/db/domain/division.ts
const getSeedTeamIdsForDivision = async (year: number): Promise<number[]> => {
  const division = await db.models.Division.findByPk(id);
  const config = division.config;
  const selection = config.seedingSelection;

  if (!selection) return config.defaultTeams;                    // unchanged — pool allocation

  // Resolve source-stage divisions by stageId (cross-stage seed sources are always a
  // prior stage's divisions in this League).
  const league = await db.models.League.findByPk(division.leagueId, { include: [db.models.Division] });
  const sourceDivisions = league.Divisions
    .filter((d) => d.config.stageId === selection.fromStage)
    .sort(byStageDivisionOrder);                                 // by config.stageOrder (§1 declaration order)

  switch (selection.kind) {
    case 'TOP_N_PER_DIVISION':                                   // #80 — old CL
      return emitTopNPerDivision(sourceDivisions, selection.topN, year, league.config.standingsConfig);
    case 'BEST_OF_REST':                                         // #84 — reserved, config-surface only
    case 'TIERED_RANK':                                          // #95 — reserved, config-surface only
      throw new DomainError(`SeedingSelection '${selection.kind}' has no scheduler (config-surface only)`, 422);
  }
};
```

**`TOP_N_PER_DIVISION` emit order** (#80: rank outer, source-stage `divisions[]` order inner):

```
emitTopNPerDivision(sourceDivisions, topN, year, standingsConfig):
  perSource = for each srcDiv: DivisionFactory(srcDiv).getStandings(year, standingsConfig) → teamIds
  result = []
  for rank in 1..topN:               # outer: rank
    for srcDiv in sourceDivisions:   # inner: declaration order
      if perSource[srcDiv].length >= rank: result.push(perSource[srcDiv][rank-1].teamId)
  return result
```

For old-CL: 8 groups × top-2 → `[G1#1, G2#1, … G8#1, G1#2, … G8#2]` → 16 seeds. The knockout's `seeding:'REDRAW'` then shuffles them for round-1 pairing (the constrained winners-vs-runners-up draw fidelity gap is accepted fog, not scope).

### 3. `recordSeasonChampionIfMissing` — gains the `isTopTier` gate (#81)

```ts
// src/db/domain/season-result.ts
export const recordSeasonChampionIfMissing = async (divisionId, year, championTeamId) => {
  const division = await db.models.Division.findByPk(divisionId);
  if (division.config.isTopTier !== true) return;   // #81 — single gate; both RR + KO paths consult it
  /* ...existing write-if-missing... */
};
```

Consequences:
- `resolveRoundRobinGameCompletion`'s own `isTopTier` early-return becomes redundant (the gate now lives in the writer); it is removed to a single source of truth.
- `advanceKnockoutRound`'s call to `recordSeasonChampionIfMissing` is **newly gated**: the old League Cup division will need `isTopTier: true` set (landed in Slice A's template rewrite). For old-CL, only the knockout division carries `isTopTier: true`; the eight groups carry none → they record nothing.
- Generalizes the round-robin `isTopTier` gate already spec'd in [`league-champion-specs.md`](../specs/league-champion-specs.md) (`LCH-001`..`LCH-004`, #54) — `MSS-008` moves that single gate into the writer so the knockout path consults it too; RR-path behavior is unchanged.

### 4. Event-driven dependent-stage advance — new module `stage-advancement.ts`

```ts
// src/db/domain/stage-advancement.ts
// @spec MSS-xxx — completion-path entry: derives division/year from the game and advances
// the league's dependent stage if its source is complete. Idempotent (mirrors
// advanceKnockoutRound's guards).
export const resolveCrossStageAdvancement = async (gameId: number): Promise<void> => { /* ... */ }

// Idempotent: no-ops when the source stage is incomplete, or the dependent divisions are
// already started this year.
export const advanceStageIfReady = async (leagueId: number, year: number): Promise<void> => { /* ... */ }
```

Lives in its own module (like `knockout-advancement.ts`) to avoid a circular import with `division.ts`, which imports `GameFactory`. Hooked from `game.ts` symmetrically with the existing resolvers:

```ts
// src/db/domain/game.ts — both simulate() and the simulateBatch() after-commit loop:
await resolveKnockoutGameCompletion(id);
await resolveRoundRobinGameCompletion(id);
await resolveCrossStageAdvancement(id);   // new — multi-stage dependent advance
```

## Logic Flow

```
create(gwId, config, teamIdRefs):                       # minimal stage-aware (Slice B)
  stages = config.stages ?? [{ id:'_default', name:'_default', divisions: config.divisions ?? [] }]
  for stage in stages:
    for index, div in enumerate(stage.divisions):        # index → stageOrder (declaration order, §1)
      Division.create({ config: { ...div,
        stageId: stage.id,
        stageOrder: index,
        defaultTeams: div.defaultTeams.map(idx -> teamIdRefs[idx]),
        format: resolveCompetitionFormat(div, config)   # legacy league-level fallback kept (dropped in Slice A)
      }})
  # NB: declaration order is carried by the stamped stageOrder field, so it is robust to
  # insertion/id ordering — create may stay parallel or become sequential without affecting emit.

start():                                                 # season kickoff — FIRST stage only
  firstStage = config.stages[0]   # the legacy single-stage shape collapses to this too
  for div in divisions where stageId === firstStage.id:
    DivisionFactory(div).newSeason(year-1, year)

# --- event-driven fork (chosen: option (a)) ---
resolveCrossStageAdvancement(gameId):
  derive (divisionId, year) from the game's DivisionSeason (same walk as resolveKnockoutGameCompletion)
  league = Division.leagueId
  advanceStageIfReady(league, year)

advanceStageIfReady(leagueId, year):                     # idempotent
  league = League.findByPk(leagueId, include:[Division])
  stages = league.config.stages   # declaration order
  for (S, Snext) in zip(stages, stages[1:]):
    srcDivs   = divisions where stageId === S.id
    ready     = srcDivs.every(d => DivisionFactory(d).isSeasonComplete(year))
    dependents = divisions where stageId === Snext.id && config.seedingSelection?.fromStage === S.id
    unstarted  = dependents.filter(d => no DivisionSeason row for (d, year))
    if ready && unstarted.length > 0:
      for d in unstarted:
        DivisionFactory(d).newSeason(year, year)   # seeds → bracketSlot → round-1 pairings (+TWO_LEG return legs)
      return                                        # one transition per call; cascades via subsequent game completions
```

`newSeason(year, year)` for a dependent division: its `isSeasonComplete(year)` precondition is vacuously true (no prior DivisionSeason row exists), then `getSeedTeamIdsForDivision(year)` reads the now-final source standings, and the existing KNOCKOUT branch builds the bracket. The existing `TWO_LEG` return-leg generation and `advanceKnockoutRound` cascade then drive the bracket to a champion with **no further changes**.

**Why the two `newSeason` argument shapes differ.** `start()` calls `newSeason(year-1, year)` to cross the year boundary into a fresh season — the prior season (`year-1`) must be complete, vacuously true for a brand-new league's first kickoff. The dependent-stage advance calls `newSeason(year, year)` because the knockout is a **within-year phase transition** of the same season (the group stage just completed for `year`); passing the default `newSeason(year)` would wrongly stamp the knockout's `DivisionSeason` as `year+1`. In both cases `isSeasonComplete` is satisfied (vacuously for a division with no prior `DivisionSeason` row).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Dependent division's source stage not yet complete | `advanceStageIfReady` no-ops on the `ready` check; seeds computed only once the source is final | MSS-advance |
| e2 | Re-entry: batch-sim or a second completion path re-fires `resolveCrossStageAdvancement` for the same league/year | Idempotent — `unstarted` filter excludes divisions that already have a `DivisionSeason` for the year (mirrors `advanceKnockoutRound`'s `alreadyAdvanced` guard) | MSS-advance |
| e3 | Source group has fewer teams than `topN` | Unreachable for old-CL (field-size invariant — 4 teams/group, top-2); `emitTopNPerDivision` clamps to available length defensively | MSS-seed |
| e4 | Group stage division tries to record a champion | `isTopTier` unset on groups → `recordSeasonChampionIfMissing` no-ops; only the knockout division (`isTopTier:true`) records | MSS-champion |
| e5 | `isSeasonComplete` / `cutover` across stages | `every(division)` across flattened stages already correct — false until the final knockout is decided; gates `cutover` unchanged | (existing) |
| e6 | Parallel divisions in one stage (old-CL: 8 groups) | All start at `stages[0]`; stage "complete" only when all 8 are done (the `every` in e1) | MSS-advance |
| e7 | A division with `seedingSelection` but `BEST_OF_REST`/`TIERED_RANK` | `getSeedTeamIdsForDivision` throws `422` at run time — these arms are config-surface only (no scheduler this map); #86 guards their presence in real configs | MSS-seed |
| e8 | Legacy PL/Cup after the minimal `create` change | `config.stages` is undefined → the `_default` fallback wraps `config.divisions`; `stageId='_default'`; `resolveCompetitionFormat` still applies the league-level fallback (dropped only in Slice A). No PL/Cup regression | (compat) |
| e9 | Dependent division's `newSeason` runs before any source games were simulated | Cannot happen — `advanceStageIfReady` is only invoked from the game-completion path, which requires at least one source game to have completed | MSS-advance |
| e10 | Two divisions in one stage declare in a fixed order but the DB inserts them out of order (legacy `create` used `Promise.all`, so `Division.id` is nondeterministic) | `stageOrder` (stamped from the `stage.divisions[]` index at create) is the sort key for `TOP_N_PER_DIVISION` emit — declaration order is a designed guarantee, not a side-effect of `Division.id` ordering | MSS-002 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/multi-stage-season.md` |
| Config LLD | [`competition-format.md`](./competition-format.md) (#79–#95 additive surface) |
| EARS | `docs/specs/multi-stage-season-specs.md` — `MSS-001`.. (next step) |
| Gherkin | `test/bdd/features/multi-stage-season.feature` + step defs (Tests step) |
| Code | `src/db/domain/division.ts` (`getSeedTeamIdsForDivision`, `newSeason`), `src/db/domain/league.ts` (`create`, `start`), `src/db/domain/stage-advancement.ts` (new), `src/db/domain/season-result.ts` (`recordSeasonChampionIfMissing` gate), `src/db/domain/game.ts` (completion hook) |
| Decision record | [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87) |
