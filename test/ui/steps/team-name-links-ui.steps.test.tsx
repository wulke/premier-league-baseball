// @spec TEAMLINK-001,TEAMLINK-002,TEAMLINK-003,TEAMLINK-004,TEAMLINK-005,TEAMLINK-006
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/team-name-links-ui.feature'));

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const expectLinksToTeam = (container: HTMLElement, teamName: string, gwId: number, teamId: number) => {
  const link = within(container).getByText(teamName).closest('a');
  expect(link).not.toBeNull();
  expect(link).toHaveAttribute('href', `/${gwId}/team/${teamId}`);
};

afterEach(cleanup);

defineFeature(feature, (test) => {
  test("A calendar strip game entry's team names link to their Team View pages", ({ given, and, when, then }) => {
    given('GameWorld 1 has managedTeamId 1 and currentDate "2025-06-10"', () => {});
    and('GET /api/team/1/calendar returns a game with id 42 between Team A and Team B', () => {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        if (/\/api\/gameWorld\/1$/.test(url)) {
          return jsonResponse({ id: 1, year: 2025, currentDate: '2025-06-10', managedTeamId: 1, config: { name: 'Test World', inProgress: true }, Leagues: [] });
        }
        if (/\/api\/team\/1\/calendar/.test(url)) {
          return jsonResponse({
            teamId: 1,
            teamName: 'Team A',
            games: [{
              gameId: 42, scheduledDate: '2025-06-10T00:00:00.000Z',
              homeTeamId: 1, homeTeamName: 'Team A', awayTeamId: 2, awayTeamName: 'Team B',
              divisionId: 10, divisionName: 'East Division', leagueId: 1, leagueName: 'Premier League',
              roundLabel: null, homeTeamResult: null, awayTeamResult: null, status: 'SCHEDULED',
            }],
            seasonStart: null, seasonEnd: null,
          });
        }
        return jsonResponse({});
      }) as jest.Mock;
    });
    when('the GameWorld 1 home page loads', async () => {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1'] })} />);
      await screen.findByRole('heading', { name: 'Test World' });
    });
    then("the calendar entry for game 42 links \"Team A\" to team 1's page", async () => {
      const entry = await screen.findByTestId('calendar-entry-game-42');
      expectLinksToTeam(entry, 'Team A', 1, 1);
    });
    and("the calendar entry for game 42 links \"Team B\" to team 2's page", () => {
      const entry = screen.getByTestId('calendar-entry-game-42');
      expectLinksToTeam(entry, 'Team B', 1, 2);
    });
  });

  test("A game box score's team headers link to their Team View pages", ({ given, when, then, and }) => {
    given("GET /api/game/42 returns a completed box score between Home Club and Away Club", () => {
      const boxScore = {
        id: 42,
        home: { teamId: 10, teamName: 'Home Club', score: 7, players: [] },
        away: { teamId: 20, teamName: 'Away Club', score: 3, players: [] },
      };
      global.fetch = jest.fn((input: RequestInfo | URL) => jsonResponse(
        input.toString() === '/api/gameWorld/1' ? { id: 1, config: {} } : boxScore,
      )) as jest.Mock;
    });
    when('the user navigates to the game box score route', async () => {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/game/42'] })} />);
      await screen.findByTestId('game-box-score');
    });
    then('the box score links "Home Club" to its Team View page', () => {
      expectLinksToTeam(screen.getByTestId('game-box-score'), 'Home Club', 1, 10);
    });
    and('the box score links "Away Club" to its Team View page', () => {
      expectLinksToTeam(screen.getByTestId('game-box-score'), 'Away Club', 1, 20);
    });
  });

  test("Pre-game prep's matchup header and opponent panel link to the Team View page", ({ given, when, then, and }) => {
    given('a managed club has a scheduled game and game lineup snapshot', () => {
      const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];
      const player = (id: number, pitcher = false) => ({ id, givenName: pitcher ? 'Ace' : 'Player', familyName: String(id), primaryPosition: pitcher ? 'Pitcher' : 'Shortstop', positions: Object.fromEntries(positions.map((position) => [position, 70])) });
      global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input); const method = init?.method ?? 'GET';
        if (/gameWorld\/1$/.test(url)) return jsonResponse({ id: 1, managedTeamId: 10, currentDate: '2025-04-05' });
        if (/team\/10\/calendar/.test(url)) return jsonResponse({ games: [{ gameId: 40, scheduledDate: '2025-04-05T00:00:00.000Z', homeTeamId: 10, homeTeamName: 'Mariners', awayTeamId: 11, awayTeamName: 'Rivertown', leagueId: 5, status: 'SCHEDULED', homeTeamResult: null, awayTeamResult: null }] });
        if (/team\/10\/lineup/.test(url)) return jsonResponse({ starters: [], startingPitcherId: null, bench: [], bullpen: [] });
        if (/team\/10\/roster/.test(url)) return jsonResponse([player(1), player(2, true)]);
        if (/team\/11\/roster/.test(url)) return jsonResponse([player(30, true)]);
        if (/league\/5\/standings/.test(url)) return jsonResponse([{ teamId: 11, won: 8, lost: 4, drawn: 0 }]);
        if (/game\/40\/simulate/.test(url) && method === 'POST') return jsonResponse({ homeTeamResult: 5, awayTeamResult: 2 });
        return jsonResponse({});
      }) as jest.Mock;
    });
    when("the manager opens that game's pre-game route", async () => {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/5/game/40'] })} />);
      await screen.findAllByText('Rivertown');
    });
    then('the pre-game header links "Rivertown" to its Team View page', () => {
      const header = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
      expectLinksToTeam(header, 'Rivertown', 1, 11);
    });
    and('the opponent panel links "Rivertown" to its Team View page', () => {
      const panel = screen.getByRole('region', { name: 'Opponent context' });
      expectLinksToTeam(panel, 'Rivertown', 1, 11);
    });
  });

  test("A team calendar row's opponent name links to its Team View page", ({ given, when, then }) => {
    given('a team calendar with a scheduled game against Rivertown', () => {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        if (/\/api\/gameWorld\/1$/.test(url)) return jsonResponse({ id: 1, config: { name: 'Test World' }, managedTeamId: null, currentDate: null });
        if (/\/api\/team\/7\/calendar/.test(url)) {
          return jsonResponse({
            teamId: 7, teamName: 'Team G',
            games: [{
              gameId: 90, scheduledDate: '2025-05-01T00:00:00.000Z',
              homeTeamId: 7, homeTeamName: 'Team G', awayTeamId: 11, awayTeamName: 'Rivertown',
              divisionId: 1, divisionName: 'Division One', leagueId: 1, leagueName: 'Premier League',
              roundLabel: null, homeTeamResult: null, awayTeamResult: null, status: 'SCHEDULED',
            }],
            seasonStart: null, seasonEnd: null,
          });
        }
        return jsonResponse({});
      }) as jest.Mock;
    });
    when("the player opens that team's calendar", async () => {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/team/7/calendar'] })} />);
      await screen.findByText(/Rivertown/);
    });
    then('the schedule row links "Rivertown" to its Team View page', () => {
      expectLinksToTeam(document.body, 'Rivertown', 1, 11);
    });
  });

  test('A bye row in a team calendar has no opponent link', ({ given, when, then }) => {
    given('a team calendar with a bye row', () => {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        if (/\/api\/gameWorld\/1$/.test(url)) return jsonResponse({ id: 1, config: { name: 'Test World' }, managedTeamId: null, currentDate: null });
        if (/\/api\/team\/7\/calendar/.test(url)) {
          return jsonResponse({
            teamId: 7, teamName: 'Team G',
            games: [{
              gameId: 91, scheduledDate: '2025-05-08T00:00:00.000Z',
              homeTeamId: 7, homeTeamName: 'Team G', awayTeamId: null, awayTeamName: 'Bye',
              divisionId: 1, divisionName: 'Division One', leagueId: 1, leagueName: 'Premier League',
              roundLabel: null, homeTeamResult: null, awayTeamResult: null, status: 'SCHEDULED',
            }],
            seasonStart: null, seasonEnd: null,
          });
        }
        return jsonResponse({});
      }) as jest.Mock;
    });
    when("the player opens that team's calendar", async () => {
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/team/7/calendar'] })} />);
      await screen.findByText(/Bye/);
    });
    then('the schedule row shows "Bye" with no team link', () => {
      const byeText = screen.getByText(/Bye/);
      expect(byeText.closest('a')).toBeNull();
    });
  });
});
