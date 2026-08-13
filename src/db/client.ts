import { Sequelize } from 'sequelize';
import { applyAssociations } from './model/associations';
// True when running under Jest. Jest sets NODE_ENV='test' on every run and
// JEST_WORKER_ID on every worker (verified for default workers, --runInBand, and
// even an explicit NODE_ENV override), so this holds regardless of how a test is
// launched (npm script, bare `npx jest`, IDE runner). Exported so the guarantee
// is unit-tested in test/db/client.test.ts.
export function isTestEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'test' || env.JEST_WORKER_ID !== undefined;
}

// Resolve the SQLite storage path. Tests ALWAYS get an isolated in-memory DB,
// ignoring any ambient DATABASE_URL that happens to be exported into the shell
// (e.g. by direnv/.envrc for the dev server). This is the hard guarantee that
// db.sync({ force: true }) — which DROPs and recreates every table, called by
// every backend test — can never clobber the real dev.sqlite, no matter how a
// test is launched. Exported for unit testing.
export function resolveDbStorage(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return isTestEnv(env) ? ':memory:' : env.DATABASE_URL;
}

// development/production only: load .env (DATABASE_URL=./dev.sqlite, ports, ...).
// Skipped under Jest so prod config/secrets can never leak into tests.
if (!isTestEnv()) {
  require('dotenv').config();
}

const storage = resolveDbStorage();

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
  require('./model/lineup'),
  require('./model/lineup-entry'),
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
