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

  @spec:LWRITE-003 @spec:LWRITE-002
  Scenario: A foreign player cannot be inserted into an active lineup
    Given Team 11 has an eligible player outside Team 10's active lineup
    When the client saves Team 10's active lineup with Team 11's player
    Then the lineup save is rejected as invalid
    And the stored active lineup remains unchanged

  @spec:LWRITE-003 @spec:LWRITE-002
  Scenario: An active lineup save cannot omit an existing reserve
    When the client saves Team 10's active lineup without a bench entry
    Then the lineup save is rejected as invalid
    And the stored active lineup remains unchanged
