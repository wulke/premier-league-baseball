// @spec BOXSUI-001,BOXSUI-002
import path from 'path';
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, render, screen } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/game-box-score-ui.feature'));
let boxScore: any;
const base = () => ({ id: 42, home: { teamId: 10, teamName: 'Home Club', score: 7, players: [{ id: 1, givenName: 'Home', familyName: 'Starter', role: 'STARTER', battingOrder: 1, fieldingPosition: 'Catcher', AB: 4, H: 2, R: 1, RBI: 2, '2B': 1, '3B': 0, HR: 0, BB: 0, SO: 0, IP: 0, pitchingH: 0, pitchingBB: 0, pitchingSO: 0, ER: 0 }] }, away: { teamId: 20, teamName: 'Away Club', score: 3, players: [{ id: 2, givenName: 'Away', familyName: 'Pitcher', role: 'STARTER', battingOrder: 1, fieldingPosition: 'Pitcher', AB: 3, H: 1, R: 0, RBI: 0, '2B': 0, '3B': 0, HR: 0, BB: 0, SO: 1, IP: 2.2, pitchingH: 4, pitchingBB: 1, pitchingSO: 3, ER: 2 }] } });

defineFeature(feature, (test) => {
  test('The route loader renders the completed score and roster tables', ({ given, when, then }) => {
    given('GET /api/game/42 returns a completed box score', () => { boxScore = base(); });
    when('the user navigates to the game box score route', async () => { global.fetch = jest.fn((input: RequestInfo | URL) => Promise.resolve({ ok: true, json: () => Promise.resolve(input.toString() === '/api/gameWorld/1' ? { id: 1, config: {} } : boxScore) })) as jest.Mock; render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/game/42'] })} />); });
    then('the game box score shows both final scores and player rows', async () => { expect(await screen.findByTestId('game-box-score')).toHaveTextContent('Home Club 7'); expect(screen.getByTestId('game-box-score')).toHaveTextContent('Away Club 3'); expect(screen.getByText('Home Starter')).toBeInTheDocument(); expect(screen.getByText('Away Pitcher')).toBeInTheDocument(); });
  });
  test('One missing team side has its own empty state', ({ given, when, then }) => {
    given('GET /api/game/42 returns a completed box score with no away players', () => { boxScore = base(); boxScore.away.players = []; });
    when('the user navigates to the game box score route', async () => { global.fetch = jest.fn((input: RequestInfo | URL) => Promise.resolve({ ok: true, json: () => Promise.resolve(input.toString() === '/api/gameWorld/1' ? { id: 1, config: {} } : boxScore) })) as jest.Mock; render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/game/42'] })} />); });
    then('the away box score says "No stats recorded" while home rows remain visible', async () => { expect(await screen.findByTestId('away-box-score-empty')).toHaveTextContent('No stats recorded'); expect(screen.getByText('Home Starter')).toBeInTheDocument(); });
  });
});
afterEach(() => cleanup());
