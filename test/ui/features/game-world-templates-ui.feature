Feature: Game-world template picker (pickable old Champions League)

  The home create-world form offers a template selector over the pickable worlds, so a
  player can create an old Champions League world (group stage → two-leg knockout) alongside
  the existing Premier League world. No new route or page is introduced.

  @spec:GWT-004
  Scenario: The create-world form offers both pickable templates
    Given the player opens the home create-world form
    Then the template selector lists "Premier League"
    And the template selector lists "Champions League"

  @spec:GWT-004
  Scenario: Selecting Champions League shows its bundle summary and submits that bundle
    Given the player opens the home create-world form
    When the player selects the "Champions League" template
    Then the summary shows "32 teams"
    And the summary lists the "Champions League" competition
    And the create-world request posts the Champions League bundle
