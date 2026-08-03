// @spec SCL-012
import db from '../../../src/db/client';
import { migrateLeagueYearAndStatus } from '../../../src/db/migrations/league-year-status';

describe('League year/status migration', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec SCL-012
  it('backfills an existing League with DivisionSeason history as IN_SEASON', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2030, config: {} }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: team.id, year: 1999 });
    await db.getQueryInterface().removeColumn('Leagues', 'status');
    await db.getQueryInterface().removeColumn('Leagues', 'year');

    await migrateLeagueYearAndStatus(db);

    const [rows] = await db.query('SELECT year, status FROM Leagues WHERE id = ?', { replacements: [league.id] });
    expect(rows).toEqual([{ year: 2030, status: 'IN_SEASON' }]);
  });

  // @spec SCL-012
  it('backfills an existing League without DivisionSeason history as CUTOVER', async () => {
    const gameWorld = await db.models.GameWorld.create({ year: 2032, config: {} }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    await db.getQueryInterface().removeColumn('Leagues', 'status');
    await db.getQueryInterface().removeColumn('Leagues', 'year');

    await migrateLeagueYearAndStatus(db);

    const [rows] = await db.query('SELECT year, status FROM Leagues WHERE id = ?', { replacements: [league.id] });
    expect(rows).toEqual([{ year: 2032, status: 'CUTOVER' }]);
  });
});
