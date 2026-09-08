// @spec MCLB-001..MCLB-005 (managed-club acceptance)
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import db from '../../../src/db/client';
import { Endpoints } from '../../../src/api/endpoints';
import { router } from '../../../src/api/router';

// @spec MCLB-001..MCLB-005 (managed-club acceptance)
const feature = loadFeature(path.resolve(__dirname, '../features/managed-club.feature'));

interface WorldState {
  response?: { statusCode: number; body: any };
}

let scenarioWorld: WorldState;

const getRoute = (method: 'get' | 'post', endpoint: string) => {
  const layer = router.stack.find((candidate: any) =>
    candidate.route?.path === endpoint && candidate.route?.methods?.[method]
  );
  if (!layer) throw new Error(`${method.toUpperCase()} route '${endpoint}' not found`);
  return layer.route.stack[0].handle;
};

const request = async (method: 'get' | 'post', gwId: number, body?: any) => {
  const endpoint = method === 'get' ? Endpoints.GetGameWorld : Endpoints.SetManagedClub;
  const handler = getRoute(method, endpoint);
  const req = { params: { gwId: `${gwId}` }, body };
  const res: any = { statusCode: 200 };
  res.status = jest.fn().mockImplementation((statusCode: number) => {
    res.statusCode = statusCode;
    return res;
  });
  res.send = jest.fn().mockImplementation((responseBody: any) => {
    scenarioWorld.response = { statusCode: res.statusCode, body: responseBody };
    return res;
  });
  await handler(req, res);
};

const registerSteps = ({ given, when, then, and }: any) => {
  given(/^GameWorld (\d+) exists with no managed club$/, async (id: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: 2025, config: {} });
  });

  given(/^Team (\d+) belongs to GameWorld (\d+)$/, async (teamId: string, gwId: string) => {
    const league = await db.models.League.create({ gameWorldId: Number(gwId), config: {} }).then(({ dataValues }) => dataValues);
    await db.models.Team.create({ id: Number(teamId), gameWorldId: Number(gwId), homeLeagueId: league.id, config: {} });
  });

  given(/^GameWorld (\d+) has Team (\d+) as its managed club$/, async (gwId: string, teamId: string) => {
    await db.models.GameWorld.update({ managedTeamId: Number(teamId) }, { where: { id: Number(gwId) } });
  });

  when(/^the client gets GameWorld (\d+)$/, async (gwId: string) => {
    await request('get', Number(gwId));
  });

  when(/^the client sets GameWorld (\d+)'s managed club to Team (\d+)$/, async (gwId: string, teamId: string) => {
    await request('post', Number(gwId), { teamId: Number(teamId) });
  });

  when(/^the client clears GameWorld (\d+)'s managed club$/, async (gwId: string) => {
    await request('post', Number(gwId), { teamId: null });
  });

  then(/^the response is 200 with managedTeamId (null|\d+)$/, (managedTeamId: string) => {
    expect(scenarioWorld.response?.statusCode).toBe(200);
    expect(scenarioWorld.response?.body.managedTeamId).toBe(managedTeamId === 'null' ? null : Number(managedTeamId));
  });

  then(/^the response is a 422 error$/, () => {
    expect(scenarioWorld.response?.statusCode).toBe(422);
  });

  and(/^GameWorld (\d+) still has no managed club$/, async (gwId: string) => {
    await expect(db.models.GameWorld.findByPk(Number(gwId))).resolves.toMatchObject({
      dataValues: { managedTeamId: null },
    });
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = {};
});

autoBindSteps(feature, [registerSteps]);
