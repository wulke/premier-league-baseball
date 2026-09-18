// @spec GWHOME-001,GWHOME-002,GWHOME-003
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen } from '@testing-library/react';
import routes from '../../../src/ui/routes';
import { installEventSource } from '../test-utils';

const feature = loadFeature(path.resolve(__dirname, '../features/game-world-home-layout.feature'));

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
        managedTeamId: 10,
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
  installFetch();
  installEventSource();
});

defineFeature(feature, (test) => {
  test('Recent Activity follows the manager content while competitions remain in the rail', ({ given, when, then, and }) => {
    given('GameWorld 1 has a managed club, a current date, and Premier League competition 7', () => {});
    when('the player opens the GameWorld 1 home page', async () => {
      const router = createMemoryRouter(routes, { initialEntries: ['/1'] });
      render(<RouterProvider router={router} />);
      await screen.findByTestId('calendar-section');
    });
    // @spec GWHOME-002
    then('the page shows Recent Activity below the calendar and Action Items sections', async () => {
      const calendar = screen.getByTestId('calendar-section');
      const actionItems = await screen.findByTestId('action-items-section');
      const activity = await screen.findByTestId('recent-activity-section');
      expect(calendar.compareDocumentPosition(actionItems) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(actionItems.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(activity).toHaveTextContent('Recent Activity');
      expect(activity).toContainElement(screen.getByTestId('notification-stream'));
    });
    // @spec GWHOME-001
    and('the page does not show a Leagues card section', () => {
      expect(screen.queryByText('Leagues', { exact: true })).toBeNull();
    });
    // @spec GWHOME-003
    and('the COMPETITIONS rail shows a link to Premier League', () => {
      expect(screen.getByTestId('nav-competitions')).toContainElement(screen.getByTestId('nav-league-7'));
      expect(screen.getByTestId('nav-league-7')).toHaveTextContent('Premier League');
    });
  });
});
