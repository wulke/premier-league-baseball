Feature: GameWorld collection API (list + create)

  The pre-LID GameWorld collection endpoints: GET /api/gameWorld lists every world raw
  and unwrapped, and POST /api/gameWorld/new builds a complete runnable world from a
  template payload (Leagues as containers, then per-League Teams, then Divisions — #283)
  and returns the composed result.
  Backfilled per the legacy-API spec process (GWA-001..005).

  @spec:GWA-001
  Scenario: Listing returns every GameWorld as a raw array
    Given GameWorlds exist with ids 1 and 2
    When the player lists all GameWorlds
    Then the response is an array containing both ids

  @spec:GWA-002
  Scenario: Listing with no GameWorlds returns an empty array
    When the player lists all GameWorlds
    Then the response is an empty array

  @spec:GWA-003
  Scenario: Creating a world from a template persists it with leagues and teams
    When the player creates a GameWorld from the default Premier League template
    Then the response includes an array of 2 leagues and an array of 92 teams
    And the persisted GameWorld config has inProgress false
    And the persisted GameWorld year column keeps its default

  @spec:GWA-004
  Scenario: The body year is stored in config only and never sets the year column
    When the player creates a GameWorld from the default template with year 1999
    Then the persisted GameWorld year column is the current year minus 1
    And the persisted GameWorld config stores year 1999

  @spec:GWA-005
  Scenario: A malformed create payload surfaces the persistence-layer error
    When the player creates a GameWorld with an empty payload
    Then the response is a 500 error
