// @spec:UI-001 @spec:UI-003 @spec:UI-004 @spec:UI-005 @spec:UI-006 @spec:UI-007 @spec:UI-008 @spec:UI-010 @spec:LIFE-001 @spec:SHB-001 @spec:SHB-002 @spec:SHB-003,RLDRUI-006
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

jest.setTimeout(30000);

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

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let router: ReturnType<typeof createMemoryRouter> | null = null;
let currentLeagueId: string | undefined;

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
  '6': {
    league: {
      id: 6,
      gameWorldId: 1,
      config: { name: 'Premier League', type: 'League' },
      Divisions: [
        {
          id: 61,
          config: { name: 'Premier Division', isTopTier: true },
          Teams: [
            { id: 7, config: { name: 'River City' } },
            { id: 9, config: { name: 'Capital City' } },
          ],
        },
        {
          id: 62,
          config: { name: 'Championship', isTopTier: false },
          Teams: [
            { id: 81, config: { name: 'Hill Town' } },
            { id: 82, config: { name: 'Dockside' } },
          ],
        },
      ],
    },
    standings: [
      {
        divisionId: 61,
        standings: [
          {
            teamId: 7,
            teamName: 'River City',
            played: 38,
            won: 30,
            drawn: 4,
            lost: 4,
            runsFor: 92,
            runsAgainst: 28,
            runDifference: 64,
            points: 94,
          },
          {
            teamId: 9,
            teamName: 'Capital City',
            played: 38,
            won: 28,
            drawn: 3,
            lost: 7,
            runsFor: 87,
            runsAgainst: 34,
            runDifference: 53,
            points: 87,
          },
        ],
      },
    ],
    bracket: [
      {
        divisionId: 61,
        divisionName: 'Premier Division',
        structure: 'ROUND_ROBIN',
        champion: { teamId: 7 },
        rounds: [],
      },
      {
        divisionId: 62,
        divisionName: 'Championship',
        structure: 'ROUND_ROBIN',
        rounds: [],
      },
    ],
  },
  '7': {
    league: {
      id: 7,
      gameWorldId: 1,
      config: { name: 'League Cup', type: 'League Cup' },
      Divisions: [
        {
          id: 71,
          config: { name: 'League Cup', format: { structure: 'KNOCKOUT' } },
          Teams: [
            { id: 201, config: { name: 'Manchester City' } },
            { id: 202, config: { name: 'Leeds United' } },
          ],
        },
      ],
    },
    standings: [],
    bracket: [
      {
        divisionId: 71,
        divisionName: 'League Cup',
        structure: 'KNOCKOUT',
        champion: { teamId: 201 },
        rounds: [
          {
            round: 3,
            label: 'Final',
            status: 'COMPLETE',
            ties: [
              {
                kind: 'SERIES',
                teamA: { teamId: 201, teamName: 'Manchester City' },
                teamB: { teamId: 202, teamName: 'Leeds United' },
                winnerTeamId: 201,
                games: [
                  {
                    gameId: 701,
                    status: 'COMPLETED',
                    homeTeamId: 201,
                    homeTeamName: 'Manchester City',
                    awayTeamId: 202,
                    awayTeamName: 'Leeds United',
                    homeTeamResult: 2,
                    awayTeamResult: 1,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

const baseGameWorldPayload = {
  id: 1,
  year: 2025,
  currentDate: '2025-04-10',
  config: { inProgress: true, name: 'World One' },
  Leagues: [
    { id: 6, config: { name: 'Premier League', type: 'League' } },
    { id: 7, config: { name: 'League Cup', type: 'League Cup' } },
  ],
};

let currentLeagueResponses: Record<string, MockLeagueResponse> = clone(leagueResponses);
let currentGameWorldPayload = clone(baseGameWorldPayload);

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

    if (method === 'GET' && /\/api\/gameWorld\/1$/.test(url)) return response(currentGameWorldPayload);
    if (method === 'GET' && /\/api\/team\/7\/calendar/.test(url)) {
      return response({ teamId: 7, teamName: 'River City', year: 2025, games: teamSchedule });
    }

    const leagueMatch = url.match(/\/api\/league\/(\d+)$/);
    if (method === 'GET' && leagueMatch) return response(currentLeagueResponses[leagueMatch[1]]?.league ?? {});

    const standingsMatch = url.match(/\/api\/league\/(\d+)\/standings$/);
    if (method === 'GET' && standingsMatch) return response(currentLeagueResponses[standingsMatch[1]]?.standings ?? []);

    const bracketMatch = url.match(/\/api\/league\/(\d+)\/bracket$/);
    if (method === 'GET' && bracketMatch) return response(currentLeagueResponses[bracketMatch[1]]?.bracket ?? []);

    return response({});
  }) as jest.Mock;
};

const mountAt = (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
};

const renderCalendar = async () => {
  mountAt('/1/team/7/calendar');
  await screen.findByRole('heading', { name: 'River City' });
};

const renderLeague = async (leagueId: string) => {
  mountAt(`/1/${leagueId}`);
  await screen.findByRole('heading', { name: currentLeagueResponses[leagueId].league.config.name });
};

const renderGameWorld = async () => {
  mountAt('/1');
  await screen.findByRole('heading', { name: currentGameWorldPayload.config.name });
};

const getDivisionCard = (leagueId: string, divisionName: string) => {
  const division = currentLeagueResponses[leagueId].league.Divisions.find((entry: any) => entry.config.name === divisionName);
  if (!division) throw new Error(`Unknown division ${divisionName} for league ${leagueId}`);
  return screen.getByTestId(`division-card-${division.id}`);
};

beforeEach(() => {
  currentLeagueId = undefined;
  router = null;
  fetchCalls = [];
  currentLeagueResponses = clone(leagueResponses);
  currentGameWorldPayload = clone(baseGameWorldPayload);
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

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {});

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

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {});

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

  test('League team navigation opens the team hub', ({ given, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page has a team named "([^"]+)"$/, async (_teamName: string) => {
      await renderLeague('3');
    });

    when(/^the player clicks team "([^"]+)" from the League page$/, (teamName: string) => {
      fireEvent.click(screen.getByRole('button', { name: teamName }));
    });

    then(/^the app navigates to "([^"]+)"$/, async (target: string) => {
      // TeamHub's index route redirects to its calendar tab (replace), so the settled
      // location is one segment deeper than the navigate() call target.
      await waitFor(() => expect(router!.state.location.pathname).toBe(`${target}/calendar`));
    });
  });

  test('Team calendar renders knockout byes as played rows', ({ given, and, when, then }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the player opens the TeamCalendar route "([^"]+)"$/, (_route: string) => {});

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

  test('Decided round-robin leagues show a champion banner and disable simulation', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      currentLeagueId = leagueId;
    });

    when('the League page renders', async () => {
      await renderLeague(currentLeagueId!);
    });

    then(/^the League identity block shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });

    and(/^the League identity block does not show "([^"]+)"$/, (text: string) => {
      expect(screen.queryByText(new RegExp(text, 'i'))).toBeNull();
    });

    when(/^the player clicks team "([^"]+)" from the League page$/, (teamName: string) => {
      fireEvent.click(screen.getByRole('button', { name: teamName }));
    });

    then(/^the app navigates to "([^"]+)"$/, async (target: string) => {
      // TeamHub's index route redirects to its calendar tab (replace), so the settled
      // location is one segment deeper than the navigate() call target.
      await waitFor(() => expect(router!.state.location.pathname).toBe(`${target}/calendar`));
    });
  });

  test('Decided cups show a cup champion banner and disable simulation', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given(/^the League page loads for league "([^"]+)"$/, (leagueId: string) => {
      currentLeagueId = leagueId;
    });

    when('the League page renders', async () => {
      await renderLeague(currentLeagueId!);
    });

    then(/^the League identity block shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeInTheDocument();
    });

    when(/^the player expands the "([^"]+)" knockout series$/, (teamName: string) => {
      fireEvent.click(
        within(getDivisionCard(currentLeagueId!, 'League Cup')).getByRole('button', { name: new RegExp(teamName, 'i') }),
      );
    });

    then(/^the "([^"]+)" card shows game score "([^"]+)"$/, (divisionName: string, gameLabel: string) => {
      expect(within(getDivisionCard(currentLeagueId!, divisionName)).getByText(gameLabel)).toBeInTheDocument();
    });
  });

  test('GameWorld header badge shows an active season in progress', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given('the GameWorld page loads with only the league champion decided', () => {
            currentLeagueResponses['6'].bracket[0].champion = { teamId: 7 };
      delete currentLeagueResponses['7'].bracket[0].champion;
    });

    when('the GameWorld page renders', async () => {
      await renderGameWorld();
    });

    then(/^the Season header badge shows "([^"]+)"$/, async (text: string) => {
      await waitFor(() => {
        expect(screen.getByTestId('season-header-badge')).toHaveTextContent(text);
      });
    });

    and('the GameWorld page does not render the Season card', () => {
      expect(screen.queryByTestId('season-section')).toBeNull();
    });
  });

  test('GameWorld header badge shows a completed season', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {
      /* fetch mock provides the fixture */
    });

    given('the GameWorld page loads with both league champions decided', () => {
            currentLeagueResponses['6'].bracket[0].champion = { teamId: 7 };
      currentLeagueResponses['7'].bracket[0].champion = { teamId: 201 };
    });

    when('the GameWorld page renders', async () => {
      await renderGameWorld();
    });

    then(/^the Season header badge shows "([^"]+)"$/, async (text: string) => {
      await waitFor(() => {
        expect(screen.getByTestId('season-header-badge')).toHaveTextContent(text);
      });
    });

    and('the GameWorld page does not render the Season card', () => {
      expect(screen.queryByTestId('season-section')).toBeNull();
    });
  });

  test('GameWorld header retains the start-season flow when no season is active', ({ given, when, then, and }) => {
    given(/^a GameWorld with id (\d+) exists for the full-season UI$/, () => {});
    given('the GameWorld page has no active season', () => {
      currentGameWorldPayload.config.inProgress = false;
      currentGameWorldPayload.currentDate = null as any;
    });
    when('the GameWorld page renders', async () => { await renderGameWorld(); });
    then(/^the Season header badge shows "([^"]+)"$/, (text: string) => {
      expect(screen.getByTestId('season-header-badge')).toHaveTextContent(text);
    });
    and(/^the header offers "([^"]+)"$/, (text: string) => {
      expect(screen.getByRole('button', { name: text })).toBeInTheDocument();
    });
    when(/^the player confirms starting Season (\d+) from the header$/, (year: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Start Season ${year}` }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    });
    then('the season-start request is submitted for every league', async () => {
      await waitFor(() => {
        expect(fetchCalls.filter(({ method, url }) => method === 'POST' && /\/season\/start$/.test(url))).toHaveLength(2);
      });
    });
  });
});
