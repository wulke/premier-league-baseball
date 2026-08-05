Feature: Managed club pointer

  A GameWorld remembers which of its own Teams the user manages. The ownership pointer is
  optional and mutable; it does not yet gate any other game action.

  Background:
    Given GameWorld 1 exists with no managed club
    And Team 11 belongs to GameWorld 1
    And GameWorld 2 exists with no managed club
    And Team 21 belongs to GameWorld 2

  @spec:MCLB-001 @spec:MCLB-002
  Scenario: Existing unclaimed GameWorld reads a null managed-club pointer
    When the client gets GameWorld 1
    Then the response is 200 with managedTeamId null

  @spec:MCLB-003 @spec:MCLB-002
  Scenario: Set a managed club belonging to the GameWorld and read it back
    When the client sets GameWorld 1's managed club to Team 11
    Then the response is 200 with managedTeamId 11
    When the client gets GameWorld 1
    Then the response is 200 with managedTeamId 11

  @spec:MCLB-004
  Scenario: Clear a managed club
    Given GameWorld 1 has Team 11 as its managed club
    When the client clears GameWorld 1's managed club
    Then the response is 200 with managedTeamId null

  @spec:MCLB-005
  Scenario: Reject a Team belonging to another GameWorld
    When the client sets GameWorld 1's managed club to Team 21
    Then the response is a 422 error
    And GameWorld 1 still has no managed club

  @spec:MCLB-005
  Scenario: Reject an unknown Team
    When the client sets GameWorld 1's managed club to Team 999
    Then the response is a 422 error
    And GameWorld 1 still has no managed club
