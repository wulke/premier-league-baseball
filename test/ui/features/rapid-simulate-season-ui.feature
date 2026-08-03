Feature: Rapid Simulate Season UI

  Inside AppHeader, a dev-only "Rapid Simulate Season" control sits alongside the
  player-facing "Simulate Today" control. It only appears when the server reports dev
  tools are enabled, and it is visually distinguished so it never reads as a normal
  player action. Submitting it fast-forwards the whole season in one request; the two
  simulate controls lock each other while either is in flight so they can never race.

  # ─── Visibility ──────────────────────────────────────────────────────────────

  @spec:RSSUI-001
  Scenario: The control appears when dev tools are enabled
    Then the "Rapid Simulate Season" control is visible
    And it is visually distinguished from the "Simulate Today" control

  @spec:RSSUI-002
  Scenario: The control does not appear when dev tools are disabled
    Given GameWorld 1's devToolsEnabled is false
    Then the "Rapid Simulate Season" control is not visible

  @spec:RSSUI-002
  Scenario: The control does not appear when devToolsEnabled is missing from the response
    Given GameWorld 1's response has no devToolsEnabled field
    Then the "Rapid Simulate Season" control is not visible

  @spec:RSSUI-002
  Scenario: The control does not appear before a season has started
    Given GameWorld 1's config.inProgress is false
    Then the "Rapid Simulate Season" control is not visible

  # ─── Submitting ─────────────────────────────────────────────────────────────

  @spec:RSSUI-003
  Scenario: Clicking the control shows a submitting state
    When the player clicks "Rapid Simulate Season"
    Then the "Rapid Simulate Season" control is disabled
    And it shows a submitting state

  # ─── Success ────────────────────────────────────────────────────────────────

  @spec:RSSUI-004
  Scenario: A successful rapid simulation shows a summary and refreshes the GameWorld
    When the player clicks "Rapid Simulate Season"
    And POST /api/gameWorld/1/rapid-simulate returns 200 with daysAdvanced 4, 12 simulated, and 1 skipped
    Then a summary showing "4" days advanced, "12" simulated, and "1" skipped is shown
    And the GameWorld context is refreshed

  # ─── Failure ────────────────────────────────────────────────────────────────

  @spec:RSSUI-005
  Scenario: A failed rapid simulation shows a persistent error with a retry option
    When the player clicks "Rapid Simulate Season"
    And POST /api/gameWorld/1/rapid-simulate returns a 422 error naming the blocking date
    Then an error region shows the blocking-date message
    And a "Retry" control is shown
    And the GameWorld context is not refreshed

  @spec:RSSUI-005
  Scenario: Retrying a failed rapid simulation succeeds
    Given the "Rapid Simulate Season" control shows an error after a failed attempt
    When the player clicks "Retry"
    And POST /api/gameWorld/1/rapid-simulate returns 200 with daysAdvanced 1, 3 simulated, and 0 skipped
    Then a summary showing "1" days advanced, "3" simulated, and "0" skipped is shown

  # ─── Cross-Control Locking ──────────────────────────────────────────────────

  @spec:RSSUI-006
  Scenario: Simulate Today is disabled while a rapid simulation is in flight
    When the player clicks "Rapid Simulate Season"
    And the rapid-simulate request has not yet resolved
    Then the "Simulate Today" control is disabled

  @spec:RSSUI-006
  Scenario: Rapid Simulate Season is disabled while a Simulate Today batch is in flight
    When the player clicks "Simulate Today"
    And the batch-simulate request has not yet resolved
    Then the "Rapid Simulate Season" control is disabled
