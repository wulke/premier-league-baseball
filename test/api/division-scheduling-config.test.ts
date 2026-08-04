import db from '../../src/db/client';
import { Endpoints } from '../../src/api/endpoints';
import { router } from '../../src/api/router';

// @spec SCL-017
const invokePatchRoute = async (divisionId: number, schedulingConfig: { startDate: string; intervalDays: number }) => {
  const layer = router.stack.find((route: any) => route.route?.path === Endpoints.UpdateDivisionSchedulingConfig && route.route?.methods?.patch);
  if (!layer) throw Error(`PATCH route '${Endpoints.UpdateDivisionSchedulingConfig}' not found`);

  const res: any = { send: jest.fn(), status: jest.fn().mockReturnThis() };
  await layer.route.stack[0].handle({ params: { divisionId: `${divisionId}` }, body: { schedulingConfig } }, res);
  return res;
};

// @spec SCL-017
const createDivision = async (status: 'CUTOVER' | 'IN_SEASON') => {
  const gameWorld = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
  const league = await db.models.League.create({ gameWorldId: gameWorld.id, config: {}, year: 2027, status }).then(({ dataValues }) => dataValues);
  return await db.models.Division.create({
    leagueId: league.id,
    config: {
      name: 'Config Division', defaultTeams: [1, 2], format: { structure: 'ROUND_ROBIN' },
      schedulingConfig: { startDate: '2027-03-01', intervalDays: 7 },
    },
  }).then(({ dataValues }) => dataValues);
};

describe('Division scheduling configuration API', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec SCL-017
  it('PATCH replaces only schedulingConfig during CUTOVER', async () => {
    const division = await createDivision('CUTOVER');

    const res = await invokePatchRoute(division.id, { startDate: '2028-03-06', intervalDays: 14 });

    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ schedulingConfig: { startDate: '2028-03-06', intervalDays: 14 } }),
    }));
    await expect(db.models.Division.findByPk(division.id)).resolves.toMatchObject({
      dataValues: {
        config: {
          name: 'Config Division', defaultTeams: [1, 2], format: { structure: 'ROUND_ROBIN' },
          schedulingConfig: { startDate: '2028-03-06', intervalDays: 14 },
        },
      },
    });
  });

  // @spec SCL-017
  it('PATCH rejects an IN_SEASON League and preserves the config', async () => {
    const division = await createDivision('IN_SEASON');

    const res = await invokePatchRoute(division.id, { startDate: '2028-03-06', intervalDays: 14 });

    expect(res.status).toHaveBeenCalledWith(422);
    await expect(db.models.Division.findByPk(division.id)).resolves.toMatchObject({
      dataValues: { config: division.config },
    });
  });
});
