Feature: Full-Season UI

  The team calendar route is GameWorld-scoped so one schedule view can show League and
  League Cup games together for the same team and season.

  Background:
    Given a GameWorld with id 1 exists for the full-season UI

  @spec:UI-004
  Scenario: Team calendar loads a combined schedule from the GameWorld route
    Given the player opens the TeamCalendar route "/1/team/7/calendar"
    And the team schedule includes games from the League and League Cup
    When the TeamCalendar page loads
    Then GET /api/team/7/calendar is requested with query "gwId=1"
    And the back-link points to "/1"
    And the Competition filter lists "Premier League" and "League Cup"

  @spec:UI-004
  Scenario: Competition filter narrows the combined schedule by division
    Given the player opens the TeamCalendar route "/1/team/7/calendar"
    And the team schedule includes games from the League and League Cup
    When the TeamCalendar page loads
    And the player filters the calendar to "League Cup"
    Then only "League Cup" games are shown
    And "Premier League" games are hidden

  @spec:UI-004
  Scenario: League team navigation uses the GameWorld-scoped calendar route
    Given the League page has a team named "River City"
    When the player clicks team "River City" from the League page
    Then the app navigates to "/1/team/7/calendar"
