// @spec PATTR-001,PATTR-002,PATTR-003
import db from '../../../src/db/client';

const nonPitcherAttributes = {
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { primaryPosition } = require('../../../src/db/domain/player');

    expect(
      primaryPosition({
        attributes: nonPitcherAttributes,
      })
    ).toBe('Shortstop');
  });

  // @spec PATTR-002,PATTR-003
  it('@spec PATTR-002 @spec PATTR-003 persists uniform pitches for a free-agent player', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2046 }).then(({ dataValues }) => dataValues);

    const player = await db.models.Player.create({
      teamId: null,
      gameWorldId: gameWorld.id,
      attributes: nonPitcherAttributes,
    }).then(({ dataValues }) => dataValues);

    expect(player.teamId).toBeNull();
    expect(player.attributes.pitches).toEqual(nonPitcherAttributes.pitches);
    expect(player.attributes.positions).toEqual(nonPitcherAttributes.positions);
  });
});
