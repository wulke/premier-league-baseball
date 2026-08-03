Feature: League "Today" Snapshot API

  A read-only endpoint giving a rolling "last 3 days + next 3 days" window of games for a
  League — recent results and upcoming games — so a player can preview what a league's slate
  looks like without drilling into each division. COMPLETED games are windowed by their own
  scheduledDate; SCHEDULED/IN_PROGRESS games have no lower bound so overdue backlog is never
  silently hidden.

  Background:
    Given a GameWorld exists with id 1, year 2025, and currentDate "2025-06-10"
    And League 1 belongs to GameWorld 1 with one Division containing Team A and Team B

  # ─── Not Found ───────────────────────────────────────────────────────────────

  @spec:TODAY-001
  Scenario: Requesting the snapshot for a League that does not exist
    When the player requests today's snapshot for League 9999
    Then the response indicates the League was not found

  # ─── No currentDate Configured ───────────────────────────────────────────────

  @spec:TODAY-002
  Scenario: Requesting the snapshot when the GameWorld has no currentDate configured
    Given GameWorld 1's currentDate is null
    When the player requests today's snapshot for League 1
    Then the response is a 422 error
    And the error indicates the GameWorld has no current date configured

  # ─── Completed Games Window ──────────────────────────────────────────────────

  @spec:TODAY-003
  Scenario: A COMPLETED game within the last 3 days is included
    Given a COMPLETED game between Team A and Team B scheduled on "2025-06-08"
    When the player requests today's snapshot for League 1
    Then the response includes that game

  @spec:TODAY-003
  Scenario: A COMPLETED game older than 3 days is excluded
    Given a COMPLETED game between Team A and Team B scheduled on "2025-06-01"
    When the player requests today's snapshot for League 1
    Then the response does not include that game

  # ─── Upcoming / Backlog Games Window ─────────────────────────────────────────

  @spec:TODAY-004
  Scenario: A SCHEDULED game within the next 3 days is included
    Given a SCHEDULED game between Team A and Team B scheduled on "2025-06-12"
    When the player requests today's snapshot for League 1
    Then the response includes that game

  @spec:TODAY-004
  Scenario: A SCHEDULED game more than 3 days out is excluded
    Given a SCHEDULED game between Team A and Team B scheduled on "2025-06-20"
    When the player requests today's snapshot for League 1
    Then the response does not include that game

  @spec:TODAY-004
  Scenario: An overdue SCHEDULED game older than 3 days is still included
    Given a SCHEDULED game between Team A and Team B scheduled on "2025-05-20"
    When the player requests today's snapshot for League 1
    Then the response includes that game

  # ─── Sorting ──────────────────────────────────────────────────────────────────

  @spec:TODAY-005
  Scenario: Games in the response are sorted chronologically
    Given a SCHEDULED game between Team A and Team B scheduled on "2025-06-11"
    And a COMPLETED game between Team A and Team B scheduled on "2025-06-09"
    When the player requests today's snapshot for League 1
    Then the games are returned in ascending scheduledDate order

  # ─── Empty Cases ──────────────────────────────────────────────────────────────

  @spec:TODAY-006
  Scenario: A League with no Divisions returns an empty snapshot
    Given League 2 belongs to GameWorld 1 with no Divisions
    When the player requests today's snapshot for League 2
    Then the response is an empty array

  @spec:TODAY-006
  Scenario: A League whose games all fall outside the window returns an empty snapshot
    Given a COMPLETED game between Team A and Team B scheduled on "2025-01-01"
    When the player requests today's snapshot for League 1
    Then the response is an empty array

  # ─── Shape ────────────────────────────────────────────────────────────────────

  @spec:TODAY-007
  Scenario: A returned game is shaped as TeamSeasonGame with team names and division context
    Given a COMPLETED game between Team A and Team B scheduled on "2025-06-09"
    When the player requests today's snapshot for League 1
    Then the returned game includes gameId, scheduledDate, homeTeamId, homeTeamName, awayTeamId, awayTeamName, divisionId, divisionName, homeTeamResult, awayTeamResult, and status

  @spec:TODAY-007
  Scenario: A knockout bye game reports "Bye" as the away team
    Given League 1's Division uses a KNOCKOUT format
    And a SCHEDULED bye game for Team A with no away team scheduled on "2025-06-12"
    When the player requests today's snapshot for League 1
    Then the returned game's awayTeamName is "Bye"
    And the returned game's awayTeamId is null

  @spec:TODAY-007
  Scenario: The same game is not duplicated across both teams' DivisionSeason rows
    Given a COMPLETED game between Team A and Team B scheduled on "2025-06-09"
    When the player requests today's snapshot for League 1
    Then that game appears exactly once in the response
