---
name: use-case-design
description: Use this skill when the user wants to design, model, or plan backend features, data models, API access patterns, or database schemas for new game use cases. Triggers on phrases like "design a use case", "model a feature", "access patterns for", "data model for", "how should I build", "backend design", "schema for", or when a user describes a player action they want to implement (e.g. "simulate game", "fetch player stats", "trade a player"). Always start with Step 1.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# Use Case Design Skill

This skill guides collaborative backend and data model design for the Premier League Baseball simulation game. It works through a structured 4-step process, iterating with the user at each phase before moving forward.

## Existing Architecture Context

Before starting, load the current architecture:

Existing data model: @docs/architecture/data-model/data-model.md
Data model decisions: @docs/architecture/data-model/data-model-questions.md
Existing process flows directory listing: !`ls docs/architecture/process-flow/`

---

## Step 1 — Capture the Use Case

Ask the user to describe the **player-facing action** they want to implement. A use case is something the player of the simulation game would *do* or *trigger*, for example:

- "Simulate a game"
- "View a team's season stats"
- "Sign a free agent"
- "Fetch a player's historical stats"
- "Advance the season to the next matchday"

If the user has already provided a use case (e.g. as an argument to this skill), confirm your understanding of it and proceed to Step 2.

Ask clarifying questions if needed:
- Who triggers this action? (The player/user via the UI, or is it system-triggered?)
- What is the expected outcome or output?
- Are there any preconditions the game world must be in for this to work?
- Is this a read (query) operation, a write (mutation), or both?

Once you have a clear use case statement, summarise it back to the user in one sentence before proceeding to Step 2.

---

## Step 2 — BPMN Process Flow Diagram

**Before drawing anything**, read the existing process flow files relevant to the use case:

```
@docs/architecture/process-flow/start-new-season-gameworld.md
@docs/architecture/process-flow/start-new-season-league.md
@docs/architecture/process-flow/start-new-season-division.md
@docs/architecture/process-flow/record-game-result.md
@docs/architecture/process-flow/create-game.md
@docs/architecture/process-flow/get-league.md
@docs/architecture/process-flow/find-game-world.md
@docs/architecture/process-flow/check-league-season-complete.md
```

Identify which existing flows this use case touches or extends. Note them explicitly. These references should be included in the final diagram with `click` annotations linking to the relevant `.md` files.

Then produce a **BPMN-style process flow** using Mermaid `flowchart TD` syntax. The diagram should:
- Show the full end-to-end flow from the user action to the final response
- Include decision points (guards, validations, error paths)
- Reference existing sub-flows by name where they are reused (use `click` annotations pointing to existing `.md` files)
- Cover both the happy path and error/rollback paths
- Label database operations (e.g. `FindByPk`, `Create`, `Update`, `transaction`)

Present the diagram to the user with a brief written explanation of each major step. Save the proposal as a temp file for external review until a final approved version is ready. Ask the user to review and provide feedback before proceeding to Step 3. Iterate on the diagram until the user approves it. Once approved, delete the temp file and save the final version to `docs/architecture/process-flow/<use-case-slug>.md` where `<use-case-slug>` is the use case name in kebab-case (e.g. `simulate-game.md`).

---

## Step 3 — Access Patterns & Data Model Requirements

**Before proposing anything new**, check what already exists:
- Review the data model at `@docs/architecture/data-model/data-model.md`
- Review existing API endpoints in `@src/api/` and domain factories in `@src/db/domain/`

For each step in the approved process flow, identify:

### Access Patterns Table

| Step | Operation | Entity | Filter / Key | New? |
|------|-----------|--------|-------------|------|
| (for each flow step) | READ/WRITE | Table name | Field(s) used | Yes/No |

Mark operations **New** only if they are not already supported by the existing domain factories or API handlers.

### Data Model Changes

For each *new* access pattern, determine if the existing schema supports it. If not, propose the minimum schema addition needed:
- New table (with ER diagram snippet in Mermaid `erDiagram`)
- New column on an existing table
- New index

Explicitly call out any **new or updated** items — do not re-describe existing model elements unless they are being changed.

Present the access patterns table and any data model changes to the user. Ask for review and approval before proceeding to Step 4.

---

## Step 4 — Iterate & Generate Gherkin Test Cases

Continue iterating on the BPMN, access patterns, and data model based on user feedback until the user explicitly approves all three.

Once approved, generate a comprehensive set of **Gherkin test scenarios** covering:
- The happy path end-to-end
- Each decision branch (including guard conditions)
- Error and rollback cases
- Boundary conditions (empty season, no teams, duplicate calls, etc.)
- Any new data model constraints

Use the format:

```gherkin
Feature: <Use Case Name>

  Background:
    Given <shared precondition>

  Scenario: <scenario title>
    Given <precondition>
    When <action>
    Then <expected outcome>
    And <additional assertion>
```

Save the Gherkin scenarios to a new file:
`docs/architecture/test-cases/<use-case-slug>.feature`

Where `<use-case-slug>` is the use case name in kebab-case (e.g. `simulate-game.feature`).

After saving, confirm the file path to the user and summarise what was produced across all four steps.
