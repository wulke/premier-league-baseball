# HLD: Event, Grading & Reward Architecture

> Backed by [Map: Event, Grading & Reward Architecture](https://github.com/wulke/premier-league-baseball/issues/218)
> — a wayfinder planning map whose five resolved tickets ([#219](https://github.com/wulke/premier-league-baseball/issues/219),
> [#220](https://github.com/wulke/premier-league-baseball/issues/220),
> [#221](https://github.com/wulke/premier-league-baseball/issues/221),
> [#222](https://github.com/wulke/premier-league-baseball/issues/222),
> [#224](https://github.com/wulke/premier-league-baseball/issues/224)) are the source decisions
> for this HLD. **Standalone document**, per the map's Destination — cross-referenced from
> [HLD: Simulation Engine Strategy Seam](./high-level-design.md#hld-simulation-engine-strategy-seam)
> in the main catalog (`docs/high-level-design.md`), which this document does not replace or fold
> into. **Upstream of [#191](https://github.com/wulke/premier-league-baseball/issues/191)**
> (Framework milestone: attribute-driven PA-resolution pipeline) — #191's LLD is deliberately
> blocked on this HLD's approval so it doesn't invent ad hoc event boundaries this document would
> then have to unwind. Assumes [HLD: Simulation Engine Strategy Seam](./high-level-design.md#hld-simulation-engine-strategy-seam)
> (map #136) is already on `main`; this document is the sibling seam to that one, not a
> replacement.

## Goal

Introduce a generic **Event → Grading → Reward** architecture: game occurrences register as
typed event types, each declaring a JSON-serializable input-context shape, an
expected-vs-actual comparison mode, a per-type cadence (`synchronous` / `batched`), and a
pluggable reward-formula slot producing a typed reward payload. The architecture is generic —
it must not hardcode baseball — but is validated concretely against one real worked chain
(baseball's in-game events: batting → trajectory → fielding → baserunning) and checked for
extensibility against a non-Player, non-in-game example (an umpire's ball/strike call).
Producing a typed `RewardResult` is this document's boundary: reward storage/application onto
entities, the actual EV-delta formulas, and Stats UI consumption are downstream consumers, out
of scope here.

## Strategy

- **Options (grading timing — in-sim vs. post-game)**:
  - Option A: Each event computes its own expected-vs-actual judgment inline, as it's produced
    during simulation.
  - Option B (chosen): Events carry **pure mechanical sim output only** — no
    expected-vs-actual judgment baked into any event type. Grading is a separate pass, run
    **post-game**.
  - **Decision**: Option B, resolved in [#219](https://github.com/wulke/premier-league-baseball/issues/219).
    Coupling grading to production would force every simulation step to carry grading latency
    and complexity it doesn't need to produce a score. Separating "what happened" (the event
    chain) from "how well it graded" (the ledger) keeps the simulation engine pure and lets
    grading be replayed/re-run independently — the same seam philosophy as
    [HLD: Simulation Engine Strategy Seam](./high-level-design.md#hld-simulation-engine-strategy-seam)'s
    engine/consumer split.

- **Options (registration mechanism)**:
  - Option A: Compile-time-only dispatch (a switch/lookup hardcoded per known event type).
  - Option B (chosen): A runtime registry — `registerEventType()` writing into a
    `Map<string, EventTypeDefinition>`.
  - **Decision**: Option B, resolved in [#220](https://github.com/wulke/premier-league-baseball/issues/220).
    A non-Player event type ([#222](https://github.com/wulke/premier-league-baseball/issues/222)'s
    Umpire example, and future Manager/Scout/Referee types) needs to register without touching
    core grading code. No registry pattern of this kind exists anywhere in `src/` today — this
    introduces the first one.

- **Options (module placement relative to `simulation/`)**:
  - Option A: Fold the event/grading machinery into `src/db/domain/simulation/` directly.
  - Option B (chosen): New sibling module `src/db/domain/events/`, generic machinery only
    (envelope type, registry, grading-pass operation, event-chain + reward-ledger persistence
    logic). Baseball event-type definitions and their registration calls live in `simulation/`,
    keeping `events/` baseball-free.
  - **Decision**: Option B, resolved in [#221](https://github.com/wulke/premier-league-baseball/issues/221).
    A baseball-free `events/` module is exactly the path [#222](https://github.com/wulke/premier-league-baseball/issues/222)'s
    extensibility check needs to exercise for a future non-Player event type — folding baseball
    specifics into the generic module would undermine the generalization the map exists to
    prove. The dependency edge is types-only and one-directional: `simulation/` imports the
    envelope/interface types from `events/`; `events/` imports nothing from `simulation/`.
    Grading mechanisms are swappable wholesale without `simulation/` changing.

- **Options (chain construction & persistence)**:
  - Option A: Live emission — event instances are pushed out as simulation runs (an
    observer/pubsub pattern).
  - Option B (chosen): The engine builds the full envelope-wrapped chain **in memory**, pure
    and deterministic (golden-master-pinnable, assigning `sequence` + `causedByEventId` as it
    goes), and returns it inside an **extended `SimulationResult`**. `GameFactory` — the
    existing transaction owner — persists it in-transaction, the same pattern
    [#191](https://github.com/wulke/premier-league-baseball/issues/191)'s `PlayerGameStats`
    write already uses.
  - **Decision**: Option B, resolved in [#221](https://github.com/wulke/premier-league-baseball/issues/221).
    Live emission breaks engine purity and couples simulation cadence to consumer cadence; an
    outside-observer wrapper can't see inside the PA loop where the causal chain actually forms.
    Returning the chain through the existing `SimulationResult`/`GameFactory` transaction seam
    needs no new cross-cutting mechanism — it reuses the one #190 already established. Events
    are persisted to a **new, low-level event-chain table**, separate from the existing
    box-score/game-result table, specifically so the recorded chain can be replayed and
    validated against the box score.

- **Options (grading trigger model)**:
  - Option A: Grading runs only as a hard-wired side effect of game completion — no other
    entry point.
  - Option B (chosen): `gradeGame(gameId)` is a **first-class, re-runnable, idempotent**
    operation — a pure function of *(durable event chain, registry)*. `GameFactory`'s
    post-commit completion path is merely the **default trigger** for `synchronous`-cadence
    types; retroactive re-grades, batched triggers, and admin/analysis tooling all invoke the
    same operation.
  - **Decision**: Option B, resolved in [#221](https://github.com/wulke/premier-league-baseball/issues/221).
    Running grading post-commit (not inside the game-write transaction) keeps that transaction
    small and means a grading failure never rolls back an already-completed game — it's
    retryable from the durable chain. Modeling it as a standalone operation rather than a
    completion side-effect is what makes retroactive re-grading (a formula changing after the
    fact) possible without a second, divergent code path.

- **Options (reward-ledger shape)**:
  - Option A: Overwrite reward rows in place when a formula is re-run.
  - Option B (chosen): **Append-only ledger** — *(event instance id, event type, formula
    identity, `RewardResult` payload, pass id/timestamp)*; a retroactive re-grade appends a new
    pass and marks prior rows superseded, never edits them.
  - **Decision**: Option B, resolved in [#221](https://github.com/wulke/premier-league-baseball/issues/221).
    Overwrite-in-place destroys the traversable history (player → ledger rows → event instances
    → game) that admin/dev/analysis tooling needs, and that reverse traversal was the scaling
    concern that shaped this decision. Persisting graded results is this document's scope;
    applying reward deltas to entities remains
    [#193](https://github.com/wulke/premier-league-baseball/issues/193)'s. The concrete
    formula-versioning scheme and how #193 reconciles superseded passes are **not** decided
    here — see [Out of scope](#out-of-scope).

- **Options (envelope field set)**:
  - Option A: A rich envelope carrying a timestamp and a generic entity/target-ref field
    alongside the type-specific context, anticipating near-future per-entity queries.
  - Option B (chosen): A minimal four-field envelope — `type: string`, `gameId: number`,
    `sequence: number` (one monotonic order per game, no separate per-PA numbering), and
    `causedByEventId: number | null` (single nullable parent) — wrapping the type-specific
    `context`. No timestamp, no generic entity/target-ref field.
  - **Decision**: Option B, resolved in [#224](https://github.com/wulke/premier-league-baseball/issues/224).
    Simulation is deterministic and graded post-game, so there is no meaningful "when" beyond
    the total order `sequence` already provides — an operational `createdAt` belongs on the
    storage row, not the domain envelope. PA-level grouping is derivable by walking
    `causedByEventId` back to a PA's root event, so a second per-PA numbering scheme would just
    be a second source of truth for the same grouping. A generic entity-ref field would commit
    every event to carrying a slot most types wouldn't populate consistently, ahead of a proven
    access pattern — when per-entity queries are actually needed, a separate entity-index table
    (`eventId`, `entityType`, `entityId`), decoded from each event's typed context at write
    time, is additive infrastructure layered on top rather than an envelope-schema change.

- **Options (comparison-mode generalization for non-Player event types)**:
  - Option A: Add a fourth comparison mode for "objective ground truth" cases (e.g. an umpire's
    call), alongside `raw-sign` / `vs-own-expectation` / `vs-league-line`.
  - Option B (chosen): No new mode — an objective-ground-truth comparison is a **degenerate
    case of `vs-league-line`**, where the "line" is a single authoritative reference value
    rather than a statistical average.
  - **Decision**: Option B, resolved in [#222](https://github.com/wulke/premier-league-baseball/issues/222),
    which ran an Umpire ball/strike-call example (a non-Player, non-in-game event type) against
    the full contract: six of seven points fit as-is; this was the only point that looked like a
    gap, and it resolved without a contract change. Confirms the contract generalizes past
    Players and past in-game events without modification — the acceptance bar the parent map
    set for "generic but concretely grounded."

## Architecture

### Components

- **`src/db/domain/events/`** (NEW — generic machinery only): envelope type
  (`EventEnvelope<TContext>`), `registerEventType()` registry, the `gradeGame(gameId)` grading
  operation, and domain logic for event-chain + reward-ledger persistence. No baseball-specific
  code. (LLD: `docs/llds/events/event-registry-and-grading.md`, TO BE PRODUCED.)
- **Baseball event-type definitions** (NEW, `src/db/domain/simulation/`): the nine event types
  from the worked taxonomy — `PitchEvent`, `SwingDecisionEvent`, `ContactEvent`,
  `TrajectoryEvent`, `FieldingAttemptEvent`, `PlateAppearanceResolutionEvent`,
  `BaserunningEvent`, `StealAttemptEvent`, `PickoffAttemptEvent` — registered against the
  `events/` registry. Only `PlateAppearanceResolutionEvent`/`BaserunningEvent` carry real
  input-context/actual-result schemas today (Depth 0, per
  [#136](https://github.com/wulke/premier-league-baseball/issues/136)'s resolution-depth
  ladder); the rest are name + depth-tagged placeholders until their depth is built. Full
  worked example: `docs/architecture/design/event-taxonomy-baseball-worked-example.md`.
- **Event-chain table** (NEW Sequelize model, owned by `events/`): durable, low-level storage
  of envelope-wrapped event instances — separate from the existing box-score/game-result
  table, enabling replay-validation (the recorded chain must reproduce the same aggregated
  game result) and both `synchronous`/`batched` cadence.
- **Reward-ledger table** (NEW Sequelize model, owned by `events/`): append-only —
  *(event instance id, event type, formula identity, `RewardResult` payload, pass id/timestamp,
  superseded flag)*. Populated by `gradeGame(gameId)`; read by
  [#193](https://github.com/wulke/premier-league-baseball/issues/193)'s (future) reward
  application step and by reverse-traversal admin/analysis tooling.
- **`GameFactory` (`src/db/domain/game.ts`, MODIFIED)**: `simulate()`/`simulateBatch()` receive
  an **extended `SimulationResult`** — score plus the in-memory envelope-wrapped event chain —
  from the `SimulationEngine` seam ([HLD: Simulation Engine Strategy Seam](./high-level-design.md#hld-simulation-engine-strategy-seam)).
  Persists the chain in-transaction alongside the existing guarded score write, then invokes
  `gradeGame(gameId)` as the default post-commit trigger for `synchronous`-cadence event types
  — the same completion-path pattern the box-score distributor
  ([HLD: Per-Player Game Event Writer](./high-level-design.md#hld-per-player-game-event-writer-box-score-distributor))
  already uses, alongside it rather than replacing it.
- **`SimulationEngine` (`src/db/domain/simulation/`, MODIFIED — additive)**: constructs event
  instances statically during resolution (e.g. inside a future `resolvePA`/baserunner-advancement
  decomposition per [#191](https://github.com/wulke/premier-league-baseball/issues/191)) and
  never consults the `events/` registry — the registry exists for graders/consumers, not
  producers.

### Flow

```
GameFactory.simulate() / simulateBatch()
  → SimulationEngine.simulateGame(ctx)
       → constructs envelope-wrapped event chain in memory (pure, deterministic)
            assigns sequence (monotonic per game) + causedByEventId per instance
       → returns extended SimulationResult { homeTeamResult, awayTeamResult, eventChain }
  → GameFactory (existing transaction):
       persist Game result/status (existing guarded path, unchanged)
       persist eventChain rows to the event-chain table
  → post-commit completion path (alongside existing bracket/season/stage hooks):
       gradeGame(gameId)  [default trigger for synchronous-cadence event types]
         → walks the durable chain, resolves type → formula via the events/ registry
         → writes append-only reward-ledger rows (RewardResult[] per graded event instance)
  → (later, independently) batched-cadence event types graded by a separate trigger;
    retroactive re-grades re-invoke gradeGame(gameId) directly, appending a superseding pass
  → (downstream, out of scope here) #193 reads the reward ledger and applies deltas to entities
```

### Key Trade-offs

- **Post-game grading, not in-sim**: keeps the simulation engine's output pure and cheap to
  produce, at the cost of an extra pass (and extra durable storage — the event-chain table)
  that a fused approach wouldn't need. The map judged the separation of concerns worth the
  extra storage and pass.
- **Registry never consulted by producers**: the `SimulationEngine` constructs its event types
  statically rather than looking them up, so adding a new baseball event type never requires
  touching the registry-consuming grading path — but it does mean the engine and the registry
  must independently agree on event-type shape (enforced only at the TypeScript type level, no
  runtime schema validation, per the domain-internal-code convention).
- **Append-only ledger over in-place update**: buys full audit trail and safe retroactive
  re-grading at the cost of the ledger growing unbounded and requiring a "superseded" read-time
  filter for any consumer that wants only the latest pass — accepted because a solo project's
  data volume doesn't make that a real cost today, and correctness/traceability matters more
  than storage.
- **No generic entity-ref field on the envelope**: keeps every event instance minimal and
  consistent, at the cost of per-entity queries needing a future decode-and-index step rather
  than a direct column filter — deliberately deferred until a concrete access pattern exists
  (per [#136](https://github.com/wulke/premier-league-baseball/issues/136)'s "build slots, not
  committed behavior ahead of when it's needed").
- **Formula versioning scheme left open**: this document fixes the ledger's *shape*
  (append-only, superseded-marking, formula identity per row) but not the concrete versioning
  scheme itself, nor how #193's application side reconciles a superseded pass once formulas
  change retroactively — see [Out of scope](#out-of-scope).

### Out of scope

- **Reward storage/application onto entities** (writing a graded `RewardResult` to `Player`
  attributes or any other entity) —
  [#193](https://github.com/wulke/premier-league-baseball/issues/193)'s job, gated on
  [#178](https://github.com/wulke/premier-league-baseball/issues/178)'s go/no-go.
- **Actual EV-delta formulas / numeric tuning** — #193's domain, not this document's.
- **Formula versioning scheme & superseded-pass reconciliation** — the ledger's append-only,
  superseded-marking shape is fixed here; the concrete version-identity scheme and how #193
  reconciles a superseded pass at apply-time are deferred to
  [Formula versioning scheme & superseded-pass reconciliation for the reward ledger](https://github.com/wulke/premier-league-baseball/issues/344),
  to be resolved before #193 builds against the ledger.
- **Depth-1/Depth-2 event-taxonomy evolution** (fielding split into throw/catch/tag, balk/wild
  pitch/passed ball, the `StealAttemptEvent`/concurrent-PA-chain dependency) — surfaces
  naturally as [#191](https://github.com/wulke/premier-league-baseball/issues/191)'s
  implementation decomposes; the taxonomy is explicitly non-exhaustive and this pattern is
  proven, not redesigned, per new event type.
- **Concrete non-Player event-type designs** (Manager/Scout/Referee) — generalization is
  confirmed structurally by the Umpire example above, not (re)designed here.
- **Non-game event sources** (e.g. a future practice mode) — the envelope's `gameId` source FK
  is scoped to games; generalizing it is deferred until a concrete non-game event chain exists
  to design against.
- **Entity-index table for per-entity/per-target queries** — deferred until a concrete query
  need arrives; the answer is a separate `(eventId, entityType, entityId)` table, not an
  envelope-schema change.
- **Stats UI / visualization of the event stream** —
  [#139](https://github.com/wulke/premier-league-baseball/issues/139) (its own, currently
  ungrilled map); this document only establishes the event stream as shared infrastructure.
- **#216/#217 conformance** — bringing the existing box-score distributor
  ([HLD: Per-Player Game Event Writer](./high-level-design.md#hld-per-player-game-event-writer-box-score-distributor))
  into line with this contract (e.g. emitting a stub event with no formula wired) is a follow-up
  ticket once this HLD is approved, not part of it.
