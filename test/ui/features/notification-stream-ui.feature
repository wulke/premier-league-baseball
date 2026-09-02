Feature: Notification Stream UI

  A minimal notification list mounted on the GameWorld page: backfilled on mount via
  `GET /api/gameWorld/:gwId/notifications`, then appended live as messages arrive over
  an `EventSource` to `GET /api/gameWorld/:gwId/notifications/stream`. Rows are filtered
  client-side to the GameWorld's managed team (world-wide rows, and rows scoped to the
  managed team, are shown; other teams' rows are not). This is the validation strip the
  HLD calls for, not a real inbox — no read/unread, no toast styling.

  Background:
    Given GameWorld 1 exists
    And GameWorld 1 has Team 10 "Manchester Mariners" as its managed club

  # ─── Backfill on Mount ──────────────────────────────────────────────────────

  @spec:NOTIFUI-001
  Scenario: Notifications backfill from the REST endpoint on mount
    Given GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 10
    When the player navigates to "/1"
    Then the notification list shows that GAME_RESULT row

  @spec:NOTIFUI-001
  Scenario: A failed backfill fetch degrades to an empty list
    Given GET /api/gameWorld/1/notifications fails
    When the player navigates to "/1"
    Then the notification list renders empty
    And no error message is shown

  # ─── Live Tail via SSE ──────────────────────────────────────────────────────

  @spec:NOTIFUI-002
  @spec:NOTIFUI-003
  Scenario: A live SSE message is appended to the notification list
    Given GET /api/gameWorld/1/notifications returns no rows
    And the player has navigated to "/1"
    When a GAME_RESULT notification scoped to Team 10 arrives over the SSE stream
    Then the notification list shows that GAME_RESULT row

  @spec:NOTIFUI-004
  Scenario: Navigating away from the GameWorld page closes the SSE connection
    Given the player has navigated to "/1"
    When the player navigates away from GameWorld 1
    Then the SSE connection to GameWorld 1's notification stream is closed

  # ─── Per-Team Filtering ─────────────────────────────────────────────────────

  @spec:NOTIFUI-005
  Scenario: A world-wide notification is shown regardless of the managed team
    Given GET /api/gameWorld/1/notifications returns a world-wide notification with no teamId
    When the player navigates to "/1"
    Then the notification list shows that notification

  @spec:NOTIFUI-005
  Scenario: A notification scoped to the managed team is shown
    Given GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 10
    When the player navigates to "/1"
    Then the notification list shows that GAME_RESULT row

  @spec:NOTIFUI-005
  Scenario: A notification scoped to a different team is not shown
    Given GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 20
    When the player navigates to "/1"
    Then the notification list does not show that row

  # ─── Unknown Type Fallback ──────────────────────────────────────────────────

  @spec:NOTIFUI-006
  Scenario: A notification of an unregistered type renders a raw fallback line
    Given GET /api/gameWorld/1/notifications returns a row of an unknown type "SEASON_COMPLETE"
    When the player navigates to "/1"
    Then the notification list shows a raw fallback line for that row

  # ─── Mount Point ────────────────────────────────────────────────────────────

  @spec:NOTIFUI-007
  Scenario: The notification list is mounted on the GameWorld page
    When the player navigates to "/1"
    Then the GameWorld page shows the notification list
