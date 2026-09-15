# LLD: Player Stats Query

## Interface / Data Model

`GET /api/player/:playerId/stats?grain=season|career|last10` returns one batting block and one pitching block. `season` joins `PlayerGameStats → Game → DivisionSeasonGame → DivisionSeason` and filters the current GameWorld year; `career` is unfiltered; `last10` orders completed game rows by game date and limits to ten.

The query uses Sequelize `fn('SUM')`, `fn('COUNT')`, `col`, and database ordering, never a JavaScript reduction. Future filters extend the internal `{ grain, filters }` query spec with `opponentTeamId` or `pitcherId`; opponent needs explicit integer `Game.homeTeam`/`awayTeam` predicates because those are not associations.

## Logic Flow

1. Verify the player belongs to the requested GameWorld.
2. Aggregate counting columns in SQLite for the requested grain.
3. Return `null` when no game rows exist; otherwise derive `AVG`, `OBP`, `SLG`, `OPS`, `ERA`, and `WHIP` server-side. A zero denominator produces `null`.

## Edge Case Probe

- No rows → `null`; the UI displays “No stats recorded yet”.
- Two-way player → always return separate batting and pitching blocks from the same aggregate row.
- Zero denominator → rate is `null`, never `Infinity` or a stored zero.
