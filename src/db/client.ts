import { Sequelize } from 'sequelize';
import { applyAssociations } from './model/associations';
// Detect Jest: it sets NODE_ENV=test and JEST_WORKER_ID on every run (verified
// for default workers, --runInBand, and even an explicit NODE_ENV override), so
// this holds regardless of how a test is launched (npm script, `npx jest`, IDE).
const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// development/production only: load .env (DATABASE_URL=./dev.sqlite, ports, ...).
// Skipped under Jest so prod config/secrets can never leak into tests.
if (!isTest) {
  require('dotenv').config();
}

// Tests ALWAYS use an isolated in-memory SQLite DB, ignoring any file-backed
// DATABASE_URL that happens to be exported into the shell (e.g. by direnv/.envrc
// for the dev server). This is the hard guarantee that db.sync({ force: true }) —
// which DROPs and recreates every table, called by every backend test — can never
// clobber the real dev.sqlite, no matter how a test is launched.
const storage = isTest ? ':memory:' : process.env.DATABASE_URL;

// client
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage,
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
  require('./model/contract'),
  require('./model/player-game-stats'),
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
