# Specs: Route-Loader Foundation

UI requirements for **Batch 0** of the route-loader migration (`docs/llds/shell/route-loader-foundation-ui.md`):
the shared `RouteObject[]` route configuration, the `gw` loader that lands on the `:gwId` route, and
`useRevalidator()` replacing `GameWorldProvider`'s `invalidate()`/`refreshToken`. This supersedes
`GameWorldProvider` (`src/ui/context/game-world-context.tsx`, **deleted**) and amends the specs that
named its contract directly: SIMUI-001…SIMUI-005 (`simulate-game-ui-specs.md`) and SIMUI-015/SIMUI-018
(`app-shell-ui-specs.md`) are superseded in *mechanism* by RLDRUI-001…RLDRUI-003 below (same
player-visible behavior — one shared fetch per `gwId`, `gw` null on failure, mutations trigger a
refresh — realized via a route loader instead of a Context provider). SIMUI-027 is reworded by
RLDRUI-005 for the same reason. None of those prior rows are marked retired here; per LID convention
the cascade (status update + wording cut-over) happens at Code (stage 5) when this batch's
implementation actually replaces the provider, not at the EARS stage.

Upstream: [HLD](../high-level-design.md#hld-route-loader-data-migration) ·
[LLD](../llds/route-loader-foundation-ui.md).

| ID | Requirement | Status |
|---|---|---|
| RLDRUI-001 | WHEN a route under `/:gwId` is matched THE system SHALL invoke the `gw` loader attached to the `:gwId` route concurrently with the navigation transition, issuing GET `/api/gameWorld/:gwId` once per matched `gwId` value and exposing the result to every descendant component via `useRouteLoaderData('gwId')`, superseding SIMUI-001/SIMUI-004's context-based fetch-and-share with the same one-fetch-per-`gwId` guarantee | [ ] |
| RLDRUI-002 | WHEN the `gw` loader's fetch IF the response is non-200 or the fetch rejects THE system SHALL resolve the loader to `null` rather than throwing or rendering an error boundary, preserving SIMUI-005's contract that `gw` is `null` while loading or after a failed fetch | [ ] |
| RLDRUI-003 | WHEN GameWorld's Start Season, BatchSimulateControl's Simulate Today, RapidSimulateControl's Rapid Simulate Season, or TeamHub's claim/resign-club mutation completes with a 2xx response THE system SHALL call `useRevalidator().revalidate()` fire-and-forget (not awaited) in place of the retired `invalidate()`, re-running the `gw` loader within the currently matched route tree only, superseding SIMUI-002/SIMUI-003/SIMUI-015's `refreshToken`-increment mechanism with the same "mutation triggers a shared refresh" behavior; WHEN such a mutation instead returns a non-2xx response THE system SHALL NOT call `revalidate()`, superseding SIMUI-018's equivalent "leave `refreshToken` unchanged" guarantee | [ ] |
| RLDRUI-004 | WHEN a navigation is superseded before the `gw` loader resolves THE system SHALL abort the superseded fetch via the loader's `request.signal`, replacing the retired manual `cancelled`-flag cleanup with React Router's native loader cancellation | [ ] |
| RLDRUI-005 | WHEN the `gw` loader for the active `:gwId` route re-runs (including via a `revalidate()` call from any of the four mutation sites in RLDRUI-003) IF TeamCalendar is mounted THE system SHALL re-trigger TeamCalendar's own GET `/api/team/:teamId/calendar` fetch by keying its effect on the `gw` loader result's identity, superseding SIMUI-027's `refreshToken`-keyed re-fetch with the same "a batch simulation triggers a TeamCalendar re-fetch" outcome, until TeamCalendar receives its own loader (tracked separately) | [ ] |
| RLDRUI-006 | WHEN the application boots or a UI acceptance test renders any route THE system SHALL resolve the route tree from the single `RouteObject[]` exported by `routes.tsx`, consumed by `createBrowserRouter` in the app and `createMemoryRouter` in tests, and SHALL NOT maintain a second, manually-stubbed route or router definition for any page's acceptance tests | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired.*

No `Deferred` rows in this batch — every requirement above lands with Batch 0. Skeleton design,
per-unit `defer()` granularity, and each remaining page's own loader are out of scope here and
tracked by their own batch LLDs/specs (Batches 1–5, `docs/llds/route-loader-<batch>-ui.md`, TBD).

## Traceability

- LLD: [`docs/llds/shell/route-loader-foundation-ui.md`](../llds/route-loader-foundation-ui.md)
- HLD: [`docs/high-level-design.md` — "HLD: Route-Loader Data Migration"](../high-level-design.md#hld-route-loader-data-migration)
- Source decision: [Map #229](https://github.com/wulke/premier-league-baseball/issues/229) · [#230](https://github.com/wulke/premier-league-baseball/issues/230) · [#231](https://github.com/wulke/premier-league-baseball/issues/231) · [#233](https://github.com/wulke/premier-league-baseball/issues/233) · [#235 (Batch 0)](https://github.com/wulke/premier-league-baseball/issues/235)
- **Superseded specs (mechanism only, player-visible behavior unchanged; cascade to `[~]`/reworded status at Code stage, not here):**
  - [`simulate-game-ui-specs.md`](./simulate-game-ui-specs.md) SIMUI-001…SIMUI-005 (`GameWorldProvider` fetch/share/null contract) → RLDRUI-001/002.
  - [`simulate-game-ui-specs.md`](./simulate-game-ui-specs.md) SIMUI-027 (`refreshToken`-keyed TeamCalendar re-fetch) → RLDRUI-005.
  - [`app-shell-ui-specs.md`](./app-shell-ui-specs.md) SIMUI-015/SIMUI-018 (`invalidate()` call/no-call on batch success/failure) → RLDRUI-003.
- **Unaffected specs (same file, no mechanism change this batch):** SIMUI-019…026, SIMUI-028 (per-row `GameRow` simulate; untouched by the loader swap) remain governed by `simulate-game-ui-specs.md`. SHELL-001, SHELL-004…010, SIMUI-006/007, SIMUI-009…014, SIMUI-016/017 (`app-shell-ui-specs.md`) are unaffected — only their `gw`/`invalidate` data source changes, not their behavior.
- **Gherkin:** no new feature file — existing scenarios in `test/ui/features/app-shell-ui.feature` and `test/ui/features/simulate-game-ui.feature` are re-bound to the new harness (`docs/llds/shell/route-loader-foundation-ui.md` u7/u8) with no wording change, since no player-visible behavior changes in this batch.
- **Step definitions:** `test/ui/steps/app-shell-ui.steps.test.tsx`, `player-detail-ui.steps.test.tsx`, `managed-club-ui.steps.test.tsx`, `lineup-view-ui.steps.test.tsx`, `team-roster-ui.steps.test.tsx` (harness swap only) · `simulate-game-ui.steps.test.tsx`, `rapid-simulate-season-ui.steps.test.tsx` (harness swap + drop the `react-router` mock) — RLDRUI-006.
- **Code entry points:**
  - `src/ui/routes.tsx` (`gwLoader`, `RouteObject[]` export) — RLDRUI-001, RLDRUI-002, RLDRUI-004, RLDRUI-006
  - `src/ui/app.tsx` (`createBrowserRouter`/`RouterProvider`) — RLDRUI-006
  - `src/ui/context/game-world-context.tsx` — DELETED (superseded by RLDRUI-001…004)
  - `src/ui/components/{app-shell,nav-rail,batch-simulate-control,rapid-simulate-control}.tsx` — RLDRUI-001, RLDRUI-003
  - `src/ui/pages/{game-world,team-hub,team-calendar}.tsx` — RLDRUI-001, RLDRUI-003, RLDRUI-005

## Amendment: League Dashboard / Standings Route Split (#321)

Amends the `:leagueId` route/loader documented above (still governed by `RLDRUI-006`'s shared
`RouteObject[]` invariant) to split it into two sibling routes. Content requirements for what each
page renders live in `docs/specs/league/league-dashboard-ui-specs.md` (`LDASH-001`..`LDASH-010`);
the rows below cover routing/loader shape only. LLD: [`docs/llds/shell/route-loader-foundation-ui.md`](../../llds/shell/route-loader-foundation-ui.md)'s
"Amendment: League Dashboard / Standings Route Split" section.

| ID | Requirement | Status |
|---|---|---|
| STDRT-001 | WHEN a route at `/:gwId/:leagueId` is matched THE system SHALL invoke a dashboard loader that fetches `GetLeague`, `GetLeagueToday`, `GetLeagueStandings`, and `GetLeagueBracket` concurrently and renders `LeagueDashboard` with the combined result, replacing today's single `leagueLoader`+`League` pairing at that path | [ ] → #321 |
| STDRT-002 | WHEN a route at `/:gwId/:leagueId/standings` is matched THE system SHALL invoke a loader that fetches `GetLeague`, `GetLeagueStandings`, and `GetLeagueBracket` concurrently (unchanged from today's `leagueLoader` fetch shape) and renders `LeagueStandings` (today's `League` component, renamed, with its identity header reduced to name + type badge only) | [ ] → #321 |
| STDRT-003 | WHEN the application resolves `/:gwId/:leagueId` after this change THE system SHALL render the League Dashboard, NOT the pre-#321 full standings/bracket body, and SHALL NOT redirect to `/standings` or show a deprecation/transition notice — an accepted breaking change to the old URL's behavior, per #297's `/grill-me` (single-player local game, no external bookmarking concern) | [ ] → #321 |
| STDRT-004 | WHEN the dashboard loader's `GetLeagueToday` call fails or returns non-ok THE system SHALL resolve that slice to `[]` independent of the other three calls' outcomes, matching the existing per-call `readJson` fallback contract already used for `standings`/`brackets` | [ ] → #321 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

- **Gherkin:** `test/ui/features/league-dashboard-routing-ui.feature` (NEW, Red — kept separate from `route-loader-foundation-ui.feature` since that file already has a bound step-definition suite that auto-binds every scenario in it; a new feature file with no step definitions is this repo's established way to land Red scenarios without breaking CI, matching `league-dashboard-ui.feature`) — `STDRT-001`..`STDRT-004`.
- **Code entry points (not yet implemented):** `src/ui/routes.tsx` (`leagueDashboardLoader`, `leagueStandingsLoader`, route split) — STDRT-001, STDRT-002, STDRT-003, STDRT-004.
