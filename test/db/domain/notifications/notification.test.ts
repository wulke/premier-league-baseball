// @spec NOTIF-002,NOTIF-004,NOTIF-005,NOTIF-008,NOTIF-009,NOTIF-010,NOTIF-011
// NOTIF-001,003,006,007 are covered by test/bdd/steps/notification-stream.steps.test.ts
// (player-facing behaviors reachable through handlers.ts) — these are the
// SSE-connection-management and pure-Factory invariants that harness can't exercise.
import db from '../../../../src/db/client';
import { DomainError } from '../../../../src/db/domain/errors';
import { NotificationFactory } from '../../../../src/db/domain/notifications/notification';
import { isRegisteredNotificationType, registerNotificationType } from '../../../../src/db/domain/notifications/registry';
import { GAME_RESULT } from '../../../../src/db/domain/notifications/game-result-notification';
import { Endpoints } from '../../../../src/api/endpoints';
import { router } from '../../../../src/api/router';

beforeAll(async () => {
  await db.sync({ force: true });
  await db.models.GameWorld.create({ id: 1, year: 2025, config: {} });
  await db.models.Team.create({ id: 10, gameWorldId: 1, config: {} });
});

describe('registry', () => {
  // @spec NOTIF-011
  it('registers GAME_RESULT at module load, before any explicit registerNotificationType call', () => {
    expect(isRegisteredNotificationType(GAME_RESULT)).toBe(true);
  });

  it('accepts a type registered at runtime', () => {
    registerNotificationType('CUSTOM_TEST_TYPE');
    expect(isRegisteredNotificationType('CUSTOM_TEST_TYPE')).toBe(true);
  });
});

describe('NotificationFactory().notify()', () => {
  // @spec NOTIF-002
  it('throws a 400 DomainError for an unregistered type', async () => {
    await expect(NotificationFactory().notify('NOT_REGISTERED', {}, { gameWorldId: 1 }))
      .rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    await expect(NotificationFactory().notify('NOT_REGISTERED', {}, { gameWorldId: 1 }))
      .rejects.toBeInstanceOf(DomainError);
  });

  // @spec NOTIF-010
  it('persists the envelope with no read-state field', async () => {
    registerNotificationType('ENVELOPE_TEST');
    await NotificationFactory().notify('ENVELOPE_TEST', { foo: 'bar' }, { gameWorldId: 1, teamId: 10 });
    const row = await db.models.Notification.findOne({ where: { type: 'ENVELOPE_TEST' } });
    expect(row!.dataValues).toEqual(expect.objectContaining({
      gameWorldId: 1, teamId: 10, type: 'ENVELOPE_TEST', payload: { foo: 'bar' },
    }));
    expect(row!.dataValues.createdAt).toBeDefined();
    expect('readAt' in row!.dataValues).toBe(false);
    expect('isRead' in row!.dataValues).toBe(false);
  });

  it('defaults teamId to null for a world-wide notification', async () => {
    registerNotificationType('WORLD_WIDE_TEST');
    await NotificationFactory().notify('WORLD_WIDE_TEST', {}, { gameWorldId: 1 });
    const row = await db.models.Notification.findOne({ where: { type: 'WORLD_WIDE_TEST' } });
    expect(row!.dataValues.teamId).toBeNull();
  });

  // @spec NOTIF-005
  it('logs and swallows a write failure rather than propagating it', async () => {
    registerNotificationType('WRITE_FAILS_TEST');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      NotificationFactory().notify('WRITE_FAILS_TEST', {}, { gameWorldId: null as any }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    const row = await db.models.Notification.findOne({ where: { type: 'WRITE_FAILS_TEST' } });
    expect(row).toBeNull();
    errorSpy.mockRestore();
  });

  // @spec NOTIF-004
  it('pushes a persisted row to every open SSE connection for that gameWorldId', async () => {
    registerNotificationType('PUSH_TEST');
    const res: any = { write: jest.fn() };
    NotificationFactory().subscribe(1, res);
    await NotificationFactory().notify('PUSH_TEST', { hello: 'world' }, { gameWorldId: 1 });
    expect(res.write).toHaveBeenCalledTimes(1);
    expect(res.write.mock.calls[0][0]).toMatch(/^data: /);
    expect(JSON.parse(res.write.mock.calls[0][0].replace(/^data: /, '').trim())).toEqual(
      expect.objectContaining({ type: 'PUSH_TEST', payload: { hello: 'world' } }),
    );
    NotificationFactory().unsubscribe(1, res);
  });

  it('no-ops when no SSE connection is open for that gameWorldId', async () => {
    // Reuses the already-created GameWorld 1 (no open connections registered here) so
    // the notification write succeeds and the only thing under test is the push no-op.
    registerNotificationType('NO_CONNECTIONS_TEST');
    await expect(
      NotificationFactory().notify('NO_CONNECTIONS_TEST', {}, { gameWorldId: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe('GET /api/gameWorld/:gwId/notifications/stream (router)', () => {
  const getStreamHandler = () => {
    const layer = router.stack.find((candidate: any) =>
      candidate.route?.path === Endpoints.StreamGameWorldNotifications && candidate.route?.methods?.get,
    );
    if (!layer) throw new Error('SSE route not found');
    return layer.route.stack[0].handle;
  };

  // @spec NOTIF-008
  it('opens an SSE connection with streaming headers and registers the connection', () => {
    const handler = getStreamHandler();
    const req: any = { params: { gwId: '1' }, on: jest.fn() };
    const res: any = { writeHead: jest.fn(), flushHeaders: jest.fn(), write: jest.fn() };

    handler(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }));
    expect(req.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  // @spec NOTIF-009
  it('unsubscribes the connection when the client disconnects', async () => {
    const handler = getStreamHandler();
    const req: any = { params: { gwId: '1' }, on: jest.fn() };
    const res: any = { writeHead: jest.fn(), flushHeaders: jest.fn(), write: jest.fn() };

    handler(req, res);
    const closeCallback = req.on.mock.calls.find((call: any[]) => call[0] === 'close')[1];

    registerNotificationType('DISCONNECT_TEST');
    await NotificationFactory().notify('DISCONNECT_TEST', {}, { gameWorldId: 1 });
    expect(res.write).toHaveBeenCalledTimes(1);

    closeCallback();
    res.write.mockClear();

    registerNotificationType('AFTER_DISCONNECT_TEST');
    await NotificationFactory().notify('AFTER_DISCONNECT_TEST', {}, { gameWorldId: 1 });
    expect(res.write).not.toHaveBeenCalled();
  });
});
