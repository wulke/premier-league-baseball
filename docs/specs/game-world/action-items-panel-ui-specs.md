# Specs: Action Items Panel — UI Component

Frontend requirements for the `ActionItemsPanel` component on the GameWorld home page
(`src/ui/pages/game-world.tsx`, `src/ui/components/action-items-panel.tsx`). Scaffold-only:
no producer of real `ActionItem`s exists yet, so every caller passes an empty array today.

| ID | Requirement | Status |
|---|---|---|
| ACTUI-001 | WHEN the GameWorld home page loads IF `gw.managedTeamId` is set THE system SHALL render `ActionItemsPanel` directly below the Calendar section, passed an `items: ActionItem[]` array (empty today, since no producer exists) | [x] → #327 |
| ACTUI-002 | WHEN `ActionItemsPanel` receives an empty `items` array THE system SHALL render a dashed `Card` empty state framed as "ready to surface things that need your attention" and SHALL NOT render "nothing to do" copy | [x] → #327 |
| ACTUI-003 | WHEN `ActionItemsPanel` receives one or more items THE system SHALL render them sorted by `severity` (critical, then warning, then info) IF two items share a `severity` THE system SHALL preserve their original relative order (stable sort) | [x] → #327 |
| ACTUI-004 | WHEN an item is rendered IF `href` is set THE system SHALL render that item as a clickable `Card` navigating to `href`, showing `ctaLabel` as the CTA text IF `ctaLabel` is set ELSE showing a generic "View" fallback IF `href` is not set THE system SHALL render that item as a plain, non-interactive `Card` | [x] → #327 |
| ACTUI-005 | WHEN the GameWorld home page loads IF `gw.managedTeamId` is null THE system SHALL NOT render `ActionItemsPanel`, mirroring the `CalendarStrip` guard (`CALWUI` series) | [x] → #327 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — HLD: Game World Home Page Overhaul](../high-level-design.md#hld-game-world-home-page-overhaul) ("Action-items panel scope", "Owns #327")
- LLD: `docs/llds/game-world/action-items-panel-ui.md`
- Sibling specs: `docs/specs/game-world/home-calendar-strip-ui-specs.md` (`CALWUI-001`..`CALWUI-008` — shared `managedTeamId` mount guard precedent)
- Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325) (decision 5), [#327](https://github.com/wulke/premier-league-baseball/issues/327)
- Code: `src/ui/pages/game-world.tsx`, `src/ui/components/action-items-panel.tsx` (new)
