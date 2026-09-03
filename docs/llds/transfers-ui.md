# LLD: Transfers UI

> Upstream: [#237 Design: Transfers & contract-lifecycle LLD + EARS](https://github.com/wulke/premier-league-baseball/issues/237) resolved grill-me decision record ·
> Backend sibling LLD: [`contract-lifecycle.md`](./contract-lifecycle.md) ·
> EARS: `docs/specs/manager/transfers-ui-specs.md` (`XFERUI-001`..) ·
> Decision record: [#140 grill-me: Transfers / contract-lifecycle / free-agency](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237)
> Amends: `docs/llds/team-roster-ui.md` (adds release/renew row actions), `src/ui/components/nav-rail.tsx` (un-dims the Transfers fog item)

## Scope

Adds the **Transfers page** (`/:gwId/transfers`, world-scoped): the free-agent market plus a
Sign action that acts for the managed club only. Adds **Release** and **Renew** actions to roster
rows on the existing Team Roster view (`team-roster-ui.md`). Un-dims the nav rail's "Transfers" fog
item now that a surface exists to link to.

Depends on `GET /api/gameWorld/:gwId/free-agents` and `POST /api/team/:teamId/transfers/{sign,
release, renew}` (`contract-lifecycle.md`). Does **not** cover a trade UI, salary/contract-value
display, or any manager-dashboard beyond the actions above.

## Interface / Data Model

### Routing (`src/ui/routes.tsx` — world-scoped, sibling to `:leagueId`)

```tsx
<Route path=":gwId" id="gwId" loader={gwLoader}>
  <Route index element={<GameWorld />} />
  <Route path=":leagueId" element={<League />} />
  <Route path="transfers" element={<Transfers />} />   {/* NEW — XFERUI-001 */}
  ...
</Route>
```

### `Transfers` (NEW page, `src/ui/pages/transfers.tsx`)

```ts
// gw comes from the shared :gwId loader (useRouteLoaderData('gwId')), same pattern as NavRail.
const managedTeamId: number | null | undefined = gw?.managedTeamId;
const hasManagedClub = managedTeamId != null;

// fetch(Endpoints.GetFreeAgents.replace(':gwId', gwId)) → RosterPlayer[] (same shape as team roster)
// renders the SAME flat table component team-roster-ui.md already built for RosterPlayer[]
// (import/reuse, not a duplicate table implementation), plus one action column:
//   hasManagedClub → a "Sign" button per row
//   !hasManagedClub → action column omitted entirely; page is read-only market browsing
```

### Sign action

```ts
// POST Endpoints.SignPlayer.replace(':teamId', managedTeamId)  body: { playerId }
// on success: refetch the free-agent list (signed player drops off) — no full page reload
// on 422 (player no longer a free agent — race with another action): show inline error, refetch anyway
```

### Release / Renew row actions (amends `team-roster-ui.md`'s `TeamRoster` component)

```ts
// Only rendered when the viewed team IS the managed club (teamId === gw.managedTeamId);
// otherwise the roster table renders exactly as team-roster-ui.md already specifies, unchanged.
// Two buttons per row:
//   Release → POST Endpoints.ReleasePlayer.replace(':teamId', teamId)  body: { playerId }
//   Renew   → POST Endpoints.RenewPlayer.replace(':teamId', teamId)    body: { playerId }
// on success: refetch GET .../roster (released player drops off; renewed player's row is
//   otherwise unchanged today — Renew's effect is invisible until the successor contract
//   becomes current, per contract-lifecycle.md)
```

### Nav rail (amends `src/ui/components/nav-rail.tsx`)

```tsx
// The managed-club trio's `claimed` branch currently renders Transfers as a permanently-dimmed
// <div data-testid="nav-fog-transfers">. Replace with a live link, symmetric with My Club/Roster:
<Link data-testid="nav-managed-transfers" to={`/${gwId}/transfers`} style={managedLinkStyle}>Transfers</Link>
// The UNCLAIMED branch's <div data-testid="nav-fog-transfers"> stays dimmed — Transfers is
// world-scoped and always reachable in principle, but with no managed club there is nothing for
// the nav rail to deep-link a "Sign for my club" action into, so the entry point stays parked in
// the null-state fog trio rather than becoming a plain (non-managed-context) link. XFERUI-006.
```

## Logic Flow

```
Nav rail (claimed) — "Transfers" click
  → navigate(`/${gwId}/transfers`)                                              # XFERUI-001
  → Transfers mounts:
      fetch(GetFreeAgents) → RosterPlayer[]                                     # XFERUI-002
      render flat table (reused from team-roster-ui.md), + Sign column iff hasManagedClub
      Sign click → POST SignPlayer(managedTeamId, { playerId })
        .then(refetch free agents)                                             # XFERUI-003
        .catch(422 → inline "no longer available" message, refetch)            # XFERUI-004

Team Roster view (own managed club) — Release/Renew click
  → POST ReleasePlayer(teamId, { playerId }) | RenewPlayer(teamId, { playerId })
  → .then(refetch GET .../roster)                                              # XFERUI-005
  → .catch(422 → inline error, no optimistic update reverted since none was applied)
```

### Key decisions embedded in this flow

- **The free-agent table is the same component as the roster table**, not a parallel
  implementation — both consume `RosterPlayer[]` (`contract-lifecycle.md`'s
  `getFreeAgents`/`getRoster` share `toRosterPlayer`), so the UI layer mirrors that reuse rather
  than re-deriving a second row renderer.
- **No optimistic updates.** Every action refetches its list on success rather than locally
  patching state — consistent with the rest of the app's fetch-on-mount, no-client-cache style
  (`route-loader-foundation-ui.md`), and correctness-safe against the concurrent-write races a
  single-player game doesn't otherwise need to worry about but a same-tab double-click could still
  trigger.
- **Transfers is reachable without a managed club is explicitly rejected.** The page itself has no
  server-side gate (`GET /free-agents` is world-scoped, not managed-club-scoped), but the nav rail
  only exposes it once a club is claimed — matching Sign's own requirement of a managed club to act
  through. A direct URL visit with no managed club would still render the read-only market (the
  page component degrades on `hasManagedClub` alone, not on how it was navigated to); the nav rail
  gate is a discoverability choice, not an authorization boundary (that boundary is
  `contract-lifecycle.md`'s `assertManaged`, server-side).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | No managed club, user navigates to `/:gwId/transfers` directly (bypassing the dimmed nav item) | Page renders the read-only free-agent list with no action column — same degrade as `hasManagedClub === false` from any entry point. | XFERUI-006 |
| u2 | Sign a player who was signed by a race (e.g. two tabs) between list fetch and click | Server returns 422 (`XFER-003`); UI shows an inline "no longer available" message and refetches the list so the row disappears. | XFERUI-004 |
| u3 | Release/Renew clicked on a roster row for a team that is NOT the managed club | Action column is not rendered at all for a non-managed team's roster view — no client-side guard needed beyond the render condition, since the server-side `assertManaged` (`contract-lifecycle.md`) is the real boundary. | XFERUI-005 |
| u4 | `GET /free-agents` returns `[]` (no free agents in the `GameWorld`) | Table renders empty with the same empty-state convention `team-roster-ui.md` already establishes for `[]`. | XFERUI-002 |
| u5 | Renew succeeds | Row is visually unchanged (the successor contract isn't current yet) — no toast/confirmation beyond a brief inline success acknowledgment, since there is nothing in the roster row's displayed fields for a successor contract to change today (no contract-term column exists in `RosterPlayer` per `roster-read-api.md`). | XFERUI-005 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — no dedicated HLD section exists yet for Transfers; #237's resolved grill-me decision record stands in for it per explicit scoping decision on #237. |
| **This LLD** | `docs/llds/transfers-ui.md` |
| Backend sibling LLD | `docs/llds/contract-lifecycle.md` |
| Amends | `docs/llds/team-roster-ui.md` (release/renew row actions), `docs/llds/app-shell-ui.md`/`docs/llds/managed-club-ui.md` (nav-rail fog trio) |
| EARS | `docs/specs/manager/transfers-ui-specs.md` — `XFERUI-001`.. |
| Gherkin | `test/ui/features/transfers-ui.feature` |
| Code | `src/ui/pages/transfers.tsx` (new), `src/ui/pages/team-roster.tsx` (release/renew actions), `src/ui/components/nav-rail.tsx` (Transfers link), `src/ui/routes.tsx`, `src/api/endpoints.ts` (`GetFreeAgents`, `SignPlayer`, `ReleasePlayer`, `RenewPlayer`) |
| Decision record | [#140](https://github.com/wulke/premier-league-baseball/issues/140), [#237](https://github.com/wulke/premier-league-baseball/issues/237) |
