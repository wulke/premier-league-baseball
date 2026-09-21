# LLD: Game Box Score

## Interface / Data Model

`GET /api/game/:gameId` returns a completed game's final score and two team blocks:

```ts
{
  id: number;
  home: { teamId: number; teamName: string; score: number | null; players: BoxScorePlayer[] };
  away: { teamId: number; teamName: string; score: number | null; players: BoxScorePlayer[] };
}
```

Each `BoxScorePlayer` contains Player identity, the frozen `LineupEntry` fields
`battingOrder`, `fieldingPosition`, and `role`, and the raw `PlayerGameStats` counting
columns. `IP` is `outsRecorded / 3` at read time. There is no aggregation: a box score
is one persisted stat row per player-game.

## Logic Flow

1. Load `Game` by id; a missing game is `404`, and a non-completed game raises
   `DomainError(..., 422)`.
2. Load `PlayerGameStats(gameId)` with each row's `Player` identity and join it to the
   matching frozen `LineupEntry` through `Lineup(gameId, teamId)` plus `playerId`.
3. Use the joined frozen `Lineup.teamId`, compared with `Game.homeTeam` / `awayTeam`, to
   assign each stat row to a side. Never use the player's mutable current `teamId`.
4. Order each side by batting order, then `STARTER`, `BENCH`, `BULLPEN`; retain every
   stat row, including reserves used in the game.
5. Return empty `players` for a side whose snapshot writer emitted no rows. The UI renders
   that side's explicit empty state without affecting the other side.

## Edge Case Probe

- Game is scheduled or in progress -> `422` through the shared `{ error: string }` path.
- Legacy rows have no `outsRecorded` -> derived `IP` is `0`, even if the legacy `IP` column is populated.
- A player has changed teams since the game -> frozen lineup ownership remains authoritative.
- One side has no snapshot/stat rows -> return that side with `players: []`, never zero-fill or fail the whole request.
