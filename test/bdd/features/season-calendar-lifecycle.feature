Feature: Season Calendar Lifecycle

  Each League tracks its own season year and CUTOVER/IN_SEASON status independently,
  so Leagues on different real-world calendars (e.g. a spring-to-autumn league vs. an
  autumn-to-spring league) can coexist in one GameWorld without a shared season clock.
  A League moves IN_SEASON -> CUTOVER via cutover() (only once its season is complete),
  and CUTOVER -> IN_SEASON via start() (only once every configured Division's scheduling
  start date is safely after the GameWorld's current date). GameWorld.currentDate remains
  a single, shared calendar value across the whole GameWorld and is bootstrapped exactly
  once, by whichever League's start() call is first to succeed. GameWorld.config.inProgress
  is derived from whether any League is IN_SEASON.

  Background:
    Given a GameWorld exists with id 1 and currentDate unset
    And a League "MLS" exists in GameWorld 1 with year 2027 and status CUTOVER
    And League "MLS" has a Division with schedulingConfig startDate "2027-03-01" and intervalDays 7

  # ─── cutover() ──────────────────────────────────────────────────────────────

  @spec:SCL-002
  Scenario: cutover() is rejected when the League is not IN_SEASON
    When an admin cuts over League "MLS"
    Then the response is a 422 error
    And League "MLS"'s status is still CUTOVER

  @spec:SCL-002
  Scenario: cutover() is rejected when the League's current season is not complete
    Given League "MLS"'s status is IN_SEASON
    And League "MLS" has an incomplete Division season for year 2027
    When an admin cuts over League "MLS"
    Then the response is a 422 error
    And League "MLS"'s year is still 2027

  @spec:SCL-002
  Scenario: cutover() increments the League's year and resets its status
    Given League "MLS"'s status is IN_SEASON
    And League "MLS"'s Division season for year 2027 is complete
    When an admin cuts over League "MLS"
    Then the response is 200
    And League "MLS"'s year is 2028
    And League "MLS"'s status is CUTOVER

  # ─── start() validation ─────────────────────────────────────────────────────

  @spec:SCL-003
  Scenario: start() is rejected when the League is not in CUTOVER
    Given League "MLS"'s status is IN_SEASON
    When an admin starts League "MLS"'s season
    Then the response is a 422 error

  @spec:SCL-004
  Scenario: start() is rejected when a configured Division's startDate is not after the current date
    Given GameWorld 1's currentDate is "2027-03-01"
    When an admin starts League "MLS"'s season
    Then the response is a 422 error identifying the offending Division
    And no Game exists for League "MLS"'s year 2027

  @spec:SCL-006
  Scenario: start() is unconstrained when the GameWorld has no currentDate yet
    Given GameWorld 1's currentDate is unset
    When an admin starts League "MLS"'s season
    Then the response is 200
    And League "MLS"'s status becomes IN_SEASON

  # ─── currentDate bootstrap ──────────────────────────────────────────────────

  @spec:SCL-006
  Scenario: The first League to ever start bootstraps GameWorld.currentDate
    Given GameWorld 1's currentDate is unset
    When an admin starts League "MLS"'s season
    Then the response is 200
    And GameWorld 1's currentDate has been bootstrapped to "2027-03-01"

  @spec:SCL-006
  Scenario: A League with no scheduled Divisions leaves currentDate unset if it is the only League
    Given League "MLS"'s Division has no schedulingConfig
    And GameWorld 1's currentDate is unset
    When an admin starts League "MLS"'s season
    Then the response is 200
    And GameWorld 1's currentDate remains unset

  @spec:SCL-007
  Scenario: A later League's start() never changes an already-set currentDate
    Given GameWorld 1's currentDate is "2027-02-22"
    And a second League "UEFA" exists in GameWorld 1 with year 2027 and status CUTOVER
    And League "UEFA" has a Division with schedulingConfig startDate "2027-08-01" and intervalDays 7
    When an admin starts League "UEFA"'s season
    Then the response is 200
    And GameWorld 1's currentDate remains "2027-02-22"

  # ─── Derived GameWorld.config.inProgress ────────────────────────────────────

  @spec:SCL-008
  Scenario: GameWorld.config.inProgress is true while at least one League is IN_SEASON
    Given a second League "UEFA" exists in GameWorld 1 with year 2027 and status CUTOVER
    When an admin starts League "MLS"'s season
    Then GameWorld 1's config.inProgress is true

  @spec:SCL-008
  Scenario: GameWorld.config.inProgress is false once every League is in CUTOVER
    Given League "MLS"'s status is IN_SEASON
    And League "MLS"'s Division season for year 2027 is complete
    When an admin cuts over League "MLS"
    Then GameWorld 1's config.inProgress is false

  # ─── Independent per-League calendars ───────────────────────────────────────

  @spec:SCL-013
  Scenario: A CUTOVER League contributes no games to simulateBatch while a sibling is IN_SEASON
    Given a second League "UEFA" exists in GameWorld 1 with year 2027 and status CUTOVER
    And League "MLS"'s status is IN_SEASON with a Game scheduled on "2027-03-01"
    And GameWorld 1's currentDate is "2027-03-01"
    When an admin batch-simulates GameWorld 1
    Then League "MLS"'s Game scheduled on "2027-03-01" is COMPLETED
    And League "UEFA" has no Games

  # ─── Division scheduling config editing ─────────────────────────────────────

  @spec:SCL-017
  Scenario: schedulingConfig can be edited while the League is in CUTOVER
    When an admin updates League "MLS"'s Division schedulingConfig startDate to "2028-03-06"
    Then the response is 200
    And League "MLS"'s Division keeps its non-scheduling config fields

  @spec:SCL-017
  Scenario: schedulingConfig cannot be edited while the League is IN_SEASON
    Given League "MLS"'s status is IN_SEASON
    When an admin updates League "MLS"'s Division schedulingConfig startDate to "2028-03-06"
    Then the response is a 422 error
    And League "MLS"'s Division config is unchanged

  # ─── Team schedule across diverging League years ───────────────────────────

  @spec:SCL-010
  @spec:SCL-011
  Scenario: A team's schedule reports each game's own League year, not GameWorld.year
    Given a second League "UEFA" exists in GameWorld 1 with year 2027 and status IN_SEASON
    And League "MLS" has year 2028 and a Game scheduled on "2028-04-01"
    And League "UEFA" has year 2027 and a Game scheduled on "2027-09-01"
    And the same team plays in League "MLS" and League "UEFA"
    When an admin requests the team's schedule
    Then the response has no top-level year field
    And the Game scheduled on "2028-04-01" reports year 2028
    And the Game scheduled on "2027-09-01" reports year 2027

  # ─── Migration / backfill ───────────────────────────────────────────────────

  @spec:SCL-012
  Scenario: An existing League with prior DivisionSeason rows backfills to IN_SEASON
    Given a legacy League exists with GameWorld.year 2027 and existing DivisionSeason rows
    When the season-calendar-lifecycle migration runs
    Then the legacy League's year is 2027
    And the legacy League's status is IN_SEASON

  @spec:SCL-012
  Scenario: An existing League with no DivisionSeason rows backfills to CUTOVER
    Given a legacy League exists with GameWorld.year 2027 and no DivisionSeason rows
    When the season-calendar-lifecycle migration runs
    Then the legacy League's year is 2027
    And the legacy League's status is CUTOVER
