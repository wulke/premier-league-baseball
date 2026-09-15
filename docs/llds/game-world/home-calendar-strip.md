# LLD: Home Calendar Strip — Cross-Competition Date-Range Query

> Upstream: [HLD: Game World Home Page Overhaul](../high-level-design.md#hld-game-world-home-page-overhaul) ·
> EARS: `docs/specs/game-world/home-calendar-strip-specs.md` (`CALW-001`..) ·
> UI sibling: [`home-calendar-strip-ui.md`](./home-calendar-strip-ui.md) ·
> Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326)

## Scope

Extends the existing `TeamFactory(id).getSchedule` (`src/db/domain/team.ts`) and its endpoint
`GET /api/team/:teamId/calendar` (`TSCH-001`..`TSCH-004`, `docs/specs/manager/team-schedule-read-api-specs.md`)
with an optional `{ from, to }` date window and a per-game competition tag, so the GameWorld home
page can request "this club's games across every competition, in this date range" in one call.
`TSCH-001`..`TSCH-004` are referenced, not restated — their behavior (team-name resolution,
season-year scoping, bye/round-label handling) is unchanged.

Out of scope:
- The `LeagueFactory.getToday` removal (`src/db/domain/league.ts`, `GET /api/league/:leagueId/today`)
  is part of this same change — its only caller is replaced by this query — but its own behavior
  (`TODAY-001`..`TODAY-007`) is not redesigned, just deleted as dead code.
- Rendering — see the UI sibling LLD.
- Any new "requires action" data source, per-game detail endpoint, or other #325 child ticket
  (#327, #328, #329, #330, #331, #332, #333) — each is its own LLD if/when it needs one.

## Interface / Data Model

### Route (existing, extended)

```ts
// src/api/endpoints.ts — GetTeamSchedule unchanged, gains two optional query params
GetTeamSchedule = '/api/team/:teamId/calendar'   // GET ?gwId=<id>&leagueId=<id?>&from=<YYYY-MM-DD?>&to=<YYYY-MM-DD?>
```

`from`/`to` are both-or-neither: the router only builds a `range` when both are present (partial
pairs are treated as absent — see e7).

### Handler (thin pass-through, matching `getTeamSchedule` today)

```ts
// src/api/handlers.ts
const getTeamSchedule = async (
  teamId: number,
  gwId: number,
  leagueId?: number,
  range?: { from: string; to: string },
) => {
  return await TeamFactory(teamId).getSchedule(gwId, leagueId, range);
};
```

### Domain — `TeamFactory(id).getSchedule`

```ts
interface ITeam {
  // ...existing members
  getSchedule: (
    gwId: number,
    leagueId?: number,
    range?: { from: string; to: string },   // NEW — inclusive scheduledDate window, 'YYYY-MM-DD'
  ) => Promise<TeamSeasonCalendar>;
}
```

### Response (`src/api/models.ts`, extended)

```ts
interface TeamSeasonGame {
  // ...existing fields unchanged (gameId, year, scheduledDate, homeTeam*, awayTeam*,
  // divisionId, divisionName, roundLabel, homeTeamResult, awayTeamResult, status)
  leagueId: number;    // NEW — the owning League, resolved via the game's Division
  leagueName: string;  // NEW — divisionName alone doesn't say which competition
}

interface TeamSeasonSchedule {
  teamId: number;
  teamName: string;
  teamBadge?: string;
  games: TeamSeasonGame[];
  seasonStart: string | null;   // NEW — MIN(scheduledDate) over the team's full current-year
                                 //       games (unwindowed), 'YYYY-MM-DD'; null if no games
  seasonEnd: string | null;     // NEW — MAX(scheduledDate), same scope; null if no games
}

type TeamSeasonCalendar = TeamSeasonSchedule;   // unchanged alias
```

`seasonStart`/`seasonEnd` are always computed and returned, whether or not `range` was passed —
one response shape regardless of caller, so `team-calendar.tsx` (which never passes `range`) gets
two harmless extra fields rather than a conditional contract.

## Logic Flow

```
1-6. Unchanged from today's getSchedule (TSCH-001, TSCH-002):
       resolve Team + GameWorld, resolve every Division the team has a DivisionSeason
       in (optionally narrowed to `leagueId`), batch-fetch DivisionSeason+Game rows,
       bulk-fetch referenced team names.
     PLUS: while resolving Divisions (step 3), also capture each division's owning
       League identity into a lookup:
         divisionLeagueMap: Map<divisionId, { leagueId: number; leagueName: string }>
                                                                          # CALW-003
       (the existing Division query already `include`s League for gameWorldId
        scoping — leagueId/leagueName are already on hand, just not carried forward)

7. Build `games: TeamSeasonGame[]` exactly as today (TSCH-004's field derivation:
     bye handling, KNOCKOUT round labels), plus:
       leagueId:   divisionLeagueMap.get(divisionId).leagueId
       leagueName: divisionLeagueMap.get(divisionId).leagueName            # CALW-003

8. seasonStart = games.length ? min(games.map(g => g.scheduledDate).filter(notNull)) : null
   seasonEnd   = games.length ? max(...) : null
   — computed over the FULL (unwindowed) games array, before any range filter        # CALW-002

9. IF range is provided:
     games = games.filter(g =>
       g.scheduledDate != null && g.scheduledDate >= range.from && g.scheduledDate <= range.to
     )                                                                    # CALW-001,CALW-006
     — plain string comparison on 'YYYY-MM-DD', no date parsing/coercion and no
       validation of from/to, consistent with TSCH-003's implicit-validation
       convention (backend-standards §3: no explicit param validation at the
       router). A malformed or reversed range simply yields fewer/zero rows.     # CALW-005

10. return { teamId, teamName, teamBadge, games, seasonStart, seasonEnd }
```

### Key decisions embedded in this flow

- **Post-filter in JS, not pushed into the SQL `where`**: the existing method already fetches every
  DivisionSeason-linked Game for the resolved divisions/year (that's what "full season" means
  today); windowing the already-in-memory array is the smallest diff that reuses the identical
  traversal for both the full-season caller (`team-calendar.tsx`) and the new windowed caller, and
  keeps the dataset size (one team's one-season games) far below where a DB-level filter would
  matter. Revisit only if a future caller needs a much larger unfiltered scan.
- **`seasonStart`/`seasonEnd` derived from the FULL games array, not the windowed one**: computing
  them from `games` *before* the range filter is what makes them usable for client-side clamping —
  bounds derived from an already-windowed array would just echo the window back.
- **Always-present response fields**: per the HLD's Key Trade-off, no stored season-bounds column
  exists or is added; deriving them per-request on every call (windowed or not) is one response
  shape instead of two, at the cost of a trivial extra `min`/`max` reduce on data already in memory.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `range` omitted (existing `team-calendar.tsx` caller) | Full season returned unchanged (TSCH-001/TSCH-002 behavior); `seasonStart`/`seasonEnd` still computed and included. | CALW-001 |
| e2 | Team has zero games in the GameWorld's current year | `games: []`, `seasonStart: null`, `seasonEnd: null` — no division/DivisionSeason short-circuit changes from TSCH's existing `[]`-returning paths. | CALW-002 |
| e3 | Team's games span multiple Leagues (e.g. Premier League + League Cup) in the requested window | Each game tagged with its own `leagueId`/`leagueName` via `divisionLeagueMap`, independent of `divisionName`. | CALW-003 |
| e4 | A knockout bye (`awayTeam` null) falls inside the window | Unchanged `Bye`/no-scoreline handling (TSCH-004); included or excluded by `scheduledDate` like any other game. | CALW-004 |
| e5 | `from`/`to` are present but not valid `YYYY-MM-DD` strings | No thrown error — string comparison against a malformed value simply yields an empty or partial `games` array; no new validation is introduced (backend-standards §3). | CALW-005 |
| e6 | `from` sorts after `to` (reversed/garbage range) | `games` filters to `[]` — no special-cased error, same as any other range that matches nothing. | CALW-006 |
| e7 | Only one of `from`/`to` is supplied | Router only builds `range` when both are present; a lone param is treated as no range — behaves as e1. | CALW-007 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-game-world-home-page-overhaul) |
| **This LLD** | `docs/llds/game-world/home-calendar-strip.md` |
| UI sibling LLD | `docs/llds/game-world/home-calendar-strip-ui.md` |
| Upstream (referenced, not restated) | `docs/specs/manager/team-schedule-read-api-specs.md` (`TSCH-001`..`TSCH-004`) |
| EARS | `docs/specs/game-world/home-calendar-strip-specs.md` — `CALW-001`..`CALW-007` |
| Gherkin | `test/bdd/features/home-calendar-strip.feature` |
| Code | `src/api/endpoints.ts` (`GetTeamSchedule` doc comment), `src/api/router.ts` (query parsing), `src/api/handlers.ts` (`getTeamSchedule`), `src/db/domain/team.ts` (`TeamFactory.getSchedule`), `src/api/models.ts` (`TeamSeasonGame`, `TeamSeasonSchedule`) — plus removal of `src/db/domain/league.ts` (`LeagueFactory.getToday`), `src/api/endpoints.ts` (`GetLeagueToday`), its router route and handler |
| Decision record | [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326) |
