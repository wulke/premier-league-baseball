import { DataTypes } from 'sequelize';

// @spec PSTAT-001,PSTAT-002,PSTAT-003,PSTAT-004
module.exports = (sequelize: any) => {
  sequelize.define('PlayerGameStats', {
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
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Games',
        key: 'id',
      },
    },
    AB: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    H: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    R: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    RBI: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // @spec PSTAT-003,PSTAT-004
    '2B': {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // @spec PSTAT-003,PSTAT-004
    '3B': {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    HR: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    BB: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    SO: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    GS: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    IP: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pitchingH: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pitchingBB: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pitchingSO: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    ER: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    indexes: [{
      unique: true,
      fields: ['playerId', 'gameId'],
    }],
  });
};
