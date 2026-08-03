import { DataTypes, Sequelize } from 'sequelize';

/**
 * Adds the League lifecycle columns to databases created before SCL-001.
 * The presence check makes startup safe on databases already at this schema
 * version, without re-deriving status on subsequent application launches.
 */
// @spec SCL-012
const migrateLeagueYearAndStatus = async (sequelize: Sequelize): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('Leagues');
  const needsYear = !('year' in columns);
  const needsStatus = !('status' in columns);
  if (!needsYear && !needsStatus) return;

  if (needsYear) {
    await queryInterface.addColumn('Leagues', 'year', {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }
  if (needsStatus) {
    await queryInterface.addColumn('Leagues', 'status', {
      type: DataTypes.ENUM('CUTOVER', 'IN_SEASON'),
      allowNull: false,
      defaultValue: 'CUTOVER',
    });
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`
      UPDATE "Leagues"
      SET "year" = (
        SELECT "year" FROM "GameWorlds"
        WHERE "GameWorlds"."id" = "Leagues"."gameWorldId"
      )
    `, { transaction });
  });

  await sequelize.query(`
    UPDATE "Leagues"
    SET "status" = CASE WHEN EXISTS (
      SELECT 1
      FROM "Divisions"
      INNER JOIN "DivisionSeasons" ON "DivisionSeasons"."divisionId" = "Divisions"."id"
      WHERE "Divisions"."leagueId" = "Leagues"."id"
    ) THEN 'IN_SEASON' ELSE 'CUTOVER' END
  `);
};

export { migrateLeagueYearAndStatus };
