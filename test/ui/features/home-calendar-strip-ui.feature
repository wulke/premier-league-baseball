Feature: GameWorld Home Calendar Strip

  The GameWorld home page shows a rolling 7-day calendar strip anchored on the
  GameWorld's currentDate, fed by the managed club's cross-competition calendar
  (GET /api/team/:teamId/calendar). Every day renders a cell — even an empty one,
  visibly dim rather than omitted — and a day with more than one game (e.g. one
  per competition) stacks its entries. Prev/next pages the strip a week at a
  time, clamped so the player can never navigate to a window outside the club's
  season. This strip replaces the old per-league "Today" section entirely.

  Background:
    Given GameWorld 1 exists with an in-progress season and Team A as id 1

  # ─── Initial Fetch ───────────────────────────────────────────────────────────

  @spec:CALWUI-001
  Scenario: The home page fetches the calendar for a centered 7-day window
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    When the GameWorld 1 home page loads
    Then GET /api/team/1/calendar is requested with from "2025-06-07" and to "2025-06-13"

  # ─── Rendering ────────────────────────────────────────────────────────────────

  @spec:CALWUI-002
  Scenario: A returned game is mapped into a day entry keyed by game id and date
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns a game with id 42 scheduled on "2025-06-09"
    When the GameWorld 1 home page loads
    Then the calendar strip shows an entry for game 42 on "2025-06-09"

  @spec:CALWUI-003
  Scenario: A day with no games still renders as a visibly empty cell
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns no games
    When the GameWorld 1 home page loads
    Then the calendar strip shows exactly 7 day cells
    And every day cell is shown empty

  @spec:CALWUI-004
  Scenario: Two games on the same date both appear in that day's cell
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns a Premier League game and a League Cup game both scheduled on "2025-06-10"
    When the GameWorld 1 home page loads
    Then the "2025-06-10" day cell shows both games

  # ─── Navigation ───────────────────────────────────────────────────────────────

  @spec:CALWUI-005
  Scenario: Selecting next shifts the window forward by 7 days and re-fetches
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns season bounds "2025-01-01" to "2025-12-31"
    When the GameWorld 1 home page loads
    And the player selects next on the calendar strip
    Then GET /api/team/1/calendar is requested with from "2025-06-14" and to "2025-06-20"

  @spec:CALWUI-006
  Scenario: Next is disabled once the window reaches the season end
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns season bounds "2025-01-01" to "2025-06-13"
    When the GameWorld 1 home page loads
    Then the calendar strip's next control is disabled

  @spec:CALWUI-006
  Scenario: Both navigation controls are disabled when the team has no season bounds
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns null season bounds
    When the GameWorld 1 home page loads
    Then the calendar strip's prev control is disabled
    And the calendar strip's next control is disabled

  # ─── No currentDate Configured ────────────────────────────────────────────────

  @spec:CALWUI-007
  Scenario: The GameWorld has no currentDate configured
    Given GameWorld 1 has managedTeamId 1 and no currentDate configured
    When the GameWorld 1 home page loads
    Then no calendar strip is shown
    And GET /api/team/1/calendar is not requested

  # ─── Old "Today" Section Removed ─────────────────────────────────────────────

  @spec:CALWUI-008
  Scenario: The old per-league Today section is no longer present
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    When the GameWorld 1 home page loads
    Then no "Today" section heading is shown
    And GET /api/league/1/today is not requested
