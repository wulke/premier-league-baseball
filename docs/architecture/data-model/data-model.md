# Data Model (Sequelize)

This diagram is derived from `src/db/model/*.ts` and `src/db/model/associations.ts`.

```mermaid
erDiagram
  GAME_WORLD {
    int id PK
    json config
    int year
  }

  LEAGUE {
    int id PK
    json config
    int gameWorldId FK
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
```

Notes
- `DivisionSeason` has a unique composite index on `(divisionId, teamId, year)`.
- `Game.homeTeam` and `Game.awayTeam` are intended FKs to `Team.id` but are not defined as Sequelize associations yet.
