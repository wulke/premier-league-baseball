import { DataTypes, Op } from 'sequelize';

// @spec LIN-001
module.exports = (sequelize: any) => {
  sequelize.define('Lineup', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    teamId: { type: DataTypes.INTEGER, allowNull: false },
    gameWorldId: { type: DataTypes.INTEGER, allowNull: false },
    gameId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    indexes: [
      { unique: true, fields: ['teamId'], where: { gameId: null } },
      { unique: true, fields: ['teamId', 'gameId'], where: { gameId: { [Op.not]: null } } },
    ],
  });
};
