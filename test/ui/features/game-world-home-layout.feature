Feature: Game World Home Layout

  The Game World home page presents manager-focused calendar and action content before a
  labeled recent-activity stream. Competition navigation remains in the App Shell rail, so the
  duplicate League cards do not appear in the page body.

  @spec:GWHOME-001 @spec:GWHOME-002 @spec:GWHOME-003
  Scenario: Recent Activity follows the manager content while competitions remain in the rail
    Given GameWorld 1 has a managed club, a current date, and Premier League competition 7
    When the player opens the GameWorld 1 home page
    Then the page shows Recent Activity below the calendar and Action Items sections
    And the page does not show a Leagues card section
    And the COMPETITIONS rail shows a link to Premier League
