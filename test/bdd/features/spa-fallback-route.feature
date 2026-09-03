Feature: SPA fallback route

  Browser-history routes are virtual React Router routes, so Express supplies the SPA entry
  document for unmatched UI GET requests while retaining the API namespace's 404 behavior.

  @spec:SPAF-001
  Scenario: A nested client-side route receives the SPA document
    Given an application with an SPA index document
    When the browser GETs the nested route "/42/9"
    Then the response is 200 with the SPA index document

  @spec:SPAF-001
  Scenario: A roster deep link receives the SPA document
    Given an application with an SPA index document
    When the browser GETs the nested route "/42/team/7/roster"
    Then the response is 200 with the SPA index document

  @spec:SPAF-002
  Scenario: An unknown API route is not served as the SPA
    Given an application with an SPA index document
    When the browser GETs the unknown API route "/api/not-a-real-route"
    Then the response is a normal 404 without the SPA index document

  @spec:SPAF-003
  Scenario: A declared API endpoint still returns JSON
    Given an application with an SPA index document
    When the browser GETs the declared API route "/api/gameWorld"
    Then the response is JSON with status 200
