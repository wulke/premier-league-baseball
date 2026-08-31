// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004
import path from 'path';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import routes from '../../../src/ui/routes';

const feature = loadFeature(path.resolve(__dirname, '../features/lineup-view-ui.feature'));

type RosterPlayer = { id: number; givenName: string; familyName: string; countryCode: string; bats: 'R'; throws: 'R'; age: number; primaryPosition: string; positionCoverage: string[]; contact: number; power: number; armStrength: number; accuracy: number; reaction: number; vision: number; discipline: number };
type TeamLineup = { starters: Array<{ playerId: number; battingOrder: number | null; fieldingPosition: string | null }>; startingPitcherId: number; bench: Array<{ playerId: number }>; bullpen: Array<{ playerId: number }> };

let lineup: TeamLineup;
let roster: RosterPlayer[];

const rosterPlayer = (id: number): RosterPlayer => ({ id, givenName: `Player`, familyName: String(id), countryCode: 'US', bats: 'R', throws: 'R', age: 25, primaryPosition: 'Shortstop', positionCoverage: ['Shortstop'], contact: 60, power: 60, armStrength: 60, accuracy: 60, reaction: 60, vision: 60, discipline: 60 });
const makeRoster = () => Array.from({ length: 13 }, (_, index) => rosterPlayer(index + 1));
const dhOff = (): TeamLineup => ({ starters: [
  { playerId: 1, battingOrder: 1, fieldingPosition: 'Catcher' }, { playerId: 2, battingOrder: 2, fieldingPosition: 'FirstBase' }, { playerId: 3, battingOrder: 3, fieldingPosition: 'SecondBase' },
  { playerId: 4, battingOrder: 4, fieldingPosition: 'ThirdBase' }, { playerId: 5, battingOrder: 5, fieldingPosition: 'Shortstop' }, { playerId: 6, battingOrder: 6, fieldingPosition: 'LeftField' },
  { playerId: 7, battingOrder: 7, fieldingPosition: 'CenterField' }, { playerId: 8, battingOrder: 8, fieldingPosition: 'RightField' }, { playerId: 9, battingOrder: 9, fieldingPosition: 'Pitcher' },
], startingPitcherId: 9, bench: [{ playerId: 10 }, { playerId: 11 }], bullpen: [{ playerId: 12 }, { playerId: 13 }] });
const dhOn = (): TeamLineup => ({ ...dhOff(), starters: [...dhOff().starters.slice(0, 8), { playerId: 9, battingOrder: 9, fieldingPosition: null }, { playerId: 10, battingOrder: null, fieldingPosition: 'Pitcher' }], startingPitcherId: 10, bench: [{ playerId: 11 }], bullpen: [{ playerId: 12 }] });

const installFetch = () => {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = input.toString();
    const response = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (url === '/api/team/10/lineup?gwId=1') return response(lineup);
    if (url === '/api/team/10/roster') return response(roster);
    if (url === '/api/gameWorld/1') return response({ id: 1, year: 2025, config: { name: 'Test World', inProgress: true }, Leagues: [] });
    return response([]);
  }) as jest.Mock;
};

// @spec LINEUI-001,LINEUI-002,LINEUI-003,LINEUI-004,RLDRUI-006
const renderAt = async (entry: string) => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [entry] })} />);
  await screen.findByTestId('app-shell');
};

beforeEach(() => { lineup = dhOff(); roster = makeRoster(); installFetch(); });
afterEach(() => cleanup());

defineFeature(feature, (test) => {
  test('The team hub offers a Lineup tab', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-001
    then('the page shows a Lineup tab', () => expect(screen.getByRole('link', { name: 'Lineup' })).toBeInTheDocument());
  });

  test('A DH-off active lineup shows its nine batting starters and reserve pools', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-off active lineup', () => { lineup = dhOff(); }); and('GET /api/team/10/roster returns names for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-002
    then('the batting-order card shows starters 1 through 9 with fielding positions', async () => { await waitFor(() => expect(screen.getAllByTestId(/batting-order-row-/)).toHaveLength(9)); expect(screen.getByTestId('batting-order-row-9')).toHaveTextContent('Pitcher'); });
    // @spec LINEUI-002
    and('the starting pitcher is highlighted', () => expect(screen.getByTestId('starting-pitcher')).toHaveTextContent('Player 9'));
    // @spec LINEUI-002
    and('no DH row is shown', () => expect(screen.queryByTestId('dh-row')).toBeNull());
    // @spec LINEUI-004
    and('the bench and bullpen pools are shown', () => { expect(screen.getByTestId('bench-pool')).toHaveTextContent('Player 10'); expect(screen.getByTestId('bullpen-pool')).toHaveTextContent('Player 12'); });
    // @spec LINEUI-004
    and('starter, bench, and bullpen rows link to player detail', () => { expect(within(screen.getByTestId('batting-order-row-1')).getByRole('link')).toHaveAttribute('href', '/1/player/1'); expect(within(screen.getByTestId('bench-pool')).getByRole('link', { name: 'Player 10' })).toHaveAttribute('href', '/1/player/10'); expect(within(screen.getByTestId('bullpen-pool')).getByRole('link', { name: 'Player 12' })).toHaveAttribute('href', '/1/player/12'); });
  });

  test('A DH-on active lineup shows a DH row and a non-batting starting pitcher', ({ given, and, when, then }) => {
    given('GameWorld 1 exists', () => {}); and('Team 10 "Manchester Mariners" belongs to GameWorld 1', () => {});
    given('GET /api/team/10/lineup returns a DH-on active lineup', () => { lineup = dhOn(); }); and('GET /api/team/10/roster returns names for the active lineup', () => { roster = makeRoster(); });
    when('the player navigates to "/1/team/10/lineup"', () => renderAt('/1/team/10/lineup'));
    // @spec LINEUI-003
    then('the batting-order card shows starters 1 through 9 with fielding positions', async () => { await waitFor(() => expect(screen.getAllByTestId(/batting-order-row-/)).toHaveLength(9)); expect(screen.getByTestId('batting-order-row-9')).toHaveTextContent('DH'); });
    // @spec LINEUI-003
    and('a DH row is shown', () => expect(screen.getByTestId('dh-row')).toHaveTextContent('Player 9'));
    // @spec LINEUI-003
    and('the starting pitcher is highlighted', () => expect(screen.getByTestId('starting-pitcher')).toHaveTextContent('Player 10'));
    // @spec LINEUI-004
    and('no mutating lineup controls are shown', () => expect(screen.queryByRole('button', { name: /edit|save|set starter|substitute/i })).toBeNull());
  });
});
