# Specs: Simulate Game UI

UI requirements for the simulate-game React frontend, covering the three coordinated flows from `docs/architecture/design/simulate-game-ui-proposal.md`: **Flow C** — `GameWorldProvider` (React Context owning `gw` + `refreshToken`), **Flow B** — `AppHeader` (batch "Simulate Today" state machine; the `currentDate` chip is retired this branch — see SIMUI-006/007), and **Flow A** — `TeamCalendar`/`GameRow` per-row simulate. Components are not yet implemented; every spec below is **Active** (`[ ]`), to be satisfied by #23 (`GameWorldProvider`), #24 (`AppHeader`), and #25 (`TeamCalendar`/`GameRow`).

| ID | Requirement | Status |
|---|---|---|
| SIMUI-001 | WHEN the GameWorldProvider mounts for a GameWorld IF the GET /api/gameWorld/:gwId fetch succeeds THE system SHALL fetch the GameWorld once and expose it as gw via context with refreshToken initialized to 0 | [ ] |
| SIMUI-002 | WHEN invalidate() is called on the GameWorldProvider IF the provider is mounted THE system SHALL re-request GET /api/gameWorld/:gwId and increment refreshToken | [ ] |
| SIMUI-003 | WHEN invalidate() is called and the re-fetch returns updated GameWorld data THE system SHALL propagate the updated gw to every consuming child component | [ ] |
| SIMUI-004 | WHEN the GameWorld page renders within the GameWorldProvider THE system SHALL read gw from context and SHALL NOT issue its own GET /api/gameWorld/:gwId request | [ ] |
| SIMUI-005 | WHEN the GameWorldProvider mounts for a GameWorld IF the GET /api/gameWorld/:gwId fetch fails THE system SHALL expose gw as null so that child pages render without crashing | [ ] |
| SIMUI-006 | ~~WHEN AppHeader renders IF the GameWorld currentDate is set THE system SHALL display the formatted currentDate chip~~ **Retired (out of scope this branch)** — currentDate display moved to the future left-pane nav; resolved by the [#21](https://github.com/wulke/premier-league-baseball/issues/21) chip-placement prototype. | [~] |
| SIMUI-007 | ~~WHEN AppHeader renders IF the GameWorld currentDate is null THE system SHALL display a muted "No date set" placeholder~~ **Retired (out of scope this branch)** — see SIMUI-006; same deferral to the future left-pane nav ([#21](https://github.com/wulke/premier-league-baseball/issues/21)). | [~] |
| SIMUI-008 | WHEN any of the GameWorld, League, or TeamCalendar pages renders THE system SHALL render the shared AppHeader component on each | [ ] |
| SIMUI-009 | WHEN AppHeader renders IF gw.config.inProgress is true and gw.currentDate is set THE system SHALL show the "Simulate Today" button visible and enabled | [ ] |
| SIMUI-010 | WHEN AppHeader renders IF gw.config.inProgress is false THE system SHALL NOT show the "Simulate Today" button | [ ] |
| SIMUI-011 | WHEN AppHeader renders IF gw.currentDate is null THE system SHALL NOT show the "Simulate Today" button | [ ] |
| SIMUI-012 | WHEN the player clicks "Simulate Today" IF the request is in flight THE system SHALL disable the button and change its label to "Simulating…" | [ ] |
| SIMUI-013 | WHEN POST /api/gameWorld/:gwId/simulate returns 200 with zero skipped games THE system SHALL briefly show a "N simulated · 0 skipped" summary, auto-dismiss it after approximately 3 seconds, and return the button to its idle enabled state | [ ] |
| SIMUI-014 | WHEN POST /api/gameWorld/:gwId/simulate returns 200 with one or more skipped games THE system SHALL show a warning indicating how many games could not be simulated that does NOT auto-dismiss and SHALL hide the "Simulate Today" button while the warning is active | [ ] |
| SIMUI-015 | WHEN POST /api/gameWorld/:gwId/simulate returns any 200 response THE system SHALL call invalidate() on the GameWorldProvider context so that refreshToken increments | [ ] |
| SIMUI-016 | WHEN POST /api/gameWorld/:gwId/simulate returns a server error THE system SHALL show an error message in the header and a "Retry" button | [ ] |
| SIMUI-017 | WHEN the player clicks "Retry" after a batch failure THE system SHALL return the header to the "Simulating…" disabled state and re-request POST /api/gameWorld/:gwId/simulate | [ ] |
| SIMUI-018 | WHEN POST /api/gameWorld/:gwId/simulate returns a server error THE system SHALL NOT call invalidate() and SHALL leave refreshToken unchanged | [ ] |
| SIMUI-019 | WHEN a GameRow renders IF the game status is SCHEDULED THE system SHALL show a "Simulate" button on the row | [ ] |
| SIMUI-020 | WHEN a GameRow renders IF the game status is COMPLETED THE system SHALL NOT show a "Simulate" button and SHALL display the game's score | [ ] |
| SIMUI-021 | WHEN a GameRow renders IF the game status is IN_PROGRESS THE system SHALL NOT show a "Simulate" button and SHALL display a status indicator | [ ] |
| SIMUI-022 | WHEN the player clicks "Simulate" on a game row IF the request is in flight THE system SHALL replace the button with a loading spinner | [ ] |
| SIMUI-023 | WHEN POST /api/game/:gameId/simulate returns status COMPLETED with results THE system SHALL remove the spinner, display the score in-place, and remove the "Simulate" button for that game | [ ] |
| SIMUI-024 | WHEN the player simulates one game successfully IF other game rows are present THE system SHALL leave those other rows' "Simulate" buttons unchanged | [ ] |
| SIMUI-025 | WHEN POST /api/game/:gameId/simulate returns a 4xx error THE system SHALL remove the spinner, show an error icon inline on the row, and leave the score unchanged | [ ] |
| SIMUI-026 | WHEN a single-game simulation has failed IF the player does not navigate away or trigger a re-fetch THE system SHALL persist the error icon with no retry button | [ ] |
| SIMUI-027 | WHEN a batch simulation succeeds from AppHeader IF the TeamCalendar page is mounted THE system SHALL increment refreshToken via invalidate() and the TeamCalendar SHALL re-fetch GET /api/team/:teamId/calendar | [ ] |
| SIMUI-028 | WHEN a batch simulation completes IF a previously-SCHEDULED game was simulated THE system SHALL, after the TeamCalendar re-fetch, display that game's updated score and remove its "Simulate" button | [ ] |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred, `[~]` Retired (out of scope this branch).*

## Traceability

- **Gherkin:** `test/ui/features/simulate-game-ui.feature` — one `@spec:SIMUI-###` tag per scenario (**26 in-scope scenarios**). SIMUI-006/007 (currentDate chip display) are re-tagged `@future` — retired to the future left-pane nav ([#44](https://github.com/wulke/premier-league-baseball/issues/44), [#21](https://github.com/wulke/premier-league-baseball/issues/21)). The `@future` "Advance Date blocked by skipped-game warning" scenario is likewise out of scope for this branch and carries no `@spec` tag.
- **Step definitions:** `test/ui/steps/simulate-game-ui.steps.test.ts` — to be created by [#22](https://github.com/wulke/premier-league-baseball/issues/22); will carry a `// @spec` header comment binding the **26** in-scope scenarios (SIMUI-001..SIMUI-028 excluding the retired SIMUI-006/007).
- **Code entry points** (each lists the IDs it implements) — to be authored by the implementation tickets:
  - `src/ui/context/game-world-context.tsx` (`GameWorldProvider` + `useGameWorldContext`) — [#23](https://github.com/wulke/premier-league-baseball/issues/23) — SIMUI-001..SIMUI-005
  - `src/ui/components/app-header.tsx` (`AppHeader`) — [#24](https://github.com/wulke/premier-league-baseball/issues/24) — SIMUI-008..SIMUI-018 (SIMUI-006/007 retired; ships without a chip)
  - `src/ui/pages/team-calendar.tsx` (`TeamCalendar`/`GameRow`) — [#25](https://github.com/wulke/premier-league-baseball/issues/25) — SIMUI-019..SIMUI-028
