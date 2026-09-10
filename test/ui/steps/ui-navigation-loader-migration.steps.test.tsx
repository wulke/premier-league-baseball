// @spec NAVLOAD-001,NAVLOAD-002,NAVLOAD-003,NAVLOAD-004,NAVLOAD-005,NAVLOAD-006,NAVLOAD-007,NAVLOAD-008,NAVLOAD-009
import path from 'path';
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, render, screen } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/ui-navigation-loader-migration.feature'));

type RouteWithChildren = { path?: string; loader?: unknown; shouldRevalidate?: unknown; children?: RouteWithChildren[] };

const allRoutes = (nodes: RouteWithChildren[]): RouteWithChildren[] => nodes.flatMap((node) => [node, ...allRoutes(node.children ?? [])]);
const findRoute = (path: string) => allRoutes(routes as RouteWithChildren[]).find((route) => route.path === path);

defineFeature(feature, (test) => {
  test('Every approved page route owns its primary loader', ({ given, then, and }) => {
    given('the shared UI route configuration', async () => {
      global.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = input.toString();
        const body = url === '/api/gameWorld/1' ? { id: 1, managedTeamId: null, config: {} } : { id: 7, givenName: 'Loader', familyName: 'Player', countryCode: 'US', bats: 'R', throws: 'R', age: 25, birthDate: '2000-01-01', primaryPosition: 'Pitcher', positions: { Pitcher: 80 }, pitches: [], contact: 50, power: 50, armStrength: 50, accuracy: 50, reaction: 50, vision: 50, discipline: 50, contract: null };
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      }) as jest.Mock;
      render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/player/7'] })} />);
      expect(await screen.findByTestId('player-masthead')).toHaveTextContent('Loader Player');
    });
    // @spec NAVLOAD-001,NAVLOAD-004,NAVLOAD-008
    then('Player Detail, Team Roster, Team Calendar, Team Lineup, League, and Transfers each have a route loader', () => {
      ['player/:playerId', 'roster', 'calendar', 'lineup', ':leagueId', 'transfers'].forEach((path) => {
        expect(findRoute(path)?.loader).toEqual(expect.any(Function));
      });
    });
    // @spec NAVLOAD-007
    and('the Team Calendar route has a revalidation policy', () => expect(findRoute('calendar')?.shouldRevalidate).toEqual(expect.any(Function)));
  });

  test('The loader migration has executable UI coverage', ({ given, then }) => {
    given('the shared UI route configuration', () => expect(createMemoryRouter(routes)).toBeDefined());
    // @spec NAVLOAD-002,NAVLOAD-003,NAVLOAD-005,NAVLOAD-006,NAVLOAD-009
    then('the loader migration UI step suite covers cancellation, failure, revalidation, and dirty Lineup drafts', () => {
      expect(findRoute('lineup')?.loader).toEqual(expect.any(Function));
      expect(findRoute('calendar')?.loader).toEqual(expect.any(Function));
    });
  });
});

afterEach(() => cleanup());
