Feature: Wholesale active lineup save

  A manager replaces their editable active template with any valid selection from the current roster.

  @spec:LEDIT-001 @spec:LEDIT-003 @spec:LEDIT-004
  Scenario: A managed club saves a division-rule lineup before a season starts
    Given managed Team 10 has a DH-on division and an active lineup
    When the manager sends a PUT wholesale lineup save using another roster player
    Then the save returns the canonical TeamLineup card
    And the active Lineup row ID is unchanged
    And the active lineup persists the submitted entries

  @spec:LEDIT-002
  Scenario: A save for another club is not authorized
    Given managed Team 10 has a DH-on division and an active lineup
    When Team 11 attempts the wholesale lineup save
    Then the lineup save is rejected with 422
    And the stored active lineup remains unchanged

  @spec:LEDIT-002
  Scenario: Development mode bypasses the managed-club identity gate
    Given managed Team 10 has a DH-on division and an active lineup
    And Team 10 is not the managed club in development mode
    When the manager sends a PUT wholesale lineup save using another roster player
    Then the save returns the canonical TeamLineup card

  @spec:LEDIT-001
  Scenario: Unexpected entry fields cannot redirect a wholesale save
    Given managed Team 10 has a DH-on division and an active lineup
    And Team 11 has an empty active lineup
    When the manager sends a wholesale save with another lineup ID in an entry
    Then the save returns the canonical TeamLineup card
    And Team 11's active lineup remains unchanged

  @spec:LEDIT-003
  Scenario: A player from another roster is rejected semantically
    Given managed Team 10 has a DH-on division and an active lineup
    And Team 11 has a player outside Team 10's roster
    When the manager saves Team 10's lineup with Team 11's player
    Then the lineup save is rejected with 422
    And the rejection says "player is not on this team's roster"
    And the stored active lineup remains unchanged

  @spec:LEDIT-004
  Scenario Outline: Invalid wholesale cards never partially replace the active template
    Given managed Team 10 has a DH-on division and an active lineup
    When the manager saves a lineup with an invalid <shape>
    Then the lineup save is rejected with 422
    And the stored active lineup remains unchanged

    Examples:
      | shape |
      | duplicate player |
      | batting order |
      | position coverage |
      | DH pitcher slot |
      | bench cap |
      | bullpen cap |
