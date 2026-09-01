Feature: Active Lineup Write API

  Managers submit a complete replacement for the active lineup template. The server validates the
  proposed card before it atomically replaces its entries, leaving per-game snapshots untouched.

  Background:
    Given Team 10 has a valid active lineup

  @spec:LWRITE-001
  Scenario: A valid complete active lineup replaces the template
    When the client saves a valid active lineup with a bench player in a starter slot
    Then the active lineup persists the submitted slot assignments

  @spec:LWRITE-002
  Scenario: An invalid active lineup does not partially replace the template
    When the client saves an invalid active lineup with a duplicate player
    Then the lineup save is rejected as invalid
    And the stored active lineup remains unchanged
