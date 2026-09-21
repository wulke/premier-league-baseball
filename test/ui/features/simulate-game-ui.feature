Feature: Simulate Game UI

  The player can simulate one or more scheduled games from the React frontend.
  The GameWorld (including currentDate) is shared to all gwId-scoped pages via the
  :gwId route's loader (docs/llds/route-loader-foundation-ui.md). The NavRail hosts the
  batch "Simulate Today" action ("AppHeader" below is the historical name for that
  control's host, predating the App Shell rebuild). Individual game rows on the
  TeamCalendar page show a per-row simulate button that updates the score in-place.

  Background:
    Given a GameWorld exists with id 1, year 2025, currentDate "2025-04-10", and season in progress
    And teams, a League, a Division, and a DivisionSeason exist in GameWorld 1
    And the player is viewing a page scoped to GameWorld 1

  # ─── Retired: Flow C (GameWorldProvider) ──────────────────────────────────────
  # SIMUI-001..005 tested the GameWorldProvider React Context directly (mount, invalidate(),
  # refreshToken, null-on-failure). That Context is deleted — gw now comes from the :gwId
  # route's loader (docs/llds/route-loader-foundation-ui.md). Equivalent coverage lives in
  # test/ui/features/route-loader-foundation-ui.feature as RLDRUI-001/RLDRUI-002.

  # ─── Flow B: AppHeader — Batch Simulate Button Guards ─────────────────────────

  @spec:SIMUI-009
  Scenario: Simulate Today button is shown when season is in progress and currentDate is set
    Given gw.config.inProgress is true
    And gw.currentDate is "2025-04-10"
    When AppHeader renders
    Then the "Simulate Today" button is visible and enabled

  @spec:SIMUI-010
  Scenario: Simulate Today button is not shown when the season is not in progress
    Given gw.config.inProgress is false
    When AppHeader renders
    Then the "Simulate Today" button is not visible

  @spec:SIMUI-011
  Scenario: Simulate Today button is not shown when currentDate is null
    Given gw.config.inProgress is true
    And gw.currentDate is null
    When AppHeader renders
    Then the "Simulate Today" button is not visible

  # ─── Flow B: AppHeader — Batch Simulate Happy Paths ──────────────────────────

  @spec:SIMUI-012
  Scenario: Clicking Simulate Today disables the button and shows submitting state
    Given the "Simulate Today" button is visible and enabled
    When the player clicks "Simulate Today"
    Then the button is disabled
    And the button label changes to "Simulating…"

  @spec:SIMUI-013
  Scenario: Batch simulation succeeds with no later games and auto-dismisses
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns 200 with simulated 2 games and skipped 0
    Then a summary "2 simulated · No later games scheduled" is briefly shown
    And the summary auto-dismisses after approximately 3 seconds
    And the "Simulate Today" button returns to its idle enabled state

  @spec:SIMUI-014
  Scenario: Batch simulation warns when an in-progress game blocks date progression
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns 200 with simulated 1 game and skipped 1
    Then a warning indicating 1 game could not be simulated is shown
    And the warning does not auto-dismiss
    And the "Simulate Today" button is not shown while the warning is active

  @spec:SIMUI-029
  Scenario: Batch simulation shows the next game day instead of warning about future games
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns 200 with simulated 1 game, skipped 1 future game, and nextDate "2025-04-12"
    Then a summary "1 simulated · Next game day: 2025-04-12" is briefly shown
    And no warning indicating games could not be simulated is shown

  # ─── Retired: SIMUI-015 ────────────────────────────────────────────────────────
  # "Batch simulation calls invalidate() on any successful response" tested the deleted
  # GameWorldProvider API by name. Equivalent coverage: RLDRUI-003 in
  # test/ui/features/route-loader-foundation-ui.feature ("A successful batch simulation
  # revalidates the gw loader").

  # ─── Flow B: AppHeader — Batch Simulate Error Paths ──────────────────────────

  @spec:SIMUI-016
  Scenario: Batch simulation failure shows an error message and Retry button
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns a server error
    Then an error message is shown in the header
    And a "Retry" button is visible

  @spec:SIMUI-017
  Scenario: Player retries batch simulation after failure
    Given batch simulation has failed and the Retry button is visible
    When the player clicks "Retry"
    Then the header returns to the "Simulating…" disabled state
    And POST /api/gameWorld/1/simulate is requested again

  # ─── Retired: SIMUI-018 ────────────────────────────────────────────────────────
  # "Batch simulation failure does not call invalidate()" tested the deleted
  # GameWorldProvider API by name. Equivalent coverage: RLDRUI-003 in
  # test/ui/features/route-loader-foundation-ui.feature ("A failed batch simulation does
  # not revalidate the gw loader").

  # ─── Flow A: TeamCalendar — GameRow Button Guards ─────────────────────────────

  @spec:SIMUI-019
  Scenario: Simulate button is shown for a SCHEDULED game
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then a "Simulate" button is visible on the game row

  @spec:SIMUI-020
  Scenario: Simulate button is not shown for a COMPLETED game
    Given a Game exists with status "COMPLETED" with homeTeamResult 3 and awayTeamResult 1
    When the TeamCalendar renders the GameRow for that game
    Then no "Simulate" button is visible on the game row
    And the score "3–1" is displayed

  @spec:SIMUI-021
  Scenario: Simulate button is not shown for an IN_PROGRESS game
    Given a Game exists with status "IN_PROGRESS" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then no "Simulate" button is visible on the game row
    And a status indicator is displayed instead

  # ─── Flow A: Single Game Simulate — Happy Paths ───────────────────────────────

  @spec:SIMUI-022
  Scenario: Clicking Simulate on a game row shows a loading spinner
    Given a "Simulate" button is visible for game 42
    When the player clicks "Simulate" on game 42
    Then the "Simulate" button is replaced by a loading spinner
    And the spinner is shown while the request is in flight

  @spec:SIMUI-023
  Scenario: Successful single-game simulation shows the score in-place
    Given the player has clicked "Simulate" on game 42
    When POST /api/game/42/simulate returns status "COMPLETED" with homeTeamResult 5 and awayTeamResult 2
    Then the loading spinner is removed
    And the score "5–2" is displayed in the game row
    And no "Simulate" button is shown for game 42

  @spec:SIMUI-024
  Scenario: Simulating one game does not affect other game rows
    Given games 42 and 43 both show "Simulate" buttons
    When the player simulates game 42 successfully
    Then game 43 still shows its "Simulate" button unchanged

  # ─── Flow A: Single Game Simulate — Error Paths ───────────────────────────────

  @spec:SIMUI-025
  Scenario: Failed single-game simulation shows an error icon inline
    Given the player has clicked "Simulate" on game 42
    When POST /api/game/42/simulate returns a 4xx error
    Then the loading spinner is removed
    And an error icon is shown on the game row for game 42
    And the score is not changed

  @spec:SIMUI-026
  Scenario: Error icon persists with no retry option after failure
    Given simulation of game 42 has failed and shows an error icon
    Then the error icon remains visible until the player navigates away or the calendar re-fetches
    And no retry button is shown on the game row

  # ─── Cross-flow: Batch Simulate → TeamCalendar Refresh ───────────────────────

  # ─── Retired: SIMUI-027 ────────────────────────────────────────────────────────
  # "Batch simulation from AppHeader triggers TeamCalendar re-fetch via refreshToken"
  # tested the deleted refreshToken/invalidate() mechanism by name. Equivalent coverage:
  # RLDRUI-005 in test/ui/features/route-loader-foundation-ui.feature ("A batch simulation
  # revalidation triggers a TeamCalendar re-fetch").

  @spec:SIMUI-028
  Scenario: Games simulated via batch show updated scores on TeamCalendar after re-fetch
    Given game 42 is showing a "Simulate" button on the TeamCalendar
    When the player clicks "Simulate Today" in the AppHeader and batch simulation completes
    Then the TeamCalendar re-fetches its game list
    And game 42 no longer shows a "Simulate" button
    And game 42 displays its simulated score

  # ─── Flow A: TeamCalendar — Game Screen Link (map #350, issue #365) ───────────

  @spec:SIMUI-029
  Scenario: Game screen link appears on the managed team's own calendar row
    Given the managed team is team 1
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then a game screen link is visible on the game row

  @spec:SIMUI-030
  Scenario: Game screen link is absent from another team's calendar row
    Given the managed team is team 9
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then no game screen link is visible on the game row

  @spec:SIMUI-031
  Scenario Outline: Game screen link label reflects game state and readiness
    Given the managed team is team 1
    And gw.currentDate is "2025-04-10"
    And a Game exists with status "<status>" and scheduledDate "<scheduledDate>"
    When the TeamCalendar renders the GameRow for that game
    Then the game screen link is labeled "<label>"

    Examples:
      | status      | scheduledDate | label   |
      | SCHEDULED   | 2025-04-10T00:00:00.000Z | Prep    |
      | SCHEDULED   | 2025-04-20    | Preview |
      | IN_PROGRESS | 2025-04-10    | View    |
      | COMPLETED   | 2025-04-01    | Review  |

  @spec:SIMUI-031
  Scenario: Game screen link labels an unscheduled SCHEDULED game "Prep" regardless of currentDate
    Given the managed team is team 1
    And gw.currentDate is "2025-04-10"
    And a Game exists with status "SCHEDULED" and no scheduledDate
    When the TeamCalendar renders the GameRow for that game
    Then the game screen link is labeled "Prep"

  # ─── Future ───────────────────────────────────────────────────────────────────

  @future
  Scenario: Warning banner from skipped games blocks the Advance Date action
    Given batch simulation completed with 1 skipped game
    And the warning banner is active
    When the player attempts to advance the GameWorld date
    Then the Advance Date action is disabled
    And a message indicates unresolved games must be simulated first
