Feature: Managed Club UI

  The managed-club identity/navigation pin. The team hub frames each team as an available job in
  the Job Market; taking and leaving jobs happen there (the sole affordance). Once taken, the nav-rail "My Club" and "Roster" trio light up as
  links to the managed team's symmetric surfaces, while "Transfers" stays dimmed. Frictionless
  and unconditional in MVP — no apply/interview gate.

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  # ─── Take / Leave a job on the team hub ─────────────────────────────────────

  @spec:MCLUI-001 @spec:MCLUI-003
  Scenario: Taking an available job from its hub posts the team id and reflects without a reload
    Given GameWorld 1 has no managed club
    When the player navigates to Team 10's hub
    Then the hub shows the "Job Market" / "Available Jobs" framing
    And the hub shows a "Take this job" action
    When the player takes Team 10's job
    Then the client POSTs managed-club with teamId 10
    And the hub shows a "Leave this job" action without a full reload

  @spec:MCLUI-002 @spec:MCLUI-003
  Scenario: Leaving the managed job posts null and reflects without a reload
    Given GameWorld 1 has Team 10 as its managed club
    When the player navigates to Team 10's hub
    Then the hub shows a "Leave this job" action
    When the player leaves Team 10's job
    Then the client POSTs managed-club with teamId null
    And the hub shows a "Take this job" action without a full reload

  # ─── Frictionless (no gate) ──────────────────────────────────────────────────

  @spec:MCLUI-006
  Scenario: Taking an available job is a single unconditional action with no apply/interview gate
    Given GameWorld 1 has no managed club
    When the player navigates to Team 10's hub
    And the player takes Team 10's job
    Then the job is accepted with no confirmation or interview gate

  # ─── Nav rail when claimed ───────────────────────────────────────────────────

  @spec:MCLUI-004
  Scenario: A claimed managed club lights the nav rail trio as links to the managed team
    Given GameWorld 1 has Team 10 as its managed club
    When the player navigates to Team 10's hub
    Then the nav rail's "My Club" links to "/1/team/10"
    And the nav rail's "Roster" links to "/1/team/10/roster"
    And the nav rail shows no dimmed "My Club" or "Roster" item

  # ─── Nav rail null state ─────────────────────────────────────────────────────

  @spec:MCLUI-005
  Scenario: An unclaimed managed club keeps the trio dimmed with no affordance
    Given GameWorld 1 has no managed club
    When the player navigates to Team 10's hub
    Then the nav rail shows the dimmed "My Club" item
    And the nav rail shows the dimmed "Roster" item
    And the nav rail shows the dimmed "Transfers" item
    And the nav rail shows no active "My Club" or "Roster" link

  # ─── Deferred: Transfers when claimed (superseded by XFERUI-001, → #237) ─────
  # "Transfers stays dimmed even when a club is claimed" was true through #153 but
  # is superseded now that the Transfers surface exists — see
  # test/ui/features/transfers-ui.feature's "Clicking Transfers in the nav rail
  # navigates to the Transfers page" (@spec:XFERUI-001).
