# Specs: App Shell — Left Nav Rail

UI requirements for the persistent app shell — a left nav rail + `<Outlet />` that is the single
home for navigation (Home / active World / its Competitions) and world-level display/actions (the
current-date chip, batch "Simulate Today"). Implements the Shell decision from UI Direction map
[#2](https://github.com/wulke/premier-league-baseball/issues/2) /
[#10](https://github.com/wulke/premier-league-baseball/issues/10). Supersedes the former
`AppHeader` (`src/ui/components/app-header.tsx`, **deleted**): the batch state machine is relocated
here as `BatchSimulateControl` (SIMUI-009…SIMUI-018, IDs stable), and the deferred currentDate chip
**graduates** here (SIMUI-006/007). The page-content rebuilds are separate follow-on features and
render their content inside this shell.

Upstream: [HLD](../high-level-design.md#hld-app-shell--left-nav-rail) ·
[LLD](../llds/app-shell-ui.md).

| ID | Requirement | Status |
|---|---|---|
| SHELL-001 | WHEN any route matches THE system SHALL render a single persistent App Shell (a pathless layout route) comprising the NavRail and the matched page Outlet, so the shell is present on every route | [ ] |
| SHELL-002 | WHEN the App Shell mounts THE system SHALL mount exactly one GameWorldProvider at the shell that reads gwId from the matched child route param, shared by the NavRail and every page | [ ] |
| SHELL-003 | WHEN the GameWorldProvider mounts IF gwId is undefined (the Home route) THE system SHALL set gw to null and SHALL NOT request GET /api/gameWorld/:gwId | [ ] |
| SHELL-004 | WHEN the NavRail renders THE system SHALL always render the HOME link (to "/"), the app mark, and the dimmed disabled fog trio (My Club, Roster, Transfers) | [ ] |
| SHELL-005 | WHEN the NavRail renders IF gw is null THE system SHALL NOT render the WORLD section or the COMPETITIONS section | [ ] |
| SHELL-006 | WHEN the NavRail renders IF gw is not null THE system SHALL render a WORLD section whose world name links to /:gwId | [ ] |
| SHELL-007 | WHEN the NavRail renders IF gw.Leagues is a non-empty array THE system SHALL render a COMPETITIONS section with one link per league to /:gwId/:leagueId; IF gw.Leagues is empty or absent THE system SHALL render no competition links without error | [ ] |
| SHELL-008 | WHEN deriving active-section highlighting THE system SHALL derive it from the router (useLocation/useParams) and SHALL NOT key it on gw identity, so highlighting survives a refreshToken re-fetch | [ ] |
| SHELL-009 | WHEN deriving active-section highlighting THE system SHALL light HOME on pathname "/", SHALL light WORLD on /:gwId with no deeper route, SHALL light the competition link whose leagueId matches on /:gwId/:leagueId, and SHALL keep the nearest lit section on deeper sub-routes (e.g. the team calendar) | [ ] |
| SHELL-010 | WHEN any page renders inside the shell THE system SHALL NOT render a page-local app header or back-link breadcrumb; navigation SHALL live entirely in the NavRail (Home and every /:gwId page drop their former headers) | [ ] |
| SIMUI-006 | WHEN the NavRail WORLD section renders IF gw.currentDate is set THE system SHALL display the formatted currentDate chip | [ ] → #130 |
| SIMUI-007 | WHEN the NavRail WORLD section renders IF gw.currentDate is null THE system SHALL display a muted "No date set" placeholder | [ ] → #130 |
| SIMUI-009 | WHEN the BatchSimulateControl in the NavRail renders IF gw.config.inProgress is true and gw.currentDate is set THE system SHALL show the "Simulate Today" button visible and enabled | [ ] |
| SIMUI-010 | WHEN the BatchSimulateControl renders IF gw.config.inProgress is false THE system SHALL NOT show the "Simulate Today" button | [ ] |
| SIMUI-011 | WHEN the BatchSimulateControl renders IF gw.currentDate is null THE system SHALL NOT show the "Simulate Today" button | [ ] |
| SIMUI-012 | WHEN the player clicks "Simulate Today" IF the request is in flight THE system SHALL disable the button and change its label to "Simulating…" | [ ] |
| SIMUI-013 | WHEN POST /api/gameWorld/:gwId/simulate returns 200 with zero skipped games THE system SHALL briefly show a "N simulated · 0 skipped" summary, auto-dismiss it after approximately 3 seconds, and return the button to its idle enabled state | [ ] |
| SIMUI-014 | WHEN POST /api/gameWorld/:gwId/simulate returns 200 with one or more skipped games THE system SHALL show a warning indicating how many games could not be simulated that does NOT auto-dismiss and SHALL hide the "Simulate Today" button while the warning is active | [ ] |
| SIMUI-015 | WHEN POST /api/gameWorld/:gwId/simulate returns any 200 response THE system SHALL call invalidate() on the GameWorldProvider context so that refreshToken increments | [ ] |
| SIMUI-016 | WHEN POST /api/gameWorld/:gwId/simulate returns a server error THE system SHALL show an error message in the NavRail and a "Retry" button | [ ] |
| SIMUI-017 | WHEN the player clicks "Retry" after a batch failure THE system SHALL return the control to the "Simulating…" disabled state and re-request POST /api/gameWorld/:gwId/simulate | [ ] |
| SIMUI-018 | WHEN POST /api/gameWorld/:gwId/simulate returns a server error THE system SHALL NOT call invalidate() and SHALL leave refreshToken unchanged | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired.*

SIMUI-006/007 graduate from `@future` (the "future left-pane nav" they were deferred to **is** this
rail — [#21](https://github.com/wulke/premier-league-baseball/issues/21),
[#44](https://github.com/wulke/premier-league-baseball/issues/44)) and SIMUI-009…SIMUI-018
relocate from `simulate-game-ui-specs.md` with IDs and SHALL behaviour unchanged (only the host:
`AppHeader` → `BatchSimulateControl` in the NavRail). SIMUI-008 (header presence) is retired —
superseded by SHELL-001.

## Traceability

- LLD: [`docs/llds/app-shell-ui.md`](../llds/app-shell-ui.md)
- HLD: [`docs/high-level-design.md` — "HLD: App Shell — Left Nav Rail"](../high-level-design.md)
- Source decision: [Map #2 (UI Direction)](https://github.com/wulke/premier-league-baseball/issues/2) / [#10 (Page-by-page layout plan)](https://github.com/wulke/premier-league-baseball/issues/10)
- **Provider specs (unchanged, owned by the simulate spec):** SIMUI-001…SIMUI-005 remain in [`simulate-game-ui-specs.md`](./simulate-game-ui-specs.md) — the shell mounts the provider (SHELL-002/003) but the fetch / invalidate / null contract is unchanged.
- **TeamCalendar cross-flow (unchanged, owned by the simulate spec):** SIMUI-027/028 (batch success → TeamCalendar re-fetch) — reworded "AppHeader" → "nav rail".
- **Gherkin:** `test/ui/features/app-shell-ui.feature` (SHELL-001…010 plus the graduated SIMUI-006/007 date-chip scenarios). `test/ui/features/simulate-game-ui.feature` retains provider, game-row, and batch-to-calendar scenarios.
- **Code entry points** (each lists the IDs it implements):
  - `src/ui/components/app-shell.tsx` (`AppShell`) — SHELL-001/002
  - `src/ui/components/nav-rail.tsx` (`NavRail`) — SHELL-004…009, SIMUI-006/007
  - `src/ui/components/batch-simulate-control.tsx` (`BatchSimulateControl`) — SIMUI-009…018
  - `src/ui/context/game-world-context.tsx` (`GameWorldProvider`) — SHELL-003 (the undefined-`gwId` guard; SIMUI-001…005 unchanged)
  - `src/ui/routes.tsx` + `src/ui/pages/{home,game-world,league,team-calendar}.tsx` — SHELL-010
