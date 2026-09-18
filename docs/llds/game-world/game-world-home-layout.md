# LLD: Game World Home Layout Cleanup

> Upstream: [HLD: Game World Home Page Overhaul](../../high-level-design.md#hld-game-world-home-page-overhaul) ·
> EARS: `docs/specs/game-world/game-world-home-layout-specs.md` (`GWHOME-001`..`GWHOME-003`) ·
> Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#332](https://github.com/wulke/premier-league-baseball/issues/332)

## Scope

Completes the Game World home-page section ordering after the calendar-strip (#326) and
action-items-panel (#327) additions. The redundant page-level **Leagues** card list is removed;
the App Shell's existing **COMPETITIONS** rail remains the sole per-league navigation surface.
`NotificationStream` stays the same component with the same props, fetch, SSE, filtering, and
cleanup behavior, but is wrapped as **Recent Activity** below the calendar/action-items content.

## Interface / Data Model

No API, route, state, or `NotificationStream` interface changes.

```tsx
// game-world.tsx page composition only
Calendar section?             // existing managed-team/current-date guard
ActionItemsPanel?             // existing managed-team guard
Recent Activity section
  <NotificationStream gwId={Number(gwId)} managedTeamId={gw.managedTeamId ?? null} />
```

The existing `NavRail` continues to derive `COMPETITIONS` links from `gw.Leagues`.

## Logic Flow

```
1. Render the existing Calendar section when its existing guard permits it.
2. Render the existing Action Items panel when its existing guard permits it.
3. Render a `Recent Activity` section containing the existing NotificationStream with unchanged
   gwId and managedTeamId props.                                      # GWHOME-002
4. Do not render the former Leagues heading or its interactive cards. # GWHOME-001
5. NavRail continues to render one COMPETITIONS link per gw.Leagues row. # GWHOME-003
```

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| A GameWorld has no managed team or current date | Existing calendar/action-item guards remain unchanged; Recent Activity still receives the existing `managedTeamId ?? null` value and retains its established filtering behavior. | GWHOME-002 |
| A GameWorld has multiple leagues | The removed cards are not duplicated elsewhere; each league remains reachable through its existing NavRail `COMPETITIONS` link. | GWHOME-001, GWHOME-003 |
| Notification loading or SSE behavior changes while moving the section | Out of scope: only the parent page position and label change; `NotificationStream` implementation and props remain untouched. | GWHOME-002 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — Game World Home Page Overhaul |
| **This LLD** | `docs/llds/game-world/game-world-home-layout.md` |
| EARS | `docs/specs/game-world/game-world-home-layout-specs.md` |
| Gherkin | `test/ui/features/game-world-home-layout.feature` |
| Code | `src/ui/pages/game-world.tsx` |
