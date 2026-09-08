import { DataTypes } from 'sequelize';

module.exports = (sequelize: any) => {
  sequelize.define('Team', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    config: {
      type: DataTypes.JSON
    },
    // @spec TLO-001 — set once at creation to the League whose config produced this
    // Team; the durable Home League association (#174/#283). Participation in other
    // Leagues happens via DivisionSeason and never changes this column.
    homeLeagueId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });
};
