// @spec UNCLMUI-001,UNCLMUI-002,UNCLMUI-003
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen } from '@testing-library/react';
import routes from '../../../src/ui/routes';
import { installEventSource } from '../test-utils';

const feature = loadFeature(path.resolve(__dirname, '../features/unclaimed-team-home-ui.feature'));

let managedTeamId: number | null = null;

const response = (body: unknown) => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(body),
});

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    if (url === '/api/gameWorld/1') {
      return response({
        id: 1,
        year: 2025,
        currentDate: '2025-06-10',
        managedTeamId,
        config: { name: 'Test World', inProgress: true },
        Leagues: [{ id: 7, config: { name: 'Premier League', type: 'League' } }],
      });
    }
    if (url === '/api/gameWorld/1/notifications') return response([]);
    if (url.startsWith('/api/team/10/calendar?')) return response({ games: [], seasonStart: null, seasonEnd: null });
    if (url === '/api/league/7' || url === '/api/league/7/bracket') return response({});
    return response({});
  }) as jest.Mock;
};

beforeEach(() => {
  managedTeamId = null;
  installFetch();
  installEventSource();
});

defineFeature(feature, (test) => {
  test('An unclaimed world directs the player to choose a team', ({ given, when, then, and }) => {
    given('GameWorld 1 has no managed team and Premier League competition 7', () => {
      managedTeamId = null;
    });
    when('the player opens the GameWorld 1 home page', async () => {
      const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
      render(<RouterProvider router={router} />);
      await screen.findByRole('heading', { name: 'Test World' });
    });
    // @spec UNCLMUI-001
    then('one claim-a-team prompt is shown instead of the Calendar and Action Items sections', () => {
      expect(screen.getAllByTestId('claim-team-prompt')).toHaveLength(1);
      expect(screen.getByTestId('claim-team-prompt')).toHaveTextContent(/claim a team to get started/i);
      expect(screen.queryByTestId('calendar-section')).toBeNull();
      expect(screen.queryByTestId('action-items-section')).toBeNull();
    });
    // @spec UNCLMUI-002
    and("the prompt links to Premier League's team list for the existing Job Market claim flow", () => {
      expect(screen.getByTestId('claim-team-link')).toHaveAttribute('href', '/1/7');
    });
  });

  test('A claimed world retains the manager home layout', ({ given, when, then, and }) => {
    given('GameWorld 1 has managed team 10 and Premier League competition 7', () => {
      managedTeamId = 10;
    });
    when('the player opens the GameWorld 1 home page', async () => {
      const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
      render(<RouterProvider router={router} />);
      await screen.findByTestId('calendar-section');
    });
    // @spec UNCLMUI-003
    then('the claim-a-team prompt is not shown', () => {
      expect(screen.queryByTestId('claim-team-prompt')).toBeNull();
    });
    // @spec UNCLMUI-003
    and('the Calendar and Action Items sections are shown', async () => {
      expect(screen.getByTestId('calendar-section')).toBeInTheDocument();
      expect(await screen.findByTestId('action-items-section')).toBeInTheDocument();
    });
  });
});
