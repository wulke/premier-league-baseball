Feature: Multi-stage season UI surfacing

  The existing League screen lets a player follow an old Champions League season from
  group standings to a seeded knockout bracket and its champion without a new route.

  @spec:MSUI-001
  Scenario: Group-stage divisions render their existing standings tables
    Given the player opens the Champions League on the existing League route
    When the multi-stage League page renders before knockout advancement
    Then the "Group A" card shows the standings table
    And the "Group B" card shows the standings table

  @spec:MSUI-002
  Scenario: The bracket identifies its completed group-stage origin after advancement
    Given the player opens the Champions League on the existing League route
    When the multi-stage League page renders after group-stage advancement
    Then the "Knockout Stage" card shows "Seeded from completed Group Stage"
    And the "Knockout Stage" card shows round "Round of 16"

  @spec:MSUI-003
  Scenario: The knockout champion drives the existing champion banner
    Given the player opens the Champions League on the existing League route
    When the multi-stage League page renders with a knockout champion
    Then the League identity block shows "🏆 Cup Champion: Group A Winners · Final"
