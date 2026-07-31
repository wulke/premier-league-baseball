import { DataTypes } from 'sequelize';

// @spec PCON-008
module.exports = (sequelize: any) => {
  sequelize.define('Contract', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    playerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Players',
        key: 'id',
      },
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Teams',
        key: 'id',
      },
    },
    startYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    endYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });
};
