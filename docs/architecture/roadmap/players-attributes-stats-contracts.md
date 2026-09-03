# Roadmap: Players, Attributes, Stats & Contracts

Driven by [Map: Players, Attributes, Stats & Contracts](https://github.com/wulke/premier-league-baseball/issues/59),
this roadmap defines the Epic-level requirements for introducing **Players** as a first-class concept —
real players belonging to Teams, with attributes/ratings, per-game stats, and Contracts. See
[HLD: Players, Attributes, Stats & Contracts](../../high-level-design.md#hld-players-attributes-stats--contracts)
for the design detail these epics summarize.

This is a **schema/shape roadmap**: none of these epics change `SimulationEngine` (stays random) or
build Roster/Player UI — both are future work once this schema lands (see "Out of scope" below).

## Epic 1: Player Model & Attribute Schema
Introduces `Player` as a first-class table, replacing the current no-roster state (`Team` is just an
`id`/`config`/`gameWorldId` row today).
*   **Detailed Design:** `docs/llds/player/player-attributes.md`
*   **Key Requirements:**
    *   New `Player` model: `teamId` (FK, nullable = free agent), `gameWorldId` (FK, scoped per-world), `attributes` (JSON).
    *   Flat, non-role-conditioned `attributes` shape: shared scalar ratings (`contact`/`power`/`armStrength`/`accuracy`/`reaction`/`vision`/`discipline`).
    *   Dense per-position `positions` affinity map (all 9 positions rated on every Player) — no stored `position` column; primary position derived at read-time.
    *   Per-pitch `pitches` repertoire array on every Player (including non-pitchers, who get weak defaults).

## Epic 2: Player Stats Schema
Establishes the storage grain for Player stats without wiring any writer yet.
*   **Detailed Design:** `docs/llds/player/player-stats.md`
*   **Key Requirements:**
    *   New `PlayerGameStats` model — single game-grain table, one row per `(playerId, gameId)`.
    *   Core batting columns (`AB/H/R/RBI/HR/BB/SO`) and Core pitching columns (`GS/IP/H/BB/SO/ER`) only; fielding and Common tiers deferred.
    *   No season/career tables — both are aggregate (`SUM`/`COUNT`) queries over `PlayerGameStats`.
    *   `G` derived, not stored; `W`/`L` dropped from v1; rate stats (`AVG`/`OBP`/`SLG`/`ERA`/`WHIP`) computed at read-time, never stored.
    *   Write path fully deferred — no code writes to `PlayerGameStats` until a future map wires real per-player game events into `SimulationEngine`.

## Epic 3: Contract Schema & Roster Constraints
Binds Players to Teams with a term, and defines roster size bounds.
*   **Detailed Design:** `docs/llds/player/player-contracts-roster.md`
*   **Key Requirements:**
    *   New `Contract` model: `playerId`/`teamId` FK + `startYear`/`endYear` only — no `value`/salary field in v1.
    *   Flat roster size constraint: min 20 / max 30 Players per Team, no per-position minimums.
    *   Roster-size and Contract-expiry enforcement explicitly **not** implemented in v1 (see spec statuses marked Deferred).

## Epic 4: Initial Roster Generation
Generates a randomized, valid roster (with starting Contracts) at Team creation.
*   **Detailed Design:** `docs/llds/player/player-contracts-roster.md`
*   **Key Requirements:**
    *   New `PlayerFactory` (`src/db/domain/player.ts`), called by `TeamFactory.create()` (`src/db/domain/team.ts`).
    *   Roster headcount randomized within [20, 30]; positions allocated proportionally (~40% Pitcher, remainder across 8 fielding positions) rather than a hardcoded template.
    *   Attribute/position/pitch values rolled uniform-random with no position-appropriate skew — skew tuning explicitly deferred to a later refinement pass.
    *   Starting Contracts auto-issued per generated Player with a flat 1-year term (`endYear = startYear`), a deliberate forcing function for early Contract-lifecycle work.

**Out of scope for this roadmap** (confirmed by the map): `SimulationEngine` using Player
attributes/stats to influence game outcomes; Player transfer/trade mechanics; Contract-expiry
enforcement/free-agency; draft/scouting or ongoing roster generation across multiple seasons;
Roster/Player UI. All parked for future wayfinder maps once this schema exists.

---

## Infrastructure Prerequisite

Before implementing these epics, three new Sequelize models are required (no changes to existing models):
1.  **New `Player` model:** `teamId` (FK, nullable), `gameWorldId` (FK), `attributes` (JSON) — see `docs/llds/player/player-attributes.md`.
2.  **New `PlayerGameStats` model:** `playerId` (FK), `gameId` (FK), Core batting/pitching columns — see `docs/llds/player/player-stats.md`.
3.  **New `Contract` model:** `playerId` (FK), `teamId` (FK), `startYear`, `endYear` — see `docs/llds/player/player-contracts-roster.md`.
