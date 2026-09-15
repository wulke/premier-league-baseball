# LLD: Home Calendar Strip — UI Component (`game-world.tsx`)

> Backend LLD (sibling): [`home-calendar-strip.md`](./home-calendar-strip.md) ·
> EARS: `docs/specs/game-world/home-calendar-strip-ui-specs.md` (`CALWUI-001`..`CALWUI-008`) ·
> Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326)

## Scope

Replaces the "Today" section of `src/ui/pages/game-world.tsx` (the per-league `useEffect`/fetch
block, `LeagueTodaySummary` state, and the scoreboard-banner rendering it currently drives) with a
new `CalendarStrip` component: a horizontal, rolling 7-day window anchored on `GameWorld.currentDate`,
fed by the extended `GET /api/team/:teamId/calendar` (see backend sibling LLD), with prev/next
navigation clamped to the team's season bounds.

Out of scope (each a sibling ticket/LLD of its own, per the HLD):
- The "Simulate Today" CTA's own promotion/placement — #331. This LLD assumes it renders somewhere
  above the strip, unchanged.
- The action-items panel scaffold — #327.
- The header season badge and dropped "Leagues" card list — #328, #332.
- The unclaimed-team ("claim a team") home state — #333. This LLD assumes `CalendarStrip` is only
  ever mounted when `gw.managedTeamId` is non-null; the null case is that sibling's concern.
- Per-game click-through — #330 (no per-game detail endpoint exists).

## Interface / Data Model

### `DayEntry` — the generic day-cell entry type

```ts
// src/ui/components/calendar-strip.tsx
//
// Adding a new DayEntry kind (e.g. training):
//   1. Define its shape and add it to the `DayEntry` union below.
//   2. Add a `kind -> render` mapping to DAY_ENTRY_RENDERERS.
//   3. Populate entries of that kind from wherever their source data lives —
//      CalendarStrip only groups/renders `DayEntry[]` by `date`; it has no
//      opinion on where an entry comes from.
type DayEntry = GameDayEntry;   // | TrainingDayEntry, etc. — future variants join here

interface GameDayEntry {
  kind: 'game';
  id: string;        // `game-${game.gameId}` — stable React key
  date: string;       // game.scheduledDate.slice(0, 10) — 'YYYY-MM-DD' grouping key,
                       // derived from the backend's ISO-timestamp scheduledDate
  game: TeamSeasonGame;   // existing type, now carrying leagueId/leagueName (backend LLD)
}
```

### `CalendarStrip` props

```ts
interface CalendarStripProps {
  currentDate: string;            // GameWorld.currentDate — anchors the initial window
  seasonStart: string | null;     // from the calendar API response
  seasonEnd: string | null;       // from the calendar API response
  entries: DayEntry[];            // flat list; grouped by `date` internally
  onWindowChange: (from: string, to: string) => void;   // parent re-fetches for the new window
}
```

The component owns its own `windowStart` (React state, `useState`), initialized from `currentDate`
per the anchoring rule below; it does not own `entries` or re-fetch itself — the parent
(`game-world.tsx`) fetches and passes the new `entries`/bounds down on every window change.

## Logic Flow

```
1. game-world.tsx, gw.managedTeamId set AND gw.currentDate set:
     windowStart = currentDate - 3 days; windowEnd = currentDate + 3 days
       — centered ±3-day window, matching the prior getToday behavior's span,
         now presented as an explicit, labeled 7-day strip instead of a bare
         "Today" list                                                    # CALWUI-001
     GET /api/team/:managedTeamId/calendar?gwId=...&from=windowStart&to=windowEnd
     → { games, seasonStart, seasonEnd }
     entries = games.map(g => ({ kind: 'game', id: `game-${g.gameId}`, date: g.scheduledDate!.slice(0, 10), game: g }))
                                                                            # CALWUI-002

2. CalendarStrip renders 7 date cells for [windowStart..windowEnd]:
     for each date d: cell(d).entries = entries.filter(e => e.date === d)
     a date with no entries renders a visibly dim/empty cell — NOT omitted from
       the strip, so the weekly rhythm (7 cells, always) stays visible          # CALWUI-003
     a date with 2+ entries stacks them vertically within the cell; the cell's
       layout does not break or truncate silently                              # CALWUI-004

3. Prev/Next navigation:
     next: newStart = windowStart + 7 days
       IF newStart + 6 days > seasonEnd (or seasonEnd is null) -> disabled/no-op
       ELSE: windowStart = newStart; onWindowChange(newStart, newStart + 6 days)
     prev: newStart = windowStart - 7 days
       IF newStart < seasonStart (or seasonStart is null) -> disabled/no-op
       ELSE: windowStart = newStart; onWindowChange(newStart, newStart + 6 days)
                                                                     # CALWUI-005,CALWUI-006
     — pages a full week at a time; no fetch or render is attempted for a
       shifted window that falls outside [seasonStart, seasonEnd]

4. gw.currentDate == null (pre-existing gap — no code path sets it after
   newSeason(), per project memory):
     the calendar fetch is skipped entirely and CalendarStrip is not rendered,
     mirroring the prior guard (`gw?.currentDate == null`) in game-world.tsx      # CALWUI-007

5. The old "Today" useEffect/fetch block, `LeagueTodaySummary` type/state, and
   the TODAYUI-scoreboard rendering it drove are removed from game-world.tsx
   in full — no dead code, no feature flag                                       # CALWUI-008
```

### Key decisions embedded in this flow

- **Centered ±3-day anchor, not a start-of-window anchor**: the map's decision text ("rolling 7-day
  window anchored on `GameWorld.currentDate`") doesn't specify centered vs. leading; centering
  preserves the prior `getToday` window's actual span (today ± 3 days) so the visible set of games
  a player sees on first load doesn't shift — only the presentation (explicit strip vs. bare list)
  changes.
- **Prev/Next pages by 7 days, not 1**: keeps the "week" framing the map asks for (a rolling window
  the player navigates in whole strips), rather than a day-by-day scrub.
- **Component owns navigation state, not fetch**: `CalendarStrip` is a dumb renderer over
  `entries`/bounds it's handed; `game-world.tsx` stays the single place that talks to the API,
  matching how the rest of the page already works (`gw` from the route loader, local `useEffect`
  fetches for summaries).

## Edge Case Probe

| # | Condition | Handling | Spec |
|---|---|---|---|
| u1 | No games at all in the current 7-day window | All 7 cells render, each empty one visibly dim — never collapsed to fewer than 7 cells. | CALWUI-003 |
| u2 | Two or more games land on the same date (e.g. League + League Cup both scheduled that day) | Both entries stack within that single day cell; layout does not break or hide either entry. | CALWUI-004 |
| u3 | Next/prev would move the window past `seasonEnd`/before `seasonStart` | Disabled/no-op — no fetch is made and no out-of-season window is rendered. | CALWUI-005, CALWUI-006 |
| u4 | `seasonStart`/`seasonEnd` are both `null` (team has no games at all this GameWorld year) | Both nav directions disabled; the strip still renders its 7 (all-empty) cells around `currentDate`. | CALWUI-006 |
| u5 | `gw.currentDate` is null | No fetch attempted; the calendar section is omitted from the page entirely (pre-existing gap, unchanged from today's guard). | CALWUI-007 |
| u6 | `gw.managedTeamId` is null | Not this component's concern — `game-world.tsx` renders the unclaimed-team prompt instead (owned by #333's sibling LLD) and never mounts `CalendarStrip`. | — (see #333) |

## Traceability

| Layer | Artifact |
|---|---|
| Backend sibling LLD | `docs/llds/game-world/home-calendar-strip.md` |
| **This LLD** | `docs/llds/game-world/home-calendar-strip-ui.md` |
| EARS | `docs/specs/game-world/home-calendar-strip-ui-specs.md` — `CALWUI-001`..`CALWUI-008` |
| Gherkin | `test/ui/features/home-calendar-strip-ui.feature` |
| Code | `src/ui/pages/game-world.tsx`, `src/ui/components/calendar-strip.tsx` (new) |
| Decision record | [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326) |
