# LLD: Action Items Panel — UI Component (`game-world.tsx`)

> Upstream: [HLD: Game World Home Page Overhaul](../../high-level-design.md#hld-game-world-home-page-overhaul) ("Action-items panel scope", "Owns #327") ·
> EARS: `docs/specs/game-world/action-items-panel-ui-specs.md` (`ACTUI-001`..`ACTUI-005`) ·
> Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325) (decision 5), [#327](https://github.com/wulke/premier-league-baseball/issues/327)

## Scope

Adds a new "Action Items" section to `src/ui/pages/game-world.tsx`: a scaffolded panel with a
documented `ActionItem` data contract, rendered as an empty "ready for content" state today,
since no domain concept that would produce a real action item (contract expiry, injury,
training) exists in the codebase yet. This LLD designs the panel's component, its data
contract, and where it mounts — it does **not** design any producer of real items.

Out of scope (each a sibling ticket/LLD, per the HLD):
- Any real "requires action" system (contracts/injuries/training) that would populate the
  panel — HLD "Out of scope": none of these domain concepts exist yet.
- Calendar-day action badges (a secondary surface hinted at in map decision 5) — not built;
  this panel is the only action-items surface this map ships.
- Final page section ordering/positioning (dropping the "Leagues" list, repositioning
  `NotificationStream` as "recent activity" below the calendar/action panel) — #332's sibling
  LLD. This LLD mounts the panel in a reasonable interim position (directly below the
  calendar section) without redoing the rest of the page layout.
- The unclaimed-team ("claim a team") home state — #333. This LLD assumes the panel is only
  ever mounted when `gw.managedTeamId` is non-null, matching the existing `CalendarStrip`
  guard (`docs/llds/game-world/home-calendar-strip-ui.md`); the null case is that sibling's
  concern.

## Interface / Data Model

### `ActionItem` — the panel's data contract

```ts
// src/ui/components/action-items-panel.tsx
//
// Registering a new action-item producer (e.g. "contract expiring in <30 days"):
//   1. In the domain/feature that owns the underlying condition, compute ActionItem[]
//      from its own data (e.g. a future `useExpiringContracts()` hook, or a field
//      already present on `gw`/a fetched resource) — ActionItemsPanel has no opinion
//      on where an item comes from and does no fetching of its own.
//   2. Pass that array into `<ActionItemsPanel items={...} />`'s `items` prop from
//      game-world.tsx. With a single producer, pass its array directly; once a second
//      producer exists, concatenate the producers' arrays before passing (e.g.
//      `items={[...expiringContractItems, ...injuryItems]}`) — a dedicated merge hook
//      is unnecessary abstraction until a second producer actually exists.
//   3. Give each item a producer-namespaced `id` (e.g. `contract-expiring-${playerId}`)
//      so ids from different producers can never collide once concatenated.
export type ActionItemSeverity = 'info' | 'warning' | 'critical';

export interface ActionItem {
  id: string;                    // stable, producer-namespaced React key
  label: string;                 // human-readable description of what needs attention
  severity: ActionItemSeverity;  // drives sort order and visual weight
  href?: string;                 // optional in-app route for a CTA; omitted = not actionable via a click-through yet
  ctaLabel?: string;             // button text when href is present; ignored otherwise
}
```

### `ActionItemsPanel` props

```ts
interface ActionItemsPanelProps {
  items: ActionItem[];   // flat list; empty today since no producer exists (see Scope)
}
```

The component is a dumb renderer, same shape as `CalendarStrip`: it owns no fetch and no
state, sorts and renders whatever `items` it is handed.

## Logic Flow

```
1. game-world.tsx, gw.managedTeamId set:
     renders <ActionItemsPanel items={[]} /> directly below the Calendar section
       — no producer exists yet, so the array passed in is always empty today; the
         prop exists so a future producer only needs to change the array it's given,
         never the component                                              # ACTUI-001

2. ActionItemsPanel, items.length === 0:
     renders a single dashed `Card` (house empty-state convention, matching
     home.tsx's "No game worlds yet" state) with copy framed as "ready to
     surface things that need your attention" — explicitly not "nothing to
     do," so the section reads as functioning-but-empty rather than as a
     completed checklist                                                  # ACTUI-002

3. ActionItemsPanel, items.length > 0:
     sorted = items sorted by severity rank (critical > warning > info),
       stable on ties (preserves the order the caller passed)             # ACTUI-003
     for each item in sorted: render a row —
       severity rendered as a `Badge` (color keyed off severity)
       IF item.href is set: row is a clickable `Card interactive`,
         navigating to item.href on click, showing item.ctaLabel (or a
         generic "View" fallback) as the visible CTA text
       ELSE: row is a plain, non-interactive `Card`                       # ACTUI-004

4. gw.managedTeamId == null (pre-existing guard, matching CalendarStrip):
     ActionItemsPanel is not mounted at all — the unclaimed-team state
     (#333) owns what renders in its place                                # ACTUI-005

Note: the mount guard is `managedTeamId != null` only — deliberately NOT also
`currentDate != null` like CalendarStrip's guard. Since no code path sets
`currentDate` after `newSeason()` today (a pre-existing gap, see project memory),
requiring it here would mean the panel never renders in the current app at all,
defeating this ticket's point of visibly proving the scaffold works. The
consequence — the panel can appear without a Calendar section above it while
that gap persists — is accepted, not accidental.
```

### Key decisions embedded in this flow

- **`items` is a plain prop, not a hook the component owns**: keeps `ActionItemsPanel` a pure
  renderer with the same shape as `CalendarStrip` — `game-world.tsx` stays the single place
  that assembles page-level data, and a future producer's fetch/derivation logic lives with
  that producer, not inside this component.
- **Severity governs sort order now, even with zero real items**: the empty-state and
  non-empty render paths are both exercised by Gherkin with synthetic items (stage 4), so the
  ordering rule is pinned down before a real producer exists rather than left undefined and
  discovered ad hoc later.
- **Dashed `Card` for the empty state, reusing `home.tsx`'s existing convention**: no new
  empty-state pattern introduced; `Card`'s `dashed` variant already exists for exactly this
  "ready, not empty-because-broken" framing.
- **Mounted directly below Calendar, not in #332's final position**: avoids blocking this
  ticket on #332's unrelated layout rework (dropping "Leagues", repositioning
  `NotificationStream`); the panel's existence and contract are this ticket's job, its final
  position on the page is #332's.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | `items` is empty (true for every caller today — no producer exists) | Dashed `Card` "ready for content" empty state; never renders a "nothing to do" message. | ACTUI-002 |
| u2 | Two or more items share the same `severity` | Original relative order (as passed by the caller) is preserved — stable sort, not re-ordered arbitrarily. | ACTUI-003 |
| u3 | An item has no `href` | Renders as a plain, non-interactive row — no dead/no-op click target. | ACTUI-004 |
| u4 | An item has `href` but no `ctaLabel` | CTA falls back to a generic "View" label rather than rendering blank. | ACTUI-004 |
| u5 | `gw.managedTeamId` is `null` | Panel is not rendered — same guard as `CalendarStrip`; the unclaimed-team prompt (#333) takes its place. | ACTUI-005 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — "Action-items panel scope", "Owns #327" |
| **This LLD** | `docs/llds/game-world/action-items-panel-ui.md` |
| Sibling LLDs | `docs/llds/game-world/home-calendar-strip-ui.md` (guard precedent, mount ordering) |
| EARS | `docs/specs/game-world/action-items-panel-ui-specs.md` — `ACTUI-001`..`ACTUI-005` |
| Gherkin | `test/ui/features/action-items-panel.feature` |
| Code | `src/ui/pages/game-world.tsx`, `src/ui/components/action-items-panel.tsx` (new) |
| Decision record | [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#327](https://github.com/wulke/premier-league-baseball/issues/327) |
