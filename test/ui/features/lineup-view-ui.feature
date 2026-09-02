Feature: Team Lineup View UI

  The Team hub's read-only Lineup tab shows the active lineup supplied by the lineup read API,
  as a Defensive | Batting tabbed table — one row per starter, plus bench and bullpen as inline
  tagged rows. Player identities and positional ratings come from the roster read; every visible
  player row links to player detail.

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  @spec:LINEUI-001
  Scenario: The team hub offers a Lineup tab
    When the player navigates to "/1/team/10/lineup"
    Then the page shows a Lineup tab

  @spec:LINEUI-002 @spec:LINEUI-004
  Scenario: A DH-off active lineup shows its nine batting starters and reserve rows on the Batting tab
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player selects the Batting tab
    Then the batting rows show starters 1 through 9 with fielding positions
    And the starting pitcher is highlighted
    And no DH row is shown
    And bench and bullpen rows tagged BENCH and BULLPEN are shown
    And starter, bench, and bullpen rows link to player detail

  @spec:LINEUI-003 @spec:LINEUI-004
  Scenario: A DH-on active lineup shows a DH row and a non-batting starting pitcher on the Batting tab
    Given GET /api/team/10/lineup returns a DH-on active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player selects the Batting tab
    Then the batting rows show starters 1 through 9 with fielding positions
    And a DH row is shown
    And the starting pitcher is highlighted
    And no mutating lineup controls are shown

  # ─── Defensive | Batting tabs (#225) ────────────────────────────────────────

  @spec:LINEUI-005 @spec:LINEUI-006
  Scenario: The Lineup tab defaults to the Defensive tab, showing each starter's position and rating
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then the Defensive tab is shown by default
    And the defensive rows show one row per starter with their fielding position and positional rating

  @spec:LINEUI-006
  Scenario: Switching between Defensive and Batting tabs does not refetch data
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player selects the Batting tab
    And the player selects the Defensive tab
    Then no additional lineup or roster request is made

  @spec:LINEUI-007
  Scenario: Bench and bullpen rows show no fielding position or rating on the Defensive tab
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then bench and bullpen rows tagged BENCH and BULLPEN are shown
    And the bench and bullpen rows show no fielding position or rating

  @spec:LINEUI-008
  Scenario: A starter absent from the roster response shows an em-dash rating on the Defensive tab
    Given GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup except one starter
    When the player navigates to "/1/team/10/lineup"
    Then the row for the missing starter shows "Player #<id>" as its label
    And the row for the missing starter shows an em dash for its rating

  @spec:LINEUI-009 @spec:LINEUI-010 @spec:LINEUI-011 @spec:LINEUI-013
  Scenario: A managed team enters edit mode and assigns an unassigned player
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings including unassigned players
    When the player navigates to "/1/team/10/lineup"
    Then an Edit lineup control is shown
    When the manager enters lineup edit mode
    Then the unassigned bucket is shown
    And fielding position, derived batting slot, and role controls are shown
    And the pitcher batting slot is locked to 9
    When the manager assigns unassigned player 14 to the bench
    Then player 14 leaves the unassigned bucket
    And no lineup save request has been made
    When the manager saves the lineup
    Then the active lineup draft is sent to the save endpoint
    And the saved lineup returns to read-only mode

  @spec:LINEUI-010 @spec:LINEUI-011 @spec:LINEUI-013
  Scenario: Edit mode reflects DH rules and blocks an occupied defensive slot
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-on active lineup
    And GET /api/team/10/roster returns names and ratings including unassigned players
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    Then the DH fielding-position option is shown
    And an occupied defensive-position option is blocked
    And the occupied DH option is blocked

  @spec:LINEUI-010 @spec:LINEUI-011 @spec:LINEUI-013
  Scenario: A promoted non-pitcher starter receives the vacated batting slot
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings including unassigned players
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager moves player 2 to the bench
    And the manager promotes player 14 to starter at FirstBase
    Then player 14 has derived batting slot 2

  @spec:LINEUI-010 @spec:LINEUI-011 @spec:LINEUI-013
  Scenario: A promoted DH receives the vacated batting slot
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-on active lineup
    And GET /api/team/10/roster returns names and ratings including unassigned players
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager moves player 9 to the bench
    And the manager promotes player 14 to starter at DH
    Then player 14 has derived batting slot 9

  @spec:LINEUI-004 @spec:LINEUI-009
  Scenario: A non-managed team has no lineup editing controls
    Given GameWorld 1 has Team 11 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then no mutating lineup controls are shown

  @spec:LINEUI-014
  Scenario: A rejected managed-team lineup save shows the validation failure
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    And PATCH /api/team/10/lineup rejects the lineup as invalid
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager assigns unassigned player 14 to the bench
    And the manager saves the lineup
    Then the lineup validation failure is shown
    And the draft remains in edit mode

  @spec:LINEUI-014
  Scenario: Cancelling an edit discards its draft
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings including unassigned players
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager assigns unassigned player 14 to the bench
    And the manager cancels lineup editing
    Then the unassigned player is not assigned in the read-only lineup

  @spec:LINEUI-012
  Scenario: An invalid read-mode lineup entry is visibly flagged
    Given GET /api/team/10/lineup returns a lineup with an invalid starter
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then the invalid starter row shows a visible invalid indicator
