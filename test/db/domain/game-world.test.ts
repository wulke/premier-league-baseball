import db from '../../../src/db/client';
import { GameWorldFactory } from '../../../src/db/domain';
import { useDefaultGameWorld } from '../../../src/api/models';
import { Op } from 'sequelize';

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

const createDeletionFixture = async (id = 1, { inProgress = false } = {}) => {
  const gameWorld = await db.models.GameWorld.create({
    id,
    year: 2025,
    config: { inProgress },
  }).then(({ dataValues }) => dataValues);

  const league = await db.models.League.create({
    gameWorldId: gameWorld.id,
    config: { name: `League ${id}` },
  }).then(({ dataValues }) => dataValues);
  const division = await db.models.Division.create({
    leagueId: league.id,
    config: { name: `Division ${id}` },
  }).then(({ dataValues }) => dataValues);

  const teams = await Promise.all(['Home', 'Away'].map((name) => db.models.Team.create({
    gameWorldId: gameWorld.id,
    config: { name: `${name} ${id}` },
  }).then(({ dataValues }) => dataValues)));

  const players = await Promise.all(teams.map((team, index) => db.models.Player.create({
    teamId: team.id,
    gameWorldId: gameWorld.id,
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

describe('GameWorldFactory', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  beforeEach(async () => {
    await db.sync({ force: true });
  });

  it('Creates a new game world', async () => {
    const config = useDefaultGameWorld();
    const gw = await GameWorldFactory().create(config);
    const actual = await db.models.GameWorld.findByPk(gw.id);
    expect(actual).not.toBeNull();
    expect(actual?.dataValues.year).toStrictEqual(new Date().getFullYear() - 1);
    const leagues = (await db.models.League.findAll({
      where: {
        gameWorldId: {
          [Op.eq]: gw.id
        }
      }
    })).map(({ dataValues }) => dataValues);
    const teams = await db.models.Team.findAll({
      where: {
        gameWorldId: {
          [Op.eq]: gw.id
        }
      }
    });
    expect(leagues.length).toStrictEqual(config.leagues?.length);
    expect(teams.length).toStrictEqual(config.teams?.length);
  });
  it('newSeason: initial season', async () => {
    const gw = await GameWorldFactory().create(useDefaultGameWorld());
    await GameWorldFactory(gw.id).newSeason();
    const actual = await db.models.GameWorld.findByPk(gw.id);
    expect(actual).not.toBeNull();
    expect(actual?.dataValues.year).toStrictEqual(gw.year+1);
    // check that each league + divisions have a DivisionSeason with the default teams
    const teams = await db.models.Team.findAll({ where: { gameWorldId: { [Op.eq]: gw.id }}});
    const leagues = await db.models.League.findAll({ where: { gameWorldId: { [Op.eq]: gw.id }}});
    // todo write the tests...
  }, 15000);

  // @spec SCL-008
  it('newSeason: derives inProgress from League statuses instead of setting it true', async () => {
    const gw = await GameWorldFactory().create(useDefaultGameWorld());

    await GameWorldFactory(gw.id).newSeason();

    await expect(db.models.GameWorld.findByPk(gw.id)).resolves.toMatchObject({
      dataValues: { config: { inProgress: false } },
    });
  }, 15000);

  // @spec GWS-001
  it('newSeason: rethrows errors from failed rollover work', async () => {
    const gw = await GameWorldFactory().create(useDefaultGameWorld());
    const originalIncrement = db.models.GameWorld.increment;
    const rolloverError = new Error('forced season rollover failure');

    db.models.GameWorld.increment = jest.fn().mockRejectedValueOnce(rolloverError) as typeof originalIncrement;
    try {
      await expect(GameWorldFactory(gw.id).newSeason()).rejects.toThrow(rolloverError.message);
    } finally {
      db.models.GameWorld.increment = originalIncrement;
    }
  });

  // @spec GWD-001 @spec GWD-002
  it('@spec GWD-001 @spec GWD-002 hard-deletes a GameWorld cascade while preserving a shared Game row', async () => {
    const gw1 = await createDeletionFixture(1);
    const gw2 = await createDeletionFixture(2);

    await db.models.DivisionSeasonGame.create({
      divisionSeasonId: gw2.divisionSeasons[0].id,
      gameId: gw1.game.id,
    });
    await db.models.PlayerGameStats.bulkCreate(gw2.players.map((player) => ({
      playerId: player.id,
      gameId: gw1.game.id,
    })));

    await expect((GameWorldFactory(gw1.gameWorld.id) as any).delete()).resolves.toEqual({ id: gw1.gameWorld.id });

    await expect(db.models.GameWorld.findByPk(gw1.gameWorld.id)).resolves.toBeNull();
    await expect(db.models.League.count({ where: { gameWorldId: gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Team.count({ where: { gameWorldId: gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Player.count({ where: { gameWorldId: gw1.gameWorld.id } })).resolves.toBe(0);
    await expect(db.models.Division.count({ where: { leagueId: gw1.league.id } })).resolves.toBe(0);
    await expect(db.models.DivisionSeason.count({ where: { divisionId: gw1.division.id } })).resolves.toBe(0);
    await expect(db.models.Contract.count({ where: { playerId: gw1.players.map(({ id }) => id) } })).resolves.toBe(0);
    await expect(db.models.PlayerGameStats.count({ where: { playerId: gw1.players.map(({ id }) => id) } })).resolves.toBe(0);
    await expect(db.models.SeasonResult.count({ where: { divisionId: gw1.division.id } })).resolves.toBe(0);

    const sharedGame = await db.models.Game.findByPk(gw1.game.id);
    expect(sharedGame).not.toBeNull();
    await expect(db.models.PlayerGameStats.count({ where: { playerId: gw2.players.map(({ id }) => id), gameId: gw1.game.id } })).resolves.toBe(2);
    await expect(db.models.DivisionSeasonGame.count({
      where: { divisionSeasonId: gw2.divisionSeasons[0].id, gameId: gw1.game.id },
    })).resolves.toBe(1);
  });

  // @spec GWD-001
  it('@spec GWD-001 rejects a missing GameWorld with statusCode 404 before touching rows', async () => {
    const existing = await createDeletionFixture(1);
    const rowCountsBefore = await Promise.all([
      db.models.GameWorld.count(),
      db.models.League.count(),
      db.models.Team.count(),
      db.models.Player.count(),
    ]);

    await expect((GameWorldFactory(9999) as any).delete()).rejects.toMatchObject({
      message: expect.stringContaining("No gameworld exists with id='9999'"),
      statusCode: 404,
    });

    const rowCountsAfter = await Promise.all([
      db.models.GameWorld.count(),
      db.models.League.count(),
      db.models.Team.count(),
      db.models.Player.count(),
    ]);
    expect(rowCountsAfter).toEqual(rowCountsBefore);
    await expect(db.models.GameWorld.findByPk(existing.gameWorld.id)).resolves.not.toBeNull();
  });

  // @spec GWD-003
  it('@spec GWD-003 rolls back the entire cascade when a mid-transaction delete fails', async () => {
    const fixture = await createDeletionFixture(1);
    const originalGameDestroy = db.models.Game.destroy;
    const injectedError = new Error('forced game delete failure');

    db.models.Game.destroy = jest.fn().mockRejectedValueOnce(injectedError) as typeof originalGameDestroy;
    try {
      await expect((GameWorldFactory(fixture.gameWorld.id) as any).delete()).rejects.toThrow(injectedError.message);
    } finally {
      db.models.Game.destroy = originalGameDestroy;
    }

    await expect(db.models.GameWorld.findByPk(fixture.gameWorld.id)).resolves.not.toBeNull();
    await expect(db.models.League.count({ where: { gameWorldId: fixture.gameWorld.id } })).resolves.toBe(1);
    await expect(db.models.Team.count({ where: { gameWorldId: fixture.gameWorld.id } })).resolves.toBe(2);
    await expect(db.models.Player.count({ where: { gameWorldId: fixture.gameWorld.id } })).resolves.toBe(2);
    await expect(db.models.DivisionSeasonGame.count({ where: { gameId: fixture.game.id } })).resolves.toBe(2);
    await expect(db.models.Game.findByPk(fixture.game.id)).resolves.not.toBeNull();
    await expect(db.models.SeasonResult.findByPk(fixture.seasonResult.id)).resolves.not.toBeNull();
  });

  // @spec GWD-004
  it('@spec GWD-004 deletes an in-progress GameWorld without additional restriction', async () => {
    const fixture = await createDeletionFixture(1, { inProgress: true });

    await expect((GameWorldFactory(fixture.gameWorld.id) as any).delete()).resolves.toEqual({ id: fixture.gameWorld.id });
    await expect(db.models.GameWorld.findByPk(fixture.gameWorld.id)).resolves.toBeNull();
  });
});

describe('GameWorldFactory.advanceCurrentDate', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  beforeEach(async () => {
    await db.sync({ force: true });
  });

  it('throws when called without an id (mirrors the newSeason guard)', async () => {
    await expect((GameWorldFactory() as any).advanceCurrentDate('2025-04-08'))
      .rejects.toThrow('no game world to advance');
  });

  // @spec RSS-001
  it('@spec RSS-001 rejects with statusCode 404 when the GameWorld does not exist', async () => {
    await expect((GameWorldFactory(9999) as any).advanceCurrentDate('2025-04-08'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  // @spec RSS-008
  it('@spec RSS-008 rejects a non-forward date with 422 and leaves currentDate unchanged', async () => {
    const gw = await db.models.GameWorld.create({
      year: 2025,
      currentDate: '2025-04-08',
      config: {},
    }).then(({ dataValues }) => dataValues);

    await expect((GameWorldFactory(gw.id) as any).advanceCurrentDate('2025-04-01'))
      .rejects.toMatchObject({ statusCode: 422 });

    const after = await db.models.GameWorld.findByPk(gw.id);
    expect(after?.dataValues.currentDate).toBe('2025-04-08');
  });

  it('advances currentDate to a strictly-later date and returns the new value', async () => {
    const gw = await db.models.GameWorld.create({
      year: 2025,
      currentDate: '2025-04-01',
      config: {},
    }).then(({ dataValues }) => dataValues);

    await expect((GameWorldFactory(gw.id) as any).advanceCurrentDate('2025-04-08'))
      .resolves.toEqual({ id: gw.id, currentDate: '2025-04-08' });

    const after = await db.models.GameWorld.findByPk(gw.id);
    expect(after?.dataValues.currentDate).toBe('2025-04-08');
  });
});
