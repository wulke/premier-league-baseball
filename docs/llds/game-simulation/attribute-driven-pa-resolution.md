# LLD: Attribute-Driven PA-Resolution Pipeline (Framework Milestone)

> Upstream: [HLD: Simulation Engine Strategy Seam](../high-level-design.md#hld-simulation-engine-strategy-seam)
> (the `SimulationEngine` seam this is the second implementation behind) ·
> [HLD: Event, Grading & Reward Architecture](../high-level-design-event-grading-reward.md)
> (this engine's per-PA stream is an event chain, per that HLD's Architecture/Flow) ·
> EARS: `docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md` (`PARP-001`..) ·
> Decision record: [Map: Attribute-driven Simulation Engine (#136)](https://github.com/wulke/premier-league-baseball/issues/136)
> decisions 2/3/5/6/7/9/10/12/13, ticket [#191](https://github.com/wulke/premier-league-baseball/issues/191)

## Scope

The **framework milestone** of map #136: a second `SimulationEngine` implementation
(`AttributeDrivenSimulationEngine`) that resolves a full game from a **synthetic** lineup —
per-PA outcomes driven by player attributes, baserunners advanced for real, and per-player
`PlayerGameStats` derived from the resulting event stream, with team score **emergent**
(`ΣR`), not an independent draw. In scope:

- The attribute-read seam (`(iv, ev)` tuple persisted alongside the legacy display ratings).
- `resolvePA` — the coarse Depth-0 resolver producing the 7-outcome set.
- The baserunner-advancement sub-slot (real `R`/`RBI`).
- The inning-boundary loop (config-driven `innings`, ties allowed).
- Event-chain construction — `PlateAppearanceResolutionEvent` + `BaserunningEvent`
  instances, envelope-wrapped per the Event/Grading HLD — built **in memory only**.
- Stat projection — a pure function deriving `PlayerGameStats` rows (and team score) by
  replaying the event chain (single source of truth, decision #9).
- A `PlayerGameStats`-owning persistence function (`persistPlayerGameStats`), exercised
  directly by tests with a caller-supplied transaction.
- A minimal, types-only `EventEnvelope<TContext>` export — the smallest slice of the
  Event/Grading HLD's `events/` module this milestone needs.
- Schema addition: `PlayerGameStats.outsRecorded` (new column). Application startup probes
  existing SQLite `PlayerGameStats` tables and adds the non-null/defaulted column before any
  simulation can persist an attribute-driven projection.
- Schema addition: `MatchRules.innings` (new config field, default 9).

Explicitly **not** in scope, each named to its owner:

- **Wiring this engine into `resolveSimulationEngine()` / `GameFactory.simulate()`
  /`simulateBatch()`**, and retiring `PlayerGameStatsWriter`'s fabrication path for games
  that use it — [#192](https://github.com/wulke/premier-league-baseball/issues/192)
  (blocked by this ticket and #138), per map #136 decision #6's deliverable split:
  this milestone ships **unit-tested against synthetic lineups only**; live sim-execution
  against real, persisted lineups is #192's job.
- **The `events/` module itself** — `registerEventType()`, the runtime registry, the
  durable event-chain/reward-ledger tables, and `gradeGame(gameId)` — per
  [HLD: Event, Grading & Reward Architecture](../high-level-design-event-grading-reward.md),
  Architecture → Components. This engine constructs event instances statically and
  **never consults the registry** (producers don't), so none of that machinery is a
  prerequisite here. Tracked as a follow-up LLD (`docs/llds/events/event-registry-and-grading.md`,
  not yet written) when a consumer actually needs to persist/grade the chain.
- Additional mechanic slots beyond the PA current-form read — a steal attempt remains a
  Depth-2 event — are owned by their future depth slices. This LLD adopts the first
  #178 worked-example consumer in the existing PA slot (#193).
- **Lineup persistence, authoring, or the frozen-lineup snapshot** —
  [#138](https://github.com/wulke/premier-league-baseball/issues/138)/
  [HLD: Team Roster & Player Visibility](../high-level-design.md#hld-team-roster--player-visibility)'s
  active-lineup foundation. This LLD consumes a plain in-memory `SyntheticLineup` shape;
  no `Lineup`/`LineupEntry` rows are read or written.
- **Fielding, bullpen substitution/fatigue, injuries, weather, DH-vs-pitcher-hits
  decision logic** — Depth 1/2 slots per map #136's Out of scope. This milestone assumes
  no fielding (ball-in-play resolves directly to an outcome) and exactly one pitcher per
  team for the whole game.
- **Retiring the legacy `PlayerGameStats.IP` column** / migrating
  `PlayerFactory.getStats`'s `statsSummary()` ERA/WHIP calc to read `outsRecorded` —
  #192's job, when the fabrication writer is actually retired. This LLD only *adds*
  `outsRecorded`; it does not touch `IP` or any existing read path.
- **Extra-inning / decisive-result policy** — ties are a valid Depth-0 result (map #136
  decision #11); a competition-level tiebreak (e.g. knockout `OVERTIME`) stays a
  standings/bracket consumer concern, untouched here.

## Interface / Data Model

### New modules (`src/db/domain/simulation/`, `src/db/domain/events/`)

```ts
// src/db/domain/events/envelope.ts (NEW — minimal, types-only slice of the events/ module)
// @spec PARP-007 — mirrors #224's settled schema exactly; the registry/grading/persistence
// this envelope will eventually flow into are out of scope here (see Scope).
export interface EventEnvelope<TContext> {
  type: string;
  gameId: number;
  sequence: number;
  causedByEventId: number | null;
  context: TContext;
}
```

```ts
// src/db/domain/simulation/events.ts (NEW — baseball event-type contexts, Depth 0 only)
export interface PlateAppearanceResolutionContext {
  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  outcome: PAOutcome;
}

export interface BaserunningContext {
  runnerId: number;
  fromBase: 'batter' | 'first' | 'second' | 'third';
  toBase: 'first' | 'second' | 'third' | 'home';   // 'home' = scored
}
```

```ts
// src/db/domain/simulation/attribute-read.ts (NEW)
// @spec PARP-001 — never a pre-combined effective value (#179); each caller owns its own combination.
export type PlayerAttributeKey =
  'contact' | 'power' | 'armStrength' | 'accuracy' | 'reaction' | 'vision' | 'discipline';

export interface AttributeRead { iv: number; ev: number; }

export const readAttribute = (
  attributes: PlayerAttributes,
  key: PlayerAttributeKey,
): AttributeRead => ({ iv: attributes[key], ev: 0 });   // today: flat-7 IV, EV = 0 (#191/#193)
```

```ts
// src/db/domain/simulation/pa-resolver.ts (NEW)
// @spec PARP-002,PARP-003 — coarse Depth-0 default; a placeholder shape, not tuned formulas.
export type PAOutcome = 'out' | '1B' | '2B' | '3B' | 'HR' | 'BB' | 'SO';

export interface PAResolverInput {
  batter: PlayerAttributes;
  pitcher: PlayerAttributes;
  rng: () => number;   // caller-supplied; one draw consumed per call (PARP-016)
}

export const resolvePA = (input: PAResolverInput): PAOutcome;
```

### PA current-form combination catalog (`F-PARP-001`, #193)

`Player.attributes.ivEv` persists a separate `{ iv, ev }` pair for each flat-seven simulation
key. The existing scalar remains a display-compatible copy of innate `iv`. Freshly generated
players begin with `ev: 0`; only the future event/reward writer may add earned effort, so
generation never fabricates career history. Legacy JSON without `ivEv` reads as
`{ iv: scalar, ev: 0 }` during the additive rollout.

The PA resolver is a **today-game** consumer, following #178's worked steal/at-bat conclusion
that earned effort carries more weight than innate potential. For each of its five inputs it uses:

```
currentPARead(attribute) = 0.3 × attribute.iv + 0.9 × attribute.ev
```

It then retains the Depth-0 PA weight shifts and one-RNG-draw contract. These coefficients are
not a universal effective rating: a future scout, salary, or steal consumer must declare its own
catalog entry.

```ts
// src/db/domain/simulation/baserunning.ts (NEW)
// @spec PARP-004,PARP-005,PARP-006,PARP-007
export interface BaseState { first: number | null; second: number | null; third: number | null; }

export interface RunnerTransition {
  playerId: number;
  from: 'batter' | 'first' | 'second' | 'third';
  to: 'first' | 'second' | 'third' | 'home';
}

export interface AdvanceResult { bases: BaseState; transitions: RunnerTransition[]; }

export const advanceRunners = (
  bases: BaseState,
  outcome: PAOutcome,
  batterId: number,
): AdvanceResult;   // pure, no randomness — deterministic given (bases, outcome, batterId)
```

```ts
// src/db/domain/simulation/attribute-engine.ts (NEW)
// @spec PARP-008,PARP-009,PARP-010,PARP-011,PARP-015,PARP-016,PARP-017
export interface SyntheticLineupEntry {
  playerId: number;
  battingOrder: number;              // 1..9
  fieldingPosition: PlayerPosition | null;
  attributes: PlayerAttributes;      // inlined — the engine stays pure, no DB reads (SimulationEngine contract)
}

export interface SyntheticLineup {
  teamId: number;
  battingOrder: SyntheticLineupEntry[];   // exactly 9 entries, unique playerIds (PARP-015)
  startingPitcherId: number;              // derived by the caller, never persisted separately — matches the Lineup foundation convention
}

export class AttributeDrivenSimulationEngine implements SimulationEngine {
  constructor(private readonly seed?: number) {}
  // ctx.lineups / ctx.matchRules are required for this engine (optional on the shared
  // SimulationContext type below — RandomSimulationEngine ignores them).
  simulateGame(ctx: SimulationContext): SimulationResult;
}
```

```ts
// src/db/domain/simulation/stat-projection.ts (NEW)
// @spec PARP-011,PARP-012,PARP-013,PARP-014 — the ONLY place PlayerGameStats-shaped rows
// are derived; batting and pitching stats and team score all come from one replay of the
// same eventChain (map #136 decision #9 — no separate resolver that can drift).
export interface PlayerGameStatsProjection {
  playerId: number;
  gameId: number;
  AB: number; H: number; R: number; RBI: number; HR: number; '2B': number; '3B': number;
  BB: number; SO: number;
  GS: boolean; outsRecorded: number;
  pitchingH: number; pitchingBB: number; pitchingSO: number; ER: number;
}

export const projectPlayerGameStats = (
  eventChain: EventEnvelope<PlateAppearanceResolutionContext | BaserunningContext>[],
  lineups: { home: SyntheticLineup; away: SyntheticLineup },
): PlayerGameStatsProjection[];
```

```ts
// src/db/domain/player-game-stats-writer.ts (MODIFIED — additive)
// @spec PARP-018 — model ownership stays with PlayerGameStatsWriter (backend-standards §1);
// plain insert, same surface-duplicate-write posture as writeForCompletedGame.
export const persistPlayerGameStats = async (
  rows: PlayerGameStatsProjection[],
  transaction?: Transaction,
): Promise<void>;
```

### Extended shared types (`src/db/domain/simulation/engine.ts`, MODIFIED — additive)

```ts
export interface SimulationContext {
  gameId: number;
  homeTeam: number;
  awayTeam: number;
  lineups?: { home: SyntheticLineup; away: SyntheticLineup };   // NEW, optional
  matchRules?: MatchRules;                                       // NEW, optional
}

export interface SimulationResult {
  homeTeamResult: number;
  awayTeamResult: number;
  eventChain?: EventEnvelope<unknown>[];              // NEW, optional
  playerGameStats?: PlayerGameStatsProjection[];      // NEW, optional
}
```

`RandomSimulationEngine` (existing, #190) reads/writes none of the new optional fields —
unaffected, per the additive-extension convention already used for `Player.attributes`.

### Data model changes

| Model | Field | Type | Notes |
|---|---|---|---|
| `PlayerGameStats` | `outsRecorded` | `INTEGER NOT NULL DEFAULT 0` (NEW) | The stored integer primitive per map #136 decision #13; `IP` notation is derived at read (`outsRecorded / 3`), matching the house `birthDate → age` / rate-stat convention. **`IP` is not dropped or written by this projector** — see Scope. |
| `League.config` / `Division.config` | `matchRules.innings` | `number`, optional, default `9` | New field on the existing `MatchRules` interface (`src/api/models.ts`); `DefaultMatchRules.innings = 9`. Config-JSON, not a typed column — matches existing `matchRules` placement (backend-standards §2, "config-JSON vs. real column": domain logic branches on it, but no DB-level constraint/filter is needed). |

## Logic Flow

### `AttributeDrivenSimulationEngine.simulateGame(ctx)`

```
1. Validate ctx.lineups.home / ctx.lineups.away:
     each must have exactly 9 SyntheticLineupEntry rows with distinct playerIds,
     and a startingPitcherId matching a Pitcher fieldingPosition entry.
     Otherwise → throw new Error(...)   # PARP-015 — pure-function invariant, not a
                                          # domain/API-boundary DomainError (backend-standards §3)
2. innings = ctx.matchRules?.innings ?? DefaultMatchRules.innings   # PARP-010
3. rng = mulberry32(deriveGameSeed(this.seed ?? Date.now(), ctx.gameId))   # reuses #190's infra
4. eventChain: EventEnvelope<...>[] = []; sequence = 0
   battingIndexByTeamId = { [away.teamId]: 0, [home.teamId]: 0 }   # keyed by teamId, NOT by
                                                                     # the 'away'/'home' half-label
                                                                     # or the team object itself —
                                                                     # persists across innings,
                                                                     # wraps mod 9 — PARP-008
5. for inning in 1..innings:                                        # PARP-010
     for half of ['top', 'bottom']:
       battingTeam  = half === 'top' ? away : home
       pitchingTeam = half === 'top' ? home : away
       pitcherEntry = pitchingTeam.battingOrder.find(e => e.playerId === pitchingTeam.startingPitcherId)  # resolves the bare id to its SyntheticLineupEntry (and thus .attributes)
       pitcherId = pitcherEntry.playerId                            # single pitcher, no bullpen
       bases = { first: null, second: null, third: null }
       outs = 0
       while outs < 3:                                              # PARP-009
         entry = battingTeam.battingOrder[battingIndexByTeamId[battingTeam.teamId] % 9]
         battingIndexByTeamId[battingTeam.teamId] += 1
         outcome = resolvePA({ batter: entry.attributes, pitcher: pitcherEntry.attributes, rng })  # PARP-002, one rng() draw — PARP-016
         sequence += 1
         paEvent = { type: 'PlateAppearanceResolutionEvent', gameId: ctx.gameId, sequence,
                     causedByEventId: null,
                     context: { batterId: entry.playerId, pitcherId, battingTeamId: battingTeam.teamId, outcome } }
         eventChain.push(paEvent)

         { bases, transitions } = advanceRunners(bases, outcome, entry.playerId)   # PARP-004,005,006 — no rng consumed
         for t of transitions:
           sequence += 1
           eventChain.push({ type: 'BaserunningEvent', gameId: ctx.gameId, sequence,
                              causedByEventId: paEvent.sequence,                    # PARP-007
                              context: { runnerId: t.playerId, fromBase: t.from, toBase: t.to } })

         if outcome === 'out' || outcome === 'SO': outs += 1        # PARP-009
6. playerGameStats = projectPlayerGameStats(eventChain, { home, away })   # PARP-011,012 — the ONE projection pass
7. homeTeamResult = Σ R over playerGameStats rows for home-team players   # PARP-011, emergent
   awayTeamResult = Σ R over playerGameStats rows for away-team players
8. return { homeTeamResult, awayTeamResult, eventChain, playerGameStats }
```

### `projectPlayerGameStats(eventChain, lineups)` — the stat-projection replay

```
1. rows = one PlayerGameStatsProjection per playerId across both lineups, all counters 0,
   GS = (playerId === lineup.startingPitcherId)                    # PARP-014
2. for event of eventChain, in sequence order:
     if event.type === 'PlateAppearanceResolutionEvent':
        { batterId, pitcherId, outcome } = event.context
        if outcome !== 'BB': rows[batterId].AB += 1                # AB excludes walks
        if outcome in {'1B','2B','3B','HR'}: rows[batterId].H += 1; rows[batterId][outcome-or-HR] += 1
        if outcome === 'BB': rows[batterId].BB += 1
        if outcome === 'SO': rows[batterId].SO += 1; rows[pitcherId].pitchingSO += 1
        if outcome in {'1B','2B','3B','HR'}: rows[pitcherId].pitchingH += 1
        if outcome === 'BB': rows[pitcherId].pitchingBB += 1
        if outcome in {'out','SO'}: rows[pitcherId].outsRecorded += 1   # PARP-009,014
     if event.type === 'BaserunningEvent':
        { runnerId, toBase } = event.context
        if toBase === 'home':
          rows[runnerId].R += 1                                    # PARP-011
          rows[<batterId of the causing PA event>].RBI += 1        # PARP-013 — every run on this PA credits its batter,
                                                                     # including the batter's own HR run
          rows[<pitcher of the causing PA event>].ER += 1           # no fielding ⇒ no earned/unearned split (#136 decision 13)
3. return [...rows.values()]
```

### Key decisions embedded in this flow

- **Projection is decoupled from the inning loop, on purpose.** `simulateGame` never
  increments a stat counter itself — it only builds the `eventChain`, then hands it to
  `projectPlayerGameStats` for the one and only aggregation pass. This is map #136
  decision #9 taken literally: batting/pitching stats and team score all derive from
  replaying the *same* stream, so they cannot independently drift.
- **Additive, optional context/result fields.** `RandomSimulationEngine` needs none of
  `lineups`/`matchRules`/`eventChain`/`playerGameStats` — extending the shared interfaces
  rather than branching them keeps the existing engine, and `SIM-001..020`'s golden
  masters, untouched.
- **The engine stays pure.** `SyntheticLineup` inlines `attributes` so `simulateGame` never
  touches `db.models.*` — consistent with the existing `SimulationEngine` contract
  ("Pure — no DB access, no side effects") and with keeping this milestone testable
  against plain fixtures with no DB setup at all.
- **`events/`'s envelope type is scaffolded, nothing else is.** Constructing
  `EventEnvelope`-wrapped instances needs *a* type to construct, but the registry,
  `gradeGame`, and durable persistence this HLD eventually wants are real, separate
  pieces of work with their own future LLD — pulling them in here would make this
  milestone responsible for infrastructure no current consumer needs yet (`events/`'s
  home is `src/db/domain/events/`, matching the [HLD: Event, Grading & Reward
  Architecture](../high-level-design-event-grading-reward.md)'s module-placement
  decision; only the `envelope.ts` file is added now).
- **One pitcher, one full-game outing.** No bullpen substitution exists yet (Depth 1/2 per
  map #136's Out of scope), so every pitching stat for a half-inning accrues to the
  single `startingPitcherId` — including every out, hit, walk, and earned run allowed.
- **RBI is credited without fielding nuance.** Depth 0 has no errors/unearned-run
  distinction (no fielding at all), so every run that scores on a PA is unconditionally
  credited as that PA's batter's RBI — including the batter's own run on a HR. This
  mirrors the existing `ER = all runs allowed` precedent (map #136 decision #13) rather
  than inventing a new exception Depth 0 has no way to detect.
- **No aggressive baserunning / no outs on the bases.** `advanceRunners` is a fixed,
  outcome-keyed table (walk = force cascade; 1B/2B/3B = advance N bases; HR = clear
  bases) — a runner is never thrown out advancing and never holds when they could
  legally advance. This is a reversible Depth-0 slot, not a modeled decision; real
  send/hold logic is Depth 2 (steals/baserunning-decision territory, #180).
- **Both halves of every inning are always played in full**, including the bottom of the
  last inning when the home team already leads — no real-baseball "walk-off" early stop.
  Ties are a valid, final Depth-0 result (map #136 decision #11); adding the skip-bottom
  rule later is additive and doesn't change any prior inning's outcome.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Attribute-read seam bounds | `readAttribute` returns the persisted `ivEv` pair with no pre-combination. New generated players write an innate scalar/IV pair and neutral earned EV; legacy JSON falls back to the scalar IV and `0` EV. | PARP-001 |
| e2 | `resolvePA` weight shift pushes an outcome's weight negative | Every shifted weight is floored at `0` before the cumulative distribution is normalized to sum `1`, so a large attribute differential can zero out (never invert) an outcome's probability. | PARP-003 |
| e3 | Walk with runners on base | Force-advance cascades from first: the runner on first is always forced to second; the runner on second is forced to third only if first was occupied; the runner on third is forced home only if bases were loaded. An unforced runner holds. | PARP-004 |
| e4 | Extra-base hit / HR with runners on | 1B/2B/3B advance every existing runner exactly N bases (1/2/3); HR clears the bases and scores the batter too — `advanceRunners` never leaves an occupied base behind a hit that should have cleared it. | PARP-005, PARP-006 |
| e5 | Batting order across innings | `battingIndexByTeamId` is keyed by `teamId` (never by the `'away'`/`'home'` half-label, and never by the team object itself), initialized once, and never reset between innings — the 10th plate appearance of the game is order-index `9 % 9 = 0` (the leadoff hitter), matching real baseball's continuous batting order. | PARP-008 |
| e6 | `out` vs `SO` outcome and the out count | Both `out` and `SO` increment the half-inning's out counter identically (Depth 0 has no batted-ball detail distinguishing a strikeout from a ball-in-play out for *inning-ending* purposes) — the half-inning ends at exactly 3, never more. | PARP-009 |
| e7 | Extra innings / ties | The loop runs exactly `innings` iterations regardless of score; there is no "if tied, keep playing" branch. A tied final score is returned as-is (map #136 decision #11 — decisiveness is a standings/bracket consumer concern). | PARP-010 |
| e8 | Team score vs `RandomSimulationEngine`'s `[0,9]` range | `homeTeamResult`/`awayTeamResult` are now unbounded sums of real `R` events (no `* 10` ceiling) — a contract change *for this engine only*; `RandomSimulationEngine` is untouched and still returns `[0,9]`. Consumers that assumed the old range (if any) are #192's concern when this engine goes live. | PARP-011 |
| e9 | Stat projection vs event chain ordering | `projectPlayerGameStats` walks `eventChain` in `sequence` order and only ever reads forward (never re-visits an earlier index), so a `BaserunningEvent`'s `causedByEventId` is always already-seen — no dangling-parent lookahead is required. | PARP-012 |
| e10 | RBI on a runner's own PA (e.g., steal-adjacent plays) | Out of scope: `StealAttemptEvent`/`PickoffAttemptEvent` aren't constructed by this milestone at all (Depth 2), so every `BaserunningEvent` this projector ever sees is caused by a `PlateAppearanceResolutionEvent`, and RBI attribution has no runner-initiated case to handle. | — |
| e11 | Malformed `SyntheticLineup` (fewer/more than 9 batting entries, duplicate `playerId`, or no matching starting pitcher) | `simulateGame` throws a plain `Error` before consuming any RNG state — a caller-input-contract violation, not a `DomainError` (which is reserved for domain/API-boundary failures; this engine has no such boundary — backend-standards §3). | PARP-015 |
| e12 | Determinism / golden master | Exactly one `rng()` draw is consumed per plate appearance (`resolvePA` only); `advanceRunners` and `projectPlayerGameStats` are both pure functions of already-produced values with no further randomness — so a pinned `seed` reproduces an identical `eventChain` and `playerGameStats` projection across runs and machines, the same guarantee `SIM-017`/`SIM-018` give `RandomSimulationEngine`. | PARP-016, PARP-017 |
| e13 | `persistPlayerGameStats` called twice for the same `(playerId, gameId)` | Plain `bulkCreate`, no upsert — the existing `PlayerGameStats` unique index throws on the second call. Matches the box-score distributor's "surface duplicate writes" posture (see [HLD: Per-Player Game Event Writer](../high-level-design.md#hld-per-player-game-event-writer-box-score-distributor)); this milestone introduces no new duplicate-write guard. | PARP-018 |
| e14 | `outsRecorded` vs the legacy `IP` column on the same row | This projector writes `outsRecorded` only; it never sets `IP` (stays at its column default). A row written by the *existing* fabrication writer (`writeForCompletedGame`) sets `IP` and leaves `outsRecorded` at its default `0` — the two writers never populate the same game's rows today (this engine isn't wired into `GameFactory` yet), so there is no row with a meaningless mix of both. | — |
| e15 | Equal-IV players have distinct earned effort | `F-PARP-001` produces distinct PA reads because its `0.9 × EV` term is nonzero; the resolver must not collapse both players back to the display scalar. | PARP-019 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [HLD: Simulation Engine Strategy Seam](../high-level-design.md#hld-simulation-engine-strategy-seam), [HLD: Event, Grading & Reward Architecture](../high-level-design-event-grading-reward.md) |
| **This LLD** | `docs/llds/game-simulation/attribute-driven-pa-resolution.md` |
| Sibling LLDs | `docs/llds/game-simulation/game-simulation.md` (the seam this plugs into); `docs/llds/events/event-registry-and-grading.md` (TO BE PRODUCED — registry/grading/persistence, out of scope here) |
| EARS | `docs/specs/game-simulation/attribute-driven-pa-resolution-specs.md` — `PARP-001`..`PARP-019` |
| Gherkin | `test/bdd/features/attribute-driven-pa-resolution.feature` (domain-level; no API/UI surface changes in this slice) |
| Code | `src/db/domain/simulation/attribute-engine.ts`, `pa-resolver.ts`, `baserunning.ts`, `attribute-read.ts`, `stat-projection.ts`, `events.ts`; `src/db/domain/events/envelope.ts`; `src/db/domain/simulation/engine.ts` (MODIFIED, additive); `src/db/domain/player-game-stats-writer.ts` (MODIFIED, additive); `src/db/model/player-game-stats.ts` (MODIFIED — `outsRecorded` column); `src/api/models.ts` (MODIFIED — `MatchRules.innings`) |
| Decision record | [Map: Attribute-driven Simulation Engine (#136)](https://github.com/wulke/premier-league-baseball/issues/136), [#191](https://github.com/wulke/premier-league-baseball/issues/191), [Map: Event, Grading & Reward Architecture (#218)](https://github.com/wulke/premier-league-baseball/issues/218) |
