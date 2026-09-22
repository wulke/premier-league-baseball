Feature: Game box score page

  @spec:BOXSUI-001
  Scenario: The route loader renders the completed score and roster tables
    Given GET /api/game/42 returns a completed box score
    When the user navigates to the game box score route
    Then the game box score shows both final scores and player rows

  @spec:BOXSUI-002
  Scenario: One missing team side has its own empty state
    Given GET /api/game/42 returns a completed box score with no away players
    When the user navigates to the game box score route
    Then the away box score says "No stats recorded" while home rows remain visible
