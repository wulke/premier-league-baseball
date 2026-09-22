Feature: League Dashboard / Standings routing split

  The :leagueId route splits into a lean League Dashboard at /:gwId/:leagueId and a full
  standings/bracket page at /:gwId/:leagueId/standings, each with its own loader. Content
  requirements for what each route renders live in league-dashboard-ui.feature; these
  scenarios cover routing/loader shape only.

  Background:
    Given a GameWorld exists with id 1, year 2025, currentDate "2025-04-10", and season in progress
    And League 1 "Premier League" exists in GameWorld 1

  @spec:STDRT-001
  Scenario: The League Dashboard route fetches all four dashboard endpoints
    When the player opens "/1/1"
    Then GET /api/league/1 is requested
    And GET /api/league/1/today is requested
    And GET /api/league/1/standings is requested
    And GET /api/league/1/bracket is requested
    And the League Dashboard page renders

  @spec:STDRT-002
  Scenario: The League Standings route fetches the unchanged three-endpoint set
    When the player opens "/1/1/standings"
    Then GET /api/league/1 is requested
    And GET /api/league/1/standings is requested
    And GET /api/league/1/bracket is requested
    And GET /api/league/1/today is not requested
    And the League Standings page renders

  @spec:STDRT-003
  Scenario: The old league URL renders the Dashboard, not the old full standings body
    When the player opens "/1/1"
    Then the League Dashboard page renders
    And the app does not navigate to "/1/1/standings"

  @spec:STDRT-004
  Scenario: A failed Today fetch does not fail the League Dashboard route
    Given GET /api/league/1/today returns a server error
    When the player opens "/1/1"
    Then the League Dashboard page renders
    And the League Dashboard shows no Today section
