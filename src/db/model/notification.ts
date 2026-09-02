import { DataTypes } from 'sequelize';

// @spec NOTIF-010
module.exports = (sequelize: any) => {
  sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    gameWorldId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'GameWorlds',
        key: 'id',
      },
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Teams',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  }, {
    // envelope is append-only — no read-state field, no updatedAt (NOTIF-010)
    updatedAt: false,
  });
};
