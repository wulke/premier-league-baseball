// @spec SCL-012
import db from '../../../src/db/client';
import { migrateLeagueYearAndStatus } from '../../../src/db/migrations/league-year-status';
import { migrateManagedClubPointer } from '../../../src/db/migrations/managed-club-pointer';

describe('League year/status migration', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
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
    await db.getQueryInterface().removeColumn('Leagues', 'status');
    await db.getQueryInterface().removeColumn('Leagues', 'year');
    const leagueId = await createLegacyLeague(gameWorld.id);
    const division = await db.models.Division.create({ config: {} }).then(({ dataValues }) => dataValues);
    await db.query('UPDATE Divisions SET leagueId = ? WHERE id = ?', { replacements: [leagueId, division.id] });
    const team = await db.models.Team.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: team.id, year: 1999 });

    await migrateLeagueYearAndStatus(db);

    const [rows] = await db.query('SELECT year, status FROM Leagues WHERE id = ?', { replacements: [leagueId] });
    expect(rows).toEqual([{ year: 2030, status: 'IN_SEASON' }]);
  });

  // @spec SCL-012
  it('backfills an existing League without DivisionSeason history as CUTOVER', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2032, config: {} }).then(({ dataValues }) => dataValues);
    await db.getQueryInterface().removeColumn('Leagues', 'status');
    await db.getQueryInterface().removeColumn('Leagues', 'year');
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
