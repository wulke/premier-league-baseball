import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import { router } from '../../../src/api/router';

interface ResponseState {
  statusCode: number;
  body?: any;
}

interface WorldState {
  response?: ResponseState;
  gameWorldIds: number[];
  gw1?: any;
  gw2?: any;
  countsBeforeMissingDelete?: ReturnType<typeof countScopedRows>;
  injectedError?: Error;
  restoreGameDestroy?: () => void;
}

const TEST_PLAYER_ATTRIBUTES = {
  contact: 50,
  power: 50,
  armStrength: 50,
  accuracy: 50,
  reaction: 50,
  vision: 50,
  discipline: 50,
  positions: {
    Pitcher: 50,
    Catcher: 50,
    FirstBase: 50,
    SecondBase: 50,
    ThirdBase: 50,
    Shortstop: 50,
    LeftField: 50,
    CenterField: 50,
    RightField: 50,
  },
  pitches: [{ type: 'Fastball', velocity: 90, control: 50, spin: 50 }],
};

// @spec GWD-001..GWD-004 (game-world-deletion acceptance)
const feature = loadFeature(path.resolve(__dirname, '../features/game-world-deletion.feature'));
const DELETE_GAME_WORLD_PATH = '/api/gameWorld/:gwId';

const createWorld = (): WorldState => ({
  gameWorldIds: [],
});
let scenarioWorld = createWorld();

const getDeleteRoute = () => {
  const layer = router.stack.find((candidate) =>
    candidate.route?.path === DELETE_GAME_WORLD_PATH && candidate.route?.methods?.delete
  );
  if (!layer) throw new Error('GameWorld delete route handler not found');
  return layer.route.stack[0].handle;
};

const createFixture = async (id: number, { inProgress = false } = {}) => {
  const gameWorld = await db.models.GameWorld.create({
    id,
    year: 2025,
    config: { inProgress },
  }).then(({ dataValues }) => dataValues);

  const league = await db.models.League.create({
    gameWorldId: id,
    config: { name: `League ${id}` },
  }).then(({ dataValues }) => dataValues);
  const division = await db.models.Division.create({
    leagueId: league.id,
    config: { name: `Division ${id}` },
  }).then(({ dataValues }) => dataValues);

  const teams = await Promise.all(['Home', 'Away'].map((name) => db.models.Team.create({
    gameWorldId: id,
    config: { name: `${name} ${id}` },
  }).then(({ dataValues }) => dataValues)));

  const players = await Promise.all(teams.map((team, index) => db.models.Player.create({
    teamId: team.id,
    gameWorldId: id,
    attributes: {
      ...TEST_PLAYER_ATTRIBUTES,
      contact: TEST_PLAYER_ATTRIBUTES.contact + index,
    },
  }).then(({ dataValues }) => dataValues)));

  await db.models.Contract.bulkCreate(players.map((player, index) => ({
    playerId: player.id,
    teamId: teams[index].id,
    startYear: 2025,
    endYear: 2026,
  })));

  const divisionSeasons = await Promise.all(teams.map((team) => db.models.DivisionSeason.create({
    divisionId: division.id,
    teamId: team.id,
    year: 2025,
  }).then(({ dataValues }) => dataValues)));

  const game = await db.models.Game.create({
    homeTeam: teams[0].id,
    awayTeam: teams[1].id,
    scheduledDate: new Date('2025-06-01'),
    status: 'COMPLETED',
    homeTeamResult: 4,
    awayTeamResult: 2,
  }).then(({ dataValues }) => dataValues);

  await db.models.DivisionSeasonGame.bulkCreate(
    divisionSeasons.map((divisionSeason) => ({ divisionSeasonId: divisionSeason.id, gameId: game.id }))
  );

  await db.models.PlayerGameStats.bulkCreate(players.map((player) => ({
    playerId: player.id,
    gameId: game.id,
  })));

  const seasonResult = await db.models.SeasonResult.create({
    divisionId: division.id,
    year: 2025,
    championTeamId: teams[0].id,
  }).then(({ dataValues }) => dataValues);

  return { gameWorld, league, division, teams, players, divisionSeasons, game, seasonResult };
};

const deleteGameWorld = async (world: WorldState, id: number) => {
  const handler = getDeleteRoute();
  const req: any = { params: { gwId: `${id}` } };
  const res: any = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.send = jest.fn().mockImplementation((body: any) => {
    world.response = { statusCode: res.statusCode ?? 200, body };
    return res;
  });

  await handler(req, res);
};

const countScopedRows = async (gameWorldId: number) => {
  const leagues = await db.models.League.findAll({ where: { gameWorldId } });
  const leagueIds = leagues.map(({ dataValues }) => dataValues.id);
  const teams = await db.models.Team.findAll({ where: { gameWorldId } });
  const teamIds = teams.map(({ dataValues }) => dataValues.id);
  const players = await db.models.Player.findAll({ where: { gameWorldId } });
  const playerIds = players.map(({ dataValues }) => dataValues.id);
  const divisions = leagueIds.length === 0 ? [] : await db.models.Division.findAll({ where: { leagueId: leagueIds } });
  const divisionIds = divisions.map(({ dataValues }) => dataValues.id);

  return {
    gameWorlds: await db.models.GameWorld.count({ where: { id: gameWorldId } }),
    leagues: leagueIds.length,
    teams: teamIds.length,
    players: playerIds.length,
    divisions: divisionIds.length,
  };
};

const getErrorText = (world: WorldState) => {
  const body = world.response?.body;
  if (body && typeof body.error === 'string') return body.error;
  return '';
};

const registerSteps = ({ given, when, then, and }: any) => {
  given(/^a GameWorld exists with id (\d+) and year (\d+)$/, async (gwId: string) => {
    const world = scenarioWorld;
    world.gw1 = await createFixture(Number(gwId));
    world.gameWorldIds.push(world.gw1.gameWorld.id);
  });

  given(/^a League, Division, and DivisionSeason exist in GameWorld (\d+)$/, async () => {
    expect(scenarioWorld.gw1?.divisionSeasons).toHaveLength(2);
  });

  given(/^a home team and away team exist in GameWorld (\d+), each with a roster of Players$/, async () => {
    expect(scenarioWorld.gw1?.teams).toHaveLength(2);
    expect(scenarioWorld.gw1?.players).toHaveLength(2);
  });

  given(/^each Team has a Contract for each of its Players$/, async () => {
    await expect(db.models.Contract.count()).resolves.toBe(2);
  });

  given(/^a Game exists in GameWorld (\d+)'s DivisionSeason with PlayerGameStats recorded$/, async () => {
    await expect(db.models.PlayerGameStats.count({ where: { gameId: scenarioWorld.gw1.game.id } })).resolves.toBe(2);
  });

  given(/^a SeasonResult exists for GameWorld (\d+)'s Division$/, async () => {
    await expect(db.models.SeasonResult.count({ where: { divisionId: scenarioWorld.gw1.division.id } })).resolves.toBe(1);
  });

  given(/^a second GameWorld exists with id (\d+) and its own League, Division, and DivisionSeason$/, async (gwId: string) => {
    const world = scenarioWorld;
    world.gw2 = await createFixture(Number(gwId));
    world.gameWorldIds.push(world.gw2.gameWorld.id);
  });

  given(/^GameWorld 1's Game is also linked to GameWorld 2's DivisionSeason$/, async () => {
    await db.models.DivisionSeasonGame.create({
      divisionSeasonId: scenarioWorld.gw2.divisionSeasons[0].id,
      gameId: scenarioWorld.gw1.game.id,
    });
  });

  given(/^GameWorld 2's Players also have PlayerGameStats on GameWorld 1's Game$/, async () => {
    await db.models.PlayerGameStats.bulkCreate(scenarioWorld.gw2.players.map((player: any) => ({
      playerId: player.id,
      gameId: scenarioWorld.gw1.game.id,
    })));
  });

  given(/^GameWorld 1's config.inProgress is true$/, async () => {
    await db.models.GameWorld.update(
      { config: { inProgress: true } },
      { where: { id: scenarioWorld.gw1.gameWorld.id } }
    );
  });

  given(/^a database error will occur mid-transaction$/, () => {
    const originalGameDestroy = db.models.Game.destroy;
    const injectedError = new Error('forced game delete failure');
    db.models.Game.destroy = jest.fn().mockRejectedValueOnce(injectedError) as typeof originalGameDestroy;
    scenarioWorld.injectedError = injectedError;
    scenarioWorld.restoreGameDestroy = () => {
      db.models.Game.destroy = originalGameDestroy;
    };
  });

  when(/^the player deletes GameWorld (\d+)$/, async (gwId: string) => {
    if (Number(gwId) === 9999 && scenarioWorld.gw1) {
      scenarioWorld.countsBeforeMissingDelete = countScopedRows(scenarioWorld.gw1.gameWorld.id);
    }
    await deleteGameWorld(scenarioWorld, Number(gwId));
  });

  then(/^the response is 200 with id (\d+)$/, (gwId: string) => {
    expect(scenarioWorld.response).toEqual({ statusCode: 200, body: { id: Number(gwId) } });
  });

  then(/^GameWorld (\d+) no longer exists$/, async (gwId: string) => {
    await expect(db.models.GameWorld.findByPk(Number(gwId))).resolves.toBeNull();
  });

  then(/^GameWorld (\d+)'s Leagues, Teams, Players, Divisions, and DivisionSeasons no longer exist$/, async () => {
    await expect(db.models.League.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Team.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Player.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Division.count({ where: { leagueId: scenarioWorld.gw1.league.id } })).resolves.toBe(0);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: scenarioWorld.gw1.division.id } })).resolves.toBe(0);
  });

  then(/^GameWorld (\d+)'s Contracts and PlayerGameStats no longer exist$/, async () => {
    await expect(db.models.Contract.count({ where: { playerId: scenarioWorld.gw1.players.map(({ id }) => id) } })).resolves.toBe(0);
    await expect(db.models.PlayerGameStats.count({ where: { playerId: scenarioWorld.gw1.players.map(({ id }) => id) } })).resolves.toBe(0);
  });

  then(/^GameWorld (\d+)'s SeasonResult no longer exists$/, async () => {
    await expect(db.models.SeasonResult.count({ where: { divisionId: scenarioWorld.gw1.division.id } })).resolves.toBe(0);
  });

  then(/^GameWorld (\d+)'s Game no longer exists$/, async () => {
    await expect(db.models.Game.findByPk(scenarioWorld.gw1.game.id)).resolves.toBeNull();
  });

  then(/^GameWorld (\d+)'s Game still exists$/, async () => {
    await expect(db.models.Game.findByPk(scenarioWorld.gw1.game.id)).resolves.not.toBeNull();
  });

  then(/^GameWorld (\d+)'s DivisionSeason is still linked to that Game$/, async () => {
    await expect(db.models.DivisionSeasonGame.count({
      where: {
        divisionSeasonId: scenarioWorld.gw2.divisionSeasons[0].id,
        gameId: scenarioWorld.gw1.game.id,
      },
    })).resolves.toBe(1);
  });

  then(/^GameWorld 2's PlayerGameStats on GameWorld 1's Game still exist$/, async () => {
    await expect(db.models.PlayerGameStats.count({
      where: {
        playerId: scenarioWorld.gw2.players.map(({ id }: any) => id),
        gameId: scenarioWorld.gw1.game.id,
      },
    })).resolves.toBe(2);
  });

  then(/^the response is a 404 error$/, () => {
    expect(scenarioWorld.response?.statusCode).toBe(404);
  });

  then(/^the error indicates the GameWorld was not found$/, () => {
    expect(getErrorText(scenarioWorld)).toEqual(expect.stringContaining('No gameworld exists with id'));
  });

  then(/^no GameWorld, League, Team, or Player rows are modified$/, async () => {
    const counts = await countScopedRows(scenarioWorld.gw1.gameWorld.id);
    await expect(scenarioWorld.countsBeforeMissingDelete).resolves.toEqual(counts);
  });

  then(/^the response is a 500 error$/, () => {
    expect(scenarioWorld.response?.statusCode).toBe(500);
    expect(scenarioWorld.response?.body).toEqual({
      error: scenarioWorld.injectedError?.message,
    });
  });

  then(/^GameWorld (\d+) still exists$/, async (gwId: string) => {
    await expect(db.models.GameWorld.findByPk(Number(gwId))).resolves.not.toBeNull();
  });

  then(/^GameWorld (\d+)'s Leagues, Teams, Players, Divisions, and DivisionSeasons still exist$/, async () => {
    await expect(db.models.League.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(1);
    await expect(db.models.Team.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(2);
    await expect(db.models.Player.count({ where: { gameWorldId: scenarioWorld.gw1.gameWorld.id } })).resolves.toBe(2);
    await expect(db.models.Division.count({ where: { leagueId: scenarioWorld.gw1.league.id } })).resolves.toBe(1);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: scenarioWorld.gw1.division.id } })).resolves.toBe(2);
  });

  then(/^GameWorld (\d+)'s Contracts, PlayerGameStats, SeasonResult, and Game still exist$/, async () => {
    await expect(db.models.Contract.count({ where: { playerId: scenarioWorld.gw1.players.map(({ id }) => id) } })).resolves.toBe(2);
    await expect(db.models.PlayerGameStats.count({ where: { gameId: scenarioWorld.gw1.game.id } })).resolves.toBe(2);
    await expect(db.models.SeasonResult.count({ where: { divisionId: scenarioWorld.gw1.division.id } })).resolves.toBe(1);
    await expect(db.models.Game.findByPk(scenarioWorld.gw1.game.id)).resolves.not.toBeNull();
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = createWorld();
});

afterEach(() => {
  scenarioWorld.restoreGameDestroy?.();
});

autoBindSteps(feature, [registerSteps]);
