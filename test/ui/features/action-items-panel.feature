Feature: Action Items Panel

  A scaffolded "Action Items" section on the GameWorld home page. No real
  action-item producer exists yet (no contracts, injuries, or training
  systems), so today the panel always renders empty — but as a "ready for
  content" state, not a "nothing to do" message, so the section visibly
  works while waiting for its first real item type. The rendering contract
  itself (severity ordering, optional linked CTA) is proven here ahead of
  any producer, so a future feature can register items without redesigning
  the panel.

  Background:
    Given GameWorld 1 exists with an in-progress season and Team A as id 1

  # ─── Placement & Empty State ─────────────────────────────────────────────────

  @spec:ACTUI-001
  Scenario: The action items panel is mounted below the calendar for a managed club
    Given GameWorld 1 has managedTeamId 1
    When the GameWorld 1 home page loads
    Then the Action Items panel is shown below the calendar section

  @spec:ACTUI-002
  Scenario: No action items exist yet
    Given GameWorld 1 has managedTeamId 1
    When the GameWorld 1 home page loads
    Then the Action Items panel shows a "ready for content" empty state
    And the empty state does not read as "nothing to do"

  # ─── Item Rendering ──────────────────────────────────────────────────────────

  @spec:ACTUI-003
  Scenario: Items are sorted by severity, most urgent first
    Given the Action Items panel is showing a "warning" item "Low squad depth", a "critical" item "Player suspended", and an "info" item "New scouting report" in that order
    When the panel renders
    Then the items appear in the order "Player suspended", "Low squad depth", "New scouting report"

  @spec:ACTUI-003
  Scenario: Items with the same severity keep their given order
    Given the Action Items panel is showing a "warning" item "Contract expiring: A" and a "warning" item "Contract expiring: B" in that order
    When the panel renders
    Then the items appear in the order "Contract expiring: A", "Contract expiring: B"

  @spec:ACTUI-004
  Scenario: An item with a link renders as an actionable CTA
    Given the Action Items panel is showing an item "Player suspended" linked to "/1/roster/9" with CTA label "Review"
    When the panel renders
    Then the "Player suspended" item is clickable
    And it shows "Review" as its call to action

  @spec:ACTUI-004
  Scenario: A linked item with no CTA label falls back to a generic label
    Given the Action Items panel is showing an item "Player suspended" linked to "/1/roster/9" with no CTA label
    When the panel renders
    Then it shows "View" as its call to action

  @spec:ACTUI-004
  Scenario: An item with no link is not clickable
    Given the Action Items panel is showing an item "New scouting report" with no link
    When the panel renders
    Then the "New scouting report" item is not clickable

  # ─── Unclaimed Team ──────────────────────────────────────────────────────────

  @spec:ACTUI-005
  Scenario: No managed team is set
    Given GameWorld 1 has no managedTeamId set
    When the GameWorld 1 home page loads
    Then no Action Items panel is shown
