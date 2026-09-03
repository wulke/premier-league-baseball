Feature: League read API (get + standings)

  The pre-LID League read endpoints: GET /api/league/:leagueId returns the league with
  its Divisions and Teams, and GET /api/league/:leagueId/standings returns per-division
  standings computed against the parent GameWorld's year. Backfilled per the legacy-API
  spec process (LRD-001..005).

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And League 1 belongs to GameWorld 1 with one Division containing Team A and Team B

  @spec:LRD-001
  Scenario: Getting a League returns it with Divisions and Teams
    When the player requests League 1
    Then the response includes the League's Divisions
    And each Division includes its Teams

  @spec:LRD-002
  Scenario: Getting an unknown League responds 500
    When the player requests League 9999
    Then the response is a 500 error
    And the error indicates the League is invalid

  @spec:LRD-003
  Scenario: Standings return one entry per Division with computed standings
    When the player requests the standings for League 1
    Then the response has one entry with divisionId and divisionName
    And the entry's standings list both teams

  @spec:LRD-004
  Scenario: Standings count games attached to the GameWorld's year
    Given a COMPLETED game between Team A and Team B in the Division's 2025 season
    When the player requests the standings for League 1
    Then Team A's standing shows 1 played and 1 won
    And Team B's standing shows 1 played and 1 lost

  @spec:LRD-004
  Scenario: Standings ignore seasons attached to other years
    Given a COMPLETED game between Team A and Team B in the Division's 2025 season
    And GameWorld 1's year is 2026
    When the player requests the standings for League 1
    Then the entry's standings list is empty

  @spec:LRD-004
  Scenario: Standings fall back to the default standings config when the League has none
    When the player requests the standings for League 1
    Then the response includes computed points for every team

  @spec:LRD-005
  Scenario: Standings for an unknown League respond 500
    When the player requests the standings for League 9999
    Then the response is a 500 error
    And the error indicates the League is invalid
