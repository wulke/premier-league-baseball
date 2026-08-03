# Specs: Simulate Game UI

UI requirements for the simulate-game React frontend, covering two flows: **Flow C** — `GameWorldProvider` (React Context owning `gw` + `refreshToken`, now mounted by the App Shell — see [`app-shell-ui-specs.md`](./app-shell-ui-specs.md) SHELL-002/003 for the mount), and **Flow A** — `TeamCalendar`/`GameRow` per-row simulate. **Flow B** (the former `AppHeader`) has been relocated to the App Shell left nav rail: SIMUI-006/007 (currentDate chip) and SIMUI-009…SIMUI-018 (batch "Simulate Today") now live in [`app-shell-ui-specs.md`](./app-shell-ui-specs.md), and SIMUI-008 (header presence) is retired — superseded by SHELL-001. SIMUI-027/028 (batch → TeamCalendar re-fetch) remain here, reworded for the nav-rail trigger.

| ID | Requirement | Status |
|---|---|---|
| SIMUI-001 | WHEN the GameWorldProvider mounts for a GameWorld IF the GET /api/gameWorld/:gwId fetch succeeds THE system SHALL fetch the GameWorld once and expose it as gw via context with refreshToken initialized to 0 | [ ] |
| SIMUI-002 | WHEN invalidate() is called on the GameWorldProvider IF the provider is mounted THE system SHALL re-request GET /api/gameWorld/:gwId and increment refreshToken | [ ] |
| SIMUI-003 | WHEN invalidate() is called and the re-fetch returns updated GameWorld data THE system SHALL propagate the updated gw to every consuming child component | [ ] |
| SIMUI-004 | WHEN the GameWorld page renders within the GameWorldProvider THE system SHALL read gw from context and SHALL NOT issue its own GET /api/gameWorld/:gwId request | [ ] |
| SIMUI-005 | WHEN the GameWorldProvider mounts for a GameWorld IF the GET /api/gameWorld/:gwId fetch fails THE system SHALL expose gw as null so that child pages render without crashing | [ ] |
| SIMUI-019 | WHEN a GameRow renders IF the game status is SCHEDULED THE system SHALL show a "Simulate" button on the row | [ ] |
| SIMUI-020 | WHEN a GameRow renders IF the game status is COMPLETED THE system SHALL NOT show a "Simulate" button and SHALL display the game's score | [ ] |
| SIMUI-021 | WHEN a GameRow renders IF the game status is IN_PROGRESS THE system SHALL NOT show a "Simulate" button and SHALL display a status indicator | [ ] |
| SIMUI-022 | WHEN the player clicks "Simulate" on a game row IF the request is in flight THE system SHALL replace the button with a loading spinner | [ ] |
| SIMUI-023 | WHEN POST /api/game/:gameId/simulate returns status COMPLETED with results THE system SHALL remove the spinner, display the score in-place, and remove the "Simulate" button for that game | [ ] |
| SIMUI-024 | WHEN the player simulates one game successfully IF other game rows are present THE system SHALL leave those other rows' "Simulate" buttons unchanged | [ ] |
| SIMUI-025 | WHEN POST /api/game/:gameId/simulate returns a 4xx error THE system SHALL remove the spinner, show an error icon inline on the row, and leave the score unchanged | [ ] |
| SIMUI-026 | WHEN a single-game simulation has failed IF the player does not navigate away or trigger a re-fetch THE system SHALL persist the error icon with no retry button | [ ] |
| SIMUI-027 | WHEN a batch simulation succeeds from the nav rail IF the TeamCalendar page is mounted THE system SHALL increment refreshToken via invalidate() and the TeamCalendar SHALL re-fetch GET /api/team/:teamId/calendar | [ ] |
| SIMUI-028 | WHEN a batch simulation completes IF a previously-SCHEDULED game was simulated THE system SHALL, after the TeamCalendar re-fetch, display that game's updated score and remove its "Simulate" button | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired (out of scope this branch).*

## Traceability

- **Relocated/retired (Flow B):** SIMUI-006/007 (chip) and SIMUI-009…SIMUI-018 (batch) now live in [`app-shell-ui-specs.md`](./app-shell-ui-specs.md); SIMUI-008 is retired (superseded by SHELL-001). The former `src/ui/components/app-header.tsx` is deleted; its batch state machine is relocated to `src/ui/components/batch-simulate-control.tsx`.
- **Gherkin:** `test/ui/features/simulate-game-ui.feature` — SIMUI-001…005 and 019…028 remain bound here; the batch/chip steps (006/007/009…018) are re-homed to `test/ui/features/app-shell-ui.feature` (wording + testids move; IDs stable). The `@future` "Advance Date blocked by skipped-game warning" scenario stays out of scope and carries no `@spec` tag.
- **Step definitions:** `test/ui/steps/simulate-game-ui.steps.test.tsx` — SIMUI-001…005, 019…028. The `react-router` mock becomes location-aware (App Shell LLD s5). Batch / `AppHeader` mount helpers move to the app-shell step file.
- **Code entry points:**
  - `src/ui/context/game-world-context.tsx` (`GameWorldProvider` + `useGameWorldContext`) — SIMUI-001..SIMUI-005 (contract unchanged; the undefined-`gwId` guard is SHELL-003, owned by the app-shell spec)
  - `src/ui/pages/team-calendar.tsx` (`TeamCalendar`/`GameRow`) — SIMUI-019..SIMUI-028
