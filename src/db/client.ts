import { Sequelize } from 'sequelize';
import { applyAssociations } from './model/associations';
require('dotenv').config();

// client
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_URL,
  logging: false,
  // sqlite (especially ':memory:') is single-writer; a pool of >1 connections
  // would each open their own separate in-memory database and silently miss
  // each other's tables/rows.
  pool: { max: 1 }
});

// model definitions
const modelDefinitions = [
  require('./model/game-world'),
  require('./model/league'),
  require('./model/team'),
  require('./model/player'),
  require('./model/division'),
  require('./model/division-season'),
  require('./model/game'),
  require('./model/division-season-game'),
  require('./model/season-result')
];
modelDefinitions.forEach((m) => m(sequelize));

// associations
applyAssociations(sequelize);

// client
export default sequelize;
