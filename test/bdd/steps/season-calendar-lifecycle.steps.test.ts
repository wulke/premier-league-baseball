// @spec SCL-002..SCL-013,SCL-017
// Season calendar lifecycle cutover/start acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { GameFactory, LeagueFactory, TeamFactory } from '../../../src/db/domain';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';
import { Endpoints } from '../../../src/api/endpoints';
import { router } from '../../../src/api/router';
import { migrateLeagueYearAndStatus } from '../../../src/db/migrations/league-year-status';

const ROUND_ROBIN_FORMAT = {
  structure: 'ROUND_ROBIN' as const,
  legs: 'ONE_LEG' as const,
  seriesLength: 'Bo1' as const,
  tiebreak: 'AGGREGATE_SCORE' as const,
};

const feature = loadFeature(path.resolve(__dirname, '../features/season-calendar-lifecycle.feature'));

interface WorldState {
  leagueId?: number;
  divisionId?: number;
  teamIds: number[];
  response?: { statusCode: number; body?: unknown; error?: unknown };
  divisionConfigBeforeUpdate?: Record<string, unknown>;
  schedule?: any;
  legacyLeagueId?: number;
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
      config: {
        name: 'BDD Division', defaultTeams: world.teamIds, format: ROUND_ROBIN_FORMAT,
        schedulingConfig: { startDate: '2027-03-01', intervalDays: 7 },
      },
    }).then(({ dataValues }) => dataValues);
    world.divisionId = division.id;
  });

  given(/^League "(.*)"'s status is IN_SEASON$/, async (_name: string) => {
    await db.models.League.update({ status: 'IN_SEASON' }, { where: { id: world.leagueId } });
  });
  given(/^a second League "([^"]+)" exists in GameWorld (\d+) with year (\d+) and status (CUTOVER|IN_SEASON)$/, async (
    name: string, gameWorldId: string, year: string, status: string,
  ) => {
    const league = await db.models.League.create({
      gameWorldId: Number(gameWorldId), config: { name }, year: Number(year), status,
    }).then(({ dataValues }) => dataValues);
    world.leagueId = league.id;
  });

  given(/^League "(.+)" has an incomplete Division season for year (\d+)$/, async (_name: string, year: string) => {
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

  const findLeagueByName = async (name: string) => {
    const leagues = await db.models.League.findAll({ where: { gameWorldId: 1 } });
    const league = leagues.find((candidate) => candidate.dataValues.config?.name === name);
    if (!league) throw new Error(`League '${name}' not found`);
    return league;
  };

  given(/^League "([^"]+)" has year (\d+) and a Game scheduled on "([^"]+)"$/, async (
    name: string, year: string, scheduledDate: string,
  ) => {
    const league = await findLeagueByName(name);
    await league.update({ year: Number(year), status: 'IN_SEASON' });
    const division = await db.models.Division.findOne({ where: { leagueId: league.dataValues.id } })
      ?? await db.models.Division.create({
        leagueId: league.dataValues.id,
        config: { name: `${name} Division`, defaultTeams: world.teamIds, format: ROUND_ROBIN_FORMAT },
      });
    const season = await db.models.DivisionSeason.create({
      divisionId: division.dataValues.id, teamId: world.teamIds[0], year: Number(year),
    });
    const game = await db.models.Game.create({
      homeTeam: world.teamIds[0], awayTeam: world.teamIds[1], scheduledDate,
    });
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.dataValues.id, gameId: game.dataValues.id });
  });

  given(/^the same team plays in League "[^"]+" and League "[^"]+"$/, () => undefined);

  given(/^League "([^"]+)"'s status is IN_SEASON with a Game scheduled on "([^"]+)"$/, async (
    name: string, scheduledDate: string,
  ) => {
    const league = await findLeagueByName(name);
    await league.update({ status: 'IN_SEASON' });
    const division = await db.models.Division.findOne({ where: { leagueId: league.dataValues.id } });
    const season = await db.models.DivisionSeason.create({
      divisionId: division!.dataValues.id, teamId: world.teamIds[0], year: league.dataValues.year,
    });
    const game = await db.models.Game.create({
      homeTeam: world.teamIds[0], awayTeam: world.teamIds[1], scheduledDate,
    });
    await db.models.DivisionSeasonGame.create({ divisionSeasonId: season.dataValues.id, gameId: game.dataValues.id });
  });

  const createLegacyLeague = async (withDivisionSeason: boolean) => {
    await db.getQueryInterface().removeColumn('Leagues', 'status');
    await db.getQueryInterface().removeColumn('Leagues', 'year');
    await db.query(
      "INSERT INTO Leagues (config, gameWorldId, createdAt, updatedAt) VALUES ('{}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    );
    const [rows] = await db.query('SELECT id FROM Leagues WHERE gameWorldId = 1 ORDER BY id DESC LIMIT 1');
    world.legacyLeagueId = (rows as Array<{ id: number }>)[0].id;
    if (!withDivisionSeason) return;

    const division = await db.models.Division.create({ config: {} }).then(({ dataValues }) => dataValues);
    await db.query('UPDATE Divisions SET leagueId = ? WHERE id = ?', { replacements: [world.legacyLeagueId, division.id] });
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: world.teamIds[0], year: 2027 });
  };

  given('a legacy League exists with GameWorld.year 2027 and existing DivisionSeason rows', async () => {
    await createLegacyLeague(true);
  });
  given('a legacy League exists with GameWorld.year 2027 and no DivisionSeason rows', async () => {
    await createLegacyLeague(false);
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
  when("an admin requests the team's schedule", async () => {
    world.schedule = await TeamFactory(world.teamIds[0]).getSchedule(1);
  });
  when(/^an admin batch-simulates GameWorld (\d+)$/, async (gameWorldId: string) => {
    try {
      const body = await GameFactory().simulateBatch(Number(gameWorldId));
      world.response = { statusCode: 200, body };
    } catch (error) {
      world.response = { statusCode: error instanceof DomainError ? error.statusCode : 500, error };
    }
  });
  when('the season-calendar-lifecycle migration runs', async () => {
    await migrateLeagueYearAndStatus(db);
  });
  when(/^an admin updates League "[^"]+"'s Division schedulingConfig startDate to "([^"]+)"$/, async (startDate: string) => {
    const division = await db.models.Division.findByPk(world.divisionId);
    world.divisionConfigBeforeUpdate = division!.dataValues.config;
    const layer = router.stack.find((route: any) => route.route?.path === Endpoints.UpdateDivisionSchedulingConfig && route.route?.methods?.patch);
    if (!layer) throw new Error('PATCH division scheduling config route is not registered');

    const res: any = { send: jest.fn(), status: jest.fn().mockReturnThis() };
    await layer.route.stack[0].handle({
      params: { divisionId: `${world.divisionId}` },
      body: { schedulingConfig: { ...division!.dataValues.config.schedulingConfig, startDate } },
    }, res);
    world.response = res.status.mock.calls.length
      ? { statusCode: res.status.mock.calls[0][0], error: res.send.mock.calls[0]?.[0] }
      : { statusCode: 200, body: res.send.mock.calls[0]?.[0] };
  });

  given(/^GameWorld \d+'s currentDate is "([^"]+)"$/, async (currentDate: string) => {
    await db.models.GameWorld.update({ currentDate }, { where: { id: 1 } });
  });
  given(/^GameWorld \d+'s currentDate is unset$/, async () => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: 1 } });
  });
  given(/^League "[^"]+"'s Division has no schedulingConfig$/, async () => {
    const division = await db.models.Division.findByPk(world.divisionId);
    const { schedulingConfig: _schedulingConfig, ...config } = division!.dataValues.config;
    await division!.update({ config });
  });

  then(/^the response is a (\d+) error$/, (statusCode: string) => expect(world.response?.statusCode).toBe(Number(statusCode)));
  then(/^the response is (\d+)$/, (statusCode: string) => expect(world.response?.statusCode).toBe(Number(statusCode)));
  then(/^GameWorld \d+'s currentDate has been bootstrapped to "([^"]+)"$/, async (currentDate: string) => {
    await expect(db.models.GameWorld.findByPk(1)).resolves.toMatchObject({ dataValues: { currentDate } });
  });
  then(/^GameWorld \d+'s currentDate remains "([^"]+)"$/, async (currentDate: string) => {
    await expect(db.models.GameWorld.findByPk(1)).resolves.toMatchObject({ dataValues: { currentDate } });
  });
  then(/^GameWorld \d+'s currentDate remains unset$/, async () => {
    await expect(db.models.GameWorld.findByPk(1)).resolves.toMatchObject({ dataValues: { currentDate: null } });
  });
  then(/^GameWorld \d+'s config\.inProgress is (true|false)$/, async (inProgress: string) => {
    await expect(db.models.GameWorld.findByPk(1)).resolves.toMatchObject({
      dataValues: { config: { inProgress: inProgress === 'true' } },
    });
  });
  then(/^League "[^"]+"'s status is still (CUTOVER|IN_SEASON)$/, async (status: string) => {
    await expect(readLeague()).resolves.toMatchObject({ status });
  });
  then("League \"MLS\"'s status is CUTOVER", async () => {
    await expect(readLeague()).resolves.toMatchObject({ status: 'CUTOVER' });
  });
  then(/^League "(.+)"'s year is still (\d+)$/, async (_name: string, year: string) => {
    await expect(readLeague()).resolves.toMatchObject({ year: Number(year) });
  });
  then(/^League "[^"]+"'s year is (\d+)$/, async (year: string) => {
    await expect(readLeague()).resolves.toMatchObject({ year: Number(year) });
  });
  then(/^League "MLS"'s status becomes IN_SEASON$/, async () => {
    await expect(readLeague()).resolves.toMatchObject({ status: 'IN_SEASON' });
  });
  then('the response is a 422 error identifying the offending Division', () => {
    expect(world.response?.statusCode).toBe(422);
    expect((world.response?.error as Error).message).toContain('Division');
  });
  then(/^League "[^"]+"'s Division keeps its non-scheduling config fields$/, async () => {
    const division = await db.models.Division.findByPk(world.divisionId);
    const { schedulingConfig: _updatedSchedulingConfig, ...updatedConfig } = division!.dataValues.config;
    const { schedulingConfig: _previousSchedulingConfig, ...previousConfig } = world.divisionConfigBeforeUpdate!;
    expect(updatedConfig).toEqual(previousConfig);
    expect(division!.dataValues.config.schedulingConfig.startDate).toBe('2028-03-06');
  });
  then(/^League "[^"]+"'s Division config is unchanged$/, async () => {
    await expect(db.models.Division.findByPk(world.divisionId)).resolves.toMatchObject({
      dataValues: { config: world.divisionConfigBeforeUpdate },
    });
  });
  then(/^no Game exists for League "[^"]+"'s year (\d+)$/, async (year: string) => {
    const divisionSeasons = await db.models.DivisionSeason.findAll({
      where: { divisionId: world.divisionId, year: Number(year) },
      include: [{ model: db.models.Game, through: { attributes: [] } }],
    });
    expect(divisionSeasons.flatMap((season: any) => season.dataValues.Games)).toHaveLength(0);
  });
  then('the response has no top-level year field', () => {
    expect(world.schedule).not.toHaveProperty('year');
  });
  then(/^the Game scheduled on "([^"]+)" reports year (\d+)$/, (scheduledDate: string, year: string) => {
    expect(world.schedule?.games).toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduledDate: `${scheduledDate}T00:00:00.000Z`, year: Number(year) }),
    ]));
  });
  then(/^League "([^"]+)"'s Game scheduled on "[^"]+" is COMPLETED$/, async (name: string) => {
    const league = await findLeagueByName(name);
    const divisions = await db.models.Division.findAll({ where: { leagueId: league.dataValues.id } });
    const seasons = await db.models.DivisionSeason.findAll({ where: { divisionId: divisions.map((division) => division.dataValues.id) } });
    const links = await db.models.DivisionSeasonGame.findAll({ where: { divisionSeasonId: seasons.map((season) => season.dataValues.id) } });
    await expect(db.models.Game.findByPk(links[0].dataValues.gameId)).resolves.toMatchObject({ dataValues: { status: 'COMPLETED' } });
  });
  then(/^League "([^"]+)" has no Games$/, async (name: string) => {
    const league = await findLeagueByName(name);
    const divisions = await db.models.Division.findAll({ where: { leagueId: league.dataValues.id } });
    const seasons = await db.models.DivisionSeason.findAll({ where: { divisionId: divisions.map((division) => division.dataValues.id) } });
    const links = await db.models.DivisionSeasonGame.findAll({ where: { divisionSeasonId: seasons.map((season) => season.dataValues.id) } });
    expect(links).toHaveLength(0);
  });
  then(/^the legacy League's year is (\d+)$/, async (year: string) => {
    const [rows] = await db.query('SELECT year FROM Leagues WHERE id = ?', { replacements: [world.legacyLeagueId] });
    expect(rows).toEqual([{ year: Number(year) }]);
  });
  then(/^the legacy League's status is (CUTOVER|IN_SEASON)$/, async (status: string) => {
    const [rows] = await db.query('SELECT status FROM Leagues WHERE id = ?', { replacements: [world.legacyLeagueId] });
    expect(rows).toEqual([{ status }]);
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  world = { teamIds: [] };
});

autoBindSteps(feature, [registerSteps]);
