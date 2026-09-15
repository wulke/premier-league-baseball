# Specs: Game World Season Header Badge

| ID | Requirement | Status |
|---|---|---|
| SHB-001 | WHEN the Game World home page renders an active season THE system SHALL show a compact header badge with the current season year and a derived `In Progress` or `Complete` status, and SHALL NOT render a body-level Season card or champion summary | [x] → #328 |
| SHB-002 | WHEN the Game World has no active season THE system SHALL show a compact header badge identifying the next season year as ready to start and an adjacent `Start Season` entry point | [x] → #328 |
| SHB-003 | WHEN the player starts a season from the header entry point THE system SHALL preserve the existing confirmation, submitting, retry, revalidation, and post-success navigation flow | [x] → #328 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- LLD: `docs/llds/game-world/season-header-badge.md`
- Gherkin: `test/ui/features/full-season-ui.feature`
- Tests: `test/ui/steps/full-season-ui.steps.test.tsx`
- Code: `src/ui/pages/game-world.tsx`
