# Linked-Intent Development (LID)

This project follows the **LID methodology**. All agents MUST adhere to the **Arrow of Intent** for feature additions and bug fixes.

## The Arrow of Intent
All changes start with intent, moving from high-level to low-level:
`HLD → LLD → EARS → Tests → Code`

1.  **HLD (High-Level Design)**: Architectural strategy and trade-off decisions.
2.  **LLD (Low-Level Design)**: Detailed component design and edge-case probing.
3.  **EARS (Specs)**: Formalized requirements (Easy Approach to Requirements Syntax).
4.  **Tests (TDD)**: Implementation-verifying tests annotated with requirement IDs.
5.  **Code (Dev)**: Minimal implementation annotated with requirement IDs.

**MANDATORY**: Pause and wait for user approval after each design stage (HLD, LLD, EARS).

## Core Principles
- **Documentation is Truth**: Code is the "compiled" output of design. If they disagree, the documentation wins; fix the code or update the design and cascade the change.
- **Intent Gaps > Bugs**: Most failures are misaligned intent. When a bug is found, "walk the arrow" from the top down to identify where the intent diverged.
- **Traceability**: All code entry points and tests must carry `@spec [ID]` comments (e.g., `# @spec APP-AUTH-001`).

## Design Templates

### HLD (`docs/high-level-design.md`)
- **Goal**: Clear objective.
- **Strategy**: Compare options and state the chosen path + why.
- **Architecture**: High-level component flow.
#### HLD Template
Path: `docs/high-level-design.md`
```markdown
# HLD: [Feature Name]

## Goal
Short description of the objective.

## Strategy
- **Options**: [Briefly list alternatives]
- **Decision**: [Chosen path + Why]

## Architecture
- [High-level components/flow]
```
### LLD (`docs/llds/*.md`)
- **Data Model**: Key types or schemas.
- **Logic Flow**: Sequential steps or pseudocode.
- **Edge Case Probe**: Explicitly list potential failures and how they are handled.
#### LLD Template
Path: `docs/llds/[category]/[component-name].md` (categories: `game-world`, `league`, `player`, `manager`, `game-simulation`, `notifications`, `shell` — mirrors `docs/specs/`)
```markdown
# LLD: [Component Name]

## Interface / Data Model
[Key types, signatures, or schemas]

## Logic Flow
[Sequential steps or pseudocode]

## Edge Case Probe
- [Condition] -> [Handling]
```

### EARS (`docs/specs/*.md`)
Format: `ID | Requirement | Status`
- **ID**: Unique identifier (e.g., `FEAT-001`).
- **Requirement**: `[WHEN] [IF] THE <SYSTEM> SHALL <RESULT>`.
- **Status**: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.
#### EARS Template
Path: `docs/specs/[category]/[feature-name]-specs.md` (categories: `game-world`, `league`, `player`, `manager`, `game-simulation`, `notifications`, `shell`)
Format: `ID | Description | Status`
```markdown
# Specs: [Feature Name]

| ID | Requirement | Status |
|---|---|---|
| [ID]-001 | [WHEN] [IF] THE <SYSTEM> SHALL <RESULT> | [ ] |
```
*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

When a GitHub issue is created for a spec, annotate it with `→ #N` after the status marker:
```
**SIM-001** `[ ]` → #12
```
Specs without `→ #N` still need an issue. Grep for `→ #` to see all covered specs.

## Pairing EARS with Gherkin Acceptance Scenarios

This project pairs formal EARS requirements with executable Gherkin (jest-cucumber) acceptance scenarios. EARS is the *what/why* — the atomic behavioral rule carrying a stable ID. Gherkin is the *executable example* that proves the rule. The two are linked **only by the `@spec [ID]` token** — the same token used to trace code.

- **Cardinality**: one EARS row → many Gherkin scenarios. The happy path and each guard/error branch map to scenarios; each distinct guard typically gets its own ID.
- **`@spec` as a Gherkin tag**: tag each `Scenario` with `@spec:[ID]` (colon, no space — Gherkin tags cannot contain whitespace) so the binding is first-class Gherkin metadata (jest-cucumber can filter on tags). A scenario covering multiple requirements takes multiple tags, e.g. `@spec:SIM-012 @spec:SIM-013`. This is the same token style used in code comments — one convention across the whole arrow.
- **Locations** (kept separate, linked by ID only — never collocated):
  - EARS tables → `docs/specs/[category]/[feature]-specs.md`
  - Gherkin features → `test/bdd/features/[feature].feature` (backend) and `test/ui/features/[feature].feature` (UI)
- **One canonical copy per feature**: a `.feature` file is inherently implementation-agnostic; the binding to code lives in its step definitions. Do not maintain a parallel "agnostic" copy of a `.feature` — that creates a silent drift bug.

### Traceability surfaces (where `@spec [ID]` must appear)
1. **Gherkin** — a `@spec [ID]` tag on each `Scenario`.
2. **Step definitions** — a comment atop the `.steps.test.ts` listing every ID it binds (e.g., `// @spec SIM-001..SIM-007`).
3. **Code** — a comment at the entry point listing every ID it implements (e.g., `// @spec SIM-001,SIM-002`).

### Example (feature prefix `SIM-`)

`docs/specs/game-simulation/simulate-game-specs.md` (EARS):
```
| SIM-001 | WHEN the player simulates a SCHEDULED game by id IF scheduledDate ≤ GameWorld currentDate THE system SHALL set status COMPLETED and populate both results | [ ] |
```

`test/bdd/features/simulate-game.feature` (acceptance):
```
@spec:SIM-001
Scenario: Simulate a scheduled game on its scheduled date
  ...
```

`test/bdd/steps/simulate-game.steps.test.ts` (binding):
```
// @spec SIM-001..SIM-007  (simulate-game acceptance)
const feature = loadFeature(path.resolve(__dirname, '../features/simulate-game.feature'));
```

`src/api/handlers.ts` (implementation):
```
// @spec SIM-001,SIM-002,SIM-003
export const simulateGame = async ...
```

## Bug Fixing (Intent Gap Protocol)
1. **Locate**: Find where behavior diverges from existing EARS/LLD.
2. **Fix Intent**: Update the HLD/LLD/EARS to reflect the corrected behavior.
3. **Cascade**: Update tests, then update code.

