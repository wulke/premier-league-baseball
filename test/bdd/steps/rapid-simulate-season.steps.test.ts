// @spec RSS-001,RSS-002,RSS-003,RSS-004,RSS-005,RSS-006,RSS-007,RSS-008
// (rapid-simulate-season acceptance — backend loop + endpoint)
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import { rapidSimulateSeason as rapidSimulateSeasonHandler } from '../../../src/api/handlers';
import { GameWorldFactory } from '../../../src/db/domain';
import { DomainError } from '../../../src/db/domain/errors';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/rapid-simulate-season.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface GameRecord {
  id: number;
  scheduledDate: string | null;
  initialStatus: string;
}

interface WorldState {
  gameWorldId?: number;
  homeTeamId?: number;
  awayTeamId?: number;
  leagueId?: number;
  divisionId?: number;
  divisionSeasonIds: number[];
  games: GameRecord[];
  response?: ResponseState;
}

const createWorld = (): WorldState => ({
  divisionSeasonIds: [],
  games: [],
});
let scenarioWorld = createWorld();

let originalDevTools: string | undefined;

const readGameStatus = async (id: number): Promise<string> => {
  const game = await db.models.Game.findByPk(id);
  if (!game) throw new Error(`Game '${id}' not found`);
  return game.dataValues.status;
};

const readGameWorld = async (id: number) => {
  const gw = await db.models.GameWorld.findByPk(id);
  if (!gw) throw new Error(`GameWorld '${id}' not found`);
  return gw.dataValues;
};

const findGamesByDate = (world: WorldState, dateStr: string): GameRecord[] =>
  world.games.filter((g) => g.scheduledDate === dateStr);

const findUnscheduledGame = (world: WorldState): GameRecord | undefined =>
  world.games.find((g) => g.scheduledDate === null);

const findAlreadyCompletedGame = (world: WorldState): GameRecord | undefined =>
  world.games.find((g) => g.initialStatus === 'COMPLETED');

const captureError = (world: WorldState, error: unknown) => {
  if (error instanceof DomainError) {
    world.response = { statusCode: error.statusCode, error };
  } else {
    const statusCode = (error as any)?.statusCode ?? 500;
    world.response = { statusCode, error };
  }
};

const callRapidSimulate = async (world: WorldState, gwId: number) => {
  try {
    const body = await rapidSimulateSeasonHandler(gwId);
    world.response = { statusCode: 200, body };
  } catch (error) {
    captureError(world, error);
  }
};

const callAdvanceCurrentDate = async (world: WorldState, gwId: number, date: string) => {
  try {
    const body = await GameWorldFactory(gwId).advanceCurrentDate(date);
    world.response = { statusCode: 200, body };
  } catch (error) {
    captureError(world, error);
  }
};

const createGame = async (world: WorldState, status: string, scheduledDate: string | null) => {
  const homeTeam = world.homeTeamId ?? 1;
  const awayTeam = world.awayTeamId ?? 2;
  const game = await db.models.Game.create({
    homeTeam,
    awayTeam,
    status,
    ...(scheduledDate ? { scheduledDate: new Date(scheduledDate) } : {}),
    ...(status === 'COMPLETED' ? { homeTeamResult: 1, awayTeamResult: 0 } : {}),
  }).then(({ dataValues }) => dataValues);

  if (world.divisionSeasonIds.length > 0) {
    await db.models.DivisionSeasonGame.bulkCreate(
      world.divisionSeasonIds.map((divisionSeasonId) => ({ gameId: game.id, divisionSeasonId }))
    );
  }

  world.games.push({ id: game.id, scheduledDate, initialStatus: status });
  return game;
};

const getErrorText = (world: WorldState): string => {
  const error = world.response?.error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^a GameWorld exists with id (\d+), year (\d+), config.inProgress true, and currentDate "([^"]+)"$/, async (gwId: string, year: string, currentDate: string) => {
    const world = scenarioWorld;
    const id = Number(gwId);
    world.gameWorldId = id;
    await db.models.GameWorld.create({
      id,
      year: Number(year),
      currentDate,
      config: { inProgress: true },
    });
  });

  // DivisionSeason.teamId is NOT NULL, so the participating teams must exist here too;
  // the follow-on "home team and away team" step is idempotent over this setup.
  given(/^a League, Division, and DivisionSeason exist in GameWorld (\d+)$/, async (gwId: string) => {
    const world = scenarioWorld;
    const gameWorldId = Number(gwId);
    const league = await db.models.League.create({ gameWorldId, config: { name: 'BDD League' } }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({ leagueId: league.id, config: { name: 'BDD Division' } }).then(({ dataValues }) => dataValues);

    const homeTeam = await db.models.Team.create({ gameWorldId, config: { name: 'Home' } }).then(({ dataValues }) => dataValues);
    const awayTeam = await db.models.Team.create({ gameWorldId, config: { name: 'Away' } }).then(({ dataValues }) => dataValues);
    const dsHome = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: homeTeam.id, year: 2025 }).then(({ dataValues }) => dataValues);
    const dsAway = await db.models.DivisionSeason.create({ divisionId: division.id, teamId: awayTeam.id, year: 2025 }).then(({ dataValues }) => dataValues);

    world.leagueId = league.id;
    world.divisionId = division.id;
    world.homeTeamId = homeTeam.id;
    world.awayTeamId = awayTeam.id;
    world.divisionSeasonIds = [dsHome.id, dsAway.id];
  });

  given(/^a home team and away team exist in GameWorld (\d+)$/, async () => {
    expect(scenarioWorld.homeTeamId).toBeDefined();
    expect(scenarioWorld.awayTeamId).toBeDefined();
  });

  given(/^GameWorld (\d+)'s config.inProgress is false$/, async (gwId: string) => {
    const id = Number(gwId);
    const gw = await readGameWorld(id);
    await db.models.GameWorld.update(
      { config: { ...gw.config, inProgress: false } },
      { where: { id } }
    );
  });

  given(/^GameWorld (\d+)'s currentDate is not set$/, async (gwId: string) => {
    await db.models.GameWorld.update({ currentDate: null }, { where: { id: Number(gwId) } });
  });

  given(/^GameWorld (\d+)'s currentDate is "([^"]+)"$/, async (gwId: string, currentDate: string) => {
    await db.models.GameWorld.update({ currentDate }, { where: { id: Number(gwId) } });
  });

  given(/^GameWorld (\d+)'s DivisionSeason has Games scheduled on "([^"]+)", "([^"]+)", and "([^"]+)"$/, async (_gwId: string, d1: string, d2: string, d3: string) => {
    for (const scheduledDate of [d1, d2, d3]) {
      await createGame(scenarioWorld, 'SCHEDULED', scheduledDate);
    }
  });

  given(/^GameWorld (\d+)'s DivisionSeason has a Game scheduled on "([^"]+)"$/, async (_gwId: string, scheduledDate: string) => {
    await createGame(scenarioWorld, 'SCHEDULED', scheduledDate);
  });

  given(/^GameWorld (\d+)'s DivisionSeason has a single Game scheduled on "([^"]+)"$/, async (_gwId: string, scheduledDate: string) => {
    await createGame(scenarioWorld, 'SCHEDULED', scheduledDate);
  });

  given(/^GameWorld (\d+)'s DivisionSeason has a Game with no scheduledDate$/, async () => {
    await createGame(scenarioWorld, 'SCHEDULED', null);
  });

  given(/^GameWorld (\d+)'s DivisionSeason has a COMPLETED Game scheduled on "([^"]+)"$/, async (_gwId: string, scheduledDate: string) => {
    await createGame(scenarioWorld, 'COMPLETED', scheduledDate);
  });

  given(/^GameWorld (\d+)'s DivisionSeason has an IN_PROGRESS Game scheduled on "([^"]+)"$/, async (_gwId: string, scheduledDate: string) => {
    await createGame(scenarioWorld, 'IN_PROGRESS', scheduledDate);
  });

  given(/^ENABLE_DEV_TOOLS is not set to "true"$/, () => {
    delete process.env.ENABLE_DEV_TOOLS;
  });

  when(/^an admin rapid-simulates GameWorld (\d+)$/, async (gwId: string) => {
    await callRapidSimulate(scenarioWorld, Number(gwId));
  });

  when(/^an admin advances GameWorld (\d+)'s currentDate to "([^"]+)"$/, async (gwId: string, date: string) => {
    await callAdvanceCurrentDate(scenarioWorld, Number(gwId), date);
  });

  then('the response is 200', () => {
    expect(scenarioWorld.response?.statusCode).toBe(200);
  });

  then('the response is a 404 error', () => {
    expect(scenarioWorld.response?.statusCode).toBe(404);
  });

  then('the response is a 422 error', () => {
    expect(scenarioWorld.response?.statusCode).toBe(422);
  });

  then('the error indicates the GameWorld was not found', () => {
    expect(getErrorText(scenarioWorld)).toEqual(expect.stringContaining('No gameworld exists with id'));
  });

  then(/^the error identifies "([^"]+)" as the blocking date$/, (dateStr: string) => {
    expect(getErrorText(scenarioWorld)).toEqual(expect.stringContaining(dateStr));
  });

  then(/^no Game in GameWorld (\d+) is simulated$/, async () => {
    expect(scenarioWorld.games.length).toBeGreaterThan(0);
    for (const game of scenarioWorld.games) {
      expect(await readGameStatus(game.id)).not.toBe('COMPLETED');
    }
  });

  then(/^every Game in GameWorld (\d+)'s DivisionSeason is COMPLETED$/, async () => {
    expect(scenarioWorld.games.length).toBeGreaterThan(0);
    for (const game of scenarioWorld.games) {
      expect(await readGameStatus(game.id)).toBe('COMPLETED');
    }
  });

  then(/^GameWorld (\d+)'s currentDate is "([^"]+)"$/, async (gwId: string, currentDate: string) => {
    const gw = await readGameWorld(Number(gwId));
    expect(gw.currentDate).toBe(currentDate);
  });

  then(/^GameWorld (\d+)'s currentDate is still "([^"]+)"$/, async (gwId: string, currentDate: string) => {
    const gw = await readGameWorld(Number(gwId));
    expect(gw.currentDate).toBe(currentDate);
  });

  then(/^GameWorld (\d+)'s year is still (\d+)$/, async (gwId: string, year: string) => {
    const gw = await readGameWorld(Number(gwId));
    expect(gw.year).toBe(Number(year));
  });

  then(/^GameWorld (\d+)'s config.inProgress is still true$/, async (gwId: string) => {
    const gw = await readGameWorld(Number(gwId));
    expect(gw.config?.inProgress).toBe(true);
  });

  then(/^the response reports daysAdvanced (\d+)$/, (count: string) => {
    const body: any = scenarioWorld.response?.body;
    expect(body?.daysAdvanced).toBe(Number(count));
  });

  then(/^the response's simulated list includes all (\d+) games$/, (count: string) => {
    const body: any = scenarioWorld.response?.body;
    expect(Array.isArray(body?.simulated)).toBe(true);
    expect(body.simulated).toHaveLength(Number(count));
  });

  then(/^the response's skipped list includes the already-completed game$/, () => {
    const body: any = scenarioWorld.response?.body;
    const completed = findAlreadyCompletedGame(scenarioWorld);
    expect(completed).toBeDefined();
    expect(Array.isArray(body?.skipped)).toBe(true);
    expect(body.skipped.some((s: any) => s?.game?.id === completed!.id)).toBe(true);
  });

  then(/^the response's simulated list does not include the already-completed game$/, () => {
    const body: any = scenarioWorld.response?.body;
    const completed = findAlreadyCompletedGame(scenarioWorld);
    expect(completed).toBeDefined();
    expect(Array.isArray(body?.simulated)).toBe(true);
    expect(body.simulated.some((s: any) => s?.id === completed!.id)).toBe(false);
  });

  then(/^the Game with no scheduledDate is COMPLETED$/, async () => {
    const game = findUnscheduledGame(scenarioWorld);
    expect(game).toBeDefined();
    expect(await readGameStatus(game!.id)).toBe('COMPLETED');
  });

  then(/^the Game scheduled on "([^"]+)" is COMPLETED$/, async (dateStr: string) => {
    const games = findGamesByDate(scenarioWorld, dateStr);
    expect(games.length).toBeGreaterThan(0);
    for (const game of games) {
      expect(await readGameStatus(game.id)).toBe('COMPLETED');
    }
  });

  then(/^the Game scheduled on "([^"]+)" is still SCHEDULED$/, async (dateStr: string) => {
    const games = findGamesByDate(scenarioWorld, dateStr);
    expect(games.length).toBeGreaterThan(0);
    for (const game of games) {
      expect(await readGameStatus(game.id)).toBe('SCHEDULED');
    }
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
  originalDevTools = process.env.ENABLE_DEV_TOOLS;
  process.env.ENABLE_DEV_TOOLS = 'true';
});

afterEach(() => {
  if (originalDevTools === undefined) {
    delete process.env.ENABLE_DEV_TOOLS;
  } else {
    process.env.ENABLE_DEV_TOOLS = originalDevTools;
  }
});

autoBindSteps(feature, [registerSteps]);
