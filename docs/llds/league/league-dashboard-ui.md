# LLD: League Dashboard (`/:gwId/:leagueId`)

> EARS: `docs/specs/league/league-dashboard-ui-specs.md` (`LDASH-001`..`LDASH-010`) ·
> Routing/loader sibling amendment: [`docs/llds/shell/route-loader-foundation-ui.md`](../shell/route-loader-foundation-ui.md) (`STDRT-001`..`STDRT-004`) ·
> Decision records: [#297](https://github.com/wulke/premier-league-baseball/issues/297) (problem + `/grill-me`), [#321](https://github.com/wulke/premier-league-baseball/issues/321) (this design gate)

## Scope

Split today's single League page into two: a lean **dashboard** at `/:gwId/:leagueId` (this LLD) and
a **full standings/bracket page** at `/:gwId/:leagueId/standings` (routing/composition covered by the
sibling amendment to `route-loader-foundation-ui.md`; its own body is today's `league.tsx` content,
relocated with no behavior change — no new LLD needed for it).

The dashboard is a snapshot: identity + champion state, "what's happening today" for this league, a
condensed standings peek per round-robin division, and a bracket peek per knockout division — each
linking out to `/standings` for the full view. It reuses existing data and presentation building
blocks; the one new working part is the Today matchup banner, which requires reinstating the
previously-removed `GetLeagueToday` endpoint (see **Reinstatement dependency** below).

**Explicitly out of scope** (per #321): any new backend endpoint beyond reinstating `GetLeagueToday`
verbatim, and a leaders/top-scorers widget (tracked separately in #320).

### Reinstatement dependency (discovered during this design gate)

The issue brief for #321 (and #297 before it) assumed `game-world.tsx`'s old "Today" scoreboard and
`GET /api/league/:leagueId/today` still existed. Both were removed by #326 (commit `2b3a562`, three
days after #297 was filed) and replaced by the team-scoped `CalendarStrip` on the GameWorld home
page. Per `/grill-me` on this gap during #321, the resolution is: **reinstate `GetLeagueToday`
verbatim** (same route, same `LeagueFactory.getToday()`, same `TeamSeasonGame[]` response shape) as
documented in `docs/llds/league/league-today.md` (`TODAY-001`..`TODAY-007`) — that LLD is not
rewritten, only reactivated. Its EARS rows and `docs/specs/league/league-today-specs.md` stay
`[x]` (historical) until the Code stage of the implementation issue actually restores the
endpoint, per this repo's convention of cascading status/wording changes at Code, not at the design
gate (see `route-loader-foundation-ui-specs.md`'s header note for precedent). The dashboard's Today
section itself is presentation-only and does not reintroduce the old `game-world.tsx` scoreboard —
it is a new, league-scoped matchup-banner presentation (`LDASH-003`), styled after a compact
scores-ticker (ESPN/Baseball Savant "today's games" style: one tile per game, both teams + status/
score, no play-by-play), not a resurrection of the old GameWorld-home layout.

## Interface / Data Model

### Page component (NEW)

```tsx
// src/ui/pages/league-dashboard.tsx
const LeagueDashboard = () => { /* ... */ };
export { LeagueDashboard };
```

Added to the `src/ui/pages/index.tsx` barrel and mounted at `:leagueId` in `routes.tsx` (see the
routing amendment). `src/ui/pages/league.tsx`'s existing `League` export is renamed to
`LeagueStandings` (file unchanged, JSX body unchanged) and remounted at `:leagueId/standings` — see
the routing LLD for the route tree and loader split.

### Dashboard loader data (NEW type, `useLoaderData()` shape for this route only)

```ts
type LeagueDashboardData = {
  league: any;                        // same shape as today's GetLeague response
  today: TeamSeasonGame[];            // GetLeagueToday — [] on fetch failure (STDRT-004)
  standings: DivisionStandings[];     // GetLeagueStandings — reused as-is, unfiltered
  brackets: LeagueDivisionBracket[];  // GetLeagueBracket — reused as-is, unfiltered
};
```

`standings`/`brackets` are the *same* full-fidelity responses `/standings` uses — no new
query params, no server-side "top 5" or "first round" slicing. All condensing happens client-side in
this page (`LDASH-004`, `LDASH-006`), consistent with the issue's "no backend/query-param changes"
decision.

### Derived, presentation-only helpers (NEW, co-located in `league-dashboard.tsx`)

```ts
// LDASH-004 — top-5 slice for one round-robin division's condensed widget
condensedStandings(divisionStandings: DivisionStandings): TeamStanding[] {
  return divisionStandings.standings.slice(0, 5);
}

// LDASH-006 — the round to preview for one knockout division's teaser.
// Same "first round not yet fully resolved" concept as bracket-view.tsx's
// isPendingRound/pendingRound, generalized from "no games generated yet" (PENDING only)
// to "not COMPLETE" (also catches an IN_PROGRESS round with partial results),
// since a teaser should show the round currently being played, not just an
// ungenerated one.
firstIncompleteRound(rounds: BracketRound[]): { round: BracketRound; index: number } | null {
  const index = rounds.findIndex((round) => round.status !== 'COMPLETE');
  return index === -1 ? null : { round: rounds[index], index };
}

// LDASH-007 — division-level champion name (distinct from champion.ts's league-wide
// getChampionTeamName, which only resolves the League's designated top-tier/champion-
// producing division). A knockout division that is fully resolved but is NOT the
// league's champion-producing division (e.g. a consolation/relegation bracket in a
// multi-stage format) still needs its own teaser-slot champion line.
divisionChampionName(division: any, bracket: LeagueDivisionBracket): string | null {
  const championTeamId = bracket.champion?.teamId;
  if (championTeamId == null) return null;
  return division.Teams?.find((team: any) => team.id === championTeamId)?.config?.name
    ?? `Team ${championTeamId}`;
}
```

No new component boundary is introduced for these — they are plain functions consumed by
`LeagueDashboard`'s render, mirroring how `getSeededFromGroupsLabel` lives inline in `league.tsx`
today.

### Reused, unmodified

| From | What |
|---|---|
| `../champion.ts` | `formatLeagueChampionBanner`, `getChampionBracket`, `getChampionTeamName` — identity-header champion banner (`LDASH-002`), same as today's `league.tsx` |
| `./league.tsx` (renamed `LeagueStandings`) | `StandingsTable` — reused for the condensed widget, rows sliced to 5 (`LDASH-004`); no new table component |
| `../components/team-roster-grid.tsx` | `TeamRosterGrid` — pre-season fallback, unchanged (`LDASH-008`) |
| `../components/team-crest.tsx` | `TeamCrest` — team identity everywhere a name renders |
| `../components/bracket-view.tsx` | none of its exported component is reused directly (it renders the full interactive tree); `LDASH-006`'s teaser is a new, deliberately non-interactive rendering — see Edge Case Probe `d5` |

## Logic Flow

```
1. useLoaderData() -> { league, today, standings, brackets }                      # LDASH-001
   if (!league) return <></>                                                      # (same empty guard as today's League)

2. Identity header:
     championName = getChampionTeamName(league, brackets)
     banner = formatLeagueChampionBanner(league, championName)
     subtitle = banner ?? "<N> division(s) · Season in progress|No active season"  # LDASH-002
   Render: <h1>{league.config.name}</h1> <Badge>{league.config.type}</Badge>
           <p>{subtitle}</p>
   (Identical composition to today's league.tsx identity block — the only change from #321 is
   WHERE it lives: it moves from the shared page to the dashboard-only page. LeagueStandings's
   own header drops the banner/subtitle entirely per the routing amendment's STDRT decision.)

3. Today section (LDASH-003):
     if (today.length === 0) render nothing
     else render one horizontal scoreboard banner per game, in backend chronological order —
       same per-game presentation contract as the retired TODAYUI-007/008 (status label, two
       team lanes with names, available scores, winner marker on unequal completed scores) —
       just scoped to this one league's `today` array instead of a per-league loop across
       every league in the GameWorld.

4. For each division in league.Divisions:
     divisionStandings = standings.find(s => s.divisionId === division.id)
     divisionBracket    = brackets.find(b => b.divisionId === division.id)
     structure = divisionBracket?.structure ?? division.config?.format?.structure ?? 'ROUND_ROBIN'

     IF structure === 'ROUND_ROBIN':
       IF divisionStandings has >0 rows:
         render condensed widget: division name + StandingsTable(condensedStandings(...))  # LDASH-004
       ELSE:
         render TeamRosterGrid(division.Teams) pre-season fallback                          # LDASH-008

     IF structure === 'KNOCKOUT':
       IF divisionBracket.rounds.length === 0:
         render "No bracket yet — season not started." + TeamRosterGrid(division.Teams)     # LDASH-008
       ELSE:
         incomplete = firstIncompleteRound(divisionBracket.rounds)
         IF incomplete === null:                       // every round COMPLETE
           render divisionChampionName(division, divisionBracket) as a champion line         # LDASH-007
         ELSE:
           render incomplete.round.label + a compact tie list (teamA vs teamB names, TBD for
           unresolved slots, no expand-to-game-rows, no round-to-round tree connectors)       # LDASH-006,LDASH-010

5. One "View full standings" CTA per league section (not per division), linking to
   `/${gwId}/${leagueId}/standings`                                                          # LDASH-005

6. onTeamClick(teamId) = navigate(`/${gwId}/team/${teamId}`) — identical to today's League page,
   wired into every widget's team-name click (condensed rows, teaser tie names, roster grid,
   champion line)                                                                            # LDASH-009
```

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| d1 | `today` fetch fails or returns non-ok | Loader resolves that slice to `[]` (`STDRT-004`); dashboard renders with no Today section — same degrade-to-empty contract as the retired `TODAYUI-002`/backend `TODAY-002`, just at the loader level instead of a page-level `useEffect` catch. | LDASH-003 |
| d2 | A round-robin division has fewer than 5 teams | `condensedStandings` slices with `Array.prototype.slice`, which no-ops past array length — render all available rows, no padding/placeholder rows. | LDASH-004 |
| d3 | A knockout division's current round is `IN_PROGRESS` with some ties decided and others not | `firstIncompleteRound` matches on `status !== 'COMPLETE'`, so the round renders as the teaser with a mix of decided/undecided tie rows — the teaser does not hide decided ties within an in-progress round, since round-level (not tie-level) granularity is the documented decision. | LDASH-006 |
| d4 | A multi-stage league's knockout division is `TOP_N_PER_DIVISION`-seeded from a completed group stage, and the knockout hasn't started (`rounds.length === 0`) | Same as `d`/pre-season fallback — `TeamRosterGrid` — no seeded-from-groups label is added to the dashboard teaser (that label, `getSeededFromGroupsLabel`, is `/standings`-only presentation, unchanged there). | LDASH-008 |
| d5 | Player clicks a series tie in the bracket teaser | No-op beyond the team-name click targets (`LDASH-009`) — the teaser has no `expandedSeries` state and does not render `BracketView`'s click-to-expand affordance (`Show games`/`Hide games`), since a teaser is a read-only preview, not the interactive tree. | LDASH-010 |
| d6 | The league's champion-producing division is a non-top-tier knockout division that is also independently fully resolved (rare multi-stage shape) | Identity header's `LDASH-002` banner and this division's `LDASH-007` teaser-slot champion line can both render simultaneously — they answer different questions ("who won the league" vs. "who won this specific bracket") and are not deduplicated against each other. | LDASH-002, LDASH-007 |
| d7 | League has zero Divisions | `league.Divisions` is empty/undefined — the divisions loop (step 4) renders nothing; identity header and Today section (if any) still render. No new empty-state message is introduced beyond what `league.tsx` already omits today. | LDASH-001 |
| d8 | `GetLeagueToday`'s window includes games from a division not otherwise shown in this league page (shouldn't happen — `today` is already league-scoped server-side per `TODAY-*`) | Not handled client-side; trusts the backend's league scoping (`TODAY-001`..`TODAY-007`), same trust boundary the retired GameWorld-home Today section had. | LDASH-003 |

## Traceability

| Layer | Artifact |
|---|---|
| Decision records | [#297](https://github.com/wulke/premier-league-baseball/issues/297), [#321 (this gate)](https://github.com/wulke/premier-league-baseball/issues/321) |
| **This LLD** | `docs/llds/league/league-dashboard-ui.md` |
| Routing/loader sibling | [`docs/llds/shell/route-loader-foundation-ui.md`](../shell/route-loader-foundation-ui.md) — `STDRT-001`..`STDRT-004` |
| Reinstated backend LLD (unmodified content, reactivated) | [`docs/llds/league/league-today.md`](./league-today.md) — `TODAY-001`..`TODAY-007` |
| Reused sibling LLDs (unmodified) | [`docs/llds/league/bracket-tree-ui.md`](./bracket-tree-ui.md), [`docs/llds/league/multi-stage-season-ui.md`](./multi-stage-season-ui.md), [`docs/llds/league/team-badges-ui.md`](./team-badges-ui.md) |
| EARS | `docs/specs/league/league-dashboard-ui-specs.md` — `LDASH-001`..`LDASH-010` (NEW) |
| Gherkin | `test/ui/features/league-dashboard-ui.feature` (NEW, Red) |
| Code entry points (not yet implemented — Code stage of a follow-up issue) | `src/ui/pages/league-dashboard.tsx` (NEW) · `src/ui/pages/league.tsx` (export renamed `League` → `LeagueStandings`) · `src/ui/pages/index.tsx` (barrel) · `src/ui/routes.tsx` (route split — see routing LLD) · `src/api/endpoints.ts`/`src/api/handlers.ts`/`src/db/domain/league.ts` (reinstate `GetLeagueToday`/`getLeagueToday`/`LeagueFactory.getToday`, per `league-today.md`) |
