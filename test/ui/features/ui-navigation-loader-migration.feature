Feature: UI navigation loader migration

  @spec:NAVLOAD-001 @spec:NAVLOAD-004 @spec:NAVLOAD-007 @spec:NAVLOAD-008
  Scenario: Every approved page route owns its primary loader
    Given the shared UI route configuration
    Then Player Detail, Team Roster, Team Calendar, Team Lineup, League, and Transfers each have a route loader
    And the Team Calendar route has a revalidation policy

  @spec:NAVLOAD-002 @spec:NAVLOAD-003 @spec:NAVLOAD-005 @spec:NAVLOAD-006 @spec:NAVLOAD-009
  Scenario: The loader migration has executable UI coverage
    Given the shared UI route configuration
    Then the loader migration UI step suite covers cancellation, failure, revalidation, and dirty Lineup drafts
