# Specs: Next-Game Action Item Producer

Requirements for the first real `ActionItemsPanel` producer (#366): the managed team's next
`SCHEDULED` game, surfaced once per league, on the GameWorld home page
(`src/ui/hooks/use-next-game-action-items.ts`, `src/ui/pages/game-world.tsx`).

| ID | Requirement | Status |
|---|---|---|
| NGAI-001 | WHEN the GameWorld home page loads IF `gw.managedTeamId` is set AND `gw.Leagues` is non-empty THE system SHALL fetch each league's schedule for the managed team ELSE THE system SHALL produce no items | [x] → #366 |
| NGAI-002 | WHEN a league's schedule is fetched THE system SHALL determine that league's "next game" as the earliest-`scheduledDate` `SCHEDULED` game (nulls sorted last) IF the fetch fails THE system SHALL treat that league as having no next game, without affecting other leagues | [x] → #366 |
| NGAI-003 | WHEN a league's next game has `scheduledDate == null` THE system SHALL treat it as ready regardless of `currentDate`, mirroring `PREGAME-005`'s exemption | [x] → #366 |
| NGAI-004 | WHEN a league's next game has a non-null `scheduledDate` THE system SHALL surface an item for that league only IF `scheduledDate <= currentDate` (non-strict, same boundary as `PREGAME-005`/`SIMUI-031`) | [x] → #366 |
| NGAI-005 | WHEN a league has no `SCHEDULED` game for the managed team THE system SHALL produce no item for that league | [x] → #366 |
| NGAI-006 | WHEN a league's next game is ready (NGAI-003 or NGAI-004) THE system SHALL emit one `ActionItem` for that league with `severity: 'warning'`, `href` set to `/:gwId/:leagueId/game/:gameId` for that game, and a `ctaLabel` of `'Prep'`, passed into `ActionItemsPanel`'s existing `items` prop (`ACTUI-001`) | [x] → #366 |

*Status: `[ ]` Active, `[x]` Implemented, `[D]` Deferred.*

## Traceability

- HLD: `docs/high-level-design.md` — "Action-items panel scope" (#327)
- LLD: `docs/llds/game-world/next-game-action-item-producer.md`
- Sibling specs: `docs/specs/game-world/action-items-panel-ui-specs.md` (`ACTUI-001`..`ACTUI-005` — panel contract, unchanged), `docs/specs/manager/pre-game-prep-ui-specs.md` (`PREGAME-005` — readiness boundary, reused verbatim)
- Code: `src/ui/hooks/use-next-game-action-items.ts` (new), `src/ui/pages/game-world.tsx`
- Issue: [#366](https://github.com/wulke/premier-league-baseball/issues/366)
