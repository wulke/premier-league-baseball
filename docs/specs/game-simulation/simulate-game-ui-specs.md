# Specs: Simulate Game UI

UI requirements for the simulate-game React frontend, covering **Flow A** — `TeamCalendar`/`GameRow`
per-row simulate. **Flow B** (the former `AppHeader`) has been relocated to the App Shell left nav
rail: SIMUI-006/007 (currentDate chip) and most of SIMUI-009…SIMUI-018 (batch "Simulate Today") now
live in [`app-shell-ui-specs.md`](./app-shell-ui-specs.md), and SIMUI-008 (header presence) is
retired — superseded by SHELL-001. **Flow C** (`GameWorldProvider`, SIMUI-001…005) is retired as of
the route-loader migration (map #229) — the Context it tested is deleted; gw now comes from the
`:gwId` route's loader. See [`route-loader-foundation-ui-specs.md`](./route-loader-foundation-ui-specs.md)
(RLDRUI-001…006) for the current mechanism. SIMUI-027 (batch → TeamCalendar re-fetch via
`refreshToken`) is retired for the same reason, superseded by RLDRUI-005; SIMUI-028 remains here
unchanged (it asserts score/button state, not the refresh mechanism).

| ID | Requirement | Status |
|---|---|---|
| SIMUI-019 | WHEN a GameRow renders IF the game status is SCHEDULED THE system SHALL show a "Simulate" button on the row | [ ] |
| SIMUI-020 | WHEN a GameRow renders IF the game status is COMPLETED THE system SHALL NOT show a "Simulate" button and SHALL display the game's score | [ ] |
| SIMUI-021 | WHEN a GameRow renders IF the game status is IN_PROGRESS THE system SHALL NOT show a "Simulate" button and SHALL display a status indicator | [ ] |
| SIMUI-022 | WHEN the player clicks "Simulate" on a game row IF the request is in flight THE system SHALL replace the button with a loading spinner | [ ] |
| SIMUI-023 | WHEN POST /api/game/:gameId/simulate returns status COMPLETED with results THE system SHALL remove the spinner, display the score in-place, and remove the "Simulate" button for that game | [ ] |
| SIMUI-024 | WHEN the player simulates one game successfully IF other game rows are present THE system SHALL leave those other rows' "Simulate" buttons unchanged | [ ] |
| SIMUI-025 | WHEN POST /api/game/:gameId/simulate returns a 4xx error THE system SHALL remove the spinner, show an error icon inline on the row, and leave the score unchanged | [ ] |
| SIMUI-026 | WHEN a single-game simulation has failed IF the player does not navigate away or trigger a re-fetch THE system SHALL persist the error icon with no retry button | [ ] |
| SIMUI-028 | WHEN a batch simulation completes IF a previously-SCHEDULED game was simulated THE system SHALL, after the TeamCalendar re-fetch, display that game's updated score and remove its "Simulate" button | [ ] |
| SIMUI-029 | WHEN a GameRow renders on the managed team's own calendar (`teamId === gw.managedTeamId`) THE system SHALL render a link to `/:gwId/:leagueId/game/:gameId` built from that row's own `leagueId`/`gameId`, alongside the existing "Simulate" button/result cell | [ ] → #365 |
| SIMUI-030 | WHEN a GameRow renders on a calendar that is not the managed team's own (`teamId !== gw.managedTeamId`) THE system SHALL NOT render the game-screen link on that row | [ ] → #365 |
| SIMUI-031 | WHEN the managed team's GameRow link renders THE system SHALL label it "Prep" for SCHEDULED with `scheduledDate <= gw.currentDate`, "Preview" for SCHEDULED with `scheduledDate > gw.currentDate`, "View" for IN_PROGRESS, and "Review" for COMPLETED | [ ] → #365 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired (out of scope this branch).*

## Traceability

- **Relocated/retired (Flow B):** SIMUI-006/007 (chip) and SIMUI-009…SIMUI-018 (batch) now live in [`app-shell-ui-specs.md`](./app-shell-ui-specs.md); SIMUI-008 is retired (superseded by SHELL-001). The former `src/ui/components/app-header.tsx` is deleted; its batch state machine is relocated to `src/ui/components/batch-simulate-control.tsx`.
- **Retired (Flow C, map #229):** SIMUI-001…005 (`GameWorldProvider` context) and SIMUI-027 (`refreshToken`-keyed TeamCalendar re-fetch) tested a Context that is now deleted. Superseded by RLDRUI-001/002/005 in [`route-loader-foundation-ui-specs.md`](./route-loader-foundation-ui-specs.md).
- **Gherkin:** `test/ui/features/simulate-game-ui.feature` — SIMUI-019…031 remain bound here (Flow C and SIMUI-015/018/027 scenarios are retired, replaced by `test/ui/features/route-loader-foundation-ui.feature`); the current-date chip scenarios (SIMUI-006/007) are implemented and bound in `test/ui/features/app-shell-ui.feature`. The `@future` "Advance Date blocked by skipped-game warning" scenario stays out of scope and carries no `@spec` tag.
- **Step definitions:** `test/ui/steps/simulate-game-ui.steps.test.tsx` — SIMUI-009…031 (rendered via the shared `routes` RouteObject[] and `createMemoryRouter`, per RLDRUI-006).
- **Code entry points:**
  - `src/ui/pages/team-calendar.tsx` (`TeamCalendar`/`GameRow`) — SIMUI-019..SIMUI-031
