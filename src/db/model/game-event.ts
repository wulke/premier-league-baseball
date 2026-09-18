import { DataTypes } from 'sequelize';

// @spec ECP-001 — durable, ordered engine envelopes; timestamps are intentionally absent.
module.exports = (sequelize: any) => {
  sequelize.define('GameEvent', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gameId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Games',
        key: 'id',
      },
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    causedByEventId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    context: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  }, {
    timestamps: false,
    indexes: [{
      unique: true,
      fields: ['gameId', 'sequence'],
    }],
  });
};
