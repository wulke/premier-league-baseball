Feature: Route-Loader Foundation

  Every page under /:gwId shares one GameWorld fetch via a loader attached to the :gwId
  route, replacing the retired GameWorldProvider context. Mutations that used to call the
  provider's invalidate() now call React Router's revalidate(), which re-runs the loader
  for the currently matched route tree.

  Background:
    Given a GameWorld exists with id 1, year 2025, currentDate "2025-04-10", and season in progress

  @spec:RLDRUI-001
  Scenario: The gw loader fetches once and is shared across the rail and the page
    When the player opens the GameWorld route for GameWorld 1
    Then GET /api/gameWorld/1 is requested exactly once
    And the NavRail and the GameWorld page both display data from that one response

  @spec:RLDRUI-002
  Scenario: The gw loader resolves to null when the GameWorld fetch fails
    Given GET /api/gameWorld/1 returns a server error
    When the player opens the GameWorld route for GameWorld 1
    Then the NavRail renders HOME-only chrome
    And the GameWorld page renders without crashing

  # RLDRUI-003 covers 4 mutation call sites (BatchSimulateControl, RapidSimulateControl,
  # GameWorld's Start Season, TeamHub's claim/resign club) that all share the same
  # loader-revalidation mechanism. Only Batch Simulate is scenario'd here to prove the
  # mechanism itself; each mutation's own user-facing behavior is (or will be) covered by
  # its own feature — rapid-simulate-season-ui.feature, managed-club-ui.feature — except
  # Start Season, which has no prior Gherkin coverage of its refresh-after-mutation
  # behavior and is out of scope to add here (pre-existing gap, not introduced by this batch).

  @spec:RLDRUI-003
  Scenario: A successful batch simulation revalidates the gw loader
    Given the player is viewing the GameWorld route for GameWorld 1
    When the player clicks "Simulate Today" and batch simulation succeeds
    Then GET /api/gameWorld/1 is requested again
    And the NavRail reflects the refreshed GameWorld data

  @spec:RLDRUI-003
  Scenario: A failed batch simulation does not revalidate the gw loader
    Given the player is viewing the GameWorld route for GameWorld 1
    When the player clicks "Simulate Today" and the batch simulation request fails
    Then no additional GET /api/gameWorld/1 request is made
    And the NavRail continues to display the GameWorld data from the prior successful fetch

  # ─── Cross-page bridge (interim — retired once TeamCalendar gets its own loader, #234) ──

  @spec:RLDRUI-005
  Scenario: A batch simulation revalidation triggers a TeamCalendar re-fetch
    Given the player is viewing the TeamCalendar page for GameWorld 1
    And the TeamCalendar has loaded a list of games
    When the player clicks "Simulate Today" and batch simulation succeeds
    Then the gw loader for GameWorld 1 re-runs
    And the TeamCalendar re-fetches GET /api/team/:teamId/calendar
    And the TeamCalendar displays the updated game results

  # ─── Not exercised via Gherkin ──────────────────────────────────────────────────────────
  # RLDRUI-004 (superseded-navigation loader cancellation via request.signal) has no
  # distinct player-observable outcome beyond "the final render reflects the latest
  # navigation" — verified at the Code stage via React Router's own cancellation behavior.
  # Its predecessor (the manual `cancelled`-flag guard, old LLD u5) never had a dedicated
  # scenario either.
  # RLDRUI-006 (routes.tsx exports one shared RouteObject[] consumed by both the app and
  # every test's router) is a test/build-infrastructure invariant, not a player-facing
  # behavior — verified structurally: every UI BDD scenario in this suite renders through
  # that same shared `routes` export, so a regression here fails the whole UI suite, not
  # just this feature.
