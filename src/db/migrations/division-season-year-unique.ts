import { Sequelize } from 'sequelize';

/**
 * Rebuilds `DivisionSeasons` tables created before #275, whose `belongsToMany`
 * through-table declarations emitted a year-less table-level
 * `UNIQUE (divisionId, teamId)` alongside the intended composite
 * `(divisionId, teamId, year)` unique index. SQLite cannot DROP a table-level
 * constraint, so the table is rebuilt from the model definition — the same
 * backup-table pattern Sequelize itself uses for sqlite column alters. The
 * presence check makes startup safe on databases already at this schema version.
 */
// @spec DSU-001,DSU-004
const migrateDivisionSeasonYearUnique = async (sequelize: Sequelize): Promise<void> => {
  // A table-level UNIQUE constraint surfaces as an auto-index with origin 'u'
  // ('c' = CREATE INDEX, 'pk' = PRIMARY KEY). Only a year-less
  // (divisionId, teamId) constraint — the belongsToMany artifact — needs the rebuild.
  const [indexes] = await sequelize.query('PRAGMA index_list(`DivisionSeasons`)');
  let hasYearlessTableUnique = false;
  for (const idx of (indexes as Array<{ name: string; unique: number; origin: string }>)) {
    if (!(idx.unique === 1 && idx.origin === 'u')) continue;
    const [columns] = await sequelize.query(`PRAGMA index_info(\`${idx.name}\`)`);
    const names = (columns as Array<{ name: string }>).map((c) => c.name).sort();
    if (names.length === 2 && names[0] === 'divisionId' && names[1] === 'teamId') {
      hasYearlessTableUnique = true;
      break;
    }
  }
  if (!hasYearlessTableUnique) return;

  const queryInterface = sequelize.getQueryInterface();
  const model = sequelize.models.DivisionSeason as any;

  // The rebuild must run with FK enforcement OFF, else the DROP TABLE below
  // cascade-deletes the DivisionSeasonGames rows referencing the seasons.
  // The pragma is per-connection and a no-op inside a transaction, so the whole
  // rebuild runs on the default connection with an explicit BEGIN/COMMIT —
  // NOT sequelize.transaction(), which uses its own connection (where Sequelize
  // re-enables FOREIGN_KEYS=ON on open).
  await sequelize.query('PRAGMA foreign_keys = OFF');
  try {
    await sequelize.query('BEGIN IMMEDIATE');
    try {
      await sequelize.query('DROP TABLE IF EXISTS `DivisionSeasons_migrated`');
      // The replacement DDL is sourced from the model itself, so it always
      // matches what a fresh db.sync() produces (post-fix: no table-level UNIQUE).
      await queryInterface.createTable('DivisionSeasons_migrated', model.tableAttributes);
      await sequelize.query(
        'INSERT INTO `DivisionSeasons_migrated` (`id`, `divisionId`, `teamId`, `year`, `bracketSlot`, `createdAt`, `updatedAt`) '
        + 'SELECT `id`, `divisionId`, `teamId`, `year`, `bracketSlot`, `createdAt`, `updatedAt` FROM `DivisionSeasons`'
      );
      await sequelize.query('DROP TABLE `DivisionSeasons`');
      await sequelize.query('ALTER TABLE `DivisionSeasons_migrated` RENAME TO `DivisionSeasons`');
      await sequelize.query('COMMIT');
    } catch (error) {
      await sequelize.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON');
  }

  // DROP TABLE dropped the table's indexes with it — recreate the composite
  // unique index (the sole uniqueness constraint) if it did not survive.
  await sequelize.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS `division_seasons_division_id_team_id_year` '
    + 'ON `DivisionSeasons` (`divisionId`, `teamId`, `year`)'
  );

  // Post-condition: only the table's schema was rebuilt, never its rows —
  // no DivisionSeasonGames row may be left orphaned.
  const [orphans] = await sequelize.query('PRAGMA foreign_key_check(`DivisionSeasons`)');
  if ((orphans as unknown[]).length > 0) {
    throw new Error('DivisionSeasons year-unique migration left orphaned references behind');
  }
};

export { migrateDivisionSeasonYearUnique };
