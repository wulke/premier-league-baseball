// @spec STDRT-001,STDRT-002,STDRT-003,STDRT-004
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/league-dashboard-routing-ui.feature'));

const league = { id: 1, gameWorldId: 1, config: { name: 'Premier League', type: 'League' }, Divisions: [] };
const gameWorld = { id: 1, year: 2025, currentDate: '2025-04-10', config: { inProgress: true, name: 'World' }, Leagues: [{ id: 1, config: league.config }] };

let fetchCalls: Array<{ method: string; url: string }>;
let todayFails: boolean;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(() => {
  fetchCalls = [];
  todayFails = false;
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    fetchCalls.push({ method, url });
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

    if (/\/api\/gameWorld\/1$/.test(url)) return response(gameWorld);
    if (/\/api\/league\/1\/today$/.test(url)) {
      return todayFails ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) }) : response([]);
    }
    if (/\/api\/league\/1\/standings$/.test(url)) return response([]);
    if (/\/api\/league\/1\/bracket$/.test(url)) return response([]);
    if (/\/api\/league\/1$/.test(url)) return response(league);
    return response({});
  }) as jest.Mock;
});

const openRoute = async (entry: string) => {
  router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Premier League' });
};

const wasRequested = (path: string) => fetchCalls.some(({ method, url }) => method === 'GET' && url.endsWith(path));

defineFeature(feature, (test) => {
  test('The League Dashboard route fetches all four dashboard endpoints', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, () => {});
    and(/^League (\d+) "([^"]+)" exists in GameWorld (\d+)$/, () => {});
    when(/^the player opens "([^"]+)"$/, async (entry: string) => { await openRoute(entry); });
    then('GET /api/league/1 is requested', () => expect(wasRequested('/api/league/1')).toBe(true));
    and('GET /api/league/1/today is requested', () => expect(wasRequested('/api/league/1/today')).toBe(true));
    and('GET /api/league/1/standings is requested', () => expect(wasRequested('/api/league/1/standings')).toBe(true));
    and('GET /api/league/1/bracket is requested', () => expect(wasRequested('/api/league/1/bracket')).toBe(true));
    and('the League Dashboard page renders', () => expect(screen.getByTestId('league-dashboard-page')).toBeInTheDocument());
  });

  test('The League Standings route fetches the unchanged three-endpoint set', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, () => {});
    and(/^League (\d+) "([^"]+)" exists in GameWorld (\d+)$/, () => {});
    when(/^the player opens "([^"]+)"$/, async (entry: string) => { await openRoute(entry); });
    then('GET /api/league/1 is requested', () => expect(wasRequested('/api/league/1')).toBe(true));
    and('GET /api/league/1/standings is requested', () => expect(wasRequested('/api/league/1/standings')).toBe(true));
    and('GET /api/league/1/bracket is requested', () => expect(wasRequested('/api/league/1/bracket')).toBe(true));
    and('GET /api/league/1/today is not requested', () => expect(wasRequested('/api/league/1/today')).toBe(false));
    and('the League Standings page renders', () => expect(screen.getByTestId('league-standings-page')).toBeInTheDocument());
  });

  test('The old league URL renders the Dashboard, not the old full standings body', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, () => {});
    and(/^League (\d+) "([^"]+)" exists in GameWorld (\d+)$/, () => {});
    when(/^the player opens "([^"]+)"$/, async (entry: string) => { await openRoute(entry); });
    then('the League Dashboard page renders', () => expect(screen.getByTestId('league-dashboard-page')).toBeInTheDocument());
    and(/^the app does not navigate to "([^"]+)"$/, (target: string) => expect(router.state.location.pathname).not.toBe(target));
  });

  test('A failed Today fetch does not fail the League Dashboard route', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), year (\d+), currentDate "([^"]+)", and season in progress$/, () => {});
    and(/^League (\d+) "([^"]+)" exists in GameWorld (\d+)$/, () => {});
    given('GET /api/league/1/today returns a server error', () => { todayFails = true; });
    when(/^the player opens "([^"]+)"$/, async (entry: string) => { await openRoute(entry); });
    then('the League Dashboard page renders', () => expect(screen.getByTestId('league-dashboard-page')).toBeInTheDocument());
    and('the League Dashboard shows no Today section', () => expect(screen.queryByTestId('today-section')).toBeNull());
  });
});
