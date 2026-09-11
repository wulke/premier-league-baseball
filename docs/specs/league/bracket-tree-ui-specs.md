# Specs: League Cup bracket-tree UI

Frontend requirements for replacing the League page's vertically stacked knockout accordion with
the League Cup's horizontal round-column bracket tree. These requirements are design-approved but
not yet implemented; they do not alter bracket generation, advancement, API contracts, routes, or
simulation behavior.

| ID | Requirement | Status |
|---|---|---|
| BRKT-001 | WHEN a KNOCKOUT division has no generated bracket rounds THE `BracketView` SHALL show `No bracket yet — season not started.` and the `TeamRoster` grid, and SHALL NOT draw a tree shell or future-round columns | [ ] → #312 |
| BRKT-002 | WHEN a KNOCKOUT bracket contains generated rounds IF its first `PENDING` round follows resolved rounds THE `BracketView` SHALL render columns only for the earlier generated rounds and one `Next: <label> — games pending` card after them, and SHALL NOT pre-draw later round columns; WHEN no round is pending THE `BracketView` SHALL render every generated round column and no pending card | [ ] → #312 |
| BRKT-003 | WHEN a rendered bracket round contains a `BYE` tie THE `BracketView` SHALL render it as one fixed-height tie node showing `Team A vs Bye` and its auto-advance outcome, rather than as an aggregated byes summary, so it retains its round-order slot | [ ] → #312 |
| BRKT-004 | WHEN a rendered tie is a multi-game `SERIES` THE `BracketView` SHALL show an aggregate summary in its collapsed fixed-height node and SHALL expand on click to show one detail row for each `BracketGame`, using the existing per-game score semantics | [ ] → #312 |
| BRKT-005 | WHEN a rendered tie has a `winnerTeamId` THE `BracketView` SHALL visibly highlight the matching team row and dim the opposing row; WHEN it has no winner THE `BracketView` SHALL render both team rows with neutral treatment | [ ] → #312 |
| BRKT-006 | WHEN rendering a bracket generated with either `FIXED` or `REDRAW` seeding THE `BracketView` SHALL use the response's round order and tie-array order as the tree coordinates, connecting tie index `i` to tie index `Math.floor(i / 2)` in the next round without recomputing seeding order | [ ] → #312 |
| BRKT-007 | WHEN a completed or current tie advances to a next-round tie THE `BracketView` SHALL draw its CSS-border/pseudo-element connector from the fixed-height collapsed node shell to the next-column slot; WHEN that tie is expanded THE game-detail region SHALL flow below the shell without changing connector alignment or tie-slot coordinates | [ ] → #312 |
| BRKT-008 | WHEN the bracket columns exceed the available viewport width THE `BracketView` SHALL make the fixed-minimum-width columns horizontally scrollable and SHALL NOT substitute a mobile tree layout; WHEN a multi-stage knockout has a `stageOriginLabel` THE League page SHALL render that label one line above the complete `BracketView` rather than inside a round column | [ ] → #312 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| LLD | [`docs/llds/league/bracket-tree-ui.md`](../../llds/league/bracket-tree-ui.md) |
| Superseded requirements | [`docs/specs/game-world/full-season-ui-specs.md`](../game-world/full-season-ui-specs.md) — UI-005..UI-008 |
| Compatible consumer | [`docs/llds/league/multi-stage-season-ui.md`](../../llds/league/multi-stage-season-ui.md) — the division-level `stageOriginLabel` behavior remains valid |
| Future Gherkin | `test/ui/features/bracket-tree-ui.feature` |
| Future steps | `test/ui/steps/bracket-tree-ui.steps.test.tsx` |
| Future code | `src/ui/components/bracket-view.tsx`, `src/ui/pages/league.tsx` |
| API/source data | `src/api/models.ts` (`BracketRound`, `BracketTie`, `BracketGame`) |
