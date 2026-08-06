Feature: Team Hub & Roster View UI

  A team hub page at `/:gwId/team/:teamId` with a Calendar tab and a Roster tab (index redirects
  to Calendar, preserving the existing calendar URL). The Roster tab shows a flat roster table
  whose positions-coverage cell is the organizer — multi-position players surface all positions,
  primary bolded, secondaries dimmed — with seven tinted rating columns and no OVR. Sort and
  filter are client-side from data already in the response. Entry is a team click from the League
  standings; nothing is added to the nav rail (preserving the symmetric/no-My-Club boundary).

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  # ─── Entry & Routing ────────────────────────────────────────────────────────

  @spec:ROSTUI-001
  Scenario: Clicking a team in the League standings navigates to the team hub
    When the player clicks Team 10 in the League standings for GameWorld 1
    Then the browser navigates to "/1/team/10"

  @spec:ROSTUI-006
  Scenario: Navigating to the team hub with no tab redirects to the calendar
    When the player navigates to "/1/team/10"
    Then the browser is redirected to "/1/team/10/calendar"

  @spec:ROSTUI-007
  Scenario: The team hub offers Calendar and Roster tabs
    When the player navigates to "/1/team/10/roster"
    Then the page shows a Calendar tab
    And the page shows a Roster tab

  # ─── Roster Rendering ───────────────────────────────────────────────────────

  @spec:ROSTUI-008
  Scenario: The roster renders as a flat table with the positions-coverage cell as organizer
    Given GET /api/team/10/roster returns a multi-position Player covering Shortstop and ThirdBase
    When the player navigates to "/1/team/10/roster"
    Then the roster table shows that Player's row with both positions in the coverage cell
    And the primary position is bolded and the secondary is dimmed

  @spec:ROSTUI-009
  Scenario: Rating columns are seven tinted columns with no OVR
    Given GET /api/team/10/roster returns a Player with flat-7 ratings
    When the player navigates to "/1/team/10/roster"
    Then the roster table shows seven rating columns
    And the roster table shows no OVR column

  # ─── Client-Side Sort & Filter ──────────────────────────────────────────────

  @spec:ROSTUI-003
  Scenario: Sorting the roster is client-side with no refetch
    Given GET /api/team/10/roster returns several Players
    When the player navigates to "/1/team/10/roster"
    And the player sorts the roster by age
    Then the rows are reordered by age
    And no second GET /api/team/10/roster request is made

  # ─── Player Detail Link Origin ──────────────────────────────────────────────

  @spec:ROSTUI-004
  Scenario: Clicking a roster row's player name navigates to player detail
    Given GET /api/team/10/roster returns a Player with id 100
    When the player navigates to "/1/team/10/roster"
    And the player clicks that Player's name
    Then the browser navigates to "/1/player/100"

  # ─── Degrade to Empty ───────────────────────────────────────────────────────

  @spec:ROSTUI-002
  Scenario: A failed roster fetch degrades to an empty table
    Given GET /api/team/10/roster fails
    When the player navigates to "/1/team/10/roster"
    Then the roster table renders empty
    And no error message is shown

  @spec:ROSTUI-002
  Scenario: An empty roster renders an empty table with no message
    Given GET /api/team/10/roster returns no players
    When the player navigates to "/1/team/10/roster"
    Then the roster table renders empty
    And no "no players" message is shown

  # ─── Nav Rail Untouched ─────────────────────────────────────────────────────

  @spec:ROSTUI-005
  Scenario: No roster or team item is added to the nav rail
    When the player navigates to "/1/team/10/roster"
    Then the nav rail shows no roster entry
    And the nav rail shows no team entry
