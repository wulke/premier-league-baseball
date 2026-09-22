// @spec BADGEUI-001,BADGEUI-002,BADGEUI-003,BADGEUI-005,BADGEUI-006,BADGEUI-007,BADGEUI-008,BADGEUI-009
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';
import { BracketView } from '../../../src/ui/components/bracket-view';

const feature = loadFeature(path.resolve(__dirname, '../features/team-badges-ui.feature'));

type StandingRow = { teamId: number; teamName: string; teamBadge?: string };

let standings: StandingRow[] = [];
let leagueTeams: { id: number; name: string; badge?: string }[] = [];
let calendarFixture: any = null;
let managedCalendarGames: any[] = [];
let managedTeamId: number | null = null;
let currentDate = '2025-06-10';
let fetchCalls: string[] = [];

const buildStanding = (teamId: number, teamName: string, teamBadge?: string) => ({
  teamId,
  teamName,
  teamBadge,
  played: 1, won: 1, drawn: 0, lost: 0, runsFor: 3, runsAgainst: 1, runDifference: 2, points: 3,
});

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    fetchCalls.push(url);
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    if (/\/api\/gameWorld\/1$/.test(url)) {
      return response({
        id: 1,
        year: 2025,
        currentDate,
        managedTeamId,
        config: { name: 'Test World', inProgress: true },
        Leagues: [
          { id: 1, config: { name: 'National League' } },
          { id: 2, config: { name: 'American League' } },
        ],
      });
    }
    if (/\/api\/team\/1\/calendar/.test(url)) {
      return response({ teamId: 1, teamName: 'Team A', games: managedCalendarGames, seasonStart: null, seasonEnd: null });
    }
    if (/\/api\/league\/1\/standings$/.test(url)) {
      return response(standings.length > 0 ? [{ divisionId: 11, divisionName: 'Division One', standings }] : []);
    }
    if (/\/api\/league\/1\/bracket$/.test(url)) return response([]);
    if (/\/api\/league\/1$/.test(url)) {
      return response({
        id: 1,
        gameWorldId: 1,
        config: { name: 'Test League', type: 'League' },
        Divisions: [
          { id: 11, config: { name: 'Division One' }, Teams: leagueTeams.map((t) => ({ id: t.id, config: { name: t.name, badge: t.badge } })) },
        ],
      });
    }
    if (/\/api\/team\/7\/calendar/.test(url)) return response(calendarFixture);

    return response({});
  }) as jest.Mock;
};

const renderLeague = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Test League' });
};

const renderTeamCalendar = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1/team/7/calendar'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: calendarFixture.teamName });
};

const renderGameWorld = async () => {
  const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Test World' });
};

const findStandingsRow = async (teamName: string) => {
  const nameEl = await screen.findByText(teamName);
  return nameEl.closest('tr') as HTMLElement;
};

beforeEach(() => {
  standings = [];
  leagueTeams = [];
  calendarFixture = null;
  managedCalendarGames = [];
  managedTeamId = null;
  currentDate = '2025-06-10';
  fetchCalls = [];
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

defineFeature(feature, (test) => {
  test('A team with no badge shows text initials, no image attempted', ({ given, when, then, and }) => {
    given(/^GET \/api\/league\/1\/standings returns a team named "([^"]+)" with no badge$/, (name: string) => {
      standings = [buildStanding(21, name)];
    });
    when('the League page renders', renderLeague);
    // @spec BADGEUI-002
    then(/^the "([^"]+)" row shows text initials "([^"]+)"$/, async (name: string, initials: string) => {
      const row = await findStandingsRow(name);
      expect(within(row).getByTestId('standings-team-badge-21')).toHaveTextContent(initials);
    });
    // @spec BADGEUI-002
    and(/^no crest image is requested for "([^"]+)"$/, () => {
      const row = screen.getByTestId('standings-team-badge-21');
      expect(row.tagName).not.toBe('IMG');
    });
  });

  test('A team\'s crest image fails to load and falls back to text initials', ({ given, when, and, then }) => {
    given(/^GET \/api\/league\/1\/standings returns a team named "([^"]+)" with badge "([^"]+)"$/, (name: string, badge: string) => {
      standings = [buildStanding(7, name, badge)];
    });
    when('the League page renders', renderLeague);
    // @spec BADGEUI-001
    and(/^the "([^"]+)" crest image fails to load$/, () => {
      fireEvent.error(screen.getByTestId('standings-team-badge-7'));
    });
    // @spec BADGEUI-001
    then(/^the "([^"]+)" row shows text initials "([^"]+)"$/, async (_name: string, initials: string) => {
      await waitFor(() => expect(screen.getByTestId('standings-team-badge-7')).toHaveTextContent(initials));
    });
  });

  test('A knockout bye slot\'s initials render the same as any name-only team', ({ given, and, when, then }) => {
    given(/^GameWorld 1 has managedTeamId (\d+) and currentDate "([^"]+)"$/, (teamId: string, date: string) => {
      managedTeamId = Number(teamId);
      currentDate = date;
    });
    // @spec BADGEUI-003
    and('GET /api/team/1/calendar returns a completed knockout bye game', () => {
      managedCalendarGames = [{
        gameId: 501, year: 2025, scheduledDate: '2025-05-01T00:00:00.000Z',
        homeTeamId: 7, homeTeamName: 'River City', homeTeamBadge: undefined,
        awayTeamId: null, awayTeamName: 'Bye', awayTeamBadge: null,
        divisionId: 22, divisionName: 'League Cup', leagueId: 1, leagueName: 'National League', roundLabel: '1st Round',
        homeTeamResult: 1, awayTeamResult: null, status: 'COMPLETED',
      }];
    });
    when('the GameWorld 1 home page loads', renderGameWorld);
    // @spec BADGEUI-003
    then(/^the bye entry shows text initials "([^"]+)"$/, async (initials: string) => {
      expect(await screen.findByTestId('calendar-entry-badge-501-away')).toHaveTextContent(initials);
    });
  });

  test('A standings row renders the team\'s crest alongside its name', ({ given, when, then, and }) => {
    given(/^GET \/api\/league\/1\/standings returns a team named "([^"]+)" with badge "([^"]+)"$/, (name: string, badge: string) => {
      standings = [buildStanding(7, name, badge)];
    });
    when('the League page renders', renderLeague);
    // @spec BADGEUI-006
    then(/^the "([^"]+)" row shows a crest image with src "([^"]+)"$/, async (_name: string, src: string) => {
      const img = await screen.findByTestId('standings-team-badge-7');
      expect(img).toHaveAttribute('src', src);
    });
    // @spec BADGEUI-005
    and(/^the "([^"]+)" row shows the team name "([^"]+)"$/, (name: string) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  test('A division\'s team-list grid renders each team\'s crest from its raw config', ({ given, when, then }) => {
    given(/^the League page has a team named "([^"]+)" with badge "([^"]+)"$/, (name: string, badge: string) => {
      leagueTeams = [{ id: 7, name, badge }];
    });
    when('the League page renders', renderLeague);
    // @spec BADGEUI-007
    then(/^the team grid shows a crest image with src "([^"]+)" for "([^"]+)"$/, async (src: string) => {
      const img = await screen.findByTestId('team-grid-badge-7');
      expect(img).toHaveAttribute('src', src);
    });
  });

  test('The team-calendar page header renders the team\'s crest', ({ given, and, when, then }) => {
    given(/^the player opens the TeamCalendar route "([^"]+)"$/, () => {});
    and(/^GET \/api\/team\/7\/calendar returns a schedule for team "([^"]+)" with badge "([^"]+)"$/, (name: string, badge: string) => {
      calendarFixture = { teamId: 7, teamName: name, teamBadge: badge, games: [] };
    });
    when('the TeamCalendar page loads', renderTeamCalendar);
    // @spec BADGEUI-008
    then(/^the page header shows a crest image with src "([^"]+)"$/, async (src: string) => {
      const img = await screen.findByTestId('team-calendar-badge');
      expect(img).toHaveAttribute('src', src);
    });
    // @spec BADGEUI-005
    and(/^the page header shows the team name "([^"]+)"$/, (name: string) => {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    });
  });

  test('A calendar strip entry renders each team\'s crest when one is available', ({ given, and, when, then }) => {
    given(/^GameWorld 1 has managedTeamId (\d+) and currentDate "([^"]+)"$/, (teamId: string, date: string) => {
      managedTeamId = Number(teamId);
      currentDate = date;
    });
    and(/^GET \/api\/team\/1\/calendar returns a completed game between "([^"]+)" \(badge "([^"]+)"\) and "([^"]+)" \(badge "([^"]+)"\)$/,
      (homeName: string, homeBadge: string, awayName: string, awayBadge: string) => {
        managedCalendarGames = [{
          gameId: 601, year: 2025, scheduledDate: '2025-06-10T00:00:00.000Z',
          homeTeamId: 1, homeTeamName: homeName, homeTeamBadge: homeBadge,
          awayTeamId: 2, awayTeamName: awayName, awayTeamBadge: awayBadge,
          divisionId: 11, divisionName: 'Division One', leagueId: 1, leagueName: 'National League', roundLabel: 'Round 1',
          homeTeamResult: 2, awayTeamResult: 1, status: 'COMPLETED',
        }];
      });
    when('the GameWorld 1 home page loads', renderGameWorld);
    // @spec BADGEUI-009
    then(/^the calendar entry shows a crest image with src "([^"]+)" for "([^"]+)"$/, async (src: string) => {
      const img = await screen.findByTestId('calendar-entry-badge-601-home');
      expect(img).toHaveAttribute('src', src);
    });
    // @spec BADGEUI-009
    and(/^the calendar entry shows a crest image with src "([^"]+)" for "([^"]+)"$/, async (src: string) => {
      const img = screen.getByTestId('calendar-entry-badge-601-away');
      expect(img).toHaveAttribute('src', src);
    });
  });

  test('Team names outside standings render a crest from their supplied badge', ({ given, when, then }) => {
    given('a bracket, schedule, pre-game prep view, box score, and action item receive a team badge', () => {});
    when('each team identity renders', () => {
      render(<BracketView teams={[]} onTeamClick={() => {}} rounds={[{ round: 1, label: 'Final', status: 'IN_PROGRESS', ties: [{ kind: 'SERIES', teamA: { teamId: 1, teamName: 'Arsenal', teamBadge: '/badges/arsenal.png' }, teamB: { teamId: 2, teamName: 'Chelsea', teamBadge: '/badges/chelsea.png' }, games: [] }] }]} />);
    });
    // @spec BADGEUI-010
    then('each identity shows the supplied crest alongside its team name', () => {
      expect(screen.getByTestId('bracket-team-badge-1')).toHaveAttribute('src', '/badges/arsenal.png');
      expect(screen.getByTestId('bracket-team-badge-2')).toHaveAttribute('src', '/badges/chelsea.png');
    });
  });
});
