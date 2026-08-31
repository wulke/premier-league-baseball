# LLD: Team Lineup View UI

> Upstream: [HLD: Lineup View — Defensive | Batting Tabs](../high-level-design.md#hld-lineup-view--defensive--batting-tabs) (extends [HLD: Players, Attributes, Stats & Contracts](../high-level-design.md#hld-players-attributes-stats--contracts)) · Backend sibling: [`lineup-read-api.md`](./lineup-read-api.md), [`roster-read-api.md`](./roster-read-api.md) (amended — see below) · EARS: `docs/specs/lineup-view-ui-specs.md` (`LINEUI-001`..) · Decision record: #138 / #200 (original) · #225 (this redesign).

## Scope

Redesigns the existing read-only Lineup tab (`/:gwId/team/:teamId/lineup`) from a two-panel
layout (batting-order card + separate Bench/Bullpen pool panels) into a **Defensive | Batting**
tabbed table, one row per starter, with bench and bullpen folded into each tab as inline
`BENCH`/`BULLPEN`-tagged rows. Covers only `src/ui/pages/team-lineup.tsx` and the one field this
redesign requires from the roster response. Does **not** cover:

- The lineup or roster **endpoint contracts** beyond the one field addition below — the request
  shape, auth-free access, and error handling of `GET /api/team/:teamId/lineup` and
  `GET /api/team/:teamId/roster` are unchanged and remain owned by
  [`lineup-read-api.md`](./lineup-read-api.md) / [`roster-read-api.md`](./roster-read-api.md).
- Any write path (editable position/role assignment) — [#226](https://github.com/wulke/premier-league-baseball/issues/226), undesigned.
- Per-game starting-pitcher / active-bullpen designation — [#243](https://github.com/wulke/premier-league-baseball/issues/243), its own LLD.
- Value/form/talent/appearance columns — [#227](https://github.com/wulke/premier-league-baseball/issues/227), blocked.
- A position-badge filter row — explicitly deferred out of v1 by the HLD; no spec exists for its absence.

## Interface / Data Model

No new endpoint. One field is added to the existing roster response (detailed and owned by
[`roster-read-api.md`](./roster-read-api.md)):

```ts
// src/api/models.ts — RosterPlayer amendment (ROST-011)
interface RosterPlayer {
  // …unchanged identity + primaryPosition + positionCoverage + flat-7 fields…
  positions: Record<PlayerPosition, number>; // NEW: verbatim 9-key rating map
}
```

This component reshapes `TeamLineup` (unchanged) + `RosterPlayer[]` (amended) into a UI-local row
shape — not a new wire type, just the client-side view model:

```ts
// src/ui/pages/team-lineup.tsx — local to the component, not exported
type LineupRowTag = 'STARTER' | 'BENCH' | 'BULLPEN';

interface LineupRow {
  tag: LineupRowTag;
  playerId: number;
  battingOrder: number | null;       // STARTER only; null for DH-less pitcher-batting slot n/a
  fieldingPosition: PlayerPosition | null; // STARTER only; null identifies the DH slot
  positionRating: number | null;     // Defensive tab only, STARTER rows only — RosterPlayer.positions[fieldingPosition]
}

// Local ordering constant — presentation-only, intentionally not imported from
// src/db/domain/player.ts (UI never imports across the domain-layer boundary)
const DEFENSIVE_TAB_ORDER: PlayerPosition[] = [
  'Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase',
  'Shortstop', 'LeftField', 'CenterField', 'RightField',
];
```

## Logic Flow

```
user opens Team Hub → Lineup tab (route unchanged: /:gwId/team/:teamId/lineup)
  → existing fetch: GET /api/team/:teamId/lineup?gwId=  (TeamLineup, unchanged)
              and:  GET /api/team/:teamId/roster        (RosterPlayer[], now carries `positions`)
  → index roster by playerId (unchanged)
  → build STARTER rows from lineup.starters (one per starter, 9 or 10 w/ DH)          # LINEUI-005
  → build BENCH rows from lineup.bench, BULLPEN rows from lineup.bullpen              # LINEUI-007
  → activeTab state, default 'DEFENSIVE'                                              # LINEUI-006
  → IF activeTab === 'DEFENSIVE':
      STARTER rows sorted by DEFENSIVE_TAB_ORDER (fieldingPosition; DH slot sorts last)
      each STARTER row's positionRating = roster.get(playerId)?.positions[fieldingPosition] ?? null   # LINEUI-008
      render: Tag | Player | Position | Rating
      append BENCH rows, then BULLPEN rows (Position/Rating columns blank)             # LINEUI-007
  → IF activeTab === 'BATTING':
      STARTER rows sorted by battingOrder (unchanged from pre-#225 behavior)
      render: Tag | Order | Player | Position (DH label when fieldingPosition === null)  # LINEUI-002/003
      append BENCH rows, then BULLPEN rows (Order/Position columns blank)               # LINEUI-007
  → every row links to /:gwId/player/:playerId (unchanged)                             # LINEUI-004
  → no mutating control on either tab (unchanged)                                      # LINEUI-004
```

### Key decisions embedded in this flow

- **`positions` sourced from the roster fetch, not a new call per starter.** The page already
  fetches the full roster (for display names); indexing it by `playerId` and reading
  `.positions[fieldingPosition]` costs nothing extra over today's `players` `Map`. This is what
  drove the `RosterPlayer` amendment in `roster-read-api.md` (ROST-011) rather than a bespoke
  per-lineup rating endpoint.
- **Defensive-tab ordering is a UI-local constant, not imported from the domain layer.**
  `PLAYER_POSITIONS`/`FIELDER_POSITIONS` live in `src/db/domain/player.ts`, which the UI must never
  import from (domain-ownership boundary, `backend-standards.md` §1). `DEFENSIVE_TAB_ORDER`
  duplicates the same 9-value order as a presentation-only constant; it has no domain logic to
  own, so this is not a Factory-boundary violation.
- **Rating fallback to `null`, not to a default number.** ROST-011 guarantees the 9-key map is
  always fully populated (see `roster-read-api.md` edge e7) — a `null` rating can only happen if
  the roster fetch itself failed or the player fell out of the roster map (the pre-existing
  fallback path `players.get(playerId)` already handles via `Player #ID`), never a genuinely
  missing rating. The Defensive tab renders an em dash for a `null` rating rather than crashing or
  inventing a number.
- **Bench/bullpen rows carry no position or rating on either tab.** A bench/bullpen player has no
  *assigned* fielding position — only a `primaryPosition`/`positionCoverage`, which this redesign
  deliberately doesn't surface on these rows (that's what the position-badge filter and
  eventual column-density work, #227, would use, not this table). Keeps the two tabs' row shapes
  uniform: only `STARTER` rows populate Position/Rating (Defensive) or Order/Position (Batting).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | Lineup or roster request fails / returns 404 | Render no rows on either tab; no editing or recovery control is introduced. (Unchanged from pre-#225.) | LINEUI-001 |
| u2 | DH disabled | Batting tab: nine rows include the pitcher at order nine, no DH row. Defensive tab: nine `STARTER` rows, pitcher included at its position. | LINEUI-002 |
| u3 | DH enabled | Batting tab: the null-position starter renders as a DH row; the non-batting pitcher appears via its `STARTER` row (position "Pitcher", no batting order). Defensive tab: ten `STARTER` rows (DH sorts last in `DEFENSIVE_TAB_ORDER`, since it has no fielding position). | LINEUI-003 |
| u4 | An ID from the lineup is absent from the roster map | Row is kept; player-link label falls back to `Player #ID` (unchanged); Defensive-tab rating renders as an em dash (no `positions` map available for that ID). | LINEUI-008 |
| u5 | Bench or bullpen ordering changes upstream | Each returned pool renders as-is, in its `BENCH`/`BULLPEN` block appended after the starters, on both tabs — the API makes no ordering promise (unchanged). | LINEUI-007 |
| u6 | User switches tabs | `activeTab` is local component state; switching re-renders the same fetched data with no refetch. Defaults to `DEFENSIVE` on initial render/navigation. | LINEUI-006 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-lineup-view--defensive--batting-tabs) |
| **This LLD** | `docs/llds/lineup-view-ui.md` |
| Sibling LLDs | `docs/llds/lineup-read-api.md` (lineup endpoint, unchanged), `docs/llds/roster-read-api.md` (`positions` amendment, ROST-011) |
| EARS | `docs/specs/lineup-view-ui-specs.md` — `LINEUI-001`.. |
| Gherkin | `test/ui/features/lineup-view-ui.feature` |
| Code | `src/ui/routes.tsx`, `src/ui/pages/team-hub.tsx`, `src/ui/pages/team-lineup.tsx`, `src/db/domain/team.ts` (`getRoster`), `src/api/models.ts` (`RosterPlayer`) |
| Decision record | #138, #200 (original) · #225 (this redesign) |
