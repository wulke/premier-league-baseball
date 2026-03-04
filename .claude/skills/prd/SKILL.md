---
name: prd
description: Use this skill when the user wants to turn a completed use case design into a detailed implementation plan. Triggers on phrases like "build the implementation plan", "ready to implement", "create the prd", "plan out the tasks", "implementation tasks for", or when a user references a completed use case design doc. Always accept a use-case-slug as the primary argument.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Write
---

# PRD — Implementation Plan Skill

This skill converts an approved use case design into a concrete, ordered implementation plan. Every task in the plan must be independently deliverable and include specific acceptance criteria tied to test scenarios.

## Inputs

The primary input is a `use-case-slug` (e.g. `simulate-game`). From the slug, derive the following file paths and read each one:

1. **Design proposal:** `docs/architecture/design/<use-case-slug>-proposal.md`
2. **Gherkin tests:** `docs/architecture/test-cases/<use-case-slug>.feature`

Also read the following for architectural context before producing the plan:
- `docs/architecture/data-model/data-model.md`
- `src/api/router.ts` (or equivalent) — to understand existing routes
- `src/db/domain/` — to understand existing factory methods

If any file does not exist yet, note it as a gap and continue.

---

## Step 1 — Understand the Design

From the proposal doc, extract and summarise:

1. **Process flow** — the end-to-end BPMN steps, including all entry points, decision branches, error paths, and transaction boundaries.
2. **Access patterns** — the full table of READ/WRITE operations, which are new vs existing, and which entities are involved.
3. **Data model changes** — new fields, new tables, new indexes, and any noted cross-use-case impacts on existing flows (e.g. `newSeason()` needing to set `currentDate`).
4. **Implementation gaps** — anything flagged in the design as a known bug or gap in the current codebase.
5. **New API endpoints** — method, path, body, and purpose.

---

## Step 2 — Understand the Test Scenarios

From both `.feature` files, catalogue every scenario by category:

- Happy path scenarios
- Guard/validation failure scenarios
- Batch/skip behaviour scenarios
- Boundary condition scenarios
- Data integrity / rollback scenarios
- Status transition scenarios

Note which scenarios are already implemented (step files exist in `test/bdd/steps/`) and which are not yet implemented. This determines which tasks require new test code vs verification of existing tests.

---

## Step 3 — Produce the Implementation Plan

Output a structured implementation plan as a markdown document. The plan must follow these rules:

### Rules

1. **Ordered by dependency** — earlier tasks must not depend on later ones. Database/schema changes always come first, then domain layer, then API layer, then integration tests.
2. **Every task has acceptance criteria** — either a specific Gherkin scenario (by name), a specific Jest test assertion, or a named invariant that can be verified.
3. **New vs existing** — clearly distinguish tasks that create something new from tasks that modify something existing.
4. **No bundling** — each task covers exactly one logical change. Do not combine a schema change with a factory change in the same task.
5. **Test tasks are explicit** — writing test code (step definitions, unit tests) is its own task, not a footnote in an implementation task.

### Plan Format

```markdown
# Implementation Plan: <Use Case Name>

## Summary
<1-2 sentence description of what this plan implements>

## Pre-conditions
- <Any branch, migration state, or env assumptions>

---

## Task <N>: <Task Title>

**Type:** Schema change | Domain layer | API layer | Test | Bug fix
**File(s):** `<file path(s)>`
**Depends on:** Task <N-1> (or "none")

### What to implement
<Precise description of the change — specific field names, method signatures, enum values, etc.>

### Acceptance criteria
- Gherkin: `<Feature file> / Scenario: <scenario name>` passes
  OR
- Unit test: `<test file> — <test description>` passes
  OR
- Invariant: <observable behaviour that can be verified manually or via test>
```

Repeat the task block for every task in the plan.

---

## Step 4 — Save the Plan

Save the completed plan to:

`docs/architecture/prd/<use-case-slug>-plan.md`

Create the `docs/architecture/prd/` directory if it does not exist.

After saving, confirm the file path and print a summary table of all tasks:

| # | Title | Type | Depends On |
|---|-------|------|-----------|
| 1 | ... | ... | none |
| 2 | ... | ... | Task 1 |
| ... | | | |
