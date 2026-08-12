# Agent Work Prompt

You are a coding agent working on **premier-league-baseball** — a full-stack TypeScript sports simulation game (Express + React + SQLite/Sequelize). All project context is in `CLAUDE.md` and `LID.md`.

## Your Job
Complete the assigned issue fully and submit a pull request as your final artifact. Do not start other issues.

## Branch Naming and Issue Tagging
Create a branch before making any changes:
- Bug: `bug/[issue-number]-[short-description]`
- Feature: `feat/[issue-number]-[short-description]`
- Other: `chore/[issue-number]-[short-description]`

Immediately after creating the branch, claim the issue so no other agent picks it up:
1. Add the `in-progress` label: `gh issue edit [number] --add-label "in-progress"`
2. Post a comment linking to your branch: `gh issue comment [number] --body "Starting work on branch \`[branch-name]\`."`

## LID: Walk the Arrow of Intent (required for every issue)
This repo follows Linked-Intent Development (`LID.md`): `HLD → LLD → EARS → Tests → Code`. You are running unattended, so **do not stop to wait for approval** at each design stage the way an interactive session would — instead, produce each artifact, move to the next stage, and let the PR description carry the full trail for human review.

1. **HLD** (`docs/high-level-design.md`) — only touch this for a change big enough to shift architecture. Most issues won't need it.
2. **LLD** (`docs/llds/[component-name].md`) — add or update the component design: data model, logic flow, edge-case probe.
3. **EARS** (`docs/specs/[feature-name]-specs.md`) — add or update requirement rows with stable IDs (e.g. `SIM-004`). If the issue references an existing spec ID, update its status marker instead of minting a new one.
4. **Tests (Red)** — write failing Gherkin scenarios and/or Jest tests tagged `@spec:[ID]` before any implementation. Confirm they fail.
5. **Code (Green)** — minimum implementation to pass, annotated with `// @spec [ID]`.

Commit the Red state and the Green state as separate commits.

### Where things live
- Backend Gherkin: `test/bdd/features/*.feature` + `test/bdd/steps/*.steps.test.ts`
- UI Gherkin: `test/ui/features/*.feature` + `test/ui/steps/*.steps.test.tsx`
- Domain/unit tests: `test/db/domain/*.test.ts`
- `@spec [ID]` must appear on: the Gherkin `Scenario` tag, the step-definition file header comment, and the implementing code's entry-point comment.

## By Issue Type

**Bug** — Walk the LID Arrow from the top: find where behavior diverges from EARS/LLD, update the relevant design doc, write a failing test that reproduces the bug (Red), then fix the code (Green).

**Feature** — Update or add the relevant LLD, update EARS specs, write failing tests annotated with `@spec [ID]` (Red), implement minimum code annotated with `@spec [ID]` (Green).

**Other** — Use judgment. Keep changes minimal. Apply Red → Green where tests are applicable.

## Validation Before Opening a PR
Run and ensure passing:
```bash
npm run build
npm test
```
For UI-affecting changes (anything under `src/ui/`, any `.tsx`, or any `.css` file), also run `npm run test:ui`.

## Pull Request
When done: push your branch and open a PR that references the issue (e.g. `Closes #[number]`) and describes what changed and why. Do not merge.

### Validation (required for every PR)

A PR is **UI-related** if it modifies any file under `src/ui/`, any `.tsx` file, or any `.css` file.

**For bug PRs only** — include a `Steps to Reproduce` block showing pre-fix behavior:
```
### Steps to Reproduce
**Preconditions:** <e.g. app running locally via npm run start>
1. <action>
2. <action>
**Observed:** <what happens before the fix>
```

**For all PRs** — include a `Validation` checklist showing how the human can confirm the fix or feature works:
```
### Validation
**Preconditions:** <e.g. app running locally, specific GameWorld/League state required>
- [ ] <screen or component to navigate to (required for UI changes)> → <expected result>
- [ ] <next step> → <expected result>
```

For UI changes, the checklist must name the specific screen or component (e.g. "Navigate to /:gwId/:leagueId → confirm Game rows render") and any data setup required (e.g. "start a GameWorld with an active season first").

## Rules
- Follow all instructions in `CLAUDE.md` and `LID.md`.
- Do not auto-commit anything outside the scope of this issue.
- Keep solutions minimal and focused — no speculative abstractions, no unrelated refactors.
- All code entry points and tests must carry `@spec [ID]` comments, scoped per-function/per-test/per-module rather than once at the top of a file.
