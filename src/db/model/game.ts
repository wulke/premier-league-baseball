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
    round: {
      type: DataTypes.INTEGER,
    },
    scheduledDate: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'SCHEDULED'
    },
    /* ! todo ! re-evaluate how results and game logs should be stored */
    homeTeamResult: {
      type: DataTypes.INTEGER
    },
    awayTeamResult: {
      type: DataTypes.INTEGER
    }
  });
};
