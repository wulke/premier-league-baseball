Feature: Simulate Game

  # Executable first slice from docs/architecture/test-cases/simulate-game.feature
  Scenario: Game status transitions from SCHEDULED to COMPLETED after simulation
    Given a Game exists with status "SCHEDULED" and scheduledDate "2025-04-10"
    When the player simulates the game by id
    Then the game status is "COMPLETED"
    And the game status is no longer "SCHEDULED"
