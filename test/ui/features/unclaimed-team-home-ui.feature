Feature: Unclaimed-Team Game World Home

  A GameWorld without a managed club directs the player to the existing Job Market
  claim flow instead of showing manager-only calendar and action-items content.

  @spec:UNCLMUI-001 @spec:UNCLMUI-002
  Scenario: An unclaimed world directs the player to choose a team
    Given GameWorld 1 has no managed team and Premier League competition 7
    When the player opens the GameWorld 1 home page
    Then one claim-a-team prompt is shown instead of the Calendar and Action Items sections
    And the prompt links to Premier League's team list for the existing Job Market claim flow

  @spec:UNCLMUI-003
  Scenario: A claimed world retains the manager home layout
    Given GameWorld 1 has managed team 10 and Premier League competition 7
    When the player opens the GameWorld 1 home page
    Then the claim-a-team prompt is not shown
    And the Calendar and Action Items sections are shown
