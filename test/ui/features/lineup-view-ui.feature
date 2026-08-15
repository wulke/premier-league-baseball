Feature: Team Lineup View UI

  The Team hub's read-only Lineup tab shows the active lineup supplied by the lineup read API.
  Player identities come from the roster read; every visible player row links to player detail.

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  @spec:LINEUI-001
  Scenario: The team hub offers a Lineup tab
    When the player navigates to "/1/team/10/lineup"
    Then the page shows a Lineup tab

  @spec:LINEUI-002 @spec:LINEUI-004
  Scenario: A DH-off active lineup shows its nine batting starters and reserve pools
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then the batting-order card shows starters 1 through 9 with fielding positions
    And the starting pitcher is highlighted
    And no DH row is shown
    And the bench and bullpen pools are shown
    And starter, bench, and bullpen rows link to player detail

  @spec:LINEUI-003 @spec:LINEUI-004
  Scenario: A DH-on active lineup shows a DH row and a non-batting starting pitcher
    Given GET /api/team/10/lineup returns a DH-on active lineup
    And GET /api/team/10/roster returns names for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then the batting-order card shows starters 1 through 9 with fielding positions
    And a DH row is shown
    And the starting pitcher is highlighted
    And no mutating lineup controls are shown
