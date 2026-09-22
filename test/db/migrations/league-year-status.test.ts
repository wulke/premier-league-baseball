// @spec SCL-012
import db from '../../../src/db/client';
import { migrateLeagueYearAndStatus } from '../../../src/db/migrations/league-year-status';
import { migrateManagedClubPointer } from '../../../src/db/migrations/managed-club-pointer';

describe('League year/status migration', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // Post-#283, Team.homeLeagueId creates a Teams→Leagues FK and the model inserts carry
  // status/year defaults, so Sequelize's removeColumn (a SQLite table recreate) breaks.
  // Swap in the legacy-shaped table via raw DDL instead — reversible in afterEach.
  // Mirrors the SCL-012 acceptance fixture in test/bdd/steps/season-calendar-lifecycle.steps.test.ts.
  let legacySchemaActive = false;
  const swapToLegacyLeagues = async () => {
    legacySchemaActive = true;
    await db.query('PRAGMA foreign_keys = OFF');
    await db.query('ALTER TABLE Leagues RENAME TO Leagues_modern');
    await db.query(`CREATE TABLE Leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config JSON,
      gameWorldId INTEGER NOT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    )`);
  };
  afterEach(async () => {
    if (!legacySchemaActive) return;
    legacySchemaActive = false;
    const [tables] = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name = 'Leagues_modern'");
    if ((tables as Array<{ name: string }>).length > 0) {
      await db.query('DROP TABLE IF EXISTS Leagues');
      await db.query('ALTER TABLE Leagues_modern RENAME TO Leagues');
    }
    await db.query('PRAGMA foreign_keys = ON');
  });

  const createLegacyLeague = async (gameWorldId: number): Promise<number> => {
    await db.query(
      "INSERT INTO Leagues (config, gameWorldId, createdAt, updatedAt) VALUES ('{}', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      { replacements: [gameWorldId] },
    );
    const [rows] = await db.query('SELECT id FROM Leagues WHERE gameWorldId = ?', { replacements: [gameWorldId] });
    return (rows as Array<{ id: number }>)[0].id;
  };

  // @spec SCL-012
  it('backfills an existing League with DivisionSeason history as IN_SEASON', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2030, config: {} }).then(({ dataValues }) => dataValues);
    // Model-created rows (whose inserts carry status/year defaults) precede the swap.
    const teamLeague = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({ gameWorldId: gameWorld.id, homeLeagueId: teamLeague.id, config: {} }).then(({ dataValues }) => dataValues);
    await swapToLegacyLeagues();
    const leagueId = await createLegacyLeague(gameWorld.id);
    const division = await db.models.Division.create({ config: {} }).then(({ dataValues }) => dataValues);
    await db.query('UPDATE Divisions SET leagueId = ? WHERE id = ?', { replacements: [leagueId, division.id] });
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: team.id, year: 1999 });

    await migrateLeagueYearAndStatus(db);

    const [rows] = await db.query('SELECT year, status FROM Leagues WHERE id = ?', { replacements: [leagueId] });
    expect(rows).toEqual([{ year: 2030, status: 'IN_SEASON' }]);
  });

  // @spec SCL-012
  it('backfills an existing League without DivisionSeason history as CUTOVER', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2032, config: {} }).then(({ dataValues }) => dataValues);
    await swapToLegacyLeagues();
    const leagueId = await createLegacyLeague(gameWorld.id);

    await migrateLeagueYearAndStatus(db);

    const [rows] = await db.query('SELECT year, status FROM Leagues WHERE id = ?', { replacements: [leagueId] });
    expect(rows).toEqual([{ year: 2032, status: 'CUTOVER' }]);
  });
});

describe('Managed-club pointer migration', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec MCLB-001
  it('@spec MCLB-001 adds the nullable pointer without backfilling an existing GameWorld', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2025, config: {} }).then(({ dataValues }) => dataValues);
    await db.getQueryInterface().removeColumn('GameWorlds', 'managedTeamId');

    await migrateManagedClubPointer(db);

    const [rows] = await db.query('SELECT managedTeamId FROM GameWorlds WHERE id = ?', {
      replacements: [gameWorld.id],
    });
    expect(rows).toEqual([{ managedTeamId: null }]);
  });
});
