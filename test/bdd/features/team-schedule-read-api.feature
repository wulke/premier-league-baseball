Feature: Team schedule read API (calendar)

  The pre-LID endpoint GET /api/team/:teamId/calendar?gwId&leagueId merges a team's
  games across every League of the GameWorld (optionally narrowed to one League),
  shaped per SCL-011. Backfilled per the legacy-API spec process (TSCH-001..004).

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And GameWorld 2 exists with year 2025
    And League 1 belongs to GameWorld 1 with Division "D1" containing Team A and Team B
    And League 2 belongs to GameWorld 1 with Division "D2" containing Team A and Team B
    And League 3 belongs to GameWorld 2 with Division "D3" containing Team C
    And a COMPLETED game between Team A and Team B in Division "D1" of the 2025 season
    And a COMPLETED game between Team A and Team B in Division "D2" of the 2025 season

  @spec:TSCH-001
  Scenario: The calendar merges a team's games across all Leagues of the GameWorld
    When the player requests Team A's calendar for GameWorld 1
    Then the response has teamId and teamName for Team A
    And the response includes both games with year, division and team-name context

  @spec:TSCH-001
  Scenario: A team with no games in the requested world returns an empty calendar
    When the player requests Team C's calendar for GameWorld 1
    Then the response's games array is empty

  @spec:TSCH-002
  Scenario: Supplying leagueId narrows the calendar to that League's Divisions
    When the player requests Team A's calendar for GameWorld 1 narrowed to League 1
    Then the response includes only the game from Division "D1"

  @spec:TSCH-003
  Scenario: A missing gwId surfaces the raw persistence-layer failure with a 500
    When the player requests Team A's calendar without a GameWorld id
    Then the response is a 500 error
    And the error surfaces the raw persistence-layer failure for a NaN world id

  @spec:TSCH-003
  Scenario: An unknown GameWorld id fails the lookup with a 500
    When the player requests Team A's calendar for GameWorld 9999
    Then the response is a 500 error
    And the error indicates the GameWorld was not found

  @spec:TSCH-003
  Scenario: An unknown team fails the Team lookup with a 500
    When the player requests Team 9999's calendar for GameWorld 1
    Then the response is a 500 error
    And the error indicates the Team was not found

  @spec:TSCH-004
  Scenario: A knockout bye reports Bye as the opponent with a series round label
    Given Division "D1" uses a KNOCKOUT format
    And a SCHEDULED bye game for Team A with no away team in Division "D1" of the 2025 season
    When the player requests Team A's calendar for GameWorld 1
    Then the bye game's awayTeamName is "Bye"
    And the bye game's awayTeamId is null
    And the bye game's roundLabel is "Final"

  @spec:TSCH-004
  Scenario: A round-robin game labels its round plainly
    Given a SCHEDULED game between Team A and Team B in Division "D1" round 2 of the 2025 season
    When the player requests Team A's calendar for GameWorld 1
    Then that game's roundLabel is "Round 2"
