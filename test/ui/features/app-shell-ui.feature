Feature: App Shell left nav rail

  The persistent shell owns navigation and world-level actions on every route.

  @spec:SHELL-001 @spec:SHELL-002 @spec:SHELL-004 @spec:SHELL-005
  Scenario: Home renders persistent branded home navigation
    Given the player opens the Home route
    Then the App Shell and NavRail are present
    And the rail shows an active branded home link, no standalone HOME link, and disabled fog trio
    And the rail has no WORLD or COMPETITIONS section

  @spec:SHELL-003
  Scenario: Home does not fetch an undefined GameWorld
    Given the player opens the Home route
    Then no GET request is made for an undefined GameWorld

  @spec:SHELL-007 @spec:SHELL-012 @spec:SHELL-013
  Scenario: Competition selector defaults to the managed club's home league and navigates on change
    Given GameWorld 1 has managed Team 10 whose Primary Home League is 7
    And GameWorld 1 also has league 8 named "League Cup"
    When the player opens the GameWorld route for GameWorld 1
    Then the COMPETITIONS selector shows only one control with "Premier" selected
    When the player selects league 8 from the COMPETITIONS selector
    Then the app navigates to "/1/8"
    And the COMPETITIONS selector has "League Cup" selected

  @spec:SHELL-013
  Scenario: Competition selector reflects a directly-routed non-home league
    Given GameWorld 1 has managed Team 10 whose Primary Home League is 7
    And GameWorld 1 also has league 8 named "League Cup"
    When the player opens the League route for GameWorld 1 and league 8
    Then the COMPETITIONS selector has "League Cup" selected

  @spec:SHELL-007
  Scenario: An unclaimed world hides the competitions selector
    Given GameWorld 1 has no managed team
    When the player opens the GameWorld route for GameWorld 1
    Then the rail has no COMPETITIONS section

  @spec:SHELL-007
  Scenario: A world without leagues renders no competition links
    Given GameWorld 1 has no leagues
    When the player opens the GameWorld route for GameWorld 1
    Then the rail shows WORLD linked to "/1"
    And the rail has no COMPETITIONS section

  @spec:SHELL-007 @spec:SHELL-012 @spec:LDASH-001 @spec:LDASH-005
  Scenario: A competition rail link leads from the GameWorld home to full standings
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    And GameWorld 1 has managed Team 10 whose Primary Home League is 7
    When the player opens the GameWorld route for GameWorld 1
    And the player selects the "Premier" competition from the rail
    Then the League Dashboard page renders
    When the player selects "View full standings"
    Then the app navigates to "/1/7/standings"

  @spec:SIMUI-006
  Scenario: NavRail WORLD section displays the currentDate chip when currentDate is set
    Given GameWorld 1 has currentDate "2025-04-10"
    When the player opens the GameWorld route for GameWorld 1
    Then the WORLD section displays the formatted date "Apr 10, 2025"

  @spec:SIMUI-007
  Scenario: NavRail WORLD section displays a muted placeholder when currentDate is null
    Given GameWorld 1 has currentDate null
    When the player opens the GameWorld route for GameWorld 1
    Then the WORLD section displays "No date set" in a muted style

  @spec:SHELL-007 @spec:SHELL-013
  Scenario: Active league highlighting survives a GameWorld refresh
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    And GameWorld 1 has managed Team 10 whose Primary Home League is 7
    When the player opens the League route for GameWorld 1 and league 7
    And the GameWorld refreshes
    Then the COMPETITIONS selector has "Premier" selected

  @spec:SHELL-010
  Scenario: Navigation lives in the rail rather than page-local headers
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    When the player opens the GameWorld route for GameWorld 1
    Then no page-local app header or breadcrumb is rendered

  @spec:SHELL-011
  Scenario: The rail is pinned while main content owns vertical scrolling
    Given the player opens the Home route
    Then the App Shell separates viewport scrolling between the rail and main content
