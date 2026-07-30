import { DataTypes } from 'sequelize';

module.exports = (sequelize: any) => {
  sequelize.define('DivisionSeasonGame', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    gameId: {
      type: DataTypes.INTEGER,
    },
    divisionSeasonId: {
      type: DataTypes.INTEGER
    }
  });
};