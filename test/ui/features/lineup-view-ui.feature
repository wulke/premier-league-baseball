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
    And PUT /api/team/10/lineup rejects the lineup as invalid
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager assigns unassigned player 14 to the bench
    And the manager saves the lineup
    Then the lineup validation failure is shown
    And the draft remains in edit mode

  @spec:LINEUI-014
  Scenario: A malformed successful lineup save keeps the editor available
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    And PUT /api/team/10/lineup returns a malformed successful response
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager saves the lineup
    Then the malformed lineup save failure is shown
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

  @spec:LINEUI-015
  Scenario: A manager drags one position-player starter onto another starter
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 1 onto player 2
    Then the starter slots for players 1 and 2 are swapped
    And pitcher and bullpen rows have no drag affordance

  @spec:LINEUI-015
  Scenario: A manager promotes a bench player by dropping it onto a starter
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 10 onto player 1
    Then player 10 fills player 1's starter slot and player 1 fills player 10's bench slot

  @spec:LINEUI-015
  Scenario: A manager demotes a starter by dropping it onto a bench player
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 1 onto player 10
    Then player 10 fills player 1's starter slot and player 1 fills player 10's bench slot

  @spec:LINEUI-015 @spec:BLUX-005
  Scenario: A manager combines drag and picker edits before saving once
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 1 onto player 2
    And the player selects the Batting tab
    And the manager picks player 10 for the Catcher slot
    And the manager saves the lineup
    Then the one saved lineup includes both the drag and picker slot swaps

  @spec:LINEUI-015
  Scenario: An unrelated drop does not change the lineup draft
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And an unrelated item is dropped onto player 2
    Then player 1 and player 2 remain in their original starter slots

  @spec:LINEUI-015
  Scenario: A row drag still swaps when the browser does not return its custom payload
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 1 onto player 2 without a readable drag payload
    Then the starter slots for players 1 and 2 are swapped

  @spec:BLUX-001 @spec:BLUX-002 @spec:BLUX-004
  Scenario: Eligible lineup drag gives source and valid target feedback only
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drags player 1 over player 2
    Then player 1 has the greyed-out drag source placeholder
    And player 2 has the prospective swap target highlight
    When the manager moves the drag over pitcher player 9
    And pitcher and bullpen rows have no drag feedback affordance

  @spec:BLUX-003
  Scenario: Eligible lineup drag feedback clears on drop and drag end
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    And the manager drops player 1 onto player 2
    Then neither player has drag feedback
    When the manager drags player 1 over player 2 and ends the drag
    Then neither player has drag feedback

  @spec:LINEUI-010 @spec:LINEUI-015
  Scenario: Edit selectors replace duplicated row labels
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup returns a DH-off active lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the manager enters lineup edit mode
    Then the Defensive position picker replaces its read-only position label
    When the player selects the Batting tab
    Then the Batting slot picker replaces the player name and the row remains drag-enabled

  @spec:LINEUI-012
  Scenario: An invalid read-mode lineup entry is visibly flagged
    Given GET /api/team/10/lineup returns a lineup with an invalid starter
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    Then the invalid starter row shows a visible invalid indicator

  @spec:GBULL-006
  Scenario: A managed team designates its next game's bullpen
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup/next-game returns a scheduled game lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player opens the Bullpen tab
    Then next-game starter, bullpen, and bench pickers are shown
    And fielder options are excluded from pitcher slots
    And defensive starters are excluded from bench slots
    When the manager saves the game lineup
    Then the game lineup draft is sent to the game save endpoint

  @spec:GBULL-006
  Scenario: A manager swaps two next-game bullpen slots by drag and drop
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup/next-game returns a scheduled game lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player opens the Bullpen tab
    And the manager drags bullpen player 12 onto bullpen player 13
    Then the next-game bullpen slots for players 12 and 13 are swapped

  @spec:GBULL-007
  Scenario: A manager swaps next-game SP, bullpen, and bench slots by drag and drop
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup/next-game returns a scheduled game lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player opens the Bullpen tab
    And the manager drags starting pitcher player 9 onto bullpen player 12
    And the manager drags bullpen player 13 onto bench player 10
    Then the next-game SP, bullpen, and bench slots retain both drag swaps

  @spec:GBULL-007
  Scenario: A manager combines Bullpen drag and picker edits before saving once
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup/next-game returns a scheduled game lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player opens the Bullpen tab
    And the manager drags bullpen player 12 onto bullpen player 13
    And the manager picks player 13 for the starting pitcher slot
    And the manager saves the game lineup
    Then the one saved game lineup includes both the drag and picker swaps

  @spec:GBULL-007
  Scenario: A locked next game has no Bullpen drag or edit affordance
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/lineup/next-game returns an in-progress game lineup
    And GET /api/team/10/roster returns names and ratings for the active lineup
    When the player navigates to "/1/team/10/lineup"
    And the player opens the Bullpen tab
    Then next-game lineup rows are not draggable and have no picker or save control
