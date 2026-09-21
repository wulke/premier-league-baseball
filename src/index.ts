require('dotenv').config();
const PORT = Number(process.env.SERVER_PORT ?? 3000);
const HOST = process.env.SERVER_HOST ?? '0.0.0.0';

import db from './db/client';
import { migrateLeagueYearAndStatus } from './db/migrations/league-year-status';
import { migrateManagedClubPointer } from './db/migrations/managed-club-pointer';
import { migrateDivisionSeasonYearUnique } from './db/migrations/division-season-year-unique';
import { migratePlayerGameStatsOutsRecorded } from './db/migrations/player-game-stats-outs-recorded';
import { createApplication } from './app';

// @spec SPAF-001,SPAF-002,SPAF-003
const app = createApplication();

db.sync().then(async () => {
  // @spec SCL-012
  await migrateLeagueYearAndStatus(db);
  // @spec MCLB-001
  await migrateManagedClubPointer(db);
  // @spec DSU-004
  await migrateDivisionSeasonYearUnique(db);
  // @spec PARP-014
  await migratePlayerGameStatsOutsRecorded(db);
  app.listen(PORT, HOST);
  console.log(`Premier League Baseball -- running on http://${HOST}:${PORT}`);
});
