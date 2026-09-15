// @spec ACTUI-001,ACTUI-002,ACTUI-003,ACTUI-004,ACTUI-005
import path from 'path';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../../../src/ui/routes';
import { render as renderWithRouter } from '../test-utils';
import { ActionItemsPanel, ActionItem } from '../../../src/ui/components/action-items-panel';

const feature = loadFeature(path.resolve(__dirname, '../features/action-items-panel.feature'));

let managedTeamId: number | null = null;
let items: ActionItem[] = [];

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const response = (body: unknown, status = 200) => Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });

    if (url === '/api/gameWorld/1') {
      return response({
        id: 1,
        year: 2025,
        currentDate: null,
        managedTeamId,
        config: { name: 'Test World', inProgress: true },
        Leagues: [],
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
  managedTeamId = null;
  items = [];
  installFetch();
});

afterEach(() => {
  jest.clearAllMocks();
});

defineFeature(feature, (test) => {
  test('The action items panel is mounted below the calendar for a managed club', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1', () => {
      managedTeamId = 1;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the Action Items panel is shown below the calendar section', async () => {
      await screen.findByTestId('action-items-section');
    });
  });

  test('No action items exist yet', ({ given, when, then, and }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has managedTeamId 1', () => {
      managedTeamId = 1;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('the Action Items panel shows a "ready for content" empty state', async () => {
      await screen.findByTestId('action-items-empty');
    });

    and('the empty state does not read as "nothing to do"', () => {
      expect(screen.getByTestId('action-items-empty').textContent).not.toMatch(/nothing to do/i);
    });
  });

  test('Items are sorted by severity, most urgent first', ({ given, when, then, and }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('the Action Items panel is showing a "warning" item "Low squad depth", a "critical" item "Player suspended", and an "info" item "New scouting report" in that order', () => {
      items = [
        { id: 'depth', label: 'Low squad depth', severity: 'warning' },
        { id: 'suspended', label: 'Player suspended', severity: 'critical' },
        { id: 'scouting', label: 'New scouting report', severity: 'info' },
      ];
    });
    when('the panel renders', () => {
      renderWithRouter(<ActionItemsPanel items={items} />);
    });

    then('the items appear in the order "Player suspended", "Low squad depth", "New scouting report"', () => {
      const labels = screen.getAllByTestId(/^action-item-label-/).map((el) => el.textContent);
      expect(labels).toEqual(['Player suspended', 'Low squad depth', 'New scouting report']);
    });

    and('each item\'s severity badge is colored distinctly by severity', () => {
      const criticalColor = screen.getByTestId('action-item-severity-suspended').style.color;
      const warningColor = screen.getByTestId('action-item-severity-depth').style.color;
      const infoColor = screen.getByTestId('action-item-severity-scouting').style.color;
      expect(new Set([criticalColor, warningColor, infoColor]).size).toBe(3);
    });
  });

  test('Items with the same severity keep their given order', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('the Action Items panel is showing a "warning" item "Contract expiring: A" and a "warning" item "Contract expiring: B" in that order', () => {
      items = [
        { id: 'a', label: 'Contract expiring: A', severity: 'warning' },
        { id: 'b', label: 'Contract expiring: B', severity: 'warning' },
      ];
    });
    when('the panel renders', () => {
      renderWithRouter(<ActionItemsPanel items={items} />);
    });

    then('the items appear in the order "Contract expiring: A", "Contract expiring: B"', () => {
      const labels = screen.getAllByTestId(/^action-item-label-/).map((el) => el.textContent);
      expect(labels).toEqual(['Contract expiring: A', 'Contract expiring: B']);
    });
  });

  test('An item with a link renders as an actionable CTA', ({ given, when, then, and }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('the Action Items panel is showing an item "Player suspended" linked to "/1/roster/9" with CTA label "Review"', () => {
      items = [{ id: 'suspended', label: 'Player suspended', severity: 'warning', href: '/1/roster/9', ctaLabel: 'Review' }];
    });
    when('the panel renders', () => {
      renderWithRouter(<ActionItemsPanel items={items} />);
    });

    then('the "Player suspended" item is clickable', () => {
      expect(screen.getByTestId('action-item-suspended').getAttribute('data-clickable')).toBe('true');
    });

    and('it shows "Review" as its call to action', () => {
      expect(screen.getByTestId('action-item-cta-suspended').textContent).toBe('Review');
    });
  });

  test('A linked item with no CTA label falls back to a generic label', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('the Action Items panel is showing an item "Player suspended" linked to "/1/roster/9" with no CTA label', () => {
      items = [{ id: 'suspended', label: 'Player suspended', severity: 'warning', href: '/1/roster/9' }];
    });
    when('the panel renders', () => {
      renderWithRouter(<ActionItemsPanel items={items} />);
    });

    then('it shows "View" as its call to action', () => {
      expect(screen.getByTestId('action-item-cta-suspended').textContent).toBe('View');
    });
  });

  test('An item with no link is not clickable', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('the Action Items panel is showing an item "New scouting report" with no link', () => {
      items = [{ id: 'scouting', label: 'New scouting report', severity: 'info' }];
    });
    when('the panel renders', () => {
      renderWithRouter(<ActionItemsPanel items={items} />);
    });

    then('the "New scouting report" item is not clickable', () => {
      expect(screen.getByTestId('action-item-scouting').getAttribute('data-clickable')).toBe('false');
      expect(screen.queryByTestId('action-item-cta-scouting')).toBeNull();
    });
  });

  test('No managed team is set', ({ given, when, then }) => {
    given('GameWorld 1 exists with an in-progress season and Team A as id 1', () => {});
    given('GameWorld 1 has no managedTeamId set', () => {
      managedTeamId = null;
    });
    when('the GameWorld 1 home page loads', renderGameWorld);

    then('no Action Items panel is shown', async () => {
      await screen.findByRole('heading', { name: 'Test World' });
      expect(screen.queryByTestId('action-items-section')).toBeNull();
    });
  });
});
