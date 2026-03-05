Feature: Simulate Game UI

  The player can simulate one or more scheduled games from the React frontend.
  A shared GameWorldProvider context provides GameWorld data (including currentDate)
  to all gwId-scoped pages. A shared AppHeader component displays the current date
  and hosts the batch "Simulate Today" action. Individual game rows on the TeamCalendar
  page show a per-row simulate button that updates the score in-place.

  Background:
    Given a GameWorld exists with id 1, year 2025, currentDate "2025-04-10", and season in progress
    And teams, a League, a Division, and a DivisionSeason exist in GameWorld 1
    And the player is viewing a page scoped to GameWorld 1

  # ─── Flow C: GameWorldProvider ────────────────────────────────────────────────

  Scenario: Provider fetches and exposes GameWorld data on mount
    When the GameWorldProvider mounts for GameWorld 1
    Then the context exposes gw with id 1, year 2025, and currentDate "2025-04-10"
    And the context exposes refreshToken with value 0

  Scenario: invalidate() re-fetches GameWorld and increments refreshToken
    Given the GameWorldProvider is mounted with refreshToken 0
    When invalidate() is called
    Then GET /api/gameWorld/1 is requested again
    And refreshToken is incremented to 1

  Scenario: Children receive updated gw data after invalidate()
    Given a child component consuming GameWorldProvider context
    And the GameWorld currentDate is "2025-04-10"
    When invalidate() is called and GET /api/gameWorld/1 responds with currentDate "2025-04-11"
    Then the child component receives the updated currentDate "2025-04-11"

  Scenario: GameWorld page consumes context and does not make a duplicate fetch
    When the GameWorld page renders within GameWorldProvider for GameWorld 1
    Then the GameWorld page reads gw from context
    And no additional GET /api/gameWorld/1 request is made by the GameWorld page itself

  Scenario: Provider exposes null gw when the GameWorld fetch fails
    Given GET /api/gameWorld/1 returns a server error
    When the GameWorldProvider mounts for GameWorld 1
    Then the context gw is null
    And child pages render without crashing

  # ─── Flow B: AppHeader — Date Chip ────────────────────────────────────────────

  Scenario: AppHeader displays the currentDate chip when currentDate is set
    When AppHeader renders for GameWorld 1 with currentDate "2025-04-10"
    Then the header displays the formatted date "Apr 10, 2025"

  Scenario: AppHeader displays a muted placeholder when currentDate is null
    Given the GameWorld currentDate is null
    When AppHeader renders for GameWorld 1
    Then the header displays "No date set" in a muted style

  Scenario: AppHeader is present on GameWorld, League, and TeamCalendar pages
    Then the AppHeader is present on the GameWorld page
    And the AppHeader is present on the League page
    And the AppHeader is present on the TeamCalendar page

  # ─── Flow B: AppHeader — Batch Simulate Button Guards ─────────────────────────

  Scenario: Simulate Today button is shown when season is in progress and currentDate is set
    Given gw.config.inProgress is true
    And gw.currentDate is "2025-04-10"
    When AppHeader renders
    Then the "Simulate Today" button is visible and enabled

  Scenario: Simulate Today button is not shown when the season is not in progress
    Given gw.config.inProgress is false
    When AppHeader renders
    Then the "Simulate Today" button is not visible

  Scenario: Simulate Today button is not shown when currentDate is null
    Given gw.config.inProgress is true
    And gw.currentDate is null
    When AppHeader renders
    Then the "Simulate Today" button is not visible

  # ─── Flow B: AppHeader — Batch Simulate Happy Paths ──────────────────────────

  Scenario: Clicking Simulate Today disables the button and shows submitting state
    Given the "Simulate Today" button is visible and enabled
    When the player clicks "Simulate Today"
    Then the button is disabled
    And the button label changes to "Simulating…"

  Scenario: Batch simulation succeeds with no skipped games and auto-dismisses
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns 200 with simulated 2 games and skipped 0
    Then a summary "2 simulated · 0 skipped" is briefly shown
    And the summary auto-dismisses after approximately 3 seconds
    And the "Simulate Today" button returns to its idle enabled state

  Scenario: Batch simulation succeeds with skipped games and warning persists
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns 200 with simulated 1 game and skipped 1
    Then a warning indicating 1 game could not be simulated is shown
    And the warning does not auto-dismiss
    And the "Simulate Today" button is not shown while the warning is active

  Scenario: Batch simulation calls invalidate() on any successful response
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns a 200 response
    Then invalidate() is called on the GameWorldProvider context
    And refreshToken is incremented

  # ─── Flow B: AppHeader — Batch Simulate Error Paths ──────────────────────────

  Scenario: Batch simulation failure shows an error message and Retry button
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns a server error
    Then an error message is shown in the header
    And a "Retry" button is visible

  Scenario: Player retries batch simulation after failure
    Given batch simulation has failed and the Retry button is visible
    When the player clicks "Retry"
    Then the header returns to the "Simulating…" disabled state
    And POST /api/gameWorld/1/simulate is requested again

  Scenario: Batch simulation failure does not call invalidate()
    Given the player clicks "Simulate Today"
    When POST /api/gameWorld/1/simulate returns a server error
    Then invalidate() is not called
    And refreshToken remains unchanged

  # ─── Flow A: TeamCalendar — GameRow Button Guards ─────────────────────────────

  Scenario: Simulate button is shown for a SCHEDULED game
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then a "Simulate" button is visible on the game row

  Scenario: Simulate button is not shown for a COMPLETED game
    Given a Game exists with status "COMPLETED" with homeTeamResult 3 and awayTeamResult 1
    When the TeamCalendar renders the GameRow for that game
    Then no "Simulate" button is visible on the game row
    And the score "3–1" is displayed

  Scenario: Simulate button is not shown for an IN_PROGRESS game
    Given a Game exists with status "IN_PROGRESS" and scheduledDate "2025-04-10"
    When the TeamCalendar renders the GameRow for that game
    Then no "Simulate" button is visible on the game row
    And a status indicator is displayed instead

  # ─── Flow A: Single Game Simulate — Happy Paths ───────────────────────────────

  Scenario: Clicking Simulate on a game row shows a loading spinner
    Given a "Simulate" button is visible for game 42
    When the player clicks "Simulate" on game 42
    Then the "Simulate" button is replaced by a loading spinner
    And the spinner is shown while the request is in flight

  Scenario: Successful single-game simulation shows the score in-place
    Given the player has clicked "Simulate" on game 42
    When POST /api/game/42/simulate returns status "COMPLETED" with homeTeamResult 5 and awayTeamResult 2
    Then the loading spinner is removed
    And the score "5–2" is displayed in the game row
    And no "Simulate" button is shown for game 42

  Scenario: Simulating one game does not affect other game rows
    Given games 42 and 43 both show "Simulate" buttons
    When the player simulates game 42 successfully
    Then game 43 still shows its "Simulate" button unchanged

  # ─── Flow A: Single Game Simulate — Error Paths ───────────────────────────────

  Scenario: Failed single-game simulation shows an error icon inline
    Given the player has clicked "Simulate" on game 42
    When POST /api/game/42/simulate returns a 4xx error
    Then the loading spinner is removed
    And an error icon is shown on the game row for game 42
    And the score is not changed

  Scenario: Error icon persists with no retry option after failure
    Given simulation of game 42 has failed and shows an error icon
    Then the error icon remains visible until the player navigates away or the calendar re-fetches
    And no retry button is shown on the game row

  # ─── Cross-flow: Batch Simulate → TeamCalendar Refresh ───────────────────────

  Scenario: Batch simulation from AppHeader triggers TeamCalendar re-fetch via refreshToken
    Given the player is viewing the TeamCalendar page
    And the TeamCalendar has loaded a list of games
    When the player clicks "Simulate Today" in the AppHeader and batch simulation succeeds
    Then invalidate() is called and refreshToken increments
    And the TeamCalendar re-fetches GET /api/team/:teamId/calendar
    And the TeamCalendar displays the updated game results

  Scenario: Games simulated via batch show updated scores on TeamCalendar after re-fetch
    Given game 42 is showing a "Simulate" button on the TeamCalendar
    When the player clicks "Simulate Today" in the AppHeader and batch simulation completes
    Then the TeamCalendar re-fetches its game list
    And game 42 no longer shows a "Simulate" button
    And game 42 displays its simulated score

  # ─── Future ───────────────────────────────────────────────────────────────────

  @future
  Scenario: Warning banner from skipped games blocks the Advance Date action
    Given batch simulation completed with 1 skipped game
    And the warning banner is active
    When the player attempts to advance the GameWorld date
    Then the Advance Date action is disabled
    And a message indicates unresolved games must be simulated first
