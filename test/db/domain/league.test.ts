import { GameWorldFactory, LeagueFactory } from '../../../src/db/domain';
import { useDefaultGameWorld } from '../../../src/api/models';
import db from '../../../src/db/client';
import { Op } from 'sequelize';

describe('LeagueFactory (initial Season)', () => {
  let gw;
  beforeAll(async () => {
    gw = await GameWorldFactory().create(useDefaultGameWorld());
  });
  it('create: Creates correct default League configuration', async () => {
    const leagues = (await db.models.League.findAll({
      where: {
        gameWorldId: {
          [Op.eq]: gw.id
        }
      }
    })).map(({ dataValues }) => dataValues);
    leagues.forEach(async (league) => {
      const divisions = (await db.models.Division.findAll({
        where: {
          leagueId: {
            [Op.eq]: league.id
          }
        }
      })).map(({ dataValues }) => dataValues);
      expect(divisions.length).toStrictEqual(league.config.divisions.length);
    });
  });
  it('isSeasonComplete: True when initial season', async () => {
    await gw.leagues.forEach(async ({ id }) => {
      expect(await LeagueFactory(id).isSeasonComplete(gw.year)).toBeTruthy();
    });
    expect(gw.leagues.length).toStrictEqual(gw.config.leagues.length);
  });
});