// @spec PSTAT-001,PSTAT-002,PSTAT-003,PSTAT-004
import db from '../../../src/db/client';
import { PlayerAttributes } from '../../../src/api/models';

const playerAttributes: PlayerAttributes = {
  contact: 66,
  power: 59,
  armStrength: 74,
  accuracy: 71,
  reaction: 63,
  vision: 68,
  discipline: 64,
  positions: {
    Pitcher: 87,
    Catcher: 18,
    FirstBase: 24,
    SecondBase: 31,
    ThirdBase: 28,
    Shortstop: 35,
    LeftField: 41,
    CenterField: 39,
    RightField: 44,
  },
  pitches: [
    { type: 'Fastball', velocity: 82, control: 76, spin: 70 },
    { type: 'Slider', velocity: 69, control: 63, spin: 80 },
  ],
};
const playerIdentity = { givenName: 'Marcus', familyName: 'Jones', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2028-06-01') };

describe('PlayerGameStats model schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PSTAT-001
  it('@spec PSTAT-001 stores batting and pitching counters on one row for one player-game pair', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2046 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'St. Louis Spirits' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
      ...playerIdentity,
    }).then(({ dataValues }) => dataValues);
    const game = await db.models.Game.create({
      homeTeam: team.id,
      awayTeam: team.id,
      round: 1,
      scheduledDate: new Date('2046-04-01T00:00:00.000Z'),
    }).then(({ dataValues }) => dataValues);

    await db.models.PlayerGameStats.create({
      playerId: player.id,
      gameId: game.id,
      AB: 4,
      H: 2,
      R: 1,
      RBI: 3,
      HR: 1,
      BB: 0,
      SO: 1,
      GS: true,
      IP: 6,
      pitchingH: 5,
      pitchingBB: 2,
      pitchingSO: 7,
      ER: 2,
    });

    const playerWithStats = await db.models.Player.findByPk(player.id, {
      include: [db.models.PlayerGameStats],
    });
    const gameWithStats = await db.models.Game.findByPk(game.id, {
      include: [db.models.PlayerGameStats],
    });

    expect(playerWithStats?.dataValues.PlayerGameStats).toHaveLength(1);
    expect(gameWithStats?.dataValues.PlayerGameStats).toHaveLength(1);
    expect(playerWithStats?.dataValues.PlayerGameStats[0].dataValues).toMatchObject({
      playerId: player.id,
      gameId: game.id,
      AB: 4,
      H: 2,
      R: 1,
      RBI: 3,
      HR: 1,
      BB: 0,
      SO: 1,
      GS: true,
      IP: 6,
      pitchingH: 5,
      pitchingBB: 2,
      pitchingSO: 7,
      ER: 2,
    });
  });

  // @spec PSTAT-002,PSTAT-003,PSTAT-004
  it('@spec PSTAT-002 @spec PSTAT-003 @spec PSTAT-004 exposes only the v1 counting-stat schema', async () => {
    const attributes = db.models.PlayerGameStats.getAttributes();

    expect(attributes.playerId.allowNull).toBe(false);
    expect(attributes.gameId.allowNull).toBe(false);
    expect(attributes.GS.type.constructor.name).toBe('BOOLEAN');

    expect(attributes.G).toBeUndefined();
    expect(attributes.W).toBeUndefined();
    expect(attributes.L).toBeUndefined();
    expect(attributes.AVG).toBeUndefined();
    expect(attributes.OBP).toBeUndefined();
    expect(attributes.SLG).toBeUndefined();
    expect(attributes.ERA).toBeUndefined();
    expect(attributes.WHIP).toBeUndefined();
    expect(attributes.E).toBeUndefined();
    expect(attributes.A).toBeUndefined();
    expect(attributes.PO).toBeUndefined();
    expect(attributes['2B']).toBeUndefined();
    expect(attributes['3B']).toBeUndefined();
    expect(attributes.SB).toBeUndefined();
    expect(attributes.CS).toBeUndefined();
    expect(attributes.HBP).toBeUndefined();
    expect(attributes.OPS).toBeUndefined();
    expect(attributes.SV).toBeUndefined();
    expect(attributes.HLD).toBeUndefined();
    expect(attributes.K9).toBeUndefined();
    expect(attributes.BB9).toBeUndefined();
  });
});
