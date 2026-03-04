# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
npm run build          # Compile TypeScript + bundle UI with Parcel
npm run build:clean    # Clean dist/ then rebuild
npm run clean          # Remove dist/

# Run
npm run start          # Run Node server (requires built dist/)

# Test
npm test               # Run Jest tests with .env.test
npm run test:coverage  # Run tests with coverage report
npm run test:single    # Run tests single-threaded
npm run test:bdd       # Run gherkin tests

# Docker
npm run build:docker   # Build Docker image
npm run start:docker   # Run container (port 8080 → 3000)
```

Run a single test file: `npx jest test/db/domain/game.test.ts`

## Architecture

Full-stack TypeScript app: Express backend + React frontend, using SQLite via Sequelize.

```
src/
  index.ts          # Express entry point — serves static dist/ui/ + mounts /api router
  api/              # HTTP layer: router.ts, endpoints.ts, handlers.ts, models.ts
  db/
    client.ts       # Sequelize instance, model init, db.sync()
    model/          # Sequelize model definitions + associations.ts
    domain/         # Business logic via Factory pattern (GameWorldFactory, LeagueFactory, etc.)
  ui/               # React frontend bundled by Parcel
    app.tsx         # React root
    routes.tsx      # React Router: / → /:gwId → /:gwId/:leagueId
    pages/          # home.tsx, game-world.tsx, league.tsx
test/
  db/domain/        # Jest tests for domain factories
```

### Documentation
The `docs/architecture` directory maintains the implementation-agnostic designs related to the project.
- `docs/architecture/data-model` -> the latest data model structure. Ensure this is updated when code changes impact any data models in `src/db/model`
- `docs/architecture/design` -> will contain working docs for individual Use Cases or Process Flows that support different Epics (under `docs/architecture/roadmap` for Epics).
- `docs/architecture/process-flow` -> the low-level access patterns that are used to build out given Use Cases.
- `docs/architecture/roadmap` -> Epic-level groupings that will scope major and minor releases that focus on adding content and capabilities to the game loop for the user.
- `docs/architecture/test-cases` -> These help the system focus on test driven and behavioral driven development to ensure user-story style tests are added with every feature.

### Data Flow

```
React UI → fetch() → Express /api/* → handlers.ts → Domain Factory → Sequelize → SQLite
```

### Domain Layer (Factory Pattern)

The `src/db/domain/` factories encapsulate all business logic:
- `GameWorldFactory` — creates game worlds, orchestrates `newSeason()` via Sequelize transactions
- `LeagueFactory` — delegates to `DivisionFactory` per division
- `DivisionFactory` — generates games using round-robin rotation algorithm (supports one-leg/two-leg)
- `GameFactory` — creates games and records results (currently random score simulation)

### Key Data Model Relationships

```
GameWorld → hasMany → League → hasMany → Division
GameWorld → hasMany → Team → belongsToMany → Division (through DivisionSeason)
Division → hasMany → DivisionSeason → belongsToMany → Game (through DivisionSeasonGame)
```

`DivisionSeason` is the join table with temporal dimension (divisionId + teamId + year).

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/gameWorld` | List all game worlds |
| GET | `/api/gameWorld/:gwId` | Get game world with leagues + teams |
| GET | `/api/league/:leagueId` | Get league with divisions + teams |
| POST | `/api/gameWorld/new` | Create game world (teams, leagues, divisions) |
| POST | `/api/gameWorld/:gwId/season/new` | Start new season (increments year, generates games) |
| POST | `/api/game/:gameId/simulate` | Simulate a game result |

### Environment

`.env` for development, `.env.test` for tests:
```
DATABASE_URL=./dev.sqlite
SERVER_PORT=3000
SERVER_HOST=0.0.0.0
```

### Frontend Notes

- React 19 + React Router v7, styled with Stitches (CSS-in-JS) and Radix UI primitives
- State management is local React hooks only — no global store
- Parcel bundles UI output to `dist/ui/`, served as static files by Express
