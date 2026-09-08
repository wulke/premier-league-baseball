// @spec DSU-004  (division-season year-scoped uniqueness migration)
import db from '../../../src/db/client';
import { migrateDivisionSeasonYearUnique } from '../../../src/db/migrations/division-season-year-unique';

/**
 * Legacy `DivisionSeasons` DDL exactly as the pre-#275 belongsToMany declarations
 * emitted it: table-level UNIQUE (divisionId, teamId) without year, alongside the
 * model's composite unique index.
 */
const LEGACY_DDL = [
  'CREATE TABLE `DivisionSeasons` (',
  '  `id` INTEGER PRIMARY KEY AUTOINCREMENT,',
  '  `divisionId` INTEGER NOT NULL REFERENCES `Divisions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,',
  '  `teamId` INTEGER NOT NULL REFERENCES `Teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,',
  '  `year` INTEGER NOT NULL, `bracketSlot` INTEGER,',
  '  `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL,',
  '  UNIQUE (`divisionId`, `teamId`)',
  ')',
].join('\n');

const COMPOSITE_INDEX_DDL =
  'CREATE UNIQUE INDEX `division_seasons_division_id_team_id_year` ON `DivisionSeasons` (`divisionId`, `teamId`, `year`)';

const tableUniqueIndexes = async () => {
  const [indexes] = await db.query('PRAGMA index_list(`DivisionSeasons`)');
  return (indexes as Array<{ name: string; origin: string }>).filter((idx) => idx.origin === 'u');
};

const recreateLegacyTable = async (withCompositeIndex: boolean): Promise<void> => {
  await db.query('DROP TABLE `DivisionSeasons`');
  await db.query(LEGACY_DDL);
  if (withCompositeIndex) await db.query(COMPOSITE_INDEX_DDL);
};

const seedLegacySeason = async (): Promise<{ divisionId: number; teamId: number; dsId: number; gameId: number }> => {
  const gw = await db.models.GameWorld.create({ config: {} }).then((m) => m.dataValues);
  const team = await db.models.Team.create({ gameWorldId: gw.id, config: {} }).then((m) => m.dataValues);
  const league = await db.models.League.create({ gameWorldId: gw.id, config: {} }).then((m) => m.dataValues);
  const division = await db.models.Division.create({ config: {} }).then((m) => m.dataValues);
  await db.query('UPDATE `Divisions` SET leagueId = ? WHERE id = ?', { replacements: [league.id, division.id] });

  await db.query(
    'INSERT INTO `DivisionSeasons` (`divisionId`, `teamId`, `year`, `createdAt`, `updatedAt`) VALUES (?, ?, 2024, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    { replacements: [division.id, team.id] }
  );
  const [dsRows] = await db.query('SELECT id FROM `DivisionSeasons`');
  const dsId = (dsRows as Array<{ id: number }>)[0].id;
  const game = await db.models.Game.create({ homeTeam: team.id, awayTeam: null }).then((m) => m.dataValues);
  await db.models.DivisionSeasonGame.create({ gameId: game.id, divisionSeasonId: dsId });

  return { divisionId: division.id, teamId: team.id, dsId, gameId: game.id };
};

describe('DivisionSeason year-unique migration', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec DSU-004
  it('rebuilds a legacy table, preserving rows and linked games, leaving the composite index as the sole uniqueness constraint', async () => {
    await recreateLegacyTable(true);
    const legacy = await seedLegacySeason();

    await migrateDivisionSeasonYearUnique(db);

    // No table-level UNIQUE constraints remain (origin 'u' = CREATE TABLE constraint).
    expect(await tableUniqueIndexes()).toEqual([]);

    // Legacy row and its linked game survived the rebuild.
    const [rows] = await db.query(
      'SELECT id, divisionId, teamId, year FROM `DivisionSeasons` WHERE divisionId = ? AND teamId = ?',
      { replacements: [legacy.divisionId, legacy.teamId] }
    );
    expect(rows).toEqual([{ id: legacy.dsId, divisionId: legacy.divisionId, teamId: legacy.teamId, year: 2024 }]);
    const [links] = await db.query('SELECT gameId, divisionSeasonId FROM `DivisionSeasonGames`');
    expect(links).toEqual([{ gameId: legacy.gameId, divisionSeasonId: legacy.dsId }]);

    // Multi-season participation now works at the DB layer...
    await db.query(
      'INSERT INTO `DivisionSeasons` (`divisionId`, `teamId`, `year`, `createdAt`, `updatedAt`) VALUES (?, ?, 2025, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      { replacements: [legacy.divisionId, legacy.teamId] }
    );

    // ...while the composite (divisionId, teamId, year) index still rejects duplicates.
    await expect(db.query(
      'INSERT INTO `DivisionSeasons` (`divisionId`, `teamId`, `year`, `createdAt`, `updatedAt`) VALUES (?, ?, 2025, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      { replacements: [legacy.divisionId, legacy.teamId] }
    )).rejects.toThrow();
  });

  // @spec DSU-004
  it('restores the composite unique index when the legacy table lost it', async () => {
    await recreateLegacyTable(false);

    await migrateDivisionSeasonYearUnique(db);

    const [indexes] = await db.query('PRAGMA index_list(`DivisionSeasons`)');
    const names = (indexes as Array<{ name: string; unique: number }>).filter((i) => i.unique === 1).map((i) => i.name);
    expect(names).toEqual(['division_seasons_division_id_team_id_year']);
  });

  // @spec DSU-004
  it('is a no-op on an already-migrated schema (idempotent)', async () => {
    const [before] = await db.query('SELECT COUNT(*) AS n FROM `DivisionSeasons`');
    await db.models.GameWorld.create({ config: {} });
    await db.models.Division.create({ config: {} });

    await migrateDivisionSeasonYearUnique(db);
    await migrateDivisionSeasonYearUnique(db);

    const [after] = await db.query('SELECT COUNT(*) AS n FROM `DivisionSeasons`');
    expect(after).toEqual(before);
    expect(await tableUniqueIndexes()).toEqual([]);
  });
});
