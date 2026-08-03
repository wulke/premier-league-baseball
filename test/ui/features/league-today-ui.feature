Feature: GameWorld Home "Today" Section

  The GameWorld home page shows a "Today" section between the Season section and the Leagues
  list, previewing each league's rolling window of recent results and upcoming games so the
  player can see what's happening across leagues without drilling into each one. A league with
  nothing in its window is left out rather than shown as an empty block, and if no league has
  anything to show the whole section is left out too.

  Background:
    Given GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"

  # ─── Rendering With Games ────────────────────────────────────────────────────

  @spec:TODAYUI-001
  Scenario: The home page fetches today's snapshot for every league in the GameWorld
    When the GameWorld 1 home page loads
    Then GET /api/league/1/today is requested
    And GET /api/league/2/today is requested

  @spec:TODAYUI-003
  Scenario: Leagues with games in the window get a sub-block, grouped and sorted
    Given GET /api/league/1/today returns two games for League 1, one scheduled before the other
    And GET /api/league/2/today returns one game for League 2
    When the GameWorld 1 home page loads
    Then the Today section shows a "National League" sub-block listing its two games in chronological order
    And the Today section shows an "American League" sub-block listing its one game

  # ─── Omitting Empty Leagues ──────────────────────────────────────────────────

  @spec:TODAYUI-004
  Scenario: A league with no games in the window has no sub-block
    Given GET /api/league/1/today returns one game for League 1
    And GET /api/league/2/today returns no games
    When the GameWorld 1 home page loads
    Then the Today section shows a "National League" sub-block
    And the Today section does not show an "American League" sub-block

  # ─── Omitting the Whole Section ──────────────────────────────────────────────

  @spec:TODAYUI-005
  Scenario: No league has any games in the window
    Given GET /api/league/1/today returns no games
    And GET /api/league/2/today returns no games
    When the GameWorld 1 home page loads
    Then no Today section is shown

  @spec:TODAYUI-005
  Scenario: The season is not in progress
    Given GameWorld 1 has no active season
    When the GameWorld 1 home page loads
    Then no Today section is shown
    And GET /api/league/1/today is not requested

  # ─── Fetch Failure Treated As Empty ──────────────────────────────────────────

  @spec:TODAYUI-002
  Scenario: A league's snapshot request fails
    Given GET /api/league/1/today returns a 422 error
    And GET /api/league/2/today returns one game for League 2
    When the GameWorld 1 home page loads
    Then the Today section shows an "American League" sub-block
    And the Today section does not show a "National League" sub-block
    And no error message is shown on the page
