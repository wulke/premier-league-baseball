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
npm test               # Run all Jest tests (Node + JSDOM)
npm run test:bdd       # Run backend Gherkin tests (Node)
npm run test:ui        # Run React UI Gherkin tests (JSDOM)
npm run test:coverage  # Run tests with coverage report
npm run test:single    # Run tests single-threaded

# Docker
npm run build:docker   # Build Docker image
npm run start:docker   # Run container (port 8080 → 3000)
```

Run a single test file: `npx jest test/db/domain/game.test.ts`

> Tests always run against an isolated in-memory SQLite DB (forced under Jest by `NODE_ENV=test`/`JEST_WORKER_ID` in `src/db/client.ts`), never your file-backed `dev.sqlite` — so a direct `npx jest <file>` or an IDE Jest runner is safe.

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
  bdd/              # Backend Gherkin features + step definitions (Node)
  ui/               # UI Gherkin features + step definitions (JSDOM)
```

### Documentation
The `docs/architecture` directory maintains the implementation-agnostic designs related to the project.
- `docs/architecture/data-model` -> the latest data model structure.
- `docs/architecture/design` -> working docs for individual Use Cases or Process Flows.
- `docs/architecture/process-flow` -> low-level access patterns.
- `docs/architecture/roadmap` -> Epic-level groupings scoping major releases.
- `docs/architecture/prd` -> Product Requirement Documents for major technical tasks.
- `docs/architecture/standards` -> constitution-style backend conventions (domain layer ownership, schema modeling, error handling, testing, API contract) that every feature is expected to conform to, not restate.

### Testing Strategy (BDD)

- **Backend:** Uses `jest-cucumber` in a `node` environment. Mocks the database or uses an in-memory SQLite instance.
- **Frontend:** Uses `jest-cucumber` + `React Testing Library` in a `jsdom` environment. Mocks `fetch` / API responses via `test/ui/test-utils.tsx`.

---

## Linked-Intent Development

This repository follows the Linked-Intent Development (LID) methodology. [`LID.md`](LID.md) is the source of truth for the LID workflow, approval gates, traceability, and bug-fix protocol. All feature additions and bug fixes must follow the **Arrow of Intent**: `HLD → LLD → EARS → Tests → Code`.

### Navigation

| What you need | Where to look |
|---|---|
| LID methodology (source of truth) | [`LID.md`](LID.md) |
| High-level design (HLD) | `docs/high-level-design.md` |
| Low-level designs (LLD) | `docs/llds/` |
| EARS specs | `docs/specs/` |
| Acceptance scenarios (Gherkin) | `test/bdd/features/`, `test/ui/features/` (tagged `@spec`) |
