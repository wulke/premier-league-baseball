# LLD: Game World Season Header Badge

## Interface / Data Model

`GameWorld` continues to provide `year`, `config.inProgress`, and `Leagues`.  The page keeps its
existing per-league champion lookup, deriving `seasonComplete` when every league has a champion;
no GameWorld-level completion state is persisted.

```ts
const seasonLabel = gw.config?.inProgress
  ? `Season ${gw.year} · ${seasonComplete ? 'Complete' : 'In Progress'}`
  : `Season ${gw.year + 1} · Ready to Start`;
```

## Logic Flow

1. Render `seasonLabel` in a compact `Badge` beside the Game World name in the page header.
2. Omit the former body-level `Season` section and its card entirely.
3. When no season is active, render `Start Season {year + 1}` beside the badge. Its existing
   confirmation, submitting, error, retry, revalidation, and navigation behavior remains in the
   header action area.
4. When a season is active, fetch each league's bracket as today and use its champion presence to
   distinguish `In Progress` from `Complete` in the badge.

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| One competition is decided while another is not | The badge remains `In Progress`; it does not enumerate champions in the compact header. | SHB-001 |
| Every competition is decided | The derived badge changes to `Complete` without persisting new GameWorld state. | SHB-001 |
| No active season | The badge identifies the next year as ready, and the adjacent action preserves the start-season flow. | SHB-002, SHB-003 |
| Start request fails | Keep the badge/action mounted and show retry feedback in the header action area. | SHB-003 |

## Traceability

- EARS: `docs/specs/game-world/season-header-badge-specs.md` (SHB-001..003)
- Gherkin: `test/ui/features/season-header-badge-ui.feature`
- Tests: `test/ui/steps/season-header-badge-ui.steps.test.tsx`
- Code: `src/ui/pages/game-world.tsx`
