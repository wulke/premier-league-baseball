Feature: Team name links

  Anywhere a team name renders as plain text with a known teamId, it links to that team's
  Team View page so a player can navigate to it from whatever surface they encounter it in.

  @spec:TEAMLINK-001 @spec:TEAMLINK-003
  Scenario: A calendar strip game entry's team names link to their Team View pages
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns a game with id 42 between Team A and Team B
    When the GameWorld 1 home page loads
    Then the calendar entry for game 42 links "Team A" to team 1's page
    And the calendar entry for game 42 links "Team B" to team 2's page

  @spec:TEAMLINK-001 @spec:TEAMLINK-004
  Scenario: A game box score's team headers link to their Team View pages
    Given GET /api/game/42 returns a completed box score between Home Club and Away Club
    When the user navigates to the game box score route
    Then the box score links "Home Club" to its Team View page
    And the box score links "Away Club" to its Team View page

  @spec:TEAMLINK-001 @spec:TEAMLINK-005
  Scenario: Pre-game prep's matchup header and opponent panel link to the Team View page
    Given a managed club has a scheduled game and game lineup snapshot
    When the manager opens that game's pre-game route
    Then the pre-game header links "Rivertown" to its Team View page
    And the opponent panel links "Rivertown" to its Team View page

  @spec:TEAMLINK-001 @spec:TEAMLINK-006
  Scenario: A team calendar row's opponent name links to its Team View page
    Given a team calendar with a scheduled game against Rivertown
    When the player opens that team's calendar
    Then the schedule row links "Rivertown" to its Team View page

  @spec:TEAMLINK-002 @spec:TEAMLINK-006
  Scenario: A bye row in a team calendar has no opponent link
    Given a team calendar with a bye row
    When the player opens that team's calendar
    Then the schedule row shows "Bye" with no team link
