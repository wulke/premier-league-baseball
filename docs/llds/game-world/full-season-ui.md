# LLD: Full-Season UI (Bracket View, Champion Banner, Team Calendar Unification)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/game-world/full-season-ui-specs.md` (`UI-001`.., `LIFE-001`) ·
> Decision records: [#34](https://github.com/wulke/premier-league-baseball/issues/34) (lifecycle semantics),
> [#35](https://github.com/wulke/premier-league-baseball/issues/35) (UI flow mapping),
> [#39](https://github.com/wulke/premier-league-baseball/issues/39) (bracket UI),
> [#40](https://github.com/wulke/premier-league-baseball/issues/40) (champion UI) ·
> Depends on: `docs/llds/league/bracket-api.md` (`GetLeagueBracket` response shape), `docs/llds/game-simulation/simulate-game-ui.md` (existing `GameWorldProvider`/`AppHeader`/`refreshToken` patterns this extends)

## Scope

The UI-facing decisions for driving a full season across two concurrent competitions to
completion: no new season-level navigation is introduced — batch simulate already drives both
competitions, competition switching stays page-based, and three additions land inside the existing
page structure: a `BracketView` component (knockout counterpart to `StandingsTable`), a
competition-agnostic champion banner, and a unified cross-competition `TeamCalendar`. No new
GameWorld-level "season complete" gate is introduced (#34) — completion is computed from existing
per-competition checks.

## Interface / Data Model

### Season-lifecycle semantics (#34) — no new state

```ts
// purely derived, not persisted:
const leagueDecided = (bracketEntry) => bracketEntry.champion != null; // per top-tier division
const seasonComplete = (leagueEntries, cupEntry) =>
  leagueEntries.some((e) => topTier(e) && e.champion != null) && cupEntry.champion != null;
```

No new `GameWorld` field or state machine. `newSeason()` looping is out of scope for this MVP, so
there is no second-season state to gate into.

### `TeamCalendar` route unification (#35)

```ts
// src/ui/routes.tsx — route change
// before: /:gwId/:leagueId/team/:teamId/calendar
// after:  /:gwId/team/:teamId/calendar   (no longer nested under a league)

// src/api/endpoints.ts — unchanged, already supports omitting leagueId:
GetTeamSchedule = '/api/team/:teamId/calendar'   // TeamFactory.getSchedule(gwId, leagueId?)
```

Back-link changes from "League" to the `GameWorld` page. `src/ui/pages/league.tsx`'s team-click
navigation (`onTeamClick`, currently building the old nested path) updates to the new route.
`TeamFactory.getSchedule(gwId, leagueId?)` (`src/db/domain/team.ts:20-51`) needs **no backend
change** — `leagueId` is already optional and omitting it already returns all `DivisionSeason`s for
the team/year across leagues; the UI simply stops passing it.

`TeamCalendar` also stops reading `leagueId` from `useParams()`: only `gwId` and `teamId` are
consumed for the page fetch and breadcrumb, so a direct visit to `/:gwId/team/:teamId/calendar`
renders the combined season schedule with no missing-param fallback path.

### `BracketView` (superseded for tree rendering)

Decision #39's `BracketView` render details below are superseded by
[`docs/llds/league/bracket-tree-ui.md`](../league/bracket-tree-ui.md). That LLD owns the
round-column tree, bye-node, connector, responsive-scroll, winner-treatment, and component
extraction decisions. This document remains authoritative for the surrounding division branch,
champion banner, lifecycle, and calendar decisions.

Consumes the per-division entry from `GetLeagueBracket` (`docs/llds/league/bracket-api.md`):

```ts
const BracketView = ({
  rounds,
  onTeamClick,
}: {
  rounds: BracketRound[];   // from GetLeagueBracket — see bracket-api.md
  onTeamClick: (teamId: number) => void;
}) => { /* one Collapsible section per round; ties listed beneath */ };
```

Branch point in the existing Division `Collapsible` card (`src/ui/pages/league.tsx`):

```ts
{division.structure === 'KNOCKOUT'
  ? <BracketView rounds={division.rounds} onTeamClick={onTeamClick} />
  : <StandingsTable standings={division.standings} onTeamClick={onTeamClick} />}
```

Same `divisionName`/`roundLabel` styling as today — no new card chrome.

### Champion banner (new, `src/ui/pages/league.tsx`)

```ts
// Replaces/extends the League page's existing subtitle line:
// today: `{N} divisions · Season in progress`
// decided (Cup):    `🏆 Cup Champion: <team> · Final`
// decided (League): `🏆 <League> Champion: <team> · Table decided`
```

Reads the top-level `champion` field from the relevant `GetLeagueBracket` division entry(ies) — one
banner per League (top-tier division only for a round-robin League; trivially the single division
for a Cup), not one per Division card.

### GameWorld hub "Season Complete" block (new, `src/ui/pages/game-world.tsx`)

```ts
// Existing "Season — In Progress" block becomes computed from live league bracket fetches:
const seasonSummary = await Promise.all(
  leagues.map(async (league) => ({
    leagueId: league.id,
    leagueName: league.config.name,
    champion: await getTopLevelChampion(league.id), // from GetLeagueBracket
  }))
);
const seasonComplete = seasonSummary.every((league) => league.champion != null);
// renders either:
//   "Season — In Progress"
//   "Season {year} — Complete   🏆 Premier League: <team> · 🏆 League Cup: <team>"
```

League list rows (name + type badge + `→`) are unchanged — no per-row champion chip, since the
Season block above already names both champions once decided.

## Logic Flow

### Batch simulate (no change needed)

`GameFactory.simulateBatch` (`src/db/domain/game.ts`) already resolves games via
`League.gameWorldId` → all `Division`s → all `DivisionSeason`s with no League-specific filtering —
"Simulate Today" in `AppHeader` drives the League and the League Cup forward together today,
unmodified.

### Rendering a division card

```
1. League page fetches GetLeagueBracket(leagueId) (replaces/supplements GetLeagueStandings —
   the two payload shapes can be requested together or GetLeagueBracket can supersede standings'
   role; exact merge strategy is an implementation detail for the ticket, not locked here)
2. FOR each division entry:
     IF structure == 'KNOCKOUT' → render BracketView(rounds)
     ELSE → render StandingsTable(standings)
3. IF division.champion present AND division is top-tier (or the Cup's sole division):
     render champion banner in place of the "in progress" subtitle
4. IF division.champion present on the League page's champion-producing division:
     suppress/disable that page's simulate-triggering control for the decided competition
   navigation (team-click → calendar, BracketView expand-on-click) stays interactive; no
   dimming/watermark/final-layout treatment

### Computing the hub block from league brackets

```
1. GameWorld page reads gw.Leagues from GameWorldProvider as it does today
2. IF gw.config?.inProgress is false:
     preserve the existing "No active season" block and start-season CTA
3. ELSE:
     GET /api/league/:leagueId/bracket for each league row
4. FOR each league:
     pick the champion-producing division
       a. League type "League"      -> division.config.isTopTier === true
       b. League type "League Cup"  -> the sole division / first bracket entry
     resolve championTeamId -> team name from the League payload's Division team roster
5. Render "Season {year} — Complete" only when every league has a champion
6. OTHERWISE render "Season {year} — In Progress" with champion text for decided leagues and
   "In progress" for undecided leagues
```
```

### Bracket byes / series rendering (from the `BracketTie` shape, `bracket-api.md`)

```
FOR each round:
  ties.filter(kind === 'BYE') → grouped under "Byes (N) — auto-advanced to <next round>" subheading
  ties.filter(kind === 'SERIES') → one row per series:
     collapsed: "TeamA  [2–1, 2–0]  TeamB  ✓ TeamA (2–0)"
     expanded (click): one row per game in the series
IF a round has no games yet generated (mid-redraw): render "Next: <label> — games pending" placeholder
AND stop the bracket after that placeholder so the Final remains the last row shown for this MVP
IF a division has no games at all: render existing "No bracket yet — season not started." + TeamRoster grid
```

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | Only one League decided | Hub's Season block shows that champion + "In progress" for the other; header banner stays "In Progress" until **both** decided → "Season Complete." No intermediate three-state model — `decided` ≡ champion-row-exists, nothing between. | UI-002 |
| e2 | `TeamCalendar`'s existing "Competition" filter dropdown | Currently filters by division within one league; continues to work unchanged once the backing query is unscoped — it will naturally list divisions from both leagues. | UI-004 |
| e2a | `TeamCalendar` row for a knockout bye (`awayTeamId: null`, completed) | Render opponent as `Bye`, suppress the scoreline rather than showing `1-null`, and treat the row as played/completed for filter/count purposes. | UI-010 |
| e3 | Round-level competition labeling | No new row-level competition badge — existing `divisionName` + `roundLabel` (e.g. "Championship", "League Cup · 1st Round") already read as distinct competitions at a glance; not duplicated per-row. | — |
| e4 | Decided-but-interactive state | Explicitly **not** locked — team rows stay clickable to calendar, `BracketView` expand-on-click still works post-decision. Only the League-page simulate control for that decided competition disables/hides. | UI-003 |
| e5 | Multi-season transition UX | Out of scope for this MVP; flagged here as deferred to a future wayfinder map once this single-season MVP lands — "Start Season" does not reappear on the hub once decided (multi-season looping is out of scope). | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/game-world/full-season-ui.md` |
| EARS | `docs/specs/game-world/full-season-ui-specs.md` — `UI-001`.., `LIFE-001` |
| Code | `src/ui/pages/league.tsx` (`BracketView`, champion banner, division branch), `src/ui/pages/game-world.tsx` (Season block), `src/ui/routes.tsx` (calendar route), `src/db/domain/team.ts` (`getSchedule`, unchanged) |
| Decision records | [#34](https://github.com/wulke/premier-league-baseball/issues/34), [#35](https://github.com/wulke/premier-league-baseball/issues/35), [#39](https://github.com/wulke/premier-league-baseball/issues/39), [#40](https://github.com/wulke/premier-league-baseball/issues/40) |
