# LLD: UI Navigation Loader Migration

> Upstream: [HLD: UI Navigation Performance (Loader-Based Data Fetching)](../../high-level-design.md#hld-ui-navigation-performance-loader-based-data-fetching) ·
> Existing foundation: [`route-loader-foundation-ui.md`](./route-loader-foundation-ui.md) ·
> Decision record: [#289](https://github.com/wulke/premier-league-baseball/issues/289)

## Scope

This LLD migrates six approved pages from mount-time `useEffect` reads to route loaders.

| Page | Route | Primary reads |
|---|---|---|
| `PlayerDetail` | `/:gwId/player/:playerId` | player detail |
| `TeamRoster` | `/:gwId/team/:teamId/roster` | roster |
| `TeamCalendar` | `/:gwId/team/:teamId/calendar` | season calendar |
| `TeamLineupView` | `/:gwId/team/:teamId/lineup` | active lineup, roster, next-game lineup |
| `League` | `/:gwId/:leagueId` | league identity, standings, bracket |
| `Transfers` | `/:gwId/transfers` | free agents |

It supersedes only overlapping, unfinished page-migration plans in the older route-loader rollout.
The landed `:gwId` loader and shared router remain the foundation. `Home`, `GameWorld`'s waterfall,
`NavRail` optimization, backend API changes, and client caching remain out of scope.

## Interface / Data Model

### Route data ownership

Each in-scope leaf route receives a co-located loader in `src/ui/routes.tsx`. Every loader accepts
`LoaderFunctionArgs`, reads only route params, and passes `request.signal` to each `fetch`. Its
component consumes primary data with `useLoaderData` and no longer makes the same primary GET from
a mount effect. The `:gwId` parent retains `id="gwId"` and `gwLoader`; child loaders never refetch
GameWorld data.

| Loader | Returned route data | Failure result |
|---|---|---|
| `playerDetailLoader` | `PlayerDetailRecord \| null` | `null` |
| `teamRosterLoader` | `RosterPlayer[]` | `[]` |
| `teamCalendarLoader` | `{ calendar: TeamSeasonCalendar \| null; error: string \| null }` | null calendar plus user-safe error |
| `teamLineupLoader` | `{ lineup: TeamLineup \| null; roster: RosterPlayer[]; nextGame: NextGameLineup \| null }` | safe null/empty member per failed read |
| `leagueLoader` | `{ league: League \| null; standings: DivisionStandings[]; brackets: LeagueDivisionBracket[] }` | safe null/empty member per failed read |
| `transfersLoader` | `RosterPlayer[]` | `[]` |

`TeamLineup` and `League` start independent GETs together with `Promise.all`. All six loaders are
blocking: this is the smallest consistent loader migration, and skeleton/deferred-section design is
deliberately deferred. An individual failed secondary Lineup/League read maps to its documented
safe value so the returned shape stays usable.

### State boundaries

| Page | Route data | Local state retained |
|---|---|---|
| Player detail | player record | selected tab |
| Team roster | player list | none for the primary list |
| Team calendar | loaded calendar/error | filters, row status, temporary post-simulate patch |
| Team lineup | lineup, roster, next-game lineup | edits, drafts, tab, save/drag state |
| League | identity, standings, brackets | collapsible/expanded-series state |
| Transfers | free-agent list | sign error |

Completed revalidation replaces route data. During same-route revalidation, a populated page stays
populated; it must not show the old initial blank/"Loading…" state. A Lineup edit draft is not reset
when revalidation starts; only fresh data after a successful save may derive a new draft.

## Logic Flow

### Navigation

```
Link/direct URL → match :gwId plus the child route
  → React Router runs gwLoader and the matched child loader
  → child loader starts its GET(s), all with request.signal
  → multi-read loaders start requests together via Promise.all
  → router commits once blocking route data resolves
  → component renders useLoaderData, not an empty mount state
```

### Mutation and refresh

```
Release / Renew / Sign succeeds or fails
  → useRevalidator().revalidate()
  → matched gwId and child loaders rerun
  → existing populated list remains until fresh data resolves

Calendar game simulation succeeds
  → patch the one visible row immediately
  → revalidate so the loader result converges on server truth

Lineup save succeeds
  → revalidate; derive/reset drafts only from completed fresh data
```

No cache is introduced. Navigation follows normal React Router loader semantics. Stale-time reuse
and stale-while-revalidate must not be approximated with module variables or context caches; they
require a future approved design.

### Test harness

Affected UI acceptance tests render the shared route objects with `createMemoryRouter(routes,
{ initialEntries })` and `<RouterProvider>`. They set fetch mocks for both `gwLoader` and the
destination loader before constructing the router, exercising the actual navigation boundary.

## Edge Case Probe

| # | Condition | Handling |
|---|---|---|
| u1 | Rapid navigation supersedes a pending loader | Router aborts the old fetch through `request.signal`; no primary-read `isMounted` flag remains. |
| u2 | Player detail is missing/fails | Loader returns `null`; the existing not-found state renders without a loading flash. |
| u3 | A list request fails | Loader returns `[]`; Calendar instead returns its explicit error shape so Retry remains possible. |
| u4 | One League/Lineup secondary request fails | Return its safe null/empty value while settled sibling data remains usable. |
| u5 | Revalidation begins while Lineup is being edited | Preserve the dirty draft; never replace it merely because revalidation started. |
| u6 | Calendar simulation has an immediate result | Apply the local row patch, then allow the server-authoritative loader result to replace it. |
| u7 | A route parameter changes in place | New loader data is primary; no stale `useState` initializer is relied on. |
| u8 | Managed-club mutation revalidates parent and child routes | Both refreshes are expected: shell gets fresh GameWorld data and page gets fresh primary data. |
| u9 | A user revisits a route | The mount-time blank fetch cycle is gone, but cache-hit reuse is not guaranteed or designed here. |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md` — UI Navigation Performance](../../high-level-design.md#hld-ui-navigation-performance-loader-based-data-fetching) |
| Existing foundation | [`docs/llds/shell/route-loader-foundation-ui.md`](./route-loader-foundation-ui.md) |
| **This LLD** | `docs/llds/shell/ui-navigation-loader-migration.md` |
| EARS | To be created only after LLD approval. |
| Gherkin | To be created only after EARS approval. |
| Code | `src/ui/routes.tsx` and six in-scope page components; no code is included at this stage. |
