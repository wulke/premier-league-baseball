import { DataTypes, Sequelize } from 'sequelize';

/**
 * Adds the real-stat pipeline's pitched-out primitive to databases created before
 * PARP-014. The presence check keeps every subsequent application startup safe.
 */
// @spec PARP-014
const migratePlayerGameStatsOutsRecorded = async (sequelize: Sequelize): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('PlayerGameStats');
  if ('outsRecorded' in columns) return;

  await queryInterface.addColumn('PlayerGameStats', 'outsRecorded', {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  });
};

export { migratePlayerGameStatsOutsRecorded };
