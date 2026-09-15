Feature: Home Calendar Strip — Cross-Competition Date-Range Query

  The team schedule read API (GET /api/team/:teamId/calendar) accepts an optional
  from/to date range and tags each returned game with its owning League, so the
  GameWorld home page can ask for one club's games across every competition it
  plays in within a given window. Season bounds (seasonStart/seasonEnd) are always
  returned, derived from the team's full current-year games regardless of any
  range applied, so a caller can clamp navigation without a second request.

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And GameWorld 2 exists with year 2025
    And League 1 belongs to GameWorld 1 with Division "D1" containing Team A and Team B
    And League 2 belongs to GameWorld 1 with Division "D2" containing Team A and Team B
    And League 3 belongs to GameWorld 2 with Division "D3" containing Team C

  # ─── No Range Supplied ───────────────────────────────────────────────────────

  @spec:CALW-001
  Scenario: Omitting a date range returns the full season with season bounds included
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-01"
    And a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-08-01"
    When the player requests Team A's calendar for GameWorld 1 without a date range
    Then the response includes both games
    And the response's seasonStart is "2025-06-01"
    And the response's seasonEnd is "2025-08-01"

  @spec:CALW-002
  Scenario: A team with no games this year has an empty calendar and null season bounds
    When the player requests Team C's calendar for GameWorld 1 without a date range
    Then the response's games array is empty
    And the response's seasonStart and seasonEnd are both null

  @spec:CALW-007
  Scenario: Supplying only one end of the range is treated as no range
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-01"
    And a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-08-01"
    When the player requests Team A's calendar for GameWorld 1 with only a "from" date of "2025-07-01"
    Then the response includes both games

  # ─── Competition Tagging ─────────────────────────────────────────────────────

  @spec:CALW-003
  Scenario: Each game is tagged with its owning League, not just its Division
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-05"
    And a COMPLETED game between Team A and Team B in Division "D2" scheduled on "2025-06-05"
    When the player requests Team A's calendar for GameWorld 1 without a date range
    Then the Division "D1" game is tagged with League 1's id and name
    And the Division "D2" game is tagged with League 2's id and name

  @spec:CALW-004
  Scenario: A knockout bye is preserved when a date range is applied
    Given Division "D1" uses a KNOCKOUT format
    And a SCHEDULED bye game for Team A with no away team in Division "D1" scheduled on "2025-06-12"
    When the player requests Team A's calendar for GameWorld 1 for the range "2025-06-10" to "2025-06-14"
    Then the bye game's awayTeamName is "Bye"
    And the bye game's awayTeamId is null

  # ─── Date-Range Filtering ────────────────────────────────────────────────────

  @spec:CALW-008
  Scenario: A date range filters the calendar to games within that inclusive window
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-05"
    And a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-15"
    When the player requests Team A's calendar for GameWorld 1 for the range "2025-06-01" to "2025-06-10"
    Then the response includes the game scheduled on "2025-06-05"
    And the response does not include the game scheduled on "2025-06-15"

  @spec:CALW-009
  Scenario: Season bounds reflect the full season even when a date range narrows the games returned
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-05"
    And a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-08-20"
    When the player requests Team A's calendar for GameWorld 1 for the range "2025-06-01" to "2025-06-10"
    Then the response includes only the game scheduled on "2025-06-05"
    And the response's seasonStart is "2025-06-05"
    And the response's seasonEnd is "2025-08-20"

  @spec:CALW-006
  Scenario: A reversed date range returns no games, with no special-cased error
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-05"
    When the player requests Team A's calendar for GameWorld 1 for the range "2025-08-01" to "2025-06-01"
    Then the response's games array is empty
    And the response is not an error

  @spec:CALW-005
  Scenario: A malformed date range does not raise a validation error
    Given a COMPLETED game between Team A and Team B in Division "D1" scheduled on "2025-06-05"
    When the player requests Team A's calendar for GameWorld 1 for the range "not-a-date" to "also-not-a-date"
    Then the response is not an error
    And the response's games array is empty
