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
