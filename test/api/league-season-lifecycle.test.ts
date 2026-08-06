import db from '../../src/db/client';
import { LeagueFactory } from '../../src/db/domain';
import { Endpoints } from '../../src/api/endpoints';
import { LeagueType } from '../../src/api/models';
import { router } from '../../src/api/router';

// @spec SCL-015,SCL-016
const invokePostRoute = async (path: Endpoints, leagueId: number) => {
  const layer = router.stack.find((route: any) => route.route?.path === path && route.route?.methods?.post);
  if (!layer) throw Error(`POST route '${path}' not found`);

  const res: any = {
    send: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
  await layer.route.stack[0].handle({ params: { leagueId: `${leagueId}` } }, res);
  return res;
};

// @spec SCL-015,SCL-016
const createLeague = async (status: 'CUTOVER' | 'IN_SEASON') => {
  const gameWorld = await db.models.GameWorld.create({ config: {} }).then(({ dataValues }) => dataValues);
  const league = await LeagueFactory().create(gameWorld.id, {
    name: 'Lifecycle API League',
    type: LeagueType.League,
    stages: [{ id: "default", name: "Default", divisions: [] }],
  }, []);
  await db.models.League.update({ status }, { where: { id: league.id } });
  return league;
};

describe('League season lifecycle API', () => {
  beforeEach(async () => {
    await db.sync({ force: true });
  });

  // @spec SCL-015
  it('POST cutover returns LeagueFactory.cutover() result', async () => {
    const league = await createLeague('IN_SEASON');

    const res = await invokePostRoute(Endpoints.LeagueSeasonCutover, league.id);

    expect(res.send).toHaveBeenCalledWith({ id: league.id, year: 2026, status: 'CUTOVER' });
  });

  // @spec SCL-015
  it('POST cutover propagates a cutover error statusCode', async () => {
    const league = await createLeague('CUTOVER');

    const res = await invokePostRoute(Endpoints.LeagueSeasonCutover, league.id);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.send).toHaveBeenCalledWith({ error: 'league is not in season' });
  });

  // @spec SCL-016
  it('POST start returns LeagueFactory.start() result', async () => {
    const league = await createLeague('CUTOVER');

    const res = await invokePostRoute(Endpoints.LeagueSeasonStart, league.id);

    expect(res.send).toHaveBeenCalledWith({ id: league.id, year: 2025, status: 'IN_SEASON' });
  });

  // @spec SCL-016
  it('POST start propagates a start error statusCode', async () => {
    const league = await createLeague('IN_SEASON');

    const res = await invokePostRoute(Endpoints.LeagueSeasonStart, league.id);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.send).toHaveBeenCalledWith({ error: 'league is not in cutover' });
  });
});
