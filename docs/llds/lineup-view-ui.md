# LLD: Team Lineup View UI

> Upstream: [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md#hld-players-attributes-stats--contracts) · Backend sibling: [`lineup-read-api.md`](./lineup-read-api.md) · EARS: `docs/specs/lineup-view-ui-specs.md` (`LINEUI-001`..`LINEUI-004`) · Decision record: #138 / issue #200.

## Interface / Data Model

`TeamLineupView` is a read-only child of the existing `/:gwId/team/:teamId` hub. The hub adds a
`lineup` tab at `/:gwId/team/:teamId/lineup`.

```ts
GET /api/team/:teamId/lineup?gwId=:gwId -> TeamLineup
GET /api/team/:teamId/roster -> RosterPlayer[]
```

The lineup endpoint remains the source of assignments (`battingOrder`, `fieldingPosition`, starter,
bench, bullpen IDs); roster is used only as an ID-to-display-name lookup. The UI must not construct,
sort, or edit a lineup. `fieldingPosition: null` identifies the DH entry. The unique starter with
`fieldingPosition: Pitcher` is identified by `startingPitcherId` and is surfaced in a highlighted
starting-pitcher callout.

## Logic Flow

```
user opens Team Hub → Lineup tab
  → fetch active lineup scoped by gwId and the team's roster concurrently
  → index roster records by player ID
  → render batting starters in battingOrder 1..9
  → when a null-position starter exists, render it as a separate DH row
  → render the starting pitcher callout plus bench and bullpen ID pools
  → link every known player row to /:gwId/player/:playerId
```

## Edge Case Probe

| Condition | Handling |
|---|---|
| Lineup or roster request fails / returns 404 | Render no player rows; no editing or recovery control is introduced. |
| An ID from the lineup is absent from roster | Keep the row and use `Player #ID` as its link label; assignment visibility is not lost. |
| DH disabled | Nine batting rows include the pitcher at order nine; no DH row is rendered. |
| DH enabled | Nine batting rows retain orders 1..9, the null-position starter is a DH row, and the non-batting pitcher appears in the callout. |
| Bench or bullpen ordering changes upstream | Display each returned pool as-is; the API intentionally makes no ordering promise. |

## Traceability

| Layer | Artifact |
|---|---|
| Backend sibling | `docs/llds/lineup-read-api.md` |
| EARS | `docs/specs/lineup-view-ui-specs.md` |
| Gherkin | `test/ui/features/lineup-view-ui.feature` |
| Code | `src/ui/routes.tsx`, `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-lineup.tsx` |
