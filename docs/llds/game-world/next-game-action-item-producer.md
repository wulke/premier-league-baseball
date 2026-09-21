# LLD: Next-Game Action Item Producer

> Upstream: [HLD: Game World Home Page Overhaul](../../high-level-design.md) ("Action-items panel scope", #327) ·
> EARS: `docs/specs/game-world/next-game-action-item-producer-specs.md` (`NGAI-001`..`NGAI-006`) ·
> Sibling LLDs: `docs/llds/game-world/action-items-panel-ui.md` (`ActionItem` contract, panel rendering — unchanged
> by this LLD), `docs/llds/manager/pre-game-prep-ui.md` (`PREGAME-005` readiness boundary, reused verbatim here)
> Issue: [#366](https://github.com/wulke/premier-league-baseball/issues/366)

## Scope

Registers the first real `ActionItem` producer for the scaffolded `ActionItemsPanel` (#327): the
managed team's next `SCHEDULED` game, surfaced **once per league** the team currently plays in,
so managers get a one-click path into that game's pre-game prep screen
(`/:gwId/:leagueId/game/:gameId`, #363) without browsing the full calendar.

A league only produces an item when its next `SCHEDULED` game has actually reached the
GameWorld's `currentDate` (`scheduledDate <= currentDate`, non-strict — the same boundary
`PREGAME-005` and `SIMUI-031` already use). A league whose next game is still in the future, or
that has no scheduled games left, produces no item — this panel surfaces things that need
attention *now*, not a schedule preview.

Out of scope:
- Any change to `ActionItemsPanel`'s rendering contract (`ActionItem`, sort, empty state) — that
  LLD's contract is consumed as-is.
- A dedicated backend endpoint for "next game per league" — `GetTeamSchedule` already supports a
  `leagueId` filter with no date range (full-season read), which is sufficient; see Data Access.
- Bye-round games (`awayTeamId == null`) receiving different treatment than a normal game — they
  are `SCHEDULED` games like any other and are not special-cased here, matching how
  `TeamCalendar`'s existing per-row link (`SIMUI-029`..`031`) treats them.

## Data Access

No backend change. `GetTeamSchedule` (`GET /api/team/:teamId/calendar?gwId&leagueId`) already
accepts a `leagueId` filter and, per `CALW-007`, treats a request with no `from`/`to` as
"no range" — i.e. every game in that league's season, matching `TeamFactory.getSchedule`'s
existing behavior. One call per league (`leagues = gw.Leagues`) fetches that league's full
season list; the producer picks the earliest still-`SCHEDULED` game client-side.

## Interface / Data Model

```ts
// src/ui/hooks/use-next-game-action-items.ts
interface LeagueRef {
  id: number;
  name: string;
}

const useNextGameActionItems = (
  gwId: string | undefined,
  managedTeamId: number | null | undefined,
  currentDate: string | null | undefined,
  leagues: LeagueRef[],
): ActionItem[]
```

A hook (not a plain function) because it owns a `fetch` per league and must re-run when
`gwId`/`managedTeamId`/`currentDate`/`leagues` change — the same shape `game-world.tsx`'s
existing `fetchCalendar`/`leagueSeasonSummary` effects already use for per-league fetches.
Mounted in `game-world.tsx` alongside those effects; its output is passed straight into
`<ActionItemsPanel items={...} />` per that LLD's registration pattern (single producer today,
so no merge/concat needed).

## Logic Flow

```
1. game-world.tsx calls useNextGameActionItems(gwId, gw?.managedTeamId, gw?.currentDate,
   gw?.Leagues ?? []) unconditionally (before the `if (!gw) return` guard, matching the other
   gw-derived hooks in this component)                                          # NGAI-001

2. Hook effect, gwId set AND managedTeamId set AND leagues non-empty:
     for each league in leagues (parallel fetch, independent per league — one league's
     failure must not blank out another league's item):
       GET /api/team/:managedTeamId/calendar?gwId=:gwId&leagueId=:league.id
         (no from/to => full season, per CALW-007)                              # NGAI-002
       games = response.games (or [] if the request failed)
       scheduled = games.filter(status === 'SCHEDULED')
       nextGame = scheduled sorted by scheduledDate ascending (null last, matching
         TeamCalendar's existing gameSort), first element                        # NGAI-002
       IF nextGame is undefined: no item for this league                        # NGAI-005
       ELSE:
         isReady = nextGame.scheduledDate == null
           || (currentDate != null && nextGame.scheduledDate.slice(0,10) <= currentDate)
           (identical boundary to PREGAME-005 — a null scheduledDate is exempt from the
           currentDate check, and the comparison is <=, not strict)              # NGAI-003
         IF NOT isReady: no item for this league                                 # NGAI-004
         ELSE: emit ActionItem {
           id: `next-game-league-${league.id}`,
           label: `${opponentName} (${league.name}) is ready to prep`,
           severity: 'warning',
           href: `/${gwId}/${league.id}/game/${nextGame.gameId}`,
           ctaLabel: 'Prep',
         }                                                                        # NGAI-006

3. Hook effect, gwId unset OR managedTeamId unset OR leagues empty:
     returns [] — mirrors the existing managedTeamId/gwId guards on this
     component's other per-league effects                                       # NGAI-001

4. game-world.tsx renders <ActionItemsPanel items={nextGameActionItems} /> — unchanged mount
   guard (`gw.managedTeamId != null`) from ACTUI-001/ACTUI-005; the hook's own [] result when
   managedTeamId is null makes this redundant-but-harmless for that case.
```

### Key decisions embedded in this flow

- **One fetch per league, not a single unfiltered fetch filtered client-side**: `GetTeamSchedule`
  already supports server-side league scoping (`leagueId` query param); reusing it avoids
  pulling every league's full season across the wire just to discard most of it, and keeps this
  producer's data-shape identical to `TeamCalendar`'s existing per-league reads.
- **Full season, not a `currentDate`-anchored window**: unlike the Calendar section's ±3-day
  `fetchCalendar` window, "next scheduled game" must look arbitrarily far ahead (a league that
  hasn't been simulated in a while could have its next game many days past `currentDate`, or a
  freshly-started season's first game far in the future) — a windowed read would silently miss
  it in either direction.
- **`scheduledDate <= currentDate`, not `==`**: reuses `PREGAME-005`'s exact boundary (see that
  LLD's edge-case probe) — a game becomes ready to prep once its date has been reached, and
  stays ready every day after until it's simulated (e.g. after a manager skips a day). Matching
  it here means this panel and the prep screen it links to never disagree about readiness.
- **Independent per-league failure isolation**: each league's fetch/derivation is caught on its
  own (empty `games` on a failed request) so one league's transient fetch error doesn't blank
  the whole panel — consistent with `game-world.tsx`'s existing `leagueSeasonSummary` effect,
  which already swallows and logs per-effect (not per-league) errors the same way.

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| n1 | A league has no `SCHEDULED` games left (season complete, or not started) | No item for that league. | NGAI-005 |
| n2 | A league's next `SCHEDULED` game has `scheduledDate > currentDate` | No item for that league. | NGAI-004 |
| n3 | A league's next `SCHEDULED` game has `scheduledDate == null` | Treated as ready regardless of `currentDate` — mirrors `PREGAME-005`'s exemption. | NGAI-003 |
| n4 | Two leagues both have a ready next game | Two separate items, one per league, each linking to its own game. | NGAI-006 |
| n5 | `managedTeamId` is `null` | Hook returns `[]`; `ActionItemsPanel` isn't mounted at all (`ACTUI-005`), so this is belt-and-suspenders. | NGAI-001 |
| n6 | One league's `GetTeamSchedule` fetch fails | That league contributes no item; other leagues' items are unaffected. | NGAI-002 |

## Traceability

| Layer | Artifact |
|---|---|
| HLD | `docs/high-level-design.md` — "Action-items panel scope" (#327) |
| **This LLD** | `docs/llds/game-world/next-game-action-item-producer.md` |
| Sibling LLDs | `docs/llds/game-world/action-items-panel-ui.md` (panel contract), `docs/llds/manager/pre-game-prep-ui.md` (`PREGAME-005` boundary) |
| EARS | `docs/specs/game-world/next-game-action-item-producer-specs.md` — `NGAI-001`..`NGAI-006` |
| Gherkin | `test/ui/features/next-game-action-items.feature` |
| Code | `src/ui/hooks/use-next-game-action-items.ts` (new), `src/ui/pages/game-world.tsx` |
| Issue | [#366](https://github.com/wulke/premier-league-baseball/issues/366) |
