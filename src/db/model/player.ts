import { DataTypes } from 'sequelize';

// @spec PATTR-002,PATTR-003,PID-006,PID-009
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
    },
    givenName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    countryCode: {
      type: DataTypes.STRING(2),
      allowNull: false,
    },
    bats: {
      type: DataTypes.ENUM('R', 'L', 'S'),
      allowNull: false,
    },
    throws: {
      type: DataTypes.ENUM('R', 'L'),
      allowNull: false,
    },
    birthDate: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  });
};
