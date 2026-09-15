# LLD: Managed Club UI

> Map: [#137 — "My Club" concept](https://github.com/wulke/premier-league-baseball/issues/137) ·
> Delivery: [#153](https://github.com/wulke/premier-league-baseball/issues/153) ·
> Copy update: [#329](https://github.com/wulke/premier-league-baseball/issues/329) ·
> Backend sibling LLD: [`managed-club-pointer.md`](./managed-club-pointer.md) ·
> EARS: `docs/specs/manager/managed-club-ui-specs.md` (`MCLUI-001`..`MCLUI-006`) ·
> HLD: [`high-level-design.md` — App Shell fog trio](../high-level-design.md)

## Scope

Wires the **managed-club identity/navigation pin** to the pointer delivered in the backend
slice ([#152](https://github.com/wulke/premier-league-baseball/issues/152)). Two surfaces only:

1. **Job-market action on the team hub** (#149 / #171 / #329) — a "Job Market" / "Available Jobs"
   framing with a "Take this job" / "Leave this job" action that calls the setter, then re-reads
   `managedTeamId` from the game-world context. All teams remain available in this MVP; AI-managed
   teams and selective availability are out of scope.
2. **Nav-rail trio wiring** (`src/ui/components/nav-rail.tsx`, test IDs `nav-fog-*`) — when a
   club is claimed, "My Club" and "Roster" light up as links to the managed team's symmetric
   surfaces from map #135; "Transfers" stays dimmed (no transfers surface yet → #140).

Out of scope: any write-gating, a bespoke manager dashboard, a New Game "pick a team" flow, a
game-mode field, null-state discoverability UI, or an "apply/interview" gate — all deferred
(map #137 "Out of scope"). Claiming is frictionless/unconditional in MVP (MCLUI-006).

## Interface / Data Model

### Claim/Resign action (`src/ui/pages/team-hub.tsx`)

```ts
// TeamHub already owns the tab bar + Outlet. It gains:
//   const { gw, invalidate } = useGameWorldContext();
//   const { gwId, teamId } = useParams();
//   const managedTeamId: number | null | undefined = gw?.managedTeamId;   // from MCLB-002 GET payload
//   const isManaged = managedTeamId != null && managedTeamId === Number(teamId);
//
// POST Endpoints.SetManagedClub.replace(':gwId', gwId)
//   body { teamId: Number(teamId) }   // claim  (MCLUI-001)
//   body { teamId: null }             // resign (MCLUI-002)
//   → on response: invalidate()        // re-GET via context (MCLUI-003), no full reload
```

The action is a single button whose label/behavior flips on `isManaged`; a `submitting` guard
prevents double-fire. `gw`/`teamId` may be briefly out of sync on first paint (context loading
or `teamId` not yet parsed); `isManaged` is simply false until both are present, so an unclaimed
hub frames the team as an available job and shows "Take this job"; a claimed hub shows "Leave this
job" once the GET resolves. This is vocabulary only: it does not filter teams or alter the setter.

### Nav-rail trio (`src/ui/components/nav-rail.tsx`)

```ts
const managedTeamId = gw?.managedTeamId;   // number | null | undefined
const claimed = managedTeamId != null;
// claimed  → <Link data-testid="nav-managed-club"    to={`/${gwId}/team/${managedTeamId}`}>My Club</Link>
//            <Link data-testid="nav-managed-roster"  to={`/${gwId}/team/${managedTeamId}/roster`}>Roster</Link>
//            <div   data-testid="nav-fog-transfers">Transfers</div>          // stays dimmed (MCLUI-005)
// unclaimed→ the existing nav-fog-club / nav-fog-roster / nav-fog-transfers trio, unchanged (MCLUI-005)
```

The `nav-fog-*` test IDs are preserved verbatim in the unclaimed state (the App Shell map
#2/#10 asserts three `nav-fog-` nodes); only the claimed state swaps the first two for active
links. "My Club" / "Roster" are **redirects** to #135's generic, symmetric team hub/roster —
no bespoke manager page.

## Logic Flow

```
TeamHub (src/ui/pages/team-hub.tsx) renders inside AppShell (GameWorldProvider):
  reads gw.managedTeamId + teamId from route/context
  isManaged = managedTeamId === Number(teamId)
  render hub header: "Job Market" / "Available Jobs" + tab bar +
    (isManaged ? "Leave this job" : "Take this job")
  on click:
    POST /api/gameWorld/:gwId/managed-club { teamId: isManaged ? null : Number(teamId) }   // MCLUI-001/002
      → on response: invalidate()                                                          // MCLUI-003
        → GameWorldProvider bumps refreshToken → re-GET /api/gameWorld/:gwId
          → gw.managedTeamId updates → TeamHub + NavRail re-render from the fresh pointer

NavRail (src/ui/components/nav-rail.tsx):
  reads gw.managedTeamId from the same context
  claimed  → "My Club"/"Roster" render as Links to the managed team's hub/roster (MCLUI-004)
  unclaimed→ trio stays dimmed (nav-fog-*); "Transfers" dimmed in both states (MCLUI-005)
```

### Key decisions embedded in this flow

- **The hub, not the rail, is the sole job-taking affordance** — discovery rests entirely on the
  team-hub action; the unclaimed rail offers no new affordance (map #137 null-state decision).
- **Vocabulary is preparatory, not eligibility logic** — every team remains an available job in
  this slice. A future AI-manager map may filter the market, but this copy change must not add
  availability data, filtering, or endpoint behavior.
- **`invalidate()` is the reflect mechanism** — the setter's response body is not trusted to
  patch local state; the context re-GETs and `managedTeamId` flows back through `gw`, so the hub
  action and the rail update from one source of truth (MCLUI-003). Matches the App Shell LLD
  Flow C `refreshToken` invalidation pattern already used by batch simulate.
- **No write-gating** — `managedTeamId` is the *designated future* write-gate (writes-only,
  never reads); MVP gates nothing, preserving #135's symmetric reads (map #137 gating decision).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | Context still loading (`gw` null) on first hub paint | `managedTeamId` is `undefined` → `isManaged` false → the team renders as an available job with "Take this job"; flips to "Leave this job" once the GET resolves if this team is managed. | MCLUI-001/002 |
| u2 | Setter returns 4xx/422 (e.g. foreign team) | `invalidate()` still re-GETs; the pointer is unchanged server-side, so the UI reverts to the prior state. No bespoke error UI in MVP (frictionless posture; MCLUI-006). | MCLUI-003/006 |
| u3 | User double-clicks the action | A `submitting` guard disables the button while the POST is in flight. | MCLUI-001/002 |
| u4 | Nav rail on the Home route (`/`, no `gwId`) | `gw` is null → trio stays dimmed (`nav-fog-*`); no managed-club links render outside a world. | MCLUI-005 |
| u5 | "Transfers" item | Always dimmed — no transfers surface exists yet (#140). Never lights up in this slice. | MCLUI-005 |
| u6 | Direct nav to a non-managed team's hub | `isManaged` false → "Take this job"; taking it re-points `managedTeamId` away from any prior club (lifelong-mutable, map #137). | MCLUI-001 |

## Traceability

| Layer | Artifact |
|---|---|
| Map | [#137](https://github.com/wulke/premier-league-baseball/issues/137) |
| **This LLD** | `docs/llds/manager/managed-club-ui.md` |
| Backend sibling LLD | `docs/llds/manager/managed-club-pointer.md` |
| EARS | `docs/specs/manager/managed-club-ui-specs.md` — `MCLUI-001`..`MCLUI-006` |
| Gherkin | `test/ui/features/managed-club-ui.feature` |
| Code | `src/ui/pages/team-hub.tsx`, `src/ui/components/nav-rail.tsx` |
| Delivery | [#153](https://github.com/wulke/premier-league-baseball/issues/153) |
