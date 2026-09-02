Feature: Next-game bullpen designations

  A manager prepares only the team's next scheduled game using its frozen per-game lineup.

  Background:
    Given GameWorld 1 has a team with a valid active lineup for bullpen designations

  @spec:GBULL-001 @spec:GBULL-002
  Scenario: The earliest scheduled game materializes its lineup
    Given Team 10 has scheduled games 40 and 41 in date order
    When the client reads Team 10's next-game lineup
    Then Game 40 is returned with a per-game lineup snapshot

  @spec:GBULL-001
  Scenario: No scheduled game has no next-game lineup
    When the client reads Team 10's next-game lineup
    Then no next-game lineup is returned

  @spec:GBULL-003
  Scenario: A valid scheduled-game bullpen save persists
    Given Team 10 has scheduled Game 40
    When the client saves a valid changed lineup for Game 40
    Then Game 40's saved lineup contains the changed starter

  @spec:GBULL-004
  Scenario: An invalid game lineup does not partially save
    Given Team 10 has scheduled Game 40
    When the client saves an invalid lineup for Game 40
    Then the save is rejected and Game 40's snapshot is unchanged

  @spec:GBULL-005
  Scenario: A started game lineup is locked
    Given Team 10 has an IN_PROGRESS Game 40
    When the client saves a valid changed lineup for Game 40
    Then the save is rejected and Game 40's snapshot is unchanged
