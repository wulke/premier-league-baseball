# New Season Schedule UI Design

## Scope
This design focuses on:
1. UI flow for starting a new season and instantiating games.
2. Team "calendar" style season schedule view in chronological order.

Constraints:
- Do not change existing UI libraries or design patterns.
- Minimal styling is acceptable.
- Follow current React + `react-router` + inline style / stitches usage.

Anchors in current code:
- `src/ui/pages/game-world.tsx`
- `src/ui/pages/league.tsx`
- `src/ui/routes.tsx`

## 1) Start New Season UI Flow

### User Flow
1. User opens Game World page (`/:gwId`).
2. If `gw.config.inProgress === false`, show `Start New Season`.
3. Click opens inline confirmation panel (no new modal library).
4. Panel shows:
   - Current year and next year
   - Impact note: creates DivisionSeason entries + games
   - `Confirm` and `Cancel`
5. On confirm:
   - Disable controls
   - Show `Creating season...`
   - `POST /api/gameWorld/:gwId/season/new`
6. On success:
   - Show success message briefly
   - Auto-navigate to game world home (`/:gwId`) — `gw.config.inProgress` will now be `true`,
     which hides the "Start New Season" button and shows league navigation
7. On failure:
   - Show inline error message
   - Show retry action
   - Keep user on page

### UI State Model
- `idle`
- `confirming`
- `submitting`
- `success`
- `error`

### Design Notes
- Keep action on the `GameWorld` page to match current mental model.
- Confirmation is inline to preserve current minimal UI style.
- No blocking overlays required.
- `gw.config.inProgress` is the authoritative flag for pre-season vs. in-season state. It transitions
  to `true` on `newSeason()` and enables future pre-season activity gates.
- On success, navigate using the API response data directly — do **not** read from stale React state
  (see Task 1 re: stale closure fix).

## 2) Team Calendar View

### Route
Add route:
- `/:gwId/:leagueId/team/:teamId/calendar`
- `year` is an optional query parameter (`?year=Y`). Defaults to current game world year (`gw.year`).
  Passing an explicit year allows viewing historical seasons.

### Entry Points
1. Team name click from League standings table.
2. Optional fallback entry from team list when standings unavailable.

### Page Structure
1. Header:
   - Team name
   - Season year
   - Back link to League (`/:gwId/:leagueId`)
2. Filter row:
   - Status filter: `All | Scheduled | Played`
3. Chronological schedule list:
   - Group by month
   - Games sorted by `scheduledDate ASC`
4. Game row/card:
   - Date/time or `TBD`
   - Home/Away marker
   - Opponent name
   - League / Division label (shows competition context since all games across leagues are shown)
   - Result if complete, otherwise `Scheduled`

### Scope: All Games Across Leagues
The default calendar shows **all games** for the team in the given season across all leagues and
competitions. The `leagueId` in the route provides navigation context (back link) but does **not**
filter the game list.

A league-scoped filtered view (showing only games within a specific league/competition) is a future
enhancement. It will require an additional UI select component for filtering by league/competition
and is out of scope for this iteration.

### Sorting and Display Rules
- Primary sort: `scheduledDate ASC`.
- Null `scheduledDate` items go to bottom under `Unscheduled`.
- Played game: both `homeTeamResult` and `awayTeamResult` are non-null.

### Empty/Error States
- Empty: `No games scheduled for this team yet.`
- Error: inline error and retry.

## 3) Backend Contract Needed for Calendar View

> **Note:** This endpoint is **not** covered in `new-season-schedule-db-design.md` (T1–T11).
> T11 adds `GET /api/division/:divisionId/games` which is division-scoped and separate.
> The team calendar endpoint must be added as a standalone backend task (see Task Breakdown below).

Recommended endpoint:
- `GET /api/team/:teamId/calendar?gwId=:gwId&year=:year`

Parameters:
- `gwId` — required; used to scope the query to a specific game world
- `year` — optional; defaults to `GameWorld.year` for the given `gwId`

Recommended response shape:
- `teamId`
- `teamName`
- `year`
- `games: TeamSeasonGame[]`

`TeamSeasonGame` fields:
- `gameId`
- `scheduledDate | null`
- `homeTeamId`
- `homeTeamName`
- `awayTeamId`
- `awayTeamName`
- `leagueName`
- `divisionId`
- `divisionName`
- `roundLabel | null`
- `homeTeamResult | null`
- `awayTeamResult | null`

Rationale:
- Front end gets all display metadata in one request.
- Avoids stitching game, team, division, and league data client-side.
- `leagueId` removed from query params — the endpoint returns all games for the team; league context
  comes from the route for navigation only.

## 4) Isolated Task Breakdown

1. Fix stale closure bug in `startNewSeason` in `game-world.tsx`: navigate using the API response
   data directly, not from `gw` state. Add a test case that verifies the correct route is navigated
   to after a successful season start.
2. Fix `isOpen` state in `Division` collapsible in `league.tsx`: wire `onOpenChange` to the local
   `isOpen` state and correct the inverted icon logic.
3. Implement start-new-season UI state machine in `game-world.tsx` (replaces current bare button).
4. Add inline confirmation block component for new-season action.
5. Create calendar page component scaffold with mock data.
6. Add calendar route in `routes.tsx`.
7. Add team-to-calendar navigation from `league.tsx` (team name as clickable entry point from
   standings table).
8. Add backend `GET /api/team/:teamId/calendar` endpoint: handler, query (join Game + Team +
   DivisionSeason + Division + League), and `Endpoints` enum entry. Scoped by `gwId`; `year`
   optional, defaults to `GameWorld.year`.
9. Integrate calendar API fetch and loading/error states in calendar page.
10. Implement sorting/grouping/filter helpers for calendar entries (date grouping, status filter,
    null-date handling).
11. **(Low priority)** Migrate `onClick` + `useNavigate` to `<Link>` for navigation cases that do
    not require transition logic (e.g., league buttons in `game-world.tsx`, team name in standings).
12. Final QA pass for flow states and route regressions.

## 5) Acceptance Criteria (Review Gate)

### Start New Season
- User can confirm/cancel before API call.
- UI reflects `submitting`, `success`, and `error` states.
- No duplicate season-start requests while submitting.
- On success, navigates to `/:gwId` using response data (not stale state).

### Team Calendar
- Calendar route resolves with team context.
- Games display in chronological order across **all** leagues/competitions for the team.
- Year defaults to current game world year; historical year can be passed via `?year=` query param.
- Null dates are handled in `Unscheduled`.
- Played vs scheduled status is clear and consistent.
- League / division context is shown per game row.

### Compatibility
- No new UI library introduced.
- Existing route patterns and page structure retained.
- Minimal styling approach preserved.
