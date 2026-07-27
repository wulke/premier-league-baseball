# Backend Standards

A constitution-style reference for `src/db/` and `src/api/`. Unlike LID's per-feature
`HLD → LLD → EARS → Tests → Code` docs, this doc is not feature-scoped — every future
feature's design is expected to conform to it, not restate it. It captures principles
only; it does not design any specific new entity (e.g. `Player`/`Contract`/`Roster`).

Sourced from the resolved decisions in the [Backend Standards wayfinder map](https://github.com/wulke/premier-league-baseball/issues/1)
and its child tickets (#3–#7), plus the answered questions in the historical
`docs/architecture/data-model/data-model-questions.md` log.

## 1. Domain layer ownership boundaries

**Model ownership.** Each Sequelize model has exactly one owning Factory
(`src/db/domain/*.ts`). Only that Factory's functions may call `db.models.<Model>.*`.
The one exception: a Factory may *read* (never write) an associated model via a
Sequelize `include`, as long as the query starts from its own primary key (e.g.
`LeagueFactory.get()` including `Division`/`Team`). All writes to a model — `create`,
`update`, `bulkCreate` — go through that model's owning Factory. No other Factory calls
those directly.

**Cross-entity reads for ancestor data.** When a Factory needs data owned by an
ancestor up the entity graph (e.g. `GameFactory.simulate()` needing the parent
`GameWorld`'s `currentDate`), the Factory does not resolve it itself:

- The Factory's function takes the value as a parameter (e.g. `simulate(currentDate)`)
  and keeps its own validation logic against its own fields unchanged.
- The ancestor-resolution walk (e.g. `DivisionSeasonGame → DivisionSeason → Division →
  League → GameWorld`) becomes an explicit orchestration step in `api/handlers.ts`,
  composed by calling the appropriate owning Factory's resolver.

This keeps validation strictness identical to a Factory resolving it inline, while
making the cross-entity fetch explicit and testable at the orchestration layer instead
of buried in a leaf Factory.

**Transactions spanning multiple owned models.** When one business operation composes
writes across sibling Factories (e.g. `DivisionFactory.newSeason` needing atomic `Game`
+ `DivisionSeasonGame` writes), the **orchestrating Factory** — the one already
composing the calls — opens the `db.transaction()`, threads it through each composed
Factory call via an optional `transaction` parameter, and commits/rolls back at the
end. This differs from ancestor reads: sibling *writes* within one operation stay owned
by whichever Factory already composes them, since it's the one that understands why
the writes must be atomic. `handlers.ts` stays a thin dispatch layer either way.

**When a Factory is "too fat."** Not a blanket file-LOC threshold — a Factory can
legitimately be long if its model has a lot of DB operations. The actual risk is a
Factory accumulating pure, non-DB algorithmic logic alongside its DB orchestration
(scheduling math, standings math, etc. that never touches `db.models`). When a
Factory's combined pure-function code exceeds roughly 50 lines, extract it into a
co-located plain module (e.g. `division-scheduling.ts`) that the Factory imports — not
a new Factory, since it owns no model. This is mechanically checkable (grep for
functions with no `db.models` references) and makes that logic unit-testable with
plain Jest, independent of whatever DB-testing setup the rest of the Factory needs.

## 2. Schema / domain-modeling principles

These govern how any new game-lifecycle entity (seasons, tournaments, contracts, team
management, etc.) gets modeled — not the schema for those entities themselves.

**Join table vs. direct FK.** Default to a direct FK. Only introduce a join table when
the relationship is genuinely many-to-many at the entity's core — not "might need
metadata later." The burden of proof is on adding a join table, not removing one.
`DivisionSeasonGame` is the standing counter-example to avoid repeating: it was built
as a `belongsToMany` join for what is actually a one-to-many (`Game` belongs to exactly
one `DivisionSeason`) — a modeling error, not a Sequelize requirement.

**When a `*Season`-style temporal join is warranted.** Litmus test: does the pairing
between these two entities need to be re-asserted (and could plausibly differ) every
single year for the same two parties? If yes → temporal join, with a composite unique
index including `year` (like `DivisionSeason`). If no — even if the relationship has a
duration or date range — it's a regular entity with start/end year columns, not a
`*Season` join. Example: a future `Contract` (Player↔Team spanning multiple years) is
NOT `*Season`-style, since the pairing isn't re-created yearly; a team's
tournament-bracket registration WOULD be, if re-entry is required each year.

**Config-JSON vs. real column.** A field graduates from the catch-all `config: JSON`
column to a real typed column when at least one holds:
1. Domain logic branches on it or mutates it directly (not just reads through), or
2. It needs a DB-level constraint (uniqueness, FK, NOT NULL), or
3. A query needs to filter/sort/index on it.

Otherwise it stays in `config` (colors, display prefs, tunable parameters, etc.).
Matches existing precedent: `GameWorld.year`/`currentDate` are real columns (driven by
`newSeason()` domain logic) while everything else on `Team`/`League`/`Division`/
`GameWorld` sits in `config`.

**Naming conventions.**
- Models: `PascalCase`, singular noun.
- FK columns: `camelCase`, always suffixed `Id` — `teamId`, `divisionId`,
  `gameWorldId`. (`Game.homeTeam`/`awayTeam` are the known anti-pattern predating this
  convention — bare, not real FKs. Rename to `homeTeamId`/`awayTeamId` when they
  become real associations.)
- Join/temporal-join tables: name by concatenating the two joined models,
  parent-first, reading as "X's Y" — e.g. `DivisionSeason` (a Division's
  season-scoped membership).

Table pluralization, index naming, and enum-value casing are open questions — not
decided, not currently blocking anything. Graduate to their own ticket if/when they
become a live question.

### Precedent: already-answered schema questions

These were resolved before this doc existed (`data-model-questions.md`) and are folded
in here as the principles they establish, not left as a standalone Q&A log:

- A `Game` belongs to exactly one `DivisionSeason` — reinforces the join-table
  principle above; `DivisionSeasonGame` is legacy debt from before that was decided,
  not a pattern to extend.
- `GameWorld.year` defaults to "current year − 1" intentionally, so a fresh
  `GameWorld` can simulate a historical season before `newSeason()` advances it to the
  present — a deliberate default, not an off-by-one bug.
- `Game.homeTeam`/`awayTeam` are intended to be enforced as real FK associations to
  `Team` (`homeTeamId`/`awayTeamId`) for referential safety — see the naming
  convention above; not yet retrofitted in code.
- A team participating in multiple `Division`s within the same year (across different
  `League`s/`League` types — e.g. a round-robin league and a knockout tournament
  simultaneously) is intended behavior, not a data integrity gap. `DivisionSeason`'s
  unique index on (`divisionId`, `teamId`, `year`) is correct as-is.

## 3. Error handling convention

Minimal and consistent, sized for a solo project — not production-grade.

**Shared error class.** One domain-agnostic error class, `DomainError`
(`src/db/domain/errors.ts`), with `statusCode: 400 | 404 | 422` (widen as needed
later). Any Factory that needs to signal a domain-level failure throws it. No more
one-off, Factory-specific error classes (this generalizes the old
`GameSimulationError`).

**API boundary validation.** No explicit param/body validation at `router.ts`.
Malformed numeric params (e.g. `Number(req.params.gwId)` → `NaN`) fall through to
Sequelize `findByPk`/`where`, which resolve to `null`/empty — caught by the existing
domain "not found" `DomainError` checks already inside each Factory. Validation stays
implicit (Sequelize + domain layer), never duplicated at the router.

**Error response shape.** Every endpoint standardizes on `{ error: string }`. No richer
envelope (error codes, `name`/`type` fields). Status is `error.statusCode` when the
error is a `DomainError`, else `500`.

**Consistent dispatch.** One shared `sendError(res, error)` helper in `router.ts`,
called from every route's `.catch()`. Plain helper function, not Express error
middleware — keeps the existing `.then/.catch` per-route style, no extra machinery for
a solo project.

## 4. Backend testing conventions

**Never mock the DB.** All Factory and BDD tests run against a real SQLite connection
via Sequelize — trivial to create/tear down, so mocking buys nothing. Pure non-DB
logic (simulation math, scheduling math) may be unit-tested without touching the DB at
all; that's not an exception to the rule, just code that doesn't need a DB.

**Isolation: in-memory SQLite per test file.** `DATABASE_URL=':memory:'` in
`.env.test`. Because Jest gives each test file its own module registry, a fresh
`:memory:` Sequelize instance loads per file automatically — no shared file, no
cross-test pollution, no need for `--runInBand` for correctness. Each test file owns
its own `db.sync()` call (no more single global `db.sync({ force: true })` in a shared
setup file).

> The Sequelize client (`src/db/client.ts`) pins its connection pool to `{ max: 1 }`.
> SQLite is single-writer, and pooling more than one connection against a `:memory:`
> database silently gives each pooled connection its *own separate* in-memory
> database — queries then hit tables that were never created on that connection. This
> is a correctness requirement for `:memory:`, not a performance tweak.

**Sync granularity (two-tier):**
- Jest Factory tests (`test/db/domain/*.test.ts`, `test/api/*.test.ts`):
  `db.sync({ force: true })` once in `beforeAll`, so fixtures (e.g. a shared
  `GameWorld`) can be reused across `it`s in a file.
- BDD steps (`test/bdd/steps/*.steps.test.ts`): `db.sync({ force: true })` in
  `beforeEach`, keeping each Gherkin scenario independent.

**Jest vs. BDD division of labor:**
- Jest Factory tests cover a single Factory's own invariants in isolation (e.g.
  `GameFactory().create()` writes the correct FKs).
- BDD features exercise full player-facing flows through `src/api/handlers.ts` — the
  same boundary LID's Gherkin acceptance criteria target — potentially spanning
  multiple Factories.

**Minimum Factory test coverage.** For any new lifecycle entity's Factory, tests must
at minimum call the create/mutation method, read the result back via `findByPk`, and
assert the fields/FKs the Factory owns are correct. Domain-error / invalid-input paths
are left to BDD/handler-level tests, consistent with the ownership boundaries in §1.

**A note on parallel workers.** Running the full suite in-band
(`npm run test:single`, i.e. `jest -i`) is the reliable verification path. Jest's
default multi-worker parallelism can surface flaky, environment-specific SQLite
timing failures on constrained hosts (observed independent of this in-memory-DB
change — it reproduces on the pre-migration file-based setup too). That's a host
resource-contention issue, not a defect in the per-file `:memory:` design; `npm test`
remains the everyday command, `npm run test:single` is the tiebreaker when a run looks
flaky.

## 5. API contract conventions

Treated as emergent from the data-access patterns in §1/§2, not independently
designed — documented lightly.

**Resource naming & action style.** Singular camelCase path segments (`gameWorld`,
`league`, `team`, `game`) — matches the PascalCase singular model naming in §2, just
lowercased. Action-style sub-paths (`/new`, `/simulate`, `/season/new`) are accepted,
not a REST-purity gap to fix later: these are domain actions/commands, not
CRUD-on-a-resource, and forcing strict collection-POST semantics would fight the
domain model for no benefit on a solo project.

**Resource/action dictionary.** Illustrative only — not a maintained governance
artifact:

| Resource | Action | Method + Path |
|---|---|---|
| GameWorld | get one | `GET /api/gameWorld/:gwId` |
| GameWorld | list | `GET /api/gameWorld` |
| GameWorld | create | `POST /api/gameWorld/new` |
| GameWorld | new season | `POST /api/gameWorld/:gwId/season/new` |
| GameWorld | batch simulate | `POST /api/gameWorld/:gwId/simulate` |
| League | get one | `GET /api/league/:leagueId` |
| League | get standings | `GET /api/league/:leagueId/standings` |
| Team | get schedule | `GET /api/team/:teamId/calendar` |
| Game | simulate | `POST /api/game/:gameId/simulate` |

**Success response shape.** Raw, unwrapped object/array (`res.send(response)`) — no
`{ data: ... }` envelope. Intentionally asymmetric with the `{ error: string }` error
shape in §3; the client already branches on status code to know which shape to expect.

**Success status codes.** `200` for everything, including creates. No `201 Created`
distinction — matches the "no extra machinery" spirit of §3.

**Pagination.** Out of scope entirely, no placeholder convention. Revisit only if/when
a real collection grows large enough to need it.
