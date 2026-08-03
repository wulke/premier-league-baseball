// @spec SCL-002
// Season calendar lifecycle cutover acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { LeagueFactory } from '../../../src/db/domain';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/season-calendar-lifecycle.feature'), {
  tagFilter: '@spec:scl-002',
});

interface WorldState {
  leagueId?: number;
  divisionId?: number;
  response?: { statusCode: number; body?: unknown; error?: unknown };
}

let world: WorldState;

const readLeague = async () => {
  if (!world.leagueId) throw new Error('League is not set');
  return LeagueFactory(world.leagueId).get();
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and currentDate unset$/, async (id: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: 2027, config: {}, currentDate: null });
  });

  given(/^a League "([^"]+)" exists in GameWorld (\d+) with year (\d+) and status (CUTOVER|IN_SEASON)$/, async (
    name: string, gameWorldId: string, year: string, status: string,
  ) => {
    const league = await db.models.League.create({
      gameWorldId: Number(gameWorldId), config: { name }, year: Number(year), status,
    }).then(({ dataValues }) => dataValues);
    world.leagueId = league.id;
  });

  given(/^League "[^"]+" has a Division with schedulingConfig startDate "[^"]+" and intervalDays \d+$/, async () => {
    const division = await db.models.Division.create({
      leagueId: world.leagueId,
      config: { name: 'BDD Division', schedulingConfig: { startDate: '2027-03-01', intervalDays: 7 } },
    }).then(({ dataValues }) => dataValues);
    world.divisionId = division.id;
  });

  given(/^League "[^"]+"'s status is IN_SEASON$/, async () => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: world.leagueId } });
  });

  given(/^League "[^"]+" has an incomplete Division season for year (\d+)$/, async (year: string) => {
    const season = await db.models.DivisionSeason.create({ divisionId: world.divisionId, teamId: 1, year: Number(year) })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: 1, awayTeam: 2, status: 'SCHEDULED' })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });
  });

  given(/^League "[^"]+"'s Division season for year (\d+) is complete$/, async (year: string) => {
    const season = await db.models.DivisionSeason.create({ divisionId: world.divisionId, teamId: 1, year: Number(year) })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: 1, awayTeam: 2, status: 'COMPLETED', homeTeamResult: 1, awayTeamResult: 0 })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });
  });

  when(/^an admin cuts over League "[^"]+"$/, async () => {
    try {
      const body = await LeagueFactory(world.leagueId).cutover();
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : 500, error };
    }
  });

  then('the response is a 422 error', () => expect(world.response?.statusCode).toBe(422));
  then('the response is 200', () => expect(world.response?.statusCode).toBe(200));
  then(/^League "[^"]+"'s status is still (CUTOVER|IN_SEASON)$/, async (status: string) => {
    await expect(readLeague()).resolves.toMatchObject({ status });
  });
  then(/^League "[^"]+"'s year is still (\d+)$/, async (year: string) => {
    await expect(readLeague()).resolves.toMatchObject({ year: Number(year) });
  });
  then(/^League "[^"]+"'s year is (\d+)$/, async (year: string) => {
    await expect(readLeague()).resolves.toMatchObject({ year: Number(year) });
  });
  then(/^League "[^"]+"'s status is (CUTOVER|IN_SEASON)$/, async (status: string) => {
    await expect(readLeague()).resolves.toMatchObject({ status });
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  world = {};
});

autoBindSteps(feature, [registerSteps]);
