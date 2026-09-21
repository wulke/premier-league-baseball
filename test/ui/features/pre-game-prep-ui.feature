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
