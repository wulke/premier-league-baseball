# LLD: League "Today" Snapshot API (`GetLeagueToday`)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/league/league-today-specs.md` (`TODAY-001`..) ·
> UI sibling: [`league-today-ui.md`](./league-today-ui.md) ·
> Decision record: [#101](https://github.com/wulke/premier-league-baseball/issues/101), resolved via `/grill-me`

## Scope

One new League-level read-only endpoint exposing a rolling "last 3 days + next 3 days" window of
games (results and upcoming schedule), so the GameWorld home page can preview what's happening
across leagues without drilling into each one. Mirrors the existing `GetLeagueBracket`/
`GetLeagueStandings` fan-out pattern (`src/db/domain/league.ts`) — same factory-per-aggregate
convention, same live-query-at-request-time strategy, no new top-level factory.

Response reuses `TeamSeasonGame` (`src/api/models.ts:32`) as-is — same shape `GetTeamSchedule`
already returns per-game. The name is acknowledged as a poor fit for a team-agnostic context but
renaming is explicitly deferred (per #101) until a second real usage (a future per-team-manager
Today view) makes the right generic name obvious.

## Interface / Data Model

### Route

```ts
// src/api/endpoints.ts
GetLeagueToday = '/api/league/:leagueId/today'   // GET
```

### Handler (thin pass-through, matching `getLeagueBracket`)

```ts
// src/api/handlers.ts
const getLeagueToday = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getToday();
};
```

### Response

Bare array — no wrapper object. `leagueId` is already in the URL and the client already holds
league metadata from the existing `GetLeague` call in the same per-league fetch group.

```ts
// GET /api/league/:leagueId/today -> 200
TeamSeasonGame[]
```

### Domain — `LeagueFactory(leagueId).getToday()`

```ts
interface ILeague {
  // ...existing members
  getToday: () => Promise<TeamSeasonGame[]>;
}
```

## Logic Flow

```
1. GET /api/league/:leagueId/today
2. LeagueFactory(leagueId).getToday():
     a. load League (include GameWorld, Division) — throws Error('Invalid League ...') if not found,
        same unconverted-404 gap as getStandings/getBracket (see e2 below)
     b. year = league.GameWorld.year
     c. currentDate = league.GameWorld.currentDate
     d. IF currentDate is null/undefined:
          throw new DomainError('the GameWorld has no current date configured', 422)
          — mirrors simulateBatch's existing guard (src/db/domain/game.ts:88)             # TODAY-002
     e. divisionIds = league.Divisions.map(d => d.id)
        IF divisionIds.length === 0 -> return []                                          # TODAY-006
     f. divisionSeasons = DivisionSeason.findAll({ where: { divisionId: In(divisionIds), year },
          include: Division })
        IF divisionSeasons.length === 0 -> return []                                      # TODAY-006
     g. dsGames = DivisionSeasonGame.findAll({ where: { divisionSeasonId: In(divisionSeasons.ids) } })
        gameIds = unique(dsGames.map(g => g.gameId))
        — same de-dup-via-join-table approach as simulateBatch (src/db/domain/game.ts:115-118),
          not the per-team DivisionSeason walk in team.ts, since a Game's home-side and away-side
          DivisionSeason rows would otherwise duplicate it
        IF gameIds.length === 0 -> return []                                              # TODAY-006
     h. windowStart = currentDate - 3 days
        windowEnd   = currentDate + 3 days
        games = Game.findAll({ where: { id: In(gameIds), [Op.or]: [
          { status: In(['SCHEDULED', 'IN_PROGRESS']), scheduledDate: { [Op.lte]: windowEnd } },
          { status: 'COMPLETED', scheduledDate: { [Op.between]: [windowStart, currentDate] } },
        ] } })                                                                    # TODAY-003,TODAY-004
     i. build gameId -> { divisionId, divisionName, divisionSeasonId } lookup from dsGames +
        divisionSeasons (same shape team.ts's rawGames construction produces, just keyed by
        game instead of by team)
     j. bulk-fetch team names for every referenced homeTeam/awayTeam id (team.ts step 6)
     k. map each Game row -> TeamSeasonGame (team.ts step 7's exact field derivation: bye handling
        for awayTeam == null, KNOCKOUT round labels via getKnockoutRoundLabel + per-division-season
        game counts, ROUND_ROBIN games get `Round ${game.round}`)                          # TODAY-007
     l. sort ascending by scheduledDate                                                   # TODAY-005
     m. return games
```

### Compute strategy

Live query at request time, same as `getBracket`/`getStandings` — no caching layer, nothing in this
read path is expensive enough to justify one.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `leagueId` does not exist | Throws `Error('Invalid League ...')`, same unconverted-404 precedent as `getStandings`/`getBracket` — not introducing a new error-handling convention here. | TODAY-001 |
| e2 | GameWorld's `currentDate` is null (no code path currently sets it after `newSeason` — a pre-existing gap, not introduced by this feature) | `getToday()` throws `DomainError(..., 422)`, identical guard to `simulateBatch`. The UI treats this the same as any other fetch failure for that league (see UI LLD, `TODAYUI-002`) rather than surfacing an error to the player. | TODAY-002 |
| e3 | League has zero Divisions, zero DivisionSeasons for the current year, or zero linked games | Returns `[]` at the earliest short-circuit; UI omits that league's sub-block entirely (settled UI decision). | TODAY-006 |
| e4 | A COMPLETED game's `scheduledDate` is older than `currentDate - 3` (it sat in a backlog before being resolved) | Excluded from the response — accepted tradeoff, confirmed in `/grill-me`: `scheduledDate` is the sole recency signal (no `completedDate` column exists or is being added), and per the same conversation this case is expected to be rare/transient since `simulateBatch` always resolves everything `<= currentDate` in one pass, leaving no durable backlog between calls. | TODAY-003 |
| e5 | A SCHEDULED/IN_PROGRESS game's `scheduledDate` is older than `currentDate - 3` (overdue, never simulated) | Included regardless — no lower bound on the upcoming/backlog side, so nothing actionable is silently hidden. Confirmed as intentional in `/grill-me` despite being the rare case from e4's same reasoning. | TODAY-004 |
| e6 | Knockout `awayTeam` is null (bye) | `awayTeamName: 'Bye'`, `awayTeamId: null` — identical to `GetTeamSchedule`'s existing handling (`src/db/domain/team.ts:135`). | TODAY-007 |
| e7 | A division mixes multiple divisionSeasons across teams for the same game (game linked via both the home and away team's `DivisionSeason` row) | De-duped by `gameId` at the `DivisionSeasonGame` step (1h) before any per-team walk happens, so each game appears exactly once in the response. | TODAY-007 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/league/league-today.md` |
| UI sibling LLD | `docs/llds/league/league-today-ui.md` |
| EARS | `docs/specs/league/league-today-specs.md` — `TODAY-001`.. |
| Gherkin | `test/bdd/features/league-today.feature` |
| Code | `src/api/endpoints.ts` (`GetLeagueToday`), `src/api/handlers.ts` (`getLeagueToday`), `src/db/domain/league.ts` (`LeagueFactory.getToday`) |
| Decision record | [#101](https://github.com/wulke/premier-league-baseball/issues/101) |
