// @spec GWA-001,GWA-002,GWA-003,GWA-004,GWA-005
// GameWorld collection API (list + create) acceptance bindings.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import { useDefaultGameWorld } from '../../../src/api/models';
import db from '../../../src/db/client';

jest.setTimeout(30000);

const feature = loadFeature(path.resolve(__dirname, '../features/game-world-api.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

let response: ResponseState | undefined;
let createdWorldId: number | undefined;

const captureCreate = async (payload: any) => {
  try {
    const body = await handlers.newGameWorld(payload);
    createdWorldId = body.id;
    response = { statusCode: 200, body };
  } catch (error) {
    response = { statusCode: (error as any)?.statusCode ?? 500, error };
  }
};

const persistedWorld = async () => {
  const row = await db.models.GameWorld.findByPk(createdWorldId!);
  expect(row).not.toBeNull();
  return row!.dataValues;
};

const registerSteps = ({ given, when, then }: any) => {
  given(/^GameWorlds exist with ids (\d+) and (\d+)$/, async (idA: string, idB: string) => {
    await db.models.GameWorld.create({ id: Number(idA), config: {} });
    await db.models.GameWorld.create({ id: Number(idB), config: {} });
  });

  when('the player lists all GameWorlds', async () => {
    try {
      const body = await handlers.getGameWorlds();
      response = { statusCode: 200, body };
    } catch (error) {
      response = { statusCode: (error as any)?.statusCode ?? 500, error };
    }
  });

  when('the player creates a GameWorld from the default Premier League template', async () => {
    await captureCreate(useDefaultGameWorld());
  });

  when('the player creates a GameWorld from the default template with year 1999', async () => {
    await captureCreate({ ...useDefaultGameWorld(), year: 1999 });
  });

  when('the player creates a GameWorld with an empty payload', async () => {
    await captureCreate({});
  });

  then('the response is an array containing both ids', () => {
    expect(Array.isArray(response?.body)).toBe(true);
    const ids = (response!.body as any[]).map((world) => world.id);
    expect(ids).toEqual(expect.arrayContaining([1, 2]));
  });

  then('the response is an empty array', () => expect(response?.body).toEqual([]));

  then('the response is a 500 error', () => expect(response?.statusCode).toBe(500));

  then('the response includes an array of 2 leagues and an array of 44 teams', () => {
    expect(response?.body.leagues).toHaveLength(2);
    expect(response?.body.teams).toHaveLength(44);
  });

  then('the persisted GameWorld config has inProgress false', async () => {
    const world = await persistedWorld();
    expect(world.config.inProgress).toBe(false);
  });

  then('the persisted GameWorld year column keeps its default', async () => {
    const world = await persistedWorld();
    expect(world.year).toBe(new Date().getFullYear() - 1);
  });

  then('the persisted GameWorld year column is the current year minus 1', async () => {
    const world = await persistedWorld();
    expect(world.year).toBe(new Date().getFullYear() - 1);
  });

  then('the persisted GameWorld config stores year 1999', async () => {
    const world = await persistedWorld();
    expect(world.config.year).toBe(1999);
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  response = undefined;
  createdWorldId = undefined;
});

autoBindSteps(feature, [registerSteps]);
