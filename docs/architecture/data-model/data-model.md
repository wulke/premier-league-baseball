# Data Model (Sequelize)

This diagram is derived from `src/db/model/*.ts` and `src/db/model/associations.ts`.

```mermaid
erDiagram
  GAME_WORLD {
    int id PK
    json config
    int year
    date currentDate "nullable"
    int managedTeamId "nullable — user-managed Team pointer"
  }

  LEAGUE {
    int id PK
    json config
    int gameWorldId FK
    int year "League season year"
    string status "CUTOVER | IN_SEASON; default CUTOVER"
  }

  DIVISION {
    int id PK
    json config
    int leagueId FK
  }

  TEAM {
    int id PK
    json config
    int gameWorldId FK
  }

  DIVISION_SEASON {
    int id PK
    int divisionId FK
    int teamId FK
    int year
    int bracketSlot "nullable — elimination only"
  }

  GAME {
    int id PK
    int homeTeam  "FK to Team.id (implicit)"
    int awayTeam  "FK to Team.id (implicit)"
    int round     "nullable — matchday or elimination round number"
    date scheduledDate
    int homeTeamResult
    int awayTeamResult
  }

  DIVISION_SEASON_GAME {
    int id PK
    int gameId FK
    int divisionSeasonId FK
  }

  SEASON_RESULT {
    int id PK
    int divisionId FK
    int year
    int championTeamId "FK to Team.id — nullable until decided"
  }

  PLAYER {
    int id PK
    int teamId FK "nullable — null = free agent; denormalized current-team pointer, see notes"
    int gameWorldId FK
    json attributes
  }

  PLAYER_GAME_STATS {
    int id PK
    int playerId FK
    int gameId FK
    int AB
    int H
    int R
    int RBI
    int HR
    int BB
    int SO
    bool GS
    int IP
    int ER
  }

  CONTRACT {
    int id PK
    int playerId FK
    int teamId FK
    int startYear
    int endYear
  }

  GAME_WORLD ||--o{ LEAGUE : has_many
  GAME_WORLD ||--o{ TEAM : has_many
  LEAGUE ||--o{ DIVISION : has_many
  DIVISION ||--o{ DIVISION_SEASON : has_many
  TEAM ||--o{ DIVISION_SEASON : has_many

  DIVISION ||--o{ DIVISION_SEASON : "through"
  TEAM ||--o{ DIVISION_SEASON : "through"

  GAME ||--o{ DIVISION_SEASON_GAME : has_many
  DIVISION_SEASON ||--o{ DIVISION_SEASON_GAME : has_many
  GAME }o--o{ DIVISION_SEASON : "through DivisionSeasonGame"

  DIVISION ||--o{ SEASON_RESULT : has_many

  GAME_WORLD ||--o{ PLAYER : has_many
  TEAM ||--o{ PLAYER : "has_many (nullable — free agents unassigned)"
  PLAYER ||--o{ PLAYER_GAME_STATS : has_many
  GAME ||--o{ PLAYER_GAME_STATS : has_many
  PLAYER ||--o{ CONTRACT : has_many
  TEAM ||--o{ CONTRACT : has_many
```

Notes
- `DivisionSeason` has a unique composite index on `(divisionId, teamId, year)`.
- `League.year` is the League-scoped season year; `League.status` is its lifecycle phase and defaults to `CUTOVER`.
- `GameWorld.managedTeamId` is a nullable, user-managed Team pointer. It is intentionally not a
  database association or an ownership gate yet: `GameWorldFactory.setManagedClub` validates that
  a non-null Team belongs to the same GameWorld before writing it, and `null` means unclaimed.
- `Game.homeTeam` and `Game.awayTeam` are intended FKs to `Team.id` but are not defined as Sequelize associations yet.
- `SeasonResult` (new, [HLD: Full Season Simulation](../../high-level-design.md#hld-full-season-simulation-league--league-cup)) is a general-purpose historical-fact table, not a live-season field — one row per `(divisionId, year)` once that division's season is decided. Populated for `KNOCKOUT` divisions when a round resolves to a single winner, and for the top-tier `ROUND_ROBIN` division when `isSeasonComplete` flips true. It is the single place the UI's champion banner reads from, regardless of competition structure. See `docs/llds/knockout-bracket.md`.
- `Division.config` (JSON) carries a `CompetitionFormat` — a discriminated union on `structure` (`ROUND_ROBIN` | `KNOCKOUT`) that replaces the old flat `GameFormula[]` array; resolved as `divisionConfig.format ?? leagueConfig.format`. See `docs/llds/competition-format.md`. Not modeled as ERD columns since it lives inside the existing `config` JSON blob, not new typed columns.
- `Game.round` (existing, previously matchday-only) and `DivisionSeason.bracketSlot` (existing) are reused as-is for knockout round-advancement — no new `Game`/`DivisionSeason` columns were needed for the bracket redesign. Byes are `Game` rows with `awayTeam: null`, already-`COMPLETED`; tiebreaker games reuse the tied legs' `round` number rather than introducing a new field.
- `Player`, `PlayerGameStats`, `Contract` (new, [HLD: Players, Attributes, Stats & Contracts](../../high-level-design.md#hld-players-attributes-stats--contracts) — **planning-only, not yet implemented**): `Player` is a first-class table scoped per-`GameWorld` (mirrors `Team.gameWorldId`), `teamId` nullable to represent a free agent. `attributes` is a flat non-role-conditioned JSON shape (shared scalar ratings + dense per-position affinity map + per-pitch repertoire) — no stored `position` column; primary position is derived at read-time. `PlayerGameStats` is the only stored stats fact — one row per `(playerId, gameId)`, Core batting + Core pitching columns only; season/career stats are aggregate queries over it, not separate tables, and this table has no writer yet. `Contract` binds one `Player` to one `Team` with `startYear`/`endYear` only (no `value` field); roster size is a flat headcount range (min 20/max 30) enforced only by the generation algorithm, not by schema validation. `Player.teamId` and `Contract` deliberately both encode team membership: `Contract` is the authoritative, historical record (one row per team-tenure, with a term), while `Player.teamId` is a denormalized "current team" pointer kept for query ergonomics (reading a plain FK instead of filtering `Contract` rows to the one covering the current `GameWorld.year`). Initial roster generation writes both together, so they can't drift there; keeping them in sync is an obligation for whichever future map introduces post-generation team changes (transfers/trades), not yet solved by any code path. See `docs/llds/player-attributes.md`, `docs/llds/player-stats.md`, `docs/llds/player-contracts-roster.md`.
