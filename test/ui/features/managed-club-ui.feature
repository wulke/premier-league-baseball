Feature: Managed Club UI

  The managed-club identity/navigation pin. Claiming and resigning happen on the generic team
  hub (the sole affordance); once claimed, the nav-rail "My Club" and "Roster" trio light up as
  links to the managed team's symmetric surfaces, while "Transfers" stays dimmed. Frictionless
  and unconditional in MVP — no apply/interview gate.

  Background:
    Given GameWorld 1 exists
    And Team 10 "Manchester Mariners" belongs to GameWorld 1

  # ─── Claim / Resign on the team hub ─────────────────────────────────────────

  @spec:MCLUI-001 @spec:MCLUI-003
  Scenario: Claiming a team from its hub posts the team id and reflects without a reload
    Given GameWorld 1 has no managed club
    When the player navigates to Team 10's hub
    Then the hub shows a "Claim as My Club" action
    When the player claims Team 10 as their club
    Then the client POSTs managed-club with teamId 10
    And the hub shows a "Stop managing" action without a full reload

  @spec:MCLUI-002 @spec:MCLUI-003
  Scenario: Resigning from the managed club's hub posts null and reflects without a reload
    Given GameWorld 1 has Team 10 as its managed club
    When the player navigates to Team 10's hub
    Then the hub shows a "Stop managing" action
    When the player resigns from managing Team 10
    Then the client POSTs managed-club with teamId null
    And the hub shows a "Claim as My Club" action without a full reload

  # ─── Frictionless (no gate) ──────────────────────────────────────────────────

  @spec:MCLUI-006
  Scenario: Claiming is a single unconditional action with no apply/interview gate
    Given GameWorld 1 has no managed club
    When the player navigates to Team 10's hub
    And the player claims Team 10 as their club
    Then the claim is accepted with no confirmation or interview gate

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

  @spec:MCLUI-005
  Scenario: Transfers stays dimmed even when a club is claimed
    Given GameWorld 1 has Team 10 as its managed club
    When the player navigates to Team 10's hub
    Then the nav rail shows the dimmed "Transfers" item
