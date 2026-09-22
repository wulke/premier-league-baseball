Feature: Game Box Score API

  A completed game exposes its full used roster through frozen lineup ownership.

  @spec:BOXS-001 @spec:BOXS-002 @spec:BOXS-003
  Scenario: Completed game projects both full rosters from frozen lineups
    Given a completed box-score game with frozen home and away lineups
    When the client requests its box score
    Then the box score attributes players to their frozen home and away sides
    And each player includes frozen lineup fields, raw stats, and outs-derived IP
    And the score header uses the completed game results and players are presentation ordered

  @spec:BOXS-004
  Scenario: An incomplete game cannot be viewed as a box score
    Given a scheduled box-score game
    When the client requests its box score
    Then the box score response is a 422 domain error

  @spec:BOXS-005
  Scenario: A side without recorded stats remains an empty side
    Given a completed box-score game with frozen home and away lineups
    And the away side has no recorded box-score stats
    When the client requests its box score
    Then the box score has no away players and retains home players
