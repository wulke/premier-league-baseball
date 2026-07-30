// @spec PATTR-001,PATTR-002,PATTR-003
import { PlayerAttributes } from '../../../src/api/models';
import db from '../../../src/db/client';
import { PlayerFactory, primaryPosition } from '../../../src/db/domain/player';

const nonPitcherAttributes: PlayerAttributes = {
  contact: 71,
  power: 64,
  armStrength: 58,
  accuracy: 62,
  reaction: 77,
  vision: 68,
  discipline: 73,
  positions: {
    Pitcher: 12,
    Catcher: 22,
    FirstBase: 40,
    SecondBase: 55,
    ThirdBase: 64,
    Shortstop: 88,
    LeftField: 61,
    CenterField: 72,
    RightField: 57,
  },
  pitches: [
    { type: 'Fastball', velocity: 43, control: 31, spin: 29 },
    { type: 'Changeup', velocity: 35, control: 28, spin: 24 },
  ],
};

describe('Player model + attribute schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PATTR-001
  it('@spec PATTR-001 derives primary position from the highest-rated positions entry', async () => {
    expect(
      primaryPosition({
        attributes: nonPitcherAttributes,
      })
    ).toBe('Shortstop');
  });

  // @spec PATTR-002,PATTR-003
  it('@spec PATTR-002 @spec PATTR-003 persists uniform pitches for a free-agent player', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2046 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Chicago Whales' }
    }).then(({ dataValues }) => dataValues);

    const player = await PlayerFactory().create(gameWorld.id, nonPitcherAttributes, null);

    await PlayerFactory().create(
      gameWorld.id,
      {
        ...nonPitcherAttributes,
        positions: {
          ...nonPitcherAttributes.positions,
          Pitcher: 91,
        },
      },
      team.id
    );

    const gameWorldWithPlayers = await db.models.GameWorld.findByPk(gameWorld.id, {
      include: [db.models.Player],
    });
    const teamWithPlayers = await db.models.Team.findByPk(team.id, {
      include: [db.models.Player],
    });

    expect(player.teamId).toBeNull();
    expect(player.attributes.pitches).toEqual(nonPitcherAttributes.pitches);
    expect(player.attributes.positions).toEqual(nonPitcherAttributes.positions);
    expect(gameWorldWithPlayers?.dataValues.Players).toHaveLength(2);
    expect(teamWithPlayers?.dataValues.Players).toHaveLength(1);
  });
});
