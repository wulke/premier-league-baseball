Feature: Next-Game Action Item Producer

  The GameWorld home page's Action Items panel surfaces the managed team's next
  ready-to-sim game as a one-click path into its pre-game prep screen, without
  browsing the calendar. A team can have scheduled games in several leagues at
  once, so one item is surfaced per league rather than a single item overall —
  and only for a league whose next game has actually reached the GameWorld's
  current date. A league whose next game is still in the future, or that has no
  games left, produces no item.

  Background:
    Given GameWorld 1 exists with currentDate "2026-04-10" and Team A as managed team 1

  @spec:NGAI-006
  Scenario: A league's next game is ready to prep
    Given League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"
    When the GameWorld 1 home page loads
    Then an action item for League 10 appears linking to "/1/10/game/100"

  @spec:NGAI-006
  Scenario: Two leagues both have a ready next game
    Given League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"
    And League 20 "National League" has a SCHEDULED game 200 for Team A vs "Team C" scheduled "2026-04-09"
    When the GameWorld 1 home page loads
    Then an action item for League 10 appears linking to "/1/10/game/100"
    And an action item for League 20 appears linking to "/1/20/game/200"

  @spec:NGAI-004
  Scenario: A league's next game has not reached the current date yet
    Given League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-11"
    When the GameWorld 1 home page loads
    Then no action item for League 10 appears

  @spec:NGAI-005
  Scenario: A league has no scheduled games left
    Given League 10 "American League" has no scheduled games for Team A
    When the GameWorld 1 home page loads
    Then no action item for League 10 appears

  @spec:NGAI-006
  Scenario: Clicking an action item navigates to the game's prep screen
    Given League 10 "American League" has a SCHEDULED game 100 for Team A vs "Team B" scheduled "2026-04-10"
    When the GameWorld 1 home page loads
    And the manager clicks the action item for League 10
    Then the browser navigates to "/1/10/game/100"
