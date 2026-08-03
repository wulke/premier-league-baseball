Feature: Rapid Simulate Season

  An admin/dev-only tool fast-forwards an entire GameWorld's remaining season by
  repeatedly simulating every eligible game at the current date, then advancing the
  GameWorld's currentDate to the next date with unplayed games, until nothing scheduled
  remains. It reuses the existing batch-simulate behavior unchanged and never triggers
  season rollover. If a non-completed game blocks a date from ever resolving, it stops
  and reports the blockage rather than looping forever — but everything simulated before
  that point stays committed.

  Background:
    Given a GameWorld exists with id 1, year 2025, config.inProgress true, and currentDate "2025-04-01"
    And a League, Division, and DivisionSeason exist in GameWorld 1
    And a home team and away team exist in GameWorld 1

  # ─── Preconditions ──────────────────────────────────────────────────────────

  @spec:RSS-001
  Scenario: Attempt to rapid-simulate a GameWorld that does not exist
    When an admin rapid-simulates GameWorld 9999
    Then the response is a 404 error
    And the error indicates the GameWorld was not found

  @spec:RSS-002
  Scenario: Attempt to rapid-simulate a GameWorld with no active season
    Given GameWorld 1's config.inProgress is false
    When an admin rapid-simulates GameWorld 1
    Then the response is a 422 error
    And no Game in GameWorld 1 is simulated

  @spec:RSS-002
  Scenario: Attempt to rapid-simulate a GameWorld with no currentDate configured
    Given GameWorld 1's currentDate is not set
    When an admin rapid-simulates GameWorld 1
    Then the response is a 422 error
    And no Game in GameWorld 1 is simulated

  # ─── Happy Path ─────────────────────────────────────────────────────────────

  @spec:RSS-003
  @spec:RSS-006
  Scenario: Rapid-simulating a season completes every remaining scheduled game
    Given GameWorld 1's DivisionSeason has Games scheduled on "2025-04-01", "2025-04-08", and "2025-04-15"
    When an admin rapid-simulates GameWorld 1
    Then the response is 200
    And every Game in GameWorld 1's DivisionSeason is COMPLETED
    And GameWorld 1's currentDate is "2025-04-15"
    And the response reports daysAdvanced 2
    And the response's simulated list includes all 3 games

  @spec:RSS-003
  Scenario: Games with no scheduledDate are simulated on the first pass
    Given GameWorld 1's DivisionSeason has a Game with no scheduledDate
    And GameWorld 1's DivisionSeason has a Game scheduled on "2025-04-08"
    When an admin rapid-simulates GameWorld 1
    Then the response is 200
    And the Game with no scheduledDate is COMPLETED
    And the Game scheduled on "2025-04-08" is COMPLETED

  @spec:RSS-006
  Scenario: Games already COMPLETED before rapid-simulate starts are reported as skipped, not re-simulated
    Given GameWorld 1's DivisionSeason has a COMPLETED Game scheduled on "2025-04-01"
    And GameWorld 1's DivisionSeason has a Game scheduled on "2025-04-08"
    When an admin rapid-simulates GameWorld 1
    Then the response is 200
    And the response's skipped list includes the already-completed game
    And the response's simulated list does not include the already-completed game

  # ─── Season Rollover Boundary ───────────────────────────────────────────────

  @spec:RSS-004
  Scenario: Rapid-simulating to the end of a season does not start a new one
    Given GameWorld 1's DivisionSeason has a single Game scheduled on "2025-04-01"
    When an admin rapid-simulates GameWorld 1
    Then the response is 200
    And GameWorld 1's year is still 2025
    And GameWorld 1's config.inProgress is still true

  # ─── Stuck Game ──────────────────────────────────────────────────────────────

  @spec:RSS-005
  Scenario: A stuck IN_PROGRESS game aborts the loop but keeps prior progress
    Given GameWorld 1's DivisionSeason has a Game scheduled on "2025-04-01"
    And GameWorld 1's DivisionSeason has an IN_PROGRESS Game scheduled on "2025-04-08"
    And GameWorld 1's DivisionSeason has a Game scheduled on "2025-04-15"
    When an admin rapid-simulates GameWorld 1
    Then the response is a 422 error
    And the error identifies "2025-04-08" as the blocking date
    And the Game scheduled on "2025-04-01" is COMPLETED
    And the Game scheduled on "2025-04-15" is still SCHEDULED
    And GameWorld 1's currentDate is "2025-04-08"

  # ─── Dev-Tools Gate ──────────────────────────────────────────────────────────

  @spec:RSS-007
  Scenario: The endpoint is unreachable when dev tools are disabled
    Given ENABLE_DEV_TOOLS is not set to "true"
    And GameWorld 1's DivisionSeason has a Game scheduled on "2025-04-01"
    When an admin rapid-simulates GameWorld 1
    Then the response is a 404 error
    And the Game scheduled on "2025-04-01" is still SCHEDULED

  # ─── currentDate Mutator ────────────────────────────────────────────────────

  @spec:RSS-008
  Scenario: advanceCurrentDate rejects a date that does not move currentDate forward
    Given GameWorld 1's currentDate is "2025-04-08"
    When an admin advances GameWorld 1's currentDate to "2025-04-01"
    Then the response is a 422 error
    And GameWorld 1's currentDate is still "2025-04-08"
