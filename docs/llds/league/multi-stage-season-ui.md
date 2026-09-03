# LLD: Multi-stage season UI surfacing

> Upstream: [`multi-stage-season.md`](./multi-stage-season.md) (run path) ·
> EARS: `docs/specs/league/multi-stage-season-ui-specs.md` (`MSUI-001`..`MSUI-003`) ·
> Decision record: [Map #78](https://github.com/wulke/premier-league-baseball/issues/78) → [#87](https://github.com/wulke/premier-league-baseball/issues/87) → [#162](https://github.com/wulke/premier-league-baseball/issues/162)

## Scope

Surface the old Champions League's existing multi-stage data on the existing League and
GameWorld screens. Reuse `StandingsTable` for the group divisions, `BracketView` for the
dependent knockout division, and the existing champion/season-complete displays. No route,
page, API, or simulation behavior changes.

## Interface / Data Model

The existing League response supplies flattened `Divisions` whose configs retain `stageId`,
`isTopTier`, and the knockout's selection:

```ts
type SeededKnockout = {
  config: {
    format: { structure: 'KNOCKOUT' };
    seedingSelection?: { kind: 'TOP_N_PER_DIVISION'; fromStage: string; topN: number };
    isTopTier?: boolean;
  };
};

const stageOriginLabel = (league, division): string | null =>
  division.config.seedingSelection?.kind === 'TOP_N_PER_DIVISION'
    ? `Seeded from completed ${stageName(league.config.stages, fromStage)}`
    : null;
```

`stageName` reads the matching configured stage name and falls back to “group stage” when a
legacy/partial response omits the stage metadata. Champion lookup first selects the division with
`isTopTier: true`; the single-division League Cup fallback remains for legacy cups.

## Logic Flow

1. The existing League page fetches League, standings, and bracket payloads.
2. Each round-robin group card follows the existing `StandingsTable` branch.
3. The knockout card follows the existing `BracketView` branch. If its config has
   `TOP_N_PER_DIVISION`, render its origin label above that unchanged bracket.
4. When the knockout bracket has a champion, select its `isTopTier` division for the existing
   League champion banner and GameWorld season summary.

## Edge Case Probe

| Condition | Handling | Spec |
|---|---|---|
| Knockout has not started | Keep the existing bracket empty state; the origin label still explains which completed phase will seed it. | MSUI-002 |
| Legacy single-division cup lacks `isTopTier` | Retain the existing first-division fallback for champion lookup. | MSUI-003 |
| Stage metadata is absent from a partial response | Use the generic “group stage” origin wording; do not suppress the bracket. | MSUI-002 |
| Group divisions have no knockout selection | Render their existing standings cards unchanged. | MSUI-001 |

## Traceability

| Layer | Artifact |
|---|---|
| LLD | `docs/llds/league/multi-stage-season-ui.md` |
| EARS | `docs/specs/league/multi-stage-season-ui-specs.md` |
| Gherkin | `test/ui/features/multi-stage-season-ui.feature` |
| Steps | `test/ui/steps/multi-stage-season-ui.steps.test.tsx` |
| Code | `src/ui/pages/league.tsx`, `src/ui/champion.ts` |
