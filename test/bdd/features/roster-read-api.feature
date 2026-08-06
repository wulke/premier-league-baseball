Feature: Roster Read API

  A read-only endpoint (`GET /api/team/:teamId/roster`, optional `?gwId=`) returning a team's
  roster as a flat array of rows — identity, a derived primary position, and the flat-7 ratings
  verbatim, plus a derived position-coverage set. Anchors on the team's active Contracts
  (`Team → Contract → Player`), so `Contract` is the membership source-of-truth and
  `Player.teamId` is just a cache. Carries no stored or computed OVR. Rows return in `Player.id`
  order with no server-side sort or filter — that's the UI's job.

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And Team 10 belongs to GameWorld 1
    And Team 10 has a roster of generated Players with identity and Contracts

  # ─── Membership Source-of-Truth ─────────────────────────────────────────────

  @spec:ROST-007
  Scenario: A roster is returned anchored on the team's active Contracts
    When the player requests the roster for Team 10
    Then the response is a flat array of roster rows
    And each row corresponds to a Player on one of Team 10's Contracts

  # ─── Row Shape ──────────────────────────────────────────────────────────────

  @spec:ROST-008
  Scenario: A roster row carries identity, derived primaryPosition, and the flat-7 ratings — no OVR
    When the player requests the roster for Team 10
    Then each row includes identity fields
    And each row includes a derived primaryPosition
    And each row includes the flat-7 ratings verbatim
    And no row includes a stored or computed OVR

  @spec:ROST-009
  Scenario: positionCoverage is the set of positions meeting the threshold, primary always included
    Given a Player whose positions map has two positions at or above the threshold and a lower-rated primary
    When the player requests the roster for Team 10
    Then that Player's row includes a positionCoverage containing both above-threshold positions
    And the primaryPosition is always present in positionCoverage

  @spec:ROST-010
  Scenario: Rows return in Player.id order with no server-side sort or filter
    Given Team 10's Players were created in a known id order
    When the player requests the roster for Team 10
    Then the rows are returned in Player.id order

  # ─── Not Found & Cross-World Guard ──────────────────────────────────────────

  @spec:ROST-001
  Scenario: Requesting the roster for a Team that does not exist
    When the player requests the roster for Team 9999
    Then the response indicates the Team was not found

  @spec:ROST-002
  Scenario: Providing ?gwId= for a Team in a different GameWorld
    Given Team 10 belongs to GameWorld 1
    When the player requests the roster for Team 10 with ?gwId=2
    Then the response indicates the Team was not found

  # ─── Empty Roster ───────────────────────────────────────────────────────────

  @spec:ROST-003
  Scenario: A Team with zero active Contracts returns an empty array
    Given Team 11 belongs to GameWorld 1 with no roster
    When the player requests the roster for Team 11
    Then the response is an empty array

  # ─── Primary Position Tie-Break ─────────────────────────────────────────────

  @spec:ROST-005
  Scenario: A tie for the highest-rated position is broken by first-listed enum order
    Given a Player whose positions map has Shortstop and ThirdBase tied for the highest rating
    When the player requests the roster for Team 10
    Then that Player's derived primaryPosition is the first-listed of the tied positions in enum order

  # ─── Deferred: active-contract filter (ROST-004, → #140) ────────────────────
  # No scenario in v1: only one Contract per Player is ever written, so the
  # startDate/endDate active-filter is a deliberate gap owned by the transfers map.
  # When #140 lands, add a scenario asserting duplicate rows are collapsed to the
  # currently-active Contract.

  # ─── Deferred: coverage-threshold calibration (ROST-006, → #136) ─────────────
  # No scenario in v1: the ≥70 threshold is a placeholder; analytical calibration
  # of "covers a position" is engine/generation work.
