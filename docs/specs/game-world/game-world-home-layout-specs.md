# Specs: Game World Home Layout Cleanup

Frontend page-composition requirements for `src/ui/pages/game-world.tsx`. These requirements
intentionally do not alter `NotificationStream`'s own stream/data contract.

| ID | Requirement | Status |
|---|---|---|
| GWHOME-001 | WHEN the GameWorld home page renders THE system SHALL NOT render the redundant `Leagues` competition-card section | [x] → #332 |
| GWHOME-002 | WHEN the GameWorld home page renders THE system SHALL render the existing `NotificationStream` in a `Recent Activity` section below the Calendar strip and Action Items panel, without changing the component's supplied `gwId` or `managedTeamId` | [x] → #332 |
| GWHOME-003 | WHEN a GameWorld has one or more leagues THE App Shell SHALL continue to render its existing `COMPETITIONS` navigation links for those leagues | [x] → #332 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — HLD: Game World Home Page Overhaul](../high-level-design.md#hld-game-world-home-page-overhaul)
- LLD: `docs/llds/game-world/game-world-home-layout.md`
- Existing notification behavior: `docs/specs/notifications/notification-stream-ui-specs.md` (`NOTIFUI-001`..`NOTIFUI-007`)
- Existing action-item placement: `docs/specs/game-world/action-items-panel-ui-specs.md` (`ACTUI-001`)
- Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#332](https://github.com/wulke/premier-league-baseball/issues/332)
