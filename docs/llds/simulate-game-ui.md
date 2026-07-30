# LLD: Simulate Game UI (`GameWorldProvider`, `AppHeader`, `TeamCalendar`/`GameRow`)

> **Forward design (not a backfill of shipped code).** Unlike the backend LLD
> ([`game-simulation.md`](./game-simulation.md)), these components do **not** yet exist on
> `feat/simulate-game` — there is no `src/ui/context/` or `src/ui/components/` directory. This
> LLD is a forward design derived from the Component Specifications in the use-case proposal,
> brought under the LID Arrow of Intent (`HLD → LLD → EARS → Tests → Code`) ahead of the
> implementation tickets [#23](https://github.com/wulke/premier-league-baseball/issues/23)
> (`GameWorldProvider`), [#24](https://github.com/wulke/premier-league-baseball/issues/24)
> (`AppHeader`), and [#25](https://github.com/wulke/premier-league-baseball/issues/25)
> (`TeamCalendar`/`GameRow`). Where the proposal glosses over a divergence or a data
> dependency, the [Edge Case Probe](#edge-case-probe) records it, grounded in the current
> `src/ui/` code.
>
> Upstream: [HLD](../high-level-design.md) · Proposal:
> [`docs/architecture/design/simulate-game-ui-proposal.md`](../architecture/design/simulate-game-ui-proposal.md)
> · EARS: [`docs/specs/simulate-game-ui-specs.md`](../specs/simulate-game-ui-specs.md)
> (`SIMUI-001`…`SIMUI-028`) · Gherkin: `test/ui/features/simulate-game-ui.feature`
> (28 scenarios, one `@spec:SIMUI-###` tag each) · Backend LLD:
> [`game-simulation.md`](./game-simulation.md)

## Scope

Three coordinated React flows that let a player simulate games from the frontend, plus the
routing and page-migration changes that connect them:

- **Flow C — `GameWorldProvider`** (`src/ui/context/game-world-context.tsx`, **NEW**): a React
  Context that owns `gw` state and a `refreshToken` invalidation counter — one `GET /api/gameWorld/:gwId`
  per `/:gwId` session, shared across every consumer.
- **Flow B — `AppHeader`** (`src/ui/components/app-header.tsx`, **NEW**): a shared header
  rendered on every `/:gwId` page. Right-aligned CTA owns the batch "Simulate Today" state
  machine (no `currentDate` display — retired per [#44](https://github.com/wulke/premier-league-baseball/issues/44),
  deferred to a future left-pane nav).
- **Flow A — `TeamCalendar`/`GameRow`** (`src/ui/pages/team-calendar.tsx`, **MODIFIED**):
  per-row single-game simulate via a `simulateState` map, plus a `refreshToken` subscription
  so a batch simulate elsewhere triggers a full re-fetch.
- **Routing + page migration**: `src/ui/routes.tsx` nests the `/:gwId` subtree under the
  provider; `GameWorld` and `League` pages are migrated off their own `gw` fetch and inline
  `<header>`s onto context + `AppHeader`.

The backend simulate logic this UI calls is out of scope here (see
[`game-simulation.md`](./game-simulation.md)). No data-model changes arise from this LLD
except the one calendar-endpoint surfacing gap called out below.

---

## Interface / Data Model

### Flow C — context shape (`src/ui/context/game-world-context.tsx`, NEW)

```ts
type GameWorldContextValue = {
  gw: any | null;              // null while loading OR after a fetch failure (SIMUI-005)
  refreshToken: number;        // starts at 0; incremented by invalidate() (SIMUI-001/002)
  invalidate: () => void;      // refreshToken++ then re-GET /api/gameWorld/:gwId (SIMUI-002)
};

const GameWorldContext = createContext<GameWorldContextValue | undefined>(undefined);

const GameWorldProvider = ({ gwId, children }: { gwId: string; children: ReactNode }) => { /* … */ };

const useGameWorldContext = (): GameWorldContextValue => {
  const ctx = useContext(GameWorldContext);
  if (ctx === undefined) /* used outside the provider — see Edge Case Probe u4 */ …;
  return ctx;
};
```

### Flow B — `AppHeader` (`src/ui/components/app-header.tsx`, NEW)

```ts
type BatchStatus = 'idle' | 'submitting' | 'success-clean' | 'success-skipped' | 'error';

type AppHeaderProps = {
  backLink: string;            // breadcrumb target, e.g. "/" or "/:gwId/:leagueId"
  backLabel: string;           // breadcrumb text, e.g. "Game Worlds" / "League"
};
// Consumes useGameWorldContext() → { gw, invalidate }
// Local state: batchStatus: BatchStatus; batchResult: { simulated: any[]; skipped: any[] } | null
```

### Flow A — `TeamCalendar` / `GameRow` additions (`src/ui/pages/team-calendar.tsx`, MODIFIED)

```ts
type SimulateStatus = 'idle' | 'loading' | 'error';

// TeamCalendar NEW state:
//   simulateState: Map<number /*gameId*/, SimulateStatus>
// TeamCalendar useEffect dependency array becomes:
//   [gwId, leagueId, teamId, refreshToken /* from context */]      ← replaces the current LOCAL refreshToken
// GameRow NEW props (alongside { game, teamId }):
//   simulateStatus?: SimulateStatus;
//   onSimulate?: () => void;
```

### Data dependencies the proposal assumes but the current code lacks

| Need | Current state of the code | Gap |
|---|---|---|
| `game.status` to gate the Simulate button (SIMUI-019/020/021) | `TeamSeasonGame` in `src/api/models.ts` carries **no** `status` — only nullable `homeTeamResult`/`awayTeamResult`. The calendar builder in `src/db/domain/team.ts` (`getSchedule`) maps each `Game` and drops `status`. | Either surface `game.status` on the calendar endpoint + model (a backend change for #25), or infer simulatable-ness. Result-null **cannot** distinguish `SCHEDULED` from `IN_PROGRESS` (both have null results), so SIMUI-021 ("no button for `IN_PROGRESS`") is unsatisfiable without `status`. See Edge Case Probe (u1). |
| `gw.currentDate` for the batch guard (SIMUI-009) | `GameWorld.currentDate` is `DATEONLY`, nullable, and **not** seeded by `newSeason()` (per backend LLD e6). | The batch guard already tolerates `null`; the lifecycle footgun is backend-owned and tracked there. |

---

## Logic Flow

### Flow C — `GameWorldProvider`

```
1. Provider mounts with gwId (read from useParams, either inside the provider or passed from
   a layout route in routes.tsx).
2. Initial mount fetch: GET /api/gameWorld/:gwId
     on 200 → setGw(response)                                  # SIMUI-001
     on non-200 / throw → setGw(null)                          # SIMUI-005
   refreshToken starts at 0 (not incremented by the initial fetch).
3. invalidate():
     a. refreshToken++                                         # SIMUI-002
     b. re-run the fetch in step 2; setGw replaces prior gw    # SIMUI-003
4. Context value memoized on { gw, refreshToken, invalidate }.
5. Consumers via useGameWorldContext():
     - AppHeader       → gw.config.inProgress and gw.currentDate (button guard); calls invalidate() on batch success
     - TeamCalendar    → reads refreshToken into its game-fetch useEffect dep array    # SIMUI-027
     - GameWorld/League → read gw for display (NO own fetch)                            # SIMUI-004
```

**Placement.** `routes.tsx` is currently flat siblings (`:gwId`, `:gwId/:leagueId`,
`:gwId/:leagueId/team/:teamId/calendar`). Wrapping the `/:gwId` subtree requires restructuring
— either an `<Outlet />` layout route (`<Route path=":gwId" element={<GameWorldProvider/>}>`)
or an element-wrapper around the matched page. See Edge Case Probe (u8).

### Flow B — `AppHeader` batch simulate

```
1. AppHeader renders on every /:gwId page, inside the provider subtree.                # SIMUI-008
2. Guard (evaluated on every render from context):
     if gw == null OR gw.config?.inProgress !== true OR gw.currentDate == null
        → render breadcrumb only; NO "Simulate Today" button.                          # SIMUI-009/010/011
3. batchStatus == idle      → button "Simulate Today", enabled.
   batchStatus == submitting→ button disabled, label "Simulating…".                    # SIMUI-012
4. click (idle) → batchStatus = submitting; POST /api/gameWorld/:gwId/simulate.
5. on 200:
     skipped.length == 0 → batchStatus = success-clean; show "N simulated · 0 skipped";
                           call invalidate(); schedule auto-dismiss→idle after ~3000ms. # SIMUI-013/015
     skipped.length  > 0 → batchStatus = success-skipped; show "Y games could not be simulated";
                           HIDE the button; call invalidate(); warning PERSISTS (no timer). # SIMUI-014/015
6. on non-200 → batchStatus = error; show error message + "Retry" button;
                do NOT call invalidate() (refreshToken unchanged).                      # SIMUI-016/018
7. click Retry → go to step 4 (submitting).                                            # SIMUI-017
```

### Flow A — `TeamCalendar` / `GameRow` single-game simulate

```
1. TeamCalendar game-fetch useEffect deps: [gwId, leagueId, teamId, refreshToken /* from context */].
   (The effect already exists today, keyed on a LOCAL refreshToken used by the Retry button —
    see Edge Case Probe u2; migration replaces that local value with the context token.)  # SIMUI-027
2. Render one GameRow per (filtered) game, passing:
     simulateStatus = simulateState.get(game.gameId) ?? 'idle'
     onSimulate     = () => handleSimulate(game.gameId)
3. GameRow when game.status == 'SCHEDULED':
     idle    → "Simulate" button                                                        # SIMUI-019
     loading → spinner, button disabled                                                 # SIMUI-022
     error   → ⚠ icon inline, NO retry                                                  # SIMUI-025/026
   (COMPLETED → score, no button; IN_PROGRESS → status indicator, no button.)           # SIMUI-020/021
4. click Simulate → simulateState.set(gameId, 'loading'); POST /api/game/:gameId/simulate.
5. on 200 → patch local games[gameId] { homeTeamResult, awayTeamResult, status:'COMPLETED' };
            simulateState.delete(gameId); row re-renders with score, button removed.    # SIMUI-023
            Other rows' buttons left untouched.                                         # SIMUI-024
6. on 4xx → simulateState.set(gameId, 'error'); spinner → ⚠ icon; score unchanged.      # SIMUI-025
```

Single-game success is a local in-place patch (no full re-fetch); the next batch-driven
`refreshToken` change will re-fetch the whole list and supersede it (the re-fetched row already
carries the new result — see u10).

---

## Edge Case Probe

Each row ties a condition to its handling and the EARS id that pins it. Rows marked **NEW**
surface something the proposal does not address.

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | **NEW** — Simulate-button guard needs `game.status`, but the calendar API model omits it | `TeamSeasonGame` (`src/api/models.ts`) and `getSchedule` (`src/db/domain/team.ts`) do not surface `Game.status`. #25 must either extend the endpoint/model to return `status`, or the guard degrades to a result-null proxy. Result-null cannot tell `SCHEDULED` from `IN_PROGRESS`, so SIMUI-021 is **unsatisfiable** without `status`. Recommended: extend the endpoint (one-line addition to the mapper + interface). Backend dependency for #25. | SIMUI-019/020/021 |
| u2 | **NEW** — `TeamCalendar` already has a local `refreshToken` (used only by the Retry button) | Today `refreshToken` is local `useState`, incremented by the error-state "Retry" button and read in the fetch `useEffect` dep array. The context token serves the same mechanical role (re-fetch trigger) but is driven externally by `invalidate()`. Migration must remove the local counter and source `refreshToken` from `useGameWorldContext()`; the calendar's own Retry button should call `invalidate()` (re-fetches `gw` too — harmless) or keep a *separately-named* local retry counter. Name collision is a real footgun if both coexist. | SIMUI-027 |
| u3 | **NEW** — `GameWorld` page `startNewSeason()` mutates local `setGw(updatedGw)` | Under SIMUI-004 the page reads `gw` from context. The existing "Start Season" success path calls local `setGw(updatedGw)`; migrated, it must call `invalidate()` (so context `gw` updates for `AppHeader` too) instead of setting a divergent local copy. Otherwise the page's `gw` and the header's batch guard drift apart after a season start. | SIMUI-004 |
| u4 | Provider fetch fails → `gw = null` | Consumers must null-guard every `gw.*` read. `AppHeader`'s guard already short-circuits on `gw == null` (no button) but any unguarded page consumer would crash; `useGameWorldContext` should also decide a fallback for components rendered outside the provider (throw vs. return a default). The proposal says only "children handle gracefully" — make the contract explicit. | SIMUI-005 |
| u5 | **NEW** — `refreshToken` race: rapid double `invalidate()` while a fetch is in flight | No request id / `AbortController` is specified. A slow in-flight fetch from an earlier `invalidate()` can resolve *after* a newer one and overwrite the fresh `gw`. Low-risk for single-player simulation but should be noted; if it bites, key the response against the latest `refreshToken` or abort the prior request. | SIMUI-002/003 |
| u6 | `success-skipped` warning "blocks the future Advance Date action" | That blocking is the **out-of-scope** `@future` scenario (`test/ui/features/simulate-game-ui.feature`, untagged). On this branch the warning simply persists with no consumer — forward-compatible but inert until the Advance Date use case lands. | SIMUI-014 |
| u7 | **NEW** — batch-button guard reads `gw.config.inProgress` and `gw.currentDate` from context | Both come from the same context `gw`. If `gw` is `null` (fetch failed), the guard must short-circuit *before* dereferencing `.config`, or `AppHeader` throws. Express the guard as `gw && gw.config?.inProgress && gw.currentDate`, not `gw.config.inProgress && gw.currentDate`. | SIMUI-005/009 |
| u8 | **NEW** — `routes.tsx` is flat siblings today | Wrapping the `/:gwId` subtree is a structural change, not just "add a component." The three `:gwId`-rooted routes become children of a provider-bearing route. `gwId` is read via `useParams`, which resolves for any descendant — so the provider can read it itself whether it is an `<Outlet/>` layout route or an element-wrapper. Prefer the layout-route form so the provider mounts once for the whole subtree. | SIMUI-001/008 |
| u9 | **NEW** — `success-clean` auto-dismiss timer (~3s) | The `setTimeout` must be cleared on unmount and on any intervening status change (e.g. a later `error`, or component leaving the page) to avoid `setState` after unmount or clobbering a subsequent state. Use a `useEffect` cleanup that clears the stored timer when `batchStatus` changes. | SIMUI-013 |
| u10 | Single-game in-place patch vs. a concurrent batch re-fetch | A single-game success patches local `games[gameId]`; if a batch `invalidate()` fires around the same time, the `refreshToken` change re-runs the fetch `useEffect` and replaces local state with the server list (which already includes the new result). Ordering is benign — the re-fetch wins and is authoritative — but the local patch is discardable, not load-bearing. | SIMUI-023/027 |
| u11 | `gw.config.inProgress` field | Confirmed present — `GameWorld` page already reads `gw.config?.inProgress` today (`src/ui/pages/game-world.tsx`). No model change needed for the guard itself; only the `null`-guard ordering in u7. | SIMUI-009 |

---

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md) |
| Use-case design | [`docs/architecture/design/simulate-game-ui-proposal.md`](../architecture/design/simulate-game-ui-proposal.md) |
| **This LLD** | `docs/llds/simulate-game-ui.md` |
| Backend LLD (sibling) | [`docs/llds/game-simulation.md`](./game-simulation.md) |
| EARS | `docs/specs/simulate-game-ui-specs.md` — `SIMUI-001`…`SIMUI-028` |
| Gherkin | `test/ui/features/simulate-game-ui.feature` (28 scenarios, one `@spec:SIMUI-###` tag per scenario; the `@future` Advance-Date scenario is untagged/out-of-scope) |
| Step defs | `test/ui/steps/simulate-game-ui.steps.test.ts` — to be created by [#22](https://github.com/wulke/premier-league-baseball/issues/22) |
| Code entry points | `src/ui/context/game-world-context.tsx` — [#23](https://github.com/wulke/premier-league-baseball/issues/23) (SIMUI-001…005) · `src/ui/components/app-header.tsx` — [#24](https://github.com/wulke/premier-league-baseball/issues/24) (SIMUI-006…018) · `src/ui/pages/team-calendar.tsx` — [#25](https://github.com/wulke/premier-league-baseball/issues/25) (SIMUI-019…028) |

**Open implementation dependencies surfaced by this LLD.**
- **u1 / #25** — calendar endpoint must surface `game.status` (or SIMUI-021 cannot be satisfied).
- **u8 / #23** — `routes.tsx` restructuring (flat siblings → nested provider subtree) is part of
  the provider ticket, not a no-op.
- **`currentDate` chip** — retired per [#21](https://github.com/wulke/premier-league-baseball/issues/21)/[#44](https://github.com/wulke/premier-league-baseball/issues/44);
  `AppHeader` does not display `currentDate`. Deferred to a future left-pane nav (out of scope
  for this branch — see map [#13](https://github.com/wulke/premier-league-baseball/issues/13)).
