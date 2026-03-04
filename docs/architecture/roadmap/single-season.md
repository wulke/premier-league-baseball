# Roadmap: Full Season Simulation & Review

This roadmap defines the Epic-level requirements to achieve the first true end-to-end gameplay loop in Premier League Baseball: creating a game world, starting a season, and simulating through to completion.

## Epic 1: The Game Calendar (Temporal Progression)
Introduces the concept of time as a gameplay constraint.
*   **Key Requirements:**
    *   Add `currentDate` (DATEONLY) to the `GameWorld` model.
    *   Implement an "Advance Date" mechanism (manual or auto).
    *   Initialize `currentDate` during `newSeason()` from `config.seasonStartDate`.

## Epic 2: Matchday Execution (Batch Simulation Engine)
Handles the bulk simulation of games to allow efficient season progression.
*   **Detailed Design:** See [Simulate a Game Use Case](../design/simulate-game-proposal.md)
*   **Key Requirements:**
    *   Implement Batch Simulation API (`POST /api/gameWorld/:gwId/simulate`).
    *   Add `status` (SCHEDULED, IN_PROGRESS, COMPLETED) to the `Game` model.
    *   Implement a replaceable `SimulationEngine` for score generation.
    *   Use database transactions for atomic matchday execution.

## Epic 3: Season Lifecycle & State Management
Ensures the system can transition between active play and post-season review.
*   **Key Requirements:**
    *   Implement real `isSeasonComplete()` logic in `DivisionFactory` and `LeagueFactory`.
    *   Create a formal "End of Season" state.
    *   Gate `newSeason()` calls to ensure prior seasons are finalized.

## Epic 4: The Manager’s Dashboard (Simulation UI)
Provides the user interface for driving the simulation loop.
*   **Key Requirements:**
    *   "Next Matchday" view showing upcoming games for the current `GameWorld` date.
    *   Interactive controls: "Simulate Today", "Simulate Week", and "Advance Date".
    *   Real-time standings updates in the UI.

---

## Infrastructure Prerequisite (Current Design)
Before implementing these epics, the following data model changes identified in the [Simulate a Game Use Case](../design/simulate-game-proposal.md) are required:
1.  **Game Model:** Add `status` (`ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED')`).
2.  **GameWorld Model:** Add `currentDate` (`DATEONLY`).
