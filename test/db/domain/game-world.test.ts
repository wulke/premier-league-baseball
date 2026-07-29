import db from '../../../src/db/client';
import { GameWorldFactory } from '../../../src/db/domain';
import { useDefaultGameWorld } from '../../../src/api/models';
import { Op } from 'sequelize';

describe('GameWorldFactory', () => {
  beforeAll(async () => {
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
  });

  // @spec GWS-001
  it('newSeason: rethrows errors from failed rollover work', async () => {
    const gw = await GameWorldFactory().create(useDefaultGameWorld());
    const originalIncrement = db.models.GameWorld.increment;
    const rolloverError = new Error('forced season rollover failure');

    db.models.GameWorld.increment = jest.fn().mockRejectedValueOnce(rolloverError) as typeof originalIncrement;

    await expect(GameWorldFactory(gw.id).newSeason()).rejects.toThrow(rolloverError.message);

    db.models.GameWorld.increment = originalIncrement;
  });
});
