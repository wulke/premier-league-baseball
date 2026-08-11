# Specs: Managed Club UI

Frontend requirements for claiming/resigning the managed club and wiring the nav-rail
"managed-club trio" (`src/ui/pages/team-hub.tsx`, `src/ui/components/nav-rail.tsx`), consuming
`POST /api/gameWorld/:gwId/managed-club` and the `managedTeamId` already carried by
`GET /api/gameWorld/:gwId` (`MCLB-002`).

| ID | Requirement | Status |
|---|---|---|
| MCLUI-001 | WHEN the team hub renders for a team that is not the GameWorld's managed club THE system SHALL show a "Claim as My Club" action that posts that team's id to `POST /api/gameWorld/:gwId/managed-club` | [x] → #153 |
| MCLUI-002 | WHEN the team hub renders for the team that IS the GameWorld's managed club THE system SHALL show a "Stop managing" action that posts `{ teamId: null }` to the managed-club setter | [x] → #153 |
| MCLUI-003 | WHEN a claim/resign setter call responds THE system SHALL re-read `managedTeamId` from the game-world context (re-GET) with no full page reload, so the hub action and the nav rail update from the re-fetched GameWorld | [x] → #153 |
| MCLUI-004 | WHEN a managed club is set THE system SHALL light the nav rail's "My Club" item as a link to the managed team's hub (`/:gwId/team/:managedTeamId`) and "Roster" as a link to the managed team's roster view (`/:gwId/team/:managedTeamId/roster`) | [x] → #153 |
| MCLUI-005 | WHEN no managed club is set THE system SHALL keep the "My Club" / "Roster" / "Transfers" trio dimmed with no affordance, and "Transfers" SHALL remain dimmed in both states | [x] → #153 |
| MCLUI-006 | WHEN the user claims or resigns THE system SHALL do so unconditionally with no apply/interview gate (deferred post-engine) | [x] → #153 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- Map: [#137 — "My Club" concept (managed-club ownership layer)](https://github.com/wulke/premier-league-baseball/issues/137)
- Delivery: [#153](https://github.com/wulke/premier-league-baseball/issues/153)
- Backend sibling specs: `docs/specs/managed-club-specs.md` (`MCLB-001`..`MCLB-005`)
- LLD: `docs/llds/managed-club-ui.md`
- Tests: `test/ui/features/managed-club-ui.feature`, `test/ui/steps/managed-club-ui.steps.test.tsx`
- Code: `src/ui/pages/team-hub.tsx`, `src/ui/components/nav-rail.tsx`
