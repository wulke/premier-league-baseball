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
