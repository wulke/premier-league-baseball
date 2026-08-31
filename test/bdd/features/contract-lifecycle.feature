Feature: Contract Lifecycle (Sign / Release / Renew)

  The roster-mutating write surface: sign a free agent, release a player, or renew an
  existing contract. Every mutation is effective as of GameWorld.currentDate — never a
  client-supplied date — and writes the Contract row, Player.teamId, and the active
  Lineup atomically. At most one Contract per player may cover any given date. A
  League's cutover() also runs a GameWorld-wide reconcile sweep correcting any
  Player.teamId left stale by natural contract expiry. Writes are gated to the
  GameWorld's managed team, unless DEV_MODE bypasses identity checking.

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And GameWorld 1's currentDate is "2025-06-01"
    And GameWorld 1's managed club is Team 10
    And Team 10 belongs to GameWorld 1
    And Team 11 belongs to GameWorld 1
    And Team 10 has a roster of generated Players with identity and Contracts

  # ─── Effective-Dating Guard ─────────────────────────────────────────────────

  @spec:XFER-001
  Scenario: Every transfer mutation is rejected when the GameWorld has no currentDate
    Given GameWorld 1's currentDate is unset
    And Player 100 is a free agent in GameWorld 1
    When Team 10 signs Player 100
    Then the response is a 422 error
    And Player 100 is still a free agent

  # ─── Sign ────────────────────────────────────────────────────────────────────

  @spec:XFER-002
  Scenario: Signing a Player that does not exist
    When Team 10 signs Player 9999
    Then the response indicates the Player was not found

  @spec:XFER-002
  Scenario: Signing a Player belonging to a different GameWorld
    Given Player 200 belongs to GameWorld 2
    When Team 10 signs Player 200
    Then the response indicates the Player was not found

  @spec:XFER-003
  Scenario: Signing a Player who already has a contract covering the current date
    Given Player 100 has a Contract with Team 11 covering "2025-06-01"
    When Team 10 signs Player 100
    Then the response is a 422 error
    And Player 100's contract with Team 11 is unchanged

  @spec:XFER-012 @spec:XFER-013
  Scenario: Signing a free agent creates a Contract and updates team membership
    Given Player 100 is a free agent in GameWorld 1
    When Team 10 signs Player 100
    Then the response is 200 with a Contract starting "2025-06-01"
    And Player 100's teamId is Team 10
    And Team 10's active Lineup includes Player 100

  @spec:XFER-007
  Scenario: Signing with an explicit endDate before the effective date
    Given Player 100 is a free agent in GameWorld 1
    When Team 10 signs Player 100 with endDate "2025-01-01"
    Then the response is a 422 error
    And Player 100 is still a free agent

  # ─── Release ─────────────────────────────────────────────────────────────────

  @spec:XFER-004
  Scenario: Releasing a Player the team does not currently hold
    Given Player 100 is a free agent in GameWorld 1
    When Team 10 releases Player 100
    Then the response is a 422 error

  @spec:XFER-014 @spec:XFER-017
  Scenario: Releasing a Player closes the contract early and frees the roster slot
    Given Player 100 has a Contract with Team 10 starting "2025-03-01" and ending "2025-10-31"
    When Team 10 releases Player 100
    Then the response is 200
    And Player 100's Contract with Team 10 now ends "2025-05-31"
    And Player 100's teamId is null
    And Team 10's active Lineup no longer includes Player 100

  @spec:XFER-015
  Scenario: Releasing a Player discards that team's queued renewal
    Given Player 100 has a Contract with Team 10 covering "2025-06-01"
    And Player 100 has a renewed successor Contract with Team 10 starting "2025-11-01"
    When Team 10 releases Player 100
    Then the response is 200
    And Player 100 has no Contract with Team 10 starting after "2025-06-01"

  @spec:XFER-016
  Scenario: Releasing a Player leaves other teams' contract history untouched
    Given Player 100 has a Contract with Team 10 covering "2025-06-01"
    And Player 100 had a prior Contract with Team 11 that already ended
    When Team 10 releases Player 100
    Then the response is 200
    And Player 100's prior Contract with Team 11 is unchanged

  # ─── Renew ───────────────────────────────────────────────────────────────────

  @spec:XFER-005
  Scenario: Renewing a Player the team does not currently hold
    Given Player 100 is a free agent in GameWorld 1
    When Team 10 renews Player 100
    Then the response is a 422 error

  @spec:XFER-005
  Scenario: Renewing before the current contract is close to expiry is allowed
    Given Player 100 has a Contract with Team 10 starting "2025-03-01" and ending "2025-10-31"
    When Team 10 renews Player 100
    Then the response is 200
    And Player 100's current Contract with Team 10 is unchanged

  @spec:XFER-018 @spec:XFER-019
  Scenario: Renewing mints a successor contract without touching team membership
    Given Player 100 has a Contract with Team 10 starting "2025-03-01" and ending "2025-10-31"
    When Team 10 renews Player 100
    Then the response is 200 with a successor Contract starting "2025-11-01"
    And Player 100's teamId is still Team 10
    And Team 10's active Lineup is unchanged

  @spec:XFER-006
  Scenario: Renewing is rejected when a contract already covers the successor start date
    Given Player 100 has a Contract with Team 10 starting "2025-03-01" and ending "2025-10-31"
    And Player 100 already has a successor Contract with Team 10 starting "2025-11-01"
    When Team 10 renews Player 100
    Then the response is a 422 error

  @spec:XFER-007
  Scenario: Renewing with an explicit endDate before the successor start date
    Given Player 100 has a Contract with Team 10 starting "2025-03-01" and ending "2025-10-31"
    When Team 10 renews Player 100 with endDate "2025-11-01"
    Then the response is a 422 error

  # ─── SEASON_END Default Anchor ──────────────────────────────────────────────

  @spec:XFER-020
  Scenario: A mid-season sign defaults its term to October 31 of the current season-year
    Given Player 100 is a free agent in GameWorld 1
    When Team 10 signs Player 100
    Then the response is 200 with a Contract ending "2025-10-31"

  @spec:XFER-020
  Scenario: A November-onward sign defaults its term to next season's October 31
    Given GameWorld 1's currentDate is "2025-11-15"
    And Player 100 is a free agent in GameWorld 1
    When Team 10 signs Player 100
    Then the response is 200 with a Contract ending "2026-10-31"

  # ─── Cutover Reconcile Sweep ─────────────────────────────────────────────────

  @spec:XFER-008
  Scenario: League cutover corrects a stale Player.teamId left by natural contract expiry
    Given Player 100 has a Contract with Team 10 that has already ended, with no successor
    And Player 100's teamId is still Team 10
    And League "MLS" is IN_SEASON in GameWorld 1 with a complete season
    When an admin cuts over League "MLS"
    Then the response is 200
    And Player 100's teamId is null

  # ─── Authorization Seam ──────────────────────────────────────────────────────

  @spec:XFER-010
  Scenario: A team that is not the managed club cannot sign a Player
    Given GameWorld 1's managed club is Team 10
    And Player 100 is a free agent in GameWorld 1
    When Team 11 signs Player 100
    Then the response is a 422 error
    And Player 100 is still a free agent

  @spec:XFER-010
  Scenario: DEV_MODE bypasses the managed-club check but not the mutation invariants
    Given DEV_MODE is enabled
    And GameWorld 1's managed club is Team 10
    And Player 100 has a Contract with Team 11 covering "2025-06-01"
    When Team 10 signs Player 100
    Then the response is a 422 error
    And Player 100's contract with Team 11 is unchanged

  # ─── Lineup Repair Failure ───────────────────────────────────────────────────

  @spec:XFER-011
  Scenario: A release that leaves too few fielders to repair the Lineup rolls back entirely
    Given Team 10's roster has too few Players to fill every fielding position
    And Player 100 has a Contract with Team 10 covering "2025-06-01"
    When Team 10 releases Player 100
    Then the response is a 500 error
    And Player 100's Contract with Team 10 is unchanged
    And Player 100's teamId is still Team 10

  # ─── Free-Agent Listing ──────────────────────────────────────────────────────

  @spec:XFER-009
  Scenario: Listing free agents for a GameWorld that does not exist
    When the player requests free agents for GameWorld 9999
    Then the response indicates the GameWorld was not found

  @spec:XFER-023
  Scenario: Listing free agents returns Players with no Contract covering the current date
    Given Player 100 is a free agent in GameWorld 1
    And Player 200 has a Contract with Team 10 covering "2025-06-01"
    When the player requests free agents for GameWorld 1
    Then the response includes Player 100
    And the response does not include Player 200
    And Player 100's row carries the same shape as a roster row

  # ─── Roster Current-Membership Filter ───────────────────────────────────────

  @spec:XFER-022
  Scenario: A team's roster shows a Player's current Contract, not their full history
    Given Player 100 had a Contract with Team 10 that already ended
    And Player 100 has since been signed to a new current Contract with Team 10
    When the player requests the roster for Team 10
    Then Player 100 appears exactly once in the roster
    And Player 100's row reflects the current Contract, not the ended one

  # ─── Not Gherkin-Routed: SEASON_END constant reuse (XFER-021) ───────────────
  # No scenario: XFER-021 is an internal refactor (generateRoster() reusing the
  # same SEASON_END_MONTH/DAY constants Sign/Renew derive from) with no observably
  # different behavior from the pre-existing hardcoded Oct 31 term. Verified by
  # test/db/domain/player.test.ts and test/db/domain/contract.test.ts, not Gherkin.
