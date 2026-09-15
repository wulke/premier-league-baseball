// @spec CALWUI-001,CALWUI-002,CALWUI-003,CALWUI-004,CALWUI-005,CALWUI-006,CALWUI-007,CALWUI-008,CALWUI-009,CALWUI-010
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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
  leagueId: number;
  leagueName: string;
  roundLabel: string | null;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
};

const feature = loadFeature(path.resolve(__dirname, '../features/home-calendar-strip-ui.feature'));

let fetchCalls: string[] = [];
let managedTeamId: number | null = null;
let currentDate: string | null = null;
let calendarResponse: { games: MockGame[]; seasonStart: string | null; seasonEnd: string | null } = {
  games: [], seasonStart: null, seasonEnd: null,
};

// @spec CALWUI-002,CALWUI-004
const game = (gameId: number, scheduledDate: string, overrides: Partial<MockGame> = {}): MockGame => ({
  gameId,
  scheduledDate: `${scheduledDate}T00:00:00.000Z`,
  homeTeamId: 1,
  homeTeamName: 'Team A',
  awayTeamId: 2,
  awayTeamName: 'Team B',
  divisionId: 10,
  divisionName: 'East Division',
  leagueId: 1,
  leagueName: 'Premier League',
  roundLabel: 'Round 1',
  homeTeamResult: null,
  awayTeamResult: null,
  status: 'SCHEDULED',
  ...overrides,
});

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
        currentDate,
        managedTeamId,
        config: { name: 'Test World', inProgress: true },
        Leagues: [],
      });
    }

    if (url.startsWith('/api/team/1/calendar')) {
      return response({
        teamId: 1,
        teamName: 'Team A',
        games: calendarResponse.games,
        seasonStart: calendarResponse.seasonStart,
        seasonEnd: calendarResponse.seasonEnd,
      });
    }

    return response({});
  }) as jest.Mock;
};

const renderGameWorld = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Test World' });
};

beforeEach(() => {
  fetchCalls = [];
  managedTeamId = null;
  currentDate = null;
  calendarResponse = { games: [], seasonStart: null, seasonEnd: null };
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

defineFeature(feature, (test) => {
  test('The home page fetches the calendar for a centered 7-day window', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('GET /api/team/1/calendar is requested with from "2025-06-07" and to "2025-06-13"', async () => {
      await waitFor(() => expect(fetchCalls.some((url) => url.startsWith('/api/team/1/calendar') && url.includes('from=2025-06-07') && url.includes('to=2025-06-13'))).toBe(true));
    });
  });

  test('A returned game is mapped into a day entry keyed by game id and date', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns a game with id 42 scheduled on "2025-06-09"', () => {
      calendarResponse = { games: [game(42, '2025-06-09')], seasonStart: null, seasonEnd: null };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the calendar strip shows an entry for game 42 on "2025-06-09"', async () => {
      const cell = await screen.findByTestId('calendar-day-2025-06-09');
      expect(within(cell).getByTestId('calendar-entry-game-42')).toBeInTheDocument();
    });
  });

  test('Simulate Today is promoted above the calendar strip on the home page', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec CALWUI-009
    then('the Simulate Today banner appears above the calendar strip', async () => {
      const banner = await screen.findByTestId('simulate-today-banner');
      const strip = screen.getByTestId('calendar-strip');
      expect(within(banner).getByTestId('batch-simulate')).toBeEnabled();
      expect(banner.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  test('The current date is visually distinguished in the calendar strip', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    // @spec CALWUI-010
    then('the "2025-06-10" calendar day is highlighted as today', async () => {
      expect(await screen.findByTestId('calendar-day-2025-06-10')).toHaveAttribute('data-today', 'true');
    });
  });

  test('A day with no games still renders as a visibly empty cell', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns no games', () => {
      calendarResponse = { games: [], seasonStart: null, seasonEnd: null };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the calendar strip shows exactly 7 day cells', async () => {
      await screen.findByTestId('calendar-strip');
      expect(screen.getAllByTestId(/^calendar-day-/)).toHaveLength(7);
    });

    and('every day cell is shown empty', () => {
      screen.getAllByTestId(/^calendar-day-/).forEach((cell) => {
        expect(cell.getAttribute('data-entry-count')).toBe('0');
      });
    });
  });

  test('Two games on the same date both appear in that day\'s cell', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns a Premier League game and a League Cup game both scheduled on "2025-06-10"', () => {
      calendarResponse = {
        games: [
          game(101, '2025-06-10', { leagueId: 1, leagueName: 'Premier League' }),
          game(102, '2025-06-10', { leagueId: 2, leagueName: 'League Cup' }),
        ],
        seasonStart: null,
        seasonEnd: null,
      };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the "2025-06-10" day cell shows both games', async () => {
      const cell = await screen.findByTestId('calendar-day-2025-06-10');
      expect(within(cell).getByTestId('calendar-entry-game-101')).toBeInTheDocument();
      expect(within(cell).getByTestId('calendar-entry-game-102')).toBeInTheDocument();
    });
  });

  test('Selecting next shifts the window forward by 7 days and re-fetches', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns season bounds "2025-01-01" to "2025-12-31"', () => {
      calendarResponse = { games: [], seasonStart: '2025-01-01T00:00:00.000Z', seasonEnd: '2025-12-31T00:00:00.000Z' };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);
    and('the player selects next on the calendar strip', async () => {
      const next = await screen.findByTestId('calendar-next');
      fireEvent.click(next);
    });

    then('GET /api/team/1/calendar is requested with from "2025-06-14" and to "2025-06-20"', async () => {
      await waitFor(() => expect(fetchCalls.some((url) => url.startsWith('/api/team/1/calendar') && url.includes('from=2025-06-14') && url.includes('to=2025-06-20'))).toBe(true));
    });
  });

  test('Next is disabled once the window reaches the season end', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns season bounds "2025-01-01" to "2025-06-13"', () => {
      calendarResponse = { games: [], seasonStart: '2025-01-01T00:00:00.000Z', seasonEnd: '2025-06-13T00:00:00.000Z' };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the calendar strip\'s next control is disabled', async () => {
      expect(await screen.findByTestId('calendar-next')).toBeDisabled();
    });
  });

  test('Both navigation controls are disabled when the team has no season bounds', ({ given, and, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    and('GET /api/team/1/calendar returns null season bounds', () => {
      calendarResponse = { games: [], seasonStart: null, seasonEnd: null };
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the calendar strip\'s prev control is disabled', async () => {
      expect(await screen.findByTestId('calendar-prev')).toBeDisabled();
    });

    and('the calendar strip\'s next control is disabled', async () => {
      expect(await screen.findByTestId('calendar-next')).toBeDisabled();
    });
  });

  test('The GameWorld has no currentDate configured', ({ given, when, then, and }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and no currentDate configured', () => {
      managedTeamId = 1;
      currentDate = null;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('no calendar strip is shown', async () => {
      await waitFor(() => expect(screen.queryByTestId('calendar-strip')).toBeNull());
    });

    and('GET /api/team/1/calendar is not requested', () => {
      expect(fetchCalls.some((url) => url.startsWith('/api/team/1/calendar'))).toBe(false);
    });
  });

  test('The old per-league Today section is no longer present', ({ given, when, then, and }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {
      managedTeamId = 1;
      currentDate = '2025-06-10';
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('no "Today" section heading is shown', async () => {
      await screen.findByTestId('calendar-strip');
      expect(screen.queryByText('Today')).toBeNull();
    });

    and('GET /api/league/1/today is not requested', () => {
      expect(fetchCalls.some((url) => url.includes('/api/league/1/today'))).toBe(false);
    });
  });
});
