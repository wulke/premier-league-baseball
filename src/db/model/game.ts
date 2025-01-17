import { DataTypes } from 'sequelize';

module.exports = (sequelize: any) => {
  sequelize.define('Game', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    homeTeam: {
      type: DataTypes.INTEGER,
      // fk reference to Team.id
    },
    awayTeam: {
      type: DataTypes.INTEGER,
      // fk reference to Team.id
    },
    scheduledDate: {
      type: DataTypes.DATE,
    },
    /**
     * result: {
     * }
     */
  });
};