import { DataTypes } from 'sequelize';

// @spec PATTR-002,PATTR-003
module.exports = (sequelize: any) => {
  sequelize.define('Player', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gameWorldId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    attributes: {
      type: DataTypes.JSON,
      allowNull: false,
    }
  });
};
