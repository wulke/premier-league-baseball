import { DataTypes } from 'sequelize';

module.exports = (sequelize: any) => {
  // @spec SCL-001,SCL-012
  sequelize.define('League', {
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
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('CUTOVER', 'IN_SEASON'),
      allowNull: false,
      defaultValue: 'CUTOVER',
    }
  });
};
