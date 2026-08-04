Feature: App Shell left nav rail

  The persistent shell owns navigation and world-level actions on every route.

  @spec:SHELL-001 @spec:SHELL-002 @spec:SHELL-004 @spec:SHELL-005
  Scenario: Home renders persistent HOME-only chrome
    Given the player opens the Home route
    Then the App Shell and NavRail are present
    And the rail shows the app mark, HOME link, and disabled fog trio
    And the rail has no WORLD or COMPETITIONS section

  @spec:SHELL-003
  Scenario: Home does not fetch an undefined GameWorld
    Given the player opens the Home route
    Then no GET request is made for an undefined GameWorld

  @spec:SHELL-006 @spec:SHELL-007 @spec:SHELL-009
  Scenario: A world route shows world and competition links with router-derived active state
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    When the player opens the League route for GameWorld 1 and league 7
    Then the rail shows WORLD linked to "/1"
    And the rail shows a competition link to "/1/7"
    And the competition link is active

  @spec:SHELL-007
  Scenario: A world without leagues renders no competition links
    Given GameWorld 1 has no leagues
    When the player opens the GameWorld route for GameWorld 1
    Then the rail shows WORLD linked to "/1"
    And the rail has no COMPETITIONS section

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

  @spec:SHELL-008
  Scenario: Active league highlighting survives a GameWorld refresh
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    When the player opens the League route for GameWorld 1 and league 7
    And the GameWorld refreshes
    Then the competition link is active

  @spec:SHELL-010
  Scenario: Navigation lives in the rail rather than page-local headers
    Given GameWorld 1 is named "Test World" with league 7 named "Premier"
    When the player opens the GameWorld route for GameWorld 1
    Then no page-local app header or breadcrumb is rendered
