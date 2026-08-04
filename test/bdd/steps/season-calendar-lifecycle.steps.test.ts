// @spec SCL-002,SCL-003,SCL-004
// Season calendar lifecycle cutover/start acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { LeagueFactory } from '../../../src/db/domain';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/season-calendar-lifecycle.feature'));
feature.scenarios = feature.scenarios.filter((scenario) =>
  scenario.tags.some((tag) => ['@spec:scl-002', '@spec:scl-003', '@spec:scl-004'].includes(tag))
);

interface WorldState {
  leagueId?: number;
  divisionId?: number;
  teamIds: number[];
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
    world.teamIds = await Promise.all(['Home', 'Away'].map((name) => db.models.Team.create({
      gameWorldId: Number(id), config: { name },
    }).then(({ dataValues }) => dataValues.id)));
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
    const season = await db.models.DivisionSeason.create({ divisionId: world.divisionId, teamId: world.teamIds[0], year: Number(year) })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: world.teamIds[0], awayTeam: world.teamIds[1], status: 'SCHEDULED' })
      .then(({ dataValues }) => dataValues);
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.id, gameId: game.id });
  });

  given(/^League "[^"]+"'s Division season for year (\d+) is complete$/, async (year: string) => {
    const season = await db.models.DivisionSeason.create({ divisionId: world.divisionId, teamId: world.teamIds[0], year: Number(year) })
      .then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({ homeTeam: world.teamIds[0], awayTeam: world.teamIds[1], status: 'COMPLETED', homeTeamResult: 1, awayTeamResult: 0 })
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

  when(/^an admin starts League "[^"]+"'s season$/, async () => {
    try {
      const body = await LeagueFactory(world.leagueId).start();
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : 500, error };
    }
  });

  given(/^GameWorld \d+'s currentDate is "([^"]+)"$/, async (currentDate: string) => {
    await db.models.GameWorld.update({ currentDate }, { where: { id: 1 } });
  });

  then(/^the response is a (\d+) error$/, (statusCode: string) => expect(world.response?.statusCode).toBe(Number(statusCode)));
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
  then(/^League "[^"]+"'s status is (CUTOVER)$/, async (status: string) => {
    await expect(readLeague()).resolves.toMatchObject({ status });
  });
  then('the response is a 422 error identifying the offending Division', () => {
    expect(world.response?.statusCode).toBe(422);
    expect((world.response?.error as Error).message).toContain('Division');
  });
  then(/^no Game exists for League "[^"]+"'s year (\d+)$/, async (year: string) => {
    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: world.divisionId, year: Number(year) },
      include: [{ model: db.models.Game, through: { attributes: [] } }],
    });
    expect(divisionSeasons.flatMap((season: any) => season.dataValues.Games)).toHaveLength(0);
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  world = { teamIds: [] };
});

autoBindSteps(feature, [registerSteps]);
