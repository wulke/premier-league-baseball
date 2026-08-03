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
- **Backend**: `GameFactory.result()` (single-game simulate + status guard), new batch endpoint `POST /api/gameWorld/:gwId/simulate`, `Game.status` enum, `GameWorld.currentDate` field, transaction-scoped BPMN flow (guard → simulate → update, skip-vs-error split by single/batch mode).
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
  - Option B (chosen): Replace `GameFormula[]` with a typed `CompetitionFormat` object — a discriminated union on `structure` (`ROUND_ROBIN` | `KNOCKOUT`) with shared `legs`/`seriesLength`/`tiebreak` fields and knockout-only `seeding`.
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
