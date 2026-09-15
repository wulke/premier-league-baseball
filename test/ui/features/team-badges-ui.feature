Feature: Team Crest Rendering

  Real club crests, downloaded once from Wikimedia Commons and shipped as static assets, render
  next to a team's name wherever that team's identity already appears — the League standings
  table, a division's team-list grid, the team-calendar identity header, and the GameWorld home
  calendar strip. A team with no crest, or whose crest image fails to load, falls back to the
  existing text-initials placeholder rather than a broken-image icon.

  # ─── Fallback Behavior ───────────────────────────────────────────────────────

  @spec:BADGEUI-002
  Scenario: A team with no badge shows text initials, no image attempted
    Given GET /api/league/1/standings returns a team named "Forest Green Rovers" with no badge
    When the League page renders
    Then the "Forest Green Rovers" row shows text initials "FGR"
    And no crest image is requested for "Forest Green Rovers"

  @spec:BADGEUI-001
  Scenario: A team's crest image fails to load and falls back to text initials
    Given GET /api/league/1/standings returns a team named "Arsenal" with badge "/badges/arsenal.png"
    When the League page renders
    And the "Arsenal" crest image fails to load
    Then the "Arsenal" row shows text initials "A"

  @spec:BADGEUI-003
  Scenario: A knockout bye slot's initials render the same as any name-only team
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-05-01"
    And GET /api/team/1/calendar returns a completed knockout bye game
    When the GameWorld 1 home page loads
    Then the bye entry shows text initials "B"

  # ─── Standings Table ─────────────────────────────────────────────────────────

  @spec:BADGEUI-005
  @spec:BADGEUI-006
  Scenario: A standings row renders the team's crest alongside its name
    Given GET /api/league/1/standings returns a team named "Arsenal" with badge "/badges/arsenal.png"
    When the League page renders
    Then the "Arsenal" row shows a crest image with src "/badges/arsenal.png"
    And the "Arsenal" row shows the team name "Arsenal"

  # ─── Division Team-List Grid ─────────────────────────────────────────────────

  @spec:BADGEUI-007
  Scenario: A division's team-list grid renders each team's crest from its raw config
    Given the League page has a team named "Arsenal" with badge "/badges/arsenal.png"
    When the League page renders
    Then the team grid shows a crest image with src "/badges/arsenal.png" for "Arsenal"

  # ─── Team-Calendar Identity Header ───────────────────────────────────────────

  @spec:BADGEUI-005
  @spec:BADGEUI-008
  Scenario: The team-calendar page header renders the team's crest
    Given the player opens the TeamCalendar route "/1/team/7/calendar"
    And GET /api/team/7/calendar returns a schedule for team "Arsenal" with badge "/badges/arsenal.png"
    When the TeamCalendar page loads
    Then the page header shows a crest image with src "/badges/arsenal.png"
    And the page header shows the team name "Arsenal"

  # ─── Home Calendar Strip ─────────────────────────────────────────────────────

  @spec:BADGEUI-005
  @spec:BADGEUI-009
  Scenario: A calendar strip entry renders each team's crest when one is available
    Given GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"
    And GET /api/team/1/calendar returns a completed game between "Arsenal" (badge "/badges/arsenal.png") and "Chelsea" (badge "/badges/chelsea.png")
    When the GameWorld 1 home page loads
    Then the calendar entry shows a crest image with src "/badges/arsenal.png" for "Arsenal"
    And the calendar entry shows a crest image with src "/badges/chelsea.png" for "Chelsea"

  # ─── Deferred: BracketView / knockout series team names (→ future map) ──────
  # No scenario in v1: the knockout BracketView surface (docs/llds/league/knockout-bracket.md,
  # bracket-tree-ui.md) is explicitly out of scope for this slice — see team-badges-ui.md's Scope.
