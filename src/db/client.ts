import { Sequelize } from 'sequelize';
import { applyAssociations } from './model/associations';
require('dotenv').config();

// client
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL,
  logging: false
});

// model definitions
const modelDefinitions = [
  require('./model/game-world'),
  require('./model/league'),
  require('./model/team'),
  require('./model/division'),
  require('./model/division-season'),
  require('./model/game'),
  require('./model/division-season-game')
];
modelDefinitions.forEach((m) => m(sequelize));

// associations
applyAssociations(sequelize);

// client
export default sequelize;