Feature: Simulate Today UI

  As a player
  I want to trigger simulation for all games scheduled on the current date
  So that I can progress the season from the GameWorld dashboard

  Background:
    Given a GameWorld exists with id 1, currentDate "2025-04-10", and inProgress true
    And the page header is visible

  Scenario: Successful batch simulation from GameWorld page
    Given I am on the GameWorld page for id 1
    And I see the "Simulate Today" action in the AppHeader
    When I click the "Simulate Today" button
    And eventually I should see a success summary "3 simulated · 0 skipped"

  Scenario: Batch simulation fails and shows error
    Given I am on the GameWorld page for id 1
    And the batch simulation will fail with a 500 error
    When I click the "Simulate Today" button
    Then I should see an error message "Batch simulation failed."
    And I should see a "Retry" button
