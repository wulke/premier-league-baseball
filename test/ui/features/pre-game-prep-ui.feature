Feature: Pre-game prep UI

  @spec:PREGAME-001 @spec:PREGAME-002 @spec:PREGAME-003
  Scenario: A managed club prepares and simulates its scheduled game
    Given a managed club has a scheduled game and game lineup snapshot
    When the manager opens that game's pre-game route
    Then the page shows opponent record, probable pitcher, and the game lineup editor
    When the manager selects "Ready to sim"
    Then the completed score is shown

  @spec:PREGAME-004
  Scenario: Another club's game is unavailable
    Given a managed club does not have the requested game
    When the manager opens that game's pre-game route
    Then the game is unavailable and no simulation action is shown

  @spec:PREGAME-005
  Scenario: A future-dated scheduled game is a read-only preview
    Given a managed club has a scheduled game after the GameWorld's current date
    When the manager opens that game's pre-game route
    Then the page shows opponent context but no lineup editor or "Ready to sim" button

  @spec:PREGAME-005
  Scenario: No current date configured treats the scheduled game as not ready
    Given a managed club has a scheduled game and the GameWorld has no current date configured
    When the manager opens that game's pre-game route
    Then the page shows opponent context but no lineup editor or "Ready to sim" button

  @spec:PREGAME-005
  Scenario: A scheduled game with no scheduled date is always ready
    Given a managed club has a scheduled game with no scheduled date and the GameWorld has no current date configured
    When the manager opens that game's pre-game route
    Then the page shows opponent record, probable pitcher, and the game lineup editor
