// @spec TSCH-001,TSCH-002,TSCH-003,TSCH-004
// Team schedule read API (calendar) acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/team-schedule-read-api.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  teamIds: Record<string, number>;
  divisionIds: Record<string, number>;
  seasonIdsByDivision: Record<string, number[]>;
  gameIds: number[];
  response?: ResponseState;
}

const createWorld = (): WorldState => ({ teamIds: {}, divisionIds: {}, seasonIdsByDivision: {}, gameIds: [] });
let scenarioWorld = createWorld();

const capture = async (call: () => Promise<any>) => {
  try {
    const body = await call();
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = { statusCode: (error as any)?.statusCode ?? 500, error };
  }
};

const errorText = (): string => scenarioWorld.response?.error instanceof Error
  ? scenarioWorld.response.error.message
  : '';

const calendarGames = (): any[] => scenarioWorld.response?.body?.games ?? [];

const createGameInDivision = async (
  divisionName: string,
  status: string,
  round: number,
  awayTeamKey: string | null,
) => {
  const homeTeamId = scenarioWorld.teamIds['Team A'];
  const game = await db.models.Game.create({
    homeTeam: homeTeamId,
    awayTeam: awayTeamKey == null ? null : scenarioWorld.teamIds[awayTeamKey],
    status,
    scheduledDate: new Date('2025-06-01'),
    ...(status === 'COMPLETED' ? { homeTeamResult: 3, awayTeamResult: 2 } : {}),
    round,
  }).then(({ dataValues }) => dataValues);

  // A calendar game belongs to the (single) home team's DivisionSeason for that division/year.
  const [homeSeason] = await db.models.DivisionSeason.findAll({
    where: { divisionId: scenarioWorld.divisionIds[divisionName], teamId: homeTeamId, year: 2025 },
  });
  await db.models.DivisionSeasonGame.create({ gameId: game.id, divisionSeasonId: homeSeason.dataValues.id });
  scenarioWorld.gameIds.push(game.id);
  return game;
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), config: {} });
  });

  given(/^GameWorld (\d+) exists with year (\d+)$/, async (gwId: string, year: string) => {
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), config: {} });
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with Division "([^"]+)" containing Team A and Team B$/, async (leagueId: string, gwId: string, divisionName: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: `League ${leagueId}` } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: divisionName,
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    scenarioWorld.divisionIds[divisionName] = division.id;

    // Team A/B are shared across both of the world's divisions — create only once.
    if (scenarioWorld.teamIds['Team A'] == null) {
      const home = await db.models.Team.create({ gameWorldId: 1, config: { name: 'Team A' } }).then(({ dataValues }) => dataValues);
      const away = await db.models.Team.create({ gameWorldId: 1, config: { name: 'Team B' } }).then(({ dataValues }) => dataValues);
      scenarioWorld.teamIds['Team A'] = home.id;
      scenarioWorld.teamIds['Team B'] = away.id;
    }
    await Promise.all(['Team A', 'Team B'].map((key) => db.models.DivisionSeason.create({
      divisionId: division.id, teamId: scenarioWorld.teamIds[key], year: 2025,
    })));
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with Division "([^"]+)" containing Team C$/, async (leagueId: string, gwId: string, divisionName: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: `League ${leagueId}` } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: divisionName,
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    scenarioWorld.divisionIds[divisionName] = division.id;

    const team = await db.models.Team.create({ gameWorldId: Number(gwId), config: { name: 'Team C' } }).then(({ dataValues }) => dataValues);
    scenarioWorld.teamIds['Team C'] = team.id;
    await db.models.DivisionSeason.create({ divisionId: division.id, teamId: team.id, year: 2025 });
  });

  given(/^a COMPLETED game between Team A and Team B in Division "([^"]+)" of the (\d+) season$/, async (divisionName: string) => {
    await createGameInDivision(divisionName, 'COMPLETED', 1, 'Team B');
  });

  given(/^a SCHEDULED game between Team A and Team B in Division "([^"]+)" round (\d+) of the (\d+) season$/, async (divisionName: string, round: string) => {
    await createGameInDivision(divisionName, 'SCHEDULED', Number(round), 'Team B');
  });

  given(/^a SCHEDULED bye game for Team A with no away team in Division "([^"]+)" of the (\d+) season$/, async (divisionName: string) => {
    await createGameInDivision(divisionName, 'SCHEDULED', 1, null);
  });

  given(/^Division "([^"]+)" uses a KNOCKOUT format$/, async (divisionName: string) => {
    await db.models.Division.update({
      config: { name: divisionName, format: { structure: 'KNOCKOUT' } },
    }, { where: { id: scenarioWorld.divisionIds[divisionName] } });
  });

  when(/^the player requests Team A's calendar for GameWorld (\d+)$/, async (gwId: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(gwId)));
  });

  when(/^the player requests Team C's calendar for GameWorld (\d+)$/, async (gwId: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team C'], Number(gwId)));
  });

  when(/^the player requests Team A's calendar for GameWorld (\d+) narrowed to League (\d+)$/, async (gwId: string, leagueId: string) => {
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(gwId), Number(leagueId)));
  });

  when('the player requests Team A\'s calendar without a GameWorld id', async () => {
    // Mirrors the router's Number(req.query.gwId) coercion of a missing query param.
    await capture(() => handlers.getTeamSchedule(scenarioWorld.teamIds['Team A'], Number(undefined)));
  });

  when(/^the player requests Team (\d+)'s calendar for GameWorld (\d+)$/, async (teamId: string, gwId: string) => {
    await capture(() => handlers.getTeamSchedule(Number(teamId), Number(gwId)));
  });

  then('the response has teamId and teamName for Team A', () => {
    expect(scenarioWorld.response?.body.teamId).toBe(scenarioWorld.teamIds['Team A']);
    expect(scenarioWorld.response?.body.teamName).toBe('Team A');
  });

  then('the response includes both games with year, division and team-name context', () => {
    const games = calendarGames();
    expect(games).toHaveLength(2);
    expect(games.map((game) => game.gameId)).toEqual(expect.arrayContaining(scenarioWorld.gameIds));
    const sample = games[0];
    expect(sample).toEqual(expect.objectContaining({
      year: 2025,
      homeTeamId: scenarioWorld.teamIds['Team A'],
      homeTeamName: 'Team A',
      awayTeamId: scenarioWorld.teamIds['Team B'],
      awayTeamName: 'Team B',
      status: 'COMPLETED',
    }));
    expect(Object.keys(scenarioWorld.divisionIds)).toEqual(expect.arrayContaining([sample.divisionName]));
    expect(typeof sample.scheduledDate).toBe('string');
  });

  then('the response\'s games array is empty', () => expect(calendarGames()).toEqual([]));

  then(/^the response includes only the game from Division "([^"]+)"$/, (divisionName: string) => {
    const games = calendarGames();
    expect(games).toHaveLength(1);
    expect(games[0].divisionId).toBe(scenarioWorld.divisionIds[divisionName]);
    expect(games[0].divisionName).toBe(divisionName);
  });

  then('the response is a 500 error', () => expect(scenarioWorld.response?.statusCode).toBe(500));

  then('the error surfaces the raw persistence-layer failure for a NaN world id', () => {
    expect(errorText()).toContain('NaN');
  });

  then('the error indicates the GameWorld was not found', () => expect(errorText()).toContain('GameWorld'));

  then('the error indicates the Team was not found', () => expect(errorText()).toContain('Team'));

  then(/^the bye game's awayTeamName is "([^"]+)"$/, (name: string) => {
    const bye = calendarGames().find((game) => game.gameId === scenarioWorld.gameIds.at(-1));
    expect(bye?.awayTeamName).toBe(name);
  });

  then('the bye game\'s awayTeamId is null', () => {
    const bye = calendarGames().find((game) => game.gameId === scenarioWorld.gameIds.at(-1));
    expect(bye?.awayTeamId).toBeNull();
  });

  then(/^the bye game's roundLabel is "([^"]+)"$/, (label: string) => {
    const bye = calendarGames().find((game) => game.gameId === scenarioWorld.gameIds.at(-1));
    expect(bye?.roundLabel).toBe(label);
  });

  then(/^that game's roundLabel is "([^"]+)"$/, (label: string) => {
    const game = calendarGames().find((candidate) => candidate.gameId === scenarioWorld.gameIds.at(-1));
    expect(game?.roundLabel).toBe(label);
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
});

autoBindSteps(feature, [registerSteps]);
