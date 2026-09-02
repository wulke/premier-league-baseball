Feature: Notification Stream (Backend)

  Generic notification machinery: game occurrences a human watching a GameWorld cares
  about (starting with a completed game result) register as typed notification types,
  persist to a durable envelope (gameWorldId + optional teamId + type + JSON payload,
  no read state), and are readable via `GET /api/gameWorld/:gwId/notifications`
  (optionally `?since=<id>`) as a catch-up/backfill read. Live SSE delivery is a router/
  connection-management concern verified separately (see the no-Gherkin routing notes
  below), not exercised through the handler-level scenarios here.

  Background:
    Given a GameWorld exists with id 1
    And Team 10 "Manchester Mariners" belongs to GameWorld 1
    And Team 20 "Brooklyn Anchors" belongs to GameWorld 1

  # ─── Trigger: Game Completion ───────────────────────────────────────────────

  @spec:NOTIF-001
  Scenario: Completing a game fires a GAME_RESULT notification for each team
    Given a scheduled Game between Team 10 and Team 20 in GameWorld 1
    When the player simulates that Game
    Then a GAME_RESULT Notification row exists scoped to Team 10
    And a separate GAME_RESULT Notification row exists scoped to Team 20

  # ─── Catch-Up Read ──────────────────────────────────────────────────────────

  @spec:NOTIF-007
  Scenario: Listing notifications returns a raw array of notification rows
    Given a scheduled Game between Team 10 and Team 20 in GameWorld 1
    And the player has simulated that Game
    When the player requests notifications for GameWorld 1
    Then the response is a raw array of notification rows
    And each row includes gameWorldId, teamId, type, payload, and createdAt

  @spec:NOTIF-003
  Scenario: Listing notifications with no since= returns the full history
    Given a scheduled Game between Team 10 and Team 20 in GameWorld 1
    And the player has simulated that Game
    When the player requests notifications for GameWorld 1 with no since parameter
    Then the response includes both GAME_RESULT rows, ordered oldest first

  @spec:NOTIF-003
  Scenario: Listing notifications with since= returns only rows after that id
    Given a scheduled Game between Team 10 and Team 20 in GameWorld 1
    And the player has simulated that Game
    And the first Notification row's id is known
    When the player requests notifications for GameWorld 1 since that first row's id
    Then the response includes only the second GAME_RESULT row

  @spec:NOTIF-003
  Scenario: Listing notifications with a non-numeric since= returns no rows
    Given a scheduled Game between Team 10 and Team 20 in GameWorld 1
    And the player has simulated that Game
    When the player requests notifications for GameWorld 1 with a non-numeric since parameter
    Then the response is an empty array

  # ─── Empty & Not-Found Scoping ──────────────────────────────────────────────

  @spec:NOTIF-006
  Scenario: Listing notifications for a GameWorld with no notifications returns an empty array
    Given GameWorld 2 exists with no notifications
    When the player requests notifications for GameWorld 2
    Then the response is an empty array

  @spec:NOTIF-006
  Scenario: Listing notifications for a nonexistent GameWorld returns an empty array, not a 404
    When the player requests notifications for GameWorld 9999
    Then the response is an empty array

  # ─── No Gherkin: unit/domain-level behaviors ────────────────────────────────
  # NOTIF-002 (unregistered type → DomainError 400), NOTIF-004 (push to open SSE
  # connections, no-op when none open), NOTIF-005 (write failure logged & swallowed),
  # NOTIF-008 (SSE endpoint sets streaming headers + registers the connection),
  # NOTIF-009 (disconnect unsubscribes), NOTIF-010 (envelope shape / no read state),
  # NOTIF-011 (GAME_RESULT registered at module load) are SSE-connection-management
  # or pure-Factory invariants per backend-standards §4 — the BDD harness calls
  # handlers.* directly and has no real HTTP/streaming layer to exercise a live SSE
  # connection against. These bind to test/db/domain/notifications/notification.test.ts
  # instead, written alongside the implementation.
