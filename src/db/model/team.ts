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
    }
  });
};