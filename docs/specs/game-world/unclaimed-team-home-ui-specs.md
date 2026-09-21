# Specs: Unclaimed-Team Home Prompt

Frontend requirements for the unclaimed `GameWorld.managedTeamId` state on
`src/ui/pages/game-world.tsx`.

| ID | Requirement | Status |
|---|---|---|
| UNCLMUI-001 | WHEN the GameWorld home page renders IF `managedTeamId` is null THE system SHALL show one clear claim-a-team prompt in place of the Calendar and Action Items sections | [x] → #333 |
| UNCLMUI-002 | WHEN the unclaimed-team prompt renders IF the GameWorld has a competition THE system SHALL link to that competition's existing team list so the player can continue to `team-hub.tsx`'s claim action | [x] → #333 |
| UNCLMUI-003 | WHEN `managedTeamId` is non-null THE system SHALL retain the existing Calendar and Action Items layout and SHALL NOT render the unclaimed-team prompt | [x] → #333 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — HLD: Game World Home Page Overhaul](../../high-level-design.md#hld-game-world-home-page-overhaul)
- LLD: `docs/llds/game-world/unclaimed-team-home-ui.md`
- Existing claim flow: `docs/specs/manager/managed-club-ui-specs.md` (`MCLUI-001`..`MCLUI-003`)
- Tests: `test/ui/features/unclaimed-team-home-ui.feature`, `test/ui/steps/unclaimed-team-home-ui.steps.test.tsx`
- Code: `src/ui/pages/game-world.tsx`
