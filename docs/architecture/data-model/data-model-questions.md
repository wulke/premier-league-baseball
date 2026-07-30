# Data Model Review Questions

Assessment summary:
The core structure is coherent: a `GameWorld` owns `Leagues` and `Teams`, `Leagues` own `Divisions`, and `DivisionSeason` acts as the join between `Division` and `Team` with a year dimension. That matches the domain code in `src/db/domain/*.ts` and the associations in `src/db/model/associations.ts`.

Design gaps or ambiguities to consider:
- `Game.homeTeam` and `Game.awayTeam` are intended FK references but are not defined as associations. This means no referential integrity or convenient `include` behavior.
- `DivisionSeasonGame` creates a many-to-many between `Game` and `DivisionSeason`. In practice, each game is created for a single division season and then linked twice (home/away). If the intent is “game belongs to a single division season,” a direct `divisionSeasonId` FK on `Game` could be simpler and avoid duplicated join rows.
- `DivisionSeasonGame` lacks a uniqueness constraint on `(gameId, divisionSeasonId)` so duplicates are possible.
- `GameWorld.year` default is `new Date().getFullYear() - 1`, while `newSeason` increments year. It’s unclear why new worlds start at “current year minus one.”
- Season state lives only in `DivisionSeason` and `GameWorld.year`. There’s no explicit `Season` entity, which is fine, but cross-league queries and constraints are harder (for example, ensuring all divisions in a league for a year exist).
- Config is stored as JSON for `Team`, `League`, `Division`, `GameWorld`, which is flexible but pushes constraints and indexing out of the DB.

Review after answers:
- Given your answer that a `Game` always belongs to a single `DivisionSeason`, the current `DivisionSeasonGame` join table is heavier than needed. A direct `divisionSeasonId` FK on `Game` would simplify storage and querying, and avoid the double rows per game.
- The `GameWorld.year` default of “current year - 1” makes sense for your intent to allow historical setup and then advance to the current year on first `newSeason()`. If this grows, consider splitting this into two fields (e.g., `startYear` and `currentYear`) for clarity.
- You want `Game.homeTeam`/`awayTeam` enforced as FKs, which is appropriate for safety and better includes.
- Allowing teams to be in multiple divisions in the same year across different leagues fits your league-type model, so the current `DivisionSeason` uniqueness is fine.
- The `DivisionSeasonGame` question about `role` is a signal that the current join table is doing multiple jobs. If you want per-team participation metadata, a dedicated `GameTeam` (or similar) table would be clearer than storing `home/away` twice at the join layer.

Suggested model adjustments:
- Replace `DivisionSeasonGame` with a direct `Game.divisionSeasonId` FK.
- Add explicit associations for `Game.homeTeamId` and `Game.awayTeamId` to `Team` (with `as` aliases for clarity).
- Optional: introduce `GameTeam` if you want per-team stats or richer participation data without duplicating join rows.
- Optional: consider `startYear` and `currentYear` if the historical simulation path grows.

Please add your answers inline under each question.

1. Should a `Game` belong to exactly one division season, or can a single game be shared across multiple division seasons?

Answer: It should belong to a single division season. I chose this design originally because the same teams could play multiple games over different division seasons or even multiple in the same division season. But a single game will always belog to a single division season.

2. Why does `GameWorld.year` default to “current year - 1”? Is that to allow `newSeason()` to advance to current year on first run?

Answer: That's correct, the goal was so that executing `newSeason()` would default to the current year when advancing. The idea was that a "previous" year could be started and support historical simulations before the user began playing the game, as opposed to no historical background when starting from the default current year.

3. Do you want `Game.homeTeam`/`awayTeam` enforced as FK associations to `Team`?

Answer: Yes if this helps ensure safety.

4. Do you expect a team to participate in multiple divisions within the same year? The unique index on `DivisionSeason` (`divisionId`, `teamId`, `year`) allows multiple divisions per team per year as long as division differs. Is that intended?

Answer: Yes this is intended. Divisions will be associated to different Leagues and League Types -- a team could participate in a regular "League" style structure as well as a knockout tournament in the same season. Both would be unique Leagues with one or more Divisions, and the Team could participate in both Leagues through the Division.

5. Should `DivisionSeasonGame` enforce uniqueness on (`gameId`, `divisionSeasonId`) and perhaps include a `role` (home/away) if you want to model participation explicitly?

Answer: What does the benefit of add `role` due for a `DivisionSeasonGame`? A `DivisionSeasonGame` is supposed to represent the reference for a Game to it's associated DivisionSeason to make it easier for building queries and access patterns that quickly aggregate results and metrics across a single DivisionSeason.
