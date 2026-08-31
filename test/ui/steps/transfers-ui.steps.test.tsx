// @spec XFERUI-001,XFERUI-002,XFERUI-003,XFERUI-004,XFERUI-005,XFERUI-006
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/transfers-ui.feature'));

type RosterPlayer = {
  id: number;
  givenName: string;
  familyName: string;
  countryCode: string;
  bats: 'R' | 'L' | 'S';
  throws: 'R' | 'L';
  age: number;
  primaryPosition: string;
  positionCoverage: string[];
  positions: Record<string, number>;
  contact: number; power: number; armStrength: number; accuracy: number; reaction: number; vision: number; discipline: number;
};

const player = (overrides: Partial<RosterPlayer> = {}): RosterPlayer => ({
  id: 100,
  givenName: 'Riley',
  familyName: 'Rivera',
  countryCode: 'US',
  bats: 'R',
  throws: 'R',
  age: 24,
  primaryPosition: 'Shortstop',
  positionCoverage: ['Shortstop'],
  positions: { Pitcher: 10, Catcher: 10, FirstBase: 10, SecondBase: 10, ThirdBase: 10, Shortstop: 80, LeftField: 10, CenterField: 10, RightField: 10 },
  contact: 70, power: 65, armStrength: 60, accuracy: 62, reaction: 71, vision: 66, discipline: 64,
  ...overrides,
});

let managedTeamId: number | null = 10;
let freeAgents: RosterPlayer[] = [];
let freeAgentsStatus = 200;
let roster: RosterPlayer[] = [];
let signStatus = 200;
let requests: string[] = [];
let posts: Array<{ url: string; body: any }> = [];
let router: ReturnType<typeof createMemoryRouter>;

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = init?.method ?? 'GET';
    requests.push(url);
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (method === 'POST' && url === '/api/team/10/transfers/sign') {
      posts.push({ url, body: JSON.parse(init!.body as string) });
      return response({}, signStatus);
    }
    if (method === 'POST' && (url === '/api/team/10/transfers/release' || url === '/api/team/10/transfers/renew')) {
      posts.push({ url, body: JSON.parse(init!.body as string) });
      return response({});
    }
    if (url === '/api/gameWorld/1/free-agents') return response(freeAgents, freeAgentsStatus);
    if (url === '/api/team/10/roster') return response(roster);
    if (url === '/api/team/10/calendar?gwId=1') return response({ teamName: 'Manchester Mariners', games: [] });
    if (url === '/api/gameWorld/1') return response({ id: 1, year: 2025, config: { name: 'Test World', inProgress: true }, Leagues: [], managedTeamId });
    return response([]);
  }) as jest.Mock;
};

const renderAt = async (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('app-shell');
};

beforeEach(() => {
  managedTeamId = 10;
  freeAgents = [];
  freeAgentsStatus = 200;
  roster = [];
  signStatus = 200;
  requests = [];
  posts = [];
  installFetch();
});
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('Clicking Transfers in the nav rail navigates to the Transfers page', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec XFERUI-001
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    when('the player clicks "Transfers" in the nav rail', async () => {
      await renderAt('/1');
      fireEvent.click(await screen.findByTestId('nav-managed-transfers'));
    });
    then('the browser navigates to "/1/transfers"', async () => {
      await waitFor(() => expect(router.state.location.pathname).toBe('/1/transfers'));
    });
  });

  test('Transfers stays dimmed in the nav rail with no managed club', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec XFERUI-006
    given('GameWorld 1 has no managed club', () => { managedTeamId = null; });
    when('the player navigates to GameWorld 1', () => renderAt('/1'));
    then('the nav rail shows the dimmed "Transfers" item', async () => {
      expect(await screen.findByTestId('nav-fog-transfers')).toHaveTextContent('Transfers');
    });
  });

  test('A direct visit to Transfers with no managed club still renders the market', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec XFERUI-006
    given('GameWorld 1 has no managed club', () => { managedTeamId = null; });
    and('GET /api/gameWorld/1/free-agents returns a Player', () => { freeAgents = [player()]; });
    when('the player navigates to "/1/transfers"', () => renderAt('/1/transfers'));
    then('the free-agent table shows that Player\'s row', async () => {
      expect(await screen.findByTestId('free-agent-row-100')).toBeInTheDocument();
    });
    and('no Sign action column is shown', () => {
      expect(screen.queryByTestId('sign-action-100')).toBeNull();
    });
  });

  test('The Transfers page renders the free-agent list', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-002
    and('GET /api/gameWorld/1/free-agents returns a Player with id 100', () => { freeAgents = [player({ id: 100 })]; });
    when('the player navigates to "/1/transfers"', () => renderAt('/1/transfers'));
    then('the free-agent table shows a row for Player 100', async () => {
      expect(await screen.findByTestId('free-agent-row-100')).toBeInTheDocument();
    });
  });

  test('An empty or failed free-agent fetch degrades to an empty table', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-002
    and('GET /api/gameWorld/1/free-agents fails', () => { freeAgentsStatus = 500; });
    when('the player navigates to "/1/transfers"', () => renderAt('/1/transfers'));
    then('the free-agent table renders empty', async () => {
      await waitFor(() => expect(screen.queryAllByTestId(/free-agent-row-/)).toHaveLength(0));
    });
    and('no error message is shown', () => expect(screen.queryByText(/failed|unable/i)).toBeNull());
  });

  test('Signing a free agent refetches the list without a full reload', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-003
    and('GET /api/gameWorld/1/free-agents returns a Player with id 100', () => { freeAgents = [player({ id: 100 })]; });
    when('the player navigates to "/1/transfers"', async () => {
      await renderAt('/1/transfers');
      await screen.findByTestId('free-agent-row-100');
    });
    and('the player clicks Sign on Player 100\'s row', () => fireEvent.click(screen.getByTestId('sign-action-100')));
    then('the client POSTs sign for Team 10 with playerId 100', async () => {
      await waitFor(() => expect(posts).toContainEqual({ url: '/api/team/10/transfers/sign', body: { playerId: 100 } }));
    });
    and('the free-agent list is refetched without a full reload', async () => {
      await waitFor(() => expect(requests.filter((url) => url === '/api/gameWorld/1/free-agents').length).toBeGreaterThanOrEqual(2));
    });
  });

  test('Signing a Player who was just signed by a race shows an inline message', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-004
    and('GET /api/gameWorld/1/free-agents returns a Player with id 100', () => { freeAgents = [player({ id: 100 })]; });
    and('POST transfers/sign for Team 10 with playerId 100 fails with 422', () => { signStatus = 422; });
    when('the player navigates to "/1/transfers"', async () => {
      await renderAt('/1/transfers');
      await screen.findByTestId('free-agent-row-100');
    });
    and('the player clicks Sign on Player 100\'s row', () => fireEvent.click(screen.getByTestId('sign-action-100')));
    then('the page shows a "no longer available" message', async () => {
      expect(await screen.findByTestId('sign-error')).toBeInTheDocument();
    });
    and('the free-agent list is refetched', async () => {
      await waitFor(() => expect(requests.filter((url) => url === '/api/gameWorld/1/free-agents').length).toBeGreaterThanOrEqual(2));
    });
  });

  test('The managed club\'s own roster rows show Release and Renew actions', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-005
    and('GET /api/team/10/roster returns a Player with id 200', () => { roster = [player({ id: 200 })]; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    then('Player 200\'s row shows a Release action', async () => {
      expect(await screen.findByTestId('release-action-200')).toBeInTheDocument();
    });
    and('Player 200\'s row shows a Renew action', () => {
      expect(screen.getByTestId('renew-action-200')).toBeInTheDocument();
    });
  });

  test('A non-managed team\'s roster rows show no transfer actions', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    // @spec XFERUI-005
    given('GameWorld 1 has Team 11 as its managed club', () => { managedTeamId = 11; });
    and('GET /api/team/10/roster returns a Player with id 200', () => { roster = [player({ id: 200 })]; });
    when('the player navigates to "/1/team/10/roster"', () => renderAt('/1/team/10/roster'));
    then('Player 200\'s row shows no Release action', async () => {
      await screen.findByTestId('roster-row-200');
      expect(screen.queryByTestId('release-action-200')).toBeNull();
    });
    and('Player 200\'s row shows no Renew action', () => {
      expect(screen.queryByTestId('renew-action-200')).toBeNull();
    });
  });

  test('Releasing a Player from the managed club\'s roster refetches it', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-005
    and('GET /api/team/10/roster returns a Player with id 200', () => { roster = [player({ id: 200 })]; });
    when('the player navigates to "/1/team/10/roster"', async () => {
      await renderAt('/1/team/10/roster');
      await screen.findByTestId('release-action-200');
    });
    and('the player clicks Release on Player 200\'s row', () => fireEvent.click(screen.getByTestId('release-action-200')));
    then('the client POSTs release for Team 10 with playerId 200', async () => {
      await waitFor(() => expect(posts).toContainEqual({ url: '/api/team/10/transfers/release', body: { playerId: 200 } }));
    });
    and('the team roster is refetched', async () => {
      await waitFor(() => expect(requests.filter((url) => url === '/api/team/10/roster').length).toBeGreaterThanOrEqual(2));
    });
  });

  test('Renewing a Player from the managed club\'s roster refetches it', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {});
    and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GameWorld 1 has Team 10 as its managed club', () => { managedTeamId = 10; });
    // @spec XFERUI-005
    and('GET /api/team/10/roster returns a Player with id 200', () => { roster = [player({ id: 200 })]; });
    when('the player navigates to "/1/team/10/roster"', async () => {
      await renderAt('/1/team/10/roster');
      await screen.findByTestId('renew-action-200');
    });
    and('the player clicks Renew on Player 200\'s row', () => fireEvent.click(screen.getByTestId('renew-action-200')));
    then('the client POSTs renew for Team 10 with playerId 200', async () => {
      await waitFor(() => expect(posts).toContainEqual({ url: '/api/team/10/transfers/renew', body: { playerId: 200 } }));
    });
    and('the team roster is refetched', async () => {
      await waitFor(() => expect(requests.filter((url) => url === '/api/team/10/roster').length).toBeGreaterThanOrEqual(2));
    });
  });
});
