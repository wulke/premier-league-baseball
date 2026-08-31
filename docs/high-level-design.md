# HLD: Simulate Game

## Goal
Let players advance the season by simulating one or more scheduled games — from a single game row or in batch for an entire day — producing a random score and reflecting results immediately in the UI, without requiring navigation or full page reloads.

## Strategy
- **Options**:
  - Option A: Synchronous simulation only via the single-game endpoint; UI polls/refetches per action.
  - Option B (chosen): Single-game + batch endpoints, backed by a shared React Context (`GameWorldProvider`) that broadcasts a `refreshToken` so all consuming pages stay in sync without prop drilling or duplicate fetches.
- **Decision**: Option B — batch simulate (from `AppHeader`, page-independent) and per-row simulate (`TeamCalendar`) both need to invalidate shared `GameWorld` state (`currentDate`, `inProgress` flag) consistently across pages; a shared context with an invalidation token is simpler than ad hoc refetch wiring per page and avoids the "caching paradox" flagged during UI review.

## Architecture

### Components
- **Backend**: `GameFactory(id).simulate()` / `GameFactory().simulateBatch()` (guarded simulate — score production delegated to the `SimulationEngine` strategy per the [Simulation Engine Strategy Seam](#hld-simulation-engine-strategy-seam)), batch endpoint `POST /api/gameWorld/:gwId/simulate`, `Game.status` enum, `GameWorld.currentDate` field, transaction-scoped BPMN flow (guard → simulate → update, skip-vs-error split by single/batch mode).
- **Frontend**: `GameWorldProvider` (context: `gw`, `refreshToken`, `invalidate()`), `AppHeader` (currentDate chip + batch "Simulate Today"), `TeamCalendar`/`GameRow` (per-row simulate, subscribes to `refreshToken`).

### Flow
```
Player action (row click or header batch click)
  → API call (single or batch simulate endpoint)
  → date/status guard evaluated server-side
  → random score generated + Game updated (status=COMPLETED) inside a transaction
  → response returned (simulated + skipped)
  → UI patches local state (single) or calls invalidate() (batch)
  → refreshToken increments → subscribed components refetch
  → updated scores render in place
```

### Key Trade-offs
- **Backfill vs strict-equality date guard**: chose `scheduledDate <= currentDate` (backfill allowed) over `=` — avoids permanently locking a player out of a missed day while still blocking future games.
- **Batch action placement**: `AppHeader` (page-independent) rather than embedded in any one page — the backend endpoint is `gwId`-scoped, not page-scoped, so this avoids duplicating batch-simulate logic per page.
- **State sync strategy**: `refreshToken` invalidation token in Context rather than a global state library (Redux/Zustand) — matches the app's existing lightweight patterns and only needs cross-component invalidation, not full shared state.
- **Error handling**: inline error icon, no retry for now — richer error UX deferred until a real failure mode demands it.

---

# HLD: Full Season Simulation (League + League Cup)

> Backed by [Map: Simulate a full season (League + League Cup) MVP](https://github.com/wulke/premier-league-baseball/issues/32) — a wayfinder planning map whose eight resolved tickets (#33, #34, #35, #36, #39, #40, #41, #43) are the source decisions for this HLD. Sequenced after [HLD: Simulate Game](#hld-simulate-game) — this assumes single-competition simulate (single + batch) and its UI are already on `main`.

## Goal

Let a player create a GameWorld and, entirely through the UI, simulate a single season to completion across two concurrent competitions — a Premier-League-style round-robin League (with a Championship division) and a knockout League Cup — ending in a decided League table and a decided Cup champion.

## Strategy

- **Options (competition config shape)**:
  - Option A: Patch the existing flat `GameFormula[]` array with new enum values for whatever the bracket work needs.
  - Option B (chosen): Replace `GameFormula[]` with a typed `CompetitionFormat` object — a discriminated union on `structure` (`ROUND_ROBIN` | `KNOCKOUT`) with shared `legs`/`winsToAdvance`/`tiebreak` fields and knockout-only `seeding`.
  - **Decision**: Option B. The flat array conflates leg format, scoring, structure, and seeding into one undifferentiated list with no type safety (e.g. nothing stops `seeding` being set on a round-robin division). A discriminated union makes illegal states unrepresentable and gives the bracket logic a typed contract to build against, rather than bolting ad hoc enum values onto an already-overloaded array.

- **Options (knockout round-advancement trigger)**:
  - Option A: Lazy, computed on read (e.g. inside `isSeasonComplete` or a bracket-fetch endpoint).
  - Option B (chosen): Eager side effect hooked into the shared game-completion path used by both single and batch simulate.
  - **Decision**: Option B. Round-advancement (resolving winners, generating the next round, or writing the champion) needs to happen exactly once per round and be visible immediately after the triggering game completes, whether that game was simulated singly or as part of a batch. Hooking the shared completion path means both call sites get it for free with no duplicated logic, and avoids the staleness/idempotency hazards of computing it lazily on every read.

- **Options (knockout bracket sizing)**:
  - Option A: Keep the current naive greedy pairing (halve the field two-at-a-time, silently drop an odd team out).
  - Option B (chosen): Reduce N teams to the next-lower power of 2 (P) at generation time, front-loading `2P−N` byes into round 1 so every subsequent round halves cleanly.
  - **Decision**: Option B. The default League Cup seeds 44 teams; naive halving produces 22 ties and zero byes — not a real single-elimination bracket, and it drops the odd team entirely for odd counts. A power-of-2 reduction is the standard tournament shape and makes round labels (Round of 32, Quarterfinals, …) and round-count meaningful.

- **Options (champion/season-completion record)**:
  - Option A: A field on `Division` or `DivisionSeason` (e.g. `championTeamId`).
  - Option B (chosen): A new general-purpose `SeasonResult` table (`divisionId`, `year`, `championTeamId`), populated for both `KNOCKOUT` (Cup) and the top-tier `ROUND_ROBIN` division (League) once each is decided.
  - **Decision**: Option B. Scoping it as its own historical-fact table (rather than a live-season field) avoids recomputing already-decided seasons, keeps live season-progress tables free of historical bookkeeping, and gives the UI's champion banner one competition-agnostic place to read from regardless of structure.

- **Options (season-complete UX)**:
  - Option A: A new persisted GameWorld-level "season complete" state/gate.
  - Option B (chosen): Purely computed/derived — the UI reads each competition's existing `isSeasonComplete` (League) / `SeasonResult` presence (Cup) checks live, with no new persisted state.
  - **Decision**: Option B. This MVP never loops `newSeason()` into a second season, so there's no future season-state to gate into — a persisted gate would exist only for display, at the cost of an extra state to keep in sync. Computed derivation is simpler and cannot drift from the underlying data.

- **Options (competition switching / bracket UI placement)**:
  - Option A: A season-level tabbed switcher (League vs. Cup) with a dedicated bracket page/route.
  - Option B (chosen): Stay page-based (GameWorld's existing league list is the switcher); render the bracket as the inner content of the existing per-Division card, branched on `structure` (`ROUND_ROBIN` → `StandingsTable`, `KNOCKOUT` → new `BracketView`).
  - **Decision**: Option B. Matches the current data model (two independent `League` rows under one `GameWorld`) and the app's existing minimal-navigation pattern — no new page, route, or nav concept is needed to add a second competition type.

## Architecture

### Components

- **Config**: `CompetitionFormat` (`src/api/models.ts`) — replaces `GameFormula[]`; named shared constants (`STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`) replace hand-authored inline arrays. `LeagueConfig`/`DivisionConfig` keep their existing two-level fallback (`divisionConfig.format ?? leagueConfig.format`).
- **Backend — bracket domain logic**: round-advancement hooked into `GameFactory`'s shared completion path; `DivisionFactory`'s `KNOCKOUT` branch handles power-of-2 generation, byes, `REDRAW`/`FIXED` seeding, and the three `tiebreak` modes. New `SeasonResult` table records the champion for both structures.
- **Backend — API**: one new League-level endpoint, `GET /api/league/:leagueId/bracket`, mirroring the existing `GetLeagueStandings` fan-out pattern. `DivisionFactory(divisionId).getBracket(year)` returns a UI-ready shape per division (empty `rounds` for `ROUND_ROBIN`); `LeagueFactory(leagueId).getBracket()` fans out across divisions and adds `structure` so the UI can branch per card.
- **Frontend**: `BracketView` (round-grouped list, byes under a "Byes (N)" subheading, series expand-on-click) as the `KNOCKOUT` counterpart to `StandingsTable`; a competition-agnostic champion banner on the `League` page's identity block (reads `SeasonResult`); the GameWorld hub's existing "Season" block becomes a computed "Season Complete" summary once both Leagues are decided; `TeamCalendar` unifies to show a team's games across both competitions (route moves from `/:gwId/:leagueId/team/:teamId/calendar` to `/:gwId/team/:teamId/calendar`), reusing `TeamFactory.getSchedule`'s existing optional `leagueId`.

### Flow

```
Game completes (single or batch simulate)
  → shared completion path (GameFactory)
  → IF division.structure == KNOCKOUT AND this was the round's last unresolved game:
       resolve ties → winners (applying tiebreak if TWO_LEG level on aggregate)
       IF exactly one winner remains → write SeasonResult{ divisionId, year, championTeamId }
       ELSE → generate next round's games (byes auto-completed, seeding per REDRAW/FIXED)
  → IF division.structure == ROUND_ROBIN AND isSeasonComplete flips true:
       write SeasonResult{ divisionId, year, championTeamId: top-tier winner }
  → UI (via refreshToken invalidation, existing pattern) re-renders:
       BracketView / StandingsTable per division, champion banner, hub Season-Complete block
```

### Key Trade-offs

- **`LeagueType` stays decoupled from `structure`**: they correlate 1:1 today (League→round-robin, Cup→knockout) but represent different concerns (competition identity/display vs. mechanics) — collapsing them would block a future League with a knockout playoff or a Cup with a round-robin group stage, at no cost today.
- **`tiebreak: AGGREGATE_SCORE` has no further fallback**: an aggregate-level tie under this mode is an accepted unresolved edge case for competitions that don't need a guaranteed decisive outcome; `OVERTIME`/`ANOTHER_GAME_W_OVERTIME` exist for competitions that do.
- **One champion per League, not per Division**: only the top-tier division's winner is a champion (lower-division leaders are promotion/relegation fodder, out of scope for this MVP) — so the champion banner is League-scoped, not rendered per Division card.
- **Out of scope**: promotion/relegation between League/Championship divisions; looping `newSeason()` into a second season; a multi-season "new season transition" UX (parked for a future map).

---

# HLD: Players, Attributes, Stats & Contracts

> Backed by [Map: Players, Attributes, Stats & Contracts](https://github.com/wulke/premier-league-baseball/issues/59) — a wayfinder planning map whose five resolved tickets (#60, #61, #62, #63, #64) are the source decisions for this HLD. This is a **schema/shape map**: it does not change `SimulationEngine` (stays random) or wire any UI — those are future maps once this schema exists.

## Goal

Introduce **Players** as a first-class concept — real players belonging to Teams, with attributes/ratings, per-game stats, and Contracts — replacing the current state where `Team` is a bare `id`/`config`/`gameWorldId` row with no roster at all. This HLD defines the data shape and epic-level requirements only; no simulation or UI logic is implemented.

## Strategy

- **Options (Player storage shape)**:
  - Option A: Embed players as a JSON array inside `Team.config`, matching the existing ad hoc blob pattern.
  - Option B (chosen): New first-class `Player` Sequelize table, FK `teamId` (nullable = free agent), scoped per-`GameWorld` (mirrors `Team.gameWorldId`).
  - **Decision**: Option B. `Team.config`-as-blob is exactly the pattern already replaced once before (`CompetitionFormat` superseding the ad hoc `GameFormula[]`) — see [[project_league_config_pattern]]. A queryable roster (stats joins, contract joins, cross-team free-agent pool) needs a real table, not an opaque JSON array on the owning Team.

- **Options (Player attribute shape)**:
  - Option A: Role-conditioned discriminated union (separate batting/pitching/fielding attribute sets per position), mirroring the `CompetitionFormat` pattern.
  - Option B (chosen): Flat JSON shape — one shared pool of scalar ratings, a dense per-position affinity map (every player rated at every position), and a per-pitch repertoire array on every player (weak defaults for non-pitchers).
  - **Decision**: Option B. Attributes are meaningful across roles by design (e.g. `armStrength` grades a shortstop's throw *and* a pitcher's fastball) — a role-conditioned union would force artificial namespacing (`batting.vision` vs `fielding.vision`) for what is really one scalar. No stored `position` column: "primary position" is derived at read-time as the highest-rated `positions` entry, keeping a player's best-fit position self-consistent with their ratings instead of a separately-maintained field that could drift from them.

- **Options (Player stats storage grain)**:
  - Option A: Separate `PlayerSeasonStats` and `PlayerCareerStats` tables, incrementally updated.
  - Option B (chosen): Single game-grain `PlayerGameStats` table (one row per `(playerId, gameId)`); season and career are pure `SUM`/`COUNT` aggregate queries over it.
  - **Decision**: Option B. Separate season/career tables create a dual-write consistency problem (every game-stat write must also correctly update two derived rollups). A single game-grain fact table has one write path and season/career are always correct by construction, at the cost of aggregation being a query-time concern rather than a stored value — an acceptable trade for a table with no writers yet.

- **Options (stat category scope for v1)**:
  - Option A: Full stat set including fielding (`E`/`A`/`PO`/`FLD%`) and "Common" tiers (`2B`/`3B`/`SB`/`CS`/`SV`/`HLD`/rate-per-9 stats).
  - Option B (chosen): Core batting (`AB/H/R/RBI/HR/BB/SO`) + Core pitching (`GS/IP/H/BB/SO/ER`) only; rate stats (`AVG`/`OBP`/`SLG`/`ERA`/`WHIP`) computed at read-time, never stored; `W`/`L` dropped entirely.
  - **Decision**: Option B, per research findings ([#61](https://github.com/wulke/premier-league-baseball/issues/61)). Fielding/Common tiers add real-world flavor but nothing the simulation needs yet. `W`/`L` specifically requires decision logic (starter IP thresholds, etc.) the random `SimulationEngine` can't produce — an always-null column was judged worse than omitting it. Storing rate stats would create the same drift risk avoided in the storage-grain decision above.

- **Options (Contract shape & roster constraints)**:
  - Option A: Contract carries a `value`/salary field; roster size enforced with per-position minimums (e.g. required pitcher count) validated at write-time.
  - Option B (chosen): `Contract` is `playerId`/`teamId` FK + `startYear`/`endYear` only, no `value` field; roster size is a flat headcount range (min 20 / max 30) with no per-position minimums, unenforced in v1.
  - **Decision**: Option B. Nothing in the sim consumes salary/cap data yet, so `value` would be dead weight — revisit if a future map introduces a budget mechanic. Per-position roster minimums are left to the generation algorithm to satisfy *by construction* rather than a schema-level validation rule, since there's no failure mode yet (Team creation is the only roster-mutating path) that a runtime guard would actually catch.

- **Options (initial roster generation)**:
  - Option A: Fixed headcount and hardcoded positional template (e.g. always exactly 25 players, 12 Pitchers/2 Catchers/6 Infield/5 Outfield).
  - Option B (chosen): Randomized headcount within [20, 30]; positional split via proportional ratios (~40% Pitchers, remainder across the 8 fielding positions); all attribute/position/pitch values uniform-random with no position-appropriate skew; starting Contracts auto-issued with a flat 1-year term.
  - **Decision**: Option B, resolved in [#64](https://github.com/wulke/premier-league-baseball/issues/64). Randomization over a fixed template adds team-to-team variety at negligible cost. Uniform random (no skew toward a player's assigned position) is a deliberate v1 simplification — low-level player-type/skew tuning is explicitly deferred to a later refinement pass, not treated as unfinished work. The 1-year Contract term is a deliberate forcing function: it makes Contract-expiry/free-agency handling (out of scope for *this* map) come up almost immediately once the schema lands, rather than being a distant concern nobody revisits.

## Architecture

### Components

- **`Player`** (new Sequelize model): `id`, `teamId` (FK, nullable), `gameWorldId` (FK), `attributes` (JSON — scalar ratings + `positions` affinity map + `pitches` repertoire, see `docs/llds/player-attributes.md`).
- **`PlayerGameStats`** (new Sequelize model): `id`, `playerId` (FK), `gameId` (FK), Core batting + Core pitching columns, see `docs/llds/player-stats.md`. No writers in this map — schema only.
- **`Contract`** (new Sequelize model): `id`, `playerId` (FK), `teamId` (FK), `startYear`, `endYear`, see `docs/llds/player-contracts-roster.md`.
- **`PlayerFactory`** (new, `src/db/domain/player.ts` — domain layer only, not built by this planning map): generates a randomized roster + starting Contracts, called by `TeamFactory.create()` (`src/db/domain/team.ts`).

### Flow

```
Team creation (TeamFactory.create())
  → PlayerFactory generates roster:
       roll headcount ∈ [20, 30]
       allocate positions proportionally (~40% Pitchers, remainder across 8 fielding positions)
       for each Player: roll attributes/positions-map/pitches uniform-random (no position skew)
       persist Player rows (teamId, gameWorldId, attributes)
  → auto-issue Contract per Player: startYear = GameWorld.year, endYear = startYear (1-year term)
  → (future map) SimulationEngine produces per-game events
       → PlayerGameStats rows written (schema exists now, no writer yet)
       → season/career stats computed as aggregate queries over PlayerGameStats
```

### Key Trade-offs

- **No role-conditioned attribute union**: a flat shared-ratings shape means every player technically has pitching ratings and a `pitches` repertoire even if they never pitch — accepted because it keeps the schema uniform (no branching by position at generation or read time) and lets a position-flexible player's off-position ratings mean something (e.g. a backup catcher who *could* pitch in a blowout).
- **Aggregation over storage for season/career stats**: query-time `SUM`/`COUNT` over `PlayerGameStats` instead of maintained rollup tables — simpler write path today, at the cost of aggregation queries the domain layer doesn't have yet (deferred with the rest of the write-timing plan).
- **Roster/position balance enforced by construction, not validation**: the generation algorithm is expected to produce a valid, well-balanced roster every time; there is deliberately no runtime guard rejecting an out-of-range or lopsided roster in v1.
- **1-year starting Contracts**: a deliberately short default term to force early exercise of Contract lifecycle/free-agency mechanics, rather than a "realistic" multi-year default that would let the free-agency gap sit unnoticed for longer.
- **Out of scope**: `SimulationEngine` actually using `Player.attributes`/`PlayerGameStats` to influence outcomes (stays random); Player transfer/trade mechanics; Contract-expiry enforcement/free-agency; draft/scouting or ongoing roster generation across multiple seasons; Roster/Player UI. All parked for future maps once this schema lands.

---

# HLD: Team Roster & Player Visibility

> Backed by [Map: Team Roster & Player Visibility](https://github.com/wulke/premier-league-baseball/issues/135) — a wayfinder planning map whose nine resolved tickets (#141–#149) are the source decisions for this HLD. This is a **read/visibility map**: it builds the API + UI surface on top of the `Player`/`Contract` schema landed in [HLD: Players, Attributes, Stats & Contracts](#hld-players-attributes-stats--contracts) (map #59). It does **not** touch `SimulationEngine` (stays random) and introduces **no roster-mutating writes** beyond identity population at team creation.

## Goal

Make rosters and players **real, visible, explorable surfaces** — read/visibility-primary and **symmetric across all teams** (no "My Club"). Players gain **generated human identity** (name, country, bats/throws, birth date) so rosters show *people*, not anonymous rating-bundles. New read APIs back a **team roster view** and a **player detail view** (identity + ratings + contract). The random simulation is untouched.

## Strategy

- **Options (scope: visibility vs. attribute/lineup influence on outcomes)**:
  - Option A: Visibility layer + wire attributes/lineups into the sim.
  - Option B (chosen): Visibility only; the sim stays random and unaffected.
  - **Decision**: Option B. There is no consumer for attribute-influenced outcomes under a random sim, so coupling roster visibility to engine changes would entangle two maps. Attribute/stats-driven simulation, lineups, and the stats writer are parked for the engine map ([#136](https://github.com/wulke/premier-league-baseball/issues/136)/[#138](https://github.com/wulke/premier-league-baseball/issues/138)/[#139](https://github.com/wulke/premier-league-baseball/issues/139)).

- **Options (Player identity storage)**:
  - Option A: Identity fields inside the `attributes` JSON blob.
  - Option B (chosen): Six typed, queryable columns on `Player` — `givenName`, `familyName`, `countryCode`, `bats`, `throws`, `birthDate` — all `allowNull:false`; `attributes` stays ratings-only.
  - **Decision**: Option B, resolved in [#141](https://github.com/wulke/premier-league-baseball/issues/141). Identity is player-facing and queryable (roster sort/filter by country, age bands); burying it in JSON forfeits that. `birthDate` (not a stored `age`) is the aging-immune seed — derived `age` is computed at read-time.

- **Options (roster membership source-of-truth)**:
  - Option A: Anchor roster reads on `Player.teamId`.
  - Option B (chosen): Anchor on **active Contracts** (`Team → Contract → Player` join); `Player.teamId` is a denormalized cache.
  - **Decision**: Option B, resolved in [#145](https://github.com/wulke/premier-league-baseball/issues/145)/[#146](https://github.com/wulke/premier-league-baseball/issues/146). `Contract` is the real membership record; `teamId` is just a cache. This forward-proofs the transfers/contract-lifecycle map ([#140](https://github.com/wulke/premier-league-baseball/issues/140)). It requires migrating `Contract` from `startYear`/`endYear` INT → `startDate`/`endDate` DATE — year-ints couldn't disambiguate a same-year trade — folded into this map per #146, and de-risks #140.

- **Options (derived values: store vs. read-time)**:
  - Option A: Store derived values (`primaryPosition`, `age`, an OVR rollup, `positionCoverage`).
  - Option B (chosen): Derive at read-time; store only immutable seeds (`birthDate`, the flat-7 ratings, the 9-key `positions` map, the `pitches` array).
  - **Decision**: Option B. `primaryPosition` = argmax over `positions` (read-time, consistent with #59's "no stored position"); `age` from `birthDate`; `positionCoverage` = fixed-threshold rule over the 9-key map; **no stored/computed OVR, ever**. This is the **additive-attribute constraint**: new ratings never force a formula re-tune, and the read API carries only what's stored plus trivial derivations.

- **Options (identity generation source)**:
  - Option A: `@faker-js/faker`.
  - Option B (chosen): Curated static name arrays per ~8–10 baseball countries; a weight-less country registry + named per-league compositions; seeded mulberry32 RNG.
  - **Decision**: Option B, resolved in [#142](https://github.com/wulke/premier-league-baseball/issues/142)/[#143](https://github.com/wulke/premier-league-baseball/issues/143). faker lumps the Caribbean (DR/PR/CU/VE) into one Spain-leaning `es` pool — inadequate for the baseball-country skew — so curated pools give authentic variety. No new dependency; seeded RNG → reproducible rosters. `bats`/`throws` are independent random (MLB-like distribution), no country correlation.

- **Options (URL / routing structure)**:
  - Option A: Player detail nested under the team hub.
  - Option B (chosen): Team hub at `/:gwId/team/:teamId` (nested routing, Calendar + Roster tabs); player detail **top-level** at `/:gwId/player/:playerId`.
  - **Decision**: Option B, resolved in [#149](https://github.com/wulke/premier-league-baseball/issues/149). A top-level player route forward-proofs nullable `teamId` / free agents (a nested-under-team URL breaks on a free agent). The team hub mirrors the existing `team-calendar` identity block; the nav rail stays untouched, preserving the symmetric/no-My-Club boundary (the deferred rail "TEAM" section is [#137](https://github.com/wulke/premier-league-baseball/issues/137)'s to own).

## Architecture

### Components
- **`Player` model change**: six new typed identity columns (`givenName`, `familyName`, `countryCode`, `bats`, `throws`, `birthDate`), `allowNull:false`. (See `docs/llds/player-identity.md` — to be produced.)
- **`Contract` model change**: `startYear`/`endYear` INT → `startDate`/`endDate` DATE, per #146. Adds `resolveCurrentContract(playerId, currentDate)` in the Player domain — the row whose `[startDate, endDate]` contains `GameWorld.currentDate` (→ `year` fallback); no match → `contract: null`. (See `docs/llds/player-detail-read-api.md`.)
- **`PlayerFactory` (`src/db/domain/player.ts`)**: gains **identity generation** (extends `generateRoster` — country draw → name draw, independent bats/throws, `birthDate` in 18–38 band, seeded RNG; curated pools in a co-located module, not a Factory) and a **`getDetail(playerId, gwId?)`** read (identity + full `attributes` verbatim + current contract). Conforms to the domain-ownership boundary in `backend-standards.md` §1.
- **`TeamFactory` (`src/db/domain/team.ts`)**: gains **`getRoster(teamId)`** read anchoring on active Contracts (`Team → Contract → Player`), returning flat rows (identity + derived `primaryPosition` + flat-7 ratings; no OVR).
- **API**: two read endpoints — `GET /api/team/:teamId/roster` (+ optional `?gwId=`, validated in handler) and `GET /api/player/:playerId` (+ optional `?gwId=`). Raw, unwrapped success shape; `{ error }` on failure; `200` for everything (per `backend-standards.md` §3/§5). (See `docs/llds/roster-read-api.md`, `docs/llds/player-detail-read-api.md`.)
- **Frontend**: **team hub page** (`/:gwId/team/:teamId`, Calendar + Roster tabs), **roster view** (flat table, positions-coverage cell as organizer, 7 tinted rating columns, client-side sort/filter), **player detail** (FM-style page tabs: Overview / Positions / Pitch repertoire — pitchers only). Aesthetic = the shipping app's inline-style, light, dense look. (See `docs/llds/team-roster-ui.md`, `docs/llds/player-detail-ui.md`.)

### Flow
```
Team creation (TeamFactory.create())
  → PlayerFactory.generateRoster() now also populates identity
       (country draw → name from that country's curated pool; independent bats/throws;
        birthDate in 18–38 band; seeded mulberry32 RNG)
       → Player rows (6 identity cols + ratings JSON), teamId + gameWorldId
  → Contract rows (startDate/endDate DATE, 1-year term)
  → LineupFactory.generateActive() → one active Lineup plus Starter/Bench/Bullpen entries

Read path:
  GET /api/team/:teamId/roster  → TeamFactory.getRoster()
       → Team→Contract→Player join (active contracts) → flat rows (identity + derived primaryPosition + flat-7)
  GET /api/player/:playerId     → PlayerFactory.getDetail()
       → identity + attributes verbatim + resolveCurrentContract(currentDate)
  UI:
       team hub Roster tab → roster view (row name → /:gwId/player/:playerId)
       player detail → Overview/Positions/Pitch-repertoire tabs (pitch tab hidden for fielders)
```

### Active lineup foundation (#198)

`Lineup` is the team-owned card: its nullable `gameId` distinguishes the single active card from a
future per-game snapshot. `LineupEntry` assigns each player once to starter, bench, or bullpen; the
starting pitcher is derived from the Pitcher starter entry, never persisted separately. The generator
uses roster ratings and resolved `matchRules` (League default, optional Division override) to select
an optimal defensive assignment, starter, batting order, and capped reserve pools. Validation is
domain-level because DH and pool limits vary by match rules; database indexes protect only identity
and active/per-game uniqueness. Manager editing and game snapshots remain later slices.

### Key Trade-offs
- **Additive attributes, no stored OVR**: every read consumer (roster + detail) gets the flat-7 verbatim plus trivial read-time derivations; a stored/computed OVR is never introduced, so adding a rating later can't silently invalidate a tuning. A *display-only* OVR may be computed client-side, never carried by the API.
- **Read-time derivation over storage**: `primaryPosition` (argmax), `age` (from `birthDate`), `positionCoverage` (threshold) are all computed at read — consistent with #59's no-stored-position decision; nothing derived is persisted.
- **`Contract` as membership, `teamId` as cache**: roster reads join through active Contracts, so the moment #140 introduces multi-row history the read stays correct; `Player.teamId` is never the source of truth.
- **Top-level player route**: costs one extra route segment vs. nesting, buys correctness for free agents (nullable `teamId`) without a special-case URL.
- **Pitches generated for every player**: `PlayerFactory` emits a 4-pitch repertoire for all players (inherited from #59's uniform schema); meaningless for fielders, so the UI hides the Pitch-repertoire tab for non-pitchers. The cleaner long-term fix — don't generate them for fielders — is engine/generation work ([#136](https://github.com/wulke/premier-league-baseball/issues/136)), out of scope here.
- **No contract history / salary yet**: the `Contract` model carries no amount field and only one row per player exists today (no writer for transfers); the player-detail Overview shows team + term only. A contract-history view graduates when #140 lands — same deferral logic as the stats UI (#139: detail never renders an always-empty section).
- **`positionCoverage` threshold (≥70) is a placeholder**, inherited from the roster-view decision; analytical calibration of "covers a position" over the 9-key map is generation/engine work ([#136](https://github.com/wulke/premier-league-baseball/issues/136)).

### Out of scope
- Attribute/stats-driven simulation (game engine) — [#136](https://github.com/wulke/premier-league-baseball/issues/136).
- "My Club" concept / managed-club ownership layer — [#137](https://github.com/wulke/premier-league-baseball/issues/137) (now its own active map).
- Lineup management (batting order, positions, starter) — [#138](https://github.com/wulke/premier-league-baseball/issues/138).
- Player stats UI surface (game/season/career) — [#139](https://github.com/wulke/premier-league-baseball/issues/139) (gated on a `PlayerGameStats` writer).
- Transfers / contract-lifecycle / free-agency — [#140](https://github.com/wulke/premier-league-baseball/issues/140) (the roster-mutating writes that create contract history; also the home of any salary field and `jerseyNumber`).

---

# HLD: App Shell — Left Nav Rail

> Backed by [Map: UI Direction](https://github.com/wulke/premier-league-baseball/issues/2)
> (CLOSED) — specifically ticket [#10 (Page-by-page layout plan)](https://github.com/wulke/premier-league-baseball/issues/10),
> whose **Shell decision** ("left nav rail + per-page identity strip; fixed FM-style sections,
> game-state-gated; living HOME/WORLD/COMPETITIONS + dimmed fog My Club/Roster/Transfers") is the
> source decision for this HLD. The map declared the rebuild out-of-map as normal LID feature
> work; this is the **first such feature** — the shell that every subsequent page rebuild hangs
> off. This HLD supersedes the breadcrumb pattern in `AppHeader` (`src/ui/components/app-header.tsx`)
> and lands the `currentDate` chip deferred to "a future left-pane nav" (LLD
> [`simulate-game-ui.md`](./llds/simulate-game-ui.md), "retired per #21/#44").

## Goal

Introduce a persistent **left nav rail** as the app shell — the single home for navigation
(Home, the active World, its Competitions) plus world-level actions (batch Simulate Today,
current date) — replacing the per-page hand-rolled headers and the breadcrumb-style `AppHeader`
> so navigation is no longer scattered and duplicated across every page. This feature delivers
> the shell and retires the old header pattern; the individual **page-content** rebuilds
> (home launcher, game-world newspaper feed, league competition hub, team overview + month-grid
> calendar) are separate follow-on LID features that render inside this shell.

## Strategy

- **Options (rail persistence vs provider scope)**:
  - Option A: Keep `GameWorldProvider` scoped to the `:gwId` subtree (as today); render the rail
    inside that subtree, with separate minimal chrome on Home.
  - Option B (chosen): Hoist `GameWorldProvider` to wrap the whole app — it reads `gwId` from
    `useParams()` (null on Home) and only fetches when present — so a single persistent
    `AppShell` rail can always consume the context, null-guarding `gw` to light
    WORLD/COMPETITIONS only on an active world.
  - **Decision**: Option B. The rail is meant to be *persistent* (one navigation surface across
    Home and every world page); Option A either duplicates chrome on Home or remounts the rail on
    route change, breaking persistence. Hoisting the provider is a small, contained change (fetch
    guarded on `gwId != null`) that lets the rail be one always-mounted consumer. Home simply sees
    `gw === null` → HOME-only rail, exactly the intended "game-state-gated" behaviour from #10.

- **Options (batch Simulate + currentDate placement)**:
  - Option A: Leave batch Simulate in a header bar; only back-links move to the rail.
  - Option B (chosen): Move the world-level batch "Simulate Today" state machine and the current-date
    display *into* the WORLD section of the rail, and retire `AppHeader` entirely.
  - **Decision**: Option B. #10 consolidates world/league context, the app mark, and actions into
    the rail; a surviving header bar would duplicate the very chrome #10 set out to collapse. The
    batch action is `gwId`-scoped (not page-scoped) — the same reasoning the simulate-game HLD used
    to place it in `AppHeader` — and the rail's WORLD section is its natural, always-visible home.
    `AppHeader` (and its breadcrumb/back-link props) is retired; pages keep only their per-page
    identity strip.

- **Options (active-state highlighting)**:
  - Option A: Track "current section" in component state.
  - Option B (chosen): Derive active highlighting purely from the router (`useLocation` +
    `useParams`) — Home when path is `/`, World when `gwId` matches and no deeper route, the
    matching League when `leagueId` matches.
  - **Decision**: Option B. Navigation state already lives in the URL; mirroring it in component
    state would be a second source of truth that can drift. Deriving from the router keeps
    highlighting correct after every navigation and needs no extra state.

- **Options (scope of this feature)**:
  - Option A: Shell + rail + full rebuild of all four pages in one feature.
  - Option B (chosen): Shell + rail + retire `AppHeader`; pages keep their current content and
    simply render inside the shell (dropping their page-local headers). Page-content rebuilds are
    separate LID features.
  - **Decision**: Option B. The shell is the spine every page rebuild depends on; shipping it alone
    is a coherent tracer bullet (persistent nav + consolidated actions land immediately) and keeps
    each subsequent page rebuild an independently reviewable LID cycle (HLD→LLD→EARS→Tests→Code),
    matching how #10 framed the rebuild as "per page/feature."

## Architecture

### Components

- **`GameWorldProvider`** (MODIFIED, `src/ui/context/game-world-context.tsx`): hoisted from the
  `:gwId` subtree to wrap the whole app; reads `gwId` from `useParams()` and fetches only when
  present (null on Home → `gw` stays null). The `useGameWorldContext` contract is unchanged for
  consumers rendered inside the app.
- **`AppShell`** (NEW, `src/ui/components/app-shell.tsx`): the persistent layout — left nav rail +
  `<Outlet />`. Renders the fixed sections (HOME / WORLD / COMPETITIONS / dimmed trio), the app
  mark, and world-level actions (batch Simulate Today + current date), all gated on context `gw`.
- **Batch Simulate control** (RELOCATED from `AppHeader`): the existing state machine
  (idle/submitting/success-clean/success-skipped/error + `invalidate()`), now rendered in the
  rail's WORLD section rather than a header.
- **Routing** (`src/ui/routes.tsx`, MODIFIED): a top-level `AppShell` layout route wrapping Home
  + the `:gwId` subtree; `GameWorldLayout`'s provider duty is absorbed by the hoisted provider.
- **Pages** (MODIFIED, content unchanged): `Home`, `GameWorld`, `League`, `TeamCalendar` drop
  their page-local `<header>` / `<AppHeader>` usage and render their content + identity strip
  inside the shell. `AppHeader` is deleted.

### Flow

```
AppShell mounts once (top-level layout route) and wraps the whole app.
GameWorldProvider (hoisted) reads gwId from useParams():
  - Home (/)       → gwId null → no fetch → gw stays null
  - :gwId subtree  → gwId present → GET /api/gameWorld/:gwId → gw set
Rail renders from context gw:
  - always:   HOME link + app mark + dimmed fog trio (My Club / Roster / Transfers)
  - gw!=null: WORLD section lights (world name → /:gwId, current date, batch Simulate Today);
              COMPETITIONS lights if gw.Leagues non-empty (one link → /:gwId/:leagueId each)
Active highlighting derived from useLocation / useParams.
Batch Simulate (WORLD section) → POST /api/gameWorld/:gwId/simulate → invalidate()
  → rail + every page consumer re-renders.
Pages render content + identity strip inside <Outlet/> — no per-page header.
```

### Key Trade-offs

- **Hoisting the provider** (vs keeping it scoped) trades a slightly broader context boundary for
  a genuinely persistent single rail — the whole point of #10's "consolidated chrome." The fetch
  stays `:gwId`-scoped (guarded on the param), so Home incurs no extra request.
- **Retiring `AppHeader`** removes a tested component; its batch-simulate behaviour
  (SIMUI-008…018) is **relocated**, not lost, and its Gherkin scenarios are re-homed to the rail.
  Back-link breadcrumbs are deliberately dropped — the rail makes them redundant, and #10
  explicitly consolidates navigation.
- **No page-content rebuild in this feature**: pages look largely as before, just headerless
  inside the shell. This defers the big visual wins (newspaper feed, competition hub, month-grid
  calendar) to their own LID cycles, accepting a transitional look in exchange for a small,
  reviewable, dependency-unlocking slice now.
- **Active league highlighting** uses the `leagueId` param match; deeper sub-routes
  (`team/:teamId/calendar`) keep their nearest lit section (World) rather than introducing a Team
  section that #10 reserves for the later Team-overview rebuild.

# HLD: Game-world templates (pickable old Champions League)

## Goal
Make the existing `champions-league` multi-stage template a **pickable, runnable game world** —
the proving slice [#87](https://github.com/wulke/premier-league-baseball/issues/87) on
[Map #78](https://github.com/wulke/premier-league-baseball/issues/78) defines as complete. The
multi-stage run-path, generalized config, and multi-stage render-UI are landed (#164 / #163 /
#162); old-CL is currently proven only by an **inline** config in a unit test. This closes the gap
so a user creates a 32-team Champions League world and watches it crown a single champion via the
existing simulation + cross-phase advancement path. The map carries execution into itself.

## Strategy
- **Options**:
  1. Promote old-CL to a pickable `DefaultWorld` now (this slice).
  2. Defer all pickability to the separately-chartered game-world builder map (#85) and close #87
     at "test-proven, render-ready."
- **Decision**: **(1)**. #85 deliberately made old-CL a *runnable* archetype (not registry-only
  like new-CL/MLB); the destination says "backend + minimal UI" and "runnable to a champion"; and
  the lift is small and purely additive. The difference between a green unit test with a hand-built
  config and a world a user clicks into existence and watches crown a champion is exactly what a
  proving slice is for. Option (2) reopens a scope question the map already settled.

## Architecture
- **Config layer** (`src/api/models.ts`, MODIFIED — additive): one `GameWorldType.ChampionsLeague`
  arm, one `europe-32` team pool (32 stub teams), one `DefaultWorlds` entry. The
  `Record<GameWorldType,…>` exhaustiveness makes the enum arm force its bundle entry at compile
  time. The `champions-league` `LeagueTemplate` (8 group divisions over pool indices `0..31` +
  one `TOP_N_PER_DIVISION` knockout division, `isTopTier`) is already authored (#85) and validated
  by `validateLeagueConfig` (CFG-011..017).
- **UI** (`src/ui/pages/home.tsx`, MODIFIED — minimal): the existing create-world form gains a
  template `<select>` whose selection drives `useDefaultGameWorld(type)` → the bundle (`teams` +
  `leagues`) + a **dynamic** template summary. No new route or page; submit is unchanged
  (`POST /api/gameWorld/new`).
- **Domain/scheduler**: **unchanged**. Every step after `create` is an already-green requirement —
  MSS-005 (first-stage only) → MSS-006 (group completion fires dependent KO) → MSS-002
  (`TOP_N_PER_DIVISION` seeds 16) → MSS-009 (two-leg KO) → MSS-008 (one champion). This slice
  exercises those via the *real* bundle instead of an inline test config.

### Flow
```
home form: user selects "Champions League" template
  → useDefaultGameWorld(ChampionsLeague) → { 32 teams, [champions-league] }
  → POST /api/gameWorld/new (bundle + typed name)
  → GameWorldFactory().create → 32 TeamFactory creates + LeagueFactory.create
      → validateLeagueConfig + stageId/stageOrder stamping
  → navigate /:gwId → rapid-simulate → MSS-005..009 → one champion
```

### Key Trade-offs
- **Stub team names, not real rosters** (`europe-32`): symmetry with `england-44` (name-only
  `TeamConfig`); player generation is the existing factory's concern. The pool proves pool-index
  wiring (`0..31`) and field size, not roster realism — consistent with this map's random-sim
  posture and the deferred builder map owning mix/match realism.
- **No static guard against a registry-only archetype leaking into `DefaultWorlds`** (new-CL/MLB
  exist by design): enforced by a pickability test enumerating `DefaultWorlds` keys rather than a
  type-level rule, since their templates are intentionally present in `LeagueTemplates`.
- **UI reuses the single create-world form**: a template `<select>` + dynamic summary over
  introducing a template-detail page — keeps the change inside one component and honors the map's
  "minimal UI" stance, leaving the rich builder UX to the builder map.

---

# HLD: Simulation Engine Strategy Seam

> Backed by [Map: Attribute-driven Simulation Engine](https://github.com/wulke/premier-league-baseball/issues/136)
> — decisions 7 (determinism) and 8 (engine wiring) are the source decisions for this HLD.
> Ticket: [Engine strategy seam](https://github.com/wulke/premier-league-baseball/issues/190) —
> the tracer bullet for the attribute-driven engine. Subsequent stages (LLD corrigendum, EARS
> `SIM-016..018`, tests, code) follow through the LID Arrow of Intent on top of this HLD.

## Goal
Make score production a **swappable strategy** and a **reproducible computation**: extract a
`SimulationEngine` interface that `GameFactory.simulate()` / `simulateBatch()` delegate to for
score production; today's `floor(random()*10)` becomes one concrete implementation
(`RandomSimulationEngine`); RNG seeding is injectable; the unguarded vestigial
`GameFactory(id).result()` is deleted. **Behavior is preserved** — this slice adds
swappability + reproducibility infrastructure only, no new game logic; `SIM-001..015` stay green.

## Strategy
- **Options**:
  - Option A: leave `Math.random()` inline; rewrite call sites when the attribute-driven engine
    ([framework milestone](https://github.com/wulke/premier-league-baseball/issues/191)) arrives.
  - Option B (chosen): extract the strategy seam now, ahead of the attribute-driven engine.
- **Decision**: **Option B** — the attribute-driven engine lands as a *second* implementation
  behind the interface without touching guards, transactions, or completion hooks, and behavior
  is pinned from here on by golden-master tests (pinned seed → reproducible scores). Production
  draws a fresh seed per game so variance is preserved (still feels like real baseball).

## Architecture
- **Domain** (`src/db/domain/`, MODIFIED — additive + one deletion): `GameFactory` retains all
  guards, the batch transaction, and the completion hooks, but **delegates score production** to
  an engine resolved per call: `resolveSimulationEngine(seed?) → SimulationEngine`, whose
  `simulateGame(ctx)` returns `{ homeTeamResult, awayTeamResult }`. Today's random logic becomes
  `RandomSimulationEngine`. New `src/db/domain/simulation/` module. The seed is a **domain-only
  optional parameter** — handlers and the API surface are unchanged.
- **RNG**: seeded mulberry32 (already in-repo via player-identity, #143); house pattern
  `seed ?? Date.now()` — fresh seed per game in production, pinned seed in tests. Per-game seed
  derivation must be collision-free within a batch (mix in `gameId` — detailed in the LLD).
- **Deletion**: `GameFactory(id).result()` (LLD edge case e4) — zero callers; its removal leaves
  no unguarded score-write path.

### Flow
```
simulate / simulateBatch
  → guards + date checks (unchanged, in GameFactory)
  → resolveSimulationEngine(seed?)          # tests: pinned; production: fresh per game
  → engine.simulateGame(gameContext)         # → { homeTeamResult, awayTeamResult }
  → Game.update(...) + completion hooks (unchanged, in GameFactory)
```

### Key Trade-offs
- **Seam at score production only**: guards, transaction, and completion hooks stay in
  `GameFactory` — the strategy owns *what the score is*, never *whether/how it is written*.
  Keeps SIM-001..015's contract squarely on the factory while the engine stays pure
  (input context → result tuple).
- **Per-game seeds, not per-batch**: a per-batch RNG shared across games would serialize game
  outcomes to call order inside the loop (and collide same-millisecond `Date.now()` seeds);
  per-game derived seeds keep batch results order-independent and re-runnable per game.
- **Domain-only seed parameter**: no API/env exposure now — the golden-master tests call the
  factory directly (matching `test/db/domain/game.test.ts` precedent, e.g. PID-005). Exposing a
  seed via API would leak a test concern into the contract.

# HLD: Route-Loader Data Migration

> Backed by [Map: Route-loader migration for click-to-render lag](https://github.com/wulke/premier-league-baseball/issues/229)
> — a wayfinder planning map whose six resolved tickets (#230–#235) are the source decisions
> for this HLD. This is a **mechanism-swap map**: it changes *when and how* existing GET
> requests fire, not what data any page shows or what any mutation does. It assumes the
> current `AppShell`/`GameWorldProvider`/page-component structure from
> [HLD: App Shell — Left Nav Rail](#hld-app-shell--left-nav-rail) is already on `main`.

## Goal

Move every fetch-on-mount GET across the UI (`Home`, `GameWorld`, `League`, `PlayerDetail`,
`TeamHub`, `TeamCalendar`, `TeamRoster`, `TeamLineupView`, and `GameWorldProvider`) onto
react-router v7 data-router loaders, so data fetching starts during the navigation
transition instead of after mount — eliminating the click-to-render lag caused by today's
render-then-`useEffect`-fetch waterfall. Mutations stay as imperative fetches with local
state; loaders own reads only. This HLD is architecture + a batch-sequenced rollout plan;
no migration code lands from the map or this document.

## Strategy

- **Options (router config style)**:
  - Option A: Rewrite `routes.tsx` to object-based `RouteObject[]` authored directly (no JSX).
  - Option B (chosen): Keep `createRoutesFromElements(<Routes>…)`, feeding its output into
    both `createBrowserRouter` (app) and `createMemoryRouter` (tests).
  - **Decision**: Option B (#233). Preserves `routes.tsx`'s current JSX shape and inline
    `@spec` comment placement — a pure mechanism swap, not a route-tree rewrite — while still
    giving app and tests one shared `RouteObject[]` source of truth.

- **Options (`GameWorldProvider` replacement)**:
  - Option A: Keep the Context provider, layer loaders only on leaf routes.
  - Option B (chosen): Delete `GameWorldProvider` entirely; `gw` becomes a loader on the
    `:gwId` Route (`id="gwId"`), read via `useRouteLoaderData`.
  - **Decision**: Option B (#230). One loader attached to the route every consumer already
    sits under matches today's single-fetch-per-`gwId` behavior exactly, with no separate
    context tree to keep in sync. `invalidate()` is replaced at its ~4 call sites by
    `useRevalidator().revalidate()`, whose scoping to the matched route tree satisfies
    "not the whole tree" for free. Cancellation moves from a manual flag to the loader's
    `request.signal`.

- **Options (blocking vs. deferred data)**:
  - Option A: Every loader blocks navigation until its data resolves.
  - Option B (chosen): Blocking loaders for single-fetch pages; `defer()`/`Await`/`Suspense`
    for fan-out pages, at the finest granularity each fan-out naturally offers.
  - **Decision**: Option B (#231). Blocking alone still leaves the route unpainted for the
    length of the round trip — no better than today for the slowest pages. `Home`,
    `PlayerDetail`, `TeamCalendar`, `TeamRoster`, and the `gw` loader are single-fetch and
    block. `GameWorld` (per-league), `League` (per-section), and `TeamLineup` (per-fetch) defer
    at their finest unit so independent pieces paint as they resolve rather than waiting on
    the slowest one; each deferred boundary shows a skeleton shaped like its eventual content.

- **Options (not-found / error modeling)**:
  - Option A: Adopt React Router's idiomatic `throw new Response(...)` + `errorElement`.
  - Option B (chosen): Keep the loader-returns-`null` shape; the page component renders its
    existing not-found branch.
  - **Decision**: Option B (#233). `PlayerDetail` is the only page with a single-entity 404
    today; introducing a new error-boundary mechanism for one page would add a second failure
    pattern alongside the null-returning one every other page keeps for network failures, for
    no behavioral gain — status quo shape, new plumbing underneath.

- **Options (`TeamCalendar` date filter)**:
  - Option A: Keep the filter as local component state, calling `revalidate()` explicitly.
  - Option B (chosen): Promote the date-range filter to real URL search params
    (`?from=&to=`), replacing today's Status/Competition dropdowns.
  - **Decision**: Option B (#234). Search-param changes re-run the loader for free and make
    the filtered view shareable/back-button-able; `shouldRevalidate` skips a refetch when only
    the search string is identical-but-reapplied while still letting explicit `revalidate()`
    calls (e.g. post-simulate) through.

- **Options (hover-prefetch)**:
  - Option A: Hand-roll a hover-triggered prefetch (loader-call + shared cache on
    `onMouseEnter`) alongside the loader migration.
  - Option B (chosen): Out of scope for this map.
  - **Decision**: Option B (#232 research). `<Link prefetch>` is Framework-mode only (requires
    the react-router Vite plugin); this repo builds with Parcel. A manual hover-prefetch is
    possible on top of loaders but was already rejected as a standalone fix in favor of the
    loader architecture itself — parked as optional future icing, not part of this migration.

- **Options (rollout shape)**:
  - Option A: One PR migrating all 8 pages + `GameWorldProvider` + the test harness at once.
  - Option B (chosen): Six sequenced batches, each its own PR/LID cycle.
  - **Decision**: Option B (#235). A single PR-sized surface this large is hard to review and
    hard to revert piecemeal; batching lets the harness and `GameWorldProvider` pattern prove
    out on the lowest-risk pages before the highest-traffic ones adopt it. See Architecture →
    Flow for the batch order.

## Architecture

### Components

- **`routes.tsx`** (MODIFIED): exports the `createRoutesFromElements(...)` result as a
  `RouteObject[]`, consumed by both `createBrowserRouter` (app) and `createMemoryRouter`
  (tests) — one source of truth for the route tree.
- **`GameWorldProvider`** (DELETED, `src/ui/context/game-world-context.tsx`): superseded by a
  loader on the `:gwId` Route; all consumers switch to `useRouteLoaderData("gwId")`.
- **Page loaders** (NEW, one per page — `Home`, `PlayerDetail`, `TeamCalendar`, `TeamRoster`,
  `GameWorld`, `League`, `TeamLineupView`): blocking for the single-fetch pages, `defer()`-based
  for the three fan-out pages, per the Strategy decision above.
- **`TeamCalendar`** (MODIFIED): Status/Competition dropdowns replaced by a `?from=&to=`
  search-param date-range filter; adds a `shouldRevalidate` override.
- **`TeamHub`** (MODIFIED): its `SetManagedClub` mutation swaps to
  `useRevalidator().revalidate()`.
- **UI test harness** (`test/ui/test-utils.tsx`, `test/ui/steps/*.steps.test.tsx`, MODIFIED):
  renders via `createMemoryRouter(routes, { initialEntries, initialIndex })` +
  `<RouterProvider>` in place of `<MemoryRouter><Routes/></MemoryRouter>`; existing
  `given`/`when`-ordered fetch-mock setup and `findBy*` assertions carry over unchanged.
- Per-batch LLDs (`docs/llds/route-loader-<batch>.md`, TO BE PRODUCED, one per batch below)
  detail each batch's loader signatures, `shouldRevalidate` logic, and skeleton components.

### Flow

```
Rollout batches (each its own PR + LID cycle: LLD → EARS → Tests → Code):

Batch 0 — Foundation
  routes.tsx → RouteObject[]; test harness → createMemoryRouter/RouterProvider (#233)
  GameWorldProvider deleted; gw loader lands on :gwId Route (#230)
  ↓ (everything below depends on this batch's harness + gw loader)

Batch 1 — Leaf pages (low risk)
  PlayerDetail, TeamRoster: blocking loaders, no defer, minimal mutations

Batch 2 — TeamCalendar
  ?from=&to= search-param loader + shouldRevalidate (#234)
  TeamHub's SetManagedClub → useRevalidator().revalidate()

Batch 3 — TeamLineup
  First defer()/Await page: independent deferred value per fetch (lineup, roster)

Batch 4 — League, GameWorld
  defer() per section (League) / per league (GameWorld); heaviest mutation density

Batch 5 — Home
  Highest-traffic entry point, migrated last

Runtime request flow (any migrated page, e.g. PlayerDetail):
  User clicks <Link to="/:gwId/player/:playerId">
    → react-router starts the transition AND calls the route's loader concurrently
    → loader issues GET (fetch, with request.signal for cancellation)
    → [blocking] route paints once loader resolves
    → [deferred] route shell + skeletons paint immediately; Await resolves each
       section's promise independently as its fetch completes
```

### Key Trade-offs

- **Six-batch rollout accepts a transitional mixed state** (some pages on loaders, some still
  `useEffect`+`fetch`) between Batch 0 and Batch 5 landing, in exchange for reviewable,
  independently revertible PRs and a harness/pattern proven on low-traffic pages before the
  highest-traffic ones (Home, GameWorld) adopt it.
- **Per-unit defer granularity** (per-league, per-section, per-fetch) costs more Suspense
  boundaries and skeleton components than one bundled promise per fan-out page, in exchange
  for independent pieces painting as they resolve instead of all waiting on the slowest fetch
  in the group — the core lag fix `defer()` exists to deliver.
- **No new error-boundary mechanism**: keeping the loader-returns-`null` shape for
  `PlayerDetail`'s 404 avoids introducing `errorElement`/`ErrorBoundary` for a single call
  site, at the cost of not adopting React Router's more idiomatic error-modeling pattern
  project-wide.
- **Skeleton visual design and cancellation semantics for every deferred fetch beyond the `gw`
  loader are left to each batch's own LLD**, not pinned here — the map deliberately parked
  them as implementation detail once the architecture (defer granularity, request.signal
  pattern) was locked.

### Out of scope

- Server-side changes (Express/Sequelize/SQLite) — the lag was confirmed to be UI-side.
- Hover/viewport prefetch (`<Link prefetch>` equivalent) — Framework-mode only, unavailable
  under this repo's Parcel/library-mode setup (#232); a hand-rolled version is sketched in
  #232's resolution comment as optional future work, not part of this migration.
- The lightweight prefetch-on-hover + in-memory-cache + skeleton patch — considered and
  explicitly rejected in favor of this loader-based architectural fix.

# HLD: Lineup View — Defensive | Batting Tabs

> Backed by [#225](https://github.com/wulke/premier-league-baseball/issues/225) — a single fully-resolved decision ticket (`/grill-me`, 2026-08-31), consolidated here in place of a wayfinder map since the destination and every architectural trade-off were already settled in one session with no fog left to chart. Sequenced after [HLD: Team Roster & Player Visibility](#hld-team-roster--player-visibility) (map #135) — this is a presentation redesign of the read-only Lineup tab that map shipped (#200), not a new read path.

## Goal

Redesign the existing read-only Lineup tab from two side-by-side panels (batting-order list +
bench/bullpen pools) into a Football-Manager-style **Defensive | Batting** tabbed table, one row
per starter, with bench and bullpen folded into the same table as tagged rows. Purely a
presentation change over the data `GET /api/team/:teamId/lineup` already returns — no new backend
surface, no write path.

## Strategy

- **Options (data source)**:
  - Option A: New tabular read endpoint shaping rows server-side.
  - Option B (chosen): Reshape the existing `TeamLineup` response (`{ starters, startingPitcherId,
    bench, bullpen }`) entirely client-side.
  - **Decision**: Option B (#225). Every field the tabular view needs — fielding position, batting
    order, starter/bench/bullpen membership — already exists in the active-lineup response; this is
    a presentation redesign, not a new read path.

- **Options (defensive-tab rating source)**:
  - Option A: Compute a new display rating for the tabbed view.
  - Option B (chosen): Reuse the same positional rating `optimalFieldingAssignment`
    (`src/db/domain/lineup.ts`) already reads off `Player.attributes.positions` to place each
    starter, shown alongside the assigned position (e.g. `SS — 82`).
  - **Decision**: Option B (#225). One rating, one source of truth — the number shown to the user is
    exactly the number the generator used, not a second parallel computation that could drift from it.

- **Options (bench/bullpen placement)**:
  - Option A: Keep the current separate Pool panels below the tabs.
  - Option B (chosen): Fold bench and bullpen into the same table as inline rows, tagged `BENCH` /
    `BULLPEN`.
  - **Decision**: Option B (#225). One table per tab reads closer to FM's reference layout than a
    table-plus-list split, and removes a second visual pattern from the page for no loss of
    information — the tag column carries what the separate-panel heading used to.

- **Options (position-badge filter row)**:
  - Option A: Add FM-style clickable position badges to filter the table.
  - Option B (chosen): Deferred out of v1.
  - **Decision**: Option B (#225). Baseball's 9-position-plus-DH set is small enough to scan
    unfiltered; the filter row earns its keep on FM's much larger position taxonomy, not here.

- **Options (overlap with the per-game Bullpen tab, #243)**:
  - Option A: Share one row-rendering component/state between this read-only view and #243's
    editable per-game Bullpen tab.
  - Option B (chosen): Accept duplication — a bullpen reliever renders as a read-only tagged row
    here and as a separate editable entry in #243's Bullpen tab.
  - **Decision**: Option B (#225). The two tabs read/write different underlying objects (the active
    template `Lineup` here vs. a per-game snapshot `Lineup` in #243); sharing a component across
    that boundary would couple a read-only view's rendering to a write surface's validation and
    save-state for a cosmetic row-shape saving that isn't worth the coupling.

## Architecture

### Components

- **`src/ui/pages/team-lineup.tsx`** (MODIFIED): the two-panel layout (batting-order list + Pool
  sections) is replaced by a **Defensive | Batting** tab pair, each rendering one row per starter
  plus inline `BENCH`/`BULLPEN`-tagged rows, sourced from the same `TeamLineup` fetch this page
  already makes. No new fetch, no new endpoint. (LLD: `docs/llds/lineup-view-ui.md` — extends the
  existing LLD in place rather than a new file, since the endpoint contract and edge cases it
  documents are unchanged.)
- **`GET /api/team/:teamId/lineup`** (UNCHANGED): remains the sole data source; `TeamLineup`
  (`src/api/models.ts`) is not extended.
- **`optimalFieldingAssignment`** (`src/db/domain/lineup.ts`, UNCHANGED): read-only reused as the
  rating source for the Defensive tab; no new backend logic.

### Flow

```
user opens Team Hub → Lineup tab (unchanged route: /:gwId/team/:teamId/lineup)
  → existing fetch: GET /api/team/:teamId/lineup (+ roster, for display names — unchanged)
  → client reshapes the response into two tab views:
      Defensive tab: one row per starter — player, fielding position, positional rating
                      (Player.attributes.positions[position], the same value the generator used)
                      + BENCH/BULLPEN-tagged rows appended
      Batting tab:   existing battingOrder-sorted rows, unchanged from today's behavior
                      + BENCH/BULLPEN-tagged rows appended
  → every row still links to /:gwId/player/:playerId; no mutating control on either tab
```

### Key Trade-offs

- **No new read path, but the defensive rating becomes a UI-layer read of `Player.attributes`**:
  today's Lineup tab never surfaces raw attribute values to the client; this redesign does (one
  positional rating per starter). Accepted because it's the same value already computed
  server-side for lineup generation — just displayed, not newly computed — and because the LLD's
  existing read-only/no-mutating-control constraint (EARS `LINEUI-004`) is otherwise unchanged.
- **Accepted duplication with #243's Bullpen tab**: a relief pitcher appears as a read-only row
  here and as a separately-rendered editable entry there, in exchange for keeping this view's
  rendering decoupled from a write surface's validation/save-state.
- **Position-badge filtering deferred**: costs nothing today (9-plus-DH scans fine unfiltered) but
  means this Strategy option would need revisiting if a future map ever grows the position
  taxonomy.

### Out of scope

- Editable "Picked" position/role assignment for the **template** (active) lineup — remains
  undesigned, tracked separately in [#226](https://github.com/wulke/premier-league-baseball/issues/226)
  (blocked on [#136](https://github.com/wulke/premier-league-baseball/issues/136)).
- Per-game starting-pitcher / active-reliever designation — split out into its own follow-on,
  [#243](https://github.com/wulke/premier-league-baseball/issues/243) (a third, editable "Bullpen"
  tab on the same page, soft-blocked by this HLD's implementation).
- Value/form/talent/appearances-style columns —
  [#227](https://github.com/wulke/premier-league-baseball/issues/227), blocked on the
  `PlayerGameStats` writer ([#216](https://github.com/wulke/premier-league-baseball/issues/216)/
  [#217](https://github.com/wulke/premier-league-baseball/issues/217)), the player-stats UI query
  framework ([#139](https://github.com/wulke/premier-league-baseball/issues/139)/
  [#215](https://github.com/wulke/premier-league-baseball/issues/215)), and the transfer/contract
  lifecycle design ([#140](https://github.com/wulke/premier-league-baseball/issues/140)).

---

# HLD: Decoupled IV/EV Person-Attribute Pattern

> Backed by [Map: IV/EV Feasibility & Feel Report](https://github.com/wulke/premier-league-baseball/issues/178)
> and its GO decision, [#209](https://github.com/wulke/premier-league-baseball/issues/209). The
> worked examples behind that decision established the shared pattern for Players, Managers,
> Scouts, Umpires, and future person-entities. This HLD defines the pattern, not a migration or
> the first consumer.

## Goal

Give every **person-attribute** one durable storage shape that preserves innate ability, earned
career history, short-term form, named fixed disposition, and aging separately. Consumers such as game
simulation, scouting, salary, and management must be able to make purpose-specific reads from the
same underlying person without a global rating, destructive aging writes, or entity-specific
parallel systems.

## Strategy

- **Options (one global effective rating vs. consumer-owned reads):**
  - Option A: Collapse each attribute to one shared effective value, then use it everywhere.
  - Option B (chosen): Store the common pieces once and let each consuming formula combine them
    for its own purpose.
  - **Decision:** Option B. A game decision needs present performance, scouting needs a
    talent/trajectory read, and salary needs an unfaded career aggregate. A global effective value
    makes those legitimate consumers fight over one meaning and erases the IV/EV composition that
    makes aging legible.

- **Options (one mutable EV vs. partitioned aggregate and form):**
  - Option A: Put career effort, slumps, recovery, and aging into a single bounded EV value.
  - Option B (chosen): Keep EV as a signed, unbounded career aggregate; write each event delta to
    both EV and a bounded recent-event form window; apply aging only at read time.
  - **Decision:** Option B. Career history must remain inspectable and unfaded while a slump must
    recover on a much shorter timescale. Separating the aggregate from the ring buffer keeps those
    forces independent, and clamping only a consumed read prevents runaway performance without
    rewriting history.

- **Options (whole-capacity aging vs. discount-IV-only):**
  - Option A: Subtract a general age penalty from the whole capacity read.
  - Option B (chosen): Apply a decline-only, convex age discount to IV only; EV remains earned
    craft that resists the age transform.
  - **Decision:** Option B. It preserves the intended "wheels go, craft stays" distinction and
    lets a scout distinguish an innate-built fading player from an earned-built veteran with the
    same current rating. The accepted consequence is that an EV-heavy veteran fades slowly; a
    fading-star archetype must be innately built.

- **Options (universal mechanics vs. separate non-Player models):**
  - Option A: Use IV/EV only for Players and invent separate growth systems for staff and
    officials.
  - Option B (chosen): Apply the same per-attribute contract to every person-entity; vary only
    attribute catalogs, outcome signals, and grading grain.
  - **Decision:** Option B. A Player action, Umpire call, Scout report, and Manager decision are
    all outcome-graded contributions. Uniform storage and reads preserve one learning model while
    allowing sparse, delayed, or fuzzy signals without special storage.

- **Options (numeric Nature per attribute vs. named person-level Natures):**
  - Option A: Persist a raw Nature multiplier inside every attribute tuple.
  - Option B (chosen): Give a person zero or more fixed, named Natures; resolve only the Natures
    applicable to the attribute being read into that formula's expression multiplier.
  - **Decision:** Option B. Nature is a recognizable disposition, not an unexplained number. A
    person-level named collection preserves that identity, lets the Nature catalog say which
    attribute kinds each Nature affects, and makes every non-applicable Nature an explicit no-op
    rather than duplicated arbitrary data on unrelated attributes.

## Architecture

### Storage contract

Every attribute belonging to a person-entity carries this logical tuple:

```
per attribute: { IV, EV, formWindow, ageDiscountMeta }
per person:    { Natures[] }
```

- **IV** is the fixed innate baseline. It is a reference point, not a ceiling or a cap.
- **EV** is the signed, unbounded sum of earned `±delta` writes. Failures may lower it; neither
  slump recovery nor aging mutates it.
- **formWindow** is a ring buffer of recent `±delta` writes. It is a second view of those events,
  not a second learning stream.
- **ageDiscountMeta** is a fixed, hidden per-person meta-modulator. Together with the attribute's
  aging profile, it sets that person's prime offset and decline acceleration.
- **Natures** are fixed, named person-level dispositions. A Nature catalog maps each name to
  per-attribute-kind expression effects, so one Nature can explicitly raise one kind (`× > 1`) and
  lower another (`× < 1`), Pokémon-style. At read time, a formula resolves all applicable Natures
  for its input attribute; their effects compose multiplicatively in stable catalog order. No
  applicable Nature resolves to multiplier `1`.

This is a **person-attribute** contract. World inputs such as gear and weather remain flat and out
of scope. Visible and hidden attributes use the same tuple: hidden attributes may feed gameplay
formulas directly or meta-modulate another read/write formula. Cross-person effects (for example,
a captain or manager influence) are multi-person formula inputs; one person's outcome never writes
another person's EV.

### Effective-read pipeline

```
capacity: (IV, EV)
  → combine with the age discount applied to IV only
  → × resolve applicable person-level Natures for this attribute
  → faded capacity

formWindow → form read

formula-owned combine(faded capacity, form read)
  → clamp[-C, +C]
  → consumed value
```

The age discount is a read-time multiplier: it is decline-only, never exceeds `1`, and has a hard
per-profile floor. The capacity form is conceptually
`resolveNatures(person.natures, attributeKind) × (discount(age) × IV + EV)`; exact catalog effects,
constants, and attribute-profile assignments are tuning. Form does not receive the age discount.
`[-C,+C]` bounds a formula's consumed game-performance read, never stored EV; formulae deliberately
intended to read an unfaded aggregate may opt out of that clamp.

There is no global `effectiveAttribute` field or universal read algorithm. Each formula declares
how it combines faded capacity and form, then consumes only that result.

### Per-formula combination contract

The default formula combination is a linear weighted sum. A formula may opt into a local
per-attribute gate plus saturation curve when a specialist/collapsed-dimension outcome cannot be
represented honestly by a sum alone. That nonlinearity belongs only inside the consuming formula;
it never changes storage or the shared read pipeline.

The initial combination catalog establishes three intentionally different consumers:

| Consumer | Read contract |
| --- | --- |
| Manager/game decision | Form-heavy read of faded capacity plus recent form, normally clamped. |
| Scout | IV-heavy projected read, normally form-light or form-blind, able to expose composition and trajectory. |
| Salary | Unfaded EV/career-aggregate read, deliberately aggregate-oriented and unclamped. |

Future consumers add catalog entries rather than a new attribute store or a new global rating.

### Aging model

Each attribute type chooses an aging-profile family with a convex, accelerating decline after its
prime and a hard floor. The profile supplies the attribute-level character (for example, earlier,
faster physical decline versus later, gentler craft decline). `ageDiscountMeta` supplies the
per-person prime offset and acceleration rate together, so player-to-player variation stays in the
generated person rather than accumulating ad hoc control knobs. The discount does not create a
rise-to-prime: EV earning owns development; the discount only takes away from IV.

### Earning loop

For every person-entity, a graded outcome produces one signed `delta` for each attributable
attribute. The write appends that delta to the attribute's `formWindow` and adds it to EV. The
mechanism is uniform; only the outcome signal and its frequency, latency, and attribution clarity
vary by entity class.

Before implementation, each entity class must explicitly choose its **delta-zero convention**:
raw outcome, outcome versus that person's expectation, or outcome versus the league line. This is
a required contract choice because it controls which performances count as learning versus form.
The grader/event system that produces and attributes the value remains separate.

### Boundary and sequencing

```
person outcome
  → future grader/event system chooses delta and attribution
  → IV/EV pattern appends delta to formWindow and EV
  → future consumer selects a catalog entry
  → formula-owned read → consumed value
```

The next LID stage defines component-level interfaces, catalog ownership, and edge cases. It must
not infer a Sequelize migration from this HLD: the current `Player.attributes` shape is not the
storage decision for this pattern.

### Key trade-offs

- **Unbounded storage, bounded performance:** EV can tell the truth about a long career while a
  game formula remains bounded. This trades a simple stored rating for per-formula read work.
- **IV-only aging:** earned craft is intentionally durable, which makes exceptional high-EV
  veterans resilient; that is a modeling constraint for generation and archetype design, not a
  reason to erase the IV/EV distinction.
- **Uniform mechanism, variable grading:** staff and officials can have sparse or delayed form
  windows without a special-case model. The price is that every entity class must later state its
  signal and delta-zero convention explicitly.
- **Local nonlinearity:** gates and saturation can express specialist failure modes without
  contaminating every consumer, but a formula author must justify that escape hatch in its catalog
  entry.

### Out of scope

- The grader/event and attribution system that determines `delta` values, including Manager
  counterfactual grading ([#218](https://github.com/wulke/premier-league-baseball/issues/218)).
- Migration or persistence design against the current Sequelize schema, including any rewrite of
  `Player.attributes`.
- All tuning constants: `C`, event delta caps, form-window length, event granularity, Nature
  catalog effects, aging profile constants/primes/floors, and meta-modulator naming/ranges.
- Any first simulation, scouting, salary, UI, or API consumer implementation.
