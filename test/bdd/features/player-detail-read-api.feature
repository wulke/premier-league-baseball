Feature: Player Detail Read API

  A read-only endpoint (`GET /api/player/:playerId`, optional `?gwId=`) returning a single
  Player's full detail — identity, the complete `attributes` verbatim (flat-7 ratings + the
  9-key positions map + the pitches repertoire), and the Player's current Contract or `null`.
  The Player's team is reached *only* via `contract`; `Player.teamId`/`gameWorldId` are
  omitted. No stored or computed OVR is ever included. The current Contract is the row whose
  `[startDate, endDate]` window contains `GameWorld.currentDate` (falling back to `year` when
  `currentDate` is null); if none covers it, `contract` is `null` — the free-agent signal.

  Background:
    Given a GameWorld exists with id 1, year 2025, and currentDate "2025-06-10"
    And Player 100 belongs to GameWorld 1 with identity, attributes, and a current Contract

  # ─── Detail Shape ───────────────────────────────────────────────────────────

  @spec:PDET-010
  Scenario: The detail returns identity, full attributes verbatim, and the current Contract
    When the player requests the detail for Player 100
    Then the response includes the Player's identity fields
    And the response includes the full flat-7 ratings verbatim
    And the response includes the full 9-key positions map verbatim
    And the response includes the full pitches repertoire verbatim
    And the response includes the current Contract

  @spec:PDET-011
  Scenario: The detail carries no stored OVR and reaches the team via contract only
    When the player requests the detail for Player 100
    Then the response does not include a stored or computed OVR
    And the response does not include Player.teamId
    And the response does not include Player.gameWorldId
    And the team is reachable only via the contract field

  # ─── Not Found & Cross-World Guard ──────────────────────────────────────────

  @spec:PDET-001
  Scenario: Requesting the detail for a Player that does not exist
    When the player requests the detail for Player 9999
    Then the response indicates the Player was not found

  @spec:PDET-002
  Scenario: Providing ?gwId= for a Player in a different GameWorld
    Given Player 100 belongs to GameWorld 1
    When the player requests the detail for Player 100 with ?gwId=2
    Then the response indicates the Player was not found

  # ─── Current-Contract Resolution ────────────────────────────────────────────

  @spec:PDET-003
  Scenario: The current Contract is the row whose window contains GameWorld.currentDate
    Given Player 101 has a Contract spanning "2025-03-01" to "2025-10-31"
    When the player requests the detail for Player 101
    Then the response's contract has startDate "2025-03-01" and endDate "2025-10-31"

  @spec:PDET-003
  Scenario: The current Contract falls back to the GameWorld year when currentDate is null
    Given GameWorld 1's currentDate is null
    And Player 101 has a Contract spanning "2025-03-01" to "2025-10-31"
    When the player requests the detail for Player 101
    Then the response's contract has startDate "2025-03-01" and endDate "2025-10-31"

  # ─── Free Agent ─────────────────────────────────────────────────────────────

  @spec:PDET-004
  Scenario: No current Contract yields contract: null (the free-agent signal)
    Given Player 102 belongs to GameWorld 1 with no Contract covering "2025-06-10"
    When the player requests the detail for Player 102
    Then the response's contract is null

  @spec:PDET-007
  Scenario: A free agent is served unchanged with contract: null
    Given Player 103 is a free agent with teamId null
    When the player requests the detail for Player 103
    Then the response includes the Player's identity and full attributes
    And the response's contract is null
    And the response includes no flag, listing, or writes

  # ─── Primary Position Tie-Break ─────────────────────────────────────────────

  @spec:PDET-008
  Scenario: A tie for the highest-rated position is broken by first-listed enum order
    Given a Player whose positions map has Shortstop and ThirdBase tied for the highest rating
    When the player requests the detail for that Player
    Then the derived primaryPosition is the first-listed of the tied positions in enum order

  # ─── Schema Migration (PDET-009) ────────────────────────────────────────────
  # The Contract INT→DATE migration is enforced by schema-level tests (the model
  # defines DATE columns), not a player-facing flow — no Gherkin scenario here.
  # PDET-009 amends PCON-008; the PCON-008 row cascades to DATE when code lands.

  # ─── Deferred: preserved-DB backfill (PDET-005, → #140) ──────────────────────
  # No scenario: the dev database is dropped & recreated (#144); no backfill path.

  # ─── Deferred: overlap/gap tie-break (PDET-006, → #140) ──────────────────────
  # No scenario in v1: well-formed data self-resolves; overlap/gap prevention is
  # write-integrity owned by the transfers map.
