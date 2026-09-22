// @spec TODAY-001,TODAY-002,TODAY-003,TODAY-004,TODAY-005,TODAY-006,TODAY-007
// League Today snapshot acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/league-today.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  gameWorldId?: number;
  leagueId?: number;
  divisionId?: number;
  divisionSeasonIds: number[];
  homeTeamId?: number;
  awayTeamId?: number;
  gameIds: number[];
  response?: ResponseState;
}

const createWorld = (): WorldState => ({ divisionSeasonIds: [], gameIds: [] });
let scenarioWorld = createWorld();

const captureResponse = async (leagueId: number) => {
  try {
    const body = await (handlers as any).getLeagueToday(leagueId);
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = {
      statusCode: error instanceof DomainError ? error.statusCode : (error as any)?.statusCode ?? 500,
      error,
    };
  }
};

const errorText = (): string => scenarioWorld.response?.error instanceof Error
  ? scenarioWorld.response.error.message
  : '';

const responseGames = (): any[] => Array.isArray(scenarioWorld.response?.body)
  ? scenarioWorld.response!.body
  : [];

const createGame = async (status: string, scheduledDate: string, awayTeamId: number | null | undefined = scenarioWorld.awayTeamId) => {
  const game = await db.models.Game.create({
    homeTeam: scenarioWorld.homeTeamId,
    awayTeam: awayTeamId,
    status,
    scheduledDate: new Date(scheduledDate),
    ...(status === 'COMPLETED' ? { homeTeamResult: 3, awayTeamResult: 2 } : {}),
    round: 1,
  }).then(({ dataValues }) => dataValues);
  await db.models.DivisionSeasonGame.bulkCreate(
    scenarioWorld.divisionSeasonIds.map((divisionSeasonId) => ({ gameId: game.id, divisionSeasonId }))
  );
  scenarioWorld.gameIds.push(game.id);
  return game;
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+), year (\d+), and currentDate "([^"]+)"$/, async (gwId: string, year: string, currentDate: string) => {
    scenarioWorld.gameWorldId = Number(gwId);
    await db.models.GameWorld.create({ id: Number(gwId), year: Number(year), currentDate, config: {} });
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with one Division containing Team A and Team B$/, async (leagueId: string, gwId: string) => {
    const league = await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: 'BDD League' } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: {
      name: 'BDD Division',
      format: { structure: 'ROUND_ROBIN' },
    } }).then(({ dataValues }) => dataValues);
    const home = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team A' } }).then(({ dataValues }) => dataValues);
    const away = await db.models.Team.create({ gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name: 'Team B' } }).then(({ dataValues }) => dataValues);
    const seasons = await Promise.all([home, away].map((team) => db.models.DivisionSeason.create({
      divisionId: division.id, teamId: team.id, year: 2025,
    }).then(({ dataValues }) => dataValues)));
    scenarioWorld.leagueId = league.id;
    scenarioWorld.divisionId = division.id;
    scenarioWorld.homeTeamId = home.id;
    scenarioWorld.awayTeamId = away.id;
    scenarioWorld.divisionSeasonIds = seasons.map((season) => season.id);
  });

  given(/^GameWorld (\d+)'s currentDate is null$/, async (gwId: string) => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: Number(gwId) } });
  });

  given(/^a (COMPLETED|SCHEDULED) game between Team A and Team B scheduled on "([^"]+)"$/, async (status: string, date: string) => {
    await createGame(status, date);
  });

  given(/^League (\d+) belongs to GameWorld (\d+) with no Divisions$/, async (leagueId: string, gwId: string) => {
    await db.models.League.create({ id: Number(leagueId), gameWorldId: Number(gwId), config: { name: 'Empty League' } });
  });

  given(/^League (\d+)'s Division uses a KNOCKOUT format$/, async () => {
    await db.models.Division.update({ config: { name: 'BDD Division', format: { structure: 'KNOCKOUT' } } }, { where: { id: scenarioWorld.divisionId } });
  });

  given(/^a SCHEDULED bye game for Team A with no away team scheduled on "([^"]+)"$/, async (date: string) => {
    await createGame('SCHEDULED', date, null);
  });

  when(/^the player requests today's snapshot for League (\d+)$/, async (leagueId: string) => {
    await captureResponse(Number(leagueId));
  });

  then('the response indicates the League was not found', () => {
    expect(scenarioWorld.response?.statusCode).toBe(500);
    expect(errorText()).toContain('Invalid League');
  });

  then('the response is a 422 error', () => expect(scenarioWorld.response?.statusCode).toBe(422));
  then('the error indicates the GameWorld has no current date configured', () => expect(errorText()).toContain('the GameWorld has no current date configured'));
  then('the response includes that game', () => expect(responseGames().map((game) => game.gameId)).toContain(scenarioWorld.gameIds.at(-1)));
  then('the response does not include that game', () => expect(responseGames().map((game) => game.gameId)).not.toContain(scenarioWorld.gameIds.at(-1)));
  then('the games are returned in ascending scheduledDate order', () => expect(responseGames().map((game) => game.scheduledDate)).toEqual([...responseGames().map((game) => game.scheduledDate)].sort()));
  then('the response is an empty array', () => expect(scenarioWorld.response?.body).toEqual([]));
  then('the returned game includes gameId, scheduledDate, homeTeamId, homeTeamName, awayTeamId, awayTeamName, divisionId, divisionName, homeTeamResult, awayTeamResult, and status', () => {
    expect(responseGames()[0]).toEqual(expect.objectContaining({
      gameId: expect.any(Number), scheduledDate: expect.any(String), homeTeamId: scenarioWorld.homeTeamId,
      homeTeamName: 'Team A', awayTeamId: scenarioWorld.awayTeamId, awayTeamName: 'Team B',
      divisionId: scenarioWorld.divisionId, divisionName: 'BDD Division', homeTeamResult: 3, awayTeamResult: 2,
      status: 'COMPLETED',
    }));
  });
  then(/^the returned game's awayTeamName is "([^"]+)"$/, (name: string) => expect(responseGames()[0]?.awayTeamName).toBe(name));
  then('the returned game\'s awayTeamId is null', () => expect(responseGames()[0]?.awayTeamId).toBeNull());
  then('that game appears exactly once in the response', () => expect(responseGames().filter((game) => game.gameId === scenarioWorld.gameIds.at(-1))).toHaveLength(1));
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
});

autoBindSteps(feature, [registerSteps]);
