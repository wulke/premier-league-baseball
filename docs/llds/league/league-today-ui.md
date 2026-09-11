# LLD: GameWorld Home "Today" Scoreboard (`game-world.tsx`)

> Backend LLD (unchanged sibling): [`league-today.md`](./league-today.md) ·
> EARS: `docs/specs/league/league-today-ui-specs.md` (`TODAYUI-001`..`TODAYUI-008`) ·
> Existing Gherkin: `test/ui/features/league-today-ui.feature` ·
> Decision records: [#101](https://github.com/wulke/premier-league-baseball/issues/101), [#301](https://github.com/wulke/premier-league-baseball/issues/301)

## Scope

Revise the GameWorld home page's inline "Today" presentation from tall game cards to a dense,
horizontal banner-style scoreboard. The section remains between "Season" and "Leagues", fetches
the existing `GET /api/league/:leagueId/today` endpoint once per league, and preserves the current
per-league grouping, backend chronological order, and empty-state omission behavior.

This is a presentation-only change. It consumes the existing `TeamSeasonGame` fields
(`homeTeamName`, `awayTeamName`, `homeTeamResult`, `awayTeamResult`, `status`, and `divisionName`;
plus the existing `scheduledDate` and `roundLabel` context) without an API, schema, logo, or
branding change. The backend sibling LLD is deliberately not changed.

## LID Gate

This revision was the design and EARS gate for #301. Issue #302 adds Red scenarios for
`TODAYUI-007` and `TODAYUI-008` before implementing the scoreboard in `src/ui/pages/game-world.tsx`.

## Interface / Data Model

### Existing input (unchanged)

```ts
type LeagueTodaySummary = {
  leagueId: number;
  leagueName: string;
  games: TeamSeasonGame[]; // backend-sorted ascending by scheduledDate
};
```

No new request, persisted state, component boundary, or backend type is introduced. The section
continues to render inline in `game-world.tsx`.

### Presentation-only derived values

```ts
type ScoreboardOutcome = 'home' | 'away' | 'none';

teamBadgeText(name: string): string;
// Use the initials of non-empty whitespace-delimited name words (for example,
// "New York Mets" -> "NYM"). If no word is available, use "?". This is a
// text placeholder, not a logo or a team-branding contract.

scoreboardOutcome(game: TeamSeasonGame): ScoreboardOutcome;
// Return 'home' or 'away' only when status is COMPLETED, both results are
// non-null, and one result is greater. Return 'none' for scheduled/in-progress,
// missing-score, and tied-result cases.
```

The derived values are computed in the client render path from the API response. They are not
written back to state or sent to the server.

## Logic Flow

```
1. Fetch and summary construction remain unchanged:
   - when the season is in progress and currentDate exists, fetch /today once per league
     alongside GetLeague/GetLeagueBracket; a non-ok/network response becomes []
   - preserve backend game order; build LeagueTodaySummary per league
                                                               # TODAYUI-001,TODAYUI-002,TODAYUI-006

2. Select leagues with games:
     leaguesWithGames = leagueTodaySummary.filter((league) => league.games.length > 0)
   If none exist, omit the whole Today section. Otherwise render it between Season and Leagues,
   retaining one league sub-block in the response's chronological game order.
                                                               # TODAYUI-003,TODAYUI-004,TODAYUI-005

3. For each game, render one horizontal scoreboard banner (not a vertically stacked detail card):
   - compact context: divisionName and, when present, roundLabel/scheduledDate
   - status: render "Final" for COMPLETED; otherwise render the current status label
   - two aligned team lanes: a text badge from teamBadgeText(name), team name, and score
   - completed score: homeTeamResult and awayTeamResult; unavailable scores render an em dash
   - no logo image, team-color, or external asset is requested; badge text is the v1 placeholder
                                                               # TODAYUI-007

4. Derive outcome from the completed numeric scores. Mark exactly the winning team lane with a
   non-colour-only winner indicator (for example, a visible "W" marker plus stronger text weight).
   A tied, missing, scheduled, or in-progress result receives no winner marker.
                                                               # TODAYUI-008
```

The banners may wrap on narrow viewports, but each game remains a single visual tile with the two
team lanes and scores paired together; responsive wrapping must not revert to the former full-detail
card layout.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | A league's `/today` fetch fails, is non-ok, or `currentDate` is unavailable | Keep the established degrade-to-empty behavior; no Today error UI or request for a null `currentDate`. | TODAYUI-002, TODAYUI-006 |
| u2 | No league, or a particular league, has games | Keep the established omission rules: omit empty league sub-blocks and omit Today entirely when all are empty. | TODAYUI-004, TODAYUI-005 |
| u3 | A completed game has equal or missing results | Render the available score values (or em dash), but derive `none` and display no winner marker. The UI does not invent a winner. | TODAYUI-008 |
| u4 | A scheduled or in-progress game has null results | Render its current status and em-dash score placeholders; no winner marker. | TODAYUI-007, TODAYUI-008 |
| u5 | Team-name data has multiple words, extra whitespace, or is empty | Derive initials from non-empty words; use `?` when no initials can be formed. Never request a logo or add a branding fallback. | TODAYUI-007 |
| u6 | Many games or narrow viewport | Retain the dense banner tile per game; normal responsive wrapping/scroll containment may be used, but no per-league cap or "show more" control is introduced. | TODAYUI-007 |

## Traceability

| Layer | Artifact |
|---|---|
| Backend sibling LLD (unchanged) | `docs/llds/league/league-today.md` |
| **This LLD** | `docs/llds/league/league-today-ui.md` |
| EARS | `docs/specs/league/league-today-ui-specs.md` — `TODAYUI-001`..`TODAYUI-008` |
| Gherkin | `test/ui/features/league-today-ui.feature` — `TODAYUI-001`..`TODAYUI-008` |
| Code | `src/ui/pages/game-world.tsx` |
| Decision records | [#101](https://github.com/wulke/premier-league-baseball/issues/101), [#301](https://github.com/wulke/premier-league-baseball/issues/301) |
