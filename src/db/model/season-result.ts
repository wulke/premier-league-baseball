import { DataTypes } from 'sequelize';

/**
 * SeasonResult
 *
 * General-purpose record of a division's decided season for a given year. Written by the
 * knockout round-advancement path once a bracket reduces to a single winner, and by the
 * round-robin League's top-tier division once its season completes. Kept on its own table so
 * historical season facts don't pollute live season-progress tables (Division / DivisionSeason).
 *
 * One row per (divisionId, year); championTeamId is null until the season is decided.
 */
module.exports = (sequelize: any) => {
  sequelize.define('SeasonResult', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    divisionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    championTeamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    indexes: [{
      unique: true,
      fields: ['divisionId', 'year']
    }]
  });
};
