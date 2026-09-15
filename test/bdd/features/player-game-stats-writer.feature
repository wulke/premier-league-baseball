Feature: Per-player game event writer

  Completed games distribute their team-level score to the players frozen in each team's game lineup.

  @spec:PGSW-001 @spec:PGSW-003 @spec:PGSW-004
  Scenario: Complete lineups on both sides receive a reconciled box score
    Given a scheduled game has complete active lineups for both teams
    When the game completes through single simulation
    Then both teams have player game-stat rows for the game
    And each team's player runs equal its completed game score
    And only each lineup's starting pitcher has GS

  @spec:PGSW-002
  Scenario: One missing or incomplete lineup silently skips only that side
    Given a scheduled game has a complete home lineup and no away lineup
    When the game completes through single simulation
    Then the completed game has player game-stat rows only for the home team

  @spec:PGSW-002
  Scenario: One incomplete lineup silently skips only that side
    Given a scheduled game has a complete home lineup and an incomplete away lineup
    When the game completes through single simulation
    Then the completed game has player game-stat rows only for the home team

  @spec:PGSW-002
  Scenario: Missing or incomplete lineups on both sides write no synthetic stats
    Given a scheduled game has no active lineups
    When the game completes through single simulation
    Then the completed game has no player game-stat rows

  @spec:PGSW-001
  Scenario: Batch completion freezes and attributes complete lineups
    Given a scheduled game has complete active lineups for both teams
    When the game completes through batch simulation
    Then both teams have player game-stat rows for the game

  @spec:PGSW-004
  Scenario: A no-bullpen lineup gives every fabricated inning to its starter
    Given a scheduled game has complete active lineups with no bullpen
    When the game completes through single simulation
    Then each no-bullpen starter owns all pitching innings

  @spec:PGSW-005
  Scenario: A duplicate writer invocation surfaces the unique constraint
    Given a scheduled game has complete active lineups for both teams
    When the game completes through single simulation
    And the player game-stat writer is invoked again
    Then the duplicate writer invocation fails
