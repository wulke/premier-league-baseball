// @spec PCON-006,PCON-008,PCON-009,PCON-010,XFER-021,XFER-024,GWD-002
import db from '../../../src/db/client';
import { PlayerAttributes } from '../../../src/api/models';
import {
  createInitialRosterContracts,
  deleteForGameWorld,
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  SEASON_END_DAY,
  SEASON_END_MONTH,
} from '../../../src/db/domain/contract';

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

const playerIdentity = { givenName: 'Marcus', familyName: 'Jones', countryCode: 'US', bats: 'R', throws: 'R', birthDate: new Date('2025-06-01') };

describe('Contract model schema', () => {
  beforeAll(async () => {
    await db.sync({ force: true });
  });

  // @spec PCON-008,PCON-009
  it('@spec PCON-008 @spec PCON-009 binds one player and one team through Contract associations', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2048 }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Dallas Drillers' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
      ...playerIdentity,
    }).then(({ dataValues }) => dataValues);

    const contract = await db.models.Contract.create({
      playerId: player.id,
      teamId: team.id,
      startDate: new Date(`${gameWorld.year}-03-01T00:00:00.000Z`),
      endDate: new Date(`${gameWorld.year + 2}-10-31T00:00:00.000Z`),
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
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Nashville Notes' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
      ...playerIdentity,
    }).then(({ dataValues }) => dataValues);

    await db.models.Contract.create({
      playerId: player.id,
      teamId: team.id,
      startDate: new Date(`${gameWorld.year - 2}-03-01T00:00:00.000Z`),
      endDate: new Date(`${gameWorld.year - 1}-10-31T00:00:00.000Z`),
    });

    const attributes = db.models.Contract.getAttributes();
    const persistedPlayer = await db.models.Player.findByPk(player.id);

    expect(attributes.playerId.allowNull).toBe(false);
    expect(attributes.teamId.allowNull).toBe(false);
    expect(attributes.startDate.allowNull).toBe(false);
    expect(attributes.endDate.allowNull).toBe(false);
    expect(attributes.startDate.type.constructor.name).toBe('DATE');
    expect(attributes.endDate.type.constructor.name).toBe('DATE');
    expect(attributes.value).toBeUndefined();
    expect(persistedPlayer?.dataValues.teamId).toBe(team.id);
  });

  // @spec PCON-010
  it('@spec PCON-010 exports the roster-size bounds for later roster generation work', () => {
    expect(MIN_ROSTER_SIZE).toBe(20);
    expect(MAX_ROSTER_SIZE).toBe(30);
  });

  // @spec XFER-021,XFER-024,GWD-002
  it('@spec XFER-021 @spec XFER-024 @spec GWD-002 owns initial roster minting and GameWorld cascade deletion', async () => {
    const gameWorld = await db.models.GameWorld.create({ config: {}, year: 2054 }).then(({ dataValues }) => dataValues);
    const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {} }).then(({ dataValues }) => dataValues);
    const team = await db.models.Team.create({
      gameWorldId: gameWorld.id,
      homeLeagueId: league.id,
      config: { name: 'Contract Owners' },
    }).then(({ dataValues }) => dataValues);
    const player = await db.models.Player.create({
      gameWorldId: gameWorld.id,
      teamId: team.id,
      attributes: playerAttributes,
      ...playerIdentity,
    }).then(({ dataValues }) => dataValues);

    await createInitialRosterContracts(team.id, [player.id], gameWorld.year, {}, () => 0);

    await expect(db.models.Contract.findOne({ where: { playerId: player.id } })).resolves.toMatchObject({
      dataValues: {
        teamId: team.id,
        startDate: new Date(Date.UTC(gameWorld.year, 2, 1)),
        endDate: new Date(Date.UTC(gameWorld.year, SEASON_END_MONTH, SEASON_END_DAY)),
      },
    });

    await deleteForGameWorld({ playerIds: [player.id], teamIds: [team.id] });
    await expect(db.models.Contract.count({ where: { playerId: player.id } })).resolves.toBe(0);
  });
});
