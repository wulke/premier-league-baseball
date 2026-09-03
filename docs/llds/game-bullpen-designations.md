# LLD: Next-Game Bullpen Designations

> Upstream: #243 · Existing snapshot primitive: [`game-lineup-snapshot.md`](./game-lineup-snapshot.md) · EARS: `docs/specs/manager/game-bullpen-designations-specs.md` (`GBULL-001`..`GBULL-006`).

## Interface / Data Model

```ts
TeamFactory(teamId).getNextScheduledGame(): Promise<Game | null>
TeamFactory(teamId).getNextGameLineup(): Promise<{ game, lineup } | null>
TeamFactory(teamId).saveGameLineup(gameId, entries, rules): Promise<TeamLineup>

GET   /api/team/:teamId/lineup/next-game?gwId=…
PATCH /api/team/:teamId/lineup/:gameId
{ entries: ActiveLineupEntry[] }
```

No schema is added. The active `Lineup(gameId IS NULL)` remains the template. On the first
next-game read, `snapshotForGame(gameId)` creates (or returns) `Lineup(gameId)` and its copied
entries. In that snapshot, the `STARTER` entry at `fieldingPosition: 'Pitcher'` is the designated
starter and only `BULLPEN` entries are active relievers. `BENCH` rows are inactive reserve slots.

## Logic Flow

```
GET next-game lineup:
  → find team's Game where (homeTeam = teamId OR awayTeam = teamId) AND status = SCHEDULED,
    ordered scheduledDate ASC, id ASC
  → none: return null (no edit affordance)
  → snapshotForGame(game.id), then project the snapshot through getLineup({ gameId })
  → return game metadata plus the card

PATCH game lineup:
  → resolve Team and target Game; verify the game includes the Team
  → reject with 422 unless status is SCHEDULED
  → resolve the same division-over-league-over-default MatchRules as the base lineup
  → verify all submitted players are on the Team roster; validateLineup the complete replacement
  → transactionally replace only this game's LineupEntry rows; return its canonical card

Lineup page Bullpen tab:
  → fetch next-game lineup alongside the active card and roster
  → render the next opponent/date and snapshot slots
  → for a managed team with a SCHEDULED game, per-slot select controls swap player IDs between
    the SP, BENCH, and BULLPEN slots locally; SP/BULLPEN controls offer only roster players whose
    `primaryPosition` is `Pitcher`, while BENCH controls offer only existing non-pitcher BENCH
    occupants (never defensive starters); submit the complete snapshot with PATCH
  → other teams and started/completed games render the snapshot read-only
```

The PATCH endpoint deliberately has no managed-team/server authorization gate. The application has
no authentication boundary; `managedTeamId` controls UI affordances only. This does not alter the
current random-score `SimulationEngine`.

## Edge Case Probe

| Condition | Handling |
|---|---|
| No scheduled team game | GET returns `null`; Bullpen tab explains that there is no next scheduled game. |
| Multiple scheduled games on a date | Stable `id ASC` tie-breaker selects one. |
| Snapshot already exists | Reuse it unchanged; it is never recreated from the active template. |
| Target game belongs to another team | 404; no orphan/cross-team snapshot can be edited. |
| Game becomes `IN_PROGRESS` / `COMPLETED` | PATCH rejects before writing and UI has no controls. |
| Invalid/partial replacement or roster outsider | 422 before the transaction; persisted snapshot is unchanged. |
| Non-managed viewed club | Its snapshot remains visible, but only the UI hides selectors and Save. |
| A fielder is selected for an SP or active-bullpen slot | It is not an eligible option. The current slot occupant remains available for legacy/invalid snapshot display. |
| A manager changes a bench slot | Only current non-pitcher bench occupants are candidates; a defensive starter cannot be silently exchanged through this bullpen-only surface. |

## Traceability

| Layer | Artifact |
|---|---|
| EARS | `docs/specs/manager/game-bullpen-designations-specs.md` |
| Backend Gherkin | `test/bdd/features/game-bullpen-designations.feature` |
| UI Gherkin | `test/ui/features/game-bullpen-designations.feature` |
| Code | `src/db/domain/team.ts`, `src/api/{endpoints,handlers,router}.ts`, `src/ui/pages/team-lineup.tsx` |
