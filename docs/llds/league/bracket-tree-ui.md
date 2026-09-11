# LLD: League Cup bracket-tree UI

> Upstream: [HLD: Full Season Simulation](../../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> Supersedes: the `BracketView` section of [`docs/llds/game-world/full-season-ui.md`](../game-world/full-season-ui.md) (decision [#39](https://github.com/wulke/premier-league-baseball/issues/39)) ·
> Depends on: [`knockout-bracket.md`](./knockout-bracket.md) (round ordering and advancement), [`bracket-api.md`](./bracket-api.md) (read model), [`multi-stage-season-ui.md`](./multi-stage-season-ui.md) (shared knockout consumer) ·
> Decision record: [#295](https://github.com/wulke/premier-league-baseball/issues/295) ·
> Proposed EARS: `BRKT-001`..`BRKT-008` (approval gate; no EARS rows are created by this design-only slice)

## Scope

Replace the League page's vertically stacked knockout accordion with a horizontally advancing,
round-column tree. The work extracts `BracketView` from `src/ui/pages/league.tsx` into
`src/ui/components/bracket-view.tsx`; the League page continues to own fetching, the division
branch, team navigation, and the `stageOriginLabel` placement.

The tree renders only rounds that the existing bracket response has generated. It does not change
bracket generation, advancement, seeding, API contracts, routes, or simulation behavior. This LLD
supersedes only decision #39's `BracketView` render section in `full-season-ui.md`; that document's
champion banner, season lifecycle, and calendar-route decisions remain authoritative.

## Interface / Data Model

`BracketView` continues to consume the existing `BracketRound`, `BracketTie`, and `BracketGame`
read models from `src/api/models.ts`. No backend or API changes are required.

```ts
type BracketViewProps = {
  rounds: BracketRound[];
  teams: Team[];
  onTeamClick: (teamId: number) => void;
};

// Tree geometry is derived, never persisted:
// column index = index of a generated round in rounds
// node index   = index of a tie in round.ties
// parent node  = round[n + 1].ties[Math.floor(nodeIndex / 2)]
```

The round order and a tie's array position are already the bracket coordinates. For `FIXED`, the
advancement path pushes winners in bracket order; for `REDRAW`, it pushes the newly drawn order.
In either mode, adjacent current-round ties therefore map to their containing next-round tie via
`Math.floor(tieIndex / 2)`. A `BYE` remains a first-class `BracketTie` node: it renders as
`Team A vs Bye` rather than being removed or summarized separately. This preserves one node slot
per tie and a uniform collapsed node height.

The component maintains local expansion state keyed by round plus tie identity/index. It has no
new data-fetching or mutation interface. `stageOriginLabel` remains a division-level line in the
League page, immediately above the whole `BracketView`, not inside a round column.

## Logic Flow

1. The League page keeps its existing `KNOCKOUT` branch and renders the extracted `BracketView`
   with the division's bracket rounds, teams, and team-click callback. When a multi-stage knockout
   is seeded from groups, it renders `stageOriginLabel` (for example, `Seeded from completed Group
   Stage`) one line above the tree. This preserves `multi-stage-season-ui.md`'s unchanged reuse of
   `BracketView`.
2. If `rounds` is empty, retain the existing “No bracket yet — season not started.” empty state and
   `TeamRoster`; no tree shell or speculative future columns are drawn.
3. Find the first `PENDING` round. Render a column for each earlier generated round only. After the
   final rendered column, retain the existing `Next: <label> — games pending` placeholder card for
   that first pending round. Do not render empty columns after it. If no round is pending, render
   all generated round columns and no placeholder.
4. Each column has a fixed minimum width; the tree wrapper uses `overflow-x: auto` so narrow
   screens scroll horizontally. There is no alternate mobile tree layout.
5. For every tie in a rendered round, create exactly one collapsed-height node in `round.ties`
   order. A `SERIES` node shows its aggregate/summary; a `BYE` node shows `Team A vs Bye` and its
   auto-advance outcome. Team names retain the current team-click navigation behavior.
6. A series node remains click-to-expand. Its collapsed view is the aggregate summary; its expanded
   region shows one row for each `BracketGame`, using the existing per-game score semantics. The
   expansion grows below the fixed collapsed node shell and does not alter the one-slot-per-tie
   coordinate used for connectors.
7. When `winnerTeamId` is available, give the matching in-node team row a visible winner treatment
   (such as bold type and winner color) and the opposing row a dimmed treatment. This replaces
   winner recognition that depends only on the textual `✓ TeamName` suffix. Before a winner exists,
   both team rows use the neutral treatment.
8. Draw each completed/current tie's advancement path to the corresponding next-column slot with
   CSS borders and pseudo-elements. A node at index `i` connects to `Math.floor(i / 2)` in the next
   round. No SVG overlay or third-party dependency is introduced. The fixed collapsed node height,
   including BYE slots, makes CSS connector alignment stable; expanded game details are outside the
   connector geometry.

## Edge Case Probe

| Condition | Handling | Proposed spec |
|---|---|---|
| No generated games/rounds | Preserve the current empty state plus `TeamRoster`; do not draw a blank tree. | BRKT-001 |
| First pending round follows generated rounds | Stop the tree at the generated columns and show the existing `Next: <label> — games pending` card; never pre-draw later rounds. | BRKT-002 |
| Round-one bye | Render one regular node slot as `Team A vs Bye`, not an aggregated `Byes (N)` card, so it participates in vertical spacing and connector geometry. | BRKT-003 |
| Multi-game series | Preserve click-to-expand behavior and render one game-detail row per `BracketGame`; collapsed node remains a narrow summary. | BRKT-004 |
| Winner known or unknown | Bold/highlight the winning team and dim the loser when `winnerTeamId` is set; leave both neutral when it is absent. | BRKT-005 |
| `FIXED` or `REDRAW` seeding | Use response round order and tie index only; both advancement modes already produce the appropriate next-round array order. | BRKT-006 |
| Expanded node near a connector | Keep connector anchors on fixed collapsed node shells; expanded detail flows below instead of changing slot-to-slot alignment. | BRKT-007 |
| Narrow viewport or multi-stage knockout | Horizontally scroll fixed-width columns; keep `stageOriginLabel` above the full tree at division level. No mobile variant or multi-stage special component. | BRKT-008 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| LLD | `docs/llds/league/bracket-tree-ui.md` |
| Superseded LLD section | `docs/llds/game-world/full-season-ui.md` — decision #39 `BracketView` section only |
| Compatible consumer | `docs/llds/league/multi-stage-season-ui.md` — reuses `BracketView` unchanged; its division-level origin label remains above the tree |
| Proposed EARS | `docs/specs/league/bracket-tree-ui-specs.md` — `BRKT-001`..`BRKT-008` (to be created after LLD approval) |
| Future UI tests | `test/ui/features/bracket-tree-ui.feature`, `test/ui/steps/bracket-tree-ui.steps.test.tsx` |
| Future code | `src/ui/components/bracket-view.tsx`, `src/ui/pages/league.tsx` |
| API/source data | `src/api/models.ts` (`BracketRound`, `BracketTie`, `BracketGame`) |
