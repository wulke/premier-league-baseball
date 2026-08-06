Feature: Player Detail UI

  A player detail page at the top-level route `/:gwId/player/:playerId` with a persistent identity
  masthead and an FM-style page tab bar — Overview, Positions, and Pitch repertoire (the last shown
  only for pitchers). Overview is the current-state snapshot (flat-7 tinted ratings + a contract
  block + a deferred Career & accomplishments hook); Positions owns all position-affinity viz via a
  view-switcher (field diagram default); the Pitch repertoire tab shows 4-pitch cards for pitchers.
  The top-level route forward-proofs free agents, who render with a "Free Agent" chip in place of a
  team link. No stored or computed OVR; a display-only OVR toggle is client-side only.

  Background:
    Given GameWorld 1 exists
    And Player 100 "Marcus Velandez" is a Pitcher belonging to GameWorld 1

  # ─── Page Structure ─────────────────────────────────────────────────────────

  @spec:PDETUI-006
  Scenario: The page renders a persistent masthead and a page-level tab bar
    Given GET /api/player/100 returns Player 100's detail with a current Contract
    When the player navigates to "/1/player/100"
    Then the page shows the identity masthead with Player 100's name
    And the page shows an Overview tab
    And the page shows a Positions tab
    And the page shows a Pitch repertoire tab

  # ─── Overview Tab ───────────────────────────────────────────────────────────

  @spec:PDETUI-008
  Scenario: Overview shows flat-7 tinted ratings, a contract block, and the deferred career hook
    Given GET /api/player/100 returns Player 100's detail with a current Contract
    When the player navigates to "/1/player/100"
    And the player selects the Overview tab
    Then the Overview shows the flat-7 tinted ratings
    And the Overview shows a contract block with the team and term
    And the Overview shows a Career & accomplishments hook

  # ─── Positions Tab ──────────────────────────────────────────────────────────

  @spec:PDETUI-007
  Scenario: The Positions tab offers a view-switcher over the 9-key positions map
    Given GET /api/player/100 returns Player 100's detail with the full positions map
    When the player navigates to "/1/player/100"
    And the player selects the Positions tab
    Then the Positions tab shows a view-switcher with field diagram, bar grid, and coverage pills options
    And the field diagram is shown by default

  @spec:PDETUI-004
  Scenario: The Positions view-switcher defaults to field diagram and is not URL-encoded
    Given GET /api/player/100 returns Player 100's detail
    When the player navigates to "/1/player/100"
    And the player selects the Positions tab
    And the player selects the bar grid view
    And the player reloads the page
    Then the Positions tab is shown with the field diagram by default
    And the URL does not encode the sub-view

  # ─── Pitch Repertoire Tab (Pitchers Only) ───────────────────────────────────

  @spec:PDETUI-009
  Scenario: A pitcher's Pitch repertoire tab shows the 4-pitch cards
    Given GET /api/player/100 returns Player 100's detail as a Pitcher with four pitches
    When the player navigates to "/1/player/100"
    And the player selects the Pitch repertoire tab
    Then the tab shows four pitch cards each with VEL, CTL, and SPN

  @spec:PDETUI-003
  Scenario: A non-pitcher's Pitch repertoire tab is omitted entirely
    Given GET /api/player/101 returns Player 101's detail as a Shortstop
    When the player navigates to "/1/player/101"
    Then the page shows an Overview tab
    And the page shows a Positions tab
    And the page does not show a Pitch repertoire tab

  # ─── Free Agent ─────────────────────────────────────────────────────────────

  @spec:PDETUI-002
  Scenario: A free agent renders a Free Agent chip and the Positions and Pitch tabs normally
    Given GET /api/player/102 returns Player 102's detail as a free agent Pitcher with contract null
    When the player navigates to "/1/player/102"
    Then the masthead shows a Free Agent chip in place of a team link
    And the page shows a Positions tab
    And the page shows a Pitch repertoire tab

  # ─── Not Found ──────────────────────────────────────────────────────────────

  @spec:PDETUI-001
  Scenario: A failed or not-found player fetch renders a not-found state
    Given GET /api/player/9999 fails
    When the player navigates to "/1/player/9999"
    Then the page renders a not-found state
    And the masthead is not partially rendered

  # ─── Deferred Career Block ──────────────────────────────────────────────────

  @spec:PDETUI-005
  Scenario: The Career & accomplishments hook renders a deferred-state message, not an empty section
    Given GET /api/player/100 returns Player 100's detail
    When the player navigates to "/1/player/100"
    And the player selects the Overview tab
    Then the Career & accomplishments hook explains what will graduate in
    And it is not rendered as an empty data section
