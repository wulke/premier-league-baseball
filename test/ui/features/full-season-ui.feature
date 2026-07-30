Feature: Full-Season UI

  The team calendar route is GameWorld-scoped so one schedule view can show League and
  League Cup games together for the same team and season, and the hub/league identity
  blocks compute season-champion state from live bracket data.

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

  @spec:UI-010
  Scenario: Team calendar renders knockout byes as played rows
    Given the player opens the TeamCalendar route "/1/team/7/calendar"
    And the team schedule includes a completed knockout bye
    When the TeamCalendar page loads
    Then the calendar shows opponent "Bye"
    And the bye row does not show a scoreline
    And the season summary shows "1 of 3 games played"
    When the player filters the calendar to played games
    Then the knockout bye remains visible

  @spec:UI-005 @spec:UI-006 @spec:UI-008
  Scenario: Knockout divisions render a bracket with byes and pending rounds
    Given the League page loads for league "3"
    When the League page renders
    Then the "Premier Division" card still shows the standings table
    And the "League Cup" card shows round "Quarterfinals"
    And the "League Cup" card groups byes under "Byes (1) — auto-advanced to Semifinals"
    And the "League Cup" card lists bye teams "Chelsea"
    And the "League Cup" card shows "Next: Semifinals — games pending"

  @spec:UI-005
  Scenario: Knockout divisions still render the bracket path when bracket data is temporarily unavailable
    Given the League page loads for league "5"
    When the League page renders
    Then the "Knockout" card shows "No bracket yet — season not started."
    And the "Knockout" card does not show the standings table

  @spec:UI-007
  Scenario: Multi-leg knockout ties expand from series rows to game rows
    Given the League page loads for league "3"
    When the League page renders
    Then the "League Cup" card shows collapsed series "Manchester City [2–1, 2–0] Leeds United ✓ Manchester City (2–0)"
    When the player expands the "Manchester City" knockout series
    Then the "League Cup" card shows game score "Game 1: Manchester City 2–1 Leeds United"
    And the "League Cup" card shows game score "Game 2: Leeds United 0–2 Manchester City"

  @spec:UI-008
  Scenario: Knockout divisions without games show the existing empty state and roster
    Given the League page loads for league "4"
    When the League page renders
    Then the "League Cup Qualifying" card shows "No bracket yet — season not started."
    And the "League Cup Qualifying" card shows roster teams "Rovers, Wanderers, Athletic, County"

  @spec:UI-001 @spec:UI-003
  Scenario: Decided round-robin leagues show a champion banner and disable simulation
    Given the League page loads for league "6"
    When the League page renders
    Then the League identity block shows "🏆 Premier League Champion: River City · Table decided"
    And the League identity block does not show "Season in progress"
    And the simulate control for the decided League is not shown
    When the player clicks team "River City" from the League page
    Then the app navigates to "/1/team/7/calendar"

  @spec:UI-001 @spec:UI-003
  Scenario: Decided cups show a cup champion banner and disable simulation
    Given the League page loads for league "7"
    When the League page renders
    Then the League identity block shows "🏆 Cup Champion: Manchester City · Final"
    And the simulate control for the decided League is not shown
    When the player expands the "Manchester City" knockout series
    Then the "League Cup" card shows game score "Game 1: Manchester City 2–1 Leeds United"

  @spec:UI-002 @spec:LIFE-001
  Scenario: GameWorld hub shows one decided champion while the other competition remains in progress
    Given the GameWorld page loads with only the league champion decided
    When the GameWorld page renders
    Then the Season block shows "Season 2025 — In Progress"
    And the Season block shows "🏆 Premier League: River City"
    And the Season block shows "League Cup: In progress"

  @spec:UI-002 @spec:LIFE-001
  Scenario: GameWorld hub shows Season Complete once both competitions are decided
    Given the GameWorld page loads with both league champions decided
    When the GameWorld page renders
    Then the Season block shows "Season 2025 — Complete"
    And the Season block shows "🏆 Premier League: River City"
    And the Season block shows "🏆 League Cup: Manchester City"
