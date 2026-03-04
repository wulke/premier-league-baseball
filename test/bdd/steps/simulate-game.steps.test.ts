import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { simulateGame, simulateBatchGames as simulateBatchGamesHandler } from '../../../src/api/handlers';
import { GameSimulationError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';

interface ResponseState {
  statusCode: number;
  body?: unknown;
  error?: unknown;
}

interface WorldState {
  gameWorldId?: number;
  year?: number;
  currentDate?: string | null;
  homeTeamId?: number;
  awayTeamId?: number;
  leagueId?: number;
  divisionId?: number;
  divisionSeasonIds: number[];
  focusGameId?: number;
  createdGameIds: number[];
  preSimulationResult?: { homeTeamResult: number | null; awayTeamResult: number | null; status: string | null };
  response?: ResponseState;
  forceDbError: boolean;
}

const feature = loadFeature(path.resolve(__dirname, '../features/simulate-game.feature'));

const createWorld = (): WorldState => ({
  divisionSeasonIds: [],
  createdGameIds: [],
  forceDbError: false,
});
let scenarioWorld = createWorld();

const requireFocusGameId = (world: WorldState): number => {
  if (!world.focusGameId) throw new Error('focusGameId is not set');
  return world.focusGameId;
};

const readGame = async (id: number) => {
  const game = await db.models.Game.findByPk(id);
  if (!game) throw new Error(`Game '${id}' not found`);
  return game.dataValues;
};

const createGame = async (
  world: WorldState,
  status: string,
  scheduledDate: string | null,
  homeTeamResult?: number,
  awayTeamResult?: number
) => {
  const homeTeam = world.homeTeamId ?? 1;
  const awayTeam = world.awayTeamId ?? 2;
  const game = await db.models.Game.create({
    homeTeam,
    awayTeam,
    status,
    ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
    ...(homeTeamResult !== undefined ? { homeTeamResult } : {}),
    ...(awayTeamResult !== undefined ? { awayTeamResult } : {}),
  }).then(({ dataValues }) => dataValues);

  world.focusGameId = game.id;
  world.createdGameIds.push(game.id);

  if (world.divisionSeasonIds.length > 0) {
    await db.models.DivisionSeasonGame.bulkCreate(
      world.divisionSeasonIds.map((divisionSeasonId) => ({ gameId: game.id, divisionSeasonId }))
    );
  }
};

const simulateSingleGame = async (world: WorldState, gameId: number) => {
  const prior = await db.models.Game.findByPk(gameId);
  if (prior) {
    world.preSimulationResult = {
      homeTeamResult: prior.dataValues.homeTeamResult ?? null,
      awayTeamResult: prior.dataValues.awayTeamResult ?? null,
      status: prior.dataValues.status ?? null,
    };
  }

  try {
    const body = await simulateGame(gameId);
    world.response = { statusCode: 200, body };
  } catch (error) {
    if (error instanceof GameSimulationError) {
      world.response = { statusCode: error.statusCode, error };
    } else {
      world.response = { statusCode: 500, error };
    }
  }
};

const simulateBatchGames = async (world: WorldState, gameWorldId: number, endDate?: string) => {
  if (world.forceDbError) {
    world.response = { statusCode: 500, error: new Error('Injected database error') };
    return;
  }
  try {
    const body = await simulateBatchGamesHandler(gameWorldId, endDate);
    world.response = { statusCode: 200, body };
  } catch (error) {
    if (error instanceof GameSimulationError) {
      world.response = { statusCode: error.statusCode, error };
    } else {
      world.response = { statusCode: 500, error };
    }
  }
};

const getSimulatedGames = (world: WorldState): any[] => {
  const body: any = world.response?.body;
  if (!body || !Array.isArray(body.simulated)) return [];
  return body.simulated;
};

const getSkippedGames = (world: WorldState): any[] => {
  const body: any = world.response?.body;
  if (!body || !Array.isArray(body.skipped)) return [];
  return body.skipped;
};

const getErrorText = (world: WorldState): string => {
  if (world.response?.error instanceof Error) return world.response.error.message;
  if (typeof world.response?.error === 'string') return world.response.error;
  if (typeof world.response?.body === 'string') return world.response.body;
  if (world.response?.body && typeof world.response.body === 'object') {
    const body: any = world.response.body;
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  }
  return '';
};

const registerSteps = ({ given, when, then, and }: any) => {
  given(/^a GameWorld exists with id (\d+), year (\d+), and currentDate "([^"]+)"$/, async (gwId: string, year: string, currentDate: string) => {
    const world = scenarioWorld;
    const id = Number(gwId);
    const parsedYear = Number(year);
    world.gameWorldId = id;
    world.year = parsedYear;
    world.currentDate = currentDate;

    await db.models.GameWorld.create({
      id,
      year: parsedYear,
      currentDate,
      config: {}
    });
  });

  given(/^a home team and away team exist in GameWorld (\d+)$/, async (gwId: string) => {
    const world = scenarioWorld;
    const gameWorldId = Number(gwId);
    const homeTeam = await db.models.Team.create({
      gameWorldId,
      config: { name: 'Home BDD Team' }
    }).then(({ dataValues }) => dataValues);
    const awayTeam = await db.models.Team.create({
      gameWorldId,
      config: { name: 'Away BDD Team' }
    }).then(({ dataValues }) => dataValues);

    world.homeTeamId = homeTeam.id;
    world.awayTeamId = awayTeam.id;
  });

  given(/^a League, Division, and DivisionSeason exist in GameWorld (\d+) for year (\d+)$/, async (gwId: string, year: string) => {
    const world = scenarioWorld;
    const gameWorldId = Number(gwId);
    const parsedYear = Number(year);

    const league = await db.models.League.create({
      gameWorldId,
      config: { name: 'BDD League' }
    }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({
      leagueId: league.id,
      config: { name: 'BDD Division' }
    }).then(({ dataValues }) => dataValues);

    const homeTeamId = world.homeTeamId ?? 1;
    const awayTeamId = world.awayTeamId ?? 2;
    const dsHome = await db.models.DivisionSeason.create({
      divisionId: division.id,
      teamId: homeTeamId,
      year: parsedYear
    }).then(({ dataValues }) => dataValues);
    const dsAway = await db.models.DivisionSeason.create({
      divisionId: division.id,
      teamId: awayTeamId,
      year: parsedYear
    }).then(({ dataValues }) => dataValues);

    world.leagueId = league.id;
    world.divisionId = division.id;
    world.divisionSeasonIds = [dsHome.id, dsAway.id];
  });

  given(/^a Game exists with status "([^"]+)" and scheduledDate "([^"]+)"$/, async (status: string, scheduledDate: string) => {
    const world = scenarioWorld;
    await createGame(world, status, scheduledDate);
  });

  given(/^a Game exists with status "([^"]+)" and no scheduledDate$/, async (status: string) => {
    const world = scenarioWorld;
    await createGame(world, status, null);
  });

  given(/^a Game exists with status "([^"]+)", scheduledDate "([^"]+)", homeTeamResult (\d+), awayTeamResult (\d+)$/, async (
    status: string, scheduledDate: string, homeTeamResult: string, awayTeamResult: string
  ) => {
    const world = scenarioWorld;
    await createGame(world, status, scheduledDate, Number(homeTeamResult), Number(awayTeamResult));
  });

  given(/^(\d+) Games exist with status "([^"]+)" and scheduledDate "([^"]+)"$/, async (count: string, status: string, scheduledDate: string) => {
    const world = scenarioWorld;
    const total = Number(count);
    for (let i = 0; i < total; i += 1) {
      await createGame(world, status, scheduledDate);
    }
  });

  given('the GameWorld currentDate is null', async () => {
    const world = scenarioWorld;
    world.currentDate = null;
    if (!world.gameWorldId) {
      const gw = await db.models.GameWorld.create({ config: {}, year: 2025 }).then(({ dataValues }) => dataValues);
      world.gameWorldId = gw.id;
      return;
    }

    await db.models.GameWorld.update(
      { currentDate: null },
      { where: { id: world.gameWorldId } }
    );
  });

  given(/^the game has been simulated and now has status "([^"]+)" with homeTeamResult (\d+) and awayTeamResult (\d+)$/, async (
    status: string, homeTeamResult: string, awayTeamResult: string
  ) => {
    const world = scenarioWorld;
    const gameId = requireFocusGameId(world);
    await db.models.Game.update({
      status,
      homeTeamResult: Number(homeTeamResult),
      awayTeamResult: Number(awayTeamResult)
    }, { where: { id: gameId } });
  });

  given('a database error will occur mid-transaction', () => {
    const world = scenarioWorld;
    world.forceDbError = true;
  });

  when('the player simulates the game by id', async () => {
    const world = scenarioWorld;
    await simulateSingleGame(world, requireFocusGameId(world));
  });

  when(/^the player simulates a game with id (\d+)$/, async (id: string) => {
    const world = scenarioWorld;
    await simulateSingleGame(world, Number(id));
  });

  when('the player simulates the game by id again', async () => {
    const world = scenarioWorld;
    await simulateSingleGame(world, requireFocusGameId(world));
  });

  when(/^the player triggers batch simulation for GameWorld (\d+) with no endDate$/, async (gwId: string) => {
    const world = scenarioWorld;
    await simulateBatchGames(world, Number(gwId));
  });

  when(/^the player triggers batch simulation for GameWorld (\d+) with endDate "([^"]+)"$/, async (gwId: string, endDate: string) => {
    const world = scenarioWorld;
    await simulateBatchGames(world, Number(gwId), endDate);
  });

  then('the response is 200 with the updated game', () => {
    const world = scenarioWorld;
    expect(world.response?.statusCode).toBe(200);
    expect(world.response?.body).toBeDefined();
  });

  then('the response is 200', () => {
    const world = scenarioWorld;
    expect(world.response?.statusCode).toBe(200);
  });

  then('the response is a 4xx error', () => {
    const world = scenarioWorld;
    expect(world.response?.statusCode).toBeGreaterThanOrEqual(400);
    expect(world.response?.statusCode).toBeLessThan(500);
  });

  then('the response is a 500 error', () => {
    const world = scenarioWorld;
    expect(world.response?.statusCode).toBe(500);
  });

  then(/^the error indicates (.+)$/, (expectedMessage: string) => {
    const world = scenarioWorld;
    expect(getErrorText(world)).toEqual(expect.stringContaining(expectedMessage));
  });

  then(/^the game status is "([^"]+)"$/, async (expectedStatus: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.status).toBe(expectedStatus);
  });

  then(/^the game status remains "([^"]+)"$/, async (expectedStatus: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.status).toBe(expectedStatus);
  });

  then(/^the game status is no longer "([^"]+)"$/, async (oldStatus: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.status).not.toBe(oldStatus);
  });

  then('homeTeamResult and awayTeamResult are non-null integers', async () => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(Number.isInteger(game.homeTeamResult)).toBe(true);
    expect(Number.isInteger(game.awayTeamResult)).toBe(true);
  });

  then('the game result is unchanged', async () => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.homeTeamResult).toBe(world.preSimulationResult?.homeTeamResult ?? null);
    expect(game.awayTeamResult).toBe(world.preSimulationResult?.awayTeamResult ?? null);
  });

  then(/^all (\d+) games are returned as simulated$/, (count: string) => {
    const world = scenarioWorld;
    expect(getSimulatedGames(world)).toHaveLength(Number(count));
  });

  then('each game has status "COMPLETED" with non-null homeTeamResult and awayTeamResult', () => {
    const world = scenarioWorld;
    const simulated = getSimulatedGames(world);
    simulated.forEach((game) => {
      expect(game.status).toBe('COMPLETED');
      expect(Number.isInteger(game.homeTeamResult)).toBe(true);
      expect(Number.isInteger(game.awayTeamResult)).toBe(true);
    });
  });

  then('both games are returned as simulated with status "COMPLETED"', () => {
    const world = scenarioWorld;
    const simulated = getSimulatedGames(world);
    expect(simulated).toHaveLength(2);
    simulated.forEach((game) => expect(game.status).toBe('COMPLETED'));
  });

  then(/^(\d+) game is returned as simulated with status "([^"]+)"$/, (count: string, status: string) => {
    const world = scenarioWorld;
    const simulated = getSimulatedGames(world).filter((game) => game.status === status);
    expect(simulated).toHaveLength(Number(count));
  });

  then(/^(\d+) game is returned as skipped with reason "([^"]+)"$/, (count: string, reason: string) => {
    const world = scenarioWorld;
    const skipped = getSkippedGames(world).filter((game) => game.reason === reason);
    expect(skipped).toHaveLength(Number(count));
  });

  then(/^the game is returned as skipped with reason "([^"]+)"$/, (reason: string) => {
    const world = scenarioWorld;
    const skipped = getSkippedGames(world).filter((game) => game.reason === reason);
    expect(skipped).toHaveLength(1);
  });

  then(/^both games are returned as skipped with reason "([^"]+)"$/, (reason: string) => {
    const world = scenarioWorld;
    const skipped = getSkippedGames(world).filter((game) => game.reason === reason);
    expect(skipped).toHaveLength(2);
  });

  then('no games appear in the simulated list', () => {
    const world = scenarioWorld;
    expect(getSimulatedGames(world)).toHaveLength(0);
  });

  then('the simulated list is empty', () => {
    const world = scenarioWorld;
    expect(getSimulatedGames(world)).toHaveLength(0);
  });

  then('the skipped list is empty', () => {
    const world = scenarioWorld;
    expect(getSkippedGames(world)).toHaveLength(0);
  });

  then(/^all (\d+) games remain with status "([^"]+)"$/, async (count: string, status: string) => {
    const world = scenarioWorld;
    expect(world.createdGameIds).toHaveLength(Number(count));
    const games = await Promise.all(world.createdGameIds.map((id) => readGame(id)));
    games.forEach((game) => expect(game.status).toBe(status));
  });

  then('no homeTeamResult or awayTeamResult values are written', async () => {
    const world = scenarioWorld;
    const games = await Promise.all(world.createdGameIds.map((id) => readGame(id)));
    games.forEach((game) => {
      expect(game.homeTeamResult).toBeNull();
      expect(game.awayTeamResult).toBeNull();
    });
  });

  then(/^the game result remains homeTeamResult (\d+) and awayTeamResult (\d+)$/, async (home: string, away: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.homeTeamResult).toBe(Number(home));
    expect(game.awayTeamResult).toBe(Number(away));
  });

  then(/^homeTeamResult remains (\d+)$/, async (home: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.homeTeamResult).toBe(Number(home));
  });

  then(/^awayTeamResult remains (\d+)$/, async (away: string) => {
    const world = scenarioWorld;
    const game = await readGame(requireFocusGameId(world));
    expect(game.awayTeamResult).toBe(Number(away));
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
});

autoBindSteps(feature, [registerSteps]);
