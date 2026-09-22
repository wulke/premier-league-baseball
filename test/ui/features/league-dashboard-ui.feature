Feature: League Dashboard

  The League Dashboard (/:gwId/:leagueId) is a snapshot page: identity + champion state, a
  league-scoped Today matchup banner, a condensed top-5 standings widget per round-robin
  division, and a bracket teaser per knockout division — each linking out to the full
  /:gwId/:leagueId/standings page rather than showing everything inline.

  Background:
    Given a GameWorld exists with id 1, year 2025, currentDate "2025-04-10", and season in progress
    And League 1 "Premier League" has a round-robin division "Top Flight" and a knockout division "Playoffs"

  @spec:LDASH-002
  Scenario: Identity header shows the champion banner once the league is decided
    Given the "Top Flight" division has a decided champion "River City"
    When the player opens the League Dashboard for League 1
    Then the identity header shows "🏆 Premier League Champion: River City · Table decided"

  @spec:LDASH-002
  Scenario: Identity header falls back to the season-status subtitle before a champion is decided
    Given no division in League 1 has a decided champion
    When the player opens the League Dashboard for League 1
    Then the identity header shows "2 divisions · Season in progress"

  @spec:LDASH-003
  Scenario: A league with games in the Today window shows the matchup banner
    Given GetLeagueToday for League 1 returns a completed game "River City 4–2 Southgate United"
    When the player opens the League Dashboard for League 1
    Then the Today section shows a matchup tile "River City 4–2 Southgate United"
    And the "River City" lane shows the winner marker

  @spec:LDASH-003
  Scenario: A league with no games in the Today window omits the Today section
    Given GetLeagueToday for League 1 returns no games
    When the player opens the League Dashboard for League 1
    Then the League Dashboard does not show a Today section

  @spec:LDASH-004 @spec:LDASH-005
  Scenario: A round-robin division's condensed widget shows only its top 5 teams
    Given the "Top Flight" division has standings for 8 teams
    When the player opens the League Dashboard for League 1
    Then the "Top Flight" condensed standings widget shows exactly 5 rows
    And the League Dashboard shows exactly one "View full standings" link
    When the player clicks "View full standings"
    Then the app navigates to "/1/1/standings"

  @spec:LDASH-006
  Scenario: A knockout division mid-tournament shows a teaser of its first incomplete round
    Given the "Playoffs" division has a completed "Quarterfinals" round and a pending "Semifinals" round
    When the player opens the League Dashboard for League 1
    Then the "Playoffs" bracket teaser shows round label "Semifinals"
    And the "Playoffs" bracket teaser does not show a "Quarterfinals" round column

  @spec:LDASH-007
  Scenario: A fully resolved knockout division shows its champion instead of a round teaser
    Given every round of the "Playoffs" division is complete with champion "Southgate United"
    When the player opens the League Dashboard for League 1
    Then the "Playoffs" section shows champion "Southgate United"
    And the "Playoffs" section does not show a round teaser

  @spec:LDASH-008
  Scenario: A division with no standings or bracket yet shows the roster grid fallback
    Given the "Top Flight" division has no standings and the "Playoffs" division has no bracket rounds
    When the player opens the League Dashboard for League 1
    Then the "Top Flight" section shows the team roster grid
    And the "Playoffs" section shows the team roster grid

  @spec:LDASH-009
  Scenario: Clicking a team identity on the dashboard opens the team hub
    Given the "Top Flight" division has standings that include team "River City" with id 7
    When the player opens the League Dashboard for League 1
    And the player clicks team "River City" in the condensed standings widget
    Then the app navigates to "/1/team/7"

  @spec:LDASH-010
  Scenario: Clicking a series tie in a bracket teaser does not expand it
    Given the "Playoffs" division has a pending "Semifinals" round with an unresolved series tie
    When the player opens the League Dashboard for League 1
    And the player clicks the series tie in the "Playoffs" bracket teaser
    Then no game rows are shown for that tie
