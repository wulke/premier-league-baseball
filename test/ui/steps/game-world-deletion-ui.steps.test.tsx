// @spec:GWDUI-001 @spec:GWDUI-002 @spec:GWDUI-003 @spec:GWDUI-004 @spec:GWDUI-005 @spec:GWDUI-006 @spec:GWDUI-007
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act } from 'react-dom/test-utils';
import { fireEvent, screen, waitFor, within, cleanup } from '@testing-library/react';
import { render } from '../test-utils';
import { Home } from '../../../src/ui/pages';

const mockNavigate = jest.fn();

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useNavigate: () => mockNavigate,
}));

const feature = loadFeature(path.resolve(__dirname, '../features/game-world-deletion-ui.feature'));

type GameWorldRow = {
  id: number;
  year: number;
  config?: {
    name?: string;
    inProgress?: boolean;
  };
};

type Deferred = {
  resolve: (value: unknown) => void;
};

type DeleteResponse = {
  status: number;
  body: Record<string, unknown>;
};

type FetchCall = {
  method: string;
  url: string;
};

type WorldState = {
  gameWorlds: GameWorldRow[];
  fetchCalls: FetchCall[];
  deleteDeferred: Deferred | null;
  deleteResponse: DeleteResponse;
  homeRendered: boolean;
};

const createWorld = (): WorldState => ({
  gameWorlds: [
    { id: 1, year: 2024, config: { name: 'National League 2024', inProgress: true } },
    { id: 2, year: 2023, config: { name: 'American League 2023', inProgress: false } },
  ],
  fetchCalls: [],
  deleteDeferred: null,
  deleteResponse: { status: 200, body: {} },
  homeRendered: false,
});

let world = createWorld();

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    world.fetchCalls.push({ method, url });

    if (method === 'GET' && url === '/api/gameWorld') {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(world.gameWorlds),
      });
    }

    if (method === 'DELETE' && /\/api\/gameWorld\/\d+$/.test(url)) {
      return new Promise((resolve) => {
        world.deleteDeferred = { resolve };
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  }) as jest.Mock;
};

const resolveDelete = () => {
  const deferred = world.deleteDeferred;
  if (!deferred) return;
  const { status, body } = world.deleteResponse;
  deferred.resolve({
    ok: status >= 200 && status < 400,
    status,
    json: () => Promise.resolve(body),
  });
  world.deleteDeferred = null;
};

const deleteUrlFor = (id: number) => `/api/gameWorld/${id}`;

const countCalls = (method: string, url: string) =>
  world.fetchCalls.filter((call) => call.method === method && call.url === url).length;

const renderHome = async () => {
  render(<Home />);
  world.homeRendered = true;
  await flush();
};

const ensureHomeRendered = async () => {
  if (!world.homeRendered) {
    await renderHome();
  }
};

const gameWorldCard = (name: string) => {
  const title = screen.getByText(name);
  const card = title.parentElement;
  if (!card) throw new Error(`Card not found for ${name}`);
  return card as HTMLElement;
};

const hoverCard = (name: string) => {
  fireEvent.mouseEnter(gameWorldCard(name));
};

const leaveCard = (name: string) => {
  fireEvent.mouseLeave(gameWorldCard(name));
};

const deleteButtonFor = (name: string) =>
  within(gameWorldCard(name)).getByRole('button', { name: /\[x\]/i });

const openDeleteModal = async (name: string) => {
  hoverCard(name);
  fireEvent.click(deleteButtonFor(name));
  await flush();
};

beforeEach(() => {
  world = createWorld();
  mockNavigate.mockReset();
  installFetch();
});

afterEach(() => {
  cleanup();
});

defineFeature(feature, (test) => {
  test('Hovering a GameWorld card reveals its delete icon', ({ given, when, then, and }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    when(/^the player hovers GameWorld 1's card$/, async () => {
      await ensureHomeRendered();
      hoverCard('National League 2024');
    });

    then(/^a delete "\[x\]" icon is visible in the top-right corner of GameWorld 1's card$/, () => {
      expect(deleteButtonFor('National League 2024')).toBeVisible();
    });

    and(/^no delete icon is visible on GameWorld 2's card$/, () => {
      expect(within(gameWorldCard('American League 2023')).queryByRole('button', { name: /\[x\]/i })).toBeNull();
    });
  });

  test('Moving the mouse off a card hides its delete icon', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    given(/^the player is hovering GameWorld 1's card$/, async () => {
      await ensureHomeRendered();
      hoverCard('National League 2024');
    });

    when(/^the player moves the mouse off GameWorld 1's card$/, () => {
      leaveCard('National League 2024');
    });

    then(/^the delete "\[x\]" icon is no longer visible on GameWorld 1's card$/, () => {
      expect(within(gameWorldCard('National League 2024')).queryByRole('button', { name: /\[x\]/i })).toBeNull();
    });
  });

  test('Clicking the delete icon does not navigate into the GameWorld', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the player is hovering GameWorld 1's card$/, async () => {
      await ensureHomeRendered();
      hoverCard('National League 2024');
    });

    when(/^the player clicks GameWorld 1's delete icon$/, async () => {
      fireEvent.click(deleteButtonFor('National League 2024'));
      await flush();
    });

    then(/^the player is not navigated to GameWorld 1's page$/, () => {
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    and(/^a confirmation modal is shown$/, () => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
  });

  test('The confirmation modal names the GameWorld and warns the action is permanent', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the player is hovering GameWorld 1's card$/, async () => {
      await ensureHomeRendered();
      hoverCard('National League 2024');
    });

    when(/^the player clicks GameWorld 1's delete icon$/, async () => {
      fireEvent.click(deleteButtonFor('National League 2024'));
      await flush();
    });

    then(/^the modal title includes "([^"]+)"$/, (name) => {
      expect(screen.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
    });

    and(/^the modal states the deletion is permanent$/, () => {
      expect(screen.getByText(/permanently delete/i)).toBeVisible();
      expect(screen.getByText(/cannot be undone/i)).toBeVisible();
    });

    and(/^the modal shows "Delete" and "Cancel" buttons$/, () => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });
  });

  test('Cancelling the confirmation modal sends no request', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the delete confirmation modal is open for GameWorld 1$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
    });

    when(/^the player clicks "Cancel"$/, async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await flush();
    });

    then(/^the modal is closed$/, async () => {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    and(/^no DELETE request is sent$/, () => {
      expect(countCalls('DELETE', deleteUrlFor(1))).toBe(0);
    });

    and(/^GameWorld 1 still appears in the list$/, () => {
      expect(screen.getByText('National League 2024')).toBeVisible();
    });
  });

  test('Confirming deletion removes the GameWorld from the list on success', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the delete confirmation modal is open for GameWorld 1$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
    });

    when(/^the player clicks "Delete"$/, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    and(/^DELETE \/api\/gameWorld\/1 returns 200$/, async () => {
      world.deleteResponse = { status: 200, body: {} };
      resolveDelete();
      await flush();
    });

    then(/^the modal is closed$/, async () => {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    and(/^GameWorld 1 no longer appears in the list$/, async () => {
      await waitFor(() => expect(screen.queryByText('National League 2024')).toBeNull());
    });

    and(/^GameWorld 2 still appears in the list$/, () => {
      expect(screen.getByText('American League 2023')).toBeVisible();
    });

    and(/^GET \/api\/gameWorld is not requested again$/, () => {
      expect(countCalls('GET', '/api/gameWorld')).toBe(1);
    });
  });

  test('Deleting the only GameWorld falls back to the empty state', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    given(/^GameWorld 1 is the only GameWorld in the list$/, () => {
      world.gameWorlds = [world.gameWorlds[0]];
    });

    and(/^the delete confirmation modal is open for GameWorld 1$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
    });

    when(/^the player clicks "Delete"$/, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    and(/^DELETE \/api\/gameWorld\/1 returns 200$/, async () => {
      world.deleteResponse = { status: 200, body: {} };
      resolveDelete();
      await flush();
    });

    then(/^the modal is closed$/, async () => {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    and(/^the "No game worlds yet\." empty state is shown$/, async () => {
      await waitFor(() => expect(screen.getByText('No game worlds yet.')).toBeVisible());
    });
  });

  test('A failed deletion keeps the modal open with an error and retry option', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the delete confirmation modal is open for GameWorld 1$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
    });

    when(/^the player clicks "Delete"$/, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    and(/^DELETE \/api\/gameWorld\/1 returns a server error$/, async () => {
      world.deleteResponse = { status: 500, body: { error: 'Failed to delete game world' } };
      resolveDelete();
      await flush();
    });

    then(/^the modal remains open$/, () => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    and(/^an error message is shown in the modal$/, () => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete game world');
    });

    and(/^"Retry" and "Cancel" buttons are shown$/, () => {
      expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    and(/^GameWorld 1 still appears in the list$/, () => {
      expect(screen.getByText('National League 2024')).toBeVisible();
    });
  });

  test('Retrying a failed deletion succeeds', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the delete confirmation modal is open for GameWorld 1 showing an error after a failed attempt$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      world.deleteResponse = { status: 500, body: { error: 'Failed to delete game world' } };
      resolveDelete();
      await flush();
    });

    when(/^the player clicks "Retry"$/, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    and(/^DELETE \/api\/gameWorld\/1 returns 200$/, async () => {
      world.deleteResponse = { status: 200, body: {} };
      resolveDelete();
      await flush();
    });

    then(/^the modal is closed$/, async () => {
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    and(/^GameWorld 1 no longer appears in the list$/, async () => {
      await waitFor(() => expect(screen.queryByText('National League 2024')).toBeNull());
    });
  });

  test('Delete and Cancel are disabled while the request is in flight', ({ given, and, when, then }) => {
    given(/^the home page has loaded with GameWorld 1 named "([^"]+)" in its list$/, (name) => {
      world.gameWorlds[0].config = { ...world.gameWorlds[0].config, name };
    });

    and(/^the home page also lists GameWorld 2 named "([^"]+)"$/, (name) => {
      world.gameWorlds[1].config = { ...world.gameWorlds[1].config, name };
    });

    and(/^the delete confirmation modal is open for GameWorld 1$/, async () => {
      await ensureHomeRendered();
      await openDeleteModal('National League 2024');
    });

    when(/^the player clicks "Delete"$/, () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });

    and(/^the DELETE request has not yet resolved$/, async () => {
      await flush();
    });

    then(/^the "Delete" button is disabled$/, () => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    and(/^the "Cancel" button is disabled$/, () => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
  });
});
