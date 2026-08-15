Feature: Lineup Read API

  The engine and read-only consumers fetch a team's active lineup as an ID-only card. The card
  orders starters by batting slot, derives its starting pitcher from the Pitcher assignment, and
  exposes reserve pools without giving those pools a presentation order.

  Background:
    Given GameWorld 1 exists for lineup reads
    And Team 10 in GameWorld 1 has a DH-off active lineup

  @spec:LREAD-001 @spec:LREAD-002
  Scenario: The active lineup projects ordered starters, a derived pitcher, and unordered pools
    When the client requests the active lineup for Team 10
    Then the response contains nine starters in batting order
    And the response derives the starting pitcher from the Pitcher starter entry
    And the response exposes the bench and bullpen as order-agnostic player ID pools

  @spec:LREAD-003
  Scenario: A DH-off active lineup exposes nine starters
    When the client requests the active lineup for Team 10
    Then the response contains nine starters in batting order
    And the response has no DH starter

  @spec:LREAD-003
  Scenario: A DH-on active lineup exposes its tenth null-position starter
    Given Team 11 in GameWorld 1 has a DH-on active lineup
    When the client requests the active lineup for Team 11
    Then the response contains ten starters including the null-position DH
    And the DH-on pitcher has no batting order

  @spec:LREAD-004
  Scenario: A cross-world lineup request is not found
    When the client requests the active lineup for Team 10 with ?gwId=2
    Then the lineup response indicates the Team was not found
