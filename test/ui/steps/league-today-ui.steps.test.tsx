// @spec TODAYUI-001,TODAYUI-002,TODAYUI-003,TODAYUI-004,TODAYUI-005,TODAYUI-006
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

type MockGame = {
  gameId: number;
  scheduledDate: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  divisionId: number;
  divisionName: string;
  roundLabel: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
};

type TodayResponse = { status: number; games: MockGame[] };

const feature = loadFeature(path.resolve(__dirname, '../features/league-today-ui.feature'));
let todayResponses: Record<string, TodayResponse> = {};
let fetchCalls: string[] = [];
let seasonInProgress = true;
let worldCurrentDate: string | null = '2025-06-10';

const game = (gameId: number, scheduledDate: string): MockGame => ({
  gameId,
  scheduledDate,
  homeTeamId: gameId * 10,
  homeTeamName: `Home ${gameId}`,
  awayTeamId: gameId * 10 + 1,
  awayTeamName: `Away ${gameId}`,
  divisionId: 10,
  divisionName: 'East Division',
  roundLabel: 'Round 1',
  homeTeamResult: null,
  awayTeamResult: null,
  status: 'SCHEDULED',
});

// @spec TODAYUI-001,TODAYUI-002,TODAYUI-003,TODAYUI-004,TODAYUI-005,TODAYUI-006
const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    fetchCalls.push(url);
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (url === '/api/gameWorld/1') {
      return response({
        id: 1,
        year: 2025,
        currentDate: worldCurrentDate,
        config: { name: 'Test World', inProgress: seasonInProgress },
        Leagues: [
          { id: 1, config: { name: 'National League' } },
          { id: 2, config: { name: 'American League' } },
        ],
      });
    }

    const todayMatch = url.match(/^\/api\/league\/(\d+)\/today$/);
    if (todayMatch) {
      const { status, games } = todayResponses[todayMatch[1]] ?? { status: 200, games: [] };
      return response(games, status);
    }

    return response(url.endsWith('/bracket') ? [] : {});
  }) as jest.Mock;
};

// @spec TODAYUI-001,TODAYUI-002,TODAYUI-003,TODAYUI-004,TODAYUI-005
const renderGameWorld = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Test World' });
};

beforeEach(() => {
  todayResponses = {};
  fetchCalls = [];
  seasonInProgress = true;
  worldCurrentDate = '2025-06-10';
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

defineFeature(feature, (test) => {
  test('The home page fetches today\'s snapshot for every league in the GameWorld', ({ given, when, then, and }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-001
    then('GET /api/league/1/today is requested', async () => {
      await waitFor(() => expect(fetchCalls).toContain('/api/league/1/today'));
    });

    // @spec TODAYUI-001
    and('GET /api/league/2/today is requested', async () => {
      await waitFor(() => expect(fetchCalls).toContain('/api/league/2/today'));
    });
  });

  test('Leagues with games in the window get a sub-block, grouped and sorted', ({ given, and, when, then }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-003
    and('GET /api/league/1/today returns two games for League 1, one scheduled before the other', () => {
      todayResponses['1'] = { status: 200, games: [game(101, '2025-04-09'), game(102, '2025-04-12')] };
    });
    // @spec TODAYUI-003
    and('GET /api/league/2/today returns one game for League 2', () => {
      todayResponses['2'] = { status: 200, games: [game(201, '2025-04-10')] };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-003
    then('the Today section shows a "National League" sub-block listing its two games in chronological order', async () => {
      const block = await screen.findByTestId('today-league-1');
      expect(within(block).getAllByTestId(/today-game-/).map((row) => row.getAttribute('data-testid')))
        .toEqual(['today-game-101', 'today-game-102']);
    });

    // @spec TODAYUI-003
    and('the Today section shows an "American League" sub-block listing its one game', async () => {
      const block = await screen.findByTestId('today-league-2');
      expect(within(block).getByTestId('today-game-201')).toBeInTheDocument();
    });
  });

  test('A league with no games in the window has no sub-block', ({ given, and, when, then }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-004
    and('GET /api/league/1/today returns one game for League 1', () => {
      todayResponses['1'] = { status: 200, games: [game(101, '2025-04-10')] };
    });
    // @spec TODAYUI-004
    and('GET /api/league/2/today returns no games', () => {
      todayResponses['2'] = { status: 200, games: [] };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-004
    then('the Today section shows a "National League" sub-block', async () => {
      expect(await screen.findByTestId('today-league-1')).toBeInTheDocument();
    });

    // @spec TODAYUI-004
    and('the Today section does not show an "American League" sub-block', async () => {
      await waitFor(() => expect(screen.queryByTestId('today-league-2')).toBeNull());
    });
  });

  test('No league has any games in the window', ({ given, and, when, then }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-005
    and('GET /api/league/1/today returns no games', () => {
      todayResponses['1'] = { status: 200, games: [] };
    });
    // @spec TODAYUI-005
    and('GET /api/league/2/today returns no games', () => {
      todayResponses['2'] = { status: 200, games: [] };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-005
    then('no Today section is shown', async () => {
      await waitFor(() => expect(screen.queryByTestId('today-section')).toBeNull());
    });
  });

  test('The season is not in progress', ({ given, when, then, and }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-005
    and('GameWorld 1 has no active season', () => {
      seasonInProgress = false;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-005
    then('no Today section is shown', async () => {
      await waitFor(() => expect(screen.queryByTestId('today-section')).toBeNull());
    });

    // @spec TODAYUI-005
    and('GET /api/league/1/today is not requested', () => {
      expect(fetchCalls).not.toContain('/api/league/1/today');
    });
  });

  test('The GameWorld has no currentDate configured', ({ given, when, then, and }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-006
    and('GameWorld 1 has no currentDate configured', () => {
      worldCurrentDate = null;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-006
    then('no Today section is shown', async () => {
      await waitFor(() => expect(screen.queryByTestId('today-section')).toBeNull());
    });

    // @spec TODAYUI-006
    and('GET /api/league/1/today is not requested', () => {
      expect(fetchCalls).not.toContain('/api/league/1/today');
    });

    // @spec TODAYUI-006
    and('GET /api/league/2/today is not requested', () => {
      expect(fetchCalls).not.toContain('/api/league/2/today');
    });
  });

  test('A league\'s snapshot request fails', ({ given, and, when, then }) => {
    given('GameWorld 1 has an in-progress season with League 1 named "National League" and League 2 named "American League"', () => {});
    // @spec TODAYUI-002
    and('GET /api/league/1/today returns a 422 error', () => {
      todayResponses['1'] = { status: 422, games: [] };
    });
    // @spec TODAYUI-002
    and('GET /api/league/2/today returns one game for League 2', () => {
      todayResponses['2'] = { status: 200, games: [game(201, '2025-04-10')] };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec TODAYUI-002
    then('the Today section shows an "American League" sub-block', async () => {
      expect(await screen.findByTestId('today-league-2')).toBeInTheDocument();
    });

    // @spec TODAYUI-002
    and('the Today section does not show a "National League" sub-block', () => {
      expect(screen.queryByTestId('today-league-1')).toBeNull();
    });

    // @spec TODAYUI-002
    and('no error message is shown on the page', () => {
      expect(screen.queryByText(/could not|failed to/i)).toBeNull();
    });
  });
});
