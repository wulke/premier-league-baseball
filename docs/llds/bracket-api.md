# LLD: Bracket State API (`GetLeagueBracket`)

> Upstream: [HLD: Full Season Simulation](../high-level-design.md#hld-full-season-simulation-league--league-cup) ·
> EARS: `docs/specs/bracket-api-specs.md` (`API-001`..) ·
> Decision record: [#41 Design API endpoints for bracket state exposure](https://github.com/wulke/premier-league-baseball/issues/41) ·
> Depends on: `docs/llds/knockout-bracket.md` (data shape), `docs/llds/full-season-ui.md` (`BracketView` render-shape contract, #39)

## Scope

One new League-level endpoint exposing bracket state (rounds, ties, byes, champion) to the UI,
mirroring the existing `GetLeagueStandings` (`src/api/endpoints.ts:3`, `src/db/domain/league.ts:45`)
fan-out pattern exactly — same factory-per-aggregate convention, same live-query strategy, no new
top-level factory.

## Interface / Data Model

### Route

```ts
// src/api/endpoints.ts
GetLeagueBracket = '/api/league/:leagueId/bracket'   // GET
```

### Handler (thin pass-through, matching `getLeagueStandings`)

```ts
// src/api/handlers.ts
const getLeagueBracket = async (leagueId: number) => {
  return await LeagueFactory(leagueId).getBracket();
};
```

### Domain — `DivisionFactory(divisionId).getBracket(year)`

Same `(divisionId, year)` scoping as `DivisionFactory(div.id).getStandings(year, standingsConfig)`
(`src/db/domain/league.ts:60`) — factory returns the UI-ready shape directly; `handlers.ts` does no
row-to-shape reshaping.

```ts
// per-division response entry
{
  divisionId: number;
  year: number;
  champion?: { teamId: number };   // from SeasonResult, either structure; absent if undecided
  rounds: BracketRound[];          // [] for ROUND_ROBIN divisions
}
```

`BracketRound` / `BracketTie` / `BracketGame` are the render-shape `docs/llds/full-season-ui.md`
defines (#39) — this endpoint targets that shape, it does not redefine it.

### Domain — `LeagueFactory(leagueId).getBracket()`

Fans out across the league's divisions exactly like `getStandings` (`league.ts:56-62`):

```ts
const getBracket = async () => {
  const league = await db.models.League.findByPk(id, {
    include: [db.models.GameWorld, db.models.Division]
  }).then((l) => {
    if (!l) throw Error(`Invalid League '${id}'`);
    return l.dataValues;
  });
  const year: number = league.GameWorld.year;

  return Promise.all(
    league.Divisions.map(async ({ dataValues: div }) => ({
      divisionId: div.id,
      divisionName: div.config.name,
      structure: div.config.format.structure,   // ROUND_ROBIN | KNOCKOUT — from CompetitionFormat (#36)
      ...(await DivisionFactory(div.id).getBracket(year)),
    }))
  );
};
```

`structure` rides in the same payload entry as `champion`/`rounds` — this is what lets the UI branch
`StandingsTable` vs. `BracketView` per card without a second lookup (falls straight out of #39's
already-decided seam; not separately grilled in #41, included here for endpoint-contract
completeness).

## Logic Flow

```
1. GET /api/league/:leagueId/bracket
2. LeagueFactory(leagueId).getBracket():
     a. load League (include GameWorld, Division) — 404-equivalent Error if not found
     b. year = league.GameWorld.year
     c. FOR each division:
          structure = division.config.format.structure
          { champion, rounds } = DivisionFactory(division.id).getBracket(year)
3. DivisionFactory(divisionId).getBracket(year):
     a. IF division's format.structure == 'ROUND_ROBIN' → return { divisionId, year, rounds: [], champion?: <SeasonResult lookup> }
     b. ELSE (KNOCKOUT):
          games = all Game rows reachable from this division/year, grouped by `round`
          FOR each round group:
            derive label (tournament-convention, per knockout-bracket.md) and status
              ('COMPLETE' | 'IN_PROGRESS' | 'PENDING')
            group games into ties (kind: 'SERIES' | 'BYE') per knockout-bracket.md's shape
          champion = SeasonResult lookup for (divisionId, year), if present
          return { divisionId, year, champion?, rounds }
4. Response: array of per-division entries (divisionId, divisionName, structure, champion?, rounds)
```

### Compute strategy

Live query at request time — reads and shapes existing `Game`/`SeasonResult` rows on every call, same
scale and pattern as `getStandings`. No caching layer; nothing in this read path is expensive enough
to justify coupling an invalidation strategy to the round-advancement hook (`knockout-bracket.md`).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| e1 | `leagueId` does not exist | Same pattern as `getLeague`/`getStandings` — throws `Error('Invalid League ...')`; not yet mapped to a `DomainError`/404 status in the existing precedent, so this endpoint inherits that same gap rather than introducing a new error-handling convention. | API-001 |
| e2 | `ROUND_ROBIN` division | `rounds: []`, `champion` populated once that division's `SeasonResult` row exists (written by the League-side logic in `full-season-ui.md`/#40, not by this endpoint). | API-002 |
| e3 | `KNOCKOUT` division mid-redraw (next round's games not yet generated) | Resolved rounds render normally; the not-yet-generated round appears with `status: 'PENDING'` and null-teamed ties, per the render-shape contract — this endpoint does not synthesize placeholder rounds beyond what `knockout-bracket.md`'s generation has actually written. | API-003 |
| e4 | League mixing `ROUND_ROBIN` and `KNOCKOUT` divisions | Not a case this MVP hits (League={round-robin divisions}, League Cup={knockout division} are separate `League` rows) but the endpoint shape tolerates it per-division, same as `getStandings` already does for heterogeneous division configs. | — |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | [`docs/high-level-design.md`](../high-level-design.md#hld-full-season-simulation-league--league-cup) |
| **This LLD** | `docs/llds/bracket-api.md` |
| EARS | `docs/specs/bracket-api-specs.md` — `API-001`.. |
| Code | `src/api/endpoints.ts` (`GetLeagueBracket`), `src/api/handlers.ts` (`getLeagueBracket`), `src/db/domain/league.ts` (`LeagueFactory.getBracket`), `src/db/domain/division.ts` (`DivisionFactory.getBracket`) |
| Decision record | [#41](https://github.com/wulke/premier-league-baseball/issues/41) |
