// @spec NOTIFUI-001,NOTIFUI-002,NOTIFUI-003,NOTIFUI-004,NOTIFUI-005,NOTIFUI-006,NOTIFUI-007
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import routes from '../../../src/ui/routes';
import { installEventSource, emitSSEMessage } from '../test-utils';

const feature = loadFeature(path.resolve(__dirname, '../features/notification-stream-ui.feature'));

const NOTIFICATIONS_URL = '/api/gameWorld/1/notifications';
const STREAM_URL = '/api/gameWorld/1/notifications/stream';

type NotificationRow = {
  id: number;
  gameWorldId: number;
  teamId: number | null;
  type: string;
  payload: Record<string, any>;
  createdAt: string;
};

const row = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 1,
  gameWorldId: 1,
  teamId: 10,
  type: 'GAME_RESULT',
  payload: { homeTeamResult: 5, awayTeamResult: 2 },
  createdAt: '2025-06-01T00:00:00.000Z',
  ...overrides,
});

let managedTeamId: number | null = 10;
let notifications: NotificationRow[] = [];
let notificationsStatus = 200;
let lastRowId = 1;
let router: ReturnType<typeof createMemoryRouter>;
let MockEventSource: ReturnType<typeof installEventSource>;

const renderAt = async (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('notification-stream');
};

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (url === NOTIFICATIONS_URL) return response(notifications, notificationsStatus);
    if (url === '/api/gameWorld/1') {
      return response({ id: 1, year: 2025, managedTeamId, config: { name: 'Test World', inProgress: false }, Leagues: [] });
    }
    return response([]);
  }) as jest.Mock;
};

beforeEach(() => {
  managedTeamId = 10;
  notifications = [];
  notificationsStatus = 200;
  lastRowId = 1;
  installFetch();
  MockEventSource = installEventSource();
});
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('Notifications backfill from the REST endpoint on mount', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-001
    given('GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 10', () => {
      lastRowId = 10;
      notifications = [row({ id: lastRowId, teamId: 10 })];
    });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-001
    then('the notification list shows that GAME_RESULT row', async () => {
      await screen.findByTestId(`notification-${lastRowId}`);
    });
  });

  test('A failed backfill fetch degrades to an empty list', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-001
    given('GET /api/gameWorld/1/notifications fails', () => { notificationsStatus = 500; });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-001
    then('the notification list renders empty', async () => {
      await waitFor(() => expect(screen.queryAllByTestId(/^notification-\d+$/)).toHaveLength(0));
    });
    and('no error message is shown', () => expect(screen.queryByText(/failed|unable/i)).toBeNull());
  });

  test('A live SSE message is appended to the notification list', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-002
    given('GET /api/gameWorld/1/notifications returns no rows', () => { notifications = []; });
    and('the player has navigated to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-002,NOTIFUI-003
    when('a GAME_RESULT notification scoped to Team 10 arrives over the SSE stream', () => {
      lastRowId = 55;
      act(() => emitSSEMessage(STREAM_URL, row({ id: lastRowId, teamId: 10 })));
    });
    // @spec NOTIFUI-003
    then('the notification list shows that GAME_RESULT row', async () => {
      await screen.findByTestId(`notification-${lastRowId}`);
    });
  });

  test('Navigating away from the GameWorld page closes the SSE connection', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    given('the player has navigated to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-004
    when('the player navigates away from GameWorld 1', async () => {
      await act(async () => router.navigate('/'));
    });
    // @spec NOTIFUI-004
    then('the SSE connection to GameWorld 1\'s notification stream is closed', async () => {
      await waitFor(() => {
        const instance = MockEventSource.instances.find((candidate) => candidate.url === STREAM_URL);
        expect(instance?.closed).toBe(true);
      });
    });
  });

  test('A world-wide notification is shown regardless of the managed team', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-005
    given('GET /api/gameWorld/1/notifications returns a world-wide notification with no teamId', () => {
      lastRowId = 20;
      notifications = [row({ id: lastRowId, teamId: null, type: 'SEASON_COMPLETE' })];
    });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-005
    then('the notification list shows that notification', async () => {
      await screen.findByTestId(`notification-${lastRowId}`);
    });
  });

  test('A notification scoped to the managed team is shown', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-005
    given('GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 10', () => {
      lastRowId = 30;
      notifications = [row({ id: lastRowId, teamId: 10 })];
    });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-005
    then('the notification list shows that GAME_RESULT row', async () => {
      await screen.findByTestId(`notification-${lastRowId}`);
    });
  });

  test('A notification scoped to a different team is not shown', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-005
    given('GET /api/gameWorld/1/notifications returns a GAME_RESULT row scoped to Team 20', () => {
      lastRowId = 40;
      notifications = [row({ id: lastRowId, teamId: 20 })];
    });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-005
    then('the notification list does not show that row', async () => {
      await waitFor(() => expect(screen.queryByTestId(`notification-${lastRowId}`)).toBeNull());
    });
  });

  test('A notification of an unregistered type renders a raw fallback line', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    // @spec NOTIFUI-006
    given('GET /api/gameWorld/1/notifications returns a row of an unknown type "SEASON_COMPLETE"', () => {
      lastRowId = 50;
      notifications = [row({ id: lastRowId, teamId: null, type: 'SEASON_COMPLETE', payload: { year: 2025 } })];
    });
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-006
    then('the notification list shows a raw fallback line for that row', async () => {
      const el = await screen.findByTestId(`notification-${lastRowId}`);
      expect(el).toHaveTextContent('SEASON_COMPLETE');
    });
  });

  test('The notification list is mounted on the GameWorld page', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('GameWorld 1 has Team 10 "Manchester Mariners" as its managed club', () => {});
    when('the player navigates to "/1"', () => renderAt('/1'));
    // @spec NOTIFUI-007
    then('the GameWorld page shows the notification list', async () => {
      expect(await screen.findByTestId('notification-stream')).toBeInTheDocument();
    });
  });
});
