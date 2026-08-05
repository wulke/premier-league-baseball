require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.SERVER_PORT;
const HOST = process.env.SERVER_HOST;
app.use(express.json());

import db from './db/client';
import { migrateLeagueYearAndStatus } from './db/migrations/league-year-status';
import { migrateManagedClubPointer } from './db/migrations/managed-club-pointer';
import { router as ApiRouter } from './api/router';

// static site assets
app.use('/', express.static('dist/ui'));
// apis
app.use('/', ApiRouter);

db.sync().then(async () => {
  // @spec SCL-012
  await migrateLeagueYearAndStatus(db);
  // @spec MCLB-001
  await migrateManagedClubPointer(db);
  app.listen(PORT, HOST);
  console.log(`Premier League Baseball -- running on http://${HOST}:${PORT}`);
});
