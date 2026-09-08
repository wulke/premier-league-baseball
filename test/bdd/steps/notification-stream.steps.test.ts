// @spec NOTIF-001,NOTIF-003,NOTIF-006,NOTIF-007
// Notification stream (backend) acceptance bindings. NOTIF-002,004,005,008-011 are
// SSE-connection-management / pure-Factory invariants with no scenario here — see
// test/db/domain/notifications/notification.test.ts.
import path from 'path';
import { autoBindSteps, loadFeature } from 'jest-cucumber';
import * as handlers from '../../../src/api/handlers';
import db from '../../../src/db/client';

const feature = loadFeature(path.resolve(__dirname, '../features/notification-stream.feature'));

interface ResponseState {
  statusCode: number;
  body?: any;
  error?: unknown;
}

interface WorldState {
  homeTeamId?: number;
  awayTeamId?: number;
  gameId?: number;
  firstNotificationId?: number;
  response?: ResponseState;
}

let scenarioWorld: WorldState = {};

const captureNotifications = async (gwId: number, since?: number) => {
  try {
    const body = await handlers.getGameWorldNotifications(gwId, since);
    scenarioWorld.response = { statusCode: 200, body };
  } catch (error) {
    scenarioWorld.response = { statusCode: (error as any)?.statusCode ?? 500, error };
  }
};

const rows = (): any[] => Array.isArray(scenarioWorld.response?.body) ? scenarioWorld.response!.body : [];

const registerSteps = ({ given, when, then, and }: any) => {
  given(/^a GameWorld exists with id (\d+)$/, async (id: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: 2025, config: {} });
  });

  given(/^GameWorld (\d+) exists with no notifications$/, async (id: string) => {
    await db.models.GameWorld.create({ id: Number(id), year: 2025, config: {} });
  });

  given(/^Team (\d+) "([^"]+)" belongs to GameWorld (\d+)$/, async (teamId: string, name: string, gwId: string) => {
    const league = await db.models.League.create({ gameWorldId: Number(gwId), config: {} }).then(({ dataValues }) => dataValues);
    await db.models.Team.create({ id: Number(teamId), gameWorldId: Number(gwId), homeLeagueId: league.id, config: { name } });
  });

  given(/^a scheduled Game between Team (\d+) and Team (\d+) in GameWorld (\d+)$/, async (homeTeamId: string, awayTeamId: string, gwId: string) => {
    const gameWorldId = Number(gwId);
    scenarioWorld.homeTeamId = Number(homeTeamId);
    scenarioWorld.awayTeamId = Number(awayTeamId);

    const league = await db.models.League.create({
      gameWorldId,
      config: { name: 'Notification BDD League' },
    }).then(({ dataValues }) => dataValues);
    const division = await db.models.Division.create({
      leagueId: league.id,
      config: { name: 'Notification BDD Division' },
    }).then(({ dataValues }) => dataValues);
    const dsHome = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: scenarioWorld.homeTeamId, year: 2025,
    }).then(({ dataValues }) => dataValues);
    const dsAway = await db.models.DivisionSeason.create({
      divisionId: division.id, teamId: scenarioWorld.awayTeamId, year: 2025,
    }).then(({ dataValues }) => dataValues);

    const game = await db.models.Game.create({
      homeTeam: scenarioWorld.homeTeamId,
      awayTeam: scenarioWorld.awayTeamId,
      status: 'SCHEDULED',
    }).then(({ dataValues }) => dataValues);
    scenarioWorld.gameId = game.id;

    await db.models.DivisionSeasonGame.bulkCreate([
      { gameId: game.id, divisionSeasonId: dsHome.id },
      { gameId: game.id, divisionSeasonId: dsAway.id },
    ]);
  });

  given('the player has simulated that Game', async () => {
    await handlers.simulateGame(scenarioWorld.gameId!);
  });

  given('the first Notification row\'s id is known', async () => {
    const first = await db.models.Notification.findOne({ order: [['id', 'ASC']] });
    scenarioWorld.firstNotificationId = first!.dataValues.id;
  });

  when(/^the player simulates that Game$/, async () => {
    await handlers.simulateGame(scenarioWorld.gameId!);
  });

  when(/^the player requests notifications for GameWorld (\d+)$/, async (gwId: string) => {
    await captureNotifications(Number(gwId));
  });

  when(/^the player requests notifications for GameWorld (\d+) with no since parameter$/, async (gwId: string) => {
    await captureNotifications(Number(gwId));
  });

  when(/^the player requests notifications for GameWorld (\d+) since that first row's id$/, async (gwId: string) => {
    await captureNotifications(Number(gwId), scenarioWorld.firstNotificationId);
  });

  when(/^the player requests notifications for GameWorld (\d+) with a non-numeric since parameter$/, async (gwId: string) => {
    await captureNotifications(Number(gwId), Number('not-a-number'));
  });

  then(/^a GAME_RESULT Notification row exists scoped to Team (\d+)$/, async (teamId: string) => {
    const row = await db.models.Notification.findOne({ where: { type: 'GAME_RESULT', teamId: Number(teamId) } });
    expect(row).not.toBeNull();
  });

  then(/^a separate GAME_RESULT Notification row exists scoped to Team (\d+)$/, async (teamId: string) => {
    const row = await db.models.Notification.findOne({ where: { type: 'GAME_RESULT', teamId: Number(teamId) } });
    expect(row).not.toBeNull();
    const allRows = await db.models.Notification.findAll({ where: { type: 'GAME_RESULT' } });
    expect(allRows.length).toBe(2);
  });

  then('the response is a raw array of notification rows', () => {
    expect(Array.isArray(scenarioWorld.response?.body)).toBe(true);
  });

  and('each row includes gameWorldId, teamId, type, payload, and createdAt', () => {
    expect(rows()[0]).toEqual(expect.objectContaining({
      gameWorldId: expect.any(Number),
      type: expect.any(String),
      payload: expect.any(Object),
      createdAt: expect.anything(),
    }));
    expect('teamId' in rows()[0]).toBe(true);
  });

  then('the response includes both GAME_RESULT rows, ordered oldest first', () => {
    expect(rows()).toHaveLength(2);
    expect(rows().map((r) => r.id)).toEqual([...rows().map((r) => r.id)].sort((a, b) => a - b));
  });

  then('the response includes only the second GAME_RESULT row', () => {
    expect(rows()).toHaveLength(1);
    expect(rows()[0].id).not.toBe(scenarioWorld.firstNotificationId);
  });

  then('the response is an empty array', () => {
    expect(scenarioWorld.response?.body).toEqual([]);
  });
};

beforeEach(async () => {
  await db.sync({ force: true });
  scenarioWorld = {};
});

autoBindSteps(feature, [registerSteps]);
