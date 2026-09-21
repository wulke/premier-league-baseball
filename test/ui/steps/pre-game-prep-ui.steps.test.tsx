// @spec PREGAME-001,PREGAME-002,PREGAME-003,PREGAME-004 (pre-game prep acceptance)
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/pre-game-prep-ui.feature'));
const positions = ['Pitcher', 'Catcher', 'FirstBase', 'SecondBase', 'ThirdBase', 'Shortstop', 'LeftField', 'CenterField', 'RightField'];
const player = (id: number, pitcher = false) => ({ id, givenName: pitcher ? 'Ace' : 'Player', familyName: String(id), primaryPosition: pitcher ? 'Pitcher' : 'Shortstop', positions: Object.fromEntries(positions.map((position) => [position, 70])) });
const lineup = { starters: [{ playerId: 1, battingOrder: 1, fieldingPosition: 'Shortstop', valid: true }, { playerId: 2, battingOrder: 9, fieldingPosition: 'Pitcher', valid: true }], startingPitcherId: 2, bench: [], bullpen: [] };
let hasGame = true;
let gameStatus = 'SCHEDULED';

const mount = () => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/1/5/game/40'] })} />);
beforeEach(() => {
  hasGame = true;
  gameStatus = 'SCHEDULED';
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET';
    const response = (body: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    if (/gameWorld\/1$/.test(url)) return response({ id: 1, managedTeamId: 10 });
    if (/team\/10\/calendar/.test(url)) return response({ games: hasGame ? [{ gameId: 40, scheduledDate: '2025-04-05T00:00:00.000Z', homeTeamId: 10, homeTeamName: 'Mariners', awayTeamId: 11, awayTeamName: 'Rivertown', leagueId: 5, status: gameStatus, homeTeamResult: gameStatus === 'COMPLETED' ? 5 : null, awayTeamResult: gameStatus === 'COMPLETED' ? 2 : null }] : [] });
    if (/team\/10\/lineup/.test(url)) return response(lineup);
    if (/team\/10\/roster/.test(url)) return response([player(1), player(2, true)]);
    if (/team\/11\/roster/.test(url)) return response([player(30, true)]);
    if (/league\/5\/standings/.test(url)) return response([{ teamId: 11, won: 8, lost: 4, drawn: 0 }]);
    if (/game\/40\/simulate/.test(url) && method === 'POST') { gameStatus = 'COMPLETED'; return response({ homeTeamResult: 5, awayTeamResult: 2 }); }
    return response({});
  }) as jest.Mock;
});
afterEach(cleanup);

defineFeature(feature, (test) => {
  test('A managed club prepares and simulates its scheduled game', ({ given, when, then, and }) => {
    given('a managed club has a scheduled game and game lineup snapshot', () => { hasGame = true; });
    when("the manager opens that game's pre-game route", mount);
    then('the page shows opponent record, probable pitcher, and the game lineup editor', async () => { await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Lineup' })).toBeInTheDocument()); expect(screen.getByText('Rivertown')).toBeInTheDocument(); expect(screen.getByText('Record: 8-4')).toBeInTheDocument(); expect(screen.getByText('Probable pitcher: Ace 30')).toBeInTheDocument(); });
    when('the manager selects "Ready to sim"', () => fireEvent.click(screen.getByRole('button', { name: 'Ready to sim' })));
    then('the completed score is shown', async () => await waitFor(() => { expect(screen.getByTestId('pre-game-score')).toHaveTextContent('5–2'); expect(screen.queryByText('Game unavailable')).toBeNull(); expect(screen.queryByRole('button', { name: 'Ready to sim' })).toBeNull(); }));
  });
  test("Another club's game is unavailable", ({ given, when, then, and }) => {
    given('a managed club does not have the requested game', () => { hasGame = false; });
    when("the manager opens that game's pre-game route", mount);
    then('the game is unavailable and no simulation action is shown', async () => { await waitFor(() => expect(screen.getByText('Game unavailable')).toBeInTheDocument()); expect(screen.queryByRole('button', { name: 'Ready to sim' })).toBeNull(); });
  });
});
