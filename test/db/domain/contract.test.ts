// @spec PCON-006,PCON-008,PCON-009,PCON-010
import db from '../../../src/db/client';
import { PlayerAttributes } from '../../../src/api/models';
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from '../../../src/db/domain/contract';

const playerAttributes: PlayerAttributes = {
  contact: 62,
  power: 58,
  armStrength: 76,
  accuracy: 69,
  reaction: 64,
  vision: 61,
  discipline: 67,
  positions: {
    Pitcher: 84,
    Catcher: 21,
    FirstBase: 34,
    SecondBase: 29,
    ThirdBase: 31,
    Shortstop: 27,
    LeftField: 36,
    CenterField: 33,
    RightField: 39,
  },
  pitches: [
    { type: 'Fastball', velocity: 81, control: 72, spin: 68 },
    { type: 'Slider', velocity: 70, control: 64, spin: 77 },
  ],
};

describe('Contract model schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PCON-008,PCON-009
  it('@spec PCON-008 @spec PCON-009 binds one player and one team through Contract associations', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2048 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Dallas Drillers' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
    }).then(({ dataValues }) => dataValues);

    const contract = await db.models.Contract.create({
      playerId: player.id,
      teamId: team.id,
      startYear: gameWorld.year,
      endYear: gameWorld.year + 2,
    }).then(({ dataValues }) => dataValues);

    const playerWithContracts = await db.models.Player.findByPk(player.id, {
      include: [db.models.Contract],
    });
    const teamWithContracts = await db.models.Team.findByPk(team.id, {
      include: [db.models.Contract],
    });

    expect(playerWithContracts?.dataValues.Contracts).toHaveLength(1);
    expect(teamWithContracts?.dataValues.Contracts).toHaveLength(1);
    expect(playerWithContracts?.dataValues.Contracts[0].dataValues).toMatchObject(contract);
    expect(teamWithContracts?.dataValues.Contracts[0].dataValues).toMatchObject(contract);
  });

  // @spec PCON-008,PCON-006
  it('@spec PCON-008 @spec PCON-006 exposes only the v1 contract term fields with no expiry side effects', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2051 }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      config: { name: 'Nashville Notes' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
    }).then(({ dataValues }) => dataValues);

    await db.models.Contract.create({
      playerId: player.id,
      teamId: team.id,
      startYear: gameWorld.year - 2,
      endYear: gameWorld.year - 1,
    });

    const attributes = db.models.Contract.getAttributes();
    const persistedPlayer = await db.models.Player.findByPk(player.id);

    expect(attributes.playerId.allowNull).toBe(false);
    expect(attributes.teamId.allowNull).toBe(false);
    expect(attributes.startYear.allowNull).toBe(false);
    expect(attributes.endYear.allowNull).toBe(false);
    expect(attributes.value).toBeUndefined();
    expect(persistedPlayer?.dataValues.teamId).toBe(team.id);
  });

  // @spec PCON-010
  it('@spec PCON-010 exports the roster-size bounds for later roster generation work', () => {
    expect(MIN_ROSTER_SIZE).toBe(20);
    expect(MAX_ROSTER_SIZE).toBe(30);
  });
});
