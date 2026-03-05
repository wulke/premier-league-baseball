# PRD: React BDD Testing Infrastructure

## Summary
Establish a robust Testing-Library + Jest-Cucumber infrastructure to enable BDD (Behavior-Driven Development) for the React frontend. This setup will allow us to verify UI requirements (like the Simulate Game UI) by simulating real user interactions in a browser-like environment (JSDOM).

## High-Level Requirements
1.  **Framework Consistency**: Use `jest-cucumber` for the Gherkin runner to match the backend BDD pattern.
2.  **User-Centric Testing**: Employ `React Testing Library` (RTL) to interact with components via roles and text rather than internal state.
3.  **Environment Isolation**: Configure "Jest Projects" to allow Node-based backend tests and JSDOM-based UI tests to coexist in the same suite.
4.  **Mocking Strategy**: Implement a standardized way to mock `fetch` / API responses so UI tests remain isolated from the database.
5.  **Referential Traceability**: Map UI Gherkin features to the use case designs in `docs/architecture/design/`.

---

## Task Breakdown

### Task 1: Update devDependencies
**File(s):** `package.json`
*   Add `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event`.
*   Add `jest-environment-jsdom`.
*   Add `whatwg-fetch` (to provide a global `fetch` in JSDOM).

### Task 2: Configure Jest Projects
**File(s):** `jest.config.js`
*   Refactor the config to use the `projects` array.
*   **Project 1 (Backend):** Match `test/bdd` and `test/db`, `testEnvironment: 'node'`.
*   **Project 2 (UI):** Match `test/ui`, `testEnvironment: 'jsdom'`.
*   Ensure `setupFilesAfterEnv` includes a new `test/ui/setup.ts` for `jest-dom` matchers.

### Task 3: Create UI Test Setup & Mocking Utility
**File(s):** `test/ui/setup.ts`, `test/ui/test-utils.tsx`
*   Initialize `jest-dom` matchers.
*   Create a `renderWithProviders` helper that wraps components in `BrowserRouter` or `GameWorldProvider` (if implemented).
*   Implement a simple `mockFetch` utility to define API responses per scenario.

### Task 4: UI BDD Scaffold — "Simulate Today" Action
**File(s):** `test/ui/features/simulate-batch-ui.feature`, `test/ui/steps/simulate-batch-ui.steps.test.tsx`
*   Create the first UI Gherkin feature based on the `simulate-game-ui-proposal.md`.
*   Implement the step definitions using RTL to click the "Simulate Today" button and verify the success summary.

### Task 5: Update `CLAUDE.md` and Scripts
**File(s):** `package.json`, `CLAUDE.md`
*   Add `npm run test:ui` to target only the UI project.
*   Document the new UI testing patterns in `CLAUDE.md`.

---

## Task Summary

| # | Title | Type | Depends On | Status |
|---|-------|------|------------|--------|
| 1 | Update devDependencies | Setup | none | Not Started |
| 2 | Configure Jest Projects (Node vs JSDOM) | Config | 1 | Not Started |
| 3 | UI Test Setup & Mocking Utility | Infrastructure | 2 | Not Started |
| 4 | UI BDD Scaffold: Simulate Batch UI | Feature | 3 | Not Started |
| 5 | Update Documentation & Scripts | Documentation | 4 | Not Started |
