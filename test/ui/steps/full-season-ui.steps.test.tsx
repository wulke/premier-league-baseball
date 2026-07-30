// @spec:UI-004 @spec:UI-005 @spec:UI-006 @spec:UI-007 @spec:UI-008 @spec:UI-010
import React from 'react';
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '../test-utils';
import { GameWorldProvider } from '../../../src/ui/context/game-world-context';
import { League, TeamCalendar } from '../../../src/ui/pages';

type MockParams = { gwId?: string; leagueId?: string; teamId?: string };

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

type MockLeagueResponse = {
  league: any;
  standings: any[];
  bracket: any[];
};

const mockNavigate = jest.fn();
let mockParams: MockParams = {};

jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
}));

const feature = loadFeature(path.resolve(__dirname, '../features/full-season-ui.feature'));

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
    gameId: 151,
    divisionId: 22,
    divisionName: 'League Cup',
    roundLabel: '1st Round',
    homeTeamId: 7,
    homeTeamName: 'River City',
    awayTeamId: null as unknown as number,
    awayTeamName: 'Team null',
    homeTeamResult: 1,
    awayTeamResult: null,
    scheduledDate: '2025-04-12',
    status: 'COMPLETED',
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

const leagueResponses: Record<string, MockLeagueResponse> = {
  '3': {
    league: {
      id: 3,
      gameWorldId: 1,
      config: { name: 'Premier League', type: 'League' },
      Divisions: [
        {
          id: 11,
          config: { name: 'Premier Division' },
          Teams: [
            { id: 7, config: { name: 'River City' } },
            { id: 9, config: { name: 'Capital City' } },
          ],
        },
        {
          id: 22,
          config: { name: 'League Cup' },
          Teams: [
            { id: 201, config: { name: 'Manchester City' } },
            { id: 202, config: { name: 'Leeds United' } },
            { id: 203, config: { name: 'Chelsea' } },
          ],
        },
      ],
    },
    standings: [
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
          {
            teamId: 9,
            teamName: 'Capital City',
            played: 1,
            won: 0,
            drawn: 0,
            lost: 1,
            runsFor: 2,
            runsAgainst: 5,
            runDifference: -3,
            points: 0,
          },
        ],
      },
    ],
    bracket: [
      {
        divisionId: 11,
        divisionName: 'Premier Division',
        structure: 'ROUND_ROBIN',
        rounds: [],
      },
      {
        divisionId: 22,
        divisionName: 'League Cup',
        structure: 'KNOCKOUT',
        rounds: [
          {
            round: 1,
            label: 'Quarterfinals',
            status: 'COMPLETE',
            ties: [
              {
                kind: 'BYE',
                teamA: { teamId: 203, teamName: 'Chelsea' },
                teamB: null,
                winnerTeamId: 203,
                games: [],
              },
              {
                kind: 'SERIES',
                teamA: { teamId: 201, teamName: 'Manchester City' },
                teamB: { teamId: 202, teamName: 'Leeds United' },
                winnerTeamId: 201,
                games: [
                  {
                    gameId: 401,
                    status: 'COMPLETED',
                    homeTeamId: 201,
                    homeTeamName: 'Manchester City',
                    awayTeamId: 202,
                    awayTeamName: 'Leeds United',
                    homeTeamResult: 2,
                    awayTeamResult: 1,
                  },
                  {
                    gameId: 402,
                    status: 'COMPLETED',
                    homeTeamId: 202,
                    homeTeamName: 'Leeds United',
                    awayTeamId: 201,
                    awayTeamName: 'Manchester City',
                    homeTeamResult: 0,
                    awayTeamResult: 2,
                  },
                ],
              },
            ],
          },
          {
            round: 2,
            label: 'Semifinals',
            status: 'PENDING',
            ties: [
              {
                kind: 'SERIES',
                teamA: { teamId: null, teamName: null },
                teamB: { teamId: null, teamName: null },
                games: [],
              },
            ],
          },
        ],
      },
    ],
  },
  '4': {
    league: {
      id: 4,
      gameWorldId: 1,
      config: { name: 'League Cup Qualifying', type: 'League Cup' },
      Divisions: [
        {
          id: 33,
          config: { name: 'League Cup Qualifying' },
          Teams: [
            { id: 301, config: { name: 'Rovers' } },
            { id: 302, config: { name: 'Wanderers' } },
            { id: 303, config: { name: 'Athletic' } },
            { id: 304, config: { name: 'County' } },
          ],
        },
      ],
    },
    standings: [],
    bracket: [
      {
        divisionId: 33,
        divisionName: 'League Cup Qualifying',
        structure: 'KNOCKOUT',
        rounds: [],
      },
    ],
  },
  '5': {
    league: {
      id: 5,
      gameWorldId: 1,
      config: { name: 'FIXED Cup', type: 'League Cup' },
      Divisions: [
        {
          id: 44,
          config: {
            name: 'Knockout',
            format: { structure: 'KNOCKOUT' },
          },
          Teams: [
            { id: 401, config: { name: 'KO Team 0' } },
            { id: 402, config: { name: 'KO Team 1' } },
          ],
        },
      ],
    },
    standings: [
      {
        divisionId: 44,
        standings: [
          {
            teamId: 401,
            teamName: 'KO Team 0',
            played: 1,
            won: 1,
            drawn: 0,
            lost: 0,
            runsFor: 5,
            runsAgainst: 0,
            runDifference: 5,
            points: 3,
          },
          {
            teamId: 402,
            teamName: 'KO Team 1',
            played: 1,
            won: 0,
            drawn: 0,
            lost: 1,
            runsFor: 0,
            runsAgainst: 5,
            runDifference: -5,
            points: 0,
          },
        ],
      },
    ],
    bracket: [],
  },
};

const gameWorldPayload = {
  id: 1,
  year: 2025,
  currentDate: '2025-04-10',
  config: { inProgress: true, name: 'World One' },
  Leagues: [
    { id: 3, config: { name: 'Premier League', type: 'League' } },
    { id: 4, config: { name: 'League Cup Qualifying', type: 'League Cup' } },
  ],
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

    const leagueMatch = url.match(/\/api\/league\/(\d+)$/);
    if (method === 'GET' && leagueMatch) return response(leagueResponses[leagueMatch[1]]?.league ?? {});

    const standingsMatch = url.match(/\/api\/league\/(\d+)\/standings$/);
    if (method === 'GET' && standingsMatch) return response(leagueResponses[standingsMatch[1]]?.standings ?? []);

    const bracketMatch = url.match(/\/api\/league\/(\d+)\/bracket$/);
    if (method === 'GET' && bracketMatch) return response(leagueResponses[bracketMatch[1]]?.bracket ?? []);

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

const renderLeague = async (leagueId: string) => {
  render(
    <GameWorldProvider gwId="1">
      <League />
    </GameWorldProvider>,
  );
  await screen.findByRole('heading', { name: leagueResponses[leagueId].league.config.name });
};

const getDivisionCard = (leagueId: string, divisionName: string) => {
  const division = leagueResponses[leagueId].league.Divisions.find((entry: any) => entry.config.name === divisionName);
  if (!division) throw new Error(`Unknown division ${divisionName} for league ${leagueId}`);
  return screen.getByTestId(`division-card-${division.id}`);
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
      expect(teamSchedule.map((game) => game.divisionName)).toEqual(
        expect.arrayContaining(['Premier League', 'League Cup']),
      );
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
        expect(
          screen.getByText(new RegExp(competition === 'League Cup' ? 'Forest Town' : 'Capital City', 'i')),
        ).toBeInTheDocument();
      });
    });

    then(/^"([^"]+)" games are hidden$/, (competition: string) => {
      expect(
        screen.queryByText(new RegExp(competition === 'Premier League' ? 'Capital City' : 'Forest Town', 'i')),
      ).toBeNull();
    });
  });

  test('League team navigation uses the GameWorld-scoped calendar route', ({ given, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page has a team named "([^"]+)"$/, async (_teamName: string) => {
      mockParams = { gwId: '1', leagueId: '3' };
      await renderLeague('3');
    });

    when(/^the player clicks team "([^"]+)" from the League page$/, (teamName: string) => {
      fireEvent.click(screen.getByRole('button', { name: teamName }));
    });

    then(/^the app navigates to "([^"]+)"$/, (target: string) => {
      expect(mockNavigate).toHaveBeenCalledWith(target);
    });
  });

  test('Team calendar renders knockout byes as played rows', ({ given, and, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {
      mockParams = { gwId: '1', teamId: '7' };
    });

    and('the team schedule includes a completed knockout bye', () => {
      expect(teamSchedule.some((game) => game.gameId === 151 && game.status === 'COMPLETED')).toBe(true);
    });

    when('the TeamCalendar page loads', async () => {
      await renderCalendar();
    });

    then(/^the calendar shows opponent "([^"]+)"$/, async (label: string) => {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`vs ${label}`, 'i'))).toBeInTheDocument();
      });
    });

    then('the bye row does not show a scoreline', () => {
      expect(screen.queryByTestId('score-151')).toBeNull();
    });

    then(/^the season summary shows "([^"]+)"$/, (summary: string) => {
      expect(screen.getByText(new RegExp(summary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))).toBeInTheDocument();
    });

    when('the player filters the calendar to played games', () => {
      fireEvent.change(screen.getByRole('combobox', { name: /status/i }), {
        target: { value: 'played' },
      });
    });

    then('the knockout bye remains visible', async () => {
      await waitFor(() => {
        expect(screen.getByText(/vs Bye/i)).toBeInTheDocument();
      });
    });
  });

  test('Knockout divisions render a bracket with byes and pending rounds', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      mockParams = { gwId: '1', leagueId };
    });

    when('the League page renders', async () => {
      await renderLeague(mockParams.leagueId!);
    });

    then(/^the "([^"]+)" card still shows the standings table$/, (divisionName: string) => {
      const card = getDivisionCard(mockParams.leagueId!, divisionName);
      expect(within(card).getByRole('columnheader', { name: 'Pos' })).toBeInTheDocument();
      expect(within(card).getByRole('button', { name: 'River City' })).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card shows round "([^"]+)"$/, (divisionName: string, roundLabel: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(roundLabel)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card groups byes under "([^"]+)"$/, (divisionName: string, label: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(label)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card lists bye teams "([^"]+)"$/, (divisionName: string, teams: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(teams)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card shows "([^"]+)"$/, (divisionName: string, text: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(text)).toBeInTheDocument();
    });
  });

  test('Knockout divisions still render the bracket path when bracket data is temporarily unavailable', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      mockParams = { gwId: '1', leagueId };
    });

    when('the League page renders', async () => {
      await renderLeague(mockParams.leagueId!);
    });

    then(/^the "([^"]+)" card shows "([^"]+)"$/, (divisionName: string, text: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(text)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card does not show the standings table$/, (divisionName: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).queryByRole('columnheader', { name: 'Pos' })).toBeNull();
    });
  });

  test('Multi-leg knockout ties expand from series rows to game rows', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      mockParams = { gwId: '1', leagueId };
    });

    when('the League page renders', async () => {
      await renderLeague(mockParams.leagueId!);
    });

    then(/^the "([^"]+)" card shows collapsed series "([^"]+)"$/, (divisionName: string, seriesText: string) => {
      expect(
        within(getDivisionCard(mockParams.leagueId!, divisionName)).getByRole('button', { name: new RegExp(seriesText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }),
      ).toBeInTheDocument();
    });

    when(/^the player expands the "([^"]+)" knockout series$/, (teamName: string) => {
      fireEvent.click(
        within(getDivisionCard(mockParams.leagueId!, 'League Cup')).getByRole('button', { name: new RegExp(teamName, 'i') }),
      );
    });

    then(/^the "([^"]+)" card shows game score "([^"]+)"$/, (divisionName: string, gameLabel: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(gameLabel)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card shows game score "([^"]+)"$/, (divisionName: string, gameLabel: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(gameLabel)).toBeInTheDocument();
    });
  });

  test('Knockout divisions without games show the existing empty state and roster', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      mockParams = { gwId: '1', leagueId };
    });

    when('the League page renders', async () => {
      await renderLeague(mockParams.leagueId!);
    });

    then(/^the "([^"]+)" card shows "([^"]+)"$/, (divisionName: string, text: string) => {
      expect(within(getDivisionCard(mockParams.leagueId!, divisionName)).getByText(text)).toBeInTheDocument();
    });

    and(/^the "([^"]+)" card shows roster teams "([^"]+)"$/, (divisionName: string, teamList: string) => {
      const card = within(getDivisionCard(mockParams.leagueId!, divisionName));
      for (const teamName of teamList.split(', ').map((team) => team.trim())) {
        expect(card.getByRole('button', { name: teamName })).toBeInTheDocument();
      }
    });
  });
});
