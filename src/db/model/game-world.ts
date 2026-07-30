import { DataTypes } from 'sequelize';

module.exports = (sequelize: any) => {
  sequelize.define('GameWorld', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    config: {
      type: DataTypes.JSON
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: new Date().getFullYear() - 1
    },
    currentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    }
  });
};