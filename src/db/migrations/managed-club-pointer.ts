import { DataTypes, Sequelize } from 'sequelize';

/**
 * Adds the nullable managed-club pointer to GameWorlds created before MCLB-001.
 * Existing worlds intentionally remain unclaimed; no backfill is performed.
 */
// @spec MCLB-001
const migrateManagedClubPointer = async (sequelize: Sequelize): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('GameWorlds');
  if ('managedTeamId' in columns) return;

  await queryInterface.addColumn('GameWorlds', 'managedTeamId', {
    type: DataTypes.INTEGER,
    allowNull: true,
  });
};

export { migrateManagedClubPointer };
