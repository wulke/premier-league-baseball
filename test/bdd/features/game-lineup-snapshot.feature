Feature: Per-game lineup snapshot

  The simulator freezes a team's active lineup into a per-game input so later template edits
  cannot affect a game that has already been prepared.

  Background:
    Given GameWorld 1 exists for game lineup snapshots
    And Team 10 in GameWorld 1 has an active lineup for snapshots

  @spec:LSNAP-001 @spec:LSNAP-004
  Scenario: A snapshot round-trips as the per-game lineup while active reads remain active
    When Team 10 snapshots its lineup for Game 40
    And the client reads Team 10's lineup for Game 40
    Then the per-game lineup equals the active lineup at snapshot time
    When the client reads Team 10's active lineup
    Then the active lineup is returned

  @spec:LSNAP-002
  Scenario: A per-game snapshot remains isolated from later active-lineup edits
    When Team 10 snapshots its lineup for Game 41
    And Team 10's active lineup is edited after the snapshot
    And the client reads Team 10's lineup for Game 41
    Then the per-game lineup equals the active lineup at snapshot time

  @spec:LSNAP-003
  Scenario: Snapshotting a game with an existing per-game lineup does not overwrite it
    Given Team 10 has an existing per-game override lineup for Game 42
    When Team 10 snapshots its lineup for Game 42
    Then the existing per-game lineup for Game 42 is unchanged

  @spec:LSNAP-004
  Scenario: A missing per-game lineup signals not found
    When the client reads Team 10's lineup for Game 43
    Then the game lineup response indicates the lineup was not found

  @spec:LSNAP-005
  Scenario: A snapshot cannot target a missing Game
    When Team 10 attempts to snapshot missing Game 44
    Then the snapshot response indicates the Game was not found

  @spec:LEDIT-008
  Scenario: An invalid active lineup cannot be frozen for the next game
    Given Team 10's active lineup has a player no longer on its roster
    When the client requests Team 10's next-game lineup for Game 45
    Then the snapshot response is rejected with 422
    And no per-game lineup exists for Game 45
