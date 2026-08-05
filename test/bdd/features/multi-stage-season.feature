Feature: Multi-stage season run-path (dependent stages)

  A League whose `stages[]` form an ordered, dependent sequence simulates in phases: the
  first stage's divisions start at season kickoff, and a stage with a `seedingSelection`
  (e.g. `TOP_N_PER_DIVISION`) is advanced only once every division in its source stage is
  complete — its teams arriving from the source stage's final standings rather than a pool.
  This is the old Champions League shape: a group stage (round-robin) whose top-N-per-group
  seed a two-leg knockout, decided by a single champion. The advance is event-driven off the
  shared game-completion path (the same path that resolves knockout rounds and records
  round-robin champions), so it composes with single-game simulate and batch/rapid simulate
  alike. A group stage records no champion; only the final stage's `isTopTier` division does.

  Background:
    Given a GameWorld exists with id 1 and currentDate unset
    And a League "Champions League" exists in GameWorld 1 with year 2027 and status CUTOVER
    And League "Champions League" has a group stage "Group Stage" with 2 round-robin divisions of 4 teams each
    And League "Champions League" has a knockout stage "Knockout" with one two-leg knockout division seeded TOP_N_PER_DIVISION topN 2 from "Group Stage" with isTopTier true

  # ─── Seeding selection (getSeedTeamIdsForDivision) ─────────────────────────

  @spec:MSS-001
  Scenario: A division with no seedingSelection seeds from its defaultTeams
    Given a League "Plain Cup" exists in GameWorld 1 with year 2027 and status CUTOVER
    And League "Plain Cup" has a single stage with one round-robin division of 4 teams and no seedingSelection
    When an admin starts League "Plain Cup"'s season
    Then the response is 200
    And League "Plain Cup"'s division season is seeded with its 4 defaultTeams

  @spec:MSS-002
  Scenario: TOP_N_PER_DIVISION emits seeds rank-outer, source-division order inner
    Given League "Champions League"'s group stage is complete for year 2027 with known standings
    When the knockout stage is advanced for year 2027
    Then the knockout division is seeded with 4 teams
    And the seed order is rank 1 of each group, then rank 2 of each group, in group declaration order

  @spec:MSS-003
  Scenario: A BEST_OF_REST selection is rejected at run time (config-surface only)
    Given League "Champions League"'s "Knockout" division has a BEST_OF_REST seedingSelection
    When the knockout stage is advanced for year 2027
    Then the response is a 422 error indicating the selection has no scheduler

  @spec:MSS-003
  Scenario: A TIERED_RANK selection is rejected at run time (config-surface only)
    Given League "Champions League"'s "Knockout" division has a TIERED_RANK seedingSelection
    When the knockout stage is advanced for year 2027
    Then the response is a 422 error indicating the selection has no scheduler

  # ─── Create: stageId stamping ──────────────────────────────────────────────

  @spec:MSS-004
  Scenario: Creating a multi-stage League stamps each division with its enclosing stageId
    When League "Champions League" is created with its stages config
    Then every division in stage "Group Stage" has config.stageId "Group Stage"
    And every division in stage "Knockout" has config.stageId "Knockout"

  @spec:MSS-004
  Scenario: Creating a legacy divisions-only League wraps it in a single default stage
    Given a League "Premier League" exists in GameWorld 1 with a legacy divisions config and no stages
    When League "Premier League" is created
    Then every division has a config.stageId
    And the knockout stage is not advanced for League "Premier League"

  # ─── Season start: first stage only ────────────────────────────────────────

  @spec:MSS-005
  Scenario: start() starts only the first stage's divisions
    When an admin starts League "Champions League"'s season
    Then the response is 200
    And League "Champions League"'s status becomes IN_SEASON
    And both "Group Stage" divisions have a DivisionSeason and scheduled games for year 2027
    And the "Knockout" division has no DivisionSeason and no games for year 2027

  # ─── Event-driven dependent-stage advance ──────────────────────────────────

  @spec:MSS-006
  Scenario: Completing the last source-stage game advances the dependent knockout stage
    Given League "Champions League"'s season is started for year 2027
    And every "Group Stage" game except one is COMPLETED
    When the final "Group Stage" game is completed
    Then the "Knockout" division has a DivisionSeason for year 2027
    And the knockout is seeded with the top 2 of each group via TOP_N_PER_DIVISION
    And the knockout's round 1 games are scheduled

  @spec:MSS-006
  Scenario: A dependent stage is not advanced until every source division is complete
    Given League "Champions League"'s season is started for year 2027
    And one "Group Stage" division is complete and the other is not
    When a game is completed in the incomplete group
    Then the "Knockout" division still has no DivisionSeason for year 2027

  @spec:MSS-007
  Scenario: Re-evaluating advancement after the dependent stage has started is a no-op
    Given League "Champions League"'s season is started for year 2027
    And the "Knockout" division already has a DivisionSeason for year 2027
    When a game completion re-evaluates cross-stage advancement for year 2027
    Then the "Knockout" division is not re-seeded
    And the knockout's DivisionSeason row count for year 2027 is unchanged

  # ─── Champion recording (isTopTier gate) ───────────────────────────────────

  @spec:MSS-008
  Scenario: A group-stage division records no champion even when complete
    Given League "Champions League"'s season is started for year 2027
    And a "Group Stage" division is complete for year 2027
    When that group stage division is evaluated for champion recording
    Then no SeasonResult row exists for the group stage division and year 2027

  @spec:MSS-008
  Scenario: The final knockout division records the champion via isTopTier
    Given League "Champions League"'s season is started for year 2027
    And the knockout bracket is decided to a single winner for year 2027
    When the deciding knockout game is completed
    Then exactly one SeasonResult row exists for League "Champions League" and year 2027
    And it records the knockout winner as champion on the isTopTier division

  # ─── End-to-end proving slice (old Champions League) ───────────────────────

  @spec:MSS-009
  Scenario: The old Champions League runs group stage → two-leg knockout → single champion
    Given League "Champions League"'s season is started for year 2027
    When an admin rapid-simulates the season to completion
    Then every "Group Stage" game is COMPLETED
    And the knockout bracket is fully decided
    And exactly one champion is recorded for League "Champions League" and year 2027
    And League "Champions League"'s season is complete
