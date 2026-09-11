Feature: Transfers UI

  A world-scoped Transfers page listing free agents, with a Sign action that acts for
  the managed club (read-only market browsing without one). Release and Renew actions
  are added to the managed club's own roster rows. The nav rail's "Transfers" fog item
  becomes a live link once a club is claimed.

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  # ─── Nav Entry ───────────────────────────────────────────────────────────────

  @spec:XFERUI-001
  Scenario: Clicking Transfers in the nav rail navigates to the Transfers page
    Given GameWorld 1 has Team 10 as its managed club
    When the player clicks "Transfers" in the nav rail
    Then the browser navigates to "/1/transfers"

  @spec:XFERUI-006
  Scenario: Transfers stays dimmed in the nav rail with no managed club
    Given GameWorld 1 has no managed club
    When the player navigates to GameWorld 1
    Then the nav rail shows the dimmed "Transfers" item

  @spec:XFERUI-006
  Scenario: A direct visit to Transfers with no managed club still renders the market
    Given GameWorld 1 has no managed club
    And GET /api/gameWorld/1/free-agents returns a Player
    When the player navigates to "/1/transfers"
    Then the free-agent table shows that Player's row
    And no Sign action column is shown

  # ─── Free-Agent Market ───────────────────────────────────────────────────────

  @spec:XFERUI-002
  Scenario: The Transfers page renders the free-agent list
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/gameWorld/1/free-agents returns a Player with id 100
    When the player navigates to "/1/transfers"
    Then the free-agent table shows a row for Player 100

  @spec:XFERUI-007
  Scenario: Transfers retains the shared content width
    When the player navigates to "/1/transfers"
    Then the Transfers page uses the shared 960px content width

  @spec:XFERUI-002
  Scenario: An empty or failed free-agent fetch degrades to an empty table
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/gameWorld/1/free-agents fails
    When the player navigates to "/1/transfers"
    Then the free-agent table renders empty
    And no error message is shown

  # ─── Sign ────────────────────────────────────────────────────────────────────

  @spec:XFERUI-003
  Scenario: Signing a free agent refetches the list without a full reload
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/gameWorld/1/free-agents returns a Player with id 100
    When the player navigates to "/1/transfers"
    And the player clicks Sign on Player 100's row
    Then the client POSTs sign for Team 10 with playerId 100
    And the free-agent list is refetched without a full reload

  @spec:XFERUI-004
  Scenario: Signing a Player who was just signed by a race shows an inline message
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/gameWorld/1/free-agents returns a Player with id 100
    And POST transfers/sign for Team 10 with playerId 100 fails with 422
    When the player navigates to "/1/transfers"
    And the player clicks Sign on Player 100's row
    Then the page shows a "no longer available" message
    And the free-agent list is refetched

  # ─── Release / Renew Row Actions ─────────────────────────────────────────────

  @spec:XFERUI-005
  Scenario: The managed club's own roster rows show Release and Renew actions
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/roster returns a Player with id 200
    When the player navigates to "/1/team/10/roster"
    Then Player 200's row shows a Release action
    And Player 200's row shows a Renew action

  @spec:XFERUI-005
  Scenario: A non-managed team's roster rows show no transfer actions
    Given GameWorld 1 has Team 11 as its managed club
    And GET /api/team/10/roster returns a Player with id 200
    When the player navigates to "/1/team/10/roster"
    Then Player 200's row shows no Release action
    And Player 200's row shows no Renew action

  @spec:XFERUI-005
  Scenario: Releasing a Player from the managed club's roster refetches it
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/roster returns a Player with id 200
    When the player navigates to "/1/team/10/roster"
    And the player clicks Release on Player 200's row
    Then the client POSTs release for Team 10 with playerId 200
    And the team roster is refetched

  @spec:XFERUI-005
  Scenario: Renewing a Player from the managed club's roster refetches it
    Given GameWorld 1 has Team 10 as its managed club
    And GET /api/team/10/roster returns a Player with id 200
    When the player navigates to "/1/team/10/roster"
    And the player clicks Renew on Player 200's row
    Then the client POSTs renew for Team 10 with playerId 200
    And the team roster is refetched
