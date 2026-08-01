Feature: GameWorld Deletion

  The player can permanently delete a GameWorld. Deleting a GameWorld hard-deletes it
  together with everything it owns: Leagues, Teams, Players, Divisions, DivisionSeasons,
  Contracts, PlayerGameStats, SeasonResults, and any Games reachable only through those
  DivisionSeasons. There is no restriction based on whether a season is in progress, and
  no undo — a failure partway through leaves everything untouched.

  Background:
    Given a GameWorld exists with id 1 and year 2025
    And a League, Division, and DivisionSeason exist in GameWorld 1
    And a home team and away team exist in GameWorld 1, each with a roster of Players
    And each Team has a Contract for each of its Players
    And a Game exists in GameWorld 1's DivisionSeason with PlayerGameStats recorded
    And a SeasonResult exists for GameWorld 1's Division

  # ─── Happy Path ─────────────────────────────────────────────────────────────

  @spec:GWD-002
  Scenario: Deleting a GameWorld cascades through every related row
    When the player deletes GameWorld 1
    Then the response is 200 with id 1
    And GameWorld 1 no longer exists
    And GameWorld 1's Leagues, Teams, Players, Divisions, and DivisionSeasons no longer exist
    And GameWorld 1's Contracts and PlayerGameStats no longer exist
    And GameWorld 1's SeasonResult no longer exists
    And GameWorld 1's Game no longer exists

  @spec:GWD-002
  Scenario: Deleting a GameWorld does not affect a Game shared with another GameWorld's DivisionSeason
    Given a second GameWorld exists with id 2 and its own League, Division, and DivisionSeason
    And GameWorld 1's Game is also linked to GameWorld 2's DivisionSeason
    When the player deletes GameWorld 1
    Then GameWorld 1 no longer exists
    And GameWorld 1's Game still exists
    And GameWorld 2's DivisionSeason is still linked to that Game

  # ─── In-Progress Restriction ────────────────────────────────────────────────

  @spec:GWD-004
  Scenario: Deleting a GameWorld with an active season is allowed
    Given GameWorld 1's config.inProgress is true
    When the player deletes GameWorld 1
    Then the response is 200 with id 1
    And GameWorld 1 no longer exists

  # ─── Not Found ───────────────────────────────────────────────────────────────

  @spec:GWD-001
  Scenario: Attempt to delete a GameWorld that does not exist
    When the player deletes GameWorld 9999
    Then the response is a 404 error
    And the error indicates the GameWorld was not found
    And no GameWorld, League, Team, or Player rows are modified

  # ─── Rollback on Failure ────────────────────────────────────────────────────

  @spec:GWD-003
  Scenario: Database error partway through the cascade rolls back the entire deletion
    Given a database error will occur mid-transaction
    When the player deletes GameWorld 1
    Then the response is a 500 error
    And GameWorld 1 still exists
    And GameWorld 1's Leagues, Teams, Players, Divisions, and DivisionSeasons still exist
    And GameWorld 1's Contracts, PlayerGameStats, SeasonResult, and Game still exist
