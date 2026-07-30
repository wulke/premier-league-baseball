// @spec:UI-004 (full-season UI acceptance for unified TeamCalendar routing).
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '../test-utils';
import { GameWorldProvider } from '../../../src/ui/context/game-world-context';
import { League, TeamCalendar } from '../../../src/ui/pages';

type MockParams = { gwId?: string; leagueId?: string; teamId?: string };

const mockNavigate = jest.fn();
let mockParams: MockParams = {};

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
}));

const feature = loadFeature(path.resolve(__dirname, '../features/full-season-ui.feature'));

type MockGame = {
  gameId: number;
  divisionId: number;
  divisionName: string;
  roundLabel: string | null;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeTeamResult: number | null;
  awayTeamResult: number | null;
  scheduledDate: string | null;
  status: string;
};

const teamSchedule: MockGame[] = [
  {
    gameId: 101,
    divisionId: 11,
    divisionName: 'Premier League',
    roundLabel: 'Matchday 1',
    homeTeamId: 7,
    homeTeamName: 'River City',
    awayTeamId: 9,
    awayTeamName: 'Capital City',
    homeTeamResult: null,
    awayTeamResult: null,
    scheduledDate: '2025-04-10',
    status: 'SCHEDULED',
  },
  {
    gameId: 202,
    divisionId: 22,
    divisionName: 'League Cup',
    roundLabel: 'Quarterfinal',
    homeTeamId: 4,
    homeTeamName: 'Forest Town',
    awayTeamId: 7,
    awayTeamName: 'River City',
    homeTeamResult: null,
    awayTeamResult: null,
    scheduledDate: '2025-04-14',
    status: 'SCHEDULED',
  },
];

const leaguePayload = {
  id: 3,
  gameWorldId: 1,
  config: { name: 'Premier League', type: 'League' },
  Divisions: [
    {
      id: 11,
      config: { name: 'Premier League' },
      Teams: [{ id: 7, config: { name: 'River City' } }],
    },
  ],
};

const standingsPayload = [
  {
    divisionId: 11,
    standings: [
      {
        teamId: 7,
        teamName: 'River City',
        played: 1,
        won: 1,
        drawn: 0,
        lost: 0,
        runsFor: 5,
        runsAgainst: 2,
        runDifference: 3,
        points: 3,
      },
    ],
  },
];

const gameWorldPayload = {
  id: 1,
  year: 2025,
  currentDate: '2025-04-10',
  config: { inProgress: true, name: 'World One' },
  Leagues: [{ id: 3, config: { name: 'Premier League', type: 'League' } }],
};

let fetchCalls: Array<{ method: string; url: string }> = [];

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    fetchCalls.push({ method, url });

    const response = (body: unknown) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      });

    if (method === 'GET' && /\/api\/gameWorld\/1$/.test(url)) return response(gameWorldPayload);
    if (method === 'GET' && /\/api\/team\/7\/calendar/.test(url)) {
      return response({ teamId: 7, teamName: 'River City', year: 2025, games: teamSchedule });
    }
    if (method === 'GET' && /\/api\/league\/3$/.test(url)) return response(leaguePayload);
    if (method === 'GET' && /\/api\/league\/3\/standings$/.test(url)) return response(standingsPayload);
    return response({});
  }) as jest.Mock;
};

const renderCalendar = async () => {
  render(
    <GameWorldProvider gwId="1">
      <TeamCalendar />
    </GameWorldProvider>,
  );
  await screen.findByRole('heading', { name: 'River City' });
};

const renderLeague = async () => {
  render(
    <GameWorldProvider gwId="1">
      <League />
    </GameWorldProvider>,
  );
  await screen.findByRole('button', { name: 'River City' });
};

beforeEach(() => {
  mockNavigate.mockReset();
  mockParams = {};
  fetchCalls = [];
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

defineFeature(feature, (test) => {
  test('Team calendar loads a combined schedule from the GameWorld route', ({ given, and, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {
      mockParams = { gwId: '1', teamId: '7' };
    });

    and('the team schedule includes games from the League and League Cup', () => {
      expect(teamSchedule.map((game) => game.divisionName)).toEqual(
        expect.arrayContaining(['Premier League', 'League Cup']),
      );
    });

    when('the TeamCalendar page loads', async () => {
      await renderCalendar();
    });

    then(/^GET \/api\/team\/7\/calendar is requested with query "([^"]+)"$/, async (query: string) => {
      await waitFor(() => {
        expect(fetchCalls.some(({ method, url }) => method === 'GET' && url.endsWith(`/api/team/7/calendar?${query}`))).toBe(true);
      });
    });

    then(/^the back-link points to "([^"]+)"$/, (target: string) => {
      expect(screen.getByRole('link', { name: /game world/i })).toHaveAttribute('href', target);
    });

    then(/^the Competition filter lists "([^"]+)" and "([^"]+)"$/, (first: string, second: string) => {
      const filter = screen.getByRole('combobox', { name: /competition/i });
      const options = within(filter).getAllByRole('option').map((option) => option.textContent);
      expect(options).toEqual(expect.arrayContaining(['All', first, second]));
    });
  });

  test('Competition filter narrows the combined schedule by division', ({ given, and, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {
      mockParams = { gwId: '1', teamId: '7' };
    });

    and('the team schedule includes games from the League and League Cup', () => {
      expect(teamSchedule).toHaveLength(2);
    });

    when('the TeamCalendar page loads', async () => {
      await renderCalendar();
    });

    when(/^the player filters the calendar to "([^"]+)"$/, (competition: string) => {
      fireEvent.change(screen.getByRole('combobox', { name: /competition/i }), {
        target: { value: competition === 'League Cup' ? '22' : '11' },
      });
    });

    then(/^only "([^"]+)" games are shown$/, async (competition: string) => {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(competition, 'i'))).toBeInTheDocument();
      });
    });

    then(/^"([^"]+)" games are hidden$/, (competition: string) => {
      expect(screen.queryByText(new RegExp(competition, 'i'))).toBeNull();
    });
  });

  test('League team navigation uses the GameWorld-scoped calendar route', ({ given, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page has a team named "([^"]+)"$/, async (_teamName: string) => {
      mockParams = { gwId: '1', leagueId: '3' };
      await renderLeague();
    });

    when(/^the player clicks team "([^"]+)" from the League page$/, (teamName: string) => {
      fireEvent.click(screen.getByRole('button', { name: teamName }));
    });

    then(/^the app navigates to "([^"]+)"$/, (target: string) => {
      expect(mockNavigate).toHaveBeenCalledWith(target);
    });
  });
});
