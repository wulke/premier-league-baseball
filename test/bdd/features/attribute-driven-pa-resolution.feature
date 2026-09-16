Feature: Attribute-driven PA-resolution pipeline

  A second, attribute-driven SimulationEngine (AttributeDrivenSimulationEngine) resolves a
  full game from a synthetic lineup: attribute-driven plate-appearance outcomes, real
  baserunner advancement, and a PlayerGameStats projection derived from the resulting event
  chain — with team score emergent from that projection, not an independent draw. This engine
  is not yet wired into GameFactory/resolveSimulationEngine() (#192); every scenario below
  calls the domain directly.

  # PARP-001 (attribute-read seam pass-through) and PARP-003 (outcome-weight floor before
  # normalizing) are internal algorithm invariants of readAttribute/resolvePA with no
  # observable acceptance-level behavior distinct from PARP-002 below — bound to
  # test/db/domain/attribute-read.test.ts and test/db/domain/pa-resolver.test.ts instead.

  # ─── Plate Appearance Resolution ──────────────────────────────────────────────

  @spec:PARP-002
  Scenario: A resolved plate appearance always produces one of the seven valid outcomes
    Given a batter and a pitcher with attributes
    When the engine resolves a plate appearance with pinned seed 4242
    Then the outcome is one of out, 1B, 2B, 3B, HR, BB, SO

  # ─── Baserunner Advancement ───────────────────────────────────────────────────

  @spec:PARP-004
  Scenario: A walk with the bases loaded forces every runner home
    Given a batter at the plate with runners on first, second, and third
    When the plate appearance resolves to "BB"
    Then the runner on third scores
    And the runner on second advances to third
    And the runner on first advances to second
    And the batter is placed on first

  @spec:PARP-004
  Scenario: A walk with only a runner on second does not force that runner
    Given a batter at the plate with a runner on second and the other bases empty
    When the plate appearance resolves to "BB"
    Then the runner on second remains on second
    And the batter is placed on first

  @spec:PARP-005
  Scenario: A single advances every existing runner exactly one base
    Given a batter at the plate with runners on first and second
    When the plate appearance resolves to "1B"
    Then the runner on second scores
    And the runner on first advances to second
    And the batter is placed on first

  @spec:PARP-005
  Scenario: A double advances every existing runner exactly two bases
    Given a batter at the plate with a runner on first
    When the plate appearance resolves to "2B"
    Then the runner on first scores
    And the batter is placed on second

  @spec:PARP-006
  Scenario: A home run scores the batter and every existing runner and clears the bases
    Given a batter at the plate with runners on first and third
    When the plate appearance resolves to "HR"
    Then the runner on first scores
    And the runner on third scores
    And the batter scores
    And the bases are empty

  @spec:PARP-007
  Scenario: Each transitioning runner produces its own BaserunningEvent caused by the plate appearance
    Given a batter at the plate with a runner on second
    When the plate appearance resolves to "2B"
    Then two BaserunningEvent instances are emitted
    And each BaserunningEvent's causedByEventId is the triggering PlateAppearanceResolutionEvent's sequence

  # ─── Inning & Game Structure ──────────────────────────────────────────────────

  @spec:PARP-008
  Scenario: The batting order continues across innings without resetting
    Given a synthetic lineup of 9 batters
    When the engine resolves 10 consecutive plate appearances for that lineup with pinned seed 4242
    Then the 10th plate appearance's batter is the same player as the 1st

  @spec:PARP-009
  Scenario: A half-inning ends after exactly three outs, counting out and SO alike
    Given a half-inning is simulated with pinned seed 4242
    Then the half-inning ends once three "out" or "SO" outcomes have occurred
    And no further plate appearance occurs in that half-inning

  @spec:PARP-010
  Scenario: A 9-inning game always plays both halves of every inning, ties included
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    Then exactly 18 half-innings are played
    And a tied final score is accepted as a valid result

  # ─── Stat Projection & Team Score ──────────────────────────────────────────────

  @spec:PARP-011
  Scenario: Team score is the sum of R across that team's projected stats, not an independent draw
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    Then homeTeamResult equals the sum of R across the home team's projected PlayerGameStats rows
    And awayTeamResult equals the sum of R across the away team's projected PlayerGameStats rows

  @spec:PARP-012
  Scenario: Stat projection is a single replay of the returned event chain
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    And PlayerGameStats rows are projected a second time from the same returned event chain
    Then the two projections are identical

  @spec:PARP-013
  Scenario: A batter is credited with an RBI for every run scored on their plate appearance
    Given a batter at the plate with a runner on third
    When the plate appearance resolves to "1B"
    Then the batter's projected RBI increases by 1

  @spec:PARP-013
  Scenario: A batter is credited with an RBI for their own run on a home run
    Given a batter at the plate with the bases empty
    When the plate appearance resolves to "HR"
    Then the batter's projected RBI increases by 1
    And the batter's projected R increases by 1

  @spec:PARP-014
  Scenario: All pitching stats for a half-inning accrue to the single starting pitcher
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    Then every pitching stat recorded against the away team's batters is attributed to the home starting pitcher
    And the home starting pitcher's outsRecorded reflects every out recorded against the away team
    And no projected PlayerGameStats row sets IP

  # ─── Determinism & Golden Master ───────────────────────────────────────────────

  @spec:PARP-016
  Scenario: Exactly one RNG draw is consumed per plate appearance
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    Then the number of RNG draws consumed equals the number of PlateAppearanceResolutionEvent instances in the returned event chain

  @spec:PARP-017
  Scenario: A pinned seed reproduces an identical event chain and stat projection
    Given a Game exists between a home team and an away team with matchRules innings 9
    When the engine simulates the game with pinned seed 4242
    And the engine simulates the same game again with pinned seed 4242
    Then the two event chains are identical
    And the two PlayerGameStats projections are identical

  # ─── Invalid Input ─────────────────────────────────────────────────────────────

  @spec:PARP-015
  Scenario: A synthetic lineup with fewer than 9 batting-order entries is rejected
    Given a synthetic lineup with only 8 batting-order entries
    When the engine simulates a game with that lineup
    Then a plain Error is thrown
    And no RNG state is consumed

  @spec:PARP-015
  Scenario: A synthetic lineup with no resolvable starting pitcher is rejected
    Given a synthetic lineup whose startingPitcherId is not present among its batting order
    When the engine simulates a game with that lineup
    Then a plain Error is thrown

  # ─── Persistence ────────────────────────────────────────────────────────────────

  @spec:PARP-018
  Scenario: Persisting the same game's projected stats twice is rejected
    Given a Game exists between a home team and an away team with matchRules innings 9
    And the engine has simulated the game and its PlayerGameStats rows have been persisted
    When the same PlayerGameStats rows are persisted again for that game
    Then the write is rejected by the existing unique index on playerId and gameId
