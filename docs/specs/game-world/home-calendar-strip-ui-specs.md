# Specs: Home Calendar Strip — UI Component

Frontend requirements for the `CalendarStrip` component on the GameWorld home page
(`src/ui/pages/game-world.tsx`, `src/ui/components/calendar-strip.tsx`), consuming the extended
`GET /api/team/:teamId/calendar`. Replaces the prior "Today" section governed by
`TODAYUI-001`..`TODAYUI-008` (`docs/specs/league/league-today-ui-specs.md`), which this feature
supersedes and removes.

| ID | Requirement | Status |
|---|---|---|
| CALWUI-001 | WHEN the GameWorld home page loads IF `gw.managedTeamId` and `gw.currentDate` are both set THE system SHALL fetch GET /api/team/:managedTeamId/calendar for a window of `[currentDate-3days, currentDate+3days]` | [ ] |
| CALWUI-002 | WHEN the calendar fetch returns THE system SHALL map each returned game into a `GameDayEntry` (`kind: 'game'`, keyed `game-${gameId}`, dated by the game's `scheduledDate`) for the `CalendarStrip` component | [ ] |
| CALWUI-003 | WHEN CalendarStrip renders its 7-day window THE system SHALL render one cell per date IF a date has no entries THE system SHALL render that cell visibly dim/empty rather than omitting it — the strip SHALL always show exactly 7 cells | [ ] |
| CALWUI-004 | WHEN a date cell has two or more `DayEntry` items THE system SHALL stack them within that single cell without breaking or truncating the cell's layout | [ ] |
| CALWUI-005 | WHEN the player activates CalendarStrip's next/prev control THE system SHALL shift the window by 7 days and invoke `onWindowChange` with the new range, causing the parent to re-fetch | [ ] |
| CALWUI-006 | WHEN a next/prev shift would move the window beyond `seasonEnd` or before `seasonStart` (including when either bound is `null`) THE system SHALL disable that direction and SHALL NOT fetch or render an out-of-season window | [ ] |
| CALWUI-007 | WHEN the GameWorld home page loads IF `gw.currentDate` is null THE system SHALL NOT fetch the calendar and SHALL NOT render CalendarStrip, mirroring the pre-existing `currentDate`-unset gap | [ ] |
| CALWUI-008 | WHEN CalendarStrip replaces the prior "Today" section THE system SHALL remove the old per-league "Today" `useEffect`/fetch block, the `LeagueTodaySummary` type and state, and the TODAYUI-driven scoreboard rendering from `game-world.tsx` in full | [ ] |
| CALWUI-009 | WHEN the GameWorld home page renders IF the existing batch-simulation guard permits it THE system SHALL render the existing "Simulate Today" control in a distinct primary-action banner immediately above CalendarStrip, without changing its loading, disabled, result, or error behavior | [x] → #331 |
| CALWUI-010 | WHEN CalendarStrip renders a date equal to GameWorld `currentDate` THE system SHALL visually distinguish that day cell from the other calendar dates, including when it has no entries | [x] → #331 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: [`docs/high-level-design.md` — HLD: Game World Home Page Overhaul](../high-level-design.md#hld-game-world-home-page-overhaul)
- LLD: `docs/llds/game-world/home-calendar-strip-ui.md`
- Backend sibling specs: `docs/specs/game-world/home-calendar-strip-specs.md`
- Superseded specs: `docs/specs/league/league-today-ui-specs.md` (`TODAYUI-001`..`TODAYUI-008`) — the "Today" section and its `useEffect`/state are removed by CALWUI-008; those rows are cascaded to `[D]` Deferred/removed at the Code stage, not amended here
- Decision record: [#325](https://github.com/wulke/premier-league-baseball/issues/325), [#326](https://github.com/wulke/premier-league-baseball/issues/326)
- Code: `src/ui/pages/game-world.tsx`, `src/ui/components/calendar-strip.tsx` (new)
