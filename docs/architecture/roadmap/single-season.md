# Roadmap: Full Season Simulation & Review

This roadmap defines the Epic-level requirements to achieve the first true end-to-end gameplay loop in Premier League Baseball: creating a game world, starting a season, and simulating through to completion.

## Epic 1: The Game Calendar (Temporal Progression)
Introduces the concept of time as a gameplay constraint.
*   **Key Requirements:**
    *   Add `currentDate` (DATEONLY) to the `GameWorld` model.
    *   Implement an "Advance Date" mechanism (manual or auto).
    *   Initialize `currentDate` during `newSeason()` from `config.seasonStartDate`.

## Epic 2: Matchday Execution (Batch Simulation Engine)
Handles the bulk simulation of games to allow efficient season progression.
*   **Detailed Design:** See [Simulate a Game Use Case](../archive/simulate-game-proposal.md)
*   **Key Requirements:**
    *   Implement Batch Simulation API (`POST /api/gameWorld/:gwId/simulate`).
    *   Add `status` (SCHEDULED, IN_PROGRESS, COMPLETED) to the `Game` model.
    *   Implement a replaceable `SimulationEngine` for score generation.
    *   Use database transactions for atomic matchday execution.

## Epic 3: Season Lifecycle & State Management
Ensures the system can transition between active play and post-season review.
*   **Key Requirements:**
    *   Implement real `isSeasonComplete()` logic in `DivisionFactory` and `LeagueFactory`.
    *   ~~Create a formal "End of Season" state.~~ **Amended** — [Map: Simulate a full season (League + League Cup) MVP](https://github.com/wulke/premier-league-baseball/issues/32)'s [#34](https://github.com/wulke/premier-league-baseball/issues/34) decided against a persisted GameWorld-level gate: season-complete is computed live from per-competition `isSeasonComplete`/`SeasonResult` checks. See `docs/llds/full-season-ui.md`.
    *   Gate `newSeason()` calls to ensure prior seasons are finalized. *(Deferred — `newSeason()` looping into a second season is out of scope for the single-season MVP; see Epic 7.)*

## Epic 4: The Manager’s Dashboard (Simulation UI)
Provides the user interface for driving the simulation loop.
*   **Key Requirements:**
    *   "Next Matchday" view showing upcoming games for the current `GameWorld` date.
    *   Interactive controls: "Simulate Today", "Simulate Week", and "Advance Date".
    *   Real-time standings updates in the UI.

---

# Extension: Dual-Competition Season MVP (League + League Cup)

Epics 1-4 above cover single-competition (round-robin League) simulation. This extension, driven
by [Map: Simulate a full season (League + League Cup) MVP](https://github.com/wulke/premier-league-baseball/issues/32),
adds the second concurrent competition — a knockout League Cup — to reach the MVP finish line: a
single season simulated to completion across both competitions, ending in a decided League table
*and* a decided Cup champion. See [HLD: Full Season Simulation](../../high-level-design.md#hld-full-season-simulation-league--league-cup)
for the design detail this extension summarizes.

## Epic 5: Reusable Competition Format
Replaces the ad hoc, conflated `GameFormula[]` config with a typed `CompetitionFormat`.
*   **Detailed Design:** `docs/llds/competition-format.md`
*   **Key Requirements:**
    *   Discriminated-union `CompetitionFormat` (`structure`: `ROUND_ROBIN` | `KNOCKOUT`) replacing `GameFormula[]`.
    *   Named shared constants (`STANDARD_LEAGUE_FORMAT`, `STANDARD_CUP_FORMAT`) replacing hand-authored inline arrays.
    *   `divisionConfig.format ?? leagueConfig.format` two-level fallback preserved.

## Epic 6: Knockout Bracket Simulation
Takes the League Cup from "seeds round 1 and stops" to a fully simulatable knockout tournament.
*   **Detailed Design:** `docs/llds/knockout-bracket.md`
*   **Key Requirements:**
    *   Power-of-2 field reduction with front-loaded byes at bracket generation (`docs/llds/knockout-bracket.md`).
    *   Round-advancement hooked into the shared game-completion path (single + batch simulate).
    *   Three `tiebreak` modes (`AGGREGATE_SCORE`, `OVERTIME`, `ANOTHER_GAME_W_OVERTIME`) for level `TWO_LEG` ties.
    *   New `SeasonResult` table recording the champion for both `KNOCKOUT` and top-tier `ROUND_ROBIN` divisions.
    *   New `GET /api/league/:leagueId/bracket` endpoint (`docs/llds/bracket-api.md`) exposing bracket state.

## Epic 7: Full-Season UI
Extends the single-competition simulation UI to a full, decided two-competition season.
*   **Detailed Design:** `docs/llds/full-season-ui.md`
*   **Key Requirements:**
    *   `BracketView` component (round-grouped, byes grouped, series expand-on-click) as the `KNOCKOUT` counterpart to `StandingsTable`.
    *   Competition-agnostic champion banner on the League identity block, reading `SeasonResult`.
    *   Computed "Season Complete" block on the GameWorld hub once both Leagues are decided.
    *   `TeamCalendar` route unification (`/:gwId/team/:teamId/calendar`) showing a team's games across both competitions.

**Out of scope for this MVP** (confirmed by the map): promotion/relegation between League/Championship
divisions; looping `newSeason()` into a second season; a multi-season "new season transition" UX
(parked for a future wayfinder map).

---

## Infrastructure Prerequisite (Current Design)
Before implementing these epics, the following data model changes identified in the [Simulate a Game Use Case](../archive/simulate-game-proposal.md) are required:
1.  **Game Model:** Add `status` (`ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')`).
2.  **GameWorld Model:** Add `currentDate` (`DATEONLY`).
3.  **New `SeasonResult` model:** `divisionId`, `year`, `championTeamId` (nullable) — see `docs/llds/knockout-bracket.md`.
