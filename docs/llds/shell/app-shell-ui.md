# LLD: App Shell — Left Nav Rail (`AppShell`, `NavRail`, `BatchSimulateControl`)

> **LID Arrow of Intent position:** Low-Level Design, one step down from
> [HLD: App Shell — Left Nav Rail](../high-level-design.md#hld-app-shell--left-nav-rail).
> Implements the shell decision from UI Direction map
> [#10 (Page-by-page layout plan)](https://github.com/wulke/premier-league-baseball/issues/10).
> EARS: [`docs/specs/shell/app-shell-ui-specs.md`](../specs/app-shell-ui-specs.md)
> (`SHELL-001`…`SHELL-0NN` for shell behaviour; relocated batch-simulate behaviour keeps
> `SIMUI-009`…`SIMUI-018`; the deferred chip graduates `SIMUI-006`/`SIMUI-007`).
> Gherkin: `test/ui/features/app-shell-ui.feature` (shell scenarios) + edits to
> `test/ui/features/simulate-game-ui.feature` (re-homed batch/chip steps).

## Scope

A persistent **app shell** — left nav rail + `<Outlet />` — that becomes the single home for
navigation and world-level actions, replacing the per-page hand-rolled headers and the
breadcrumb-style `AppHeader` (`src/ui/components/app-header.tsx`). This feature ships the shell
and retires `AppHeader`; the four **page-content** rebuilds (home launcher, game-world newspaper
feed, league competition hub, team overview + month-grid calendar) are separate follow-on LID
features and render their existing content inside this shell.

- **`GameWorldProvider`** (`src/ui/context/game-world-context.tsx`, **UNCHANGED interface**): keeps
  its existing prop-based contract `({ gwId, children })`. It is **re-mounted higher** — inside the
  shell layout, wrapping `<Outlet />` — so the one persistent rail can always consume it. (See the
  HLD-mechanism refinement in the Edge Case Probe, s1.)
- **`AppShell`** (`src/ui/components/app-shell.tsx`, **NEW**): a pathless layout-route element.
  Reads `gwId` from `useParams()`, mounts `GameWorldProvider`, and renders `<NavRail />` + the page
  `<Outlet />`. The one component rendered across every route.
- **`NavRail`** (`src/ui/components/nav-rail.tsx`, **NEW**): the fixed FM-style sections (HOME /
  WORLD / COMPETITIONS / dimmed fog trio), the app mark, and world-level display (current date
  chip). Consumes `useGameWorldContext()`. Active highlighting derived from the router.
- **`BatchSimulateControl`** (`src/ui/components/batch-simulate-control.tsx`, **NEW — RELOCATED**):
  the existing batch "Simulate Today" state machine (idle/submitting/success-clean/
  success-skipped/error + `invalidate()`), extracted verbatim from `AppHeader` into its own
  component and rendered inside the rail's WORLD section.
- **Routing** (`src/ui/routes.tsx`, **MODIFIED**): a pathless layout route carries `AppShell` and
  wraps Home + the `:gwId` subtree; `GameWorldLayout` is removed (its provider duty absorbed by the
  shell).
- **Pages** (`src/ui/pages/{home,game-world,league,team-calendar}.tsx`, **MODIFIED — content
  unchanged**): drop their page-local `<header>` / `<AppHeader>` usage; keep their existing content
  and identity blocks, which now render inside the shell's `<Outlet />`.
- **`AppHeader`** (`src/ui/components/app-header.tsx`, **DELETED**): its breadcrumb props retire;
  its batch behaviour lives on in `BatchSimulateControl`.

No backend, data-model, or endpoint changes arise from this LLD.

---

## Interface / Data Model

### `GameWorldProvider` — unchanged contract, new mount site

```ts
// src/ui/context/game-world-context.tsx — NO SIGNATURE CHANGE.
type GameWorldContextValue = {
  gw: any | null;              // null while loading OR after a fetch failure (SIMUI-005)
  refreshToken: number;        // starts at 0; incremented by invalidate()
  invalidate: () => void;      // refreshToken++ → re-GET /api/gameWorld/:gwId
};

const GameWorldProvider = ({ gwId, children }: { gwId: string | undefined; children: ReactNode }) => {
  // existing fetch effect, keyed on [gwId, refreshToken]; already a no-op-safe guard is ADDED:
  //   if (!gwId) { setGw(null); return; }   ← see Edge Case Probe s2
};
```

The only change is the guard (s2): today the provider is only ever mounted with a non-null `gwId`
(it is constructed by `GameWorldLayout` reading a matched `:gwId`); in the shell it is also mounted
on `/` with `gwId === undefined`, where it must short-circuit to `gw: null` and fetch nothing.

### `AppShell` — pathless layout-route element (NEW)

```ts
// src/ui/components/app-shell.tsx
// Renders root [data-testid="app-shell"].
const AppShell = () => {
  const { gwId } = useParams();              // undefined on Home ("/"); "1" on "/1/…"
  return (
    <GameWorldProvider gwId={gwId}>
      <div data-testid="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
        <NavRail />
        <main style={{ flex: 1 }}><Outlet /></main>
      </div>
    </GameWorldProvider>
  );
};
```

`gwId` reaches a *layout-level* component from a *child* `:gwId` route via React Router's
**pathless-layout param merging** — a pathless `<Route element={<AppShell/>}>` is part of the
matched route chain, so `useParams()` in its element returns the merged params including the
child's `:gwId`. (Verified behaviour + fallback in Edge Case Probe s1.)

### `NavRail` — the persistent navigation surface (NEW)

```ts
// src/ui/components/nav-rail.tsx
// Renders root [data-testid="nav-rail"].
type NavRailProps = { /* none — reads router + context */ };
const NavRail = () => {
  const { gw } = useGameWorldContext();
  const { pathname } = useLocation();
  const { gwId, leagueId } = useParams();
  // active-section derivation: see Logic Flow §NavRail
};
```

**Sections rendered (from #10):**

| Section | Gate | Links | testid |
|---|---|---|---|
| App mark | always | — (static "Premier League Baseball") | `nav-mark` |
| HOME | always | Home → `/` | `nav-home` |
| WORLD | `gw != null` | World name → `/:gwId`; current-date chip; `<BatchSimulateControl/>` | `nav-world` |
| COMPETITIONS | `gw?.Leagues?.length > 0` | one link per league → `/:gwId/:leagueId` | `nav-competitions`, per-league `nav-league-<id>` |
| Fog trio | always (disabled) | My Club · Roster · Transfers | `nav-fog-*` |

### `BatchSimulateControl` — relocated state machine (NEW, behaviour-identical to `AppHeader`)

```ts
// src/ui/components/batch-simulate-control.tsx
type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';
// Consumes useGameWorldContext() → { gw, invalidate }.
// Renders [data-testid="batch-simulate"] (idle/submitting) and [role="alert"] (skipped/error),
//   IDENTICAL to AppHeader's renderBatchRegion() today.
```

The guard (`gw && gw.config?.inProgress && gw.currentDate`), the `~3s` auto-dismiss `useEffect`
(cleared on unmount/status change), the `POST /api/gameWorld/:gwId/simulate` call, and the
`invalidate()`-on-200 / no-invalidate-on-error split are copied **verbatim** from
`AppHeader`. Only the host component changes.

### Routing (`src/ui/routes.tsx`, MODIFIED)

```tsx
const R = () => (
  <Routes>
    <Route element={<AppShell />}>          {/* pathless layout: shell + provider, always mounted */}
      <Route index element={<Home />} />
      <Route path=":gwId">
        <Route index element={<GameWorld />} />
        <Route path=":leagueId" element={<League />} />
        <Route path="team/:teamId/calendar" element={<TeamCalendar />} />
      </Route>
    </Route>
  </Routes>
);
```

`GameWorldLayout` (the old `:gwId`-rooted provider layout) is **removed** — its provider duty is
absorbed by `AppShell`.

---

## Logic Flow

### Mount (AppShell)

```
1. AppShell mounts as the matched pathless-layout element for any URL.
2. useParams() → gwId = first path segment when present (e.g. "/1/…" → "1"), undefined on "/".   # s1
3. <GameWorldProvider gwId={gwId}> mounts:
     gwId == undefined → setGw(null); no fetch.                                                    # s2 / SHELL-gate
     gwId != undefined → existing fetch path: GET /api/gameWorld/:gwId → setGw(response|null).
4. <NavRail/> + <Outlet/> render. The matched page (Home/GameWorld/League/TeamCalendar) fills <Outlet/>.
```

### NavRail — section population + active highlighting

```
For each render (driven by context gw + router):
  1. App mark + HOME + fog trio always render (HOME + fog always present in chrome).               # SHELL-*
  2. WORLD section renders only when gw != null:
       - World name (gw.config?.name ?? `Game World ${gwId}`) links to /:gwId.                     # SHELL-*
       - current-date chip renders `gw.currentDate` as a calendar date (for example,
         `2025-04-10` → `Apr 10, 2025`), using date-only parsing so timezone offsets cannot
         shift the displayed day.                                                                   # SIMUI-006
       - `gw.currentDate === null` renders the muted `No date set` placeholder in the same
         WORLD display slot.                                                                        # SIMUI-007
       - <BatchSimulateControl/> renders inside WORLD (its own guard hides it when inactive).      # SIMUI-009..018
  3. COMPETITIONS section renders only when gw?.Leagues is a non-empty array:
       - one link per league (league.config?.name ?? `League ${id}`) → /:gwId/:leagueId.           # SHELL-*
  4. Active highlighting (derived, never stored):
       HOME          active when pathname === "/".
       WORLD         active when gwId matches AND pathname === `/${gwId}` (no deeper route).
       COMPETITIONS  the league link whose leagueId matches is active; deeper sub-routes
                     (team/:teamId/calendar) keep WORLD/league lit rather than inventing a Team
                     section (reserved for the later Team-overview rebuild — HLD trade-off).
```

### BatchSimulateControl — daily-progression summary

On a successful Simulate Today response, `nextDate` identifies the next playable game day. The
control shows an auto-dismissing summary (`N simulated · Next game day: YYYY-MM-DD`) instead of
treating expected `future date` and `already completed` ledger entries as failures. A persistent
warning is reserved for a `game in progress` skip that leaves `nextDate` null, because that game
blocks date progression. Successful and failed request revalidation behaviour is unchanged.

### Page migration (content unchanged)

```
For each of Home / GameWorld / League / TeamCalendar:
  1. Remove the <AppHeader …/> usage (and, for Home, its page-local <header>).
  2. Keep the existing identity block + content sections (unchanged markup/logic).
  3. They now render inside the shell's <Outlet/> — no layout wrapper of their own.
```

---

## Edge Case Probe

Each row ties a condition to its handling and the spec/decision that pins it. Rows marked
**HLD-refine** record where this LLD sharpens the HLD's chosen mechanism without changing its
intent.

| # | Condition | Handling | Spec |
|---|---|---|---|
| s1 | **HLD-refine — how a layout-level provider reads a child's `:gwId`** | The HLD framed this as "the provider reads `useParams()` itself." This LLD sharpens it: `AppShell` is a **pathless layout route** (`<Route element={<AppShell/>}>`), and React Router merges params across the matched route chain, so `useParams()` inside `AppShell`'s element returns `gwId` from the child `:gwId` route on `/1/…` and `{}` on `/`. This keeps `GameWorldProvider`'s **prop-based contract unchanged** (lower-risk than making the provider router-aware) while still achieving the hoist. **Verify in the Red→Green step** that v7's pathless-layout merge exposes the child param at the layout element; if not, the recorded fallback is to read the first `pathname` segment via `useLocation()` (the provider's whole key IS that segment — acceptable coupling). Either way the *intent* (one persistent provider/rail) holds. | SHELL-mount |
| s2 | **NEW — provider mounted on `/` with `gwId === undefined`** | Today the provider is only ever constructed with a non-null `gwId`. In the shell it also mounts on Home with `gwId === undefined`. The fetch `useEffect` must guard `if (!gwId) { setGw(null); return; }` (fetch nothing, `gw` null) so NavRail renders HOME-only chrome and Home's own (null-safe) reads don't crash. Without this, the fetch URL becomes `/api/gameWorld/undefined`. | SHELL-gate / SIMUI-005 |
| s3 | **NEW — `AppHeader` deletion breaks the SIMUI-008..018 + 027/028 step files & testids** | Those scenarios assert on `AppHeader` / `[data-testid="app-header"]`. They are **relocated, not lost**: step text is reworded ("AppHeader renders" → "the nav rail renders"; "in the header" → "in the rail WORLD section"), the rail's `[data-testid="nav-rail"]` is the new mount root, and `BatchSimulateControl` keeps `[data-testid="batch-simulate"]` + `[role="alert"]` verbatim. The **EARS IDs are stable** (behaviour unchanged) — only the Gherkin wording + step bindings move. `SIMUI-008` ("present on GameWorld/League/TeamCalendar pages") becomes a `SHELL-` assertion ("the nav rail is present on every route"). This file's EARS section lists each relocated/graduating ID. | SIMUI-008..018, SIMUI-027/028 |
| s4 | **NEW — the deferred current-date chip graduates into the rail** | `SIMUI-006`/`SIMUI-007` (chip display) were retired to `@future` by #44, explicitly "deferred to a future left-pane nav." That nav is this rail. They **graduate**: the WORLD section renders `gw.currentDate` as a local calendar date (`2025-04-10` → `Apr 10, 2025`), avoiding UTC parsing that can shift the date in negative-offset timezones; when it is null, the same slot renders muted `No date set`. The re-homed scenarios carry `@spec:SIMUI-006` / `@spec:SIMUI-007` and bind in the app-shell step file. | SIMUI-006/007 |
| s5 | **NEW — step files stub `useParams` to a fixed `{ gwId: '1', … }`** | The existing `jest.mock('react-router', …)` in `simulate-game-ui.steps.test.tsx` returns a constant param object, so `AppShell`'s `useParams()` would wrongly report `gwId:'1'` on a Home-rendering scenario. The mock must become location-aware: derive `gwId`/`leagueId` from a per-scenario `useLocation` value (or render via `MemoryRouter` with a real `initialEntries` and drop the `useParams` stub entirely). Decide in the Red step; record the chosen form in the step-file header comment. | SHELL-mount |
| s6 | **NEW — COMPETITIONS links depend on `gw.Leagues` order/shape** | `gw.Leagues` is the same array the `GameWorld` page already iterates (`league.config?.name`, `league.id`). No new contract; but the rail must null-guard `Array.isArray(gw?.Leagues)` before `.map` (a fetch-failure `gw === null` already short-circuits the whole WORLD+COMPETITIONS block — s2). If `Leagues` is `[]` (world created, no leagues), COMPETITIONS renders its header with an empty/hidden link list, not an error. | SHELL-competitions |
| s7 | **NEW — active highlighting must survive `refreshToken` re-fetches** | A batch `invalidate()` re-fetches `gw` (new object identity) on the same route. Highlighting is derived from `useLocation`/`useParams` (router state), **not** `gw` identity, so it is unaffected by re-fetch churn. Do not key active state on `gw`. | SHELL-active |
| s8 | **NEW — Home's page-local `<header>` (the "Premier League Baseball" title block) duplicates the rail's app mark** | Home currently renders its own app-title header. With the rail's `nav-mark` always present, Home's header is redundant chrome — drop it (per HLD "pages drop page-local headers"). Home's game-world-card grid + create form (its actual content) is unchanged. | SHELL-home |
| s9 | **NEW — batch control relocated to a flex column rail (was a header row)** | `AppHeader`'s batch region sat in a right-aligned header slot. In the rail it stacks vertically under the date chip inside WORLD. The control's internal layout (button / summary / warning / error+retry) is unchanged; only its outer container flow changes. Confirm the `[role="alert"]` + Retry button remain queryable by name/role after the move (step bindings rely on role/name, not position). | SIMUI-016/017 |
| s10 | **NEW — `Outlet` from `react-router` import surface** | `routes.tsx` already imports `Outlet`; `AppShell` adds one more importer. No new dependency. Confirm `react-router` v7 exports `useLocation` (used already in pages? — verify; if not, it is a documented v7 export). | — |
| s11 | **Back-link breadcrumbs are dropped, not relocated** | `AppHeader`'s `backLink`/`backLabel` props retire with the component. The rail makes hierarchical back-links redundant (#10 consolidates navigation). No replacement breadcrumb is built; pages that previously relied on the back-link for navigation now rely on the rail's HOME/WORLD/COMPETITIONS links. (Deliberate; flagged in HLD trade-offs.) | SHELL-nav |
| s12 | Future-date skips appear after a successful daily batch | The backend retains them in the diagnostic ledger while advancing `currentDate` to `nextDate`. The UI therefore shows the successful next-game-day summary, not a “could not be simulated” warning. Only an in-progress game that prevents advancement remains a warning. | SIMUI-029 |

---

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md` — "HLD: App Shell — Left Nav Rail"](../high-level-design.md) |
| Source decision | [Map #2 (UI Direction)](https://github.com/wulke/premier-league-baseball/issues/2) · [ticket #10 (Page-by-page layout plan)](https://github.com/wulke/premier-league-baseball/issues/10) |
| **This LLD** | `docs/llds/shell/app-shell-ui.md` |
| Sibling LLD (batch origin) | [`docs/llds/game-simulation/simulate-game-ui.md`](./simulate-game-ui.md) (Flow B — `AppHeader` batch state machine, relocated here) |
| EARS | `docs/specs/shell/app-shell-ui-specs.md` — `SHELL-001`… (NEW) · `SIMUI-006/007` (graduate) · `SIMUI-009`…`SIMUI-018` (relocated, IDs stable) |
| Gherkin | `test/ui/features/app-shell-ui.feature` (shell scenarios + re-homed current-date chip scenarios) · `test/ui/features/simulate-game-ui.feature` (batch/cross-flow scenarios) |
| Step defs | `test/ui/steps/app-shell-ui.steps.test.tsx` (NEW) · `test/ui/steps/simulate-game-ui.steps.test.tsx` (EDIT — `AppHeader` mount → `NavRail` mount; location-aware router mock per s5) |
| Code entry points | `src/ui/components/app-shell.tsx` (NEW) · `src/ui/components/nav-rail.tsx` (NEW) · `src/ui/components/batch-simulate-control.tsx` (NEW) · `src/ui/context/game-world-context.tsx` (EDIT — s2 guard) · `src/ui/routes.tsx` (EDIT) · `src/ui/pages/{home,game-world,league,team-calendar}.tsx` (EDIT — drop headers) · `src/ui/components/app-header.tsx` (DELETE) |

**Open implementation dependencies surfaced by this LLD.**
- **s1** — verify React Router v7 pathless-layout param merging exposes child `:gwId` at the
  `AppShell` element (else fall back to `useLocation` parsing). Decided in the Red step.
- **s5** — the step-file `react-router` mock must become location-aware (or use a real
  `MemoryRouter`), or Home-scenario renders will wrongly see `gwId`.
