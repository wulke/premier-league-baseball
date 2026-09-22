// Shared SCL-012 fixture helper: swap the model-synced Leagues table for a
// legacy-shaped one (pre-SCL-001 schema: no year/status columns) via raw DDL.
//
// Why not Sequelize's removeColumn: on SQLite it recreates the table, and since
// per-League team ownership (#283) the implicit DELETE violates the Teams→Leagues
// FK on existing Team rows and corrupts the schema for the next
// db.sync({ force: true }). The test client's single-connection pool
// (src/db/client.ts) makes the PRAGMA toggle apply process-wide.
//
// Used by test/bdd/steps/season-calendar-lifecycle.steps.test.ts (acceptance)
// and test/db/migrations/league-year-status.test.ts (unit).
import { Sequelize } from 'sequelize';

const LEGACY_LEAGUES_DDL = `CREATE TABLE Leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config JSON,
  gameWorldId INTEGER NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
)`;

export const createLegacyLeagueSchemaSwap = (db: Sequelize) => {
  let active = false;
  return {
    /** True between swap() and restore() — guard afterEach with this if preferred. */
    get active() { return active; },
    /** Rename the modern table aside and create the legacy-shaped Leagues table. */
    swap: async (): Promise<void> => {
      active = true;
      await db.query('PRAGMA foreign_keys = OFF');
      await db.query('ALTER TABLE Leagues RENAME TO Leagues_modern');
      await db.query(LEGACY_LEAGUES_DDL);
    },
    /** Put the modern table back. Safe to call unconditionally (no-op unless swapped). */
    restore: async (): Promise<void> => {
      if (!active) return;
      active = false;
      const [tables] = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name = 'Leagues_modern'");
      if ((tables as Array<{ name: string }>).length > 0) {
        await db.query('DROP TABLE IF EXISTS Leagues');
        await db.query('ALTER TABLE Leagues_modern RENAME TO Leagues');
      }
      await db.query('PRAGMA foreign_keys = ON');
    },
  };
};
