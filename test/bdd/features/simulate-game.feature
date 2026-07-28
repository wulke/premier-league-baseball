Feature: Simulate Game

  The player can simulate one or more scheduled games, generating a random score for each
  game that is in SCHEDULED status and whose scheduled date is on or before the current
  GameWorld date. Unscheduled games (no scheduledDate) bypass the date guard and can
  always be simulated.

  Background:
    Given a GameWorld exists with id 1, year 2025, and currentDate "2025-04-10"
    And a home team and away team exist in GameWorld 1
    And a League, Division, and DivisionSeason exist in GameWorld 1 for year 2025

  # ─── Single Game — Happy Paths ────────────────────────────────────────────────

  @spec:SIM-001
  Scenario: Simulate a scheduled game on its scheduled date
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player simulates the game by id
    Then the response is 200 with the updated game
    And the game status is "COMPLETED"
    And homeTeamResult and awayTeamResult are non-null integers

  @spec:SIM-001
  Scenario: Simulate a scheduled game whose scheduled date is in the past (backfill)
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-05"
    When the player simulates the game by id
    Then the response is 200 with the updated game
    And the game status is "COMPLETED"
    And homeTeamResult and awayTeamResult are non-null integers

  @spec:SIM-007
  Scenario: Simulate an unscheduled game with no scheduledDate
    Given a Game exists with status "SCHEDULED" and no scheduledDate
    When the player simulates the game by id
    Then the response is 200 with the updated game
    And the game status is "COMPLETED"
    And homeTeamResult and awayTeamResult are non-null integers

  # ─── Single Game — Guard Failures ─────────────────────────────────────────────

  @spec:SIM-002
  Scenario: Attempt to simulate a game that does not exist
    When the player simulates a game with id 9999
    Then the response is a 4xx error
    And the error indicates the game was not found

  @spec:SIM-003
  Scenario: Attempt to simulate a game that is already completed
    Given a Game exists with status "COMPLETED", scheduledDate "2025-04-08", homeTeamResult 3, awayTeamResult 1
    When the player simulates the game by id
    Then the response is a 4xx error
    And the error indicates the game has already been completed
    And the game result is unchanged

  @spec:SIM-004
  Scenario: Attempt to simulate a game that is in progress
    Given a Game exists with status "IN_PROGRESS" and scheduledDate "2025-04-10"
    When the player simulates the game by id
    Then the response is a 4xx error
    And the error indicates the game cannot be simulated in its current status
    And the game status remains "IN_PROGRESS"

  @spec:SIM-005
  Scenario: Attempt to simulate a future-dated game
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-15"
    When the player simulates the game by id
    Then the response is a 4xx error
    And the error indicates the game is scheduled for a future date

  @spec:SIM-006
  Scenario: Attempt to simulate a dated game when GameWorld has no currentDate set
    Given the GameWorld currentDate is null
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player simulates the game by id
    Then the response is a 4xx error
    And the error indicates the GameWorld has no current date configured

  # ─── Batch Simulation — Happy Paths ───────────────────────────────────────────

  @spec:SIM-011
  Scenario: Simulate all games on the current date
    Given 3 Games exist with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And all 3 games are returned as simulated
    And each game has status "COMPLETED" with non-null homeTeamResult and awayTeamResult

  @spec:SIM-011
  Scenario: Simulate all games up to a specified endDate covering multiple days
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-07"
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-09"
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player triggers batch simulation for GameWorld 1 with endDate "2025-04-10"
    Then the response is 200
    And all 3 games are returned as simulated
    And each game has status "COMPLETED" with non-null homeTeamResult and awayTeamResult

  @spec:SIM-011
  Scenario: Batch simulation includes an unscheduled game alongside a dated game
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    And a Game exists with status "SCHEDULED" and no scheduledDate
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And both games are returned as simulated with status "COMPLETED"

  # ─── Batch Simulation — Skip Behaviour ────────────────────────────────────────

  @spec:SIM-012 @spec:SIM-013 @spec:SIM-014
  Scenario: Batch simulation skips non-simulatable games and returns all in response
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    And a Game exists with status "COMPLETED" and scheduledDate "2025-04-08"
    And a Game exists with status "SCHEDULED" and scheduledDate "2025-04-15"
    And a Game exists with status "IN_PROGRESS" and scheduledDate "2025-04-10"
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And 1 game is returned as simulated with status "COMPLETED"
    And 1 game is returned as skipped with reason "already completed"
    And 1 game is returned as skipped with reason "future date"
    And 1 game is returned as skipped with reason "game in progress"

  @spec:SIM-012
  Scenario: Batch simulation when all games in range are already completed
    Given 2 Games exist with status "COMPLETED" and scheduledDate "2025-04-10"
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And both games are returned as skipped with reason "already completed"
    And no games appear in the simulated list

  @spec:SIM-013
  Scenario: Batch simulation skips IN_PROGRESS games
    Given a Game exists with status "IN_PROGRESS" and scheduledDate "2025-04-10"
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And the game is returned as skipped with reason "game in progress"

  # ─── Batch Simulation — Boundary Conditions ───────────────────────────────────

  @spec:SIM-011
  Scenario: Batch simulation when no games exist for the date range
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is 200
    And the simulated list is empty
    And the skipped list is empty

  @spec:SIM-010
  Scenario: Batch simulation with endDate beyond GameWorld currentDate is rejected
    When the player triggers batch simulation for GameWorld 1 with endDate "2025-04-20"
    Then the response is a 4xx error
    And the error indicates the endDate exceeds the GameWorld's current date

  @spec:SIM-008
  Scenario: Batch simulation when GameWorld does not exist
    When the player triggers batch simulation for GameWorld 9999 with no endDate
    Then the response is a 4xx error
    And the error indicates the GameWorld was not found

  @spec:SIM-009
  Scenario: Batch simulation when GameWorld has no currentDate set and no endDate provided
    Given the GameWorld currentDate is null
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is a 4xx error
    And the error indicates the GameWorld has no current date configured

  # ─── Data Integrity ────────────────────────────────────────────────────────────

  @spec:SIM-015
  Scenario: Database error during batch simulation rolls back all updates
    Given 3 Games exist with status "SCHEDULED" and scheduledDate "2025-04-10"
    And a database error will occur mid-transaction
    When the player triggers batch simulation for GameWorld 1 with no endDate
    Then the response is a 500 error
    And all 3 games remain with status "SCHEDULED"
    And no homeTeamResult or awayTeamResult values are written

  @spec:SIM-003
  Scenario: Simulating the same single game twice returns an error on the second attempt
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    And the game has been simulated and now has status "COMPLETED" with homeTeamResult 4 and awayTeamResult 2
    When the player simulates the game by id again
    Then the response is a 4xx error
    And the game result remains homeTeamResult 4 and awayTeamResult 2

  # ─── Status Transitions ────────────────────────────────────────────────────────

  @spec:SIM-001
  Scenario: Game status transitions from SCHEDULED to COMPLETED after simulation
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player simulates the game by id
    Then the game status is "COMPLETED"
    And the game status is no longer "SCHEDULED"

  @spec:SIM-003
  Scenario: COMPLETED game retains its result after a failed re-simulation attempt
    Given a Game exists with status "COMPLETED", scheduledDate "2025-04-08", homeTeamResult 5, awayTeamResult 0
    When the player simulates the game by id
    Then the response is a 4xx error
    And homeTeamResult remains 5
    And awayTeamResult remains 0
    And the game status remains "COMPLETED"
