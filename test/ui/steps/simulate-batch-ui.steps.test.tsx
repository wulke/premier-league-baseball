import React from 'react';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { screen, fireEvent, act } from '@testing-library/react';
import { render, mockFetch } from '../test-utils';
import { GameWorld as GameWorldPage } from '../../../src/ui/pages/game-world';
import { GameWorldProvider } from '../../../src/ui/context/game-world-context';
import path from 'path';

// Mock react-router to provide gwId
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: () => ({ gwId: '1' }),
  useNavigate: () => jest.fn(),
}));

const feature = loadFeature(path.resolve(__dirname, '../features/simulate-batch-ui.feature'));

defineFeature(feature, (test) => {
  const mockGwId = 1;
  const mockDate = "2025-04-10";

  test('Successful batch simulation from GameWorld page', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), currentDate "([^"]+)", and inProgress (true|false)$/, async (id, date, inProgress) => {
      mockFetch({
        id: Number(id),
        currentDate: date,
        config: { inProgress: inProgress === 'true' },
        year: 2025,
        Leagues: []
      });
    });

    and('the page header is visible', () => {
      // Logic for verifying header presence
    });

    given(/^I am on the GameWorld page for id (\d+)$/, async (id) => {
      await act(async () => {
        render(
          <GameWorldProvider gwId={id}>
            <GameWorldPage />
          </GameWorldProvider>
        );
      });
    });

    and('I see the "Simulate Today" action in the AppHeader', async () => {
      expect(await screen.findByTestId('app-header')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /simulate today/i })).toBeInTheDocument();
    });

    when('I click the "Simulate Today" button', async () => {
      // Mock the batch simulate API call for success
      mockFetch({ simulated: [1, 2, 3], skipped: [] });
      const btn = screen.getByRole('button', { name: /simulate today/i });
      await act(async () => {
        fireEvent.click(btn);
      });
    });

    and(/^eventually I should see a success summary "([^"]+)"$/, async (summary) => {
      expect(await screen.findByText(new RegExp(summary, 'i'))).toBeInTheDocument();
    });
  });

  test('Batch simulation fails and shows error', ({ given, and, when, then }) => {
    given(/^a GameWorld exists with id (\d+), currentDate "([^"]+)", and inProgress (true|false)$/, async (id, date, inProgress) => {
      mockFetch({
        id: Number(id),
        currentDate: date,
        config: { inProgress: inProgress === 'true' },
        year: 2025,
        Leagues: []
      });
    });

    and('the page header is visible', () => {});

    given(/^I am on the GameWorld page for id (\d+)$/, async (id) => {
      await act(async () => {
        render(
          <GameWorldProvider gwId={id}>
            <GameWorldPage />
          </GameWorldProvider>
        );
      });
    });

    and('the batch simulation will fail with a 500 error', () => {
      // This will be used in the next 'when' step
    });

    when('I click the "Simulate Today" button', async () => {
      // Mock failure
      mockFetch({ error: 'Internal server error' }, 500);
      const btn = screen.getByRole('button', { name: /simulate today/i });
      await act(async () => {
        fireEvent.click(btn);
      });
    });

    then(/^I should see an error message "([^"]+)"$/, async (msg) => {
      expect(await screen.findByText(new RegExp(msg, 'i'))).toBeInTheDocument();
    });

    and(/^I should see a "([^"]+)" button$/, (label) => {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    });
  });
});
