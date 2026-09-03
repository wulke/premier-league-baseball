# LLD: GameWorld Home "Today" Section (`game-world.tsx`)

> Backend LLD (sibling): [`league-today.md`](./league-today.md) ·
> EARS: `docs/specs/league/league-today-ui-specs.md` (`TODAYUI-001`..`TODAYUI-006`) ·
> Gherkin: `test/ui/features/league-today-ui.feature` ·
> Decision record: [#101](https://github.com/wulke/premier-league-baseball/issues/101), resolved via `/grill-me`

## Scope

Adds a "Today" section to the GameWorld home page (`src/ui/pages/game-world.tsx`), between the
existing "Season" section and the "Leagues" list section. Calls the new
`GET /api/league/:leagueId/today` endpoint (backend LLD) once per league, reusing the same
per-league `Promise.all` fetch group the page already runs for `GetLeague`/`GetLeagueBracket`
(season-summary champion lookup) — one more per-league call fits the existing pattern.

## Interface / Data Model

### `game-world.tsx` (MODIFIED)

```ts
type LeagueTodaySummary = {
  leagueId: number;
  leagueName: string;
  games: TeamSeasonGame[];   // already sorted ascending by scheduledDate (backend-sorted)
};

// NEW state, populated alongside the existing leagueSeasonSummary effect:
//   leagueTodaySummary: LeagueTodaySummary[]
```

No new component is introduced — the section renders inline in `game-world.tsx`, matching the
existing "Season"/"Leagues" sections' inline-JSX style on this page rather than extracting a
component prematurely.

## Logic Flow

```
1. Existing effect (game-world.tsx, gated on gw?.config?.inProgress and gw.Leagues.length > 0)
   is extended: for each league, add a third parallel fetch alongside GetLeague/GetLeagueBracket:

     // TODAYUI-006: a null currentDate makes the request a guaranteed 422 (TODAY-002)
     // that only produces server-side log noise — the fetch is skipped entirely and
     // the league behaves as an empty window.
     gw?.currentDate == null
       ? Promise.resolve([])
       : fetch(Endpoints.GetLeagueToday.replace(':leagueId', String(leagueRow.id)))
           .then((response) => (response.ok ? response.json() : []))
           // non-ok (e.g. 422, or any network error) resolves to [] rather than
           // rejecting — a league with no "today" data behaves identically to a
           // league with an empty window.                                              # TODAYUI-002

2. Build leagueTodaySummary from the per-league results:
     { leagueId, leagueName: leagueRow.config?.name ?? `League ${leagueRow.id}`, games }
   games arrive pre-sorted from the backend (TODAY-005) — no client-side re-sort.            # TODAYUI-001

3. Render (between the Season section and the Leagues section):
     leaguesWithGames = leagueTodaySummary.filter(l => l.games.length > 0)
     IF leaguesWithGames.length === 0 -> render nothing (whole Today section omitted)         # TODAYUI-005
     ELSE:
       <section> "Today"
         FOR each league in leaguesWithGames:
           sub-block header: league.leagueName
           list of league.games, each row showing:
             scheduledDate, homeTeamName vs awayTeamName, divisionName/roundLabel,
             status, and (if COMPLETED) homeTeamResult–awayTeamResult
                                                                                    # TODAYUI-003,TODAYUI-004
```

Leagues with `games.length === 0` are simply absent from `leaguesWithGames` — no explicit
"no games" placeholder block is rendered per league (settled decision: omit rather than show an
empty message).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | A league's `/today` fetch fails (network error, or 422 because the GameWorld has no `currentDate` configured) | Resolved to `[]` in the fetch chain itself (step 1), identical to how the existing champion-lookup fetch in this same effect already defaults to `{}`/`[]` on non-ok — no new error UI, no console noise beyond the existing `.catch` at the `Promise.all` level. | TODAYUI-002 |
| u2 | GameWorld season not in progress (`gw.config.inProgress` false) | The whole effect (all three per-league fetches) already short-circuits to empty state today — `leagueTodaySummary` stays `[]`, Today section renders nothing. No new gating needed. | TODAYUI-005 |
| u3 | A league has games, but all of them are older than the window on a stale read (race between `currentDate` changing and this fetch) | Not specifically guarded — the backend is the source of truth for the window; a stale response before invalidation just shows a slightly outdated Today slate until the next fetch, same staleness characteristics as the existing champion/bracket summary already has. | — |
| u4 | Many leagues, each with several games — visual noise | Not addressed in this pass; each league's block just renders its full window list. No per-league cap or "show more" was requested. | TODAYUI-003 |

## Traceability

| Layer | Artifact |
|---|---|
| Backend sibling LLD | `docs/llds/league/league-today.md` |
| **This LLD** | `docs/llds/league/league-today-ui.md` |
| EARS | `docs/specs/league/league-today-ui-specs.md` — `TODAYUI-001`..`TODAYUI-005` |
| Gherkin | `test/ui/features/league-today-ui.feature` |
| Code | `src/ui/pages/game-world.tsx` |
| Decision record | [#101](https://github.com/wulke/premier-league-baseball/issues/101) |
