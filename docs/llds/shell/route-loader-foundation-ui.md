# LLD: Route-Loader Foundation (routes.tsx, GameWorldProvider → `:gwId` loader, test harness)

> Upstream: [HLD: Route-Loader Data Migration](../high-level-design.md#hld-route-loader-data-migration) ·
> EARS: `docs/specs/shell/route-loader-foundation-ui-specs.md` (`RLDRUI-001`..) ·
> Decision record: [#229 (map)](https://github.com/wulke/premier-league-baseball/issues/229) ·
> [#230 (GameWorldProvider → loader)](https://github.com/wulke/premier-league-baseball/issues/230) ·
> [#231 (blocking vs. defer)](https://github.com/wulke/premier-league-baseball/issues/231) ·
> [#233 (test harness pattern)](https://github.com/wulke/premier-league-baseball/issues/233) ·
> [#235 (rollout plan — this is Batch 0)](https://github.com/wulke/premier-league-baseball/issues/235)

## Scope

**Batch 0** of the six-batch rollout (#235): the foundation every later batch depends on.
Covers exactly two things:

1. **`routes.tsx` → shared `RouteObject[]`** and the app/test render call swap
   (`createBrowserRouter`/`createMemoryRouter` + `<RouterProvider>`), per #233.
2. **`GameWorldProvider` deletion** and the `gw` loader landing on the `:gwId` Route, plus
   migrating every direct consumer of `useGameWorldContext()` to `useRouteLoaderData('gwId')`
   / `useRevalidator()`, per #230.

**Explicitly out of scope** (each is a later batch, with its own LLD):

- Any page's *own* data-fetching migration to a loader — `PlayerDetail`/`TeamRoster`
  (Batch 1), `TeamCalendar`'s search-params loader (Batch 2, #234), `TeamLineup`'s
  per-fetch defer (Batch 3), `GameWorld`'s per-league defer and `League`'s per-section defer
  (Batch 4), `Home` (Batch 5). Those pages' `useEffect`+`fetch` bodies are **untouched** by
  this LLD except where they read `gw`/`invalidate` from the now-deleted context (below).
- Not-found/error modeling for loaders — decided in #233 as "no change" (loader-returns-`null`,
  page renders its own branch); this batch introduces no loader that can 404, so it doesn't
  apply here regardless.
- Skeleton component design for deferred sections — Batch 3/4 concern.

**Touches, but does not fully migrate, three pages that consume `gw`/`invalidate` today:**
`GameWorld`, `TeamHub`, `TeamCalendar`. Each keeps its own `useEffect`+`fetch` fetching
*its own* data unchanged in this batch — only the lines reading the shared `gw` value or
calling `invalidate()` are repointed at the new loader/revalidator, because
`GameWorldProvider`'s deletion removes their only source for that value today. See Edge
Case Probe u4–u6.

## Interface / Data Model

### `routes.tsx` — exported `RouteObject[]` (MODIFIED)

```ts
// src/ui/routes.tsx
import { createRoutesFromElements, Route, type RouteObject } from 'react-router';

const routes: RouteObject[] = createRoutesFromElements(
  <Route element={<AppShell />}>
    <Route index element={<Home />} />
    <Route path=":gwId" id="gwId" loader={gwLoader}>
      <Route index element={<GameWorld />} />
      <Route path=":leagueId" element={<League />} />
      <Route path="player/:playerId" element={<PlayerDetail />} />
      <Route path="team/:teamId" element={<TeamHub />}>
        <Route index element={<Navigate to="calendar" replace />} />
        <Route path="calendar" element={<TeamCalendar />} />
        <Route path="roster" element={<TeamRoster />} />
        <Route path="lineup" element={<TeamLineupView />} />
      </Route>
    </Route>
  </Route>,
);

export default routes;
```

`routes.tsx` no longer exports a `<Routes/>`-wrapping component — it exports the
`RouteObject[]` itself. `src/ui/app.tsx` builds `createBrowserRouter(routes)` once and
renders `<RouterProvider router={router} />`. The `:gwId` Route gets its `loader` and
explicit `id="gwId"` here (previously bare); every other route's `element` is unchanged
from today's tree (`src/ui/routes.tsx` as read for this LLD).

### `gw` loader (NEW, co-located in `routes.tsx` or a new `src/ui/loaders/game-world.ts`)

```ts
type GameWorldLoaderData = any | null; // same shape `gw` has always had; no new typing introduced here

async function gwLoader({ params, request }: LoaderFunctionArgs): Promise<GameWorldLoaderData> {
  const response = await fetch(Endpoints.GetGameWorld.replace(':gwId', params.gwId!), {
    method: 'GET',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    signal: request.signal,                                            // RLDRUI-004
  }).catch(() => null);
  if (!response || !response.ok) return null;                          // RLDRUI-002 (SIMUI-005 parity)
  return response.json();
}
```

One fetch per `:gwId` route match — matches `GameWorldProvider`'s existing
`[gwId, refreshToken]`-keyed effect exactly, minus the `refreshToken` dependency (revalidation
now comes from React Router, not a counter — see Logic Flow).

### Consumers — `useGameWorldContext()` → `useRouteLoaderData`/`useRevalidator` (MODIFIED)

```ts
// Before (every file below):
const { gw, invalidate } = useGameWorldContext();

// After:
const gw = useRouteLoaderData('gwId') as GameWorldLoaderData;
const { revalidate } = useRevalidator();
// invalidate() call sites become: revalidate();
```

Applies verbatim to:

| File | What it read from context | Becomes |
|---|---|---|
| `nav-rail.tsx` | `gw` | `useRouteLoaderData('gwId')` |
| `batch-simulate-control.tsx` | `gw`, `invalidate` | `useRouteLoaderData('gwId')`, `useRevalidator().revalidate` |
| `rapid-simulate-control.tsx` | `gw`, `invalidate` | `useRouteLoaderData('gwId')`, `useRevalidator().revalidate` |
| `app-shell.tsx` (`ShellInvalidateProbe`) | `invalidate` | `useRevalidator().revalidate` (test-only hook, u6) |
| `game-world.tsx` (`GameWorld` page) | `gw`, `invalidate` (in `startNewSeason`) | `useRouteLoaderData('gwId')`, `useRevalidator().revalidate` — its own per-league `useEffect`+`fetch` block is UNCHANGED (Batch 4) |
| `team-hub.tsx` (`TeamHub`) | `gw`, `invalidate` (in `submitManagedClub`) | `useRouteLoaderData('gwId')`, `useRevalidator().revalidate` |
| `team-calendar.tsx` (`TeamCalendar`) | `refreshToken` (as its own re-fetch trigger) | the `gw` object reference from `useRouteLoaderData('gwId')`, used as the same effect dependency (u4) — its own `GET /api/team/:teamId/calendar` fetch is otherwise UNCHANGED (Batch 2 owns its real migration) |

`src/ui/context/game-world-context.tsx` is **deleted**. `AppShell` no longer mounts a
`GameWorldProvider` — `NavRail` and `<Outlet/>` render directly under the shell.

### `AppShell` (MODIFIED — provider removed)

```tsx
// src/ui/components/app-shell.tsx
const AppShell = () => (
  <div data-testid="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
    <NavRail />
    <main style={{ flex: 1 }}>
      <ShellInvalidateProbe />
      <Outlet />
    </main>
  </div>
);
```

`ShellInvalidateProbe` keeps its `[data-testid="shell-invalidate"]` hidden test hook, now
calling `useRevalidator().revalidate()` instead of context `invalidate()` (u6).

### Test harness (`test/ui/**`, MODIFIED)

```tsx
// Before (5 files already on this shape, 2 files on a different one — see u7/u8):
import { MemoryRouter } from 'react-router';
import Routes from '../../../src/ui/routes';
render(<MemoryRouter initialEntries={[entry]}><Routes /></MemoryRouter>);

// After:
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';
const router = createMemoryRouter(routes, { initialEntries: [entry] });
render(<RouterProvider router={router} />);
```

## Logic Flow

### App boot (`src/ui/app.tsx`)

```
1. import routes from './routes'                          # RLDRUI-001
2. const router = createBrowserRouter(routes)              # one-time, module scope
3. <RouterProvider router={router} />                      # replaces <Routes/> render
```

### Navigation to any `/:gwId/...` URL

```
1. User clicks a <Link> or navigates directly to /:gwId or a nested path.
2. React Router matches the :gwId Route (id="gwId") as part of the chain and calls
   gwLoader({ params: { gwId }, request }) CONCURRENTLY with the transition.        # RLDRUI-001
3. gwLoader fetches GET /api/gameWorld/:gwId with request.signal.
     - non-200 or network failure → resolves to null                               # RLDRUI-002
     - 200 → resolves to the parsed GameWorld payload
4. Route tree paints once the loader (and any other matched loader) resolves.
5. AppShell → NavRail, and any descendant (GameWorld, TeamHub, TeamCalendar,
   BatchSimulateControl, RapidSimulateControl) read the same value via
   useRouteLoaderData('gwId') — one fetch, shared across the whole matched subtree,
   identical sharing behavior to GameWorldProvider today.                          # RLDRUI-001
```

### Mutation → revalidate (the 4 call sites)

```
For BatchSimulateControl.runBatch / RapidSimulateControl.runRapidSimulate /
GameWorld.startNewSeason / TeamHub.submitManagedClub:
  1. POST as today (unchanged request/response handling).
  2. On success: call revalidate() (fire-and-forget, NOT awaited) instead of invalidate(). # RLDRUI-003
  3. revalidate() re-runs every loader in the CURRENTLY MATCHED route tree — for any URL
     under /:gwId this is exactly { gwId loader }, since no other route in this batch has
     a loader yet. Native scoping satisfies "not the whole tree" with no extra plumbing.
  4. Success UI at the call site still renders immediately from the POST response body
     (unchanged); the fresh gw value swaps in via useRouteLoaderData whenever the
     background revalidation resolves — same "eventually consistent" feel as
     refreshToken-driven re-fetch today.
```

### `TeamCalendar`'s interim re-fetch bridge (u4)

```
Today:    useEffect(() => { fetchSchedule(); }, [teamId, contextRefreshToken]);
Batch 0:  useEffect(() => { fetchSchedule(); }, [teamId, gw]);   // gw = useRouteLoaderData('gwId')
```

`gw`'s object identity changes on every loader re-run (fresh `fetch` → fresh parsed
object), exactly as `refreshToken` changed on every `invalidate()` call — same trigger
semantics, zero new mechanism, and it needs no `:teamId`-route loader of its own yet
(that's Batch 2's real migration, #234).

### Key decisions embedded in this flow

- **No `refreshToken` replacement invented.** React Router's own revalidation
  (`useRevalidator`) replaces the counter for every component that mutates and reads `gw`
  from the *same* matched route. `TeamCalendar` is the one consumer that read the counter
  *without* mutating anything itself — for it alone, the loader-object-identity bridge (u4)
  is the smallest change that preserves behavior without pulling its real loader migration
  forward into this batch.
- **`GameWorld`/`TeamHub` are only partially touched.** Their own page-specific fetches
  (`GameWorld`'s per-league `Promise.all`, `TeamHub`'s tab content) are untouched — only the
  lines that can no longer compile once `GameWorldProvider` is deleted are repointed. This
  keeps Batch 0's diff to exactly what #230 requires, not a preview of Batch 2/4.
- **`gwLoader` lives with the route it decorates**, not in a shared `loaders/` directory per
  page (only one loader exists this batch). Later batches introduce a per-page loader
  module each; this batch doesn't need to pre-invent that layout.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | **Loader cancellation on rapid nav** | `request.signal` is passed to `fetch`; React Router aborts the in-flight loader run when a newer navigation supersedes it before this one resolves. No manual `cancelled`-flag cleanup (LLD u5 in the old `simulate-game-ui` LLD) is needed — the router owns this now. | RLDRUI-004 |
| u2 | **Non-200 / network failure** | Loader resolves to `null` (never throws/rejects to an `errorElement`) — preserves SIMUI-005's contract that `gw` is `null` while loading OR after a failed fetch, so every existing `gw &&`/`gw?.` guard downstream keeps working unchanged. | RLDRUI-002 |
| u3 | **`revalidate()` scoping** | Verified native behavior: `useRevalidator().revalidate()` only re-runs loaders for the *currently matched* route tree. On any `/:gwId/...` URL that tree is exactly `{ gwId loader }` this batch (no sibling loaders exist yet), so no extra scoping logic is needed to avoid an unwanted whole-app refetch. Re-verify this assumption once Batch 1+ adds sibling loaders under `:gwId` (their loaders will also re-run on `revalidate()` from this batch's call sites — expected and desired, not a regression). | RLDRUI-003 |
| u4 | **`TeamCalendar`'s `refreshToken` dependency has no source once `GameWorldProvider` is deleted** | Bridge: swap the effect's dependency from `contextRefreshToken` to the `gw` object reference from `useRouteLoaderData('gwId')` (see Logic Flow). `TeamCalendar`'s own GET is otherwise unchanged; this is scaffolding removed when Batch 2 (#234) gives it a real loader + `shouldRevalidate`. | RLDRUI-005 |
| u5 | **`GameWorld` page's own fetches must not be disturbed** | Only `const { gw, invalidate } = useGameWorldContext()` and the `startNewSeason` call site change. The per-league `Promise.all` `useEffect` block (today's slowest fetch chain) is left byte-for-byte — Batch 4 owns converting it to `defer()`. | RLDRUI-001 |
| u6 | **`ShellInvalidateProbe` test hook must keep working after the context is gone** | `app-shell-ui.steps.test.tsx` line 68 clicks `[data-testid="shell-invalidate"]` to simulate an externally-triggered refresh. The probe's body changes from calling context `invalidate()` to `useRevalidator().revalidate()`; its testid, hidden rendering, and the test's assertion are unchanged. | RLDRUI-003 |
| u7 | **Five step files already render via `<MemoryRouter><Routes/></MemoryRouter>`** (`app-shell-ui`, `player-detail-ui`, `managed-club-ui`, `lineup-view-ui`, `team-roster-ui`) | Mechanical swap per Interface section: `createMemoryRouter(routes, { initialEntries, initialIndex })` + `<RouterProvider>`. `initialEntries`/`initialIndex` pass through unchanged as the second-argument options object (same names `MemoryRouter` took as props). Existing `given`-mutates-shared-state / `when`-renders / `findBy*`-asserts step ordering is unaffected — the fetch-mock closures still read shared state at *call* time, and the loader only fires once the router is constructed inside the `when` step, after all `given` steps ran. | RLDRUI-006 |
| u8 | **Two step files (`simulate-game-ui`, `rapid-simulate-season-ui`) don't go through `routes.tsx` at all today** — they `jest.mock('react-router')` to stub `useParams`/`Link`/`useNavigate` and mount `<GameWorldProvider gwId="1">{page}</GameWorldProvider>` directly. `useRouteLoaderData('gwId')` **cannot** resolve outside a real matched route with `id="gwId"` — stubbing `useParams` is not enough. | These two files must convert to the same `createMemoryRouter(routes, { initialEntries })` + `<RouterProvider>` pattern as u7 (navigating to `/1`, `/1/1`, `/1/team/1/calendar` etc. instead of directly mounting `GameWorld`/`League`/`TeamCalendar`/`BatchSimulateControl`/`RapidSimulateControl`), and **drop** the `jest.mock('react-router', …)` block entirely — real routing now supplies `useParams`/`Link`/navigation. Fetch-mock URL matching (`fetchCalls`, `batchDeferred`/`rapidDeferred` staging) is unaffected; only the render/mount helper changes. This is the largest single conversion in this batch — flag for extra review time in the Red step. | RLDRUI-006 |
| u9 | **No direct unit test of `game-world-context.tsx` exists** | Confirmed via repo search — no `test/**/game-world-context.test.ts(x)` file. Deleting the module requires no companion test deletion beyond removing its imports from the files in u7/u8. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md` — "HLD: Route-Loader Data Migration"](../high-level-design.md#hld-route-loader-data-migration) |
| Source decision | [Map #229](https://github.com/wulke/premier-league-baseball/issues/229) · [#230](https://github.com/wulke/premier-league-baseball/issues/230) · [#231](https://github.com/wulke/premier-league-baseball/issues/231) · [#233](https://github.com/wulke/premier-league-baseball/issues/233) · [#235 (Batch 0 of the rollout)](https://github.com/wulke/premier-league-baseball/issues/235) |
| **This LLD** | `docs/llds/shell/route-loader-foundation-ui.md` |
| Sibling LLDs (later batches) | `docs/llds/route-loader-leaf-pages-ui.md` (Batch 1, TBD) · `docs/llds/route-loader-team-calendar-ui.md` (Batch 2, TBD) · `docs/llds/route-loader-team-lineup-ui.md` (Batch 3, TBD) · `docs/llds/route-loader-fanout-ui.md` (Batch 4, TBD) · `docs/llds/route-loader-home-ui.md` (Batch 5, TBD) |
| Prior LLD this supersedes (Flow C) | [`docs/llds/game-simulation/simulate-game-ui.md`](./simulate-game-ui.md) (Flow C — `GameWorldProvider` context; superseded by the `gwId` loader here) |
| EARS | `docs/specs/shell/route-loader-foundation-ui-specs.md` — `RLDRUI-001`..`RLDRUI-006` (NEW) |
| Gherkin | `test/ui/features/app-shell-ui.feature`, `simulate-game-ui.feature`, `rapid-simulate-season-ui.feature` (existing scenarios re-bound to the new harness; no new player-facing behavior, so no new scenarios) |
| Step defs | `test/ui/steps/app-shell-ui.steps.test.tsx`, `player-detail-ui.steps.test.tsx`, `managed-club-ui.steps.test.tsx`, `lineup-view-ui.steps.test.tsx`, `team-roster-ui.steps.test.tsx` (EDIT — u7) · `simulate-game-ui.steps.test.tsx`, `rapid-simulate-season-ui.steps.test.tsx` (EDIT — u8, largest conversion) |
| Code entry points | `src/ui/routes.tsx` (EDIT) · `src/ui/app.tsx` (EDIT) · `src/ui/context/game-world-context.tsx` (DELETE) · `src/ui/components/{app-shell,nav-rail,batch-simulate-control,rapid-simulate-control}.tsx` (EDIT) · `src/ui/pages/{game-world,team-hub,team-calendar}.tsx` (EDIT — context read/invalidate call sites only) |

**Open implementation dependency surfaced by this LLD.**
- **u8** — confirm in the Red step that navigating a `createMemoryRouter` to nested paths
  (`/1/team/1/calendar`) correctly resolves the `:gwId` loader alongside the deeper route's
  element, matching today's direct-mount behavior for `simulate-game-ui`/
  `rapid-simulate-season-ui`'s cross-flow scenarios (SIMUI-027/028).

## Amendment: League Dashboard / Standings Route Split (#321)

> This section amends the route tree and `:leagueId` loader documented above — it is not a new
> rollout batch of the `GameWorldProvider` migration (Batch 0 above is complete and unrelated to
> this change). Content LLD: [`docs/llds/league/league-dashboard-ui.md`](../league/league-dashboard-ui.md).
> EARS: `docs/specs/shell/route-loader-foundation-ui-specs.md` (`STDRT-001`..`STDRT-004`, appended).
> Decision records: [#297](https://github.com/wulke/premier-league-baseball/issues/297), [#321 (this gate)](https://github.com/wulke/premier-league-baseball/issues/321).

### Scope

`:leagueId`'s single route/loader/element (lines 100 and 56–64 above) splits into two sibling
routes. `/:gwId/:leagueId` becomes the League Dashboard; the League page's current full-page body
(identity header, per-division `StandingsTable`/`BracketView`) relocates unmodified to a new
`/:gwId/:leagueId/standings` route. **Breaking change, accepted per #297's `/grill-me`:** the old
`/:gwId/:leagueId` URL's prior behavior (full standings/bracket page) is gone with no redirect —
this is a single-player local game with no external bookmarking concern, so no transition/redirect
mechanism is introduced.

### Interface / Data Model (MODIFIED)

```ts
// src/ui/routes.tsx

// @spec LDASH-001,STDRT-001,STDRT-004 — dashboard loader stays lean: GetLeague + GetLeagueToday
// (reinstated per league-today.md), plus GetLeagueStandings/GetLeagueBracket reused verbatim
// (same calls leagueStandingsLoader below makes) so the dashboard's condensed widgets and the
// full /standings page never drift on what "standings"/"brackets" mean.
const leagueDashboardLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const leagueId = params.leagueId!;
  const [league, today, standings, brackets] = await Promise.all([
    readJson(Endpoints.GetLeague.replace(':leagueId', leagueId), request, null),
    readJson(Endpoints.GetLeagueToday.replace(':leagueId', leagueId), request, []),
    readJson(Endpoints.GetLeagueStandings.replace(':leagueId', leagueId), request, []),
    readJson(Endpoints.GetLeagueBracket.replace(':leagueId', leagueId), request, []),
  ]);
  return {
    league,
    today: Array.isArray(today) ? today : [],
    standings: Array.isArray(standings) ? standings : [],
    brackets: Array.isArray(brackets) ? brackets : [],
  };
};

// @spec STDRT-002 — renamed from today's leagueLoader; fetch shape UNCHANGED (still exactly
// GetLeague + GetLeagueStandings + GetLeagueBracket, no GetLeagueToday) since /standings never
// shows the Today section.
const leagueStandingsLoader = async ({ params, request }: LoaderFunctionArgs) => {
  const leagueId = params.leagueId!;
  const [league, standings, brackets] = await Promise.all([
    readJson(Endpoints.GetLeague.replace(':leagueId', leagueId), request, null),
    readJson(Endpoints.GetLeagueStandings.replace(':leagueId', leagueId), request, []),
    readJson(Endpoints.GetLeagueBracket.replace(':leagueId', leagueId), request, []),
  ]);
  return { league, standings: Array.isArray(standings) ? standings : [], brackets: Array.isArray(brackets) ? brackets : [] };
};
```

```tsx
// Route tree, within the existing :gwId Route (replaces today's single
// <Route path=":leagueId" element={<League/>} loader={leagueLoader}/> line):

{/* @spec LDASH-001,STDRT-001,STDRT-003 */}
<Route path=":leagueId" element={<LeagueDashboard />} loader={leagueDashboardLoader} />
{/* @spec STDRT-002 */}
<Route path=":leagueId/standings" element={<LeagueStandings />} loader={leagueStandingsLoader} />
```

`LeagueStandings` is today's `League` component (`src/ui/pages/league.tsx`), export renamed, JSX
body unchanged except its identity-header block drops the champion banner/subtitle (moved to
`LeagueDashboard` — see the content LLD's Logic Flow step 2), leaving name + type badge only, per
#321's "lightweight header" decision. `LeagueDashboard` is a new component — see
`docs/llds/league/league-dashboard-ui.md`.

### Logic Flow (amendment)

```
1. Player navigates to /:gwId/:leagueId (a <Link> click, e.g. from GameWorld's Leagues list, or a
   direct URL) -> matches the LeagueDashboard route -> leagueDashboardLoader runs.  # STDRT-001
2. Player clicks the dashboard's "View full standings" CTA (LDASH-005) -> navigates to
   /:gwId/:leagueId/standings -> matches the LeagueStandings route -> leagueStandingsLoader runs,
   fetching the same three endpoints leagueLoader always has.                       # STDRT-002
3. A pre-#321 URL/bookmark to /:gwId/:leagueId now resolves to the LeagueDashboard element
   instead of the old full-page body. No loader throws, no errorElement fires, no redirect is
   issued — the route simply now means something different, by design.             # STDRT-003
4. If leagueDashboardLoader's GetLeagueToday call fails or returns non-ok, readJson's existing
   fallback contract (line 23–26 above) resolves that slice to [], identical to how standings/
   brackets already degrade to [] on failure today — no new error-handling path is introduced.
                                                                                      # STDRT-004
```

### Edge Case Probe (amendment)

| # | Condition | Handling | Spec |
|---|---|---|---|
| d1 | A `<Link>` elsewhere in the app still points at the pre-#321 `/:gwId/:leagueId` expecting the full standings/bracket body (e.g. any link built before this change) | Resolves to the Dashboard instead — accepted breaking change (see Scope). Any such link is a call site to audit/update at the Code stage, not a routing-layer concern. | STDRT-003 |
| d2 | `leagueDashboardLoader`'s four fetches include one that 404s/network-fails while others succeed (e.g. `GetLeagueToday` fails, `GetLeague` succeeds) | Each call has its own `readJson` fallback (`null` for `league`, `[]` for the array-shaped slices) — a single slice's failure never fails the whole loader, matching `leagueLoader`'s existing per-call independence. | STDRT-004 |
| d3 | Both `leagueDashboardLoader` and `leagueStandingsLoader` are in flight concurrently (player navigates Dashboard → Standings → back to Dashboard quickly) | Each is a distinct route match with its own `request.signal`; React Router cancels a superseded loader run exactly as `RLDRUI-004` already documents for the `:gwId` loader — no new cancellation mechanism needed, this is the same native behavior applied to two more loaders. | STDRT-001, STDRT-002 |

### Traceability (amendment)

| Layer | Artifact |
|---|---|
| Content LLD | [`docs/llds/league/league-dashboard-ui.md`](../league/league-dashboard-ui.md) |
| Decision records | [#297](https://github.com/wulke/premier-league-baseball/issues/297), [#321](https://github.com/wulke/premier-league-baseball/issues/321) |
| EARS | `docs/specs/shell/route-loader-foundation-ui-specs.md` — `STDRT-001`..`STDRT-004` (appended) |
| Gherkin | `test/ui/features/league-dashboard-routing-ui.feature` (NEW, Red) — `STDRT-001`..`STDRT-004`. Kept out of `route-loader-foundation-ui.feature` deliberately: that file already has a bound step-definition suite (`route-loader-foundation-ui.steps.test.tsx`, `autoBindSteps`) covering every scenario in it, so appending step-def-less scenarios there fails CI at suite-collection time rather than landing as an inert Red state. |
| Code entry points (not yet implemented) | `src/ui/routes.tsx` (`leagueDashboardLoader`, `leagueStandingsLoader`, route split) · `src/ui/pages/league-dashboard.tsx` (NEW) · `src/ui/pages/league.tsx` (`League` → `LeagueStandings` rename) · `src/ui/pages/index.tsx` (barrel) |
