# LLD: Pre-Game Prep UI

## Interface / Data Model

`/:gwId/:leagueId/game/:gameId` is a managed-club preparation surface for a scheduled game.
Its loader finds the game in the managed club's existing calendar response, fetches that club's
roster and game-scoped lineup card (`GET /api/team/:teamId/lineup?gwId=&gameId=`), and reads the
league standings plus opponent roster. The game-scoped lineup is the existing `Lineup(gameId)`
snapshot; it is never a new per-game override type.

The nested prep loader performs its own `GameWorld` read to obtain `managedTeamId` before it can
scope its calendar and lineup requests. React Router executes matched loaders in parallel and does
not provide a parent loader's resolved value to a child loader; the component reuses the parent
`gwId` loader data once rendering begins. This bounded duplicate read is intentional until route
loader context is introduced.

## Logic Flow

1. Resolve `GameWorld.managedTeamId`; reject the route as unavailable when no managed club exists
   or the requested game is not on that club's calendar.
2. Render matchup date, home/away context, opponent record from the selected league standings, and
   the first pitcher in the opponent roster as the probable starter. Park and weather are excluded.
3. Embed the active-lineup editor with the resolved game snapshot. Saving uses the existing
   `PATCH /api/team/:teamId/lineup/:gameId` wholesale snapshot replacement endpoint.
4. A scheduled game exposes the lineup editor and **Ready to sim** only when it mirrors the
   backend's `simulate()` readiness guard exactly: a null `scheduledDate` is ready unconditionally
   (the backend skips its currentDate check in that case too), and a set `scheduledDate` is ready
   only when it is on or before `GameWorld.currentDate` — the same non-strict boundary
   `simulateToday`'s batch loop also uses. A scheduled game that isn't ready by that rule renders
   the opponent-context section only, as a read-only preview: no lineup editor, no **Ready to sim**
   control. **Ready to sim** posts to the existing `SimulateGame` mutation; on success the route
   revalidates and shows the completed score. Non-managed, locked, and not-yet-ready games expose
   no editing or simulation controls.

## Edge Case Probe

- A direct URL names another team's game -> show an unavailable state; do not expose a mutation.
- The game snapshot does not yet exist -> the game-lineup read materializes the existing active
  lineup snapshot before returning it, preserving the snapshot-on-simulate semantics.
- Standings or pitcher data is absent -> render an em dash / "TBD" rather than blocking prep.
- Simulate rejects (for example, future game date) -> retain the prep screen and show the API error.
- A scheduled game's `scheduledDate` is set and after `GameWorld.currentDate` -> render the
  opponent-context preview only; withhold the lineup editor and "Ready to sim" so the client never
  even attempts the mutation the backend would 422 on.
- A scheduled game's `scheduledDate` is set but `GameWorld.currentDate` is unset -> treat the game
  as not-ready (read-only), mirroring the backend's own required-currentDate guard rather than
  assuming the game is ready.
- A scheduled game's `scheduledDate` is `null` -> ready regardless of `GameWorld.currentDate`
  (including when `currentDate` is also unset), matching the backend's `simulate()`, which only
  runs the currentDate check `if (scheduledDate != null)`.
