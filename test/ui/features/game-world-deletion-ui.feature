Feature: GameWorld Deletion UI

  From the home page, the player can delete a GameWorld card by hovering it to reveal a
  delete ("[x]") icon, clicking it to open a confirmation modal, and confirming. Deletion
  is permanent, so the modal requires an explicit confirm click before anything happens,
  and any failure keeps the modal open with a retry option rather than silently losing
  the action.

  Background:
    Given the home page has loaded with GameWorld 1 named "National League 2024" in its list
    And the home page also lists GameWorld 2 named "American League 2023"

  # ─── Hover Affordance ───────────────────────────────────────────────────────

  @spec:GWDUI-001
  Scenario: Hovering a GameWorld card reveals its delete icon
    When the player hovers GameWorld 1's card
    Then a delete "[x]" icon is visible in the top-right corner of GameWorld 1's card
    And no delete icon is visible on GameWorld 2's card

  @spec:GWDUI-001
  Scenario: Moving the mouse off a card hides its delete icon
    Given the player is hovering GameWorld 1's card
    When the player moves the mouse off GameWorld 1's card
    Then the delete "[x]" icon is no longer visible on GameWorld 1's card

  # ─── Opening the Confirmation Modal ─────────────────────────────────────────

  @spec:GWDUI-002
  Scenario: Clicking the delete icon does not navigate into the GameWorld
    Given the player is hovering GameWorld 1's card
    When the player clicks GameWorld 1's delete icon
    Then the player is not navigated to GameWorld 1's page
    And a confirmation modal is shown

  @spec:GWDUI-003
  Scenario: The confirmation modal names the GameWorld and warns the action is permanent
    Given the player is hovering GameWorld 1's card
    When the player clicks GameWorld 1's delete icon
    Then the modal title includes "National League 2024"
    And the modal states the deletion is permanent
    And the modal shows "Delete" and "Cancel" buttons

  # ─── Cancel ──────────────────────────────────────────────────────────────────

  @spec:GWDUI-004
  Scenario: Cancelling the confirmation modal sends no request
    Given the delete confirmation modal is open for GameWorld 1
    When the player clicks "Cancel"
    Then the modal is closed
    And no DELETE request is sent
    And GameWorld 1 still appears in the list

  # ─── Confirm — Success ──────────────────────────────────────────────────────

  @spec:GWDUI-005
  Scenario: Confirming deletion removes the GameWorld from the list on success
    Given the delete confirmation modal is open for GameWorld 1
    When the player clicks "Delete"
    And DELETE /api/gameWorld/1 returns 200
    Then the modal is closed
    And GameWorld 1 no longer appears in the list
    And GameWorld 2 still appears in the list
    And GET /api/gameWorld is not requested again

  @spec:GWDUI-005
  Scenario: Deleting the only GameWorld falls back to the empty state
    Given GameWorld 1 is the only GameWorld in the list
    And the delete confirmation modal is open for GameWorld 1
    When the player clicks "Delete"
    And DELETE /api/gameWorld/1 returns 200
    Then the modal is closed
    And the "No game worlds yet." empty state is shown

  # ─── Confirm — Failure ──────────────────────────────────────────────────────

  @spec:GWDUI-006
  Scenario: A failed deletion keeps the modal open with an error and retry option
    Given the delete confirmation modal is open for GameWorld 1
    When the player clicks "Delete"
    And DELETE /api/gameWorld/1 returns a server error
    Then the modal remains open
    And an error message is shown in the modal
    And "Retry" and "Cancel" buttons are shown
    And GameWorld 1 still appears in the list

  @spec:GWDUI-006
  Scenario: Retrying a failed deletion succeeds
    Given the delete confirmation modal is open for GameWorld 1 showing an error after a failed attempt
    When the player clicks "Retry"
    And DELETE /api/gameWorld/1 returns 200
    Then the modal is closed
    And GameWorld 1 no longer appears in the list

  # ─── In-Flight Submission ───────────────────────────────────────────────────

  @spec:GWDUI-007
  Scenario: Delete and Cancel are disabled while the request is in flight
    Given the delete confirmation modal is open for GameWorld 1
    When the player clicks "Delete"
    And the DELETE request has not yet resolved
    Then the "Delete" button is disabled
    And the "Cancel" button is disabled
