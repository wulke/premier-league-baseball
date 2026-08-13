import { DataTypes, Op } from 'sequelize';

// @spec LIN-001
module.exports = (sequelize: any) => {
  sequelize.define('LineupEntry', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    lineupId: { type: DataTypes.INTEGER, allowNull: false },
    playerId: { type: DataTypes.INTEGER, allowNull: false },
    role: { type: DataTypes.ENUM('STARTER', 'BENCH', 'BULLPEN'), allowNull: false },
    battingOrder: { type: DataTypes.INTEGER, allowNull: true },
    fieldingPosition: { type: DataTypes.ENUM('Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'), allowNull: true },
  }, {
    indexes: [
      { unique: true, fields: ['lineupId', 'playerId'] },
      { unique: true, fields: ['lineupId', 'battingOrder'], where: { battingOrder: { [Op.not]: null } } },
    ],
  });
};
