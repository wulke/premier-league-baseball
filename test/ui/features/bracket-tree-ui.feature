Feature: League Cup bracket-tree UI

  The League page presents generated knockout rounds as a horizontal bracket tree.

  @spec:BRKT-001
  Scenario: A knockout without generated rounds retains its roster empty state
    Given the player opens the League Cup with no generated bracket rounds
    When the bracket tree League page renders
    Then the bracket tree shows the no-bracket empty state and TeamRoster
    And the bracket tree does not render a tree shell

  @spec:BRKT-002
  Scenario: Generated rounds stop at the first pending round
    Given the player opens the League Cup with a resolved quarterfinal and pending later rounds
    When the bracket tree League page renders
    Then the bracket tree renders only the "Quarterfinals" round column
    And the bracket tree shows "Next: Semifinals — games pending"
    And the bracket tree does not render a "Final" round column

  @spec:BRKT-002
  Scenario: A fully generated bracket renders every round without a pending card
    Given the player opens the League Cup with every round generated
    When the bracket tree League page renders
    Then the bracket tree renders the "Quarterfinals" and "Semifinals" round columns
    And the bracket tree does not show a pending-round card

  @spec:BRKT-003
  Scenario: A bye retains its tie slot in the round column
    Given the player opens the League Cup with a quarterfinal bye
    When the bracket tree League page renders
    Then the "Quarterfinals" column has a tie node "Chelsea vs Bye"
    And the bye tie node has the auto-advance outcome for "Chelsea"

  @spec:BRKT-004
  Scenario: A series expands from its aggregate summary to game rows
    Given the player opens the League Cup with a completed two-game quarterfinal series
    When the bracket tree League page renders
    Then the series node shows aggregate summary "Manchester City [2–1, 2–0] Leeds United ✓ Manchester City (2–0)"
    When the player expands the Manchester City series node
    Then the series node shows game row "Game 1: Manchester City 2–1 Leeds United"
    And the series node shows game row "Game 2: Leeds United 0–2 Manchester City"

  @spec:BRKT-005
  Scenario: A decided tie visually distinguishes its winner and loser
    Given the player opens the League Cup with a completed two-game quarterfinal series
    When the bracket tree League page renders
    Then the Manchester City team row has winner treatment
    And the Leeds United team row has loser treatment

  @spec:BRKT-006 @spec:BRKT-007
  Scenario: Response tie order supplies stable tree coordinates and connectors
    Given the player opens the League Cup with generated fixed-seeding rounds
    When the bracket tree League page renders
    Then quarterfinal tie node 0 connects to semifinal tie node 0
    And quarterfinal tie node 1 connects to semifinal tie node 0
    And expanding a series leaves its connector shell at the same coordinate

  @spec:BRKT-008
  Scenario: The tree scrolls horizontally while its stage-origin label remains above it
    Given the player opens the League Cup with generated fixed-seeding rounds
    When the bracket tree League page renders
    Then the bracket tree has horizontally scrollable round columns
    And the existing multi-stage origin-label scenario remains the regression coverage for the label
