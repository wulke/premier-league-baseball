import { DataTypes } from 'sequelize';

/**
 * DivisionSeason
 * 
 * Represents a Team's participation in a league's division for a given year.
 * A team can participate in multiple Leagues through 1+ Divisions within that League
 * 
 * https://stackoverflow.com/questions/70178569/how-can-we-insert-a-composite-primary-key-in-nm-table-using-sequelize
 */
module.exports = (sequelize: any) => {
  sequelize.define('DivisionSeason', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    divisionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    indexes: [{
      unique: true,
      fields: ['divisionId', 'teamId', 'year']
    }]
  });
};